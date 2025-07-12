/**
 * VoxelLODSystem.js - Distance-based Level of Detail System for Voxels
 * 
 * Manages rendering quality based on distance from camera to optimize performance.
 * Implements multiple LOD levels with dynamic chunk loading/unloading.
 */

import * as THREE from 'three';

export class VoxelLODSystem {
    constructor(voxelWorld, camera) {
        this.voxelWorld = voxelWorld;
        this.camera = camera;
        
        // LOD configuration
        this.lodLevels = [
            { distance: 32, meshQuality: 'high', chunkDetail: 'full' },      // Level 0: Full detail
            { distance: 64, meshQuality: 'medium', chunkDetail: 'simplified' }, // Level 1: Reduced detail
            { distance: 128, meshQuality: 'low', chunkDetail: 'outline' },   // Level 2: Basic shapes
            { distance: 256, meshQuality: 'none', chunkDetail: 'unloaded' }  // Level 3: Unloaded
        ];
        
        // Chunk management
        this.loadedChunks = new Map(); // chunkKey -> chunk
        this.chunkLODLevels = new Map(); // chunkKey -> lodLevel
        this.chunkLoadQueue = [];
        this.chunkUnloadQueue = [];
        
        // Performance settings
        this.maxChunksPerFrame = 2;
        this.updateInterval = 100; // ms
        this.lastUpdate = 0;
        
        // Frustum culling
        this.frustum = new THREE.Frustum();
        this.cameraMatrix = new THREE.Matrix4();
        
        // Statistics
        this.stats = {
            chunksLoaded: 0,
            chunksVisible: 0,
            trianglesRendered: 0,
            memoryUsed: 0
        };
    }
    
    /**
     * Update LOD system
     */
    update(deltaTime) {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateInterval) {
            return;
        }
        
        this.lastUpdate = now;
        
        // Update frustum for culling
        this.updateFrustum();
        
        // Update chunk LOD levels
        this.updateChunkLODs();
        
        // Process loading/unloading queues
        this.processLoadQueue();
        this.processUnloadQueue();
        
