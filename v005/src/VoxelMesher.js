/**
 * VoxelMesher.js - Greedy Meshing Algorithm for Voxel Optimization
 * 
 * Generates optimized meshes from voxel data using greedy meshing to reduce
 * triangle count by combining adjacent faces into larger quads.
 */

import * as THREE from 'three';
import { VoxelEdgeMaterial } from './VoxelEdgeMaterial.js';
import { VoxelEdgeMaterialFixed } from './VoxelEdgeMaterialFixed.js';
import { SimpleVoxelMaterial } from './SimpleVoxelMaterial.js';
import { EdgeMaterial } from './EdgeMaterial.js';
import { VoxelEdgeTextureMaterial } from './VoxelEdgeTextureMaterial.js';

export class VoxelMesher {
    static FACE_DIRECTIONS = [
        { dir: [1, 0, 0], axis: 0, u: 1, v: 2 },  // +X
        { dir: [-1, 0, 0], axis: 0, u: 1, v: 2 }, // -X
        { dir: [0, 1, 0], axis: 1, u: 0, v: 2 },  // +Y
        { dir: [0, -1, 0], axis: 1, u: 0, v: 2 }, // -Y
        { dir: [0, 0, 1], axis: 2, u: 0, v: 1 },  // +Z
        { dir: [0, 0, -1], axis: 2, u: 0, v: 1 }  // -Z
    ];
    
    constructor() {
        this.voxelTypes = this.initializeVoxelTypes();
        this.textureAtlas = null;
        this.atlasSize = 16; // 16x16 texture atlas
    }
    
    /**
     * Initialize voxel type definitions
     */
    initializeVoxelTypes() {
        return {
            0: { name: 'air', solid: false, textures: [0, 0, 0, 0, 0, 0] },
            1: { name: 'custom', solid: true, textures: [0, 0, 0, 0, 0, 0] }, // Uses actual sampled colors
            2: { name: 'grass', solid: true, textures: [2, 2, 0, 1, 2, 2] }, // sides, top, bottom
            3: { name: 'dirt', solid: true, textures: [1, 1, 1, 1, 1, 1] },
            4: { name: 'stone', solid: true, textures: [3, 3, 3, 3, 3, 3] },
            5: { name: 'wood', solid: true, textures: [4, 4, 5, 5, 4, 4] },
            6: { name: 'leaves', solid: true, textures: [6, 6, 6, 6, 6, 6] }
        };
    }
    
    /**
     * Generate mesh for a voxel chunk using greedy meshing
     * @param {VoxelChunk} chunk - The chunk to generate mesh for
     * @param {number} voxelScale - Scale of each voxel in meters (default 0.05 for 5cm)
     */
    generateMesh(chunk, voxelScale = 0.05) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const colors = [];
        const indices = [];
        
        let indexOffset = 0;
        
        // Process each face direction
        for (let faceDir = 0; faceDir < VoxelMesher.FACE_DIRECTIONS.length; faceDir++) {
            const faces = this.generateFacesForDirection(chunk, faceDir);
            const greedyFaces = this.performGreedyMeshing(faces, faceDir);
            
            for (const face of greedyFaces) {
                this.addFaceToMesh(face, faceDir, positions, normals, uvs, colors, indices, indexOffset, voxelScale);
                indexOffset += 4;
            }
        }
        
        if (positions.length === 0) {
            return null;
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        
        return geometry;
    }
    
