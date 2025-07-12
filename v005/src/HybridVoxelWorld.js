/**
 * HybridVoxelWorld.js - Unified Voxel-Tile System
 * 
 * Combines the efficiency of tile-based placement with the flexibility of voxel editing.
 * Uses template-based storage for tiles until they need to be edited as voxels.
 */

import { VoxelWorld } from './VoxelWorld.js';
import { VoxelChunk } from './VoxelChunk.js';
import { VoxelEdgeGeometry } from './VoxelEdgeGeometry.js';
import { LSystem } from './LSystem.js';
import * as THREE from 'three';

export class HybridVoxelWorld extends VoxelWorld {
    constructor(scene, camera, renderer) {
        super(scene, camera, renderer);
        
        // Hybrid system configuration
        this.TILE_VOXEL_SIZE = 0.06; // 6cm voxels for tiles
        this.DETAIL_VOXEL_SIZE = 0.05; // 5cm voxels for detailed editing
        this.VOXELS_PER_TILE = Math.round(1.0 / this.TILE_VOXEL_SIZE); // ~17 voxels per meter
        
        // Tile template storage
        this.tileTemplates = new Map(); // tileTypeId -> voxel template data
        this.tileInstances = new Map(); // "x,z" -> { type, rotation, isVoxelized }
        
        // Chunk management for different resolutions
        this.tileChunks = new Map(); // 25cm voxel chunks
        this.detailChunks = new Map(); // 5cm voxel chunks (inherited as this.chunks)
        
        // Performance optimization
        this.surfaceCache = new Map(); // Cache detected surfaces for optimization
        
        // L-system for tree generation
        this.lSystem = new LSystem();
        
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
            rotatable: tileType.rotatable,
            randomHeight: tileType.randomHeight || null
        };
        
        // For tiles with random height, we'll generate at placement time
        if (tileType.randomHeight) {
            // Store the base template info but don't generate voxels yet
            template.baseSize = { ...tileType.size };
            template.geometry = tileType.geometry;
            this.tileTemplates.set(tileType.id, template);
            return;
        }
        
        // Use larger voxel size for large objects to improve performance
        const maxDimension = Math.max(tileType.size.width, tileType.size.height, tileType.size.depth);
        let voxelSize = this.TILE_VOXEL_SIZE;
        
        // For objects larger than 2m, use 12cm voxels instead of 6cm
        if (maxDimension > 2.0) {
            voxelSize = 0.12;
            template.largeVoxelSize = voxelSize;
        }
        
        // Convert tile dimensions to voxel counts
        const voxelWidth = Math.ceil(tileType.size.width / voxelSize);
        const voxelHeight = Math.ceil(tileType.size.height / voxelSize);
        const voxelDepth = Math.ceil(tileType.size.depth / voxelSize);
        
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
     * Generate irregular cone voxel pattern (more natural tree shape)
     */
    generateIrregularConeVoxels(width, height, depth) {
        const voxels = [];
        const centerX = width / 2;
        const centerZ = depth / 2;
        const baseRadius = Math.min(width, depth) / 2;
        
        for (let y = 0; y < height; y++) {
            const layerProgress = y / height;
            const layerRadius = baseRadius * (1 - layerProgress);
            
            // Add some randomness to the radius at each layer
            const radiusVariation = 0.2;
            const actualRadius = layerRadius * (1 + (Math.random() - 0.5) * radiusVariation);
            
            for (let x = 0; x < width; x++) {
                for (let z = 0; z < depth; z++) {
                    const dx = x - centerX + 0.5;
                    const dz = z - centerZ + 0.5;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    // Add some noise to the edge
                    const edgeNoise = Math.random() * 0.5;
                    
                    if (distance <= actualRadius + edgeNoise) {
                        voxels.push({ x, y, z, filled: true });
                    }
                }
            }
        }
        return voxels;
    }
    
