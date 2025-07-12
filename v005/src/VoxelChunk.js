/**
 * VoxelChunk.js - 32³ Chunk-based Voxel Storage System
 * 
 * Manages a 32x32x32 chunk of voxels with efficient storage and access.
 * Uses TypedArrays for memory efficiency and fast operations.
 */

import * as THREE from 'three';

export class VoxelChunk {
    static CHUNK_SIZE = 32;
    static CHUNK_VOLUME = VoxelChunk.CHUNK_SIZE ** 3;
    
    constructor(chunkX, chunkY, chunkZ) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.chunkZ = chunkZ;
        
        // Voxel data - using Uint16Array for 65536 possible voxel types
        // 0 = air, 1+ = solid voxel types
        this.voxels = new Uint16Array(VoxelChunk.CHUNK_VOLUME);
        
        // Store colors for each voxel (RGB as floats)
        this.voxelColors = new Map(); // Map from voxel index to THREE.Color
        
        // Dirty flags for mesh regeneration
        this.isDirty = false;
        this.mesh = null;
        this.geometry = null;
        
        // Neighbor chunks for seamless meshing
        this.neighbors = {
            px: null, // +X
            nx: null, // -X
            py: null, // +Y
            ny: null, // -Y
            pz: null, // +Z
            nz: null  // -Z
        };
        