    /**
     * Generate face data for a specific direction (simplified approach)
     */
    generateFacesForDirection(chunk, faceDir) {
        const faces = [];
        const { dir } = VoxelMesher.FACE_DIRECTIONS[faceDir];
        const size = chunk.constructor.CHUNK_SIZE;
        
        // Simple approach: check each voxel position
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                for (let z = 0; z < size; z++) {
                    const voxelType = chunk.getVoxel(x, y, z);
                    if (voxelType === 0) continue; // Skip air
                    
                    // Check if this face should be rendered
                    const neighborX = x + dir[0];
                    const neighborY = y + dir[1];
                    const neighborZ = z + dir[2];
                    
                    // Use getVoxelSafe which handles both in-bounds and out-of-bounds cases
                    const neighborVoxel = chunk.getVoxelSafe(neighborX, neighborY, neighborZ);
                    
                    // Render face if neighbor is air (0) or if we're at chunk boundary
                    if (neighborVoxel === 0) {
                        // Get custom color for this voxel if it exists
                        const customColor = chunk.getVoxelColor(x, y, z);
                        
                        faces.push({
                            position: [x, y, z],
                            voxelType: voxelType,
                            customColor: customColor,
                            width: 1,
                            height: 1
                        });
                    }
                }
            }
        }
        
        return faces;
    }
    
    /**
     * Fill a slice with voxel data
     */
    fillSlice(chunk, slice, axis, depth, faceDir) {
        const size = chunk.constructor.CHUNK_SIZE;
        const dims = [size, size, size];
        
        for (let u = 0; u < dims[(axis + 1) % 3]; u++) {
            for (let v = 0; v < dims[(axis + 2) % 3]; v++) {
                const coords = [0, 0, 0];
                coords[axis] = depth;
                coords[(axis + 1) % 3] = u;
                coords[(axis + 2) % 3] = v;
                
                const voxelType = chunk.getVoxel(coords[0], coords[1], coords[2]);
                const index = u + v * dims[(axis + 1) % 3];
                
                if (this.shouldRenderFace(chunk, coords, faceDir)) {
                    slice[index] = voxelType;
                } else {
                    slice[index] = 0;
                }
            }
        }
    }
    
    /**
     * Check if face should be rendered (not occluded)
     */
    shouldRenderFace(chunk, coords, faceDir) {
        const [x, y, z] = coords;
        const { dir } = VoxelMesher.FACE_DIRECTIONS[faceDir];
        
        const currentVoxel = chunk.getVoxel(x, y, z);
        if (!this.voxelTypes[currentVoxel]?.solid) return false;
        
        const neighborX = x + dir[0];
        const neighborY = y + dir[1];
        const neighborZ = z + dir[2];
        
        const neighborVoxel = chunk.getVoxelSafe(neighborX, neighborY, neighborZ);
        return !this.voxelTypes[neighborVoxel]?.solid;
    }
    
    /**
     * Convert linear index to 3D coordinates
     */
    indexToCoords(index, axis, dims) {
        const coords = [0, 0, 0];
        const u = (axis + 1) % 3;
        const v = (axis + 2) % 3;
        
        coords[u] = index % dims[u];
        coords[v] = Math.floor(index / dims[u]);
        
        return coords;
    }
    
    /**
     * Perform greedy meshing on face array (simplified - no optimization for now)
     */
    performGreedyMeshing(faces, faceDir) {
        // For now, just return faces as-is without optimization
        // This should create proper cubes instead of broken geometry
        return faces;
    }
    
    /**
     * Add face geometry to mesh arrays
     */
    addFaceToMesh(face, faceDir, positions, normals, uvs, colors, indices, indexOffset, voxelScale = 0.05) {
        const { dir, axis, u: uAxis, v: vAxis } = VoxelMesher.FACE_DIRECTIONS[faceDir];
        const pos = face.position;
        
        // Calculate face corners
        const corners = this.getFaceCorners(pos, face.width, face.height, axis, uAxis, vAxis, dir, voxelScale);
        
        // Add positions
        for (const corner of corners) {
            positions.push(corner[0], corner[1], corner[2]);
        }
        
        // Add normals
        for (let i = 0; i < 4; i++) {
            normals.push(dir[0], dir[1], dir[2]);
        }
        
        // Add UVs - use face-relative coordinates for edge effect
        // These go from 0 to 1 across each face for proper edge detection
        const faceUvs = [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1]
        ];
        
        for (const uv of faceUvs) {
            uvs.push(uv[0], uv[1]);
        }
        
        // Add colors - try to get custom color from chunk first, then fall back to voxel type
        let voxelColor;
        if (face.customColor) {
            voxelColor = face.customColor;
        } else {
            voxelColor = this.getVoxelColor(face.voxelType);
        }
        
        for (let i = 0; i < 4; i++) {
            colors.push(voxelColor.r, voxelColor.g, voxelColor.b);
        }
        
        // Add indices (two triangles per quad)
        indices.push(
            indexOffset, indexOffset + 1, indexOffset + 2,
            indexOffset, indexOffset + 2, indexOffset + 3
        );
    }
    
    /**
     * Get color for voxel type
     */
    getVoxelColor(voxelType) {
        const colors = {
            0: new THREE.Color(0x000000), // Air (shouldn't be used)
            1: new THREE.Color(0xFFFFFF), // Custom - White (will be overridden by actual color)
            2: new THREE.Color(0x7CB342), // Grass - Green
            3: new THREE.Color(0x8D6E63), // Dirt - Brown
            4: new THREE.Color(0x616161), // Stone - Gray
            5: new THREE.Color(0x5D4037), // Wood - Dark Brown
            6: new THREE.Color(0x388E3C)  // Leaves - Dark Green
        };
        
        return colors[voxelType] || colors[1];
    }
    
    /**
     * Calculate face corner positions
     */
    getFaceCorners(pos, width, height, axis, uAxis, vAxis, dir, voxelScale = 0.05) {
        const corners = [];
        let [x, y, z] = pos;
        
        // Scale all coordinates by voxelScale
        const scale = voxelScale;
        
        // Define the four corners with proper outward-facing normals
        if (dir[0] === 1) { // +X face (right) - looking from +X direction
            x += 1;
            corners.push([x * scale, y * scale, z * scale]);
            corners.push([x * scale, (y + 1) * scale, z * scale]);
            corners.push([x * scale, (y + 1) * scale, (z + 1) * scale]);
            corners.push([x * scale, y * scale, (z + 1) * scale]);
        } else if (dir[0] === -1) { // -X face (left) - looking from -X direction
            corners.push([x * scale, y * scale, z * scale]);
            corners.push([x * scale, y * scale, (z + 1) * scale]);
            corners.push([x * scale, (y + 1) * scale, (z + 1) * scale]);
            corners.push([x * scale, (y + 1) * scale, z * scale]);
        } else if (dir[1] === 1) { // +Y face (top) - looking from +Y direction
            y += 1;
            corners.push([x * scale, y * scale, z * scale]);
            corners.push([x * scale, y * scale, (z + 1) * scale]);
            corners.push([(x + 1) * scale, y * scale, (z + 1) * scale]);
            corners.push([(x + 1) * scale, y * scale, z * scale]);
        } else if (dir[1] === -1) { // -Y face (bottom) - looking from -Y direction
            corners.push([x * scale, y * scale, z * scale]);
            corners.push([(x + 1) * scale, y * scale, z * scale]);
            corners.push([(x + 1) * scale, y * scale, (z + 1) * scale]);
            corners.push([x * scale, y * scale, (z + 1) * scale]);
        } else if (dir[2] === 1) { // +Z face (front) - looking from +Z direction
            z += 1;
            corners.push([x * scale, y * scale, z * scale]);
            corners.push([x * scale, (y + 1) * scale, z * scale]);
            corners.push([(x + 1) * scale, (y + 1) * scale, z * scale]);
            corners.push([(x + 1) * scale, y * scale, z * scale]);
        } else if (dir[2] === -1) { // -Z face (back) - looking from -Z direction
            corners.push([x * scale, y * scale, z * scale]);
            corners.push([(x + 1) * scale, y * scale, z * scale]);
            corners.push([(x + 1) * scale, (y + 1) * scale, z * scale]);
            corners.push([x * scale, (y + 1) * scale, z * scale]);
        }
        
        return corners;
    }
    
    /**
     * Get texture index for voxel type and face direction
     */
    getTextureIndex(voxelType, faceDir) {
        const voxelDef = this.voxelTypes[voxelType];
        if (!voxelDef) return 0;
        
        return voxelDef.textures[faceDir] || 0;
    }
    
    /**
     * Get UV coordinates for texture atlas
     */
    getAtlasUVs(textureIndex, width = 1, height = 1) {
        const tileSize = 1.0 / this.atlasSize;
        const u = (textureIndex % this.atlasSize) * tileSize;
        const v = Math.floor(textureIndex / this.atlasSize) * tileSize;
        
        return [
            [u, v],
            [u + tileSize * width, v],
            [u + tileSize * width, v + tileSize * height],
            [u, v + tileSize * height]
        ];
    }
    
    /**
     * Create material for voxel rendering
     */
    createMaterial(textureUrl = null) {
        // Use simple material for now
        const material = new SimpleVoxelMaterial();
        
        console.log('Created simple voxel material:', material);
        
        return material;
    }
    
    /**
     * Get mesh statistics
     */
    getMeshStats(geometry) {
        if (!geometry) return null;
        
        const positionCount = geometry.attributes.position.count;
        const indexCount = geometry.index ? geometry.index.count : positionCount;
        
        return {
            vertices: positionCount,
            triangles: Math.floor(indexCount / 3),
            quads: Math.floor(indexCount / 6),
            memoryUsage: geometry.attributes.position.array.byteLength +
                        geometry.attributes.normal.array.byteLength +
                        geometry.attributes.uv.array.byteLength +
                        (geometry.index ? geometry.index.array.byteLength : 0)
        };
    }
}