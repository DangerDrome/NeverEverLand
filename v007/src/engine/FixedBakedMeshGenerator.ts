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
 * Fixed greedy meshing implementation
 */
export class FixedBakedMeshGenerator {
    private voxelSize: number;
    private colorRegistry: ColorRegistry;
    
    constructor(voxelSize: number = 0.1) {
        this.voxelSize = voxelSize;
        this.colorRegistry = ColorRegistry.getInstance();
    }
    
    /**
     * Generate optimized mesh from voxel data
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
        console.log('FixedBakedMeshGenerator: Starting with', voxels.size, 'voxels');
        
        // Parse voxel data
        const voxelArray = this.parseVoxelData(voxels);
        
        // Separate opaque and transparent
        const opaqueVoxels = voxelArray.filter(v => !this.isTransparent(v.type));
        const transparentVoxels = voxelArray.filter(v => this.isTransparent(v.type));
        
        // Generate faces
        const opaqueFaces = this.generateGreedyFaces(opaqueVoxels);
        const transparentFaces = this.generateGreedyFaces(transparentVoxels);
        
        console.log('Generated faces:', opaqueFaces.length, 'opaque,', transparentFaces.length, 'transparent');
        
        // Create meshes
        const opaqueMesh = opaqueFaces.length > 0 ? this.createMeshFromFaces(opaqueFaces, false) : null;
        const transparentMesh = transparentFaces.length > 0 ? this.createMeshFromFaces(transparentFaces, true) : null;
        
        const totalFaces = opaqueFaces.length + transparentFaces.length;
        const vertexCount = totalFaces * 4;
        
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
    
    private parseVoxelData(voxels: Map<string, VoxelType>): VoxelData[] {
        const result: VoxelData[] = [];
        for (const [key, type] of voxels) {
            const [x, y, z] = key.split(',').map(Number);
            result.push({ x, y, z, type });
        }
        return result;
    }
    
    private isTransparent(type: VoxelType): boolean {
        return type === VoxelType.WATER || 
               type === VoxelType.ICE || 
               type === VoxelType.LEAVES ||
               type === VoxelType.SNOW;
    }
    
    /**
     * Generate faces using fixed greedy meshing
     */
    private generateGreedyFaces(voxelData: VoxelData[]): Face[] {
        if (voxelData.length === 0) return [];
        
        // Create voxel lookup
        const voxelMap = new Map<string, VoxelType>();
        for (const voxel of voxelData) {
            voxelMap.set(`${voxel.x},${voxel.y},${voxel.z}`, voxel.type);
        }
        
        const faces: Face[] = [];
        
        // Get bounds
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        for (const voxel of voxelData) {
            minX = Math.min(minX, voxel.x);
            minY = Math.min(minY, voxel.y);
            minZ = Math.min(minZ, voxel.z);
            maxX = Math.max(maxX, voxel.x);
            maxY = Math.max(maxY, voxel.y);
            maxZ = Math.max(maxZ, voxel.z);
        }
        
        // Process each axis
        const axes = [
            { axis: 0, u: 1, v: 2, normal: [1, 0, 0] },  // X axis
            { axis: 0, u: 2, v: 1, normal: [-1, 0, 0] }, // -X axis
            { axis: 1, u: 0, v: 2, normal: [0, 1, 0] },  // Y axis
            { axis: 1, u: 2, v: 0, normal: [0, -1, 0] }, // -Y axis
            { axis: 2, u: 0, v: 1, normal: [0, 0, 1] },  // Z axis
            { axis: 2, u: 1, v: 0, normal: [0, 0, -1] }  // -Z axis
        ];
        
        for (const { axis, u, v, normal } of axes) {
            const isPositive = normal[axis] > 0;
            
            // Determine bounds for this axis
            const minAxis = axis === 0 ? minX : axis === 1 ? minY : minZ;
            const maxAxis = axis === 0 ? maxX : axis === 1 ? maxY : maxZ;
            const minU = u === 0 ? minX : u === 1 ? minY : minZ;
            const maxU = u === 0 ? maxX : u === 1 ? maxY : maxZ;
            const minV = v === 0 ? minX : v === 1 ? minY : minZ;
            const maxV = v === 0 ? maxX : v === 1 ? maxY : maxZ;
            
            // Process each slice
            for (let d = minAxis; d <= maxAxis; d++) {
                const sliceFaces = this.processSlice(
                    voxelMap, d, axis, u, v, 
                    minU, maxU, minV, maxV,
                    normal[0], normal[1], normal[2],
                    isPositive
                );
                faces.push(...sliceFaces);
            }
        }
        
        return faces;
    }
    
