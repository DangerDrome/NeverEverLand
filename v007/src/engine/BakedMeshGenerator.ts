import * as THREE from 'three';
import { VoxelType } from '../types';
import { ColorRegistry } from './ColorRegistry';

interface VoxelData {
    x: number;
    y: number;
    z: number;
    type: VoxelType;
}

interface Face {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    normal: THREE.Vector3;
    type: VoxelType;
}

/**
 * Generates optimized meshes from voxel data using greedy meshing algorithm
 * Reduces vertex count by 99%+ by merging adjacent faces into larger rectangles
 */
export class BakedMeshGenerator {
    private voxelSize: number;
    private colorRegistry: ColorRegistry;
    
    constructor(voxelSize: number = 0.1) {
        this.voxelSize = voxelSize;
        this.colorRegistry = ColorRegistry.getInstance();
    }
    
    /**
     * Generate optimized mesh from voxel data
     * Returns separate meshes for opaque and transparent voxels
     */
    generateOptimizedMesh(voxels: Map<string, VoxelType>): {
        opaqueMesh: THREE.Mesh | null;
        transparentMesh: THREE.Mesh | null;
        metadata: {
            originalVoxelCount: number;
            vertexCount: number;
            faceCount: number;
        };
    } {
        console.log('BakedMeshGenerator: Starting with', voxels.size, 'voxels');
        // Parse voxel data into structured format
        const voxelArray = this.parseVoxelData(voxels);
        
        // Separate opaque and transparent voxels
        const opaqueVoxels = voxelArray.filter(v => !this.isTransparent(v.type));
        const transparentVoxels = voxelArray.filter(v => this.isTransparent(v.type));
        
        // Generate faces using greedy meshing
        const opaqueFaces = this.generateFaces(opaqueVoxels);
        const transparentFaces = this.generateFaces(transparentVoxels);
        
        console.log('Generated faces:', opaqueFaces.length, 'opaque,', transparentFaces.length, 'transparent');
        
        // Create meshes from faces
        const opaqueMesh = opaqueFaces.length > 0 ? this.createMeshFromFaces(opaqueFaces, false) : null;
        const transparentMesh = transparentFaces.length > 0 ? this.createMeshFromFaces(transparentFaces, true) : null;
        
        // Calculate statistics
        const totalFaces = opaqueFaces.length + transparentFaces.length;
        const vertexCount = totalFaces * 4; // 4 vertices per face
        
        return {
            opaqueMesh,
            transparentMesh,
            metadata: {
                originalVoxelCount: voxels.size,
                vertexCount,
                faceCount: totalFaces
            }
        };
    }
    
    /**
     * Parse voxel map into array format
     */
    private parseVoxelData(voxels: Map<string, VoxelType>): VoxelData[] {
        const result: VoxelData[] = [];
        
        for (const [key, type] of voxels) {
            const [x, y, z] = key.split(',').map(Number);
            result.push({ x, y, z, type });
        }
        
        return result;
    }
    
    /**
     * Check if voxel type is transparent
     */
    private isTransparent(type: VoxelType): boolean {
        return type === VoxelType.WATER || 
               type === VoxelType.ICE || 
               type === VoxelType.LEAVES ||
               type === VoxelType.SNOW;
    }
    
    /**
     * Generate optimized faces using greedy meshing algorithm
     */
    private generateFaces(voxelData: VoxelData[]): Face[] {
        if (voxelData.length === 0) return [];
        
        // Create voxel lookup map for fast access
        const voxelMap = new Map<string, VoxelType>();
        for (const voxel of voxelData) {
            voxelMap.set(`${voxel.x},${voxel.y},${voxel.z}`, voxel.type);
        }
        
        const faces: Face[] = [];
        
        // Process each axis
        faces.push(...this.generateFacesForAxis(voxelMap, 'x'));
        faces.push(...this.generateFacesForAxis(voxelMap, 'y'));
        faces.push(...this.generateFacesForAxis(voxelMap, 'z'));
        
        return faces;
    }
    