        // Cache for performance
        this.lastAccessed = Date.now();
        this.isEmpty = true;
    }
    
    /**
     * Convert 3D coordinates to flat array index
     */
    getIndex(x, y, z) {
        if (x < 0 || x >= VoxelChunk.CHUNK_SIZE || 
            y < 0 || y >= VoxelChunk.CHUNK_SIZE || 
            z < 0 || z >= VoxelChunk.CHUNK_SIZE) {
            return -1;
        }
        return x + y * VoxelChunk.CHUNK_SIZE + z * VoxelChunk.CHUNK_SIZE * VoxelChunk.CHUNK_SIZE;
    }
    
    /**
     * Get voxel at local chunk coordinates
     */
    getVoxel(x, y, z) {
        const index = this.getIndex(x, y, z);
        if (index === -1) return 0;
        
        this.lastAccessed = Date.now();
        return this.voxels[index];
    }
    
    /**
     * Set voxel at local chunk coordinates
     */
    setVoxel(x, y, z, voxelType) {
        const index = this.getIndex(x, y, z);
        if (index === -1) return false;
        
        const oldValue = this.voxels[index];
        if (oldValue === voxelType) return false;
        
        this.voxels[index] = voxelType;
        this.isDirty = true;
        this.lastAccessed = Date.now();
        
        // Update empty status
        if (voxelType === 0 && oldValue !== 0) {
            this.checkIfEmpty();
        } else if (voxelType !== 0) {
            this.isEmpty = false;
        }
        
        // Mark neighboring chunks dirty if on edge
        this.markNeighborsDirtyIfNeeded(x, y, z);
        
        return true;
    }
    
    /**
     * Get voxel from neighboring chunk if coordinates are outside bounds
     */
    getVoxelSafe(x, y, z) {
        // If within bounds, return local voxel
        if (x >= 0 && x < VoxelChunk.CHUNK_SIZE && 
            y >= 0 && y < VoxelChunk.CHUNK_SIZE && 
            z >= 0 && z < VoxelChunk.CHUNK_SIZE) {
            return this.getVoxel(x, y, z);
        }
        
        // Check neighbors
        if (x >= VoxelChunk.CHUNK_SIZE && this.neighbors.px) {
            return this.neighbors.px.getVoxel(x - VoxelChunk.CHUNK_SIZE, y, z);
        }
        if (x < 0 && this.neighbors.nx) {
            return this.neighbors.nx.getVoxel(x + VoxelChunk.CHUNK_SIZE, y, z);
        }
        if (y >= VoxelChunk.CHUNK_SIZE && this.neighbors.py) {
            return this.neighbors.py.getVoxel(x, y - VoxelChunk.CHUNK_SIZE, z);
        }
        if (y < 0 && this.neighbors.ny) {
            return this.neighbors.ny.getVoxel(x, y + VoxelChunk.CHUNK_SIZE, z);
        }
        if (z >= VoxelChunk.CHUNK_SIZE && this.neighbors.pz) {
            return this.neighbors.pz.getVoxel(x, y, z - VoxelChunk.CHUNK_SIZE);
        }
        if (z < 0 && this.neighbors.nz) {
            return this.neighbors.nz.getVoxel(x, y, z + VoxelChunk.CHUNK_SIZE);
        }
        
        return 0; // Air if no neighbor
    }
    
    /**
     * Check if chunk is completely empty
     */
    checkIfEmpty() {
        for (let i = 0; i < this.voxels.length; i++) {
            if (this.voxels[i] !== 0) {
                this.isEmpty = false;
                return;
            }
        }
        this.isEmpty = true;
    }
    
    /**
     * Mark neighboring chunks dirty if voxel is on edge
     */
    markNeighborsDirtyIfNeeded(x, y, z) {
        const size = VoxelChunk.CHUNK_SIZE;
        
        if (x === 0 && this.neighbors.nx) this.neighbors.nx.isDirty = true;
        if (x === size - 1 && this.neighbors.px) this.neighbors.px.isDirty = true;
        if (y === 0 && this.neighbors.ny) this.neighbors.ny.isDirty = true;
        if (y === size - 1 && this.neighbors.py) this.neighbors.py.isDirty = true;
        if (z === 0 && this.neighbors.nz) this.neighbors.nz.isDirty = true;
        if (z === size - 1 && this.neighbors.pz) this.neighbors.pz.isDirty = true;
    }
    
    /**
     * Set neighbor chunk references
     */
    setNeighbor(direction, chunk) {
        this.neighbors[direction] = chunk;
        
        // Set reciprocal neighbor
        const opposite = {
            px: 'nx', nx: 'px',
            py: 'ny', ny: 'py',
            pz: 'nz', nz: 'pz'
        };
        
        if (chunk && opposite[direction]) {
            chunk.neighbors[opposite[direction]] = this;
        }
    }
    
    /**
     * Fill chunk with a specific voxel type
     */
    fill(voxelType) {
        this.voxels.fill(voxelType);
        this.isEmpty = voxelType === 0;
        this.isDirty = true;
        this.lastAccessed = Date.now();
    }
    
    /**
     * Clear chunk (fill with air)
     */
    clear() {
        this.fill(0);
    }
    
    /**
     * Set voxel with custom color
     */
    setVoxelWithColor(x, y, z, voxelType, color) {
        const changed = this.setVoxel(x, y, z, voxelType);
        if (changed && voxelType !== 0) {
            const index = this.getIndex(x, y, z);
            this.voxelColors.set(index, color);
        }
        return changed;
    }
    
    /**
     * Get voxel color
     */
    getVoxelColor(x, y, z) {
        const index = this.getIndex(x, y, z);
        return this.voxelColors.get(index) || new THREE.Color(0x7CB342);
    }

    /**
     * Generate test terrain for this chunk
     */
    generateTestTerrain() {
        // Only generate terrain for ground level chunk (y = 0)
        if (this.chunkY !== 0) {
            return;
        }
        
        // Just place 1 voxel at position 0,0,0 in the chunk
        this.setVoxel(0, 0, 0, 1); // Grass voxel at origin
    }
    
    /**
     * Serialize chunk data for saving
     */
    serialize() {
        return {
            chunkX: this.chunkX,
            chunkY: this.chunkY,
            chunkZ: this.chunkZ,
            voxels: Array.from(this.voxels),
            isEmpty: this.isEmpty
        };
    }
    
    /**
     * Deserialize chunk data from save
     */
    static deserialize(data) {
        const chunk = new VoxelChunk(data.chunkX, data.chunkY, data.chunkZ);
        chunk.voxels = new Uint16Array(data.voxels);
        chunk.isEmpty = data.isEmpty;
        chunk.isDirty = true;
        return chunk;
    }
    
    /**
     * Get memory usage in bytes
     */
    getMemoryUsage() {
        return this.voxels.byteLength + // Voxel data
               64 + // Object overhead
               (this.geometry ? this.geometry.attributes.position.array.byteLength : 0); // Mesh data
    }
    
    /**
     * Dispose of GPU resources
     */
    dispose() {
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }
        
        if (this.mesh && this.mesh.material) {
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(mat => mat.dispose());
            } else {
                this.mesh.material.dispose();
            }
        }
        
        this.mesh = null;
        
        // Clear neighbor references
        Object.keys(this.neighbors).forEach(key => {
            if (this.neighbors[key]) {
                this.neighbors[key].neighbors[this.getOppositeDirection(key)] = null;
            }
            this.neighbors[key] = null;
        });
    }
    
    /**
     * Get opposite direction for neighbor cleanup
     */
    getOppositeDirection(direction) {
        const opposites = {
            px: 'nx', nx: 'px',
            py: 'ny', ny: 'py',
            pz: 'nz', nz: 'pz'
        };
        return opposites[direction];
    }
    
    /**
     * Check if chunk needs mesh regeneration
     */
    needsRebuild() {
        return this.isDirty && !this.isEmpty;
    }
    
    /**
     * Mark mesh as clean after rebuild
     */
    markClean() {
        this.isDirty = false;
    }
}