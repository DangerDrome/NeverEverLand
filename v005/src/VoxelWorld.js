/**
 * VoxelWorld.js - Main Voxel System Integration
 * 
 * Integrates the voxel system with the existing tile system and provides
 * a unified interface for 3D world management.
 */

import * as THREE from 'three';
import { VoxelChunk } from './VoxelChunk.js';
import { VoxelMesher } from './VoxelMesher.js';
import { VoxelEditingSystem } from './VoxelEditingSystem.js';
import { VoxelLODSystem } from './VoxelLODSystem.js';

export class VoxelWorld {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Core components
        this.chunks = new Map(); // chunkKey -> VoxelChunk
        this.mesher = new VoxelMesher();
        this.editingSystem = new VoxelEditingSystem(this, camera, renderer);
        this.lodSystem = new VoxelLODSystem(this, camera);
        
        // Configuration
        this.chunkSize = VoxelChunk.CHUNK_SIZE;
        this.worldHeight = 256; // Max world height
        this.seaLevel = 64;
        
        // Materials
        this.voxelMaterial = null;
        
        // Integration with tile system
        this.tileMapSystem = null;
        this.isVoxelMode = false;
        
        // Performance monitoring
        this.lastFrameTime = 0;
        this.meshUpdateQueue = [];
        
        // Edge rendering settings
        this.edgeSettings = {
            enabled: true,
            width: 0.03,
            darkness: 0.4
        };
        