    private processSlice(
        voxelMap: Map<string, VoxelType>,
        d: number, axis: number, u: number, v: number,
        minU: number, maxU: number, minV: number, maxV: number,
        normalX: number, normalY: number, normalZ: number,
        isPositive: boolean
    ): Face[] {
        const width = maxU - minU + 1;
        const height = maxV - minV + 1;
        const mask: (VoxelType | null)[][] = Array(height).fill(null).map(() => Array(width).fill(null));
        
        // Fill mask
        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                const coord = [0, 0, 0];
                coord[axis] = d;
                coord[u] = minU + i;
                coord[v] = minV + j;
                
                const neighborCoord = [...coord];
                neighborCoord[axis] += isPositive ? 1 : -1;
                
                const voxelKey = `${coord[0]},${coord[1]},${coord[2]}`;
                const neighborKey = `${neighborCoord[0]},${neighborCoord[1]},${neighborCoord[2]}`;
                
                const voxel = voxelMap.get(voxelKey);
                const neighbor = voxelMap.get(neighborKey);
                
                // Create face if voxel exists but neighbor doesn't
                if (voxel && !neighbor) {
                    mask[j][i] = voxel;
                }
            }
        }
        
        // Generate rectangles from mask
        return this.generateRectangles(mask, d, axis, u, v, minU, minV, normalX, normalY, normalZ);
    }
    
    private generateRectangles(
        mask: (VoxelType | null)[][],
        d: number, axis: number, u: number, v: number,
        minU: number, minV: number,
        normalX: number, normalY: number, normalZ: number
    ): Face[] {
        const faces: Face[] = [];
        const height = mask.length;
        const width = mask[0].length;
        const used = Array(height).fill(null).map(() => Array(width).fill(false));
        
        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                if (mask[j][i] !== null && !used[j][i]) {
                    const type = mask[j][i]!;
                    
                    // Find rectangle width
                    let w = 1;
                    while (i + w < width && mask[j][i + w] === type && !used[j][i + w]) {
                        w++;
                    }
                    
                    // Find rectangle height
                    let h = 1;
                    outer: while (j + h < height) {
                        for (let k = 0; k < w; k++) {
                            if (mask[j + h][i + k] !== type || used[j + h][i + k]) {
                                break outer;
                            }
                        }
                        h++;
                    }
                    
                    // Mark as used
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            used[j + y][i + x] = true;
                        }
                    }
                    
                    // Create face
                    const coord = [0, 0, 0];
                    coord[axis] = d;
                    coord[u] = minU + i;
                    coord[v] = minV + j;
                    
                    faces.push({
                        x: coord[0],
                        y: coord[1],
                        z: coord[2],
                        width: w,
                        height: h,
                        normal: new THREE.Vector3(normalX, normalY, normalZ),
                        type
                    });
                }
            }
        }
        
        return faces;
    }
    
    private createMeshFromFaces(faces: Face[], transparent: boolean): THREE.Mesh {
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        
        let vertexIndex = 0;
        
        for (const face of faces) {
            const color = this.getVoxelColor(face.type);
            const vertices = this.getFaceVertices(face);
            
            for (const vertex of vertices) {
                positions.push(vertex.x, vertex.y, vertex.z);
                normals.push(face.normal.x, face.normal.y, face.normal.z);
                colors.push(color.r, color.g, color.b);
            }
            
            indices.push(
                vertexIndex, vertexIndex + 1, vertexIndex + 2,
                vertexIndex, vertexIndex + 2, vertexIndex + 3
            );
            
            vertexIndex += 4;
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeBoundingBox();
        
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
    
    private getFaceVertices(face: Face): THREE.Vector3[] {
        const size = this.voxelSize;
        const vertices: THREE.Vector3[] = [];
        
        const x = face.x * size;
        const y = face.y * size;
        const z = face.z * size;
        
        if (Math.abs(face.normal.x) > 0) {
            // X face
            const xPos = face.normal.x > 0 ? x + size : x;
            const w = face.width * size;
            const h = face.height * size;
            vertices.push(
                new THREE.Vector3(xPos, y, z),
                new THREE.Vector3(xPos, y + h, z),
                new THREE.Vector3(xPos, y + h, z + w),
                new THREE.Vector3(xPos, y, z + w)
            );
        } else if (Math.abs(face.normal.y) > 0) {
            // Y face
            const yPos = face.normal.y > 0 ? y + size : y;
            const w = face.width * size;
            const h = face.height * size;
            vertices.push(
                new THREE.Vector3(x, yPos, z),
                new THREE.Vector3(x, yPos, z + h),
                new THREE.Vector3(x + w, yPos, z + h),
                new THREE.Vector3(x + w, yPos, z)
            );
        } else {
            // Z face
            const zPos = face.normal.z > 0 ? z + size : z;
            const w = face.width * size;
            const h = face.height * size;
            vertices.push(
                new THREE.Vector3(x, y, zPos),
                new THREE.Vector3(x + w, y, zPos),
                new THREE.Vector3(x + w, y + h, zPos),
                new THREE.Vector3(x, y + h, zPos)
            );
        }
        
        return vertices;
    }
    
    private getVoxelColor(type: VoxelType): THREE.Color {
        const registeredColor = this.colorRegistry.getColor(type);
        if (registeredColor) {
            return new THREE.Color(registeredColor);
        }
        
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