    /**
     * Generate wide cone voxel pattern (bushy tree)
     */
    generateWideConeVoxels(width, height, depth) {
        const voxels = [];
        const centerX = width / 2;
        const centerZ = depth / 2;
        const baseRadius = Math.min(width, depth) / 2;
        
        for (let y = 0; y < height; y++) {
            const layerProgress = y / height;
            // Use a curved profile instead of linear for a bushier look
            const layerRadius = baseRadius * (1 - layerProgress * layerProgress * 0.8);
            
            for (let x = 0; x < width; x++) {
                for (let z = 0; z < depth; z++) {
                    const dx = x - centerX + 0.5;
                    const dz = z - centerZ + 0.5;
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
     * Generate tree with trunk
     */
    generateTreeWithTrunk(width, height, depth, trunkHeight, foliageType) {
        const voxels = [];
        const centerX = width / 2;
        const centerZ = depth / 2;
        
        // Generate trunk (cylinder)
        const trunkRadius = Math.max(1, Math.min(width, depth) / 6); // Trunk is 1/6 of tree width
        for (let y = 0; y < trunkHeight; y++) {
            for (let x = 0; x < width; x++) {
                for (let z = 0; z < depth; z++) {
                    const dx = x - centerX + 0.5;
                    const dz = z - centerZ + 0.5;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distance <= trunkRadius) {
                        voxels.push({ x, y, z, filled: true, isTrunk: true });
                    }
                }
            }
        }
        
        // Generate foliage starting from trunk height
        const foliageHeight = height - trunkHeight;
        let foliageVoxels;
        
        switch (foliageType) {
            case 'irregular':
                foliageVoxels = this.generateIrregularConeVoxels(width, foliageHeight, depth);
                break;
            case 'wide':
                foliageVoxels = this.generateWideConeVoxels(width, foliageHeight, depth);
                break;
            default:
                foliageVoxels = this.generateConeVoxels(width, foliageHeight, depth);
        }
        
        // Offset foliage voxels to start at trunk height
        foliageVoxels.forEach(voxel => {
            voxels.push({
                x: voxel.x,
                y: voxel.y + trunkHeight,
                z: voxel.z,
                filled: true,
                isTrunk: false
            });
        });
        
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
        let template = this.tileTemplates.get(tileTypeId);
        if (!template) {
            console.warn(`No template found for tile type: ${tileTypeId}`);
            return false;
        }
        
        // Handle random height tiles (like trees)
        if (template.randomHeight) {
            // Generate a new template with random height
            const minHeight = template.randomHeight.min;
            const maxHeight = template.randomHeight.max;
            const randomHeight = minHeight + Math.random() * (maxHeight - minHeight);
            
            // Create a temporary template with the random height
            template = this.generateRandomHeightTemplate(template, randomHeight);
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
        const voxelSize = template.largeVoxelSize || this.TILE_VOXEL_SIZE;
        const halfWidth = template.bounds.width / 2;
        const halfDepth = template.bounds.depth / 2;
        
        // Calculate the bottom-left voxel position
        const voxelX = Math.floor((worldX - halfWidth * voxelSize) / voxelSize);
        const voxelZ = Math.floor((worldZ - halfDepth * voxelSize) / voxelSize);
        
        // Place template voxels with the correct voxel size
        this.placeTemplateVoxels(template, voxelX, 0, voxelZ, rotation, voxelSize);
        
        return true;
    }
    
    /**
     * Generate a template with random height
     */
    generateRandomHeightTemplate(baseTemplate, height) {
        // Use 12cm voxels for trees to improve performance
        const voxelSize = 0.12;
        
        // Generate random color variation for tree foliage
        const baseColor = baseTemplate.color.clone();
        const colorVariation = 0.2; // 20% variation
        const hsl = {};
        baseColor.getHSL(hsl);
        
        // Vary the hue slightly (more yellow or more blue)
        hsl.h += (Math.random() - 0.5) * 0.05; // ±5% hue shift
        // Vary the saturation (more or less vibrant)
        hsl.s *= 1 + (Math.random() - 0.5) * colorVariation;
        // Vary the lightness (darker or lighter)
        hsl.l *= 1 + (Math.random() - 0.5) * colorVariation;
        
        // Clamp values
        hsl.s = Math.max(0, Math.min(1, hsl.s));
        hsl.l = Math.max(0.2, Math.min(0.8, hsl.l));
        
        const foliageColor = new THREE.Color();
        foliageColor.setHSL(hsl.h, hsl.s, hsl.l);
        
        // Generate random trunk color (browns)
        const baseBrown = new THREE.Color(0x8B4513); // Saddle brown
        const brownHsl = {};
        baseBrown.getHSL(brownHsl);
        
        // Vary brown color
        brownHsl.h += (Math.random() - 0.5) * 0.02; // Slight hue variation
        brownHsl.s *= 1 + (Math.random() - 0.5) * 0.3; // More saturation variation
        brownHsl.l *= 1 + (Math.random() - 0.5) * 0.4; // Significant lightness variation (light to dark wood)
        
        // Clamp brown values
        brownHsl.s = Math.max(0, Math.min(1, brownHsl.s));
        brownHsl.l = Math.max(0.15, Math.min(0.6, brownHsl.l));
        
        const trunkColor = new THREE.Color();
        trunkColor.setHSL(brownHsl.h, brownHsl.s, brownHsl.l);
        
        const template = {
            ...baseTemplate,
            voxelData: [],
            bounds: { width: 0, height: 0, depth: 0 },
            largeVoxelSize: voxelSize,
            color: foliageColor,
            trunkColor: trunkColor
        };
        
        // Calculate voxel dimensions with new height
        const voxelWidth = Math.ceil(baseTemplate.baseSize.width / voxelSize);
        const voxelHeight = Math.ceil(height / voxelSize);
        const voxelDepth = Math.ceil(baseTemplate.baseSize.depth / voxelSize);
        
        // Random trunk height (15-30% of tree height)
        const trunkHeightRatio = 0.15 + Math.random() * 0.15;
        const trunkHeight = Math.ceil(voxelHeight * trunkHeightRatio);
        
        template.bounds = { 
            width: voxelWidth, 
            height: voxelHeight, 
            depth: voxelDepth 
        };
        
        // Generate voxels based on geometry type with random variations
        switch (baseTemplate.geometry) {
            case 'cone':
                // Add shape variations for trees
                const shapeVariant = Math.random();
                if (shapeVariant < 0.3) {
                    // 30% chance of irregular cone (natural tree)
                    template.voxelData = this.generateTreeWithTrunk(voxelWidth, voxelHeight, voxelDepth, trunkHeight, 'irregular');
                } else if (shapeVariant < 0.5) {
                    // 20% chance of wider cone (bushy tree)
                    template.voxelData = this.generateTreeWithTrunk(voxelWidth, voxelHeight, voxelDepth, trunkHeight, 'wide');
                } else {
                    // 50% chance of normal cone
                    template.voxelData = this.generateTreeWithTrunk(voxelWidth, voxelHeight, voxelDepth, trunkHeight, 'normal');
                }
                break;
            case 'cylinder':
                template.voxelData = this.generateCylinderVoxels(voxelWidth, voxelHeight, voxelDepth);
                break;
            default:
                template.voxelData = this.generateBoxVoxels(voxelWidth, voxelHeight, voxelDepth);
        }
        
        return template;
    }
    
    /**
     * Place template voxels into the world
     */
    placeTemplateVoxels(template, baseX, baseY, baseZ, rotation, voxelSize = this.TILE_VOXEL_SIZE) {
        const foliageColor = template.color;
        const trunkColor = template.trunkColor || new THREE.Color(0x8B4513); // Default brown if not set
        
        if (!template.voxelData || template.voxelData.length === 0) {
            console.error('Template has no voxel data!');
            return;
        }
        
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
            
            // Determine color based on voxel type
            const voxelColor = voxel.isTrunk ? trunkColor : foliageColor;
            
            // Place in tile chunk
            // If this template uses a different voxel size, we need to convert coordinates
            if (voxelSize !== this.TILE_VOXEL_SIZE) {
                // Convert from template voxel coordinates to world coordinates, then to tile voxel coordinates
                const worldPosX = (baseX * voxelSize + Math.floor(x) * voxelSize) / this.TILE_VOXEL_SIZE;
                const worldPosY = (baseY * voxelSize + voxel.y * voxelSize) / this.TILE_VOXEL_SIZE;
                const worldPosZ = (baseZ * voxelSize + Math.floor(z) * voxelSize) / this.TILE_VOXEL_SIZE;
                
                // Place multiple smaller voxels to fill the larger voxel space
                const scale = Math.round(voxelSize / this.TILE_VOXEL_SIZE);
                for (let dx = 0; dx < scale; dx++) {
                    for (let dy = 0; dy < scale; dy++) {
                        for (let dz = 0; dz < scale; dz++) {
                            this.setTileVoxel(
                                Math.floor(worldPosX) + dx,
                                Math.floor(worldPosY) + dy,
                                Math.floor(worldPosZ) + dz,
                                1, voxelColor
                            );
                        }
                    }
                }
            } else {
                // Standard placement for matching voxel sizes
                const worldX = baseX + Math.floor(x);
                const worldY = baseY + voxel.y;
                const worldZ = baseZ + Math.floor(z);
                
                this.setTileVoxel(worldX, worldY, worldZ, 1, voxelColor);
            }
            placedCount++;
        });
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
        const maxUpdatesPerFrame = 2; // Reduced for smoother interaction
        let processed = 0;
        
        // console.log(`Processing mesh updates, queue length: ${this.meshUpdateQueue.length}`);
        
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
            
            this.scene.add(chunk.mesh);
            chunk.markClean();
            
            console.log('Tile chunk mesh and edges added to scene');
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