        this.init();
    }
    
    init() {
        this.createMaterial();
        this.setupEventListeners();
        
        // Show voxel panel immediately since StyleUI should be loaded by now
        this.showVoxelUI();
    }
    
    /**
     * Create voxel material
     */
    createMaterial() {
        this.voxelMaterial = this.mesher.createMaterial();
        
        // Update material with scene lighting if available
        if (this.scene) {
            this.updateMaterialLighting();
        }
    }
    
    /**
     * Update material lighting from scene
     */
    updateMaterialLighting() {
        if (!this.voxelMaterial || !this.voxelMaterial.updateLighting) return;
        
        let ambientIntensity = 0.4;
        let directionalLight = null;
        
        // Find lights in scene
        this.scene.traverse((child) => {
            if (child.isAmbientLight) {
                ambientIntensity = child.intensity;
            } else if (child.isDirectionalLight && !directionalLight) {
                directionalLight = child;
            }
        });
        
        this.voxelMaterial.updateLighting(ambientIntensity, directionalLight);
    }
    
    /**
     * Update edge rendering settings
     */
    setEdgeSettings(settings) {
        Object.assign(this.edgeSettings, settings);
        
        // Update material if it's our custom edge material
        if (this.voxelMaterial && this.voxelMaterial.setEdgeWidth) {
            if (settings.width !== undefined) {
                this.voxelMaterial.setEdgeWidth(settings.width);
            }
            if (settings.darkness !== undefined) {
                this.voxelMaterial.setEdgeDarkness(settings.darkness);
            }
        }
    }
    
    /**
     * Setup event listeners for integration
     */
    setupEventListeners() {
        // Listen for tile system mode changes
        document.addEventListener('modeChange', (event) => {
            if (event.detail.mode === 'voxel') {
                this.enableVoxelMode();
            } else if (event.detail.mode === 'tile') {
                this.disableVoxelMode();
            }
        });
        
        // Listen for voxel editing state changes
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyV' && event.ctrlKey) {
                this.toggleVoxelMode();
            }
        });
    }
    
    /**
     * Enable voxel editing mode
     */
    enableVoxelMode() {
        this.isVoxelMode = true;
        this.editingSystem.setEditing(true);
        
        // Disable tile editing if connected
        if (this.tileMapSystem) {
            this.tileMapSystem.setEditMode(false);
        }
        
        // Show voxel UI
        this.showVoxelUI();
        
        // Generate some test terrain if no chunks exist
        if (this.chunks.size === 0) {
            // Delay terrain generation to ensure everything is initialized
            setTimeout(() => {
                this.generateTestWorld();
            }, 100);
        }
    }
    
    /**
     * Disable voxel editing mode
     */
    disableVoxelMode() {
        this.isVoxelMode = false;
        this.editingSystem.setEditing(false);
        
        // Hide voxel UI
        this.hideVoxelUI();
    }
    
    /**
     * Toggle between voxel and tile modes
     */
    toggleVoxelMode() {
        if (this.isVoxelMode) {
            this.disableVoxelMode();
        } else {
            this.enableVoxelMode();
        }
    }
    
    /**
     * Set tile map system for integration
     */
    setTileMapSystem(tileMapSystem) {
        this.tileMapSystem = tileMapSystem;
    }
    
    /**
     * Get or create chunk at position
     */
    getOrCreateChunk(chunkX, chunkY, chunkZ) {
        const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
        
        if (!this.chunks.has(chunkKey)) {
            const chunk = new VoxelChunk(chunkX, chunkY, chunkZ);
            this.chunks.set(chunkKey, chunk);
            
            // Set up neighbors
            this.updateChunkNeighbors(chunk);
        }
        
        return this.chunks.get(chunkKey);
    }
    
    /**
     * Update chunk neighbor references
     */
    updateChunkNeighbors(chunk) {
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
            const neighbor = this.chunks.get(neighborKey);
            
            if (neighbor) {
                chunk.setNeighbor(dir.key, neighbor);
            }
        }
    }
    
    /**
     * Get voxel at world coordinates
     */
    getVoxel(worldX, worldY, worldZ) {
        const chunkX = Math.floor(worldX / this.chunkSize);
        const chunkY = Math.floor(worldY / this.chunkSize);
        const chunkZ = Math.floor(worldZ / this.chunkSize);
        
        const localX = worldX - chunkX * this.chunkSize;
        const localY = worldY - chunkY * this.chunkSize;
        const localZ = worldZ - chunkZ * this.chunkSize;
        
        const chunk = this.getOrCreateChunk(chunkX, chunkY, chunkZ);
        return chunk.getVoxel(localX, localY, localZ);
    }
    
    /**
     * Set voxel at world coordinates
     */
    setVoxel(worldX, worldY, worldZ, voxelType) {
        const chunkX = Math.floor(worldX / this.chunkSize);
        const chunkY = Math.floor(worldY / this.chunkSize);
        const chunkZ = Math.floor(worldZ / this.chunkSize);
        
        const localX = worldX - chunkX * this.chunkSize;
        const localY = worldY - chunkY * this.chunkSize;
        const localZ = worldZ - chunkZ * this.chunkSize;
        
        const chunk = this.getOrCreateChunk(chunkX, chunkY, chunkZ);
        const changed = chunk.setVoxel(localX, localY, localZ, voxelType);
        
        if (changed) {
            this.queueChunkMeshUpdate(chunk);
        }
        
        return changed;
    }
    
    /**
     * Queue chunk for mesh regeneration
     */
    queueChunkMeshUpdate(chunk) {
        if (!this.meshUpdateQueue.includes(chunk)) {
            this.meshUpdateQueue.push(chunk);
        }
    }
    
    /**
     * Generate mesh for a chunk
     */
    generateChunkMesh(chunk) {
        // Remove old mesh
        if (chunk.mesh) {
            this.scene.remove(chunk.mesh);
            if (chunk.geometry) {
                chunk.geometry.dispose();
            }
        }
        
        // Generate new geometry
        const geometry = this.mesher.generateMesh(chunk);
        
        if (geometry) {
            // Create mesh
            chunk.geometry = geometry;
            chunk.mesh = new THREE.Mesh(geometry, this.voxelMaterial);
            
            // Position mesh in world
            chunk.mesh.position.set(
                chunk.chunkX * this.chunkSize,
                chunk.chunkY * this.chunkSize,
                chunk.chunkZ * this.chunkSize
            );
            
            // Add to scene
            this.scene.add(chunk.mesh);
            
            // Mark as clean
            chunk.markClean();
        }
    }
    
    /**
     * Update voxel world
     */
    update(deltaTime) {
        // Update LOD system
        this.lodSystem.update(deltaTime);
        
        // Process mesh updates
        this.processMeshUpdates();
        
        // Update editing system
        if (this.isVoxelMode) {
            // Editing system updates are handled by its own event listeners
        }
    }
    
    /**
     * Process queued mesh updates
     */
    processMeshUpdates() {
        const maxUpdatesPerFrame = 10; // Increased for 1cm voxel handling
        let processed = 0;
        
        while (this.meshUpdateQueue.length > 0 && processed < maxUpdatesPerFrame) {
            const chunk = this.meshUpdateQueue.shift();
            
            if (chunk.needsRebuild()) {
                this.generateChunkMesh(chunk);
            }
            
            processed++;
        }
    }
    
    /**
     * Generate test world
     */
    generateTestWorld() {
        // Clear existing terrain first
        this.clearWorld();
        
        // Check if we have the GLTF model available
        if (window.gameEngine && window.gameEngine.model) {
            this.voxelizeModel(window.gameEngine.model);
        } else {
            // Fallback to simple test voxel
            this.generateSimpleTestVoxel();
        }
    }
    
    /**
     * Generate simple test voxel (fallback)
     */
    generateSimpleTestVoxel() {
        // Generate chunks around origin to ensure all neighbors exist for the test voxel
        // Create a 3x3x3 grid of chunks centered on origin
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const chunk = this.getOrCreateChunk(x, y, z);
                    
                    // Only put the test voxel in the center chunk (0,0,0) at position (0,0,0)
                    if (x === 0 && y === 0 && z === 0) {
                        chunk.generateTestTerrain();
                    }
                    // Leave other chunks empty but create them so neighbors exist
                    
                    this.queueChunkMeshUpdate(chunk);
                }
            }
        }
    }
    
    /**
     * Convert GLTF model to voxels using improved ray casting method
     */
    async voxelizeModel(model) {
        console.log('Starting voxelization...');
        
        // Clear existing world first
        this.clearWorld();
        
        // Stop model rotation
        if (window.gameEngine && window.gameEngine.model) {
            window.gameEngine.stopModelRotation = true;
        }
        
        // Update progress in voxel palette
        if (this.voxelPalette) {
            this.voxelPalette.updateProgress(0, 'Initializing...');
        }
        
        // Get model bounding box
        const boundingBox = new THREE.Box3().setFromObject(model);
        const size = boundingBox.getSize(new THREE.Vector3());
        const center = boundingBox.getCenter(new THREE.Vector3());
        
        // Voxel resolution
        const voxelSize = 0.05; // 5cm voxels
        
        // Create raycaster
        const raycaster = new THREE.Raycaster();
        
        // Add small padding to bounding box to catch edge cases
        const padding = voxelSize * 0.5;
        boundingBox.min.subScalar(padding);
        boundingBox.max.addScalar(padding);
        
        // Calculate total iterations for progress
        const totalX = Math.ceil((boundingBox.max.x - boundingBox.min.x) / voxelSize);
        const totalY = Math.ceil((boundingBox.max.y - boundingBox.min.y) / voxelSize);
        const totalZ = Math.ceil((boundingBox.max.z - boundingBox.min.z) / voxelSize);
        const totalIterations = totalX * totalY * totalZ;
        let currentIteration = 0;
        
        console.log(`Total voxels to process: ${totalIterations} (${totalX} x ${totalY} x ${totalZ})`);
        console.log(`Bounding box:`, boundingBox.min, 'to', boundingBox.max);
        
        // Simple iteration approach
        const voxelPositions = [];
        for (let x = boundingBox.min.x; x < boundingBox.max.x; x += voxelSize) {
            for (let y = boundingBox.min.y; y < boundingBox.max.y; y += voxelSize) {
                for (let z = boundingBox.min.z; z < boundingBox.max.z; z += voxelSize) {
                    voxelPositions.push([x, y, z]);
                }
            }
        }
        
        console.log(`Generated ${voxelPositions.length} voxel positions`);
        
        // Update progress bar to show we're starting
        if (this.voxelPalette) {
            this.voxelPalette.updateProgress(1, 'Starting...');
        }
        
        // Process voxels in batches
        let processedCount = 0;
        const batchSize = 1000; // Process 1000 voxels per frame
        
        const processBatch = async () => {
            const startTime = Date.now();
            let batchCount = 0;
            
            while (processedCount < voxelPositions.length && batchCount < batchSize) {
                const [x, y, z] = voxelPositions[processedCount];
                const pos = new THREE.Vector3(
                    x + voxelSize * 0.5,
                    y + voxelSize * 0.5,
                    z + voxelSize * 0.5
                );
                
                // Check if point is inside mesh using ray casting
                if (this.isInsideMesh(pos, model, raycaster)) {
                    // Convert world position to voxel grid indices
                    const voxelX = Math.floor((pos.x - boundingBox.min.x) / voxelSize);
                    const voxelY = Math.floor((pos.y - boundingBox.min.y) / voxelSize);
                    const voxelZ = Math.floor((pos.z - boundingBox.min.z) / voxelSize);
                    
                    // Convert to chunk coordinates
                    const chunkX = Math.floor(voxelX / 32);
                    const chunkY = Math.floor(voxelY / 32);
                    const chunkZ = Math.floor(voxelZ / 32);
                    
                    const localX = voxelX % 32;
                    const localY = voxelY % 32;
                    const localZ = voxelZ % 32;
                    
                    // Create chunk if needed
                    const chunk = this.getOrCreateChunk(chunkX, chunkY, chunkZ);
                    
                    // Get color from nearest mesh point
                    const color = this.getColorAtPosition(pos, model, raycaster);
                    chunk.setVoxelWithColor(localX, localY, localZ, 1, color);
                }
                
                processedCount++;
                batchCount++;
                
                // Update progress every 100 voxels
                if (processedCount % 100 === 0) {
                    const progress = (processedCount / voxelPositions.length) * 100;
                    console.log(`Voxelization progress: ${Math.floor(progress)}%`);
                    
                    if (this.voxelPalette) {
                        this.voxelPalette.updateProgress(progress);
                    }
                }
            }
            
            // If not done, schedule next batch
            if (processedCount < voxelPositions.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
                return processBatch();
            }
        };
        
        // Start processing
        await processBatch();
        
        // Final progress update
        if (this.voxelPalette) {
            this.voxelPalette.updateProgress(100, 'Complete!');
        }
        
        // Queue all chunks for mesh updates
        console.log(`Queuing ${this.chunks.size} chunks for mesh updates`);
        for (const chunk of this.chunks.values()) {
            if (!chunk.isEmpty) {
                this.queueChunkMeshUpdate(chunk);
            }
        }
        
        // Reset progress after a short delay
        setTimeout(() => {
            if (this.voxelPalette) {
                this.voxelPalette.resetProgress();
            }
        }, 2000);
        
        console.log('Voxelization complete!');
        
        // Resume model rotation
        if (window.gameEngine && window.gameEngine.model) {
            window.gameEngine.stopModelRotation = false;
        }
    }
    
    /**
     * Check if a point is inside a mesh using ray casting
     */
    isInsideMesh(position, mesh, raycaster) {
        // Cast ray downward from the point
        const direction = new THREE.Vector3(0, -1, 0);
        raycaster.set(position, direction);
        
        const intersects = raycaster.intersectObject(mesh, true);
        
        // If odd number of intersections, point is inside
        return intersects.length % 2 === 1;
    }
    
    /**
     * Get color at a specific position by finding nearest mesh surface
     */
    getColorAtPosition(position, mesh, raycaster) {
        // Cast rays in multiple directions to find nearest surface
        const directions = [
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1)
        ];
        
        let closestIntersection = null;
        let minDistance = Infinity;
        
        for (const dir of directions) {
            raycaster.set(position, dir);
            const intersects = raycaster.intersectObject(mesh, true);
            
            if (intersects.length > 0 && intersects[0].distance < minDistance) {
                minDistance = intersects[0].distance;
                closestIntersection = intersects[0];
            }
        }
        
        if (closestIntersection && closestIntersection.object.material) {
            return this.getMaterialColor(closestIntersection.object.material);
        }
        
        return new THREE.Color(0x7CB342); // Default green
    }
    
    /**
     * Get voxel type based on material color from intersection
     */
    getVoxelTypeFromIntersection(intersection) {
        // For voxelization, we'll use a generic voxel type and store the actual color
        return 1; // Use type 1 but override with actual color
    }
    
    /**
     * Get actual color from intersection
     */
    getColorFromIntersection(intersection) {
        const material = intersection.object.material;
        
        // Since all materials have white base color (ffffff) and use textures,
        // we'll map colors based on material names instead
        if (material && material.name) {
            return this.getMaterialColor(material);
        }
        
        return new THREE.Color(0x7CB342); // Default green fallback
    }
    
    /**
     * Get color based on material properties
     */
    getMaterialColor(material) {
        // Map specific Link material names to appropriate colors based on GLTF analysis
        const name = (material.name || '').toLowerCase();
        
        // Link character specific materials from scene.gltf
        if (name === 'bodya') {
            return new THREE.Color(0x2E7D32); // Darker forest green for tunic
        } else if (name === 'bodyb') {
            return new THREE.Color(0x5D4037); // Dark brown for hair/boots  
        } else if (name === 'bodyc') {
            return new THREE.Color(0xFFCC9C); // Light peach for skin
        } else if (name === 'face') {
            return new THREE.Color(0xFFCC9C); // Light peach for face/skin
        } else if (name === 'hair') {
            return new THREE.Color(0xFFC107); // Golden blonde hair
        } else if (name === 'courage') {
            return new THREE.Color(0xFFD700); // Gold for triforce/courage symbol
        } else if (name === 'fitlink_blade') {
            return new THREE.Color(0xE0E0E0); // Bright silver for sword blade
        } else if (name === 'fitlink_sheath') {
            return new THREE.Color(0x3E2723); // Very dark brown for scabbard
        } else if (name === 'fitlink_grip') {
            return new THREE.Color(0x795548); // Medium brown for sword grip
        } else if (name === 'fitlink_eyel') {
            return new THREE.Color(0x2196F3); // Bright blue for left eye
        } else if (name === 'fitlink_eyer') {
            return new THREE.Color(0x2196F3); // Bright blue for right eye
        } else if (name === 'shield') {
            return new THREE.Color(0x1976D2); // Deep blue for shield
        }
        // Fallback: generate unique color based on material name hash
        const hash = this.hashString(material.name || 'default');
        return new THREE.Color().setHSL((hash % 360) / 360, 0.7, 0.5);
    }
    
    /**
     * Simple string hash function
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
    
    /**
     * Sample color from texture at UV coordinates
     */
    sampleTextureColor(texture, uv) {
        if (!texture || !texture.image) {
            console.log('No texture image available, texture:', !!texture, 'image:', texture ? !!texture.image : false);
            return new THREE.Color(0xff0000); // Red to indicate failed sampling
        }
        
        try {
            console.log('Texture image size:', texture.image.width, 'x', texture.image.height);
            console.log('UV coordinates:', uv.x, uv.y);
            
            // Create canvas to sample texture
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = texture.image.width;
            canvas.height = texture.image.height;
            
            // Check if image is loaded
            if (texture.image.complete && texture.image.naturalWidth > 0) {
                ctx.drawImage(texture.image, 0, 0);
                
                // Get pixel at UV coordinates (clamp to valid range)
                const x = Math.max(0, Math.min(texture.image.width - 1, Math.floor(uv.x * texture.image.width)));
                const y = Math.max(0, Math.min(texture.image.height - 1, Math.floor((1 - uv.y) * texture.image.height))); // Flip Y
                
                console.log('Sampling pixel at:', x, y);
                
                const imageData = ctx.getImageData(x, y, 1, 1);
                const pixel = imageData.data;
                
                const sampledColor = new THREE.Color(pixel[0] / 255, pixel[1] / 255, pixel[2] / 255);
                console.log('Raw pixel values:', pixel[0], pixel[1], pixel[2], pixel[3]);
                console.log('Sampled color:', sampledColor.getHexString());
                return sampledColor;
            } else {
                console.log('Image not fully loaded');
                return new THREE.Color(0xff00ff); // Magenta to indicate image not loaded
            }
        } catch (error) {
            console.log('Error sampling texture:', error);
            return new THREE.Color(0xffff00); // Yellow to indicate error
        }
    }
    
    /**
     * Convert color to voxel type for different materials
     */
    colorToVoxelType(color) {
        const hsl = {};
        color.getHSL(hsl);
        
        // Map colors to voxel types based on hue and lightness
        if (hsl.l < 0.3) {
            return 3; // Dark colors -> Stone
        } else if (hsl.h < 0.1 || hsl.h > 0.9) {
            return 2; // Red/pink -> Dirt  
        } else if (hsl.h >= 0.1 && hsl.h < 0.4) {
            return 1; // Green/yellow -> Grass
        } else if (hsl.h >= 0.4 && hsl.h < 0.7) {
            return 4; // Blue/cyan -> Wood
        } else {
            return 5; // Purple/magenta -> Leaves
        }
    }
    
    /**
     * Convert tile coordinates to voxel coordinates
     */
    tileToVoxel(tileX, tileZ, height = 0) {
        return {
            x: tileX,
            y: height,
            z: tileZ
        };
    }
    
    /**
     * Convert voxel coordinates to tile coordinates
     */
    voxelToTile(voxelX, voxelY, voxelZ) {
        return {
            x: voxelX,
            z: voxelZ,
            height: voxelY
        };
    }
    
    /**
     * Import 2D tile map as 3D voxels
     */
    importFromTileMap(tileMap) {
        if (!tileMap || !this.tileMapSystem) return;
        
        for (const [key, tileData] of tileMap.entries()) {
            const [x, z] = key.split(',').map(Number);
            const voxelPos = this.tileToVoxel(x, z, 0);
            
            // Convert tile type to voxel type
            const voxelType = this.tileTypeToVoxelType(tileData.type);
            
            // Place voxel
            this.setVoxel(voxelPos.x, voxelPos.y, voxelPos.z, voxelType);
            
            // Add height variation for certain tile types
            if (tileData.type === 'wall') {
                for (let y = 1; y < 3; y++) {
                    this.setVoxel(voxelPos.x, y, voxelPos.z, voxelType);
                }
            }
        }
    }
    
    /**
     * Convert tile type to voxel type
     */
    tileTypeToVoxelType(tileType) {
        const conversion = {
            'grass': 1,
            'stone': 3,
            'wall': 3,
            'tree': 4,
            'water': 0, // Handle water separately
            'foundation': 2
        };
        
        return conversion[tileType] || 1;
    }
    
    /**
     * Show voxel editing UI
     */
    showVoxelUI() {
        if (!this.voxelPalette) {
            // Import and create VoxelPalette dynamically
            import('./ui/VoxelPalette.js').then(({ VoxelPalette }) => {
                this.voxelPalette = new VoxelPalette(document.body, this);
            }).catch(error => {
                console.error('Failed to load VoxelPalette:', error);
            });
        } else {
            this.voxelPalette.setVisible(true);
            this.voxelPalette.updateState();
        }
    }
    
    /**
     * Hide voxel editing UI
     */
    hideVoxelUI() {
        if (this.voxelPalette) {
            this.voxelPalette.setVisible(false);
        }
    }
    
    
    /**
     * Get world statistics
     */
    getStats() {
        const lodStats = this.lodSystem.getStats();
        
        return {
            chunks: this.chunks.size,
            loadedChunks: lodStats.chunksLoaded,
            visibleChunks: lodStats.chunksVisible,
            triangles: lodStats.trianglesRendered,
            memoryUsage: lodStats.memoryUsed,
            meshUpdateQueue: this.meshUpdateQueue.length,
            voxelMode: this.isVoxelMode
        };
    }
    
    /**
     * Save world data
     */
    saveWorld() {
        const worldData = {
            chunks: {},
            settings: {
                chunkSize: this.chunkSize,
                worldHeight: this.worldHeight,
                seaLevel: this.seaLevel
            }
        };
        
        for (const [key, chunk] of this.chunks) {
            if (!chunk.isEmpty) {
                worldData.chunks[key] = chunk.serialize();
            }
        }
        
        return worldData;
    }
    
    /**
     * Load world data
     */
    loadWorld(worldData) {
        // Clear existing world
        this.clearWorld();
        
        // Load settings
        if (worldData.settings) {
            this.chunkSize = worldData.settings.chunkSize || this.chunkSize;
            this.worldHeight = worldData.settings.worldHeight || this.worldHeight;
            this.seaLevel = worldData.settings.seaLevel || this.seaLevel;
        }
        
        // Load chunks
        if (worldData.chunks) {
            for (const [key, chunkData] of Object.entries(worldData.chunks)) {
                const chunk = VoxelChunk.deserialize(chunkData);
                this.chunks.set(key, chunk);
                this.updateChunkNeighbors(chunk);
                this.queueChunkMeshUpdate(chunk);
            }
        }
    }
    
    /**
     * Clear all voxel data
     */
    clearWorld() {
        // Remove all meshes from scene
        for (const chunk of this.chunks.values()) {
            if (chunk.mesh) {
                this.scene.remove(chunk.mesh);
            }
            chunk.dispose();
        }
        
        this.chunks.clear();
        this.meshUpdateQueue = [];
    }
    
    /**
     * Dispose of voxel world
     */
    dispose() {
        this.clearWorld();
        this.lodSystem.dispose();
        this.editingSystem.dispose();
        
        if (this.voxelMaterial) {
            this.voxelMaterial.dispose();
        }
        
        this.hideVoxelUI();
    }
}