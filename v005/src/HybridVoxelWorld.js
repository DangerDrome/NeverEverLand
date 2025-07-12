/**
 * HybridVoxelWorld.js - Unified Voxel-Tile System
 * 
 * Combines the efficiency of tile-based placement with the flexibility of voxel editing.
 * Uses template-based storage for tiles until they need to be edited as voxels.
 */

import { VoxelWorld } from './VoxelWorld.js';
import { VoxelChunk } from './VoxelChunk.js';
import * as THREE from 'three';

export class HybridVoxelWorld extends VoxelWorld {
    constructor(scene, camera, renderer) {
        super(scene, camera, renderer);
        
        // Hybrid system configuration
        this.TILE_VOXEL_SIZE = 0.25; // 25cm voxels for tiles
        this.DETAIL_VOXEL_SIZE = 0.05; // 5cm voxels for detailed editing
        this.VOXELS_PER_TILE = Math.round(1.0 / this.TILE_VOXEL_SIZE); // 4 voxels per meter
        
        // Tile template storage
        this.tileTemplates = new Map(); // tileTypeId -> voxel template data
        this.tileInstances = new Map(); // "x,z" -> { type, rotation, isVoxelized }
        
        // Chunk management for different resolutions
        this.tileChunks = new Map(); // 25cm voxel chunks
        this.detailChunks = new Map(); // 5cm voxel chunks (inherited as this.chunks)
        
        // Performance optimization
        this.surfaceCache = new Map(); // Cache detected surfaces for optimization
        
        this.initializeTileTemplates();
    }
    
    /**
     * Initialize voxel templates for each tile type
     */
    initializeTileTemplates() {
        // Import tile types
        import('./TileTypes.js').then(({ tileTypes }) => {
            const allTypes = tileTypes.getTileTypes();
            
            allTypes.forEach(tileType => {
                this.createTileTemplate(tileType);
            });
            
            console.log(`Initialized ${this.tileTemplates.size} tile templates`);
            console.log('Available templates:', Array.from(this.tileTemplates.keys()));
        }).catch(error => {
            console.error('Failed to initialize tile templates:', error);
        });
    }
    
    /**
     * Create voxel template for a tile type
     */
    createTileTemplate(tileType) {
        const template = {
            id: tileType.id,
            name: tileType.name,
            voxelData: [],
            bounds: { width: 0, height: 0, depth: 0 },
            color: new THREE.Color(tileType.color),
            rotatable: tileType.rotatable
        };
        
        // Convert tile dimensions to voxel counts
        const voxelWidth = Math.ceil(tileType.size.width / this.TILE_VOXEL_SIZE);
        const voxelHeight = Math.ceil(tileType.size.height / this.TILE_VOXEL_SIZE);
        const voxelDepth = Math.ceil(tileType.size.depth / this.TILE_VOXEL_SIZE);
        
        template.bounds = { 
            width: voxelWidth, 
            height: voxelHeight, 
            depth: voxelDepth 
        };
        
        // Generate voxel representation based on geometry type
        switch (tileType.geometry) {
            case 'box':
                template.voxelData = this.generateBoxVoxels(voxelWidth, voxelHeight, voxelDepth);
                break;
            case 'cone':
                template.voxelData = this.generateConeVoxels(voxelWidth, voxelHeight, voxelDepth);
                break;
            case 'cylinder':
                template.voxelData = this.generateCylinderVoxels(voxelWidth, voxelHeight, voxelDepth);
                break;
            case 'sphere':
                template.voxelData = this.generateSphereVoxels(voxelWidth, voxelHeight, voxelDepth);
                break;
            default:
                // Default to filled box
                template.voxelData = this.generateBoxVoxels(voxelWidth, voxelHeight, voxelDepth);
        }
        
        this.tileTemplates.set(tileType.id, template);
    }
    