    /**
     * Generate faces for a specific axis using greedy meshing
     */
    private generateFacesForAxis(voxelMap: Map<string, VoxelType>, axis: 'x' | 'y' | 'z'): Face[] {
        const faces: Face[] = [];
        
        // Get bounds
        const bounds = this.getBounds(voxelMap);
        if (!bounds) return faces;
        
        // Define axis mappings based on which faces we're generating
        let primaryAxis: number, secondaryAxis: number, tertiaryAxis: number;
        
        if (axis === 'x') {
            // X faces: iterate X slices, width = Z, height = Y
            primaryAxis = 0; // X
            secondaryAxis = 2; // Z (width)
            tertiaryAxis = 1; // Y (height)
        } else if (axis === 'y') {
            // Y faces: iterate Y slices, width = X, height = Z
            primaryAxis = 1; // Y
            secondaryAxis = 0; // X (width)
            tertiaryAxis = 2; // Z (height)
        } else {
            // Z faces: iterate Z slices, width = X, height = Y
            primaryAxis = 2; // Z
            secondaryAxis = 0; // X (width)
            tertiaryAxis = 1; // Y (height)
        }
        
        // Process each slice along the primary axis
        // Start from min-1 to catch negative-facing boundary faces
        // End at max+1 to catch positive-facing boundary faces
        for (let slice = bounds.min[primaryAxis] - 1; slice <= bounds.max[primaryAxis] + 1; slice++) {
            // Create mask for this slice
            const mask = this.createSliceMask(
                voxelMap, 
                slice, 
                primaryAxis, 
                secondaryAxis, 
                tertiaryAxis, 
                bounds
            );
            
            // Generate rectangles from mask
            const sliceFaces = this.generateRectanglesFromMask(
                mask, 
                slice, 
                primaryAxis, 
                secondaryAxis, 
                tertiaryAxis,
                bounds,
                voxelMap
            );
            
            faces.push(...sliceFaces);
        }
        
        return faces;
    }
    
    /**
     * Create a mask for a slice showing which faces need to be rendered
     */
    private createSliceMask(
        voxelMap: Map<string, VoxelType>,
        slice: number,
        primaryAxis: number,
        secondaryAxis: number,
        tertiaryAxis: number,
        bounds: { min: number[]; max: number[] }
    ): (VoxelType | null)[][] {
        const width = bounds.max[secondaryAxis] - bounds.min[secondaryAxis] + 1;
        const height = bounds.max[tertiaryAxis] - bounds.min[tertiaryAxis] + 1;
        const mask: (VoxelType | null)[][] = Array(height).fill(null).map(() => Array(width).fill(null));
        
        for (let u = 0; u < width; u++) {
            for (let v = 0; v < height; v++) {
                const coord = [0, 0, 0];
                coord[primaryAxis] = slice;
                coord[secondaryAxis] = bounds.min[secondaryAxis] + u;
                coord[tertiaryAxis] = bounds.min[tertiaryAxis] + v;
                
                const currentKey = `${coord[0]},${coord[1]},${coord[2]}`;
                
                // Check the previous position along the primary axis
                const prevCoord = [...coord];
                prevCoord[primaryAxis] = slice - 1;
                const prevKey = `${prevCoord[0]},${prevCoord[1]},${prevCoord[2]}`;
                
                const currentVoxel = voxelMap.get(currentKey);
                const prevVoxel = voxelMap.get(prevKey);
                
                // Create face if there's a voxel on one side but not the other
                if (currentVoxel && !prevVoxel) {
                    // Face on the negative side of current voxel (facing negative direction)
                    mask[v][u] = currentVoxel;
                } else if (!currentVoxel && prevVoxel) {
                    // Face on the positive side of previous voxel (facing positive direction)  
                    mask[v][u] = prevVoxel;
                }
            }
        }
        
        return mask;
    }
    
