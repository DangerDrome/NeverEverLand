import * as THREE from 'three';
import { VoxelType } from '../types';
import { ColorRegistry } from './ColorRegistry';

/**
 * Baked mesh generator that creates ALL faces for every voxel
 * No optimization, no greedy meshing - just every single face
 */
export class AllFacesBakedMeshGenerator {
    private voxelSize: number;
    private colorRegistry: ColorRegistry;
    
    constructor(voxelSize: number = 0.1) {
        this.voxelSize = voxelSize;
        this.colorRegistry = ColorRegistry.getInstance();
    }
    
    generateOptimizedMesh(voxels: Map<string, VoxelType>): {
        opaqueMesh: THREE.Mesh | null;
        transparentMesh: THREE.Mesh | null;
        metadata: {
            originalVoxelCount: number;
            vertexCount: number;
            faceCount: number;
        };
    } {
        // AllFacesBakedMeshGenerator: Processing voxels for baking
        
        const opaqueData = { positions: [] as number[], normals: [] as number[], colors: [] as number[], indices: [] as number[] };
        const transparentData = { positions: [] as number[], normals: [] as number[], colors: [] as number[], indices: [] as number[] };
        
        let opaqueVertexIndex = 0;
        let transparentVertexIndex = 0;
        
        // For each voxel, create only external faces (skip internal faces)
        for (const [key, type] of voxels) {
            const [x, y, z] = key.split(',').map(Number);
            const color = this.getVoxelColor(type);
            const isTransparent = this.isTransparent(type);
            
            const data = isTransparent ? transparentData : opaqueData;
            let vertexIndex = isTransparent ? transparentVertexIndex : opaqueVertexIndex;
            
            // Only create faces that don't have adjacent voxels
            const faces = [];
            
            // X- face (left) - only if no voxel at x-1
            if (!voxels.has(`${x-1},${y},${z}`)) {
                faces.push({
                    vertices: [
                        [x, y, z],
                        [x, y, z + 1],
                        [x, y + 1, z + 1],
                        [x, y + 1, z]
                    ],
                    normal: [-1, 0, 0]
                });
            }
            
            // X+ face (right) - only if no voxel at x+1
            if (!voxels.has(`${x+1},${y},${z}`)) {
                faces.push({
                    vertices: [
                        [x + 1, y, z],
                        [x + 1, y + 1, z],
                        [x + 1, y + 1, z + 1],
                        [x + 1, y, z + 1]
                    ],
                    normal: [1, 0, 0]
                });
            }
            
            // Y- face (bottom) - only if no voxel at y-1
            if (!voxels.has(`${x},${y-1},${z}`)) {
                faces.push({
                    vertices: [
                        [x, y, z],
                        [x + 1, y, z],
                        [x + 1, y, z + 1],
                        [x, y, z + 1]
                    ],
                    normal: [0, -1, 0]
                });
            }
            
            // Y+ face (top) - only if no voxel at y+1
            if (!voxels.has(`${x},${y+1},${z}`)) {
                faces.push({
                    vertices: [
                        [x, y + 1, z],
                        [x, y + 1, z + 1],
                        [x + 1, y + 1, z + 1],
                        [x + 1, y + 1, z]
                    ],
                    normal: [0, 1, 0]
                });
            }
            
            // Z- face (back) - only if no voxel at z-1
            if (!voxels.has(`${x},${y},${z-1}`)) {
                faces.push({
                    vertices: [
                        [x, y, z],
                        [x, y + 1, z],
                        [x + 1, y + 1, z],
                        [x + 1, y, z]
                    ],
                    normal: [0, 0, -1]
                });
            }
            
            // Z+ face (front) - only if no voxel at z+1
            if (!voxels.has(`${x},${y},${z+1}`)) {
                faces.push({
                    vertices: [
                        [x, y, z + 1],
                        [x + 1, y, z + 1],
                        [x + 1, y + 1, z + 1],
                        [x, y + 1, z + 1]
                    ],
                    normal: [0, 0, 1]
                });
            }
            
            // Add all faces
            for (const face of faces) {
                // Add vertices
                for (const vertex of face.vertices) {
                    data.positions.push(
                        vertex[0] * this.voxelSize,
                        vertex[1] * this.voxelSize,
                        vertex[2] * this.voxelSize
                    );
                    data.normals.push(face.normal[0], face.normal[1], face.normal[2]);
                    data.colors.push(color.r, color.g, color.b);
                }
                
                // Add indices for two triangles
                data.indices.push(
                    vertexIndex, vertexIndex + 1, vertexIndex + 2,
                    vertexIndex, vertexIndex + 2, vertexIndex + 3
                );
                
                vertexIndex += 4;
            }
            
            if (isTransparent) {
                transparentVertexIndex = vertexIndex;
            } else {
                opaqueVertexIndex = vertexIndex;
            }
        }
        
        // Create meshes
        const opaqueMesh = this.createMesh(opaqueData, false);
        const transparentMesh = this.createMesh(transparentData, true);
        
        const totalFaces = (opaqueData.indices.length + transparentData.indices.length) / 6;
        const totalVertices = opaqueVertexIndex + transparentVertexIndex;
        
        const maxPossibleFaces = voxels.size * 6;
        const reduction = ((maxPossibleFaces - totalFaces) / maxPossibleFaces * 100).toFixed(1);
        // AllFacesBakedMeshGenerator: Face generation complete
        
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
    
    private createMesh(data: { positions: number[], normals: number[], colors: number[], indices: number[] }, transparent: boolean): THREE.Mesh | null {
        if (data.positions.length === 0) return null;
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
        geometry.setIndex(data.indices);
        geometry.computeBoundingBox();
        
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            transparent,
            opacity: transparent ? 0.8 : 1.0,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.FrontSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }
    
    private isTransparent(type: VoxelType): boolean {
        return type === VoxelType.WATER || 
               type === VoxelType.ICE || 
               type === VoxelType.LEAVES ||
               type === VoxelType.SNOW;
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