        // Update statistics
        this.updateStats();
    }
    
    /**
     * Update camera frustum
     */
    updateFrustum() {
        this.cameraMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.cameraMatrix);
    }
    
    /**
     * Update LOD levels for all chunks
     */
    updateChunkLODs() {
        const cameraPos = this.camera.position;
        const visibleChunks = this.getVisibleChunkPositions();
        
        // Check existing chunks
        for (const [chunkKey, chunk] of this.loadedChunks) {
            const chunkPos = this.parseChunkKey(chunkKey);
            const distance = this.getChunkDistance(chunkPos, cameraPos);
            const newLOD = this.getLODLevel(distance);
            const currentLOD = this.chunkLODLevels.get(chunkKey) || -1;
            
            // Check if chunk is still visible
            if (!this.isChunkVisible(chunkPos)) {
                this.queueChunkUnload(chunkKey);
                continue;
            }
            
            // Update LOD if changed
            if (newLOD !== currentLOD) {
                this.updateChunkLOD(chunkKey, chunk, newLOD);
            }
        }
        
        // Queue new chunks for loading
        for (const chunkPos of visibleChunks) {
            const chunkKey = this.getChunkKey(chunkPos);
            if (!this.loadedChunks.has(chunkKey)) {
                const distance = this.getChunkDistance(chunkPos, cameraPos);
                const lodLevel = this.getLODLevel(distance);
                
                if (lodLevel < this.lodLevels.length - 1) { // Don't load unloaded level
                    this.queueChunkLoad(chunkPos, lodLevel);
                }
            }
        }
    }
    
    /**
     * Get visible chunk positions around camera
     */
    getVisibleChunkPositions() {
        const cameraPos = this.camera.position;
        const chunkSize = this.voxelWorld.chunkSize || 32;
        const renderDistance = this.lodLevels[this.lodLevels.length - 1].distance;
        
        const positions = [];
        const chunkRadius = Math.ceil(renderDistance / chunkSize);
        
        const centerChunkX = Math.floor(cameraPos.x / chunkSize);
        const centerChunkY = Math.floor(cameraPos.y / chunkSize);
        const centerChunkZ = Math.floor(cameraPos.z / chunkSize);
        
        for (let x = -chunkRadius; x <= chunkRadius; x++) {
            for (let y = -chunkRadius; y <= chunkRadius; y++) {
                for (let z = -chunkRadius; z <= chunkRadius; z++) {
                    const chunkPos = {
                        x: centerChunkX + x,
                        y: centerChunkY + y,
                        z: centerChunkZ + z
                    };
                    
                    if (this.isChunkVisible(chunkPos)) {
                        positions.push(chunkPos);
                    }
                }
            }
        }
        
        return positions;
    }
    
    /**
     * Check if chunk is visible in camera frustum
     */
    isChunkVisible(chunkPos) {
        const chunkSize = this.voxelWorld.chunkSize || 32;
        const worldPos = new THREE.Vector3(
            chunkPos.x * chunkSize + chunkSize / 2,
            chunkPos.y * chunkSize + chunkSize / 2,
            chunkPos.z * chunkSize + chunkSize / 2
        );
        
        // Create bounding box for chunk
        const halfSize = chunkSize / 2;
        const box = new THREE.Box3(
            new THREE.Vector3(worldPos.x - halfSize, worldPos.y - halfSize, worldPos.z - halfSize),
            new THREE.Vector3(worldPos.x + halfSize, worldPos.y + halfSize, worldPos.z + halfSize)
        );
        
        return this.frustum.intersectsBox(box);
    }
    
    /**
     * Calculate distance from chunk to camera
     */
    getChunkDistance(chunkPos, cameraPos) {
        const chunkSize = this.voxelWorld.chunkSize || 32;
        const chunkWorldPos = new THREE.Vector3(
            chunkPos.x * chunkSize + chunkSize / 2,
            chunkPos.y * chunkSize + chunkSize / 2,
            chunkPos.z * chunkSize + chunkSize / 2
        );
        
        return cameraPos.distanceTo(chunkWorldPos);
    }
    
    /**
     * Get LOD level for distance
     */
    getLODLevel(distance) {
        for (let i = 0; i < this.lodLevels.length; i++) {
            if (distance <= this.lodLevels[i].distance) {
                return i;
            }
        }
        return this.lodLevels.length - 1;
    }
    
    /**
     * Update chunk's LOD level
     */
    updateChunkLOD(chunkKey, chunk, newLOD) {
        const oldLOD = this.chunkLODLevels.get(chunkKey) || -1;
        this.chunkLODLevels.set(chunkKey, newLOD);
        
        const lodConfig = this.lodLevels[newLOD];
        
        switch (lodConfig.chunkDetail) {
            case 'full':
                this.setChunkFullDetail(chunk);
                break;
            case 'simplified':
                this.setChunkSimplified(chunk);
                break;
            case 'outline':
                this.setChunkOutline(chunk);
                break;
            case 'unloaded':
                this.queueChunkUnload(chunkKey);
                return;
        }
        
        // Update mesh quality
        this.updateMeshQuality(chunk, lodConfig.meshQuality);
    }
    
    /**
     * Set chunk to full detail mode
     */
    setChunkFullDetail(chunk) {
        if (chunk.mesh) {
            chunk.mesh.visible = true;
            chunk.mesh.material.wireframe = false;
        }
    }
    
    /**
     * Set chunk to simplified mode
     */
    setChunkSimplified(chunk) {
        if (chunk.mesh) {
            chunk.mesh.visible = true;
            chunk.mesh.material.wireframe = false;
            
            // Could implement mesh decimation here
            // For now, just reduce some visual features
        }
    }
    
    /**
     * Set chunk to outline mode
     */
    setChunkOutline(chunk) {
        if (chunk.mesh) {
            chunk.mesh.visible = true;
            chunk.mesh.material.wireframe = true;
        }
    }
    
    /**
     * Update mesh rendering quality
     */
    updateMeshQuality(chunk, quality) {
        if (!chunk.mesh || !chunk.mesh.material) return;
        
        switch (quality) {
            case 'high':
                chunk.mesh.material.side = THREE.FrontSide;
                chunk.mesh.castShadow = true;
                chunk.mesh.receiveShadow = true;
                break;
                
            case 'medium':
                chunk.mesh.material.side = THREE.FrontSide;
                chunk.mesh.castShadow = false;
                chunk.mesh.receiveShadow = true;
                break;
                
            case 'low':
                chunk.mesh.material.side = THREE.FrontSide;
                chunk.mesh.castShadow = false;
                chunk.mesh.receiveShadow = false;
                break;
                
            case 'none':
                chunk.mesh.visible = false;
                break;
        }
    }
    
    /**
     * Queue chunk for loading
     */
    queueChunkLoad(chunkPos, lodLevel) {
        const chunkKey = this.getChunkKey(chunkPos);
        
        // Check if already queued
        if (this.chunkLoadQueue.some(item => item.chunkKey === chunkKey)) {
            return;
        }
        
        this.chunkLoadQueue.push({
            chunkKey,
            chunkPos,
            lodLevel,
            priority: this.getLoadPriority(chunkPos)
        });
        
        // Sort by priority (closer chunks first)
        this.chunkLoadQueue.sort((a, b) => a.priority - b.priority);
    }
    
    /**
     * Queue chunk for unloading
     */
    queueChunkUnload(chunkKey) {
        if (!this.chunkUnloadQueue.includes(chunkKey)) {
            this.chunkUnloadQueue.push(chunkKey);
        }
    }
    
    /**
     * Process chunk loading queue
     */
    processLoadQueue() {
        let processed = 0;
        
        while (this.chunkLoadQueue.length > 0 && processed < this.maxChunksPerFrame) {
            const item = this.chunkLoadQueue.shift();
            this.loadChunk(item.chunkPos, item.lodLevel);
            processed++;
        }
    }
    
    /**
     * Process chunk unloading queue
     */
    processUnloadQueue() {
        let processed = 0;
        
        while (this.chunkUnloadQueue.length > 0 && processed < this.maxChunksPerFrame) {
            const chunkKey = this.chunkUnloadQueue.shift();
            this.unloadChunk(chunkKey);
            processed++;
        }
    }
    
    /**
     * Load a chunk
     */
    loadChunk(chunkPos, lodLevel) {
        const chunkKey = this.getChunkKey(chunkPos);
        
        // Create or get chunk from world
        const chunk = this.voxelWorld.getOrCreateChunk(chunkPos.x, chunkPos.y, chunkPos.z);
        
        this.loadedChunks.set(chunkKey, chunk);
        this.chunkLODLevels.set(chunkKey, lodLevel);
        
        // Generate mesh if needed
        if (!chunk.mesh && !chunk.isEmpty) {
            this.voxelWorld.generateChunkMesh(chunk);
        }
        
        // Apply LOD settings
        this.updateChunkLOD(chunkKey, chunk, lodLevel);
    }
    
    /**
     * Unload a chunk
     */
    unloadChunk(chunkKey) {
        const chunk = this.loadedChunks.get(chunkKey);
        
        if (chunk) {
            // Remove from scene
            if (chunk.mesh && chunk.mesh.parent) {
                chunk.mesh.parent.remove(chunk.mesh);
            }
            
            // Dispose resources
            chunk.dispose();
        }
        
        this.loadedChunks.delete(chunkKey);
        this.chunkLODLevels.delete(chunkKey);
    }
    
    /**
     * Get load priority for chunk position
     */
    getLoadPriority(chunkPos) {
        const cameraPos = this.camera.position;
        return this.getChunkDistance(chunkPos, cameraPos);
    }
    
    /**
     * Generate chunk key from position
     */
    getChunkKey(chunkPos) {
        return `${chunkPos.x},${chunkPos.y},${chunkPos.z}`;
    }
    
    /**
     * Parse chunk key to position
     */
    parseChunkKey(chunkKey) {
        const [x, y, z] = chunkKey.split(',').map(Number);
        return { x, y, z };
    }
    
    /**
     * Update performance statistics
     */
    updateStats() {
        this.stats.chunksLoaded = this.loadedChunks.size;
        this.stats.chunksVisible = 0;
        this.stats.trianglesRendered = 0;
        this.stats.memoryUsed = 0;
        
        for (const chunk of this.loadedChunks.values()) {
            if (chunk.mesh && chunk.mesh.visible) {
                this.stats.chunksVisible++;
                
                if (chunk.mesh.geometry) {
                    const indexCount = chunk.mesh.geometry.index ? 
                        chunk.mesh.geometry.index.count : 
                        chunk.mesh.geometry.attributes.position.count;
                    this.stats.trianglesRendered += Math.floor(indexCount / 3);
                }
            }
            
            this.stats.memoryUsed += chunk.getMemoryUsage ? chunk.getMemoryUsage() : 0;
        }
    }
    
    /**
     * Set LOD configuration
     */
    setLODLevels(lodLevels) {
        this.lodLevels = lodLevels;
    }
    
    /**
     * Set performance settings
     */
    setPerformanceSettings(settings) {
        if (settings.maxChunksPerFrame !== undefined) {
            this.maxChunksPerFrame = settings.maxChunksPerFrame;
        }
        if (settings.updateInterval !== undefined) {
            this.updateInterval = settings.updateInterval;
        }
    }
    
    /**
     * Get current statistics
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Force reload all chunks
     */
    reloadAllChunks() {
        // Clear current state
        for (const chunkKey of this.loadedChunks.keys()) {
            this.queueChunkUnload(chunkKey);
        }
        
        this.chunkLoadQueue = [];
        this.chunkUnloadQueue = [];
        
        // Force update on next frame
        this.lastUpdate = 0;
    }
    
    /**
     * Dispose of LOD system
     */
    dispose() {
        // Unload all chunks
        for (const chunkKey of this.loadedChunks.keys()) {
            this.unloadChunk(chunkKey);
        }
        
        this.loadedChunks.clear();
        this.chunkLODLevels.clear();
        this.chunkLoadQueue = [];
        this.chunkUnloadQueue = [];
    }
}