    /**
     * Generate optimized rectangles from a slice mask using greedy algorithm
     */
    private generateRectanglesFromMask(
        mask: (VoxelType | null)[][],
        slice: number,
        primaryAxis: number,
        secondaryAxis: number,
        tertiaryAxis: number,
        bounds: { min: number[]; max: number[] },
        voxelMap: Map<string, VoxelType>
    ): Face[] {
        const faces: Face[] = [];
        const height = mask.length;
        const width = mask[0].length;
        const used = Array(height).fill(null).map(() => Array(width).fill(false));
        
        // Greedy meshing algorithm
        for (let v = 0; v < height; v++) {
            for (let u = 0; u < width; u++) {
                if (mask[v][u] !== null && !used[v][u]) {
                    const type = mask[v][u]!;
                    
                    // Find rectangle width
                    let rectWidth = 1;
                    while (u + rectWidth < width && 
                           mask[v][u + rectWidth] === type && 
                           !used[v][u + rectWidth]) {
                        rectWidth++;
                    }
                    
                    // Find rectangle height
                    let rectHeight = 1;
                    outer: while (v + rectHeight < height) {
                        for (let i = 0; i < rectWidth; i++) {
                            if (mask[v + rectHeight][u + i] !== type || 
                                used[v + rectHeight][u + i]) {
                                break outer;
                            }
                        }
                        rectHeight++;
                    }
                    
                    // Mark cells as used
                    for (let j = 0; j < rectHeight; j++) {
                        for (let i = 0; i < rectWidth; i++) {
                            used[v + j][u + i] = true;
                        }
                    }
                    
                    // Create face
                    const coord = [0, 0, 0];
                    coord[secondaryAxis] = bounds.min[secondaryAxis] + u;
                    coord[tertiaryAxis] = bounds.min[tertiaryAxis] + v;
                    
                    const normal = new THREE.Vector3(0, 0, 0);
                    // Check if this face belongs to current slice voxel or previous slice voxel
                    const currentCoord = [...coord];
                    currentCoord[primaryAxis] = slice;
                    const currentKey = `${currentCoord[0]},${currentCoord[1]},${currentCoord[2]}`;
                    
                    // Determine face position and normal direction based on mask
                    // The mask already determined which voxel has the face
                    const prevCoord = [...coord];
                    prevCoord[primaryAxis] = slice - 1;
                    const prevKey = `${prevCoord[0]},${prevCoord[1]},${prevCoord[2]}`;
                    
                    if (voxelMap.has(currentKey)) {
                        // Face belongs to current voxel, facing negative
                        coord[primaryAxis] = slice;
                        normal.setComponent(primaryAxis, -1);
                    } else if (voxelMap.has(prevKey)) {
                        // Face belongs to previous voxel, facing positive
                        coord[primaryAxis] = slice - 1;
                        normal.setComponent(primaryAxis, 1);
                    } else {
                        // At boundary - the mask determined we need a face here
                        // This happens when checking slices outside bounds
                        // Determine which voxel owns this face based on the mask
                        if (slice <= bounds.min[primaryAxis]) {
                            // We're at or before the minimum bound
                            // Face belongs to voxel at minimum bound, facing negative
                            coord[primaryAxis] = bounds.min[primaryAxis];
                            normal.setComponent(primaryAxis, -1);
                        } else {
                            // We're at or after the maximum bound
                            // Face belongs to voxel at maximum bound, facing positive
                            coord[primaryAxis] = bounds.max[primaryAxis];
                            normal.setComponent(primaryAxis, 1);
                        }
                    }
                    
                    // Store face with proper width/height based on axis
                    const face: Face = {
                        x: coord[0],
                        y: coord[1],
                        z: coord[2],
                        width: rectWidth,
                        height: rectHeight,
                        normal,
                        type
                    };
                    
                    faces.push(face);
                }
            }
        }
        
        return faces;
    }
    
