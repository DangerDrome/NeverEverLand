import * as THREE from 'three';
import { VoxelType } from '../types';
import { ColorRegistry } from './ColorRegistry';

/**
 * Simplified baked mesh generator that creates all exposed faces without greedy meshing
 * Used for debugging and as a fallback
 */
export class SimpleBakedMeshGenerator {
    private voxelSize: number;
    private colorRegistry: ColorRegistry;
    
    constructor(voxelSize: number = 0.1) {
        this.voxelSize = voxelSize;
        this.colorRegistry = ColorRegistry.getInstance();
    }
    
    /**
     * Generate simple mesh with all exposed faces
     */
    generateSimpleMesh(voxels: Map<string, VoxelType>): {
        opaqueMesh: THREE.Mesh | null;
        transparentMesh: THREE.Mesh | null;
        metadata: {
            originalVoxelCount: number;
            vertexCount: number;
            faceCount: number;
        };
    } {
        console.log('SimpleBakedMeshGenerator: Processing', voxels.size, 'voxels');
        
        const opaqueGeometry = new THREE.BufferGeometry();
        const transparentGeometry = new THREE.BufferGeometry();
        
        const opaquePositions: number[] = [];
        const opaqueNormals: number[] = [];
        const opaqueColors: number[] = [];
        const opaqueIndices: number[] = [];
        
        const transparentPositions: number[] = [];
        const transparentNormals: number[] = [];
        const transparentColors: number[] = [];
        const transparentIndices: number[] = [];
        
        let opaqueVertexIndex = 0;
        let transparentVertexIndex = 0;
        let totalFaces = 0;
        
        // Face normals and offsets
        const faceData = [
            { normal: [1, 0, 0], offset: [1, 0, 0] },   // +X
            { normal: [-1, 0, 0], offset: [0, 0, 0] },  // -X
            { normal: [0, 1, 0], offset: [0, 1, 0] },   // +Y
            { normal: [0, -1, 0], offset: [0, 0, 0] },  // -Y
            { normal: [0, 0, 1], offset: [0, 0, 1] },   // +Z
            { normal: [0, 0, -1], offset: [0, 0, 0] }   // -Z
        ];
        
        // Process each voxel
        for (const [key, type] of voxels) {
            const [x, y, z] = key.split(',').map(Number);
            const color = this.getVoxelColor(type);
            const isTransparent = this.isTransparent(type);
            
            // Check each face
            for (const face of faceData) {
                // Check if adjacent voxel exists
                const adjacentKey = `${x + face.normal[0]},${y + face.normal[1]},${z + face.normal[2]}`;
                if (!voxels.has(adjacentKey)) {
                    // Face is exposed, add it
                    const positions = isTransparent ? transparentPositions : opaquePositions;
                    const normals = isTransparent ? transparentNormals : opaqueNormals;
                    const colors = isTransparent ? transparentColors : opaqueColors;
                    const indices = isTransparent ? transparentIndices : opaqueIndices;
                    const vertexIndex = isTransparent ? transparentVertexIndex : opaqueVertexIndex;
                    
                    // Calculate face position
                    const fx = (x + face.offset[0]) * this.voxelSize;
                    const fy = (y + face.offset[1]) * this.voxelSize;
                    const fz = (z + face.offset[2]) * this.voxelSize;
                    
                    // Add vertices based on face orientation
                    if (Math.abs(face.normal[0]) > 0) {
                        // X face
                        if (face.normal[0] > 0) {
                            // X+ face - counter-clockwise when viewed from positive X
                            positions.push(fx, fy, fz);
                            positions.push(fx, fy + this.voxelSize, fz);
                            positions.push(fx, fy + this.voxelSize, fz + this.voxelSize);
                            positions.push(fx, fy, fz + this.voxelSize);
                        } else {
                            // X- face - counter-clockwise when viewed from negative X
                            positions.push(fx, fy, fz);
                            positions.push(fx, fy, fz + this.voxelSize);
                            positions.push(fx, fy + this.voxelSize, fz + this.voxelSize);
                            positions.push(fx, fy + this.voxelSize, fz);
                        }
                    } else if (Math.abs(face.normal[1]) > 0) {
                        // Y face
                        if (face.normal[1] > 0) {
                            // Y+ face (top) - counter-clockwise when viewed from above
                            positions.push(fx, fy, fz);
                            positions.push(fx, fy, fz + this.voxelSize);
                            positions.push(fx + this.voxelSize, fy, fz + this.voxelSize);
                            positions.push(fx + this.voxelSize, fy, fz);
                        } else {
                            // Y- face (bottom) - counter-clockwise when viewed from below
                            positions.push(fx, fy, fz);
                            positions.push(fx + this.voxelSize, fy, fz);
                            positions.push(fx + this.voxelSize, fy, fz + this.voxelSize);
                            positions.push(fx, fy, fz + this.voxelSize);
                        }
                    } else {
                        // Z face
                        if (face.normal[2] > 0) {
                            // Z+ face - counter-clockwise when viewed from positive Z
                            positions.push(fx, fy, fz);
                            positions.push(fx + this.voxelSize, fy, fz);
                            positions.push(fx + this.voxelSize, fy + this.voxelSize, fz);
                            positions.push(fx, fy + this.voxelSize, fz);
                        } else {
                            // Z- face - counter-clockwise when viewed from negative Z
                            positions.push(fx, fy, fz);
                            positions.push(fx, fy + this.voxelSize, fz);
                            positions.push(fx + this.voxelSize, fy + this.voxelSize, fz);
                            positions.push(fx + this.voxelSize, fy, fz);
                        }
                    }
                    
                    // Add normals (4 vertices)
                    for (let i = 0; i < 4; i++) {
                        normals.push(...face.normal);
                        colors.push(color.r, color.g, color.b);
                    }
                    
                    // Add indices
                    indices.push(
                        vertexIndex, vertexIndex + 1, vertexIndex + 2,
                        vertexIndex, vertexIndex + 2, vertexIndex + 3
                    );
                    
                    if (isTransparent) {
                        transparentVertexIndex += 4;
                    } else {
                        opaqueVertexIndex += 4;
                    }
                    
                    totalFaces++;
                }
            }
        }
        
        // Create meshes
        let opaqueMesh = null;
        let transparentMesh = null;
        
        if (opaquePositions.length > 0) {
            opaqueGeometry.setAttribute('position', new THREE.Float32BufferAttribute(opaquePositions, 3));
            opaqueGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(opaqueNormals, 3));
            opaqueGeometry.setAttribute('color', new THREE.Float32BufferAttribute(opaqueColors, 3));
            opaqueGeometry.setIndex(opaqueIndices);
            opaqueGeometry.computeBoundingBox();
            
            const opaqueMaterial = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.8,
                metalness: 0.2,
                side: THREE.FrontSide
            });
            
            opaqueMesh = new THREE.Mesh(opaqueGeometry, opaqueMaterial);
        }
        
        if (transparentPositions.length > 0) {
            transparentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(transparentPositions, 3));
            transparentGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(transparentNormals, 3));
            transparentGeometry.setAttribute('color', new THREE.Float32BufferAttribute(transparentColors, 3));
            transparentGeometry.setIndex(transparentIndices);
            transparentGeometry.computeBoundingBox();
            
            const transparentMaterial = new THREE.MeshStandardMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                roughness: 0.8,
                metalness: 0.2,
                side: THREE.FrontSide
            });
            
            transparentMesh = new THREE.Mesh(transparentGeometry, transparentMaterial);
        }
        
        const totalVertices = opaqueVertexIndex + transparentVertexIndex;
        console.log('Generated', totalFaces, 'faces,', totalVertices, 'vertices');
        
        return {
            opaqueMesh,
            transparentMesh,
            metadata: {
                originalVoxelCount: voxels.size,
                vertexCount: totalVertices,
                faceCount: totalFaces
            }
        };
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