    /**
     * Generate box voxel pattern
     */
    generateBoxVoxels(width, height, depth) {
        const voxels = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                for (let z = 0; z < depth; z++) {
                    voxels.push({ x, y, z, filled: true });
                }
            }
        }
        return voxels;
    }
    
    /**
     * Generate cone voxel pattern
     */
    generateConeVoxels(width, height, depth) {
        const voxels = [];
        const centerX = width / 2;
        const centerZ = depth / 2;
        const baseRadius = Math.min(width, depth) / 2;
        
        for (let y = 0; y < height; y++) {
            const layerRadius = baseRadius * (1 - y / height);
            
            for (let x = 0; x < width; x++) {
                for (let z = 0; z < depth; z++) {
                    const dx = x + 0.5 - centerX;
                    const dz = z + 0.5 - centerZ;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distance <= layerRadius) {
                        voxels.push({ x, y, z, filled: true });
                    }
                }
            }
        }
        return voxels;
    }
    
    /**
     * Generate cylinder voxel pattern
     */
    generateCylinderVoxels(width, height, depth) {
        const voxels = [];
        const centerX = width / 2;
        const centerZ = depth / 2;
        const radius = Math.min(width, depth) / 2;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                for (let z = 0; z < depth; z++) {
                    const dx = x + 0.5 - centerX;
                    const dz = z + 0.5 - centerZ;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distance <= radius) {
                        voxels.push({ x, y, z, filled: true });
                    }
                }
            }
        }
        return voxels;
    }
    
    /**
     * Generate sphere voxel pattern
     */
    generateSphereVoxels(width, height, depth) {
        const voxels = [];
        const centerX = width / 2;
        const centerY = height / 2;
        const centerZ = depth / 2;
        const radius = Math.min(width, height, depth) / 2;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                for (let z = 0; z < depth; z++) {
                    const dx = x + 0.5 - centerX;
                    const dy = y + 0.5 - centerY;
                    const dz = z + 0.5 - centerZ;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    if (distance <= radius) {
                        voxels.push({ x, y, z, filled: true });
                    }
                }
            }
        }
        return voxels;
    }
    
    /**
     * Place a tile using the hybrid system
     */
    placeTile(tileTypeId, worldX, worldZ, rotation = 0) {
        const template = this.tileTemplates.get(tileTypeId);
        if (!template) {
            console.warn(`No template found for tile type: ${tileTypeId}`);
            return false;
        }
        
        // Store tile instance reference
        const key = `${Math.floor(worldX)},${Math.floor(worldZ)}`;
        this.tileInstances.set(key, {
            type: tileTypeId,
            rotation: rotation,
            isVoxelized: false,
            worldX: worldX,
            worldZ: worldZ
        });
        
        // Convert to tile voxel coordinates
        // We need to center the tile on the grid square
        // worldX/worldZ are at grid center (e.g., 0.5, 0.5 for grid 0,0)
        // So we need to offset by half the tile size
        const halfWidth = template.bounds.width / 2;
        const halfDepth = template.bounds.depth / 2;
        
        // Calculate the bottom-left voxel position
        const voxelX = Math.floor((worldX - halfWidth * this.TILE_VOXEL_SIZE) / this.TILE_VOXEL_SIZE);
        const voxelZ = Math.floor((worldZ - halfDepth * this.TILE_VOXEL_SIZE) / this.TILE_VOXEL_SIZE);
        
        // Place template voxels
        this.placeTemplateVoxels(template, voxelX, 0, voxelZ, rotation);
        
        return true;
    }
    
    /**
     * Place template voxels into the world
     */
    placeTemplateVoxels(template, baseX, baseY, baseZ, rotation) {
        const color = template.color;
        console.log(`Placing template voxels for ${template.id} at base (${baseX}, ${baseY}, ${baseZ})`);
        console.log(`Template has ${template.voxelData.length} voxels, bounds:`, template.bounds);
        
        let placedCount = 0;
        template.voxelData.forEach(voxel => {
            if (!voxel.filled) return;
            
            // Apply rotation if needed
            let x = voxel.x;
            let z = voxel.z;
            
            if (rotation !== 0 && template.rotatable) {
                // Simple 90-degree rotation steps
                const rotSteps = Math.round(rotation / (Math.PI / 2)) % 4;
                const centerX = template.bounds.width / 2;
                const centerZ = template.bounds.depth / 2;
                
                // Translate to center, rotate, translate back
                x -= centerX;
                z -= centerZ;
                
                for (let i = 0; i < rotSteps; i++) {
                    const newX = -z;
                    const newZ = x;
                    x = newX;
                    z = newZ;
                }
                
                x += centerX;
                z += centerZ;
            }
            
            // Place in tile chunk (25cm resolution)
            const worldX = baseX + Math.floor(x);
            const worldY = baseY + voxel.y;
            const worldZ = baseZ + Math.floor(z);
            
            this.setTileVoxel(worldX, worldY, worldZ, 1, color);
            placedCount++;
        });
        
        console.log(`Placed ${placedCount} voxels for template ${template.id}`);
    }
    
    /**
     * Set voxel in tile resolution (25cm)
     */
    setTileVoxel(worldX, worldY, worldZ, voxelType, color) {
        // Chunks are still 32x32x32 voxels internally
        const chunkX = Math.floor(worldX / this.chunkSize);
        const chunkY = Math.floor(worldY / this.chunkSize);
        const chunkZ = Math.floor(worldZ / this.chunkSize);
        
        const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
        let chunk = this.tileChunks.get(chunkKey);
        
        if (!chunk) {
            console.log(`Creating new tile chunk at (${chunkX}, ${chunkY}, ${chunkZ})`);
            chunk = new VoxelChunk(chunkX, chunkY, chunkZ);
            this.tileChunks.set(chunkKey, chunk);
            this.updateTileChunkNeighbors(chunk);
        }
        
        const localX = worldX - chunkX * this.chunkSize;
        const localY = worldY - chunkY * this.chunkSize;
        const localZ = worldZ - chunkZ * this.chunkSize;
        
        console.log(`Setting tile voxel at world (${worldX}, ${worldY}, ${worldZ}) -> chunk (${chunkX}, ${chunkY}, ${chunkZ}) local (${localX}, ${localY}, ${localZ})`);
        
        const changed = chunk.setVoxelWithColor(localX, localY, localZ, voxelType, color);
        
        if (changed) {
            console.log('Voxel changed, queuing mesh update');
            this.queueChunkMeshUpdate(chunk);
        } else {
            console.log('Voxel not changed');
        }
        
        return changed;
    }
    
    /**
     * Convert a tile to detailed voxels for editing
     */
    voxelizeTile(worldX, worldZ) {
        const key = `${Math.floor(worldX)},${Math.floor(worldZ)}`;
        const tileInstance = this.tileInstances.get(key);
        
        if (!tileInstance || tileInstance.isVoxelized) {
            return false;
        }
        
        const template = this.tileTemplates.get(tileInstance.type);
        if (!template) {
            return false;
        }
        
        // Mark as voxelized
        tileInstance.isVoxelized = true;
        
        // Convert each 25cm voxel to 5x5x5 5cm voxels
        const scale = Math.round(this.TILE_VOXEL_SIZE / this.DETAIL_VOXEL_SIZE);
        
        // Get tile voxels with centering
        const halfWidth = template.bounds.width / 2;
        const halfDepth = template.bounds.depth / 2;
        const tileVoxelX = Math.floor((worldX - halfWidth * this.TILE_VOXEL_SIZE) / this.TILE_VOXEL_SIZE);
        const tileVoxelZ = Math.floor((worldZ - halfDepth * this.TILE_VOXEL_SIZE) / this.TILE_VOXEL_SIZE);
        
        template.voxelData.forEach(voxel => {
            if (!voxel.filled) return;
            
            // Convert to detail voxels
            for (let dy = 0; dy < scale; dy++) {
                for (let dx = 0; dx < scale; dx++) {
                    for (let dz = 0; dz < scale; dz++) {
                        const detailX = (tileVoxelX + voxel.x) * scale + dx;
                        const detailY = voxel.y * scale + dy;
                        const detailZ = (tileVoxelZ + voxel.z) * scale + dz;
                        
                        // Use inherited setVoxel for 5cm resolution
                        this.setVoxel(detailX, detailY, detailZ, 1);
                    }
                }
            }
        });
        
        // Remove from tile chunks to avoid duplication
        this.removeTileVoxels(worldX, worldZ, template);
        
        return true;
    }
    
    /**
     * Remove tile voxels when converting to detail
     */
    removeTileVoxels(worldX, worldZ, template) {
        // Same centering logic as placeTile
        const halfWidth = template.bounds.width / 2;
        const halfDepth = template.bounds.depth / 2;
        const voxelX = Math.floor((worldX - halfWidth * this.TILE_VOXEL_SIZE) / this.TILE_VOXEL_SIZE);
        const voxelZ = Math.floor((worldZ - halfDepth * this.TILE_VOXEL_SIZE) / this.TILE_VOXEL_SIZE);
        
        template.voxelData.forEach(voxel => {
            if (!voxel.filled) return;
            
            const worldVoxelX = voxelX + voxel.x;
            const worldVoxelY = voxel.y;
            const worldVoxelZ = voxelZ + voxel.z;
            
            this.setTileVoxel(worldVoxelX, worldVoxelY, worldVoxelZ, 0, null);
        });
    }
    
    /**
     * Override processMeshUpdates to handle both chunk types
     */
    processMeshUpdates() {
        const maxUpdatesPerFrame = 10;
        let processed = 0;
        
        console.log(`Processing mesh updates, queue length: ${this.meshUpdateQueue.length}`);
        
        // Process tile chunks first
        while (this.meshUpdateQueue.length > 0 && processed < maxUpdatesPerFrame) {
            const chunk = this.meshUpdateQueue[0];
            const chunkKey = `${chunk.chunkX},${chunk.chunkY},${chunk.chunkZ}`;
            
            console.log(`Checking chunk ${chunkKey}, is tile chunk: ${this.tileChunks.has(chunkKey)}`);
            
            // Check if it's a tile chunk
            if (this.tileChunks.has(chunkKey)) {
                this.meshUpdateQueue.shift();
                if (chunk.needsRebuild()) {
                    console.log(`Generating tile chunk mesh for ${chunkKey}`);
                    this.generateTileChunkMesh(chunk);
                }
                processed++;
            } else {
                break; // Let parent handle detail chunks
            }
        }
        
        // Let parent handle remaining detail chunks
        if (this.meshUpdateQueue.length > 0) {
            super.processMeshUpdates();
        }
    }
    
    /**
     * Override mesh generation to handle both resolutions
     */
    generateChunkMesh(chunk) {
        // Check if this is a tile chunk or detail chunk
        const chunkKey = `${chunk.chunkX},${chunk.chunkY},${chunk.chunkZ}`;
        if (this.tileChunks.has(chunkKey)) {
            // Generate mesh for 25cm voxels
            return this.generateTileChunkMesh(chunk);
        } else {
            // Use parent's mesh generation for 5cm voxels
            return super.generateChunkMesh(chunk);
        }
    }
    
    /**
     * Update chunk neighbors for tile chunks
     */
    updateTileChunkNeighbors(chunk) {
        const directions = [
            { key: 'px', offset: [1, 0, 0] },
            { key: 'nx', offset: [-1, 0, 0] },
            { key: 'py', offset: [0, 1, 0] },
            { key: 'ny', offset: [0, -1, 0] },
            { key: 'pz', offset: [0, 0, 1] },
            { key: 'nz', offset: [0, 0, -1] }
        ];
        
        for (const dir of directions) {
            const neighborKey = `${chunk.chunkX + dir.offset[0]},${chunk.chunkY + dir.offset[1]},${chunk.chunkZ + dir.offset[2]}`;
            const neighbor = this.tileChunks.get(neighborKey);
            
            if (neighbor) {
                chunk.setNeighbor(dir.key, neighbor);
            }
        }
    }
    
    /**
     * Generate mesh for tile chunks (25cm resolution)
     */
    generateTileChunkMesh(chunk) {
        console.log('Generating tile chunk mesh for chunk:', chunk.chunkX, chunk.chunkY, chunk.chunkZ);
        
        // Similar to parent but optimized for larger voxels
        if (chunk.mesh) {
            this.scene.remove(chunk.mesh);
            if (chunk.geometry) {
                chunk.geometry.dispose();
            }
        }
        
        // Generate mesh with 25cm voxel scale for tile chunks
        const geometry = this.mesher.generateMesh(chunk, this.TILE_VOXEL_SIZE);
        
        if (geometry) {
            console.log('Geometry generated, vertex count:', geometry.attributes.position.count);
            
            chunk.geometry = geometry;
            chunk.mesh = new THREE.Mesh(geometry, this.voxelMaterial);
            
            // Position in world space - each voxel represents 25cm
            const worldPos = new THREE.Vector3(
                chunk.chunkX * this.chunkSize * this.TILE_VOXEL_SIZE,
                chunk.chunkY * this.chunkSize * this.TILE_VOXEL_SIZE,
                chunk.chunkZ * this.chunkSize * this.TILE_VOXEL_SIZE
            );
            chunk.mesh.position.copy(worldPos);
            
            console.log('Chunk mesh position:', worldPos);
            console.log('Chunk mesh material:', this.voxelMaterial);
            
            // No need to scale since we're generating at the correct size
            // chunk.mesh.scale.set(1, 1, 1);
            
            this.scene.add(chunk.mesh);
            chunk.markClean();
            
            console.log('Tile chunk mesh added to scene');
        } else {
            console.warn('No geometry generated for tile chunk');
        }
    }
    
    /**
     * Get tile at world position
     */
    getTileAt(worldX, worldZ) {
        const key = `${Math.floor(worldX)},${Math.floor(worldZ)}`;
        return this.tileInstances.get(key);
    }
    
    /**
     * Remove tile
     */
    removeTile(worldX, worldZ) {
        const key = `${Math.floor(worldX)},${Math.floor(worldZ)}`;
        const tileInstance = this.tileInstances.get(key);
        
        if (!tileInstance) return false;
        
        const template = this.tileTemplates.get(tileInstance.type);
        if (!template) return false;
        
        if (tileInstance.isVoxelized) {
            // Remove detail voxels
            const scale = Math.round(this.TILE_VOXEL_SIZE / this.DETAIL_VOXEL_SIZE);
            const halfWidth = template.bounds.width / 2;
            const halfDepth = template.bounds.depth / 2;
            const voxelX = Math.floor((worldX - halfWidth * this.TILE_VOXEL_SIZE) / this.TILE_VOXEL_SIZE);
            const voxelZ = Math.floor((worldZ - halfDepth * this.TILE_VOXEL_SIZE) / this.TILE_VOXEL_SIZE);
            
            template.voxelData.forEach(voxel => {
                if (!voxel.filled) return;
                
                for (let dy = 0; dy < scale; dy++) {
                    for (let dx = 0; dx < scale; dx++) {
                        for (let dz = 0; dz < scale; dz++) {
                            const detailX = (voxelX + voxel.x) * scale + dx;
                            const detailY = voxel.y * scale + dy;
                            const detailZ = (voxelZ + voxel.z) * scale + dz;
                            
                            this.setVoxel(detailX, detailY, detailZ, 0);
                        }
                    }
                }
            });
        } else {
            // Remove tile voxels
            this.removeTileVoxels(worldX, worldZ, template);
        }
        
        this.tileInstances.delete(key);
        return true;
    }
    
    /**
     * Get statistics including hybrid system info
     */
    getStats() {
        const parentStats = super.getStats();
        
        return {
            ...parentStats,
            tileChunks: this.tileChunks.size,
            tileInstances: this.tileInstances.size,
            tileTemplates: this.tileTemplates.size,
            voxelizedTiles: Array.from(this.tileInstances.values())
                .filter(t => t.isVoxelized).length
        };
    }
}