    /**
     * Get bounds of voxel data
     */
    private getBounds(voxelMap: Map<string, VoxelType>): { min: number[]; max: number[] } | null {
        if (voxelMap.size === 0) return null;
        
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        for (const key of voxelMap.keys()) {
            const [x, y, z] = key.split(',').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
        }
        
        return {
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ]
        };
    }
    
    /**
     * Create a mesh from optimized faces
     */
    private createMeshFromFaces(faces: Face[], transparent: boolean): THREE.Mesh {
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        
        let vertexIndex = 0;
        
        for (const face of faces) {
            // Get color for voxel type
            const color = this.getVoxelColor(face.type);
            
            // Calculate face position and size
            const x = face.x * this.voxelSize;
            const y = face.y * this.voxelSize;
            const z = face.z * this.voxelSize;
            
            // Create vertices based on face normal
            const vertices = this.getFaceVertices(face, x, y, z);
            
            // Add vertices
            for (const vertex of vertices) {
                positions.push(vertex.x, vertex.y, vertex.z);
                normals.push(face.normal.x, face.normal.y, face.normal.z);
                colors.push(color.r, color.g, color.b);
            }
            
            // Add indices (two triangles)
            indices.push(
                vertexIndex, vertexIndex + 1, vertexIndex + 2,
                vertexIndex, vertexIndex + 2, vertexIndex + 3
            );
            
            vertexIndex += 4;
        }
        
        // Create geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeBoundingBox();
        
        // Create material matching VoxelRenderer settings
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            transparent,
            opacity: transparent ? 0.8 : 1.0,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.FrontSide
        });
        
        return new THREE.Mesh(geometry, material);
    }
    
    /**
     * Get vertices for a face based on its normal direction
     */
    private getFaceVertices(face: Face, x: number, y: number, z: number): THREE.Vector3[] {
        const size = this.voxelSize;
        const vertices: THREE.Vector3[] = [];
        
        if (Math.abs(face.normal.x) > 0) {
            // X-facing face (YZ plane)
            // Width extends along Z, height along Y
            const xPos = face.normal.x > 0 ? x + size : x;
            
            if (face.normal.x > 0) {
                // X+ face (right) - counter-clockwise when viewed from positive X
                vertices.push(
                    new THREE.Vector3(xPos, y, z),
                    new THREE.Vector3(xPos, y + face.height * size, z),
                    new THREE.Vector3(xPos, y + face.height * size, z + face.width * size),
                    new THREE.Vector3(xPos, y, z + face.width * size)
                );
            } else {
                // X- face (left) - counter-clockwise when viewed from negative X
                vertices.push(
                    new THREE.Vector3(xPos, y, z),
                    new THREE.Vector3(xPos, y, z + face.width * size),
                    new THREE.Vector3(xPos, y + face.height * size, z + face.width * size),
                    new THREE.Vector3(xPos, y + face.height * size, z)
                );
            }
        } else if (Math.abs(face.normal.y) > 0) {
            // Y-facing face (XZ plane)  
            // Width extends along X, height along Z
            const yPos = face.normal.y > 0 ? y + size : y;
            
            if (face.normal.y > 0) {
                // Y+ face (top) - counter-clockwise when viewed from above
                vertices.push(
                    new THREE.Vector3(x, yPos, z),
                    new THREE.Vector3(x, yPos, z + face.height * size),
                    new THREE.Vector3(x + face.width * size, yPos, z + face.height * size),
                    new THREE.Vector3(x + face.width * size, yPos, z)
                );
            } else {
                // Y- face (bottom) - counter-clockwise when viewed from below
                vertices.push(
                    new THREE.Vector3(x, yPos, z),
                    new THREE.Vector3(x + face.width * size, yPos, z),
                    new THREE.Vector3(x + face.width * size, yPos, z + face.height * size),
                    new THREE.Vector3(x, yPos, z + face.height * size)
                );
            }
        } else {
            // Z-facing face (XY plane)
            // Width extends along X, height along Y
            const zPos = face.normal.z > 0 ? z + size : z;
            
            if (face.normal.z > 0) {
                // Z+ face (front) - counter-clockwise when viewed from positive Z
                vertices.push(
                    new THREE.Vector3(x, y, zPos),
                    new THREE.Vector3(x + face.width * size, y, zPos),
                    new THREE.Vector3(x + face.width * size, y + face.height * size, zPos),
                    new THREE.Vector3(x, y + face.height * size, zPos)
                );
            } else {
                // Z- face (back) - counter-clockwise when viewed from negative Z
                vertices.push(
                    new THREE.Vector3(x, y, zPos),
                    new THREE.Vector3(x, y + face.height * size, zPos),
                    new THREE.Vector3(x + face.width * size, y + face.height * size, zPos),
                    new THREE.Vector3(x + face.width * size, y, zPos)
                );
            }
        }
        
        return vertices;
    }
    
    /**
     * Get color for voxel type
     */
    private getVoxelColor(type: VoxelType): THREE.Color {
        // Check ColorRegistry first for custom colors
        const registeredColor = this.colorRegistry.getColor(type);
        if (registeredColor) {
            return new THREE.Color(registeredColor);
        }
        
        // Fallback to default colors
        const defaultColors: Partial<Record<VoxelType, string>> = {
            [VoxelType.GRASS]: 'rgb(144, 238, 144)',
            [VoxelType.DIRT]: 'rgb(139, 105, 20)',
            [VoxelType.STONE]: 'rgb(105, 105, 105)',
            [VoxelType.WOOD]: 'rgb(222, 184, 135)',
            [VoxelType.LEAVES]: 'rgb(50, 205, 50)',
            [VoxelType.WATER]: 'rgb(135, 206, 235)',
            [VoxelType.SAND]: 'rgb(255, 228, 181)',
            [VoxelType.SNOW]: 'rgb(240, 248, 255)',
            [VoxelType.ICE]: 'rgb(135, 206, 235)'
        };
        
        const colorStr = defaultColors[type] || 'rgb(255, 255, 255)';
        return new THREE.Color(colorStr);
    }
}