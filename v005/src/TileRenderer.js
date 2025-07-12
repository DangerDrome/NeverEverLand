import * as THREE from 'three';
import { tileTypes } from './TileTypes.js';

/**
 * Optimized tile rendering system using InstancedMesh for performance
 * Handles batched rendering of similar tiles to minimize draw calls
 */
export class TileRenderer {
    constructor(scene) {
        this.scene = scene;
        
        // Instanced mesh containers for each tile type
        this.instancedMeshes = new Map();
        this.instancedEdges = new Map(); // Edge meshes for each tile type
        
        // Instance data tracking
        this.instances = new Map(); // tileType -> Map<instanceId, instanceData>
        this.freeInstanceIds = new Map(); // tileType -> Set<freeIds>
        this.nextInstanceId = new Map(); // tileType -> nextId
        
        // Render layers for organization
        this.renderLayers = {
            terrain: new THREE.Group(),
            structures: new THREE.Group(),
            nature: new THREE.Group(),
            decorations: new THREE.Group()
        };
        
        // Configuration
        this.maxInstancesPerType = 1000; // Maximum instances per tile type
        this.frustumCulling = true;
        
        this.init();
    }
    
    init() {
        // Add render layers to scene
        Object.entries(this.renderLayers).forEach(([name, layer]) => {
            layer.name = `tiles_${name}`;
            this.scene.add(layer);
        });
        
        // Initialize instanced meshes for all tile types
        this.initializeInstancedMeshes();
        
        console.log('TileRenderer initialized');
    }
    
    /**
     * Initialize instanced meshes for all registered tile types
     */
    initializeInstancedMeshes() {
        const allTileTypes = tileTypes.getTileTypes();
        
        allTileTypes.forEach(tileType => {
            this.createInstancedMesh(tileType.id);
        });
    }
    
    /**
     * Create an instanced mesh for a specific tile type
     */
    createInstancedMesh(tileTypeId) {
        const tileType = tileTypes.getTileType(tileTypeId);
        if (!tileType) {
            console.warn(`Unknown tile type: ${tileTypeId}`);
            return;
        }
        
        const geometry = tileTypes.getGeometry(tileTypeId);
        const material = tileTypes.getMaterial(tileTypeId);
        
        if (!geometry || !material) {
            console.warn(`Could not create instanced mesh for tile type: ${tileTypeId}`);
            return;
        }
        
        // Create instanced mesh
        const instancedMesh = new THREE.InstancedMesh(
            geometry,
            material,
            this.maxInstancesPerType
        );
        
        // Set up instance management
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instancedMesh.count = 0; // Start with no instances
        instancedMesh.name = `instanced_${tileTypeId}`;
        
        // Add metadata
        instancedMesh.userData = {
            tileType: tileTypeId,
            renderer: this
        };
        
        // Add to appropriate render layer
        const layer = this.renderLayers[tileType.category] || this.renderLayers.terrain;
        layer.add(instancedMesh);
        
        // Create a group to hold edge lines for this tile type
        const edgeGroup = new THREE.Group();
        edgeGroup.name = `edges_${tileTypeId}`;
        layer.add(edgeGroup);
        this.instancedEdges.set(tileTypeId, edgeGroup);
        
        // Store reference
        this.instancedMeshes.set(tileTypeId, instancedMesh);
        
        // Initialize tracking data
        this.instances.set(tileTypeId, new Map());
        this.freeInstanceIds.set(tileTypeId, new Set());
        this.nextInstanceId.set(tileTypeId, 0);
        
        console.log(`Created instanced mesh for tile type: ${tileTypeId}`);
    }
    
    /**
     * Add a tile instance to the renderer
     */
    addTileInstance(tileTypeId, position, rotation = 0) {
        const instancedMesh = this.instancedMeshes.get(tileTypeId);
        if (!instancedMesh) {
            console.warn(`No instanced mesh found for tile type: ${tileTypeId}`);
            return null;
        }
        
        // Get instance ID
        const instanceId = this.getNextInstanceId(tileTypeId);
        if (instanceId === null) {
            console.warn(`Maximum instances reached for tile type: ${tileTypeId}`);
            return null;
        }
        
        // Create transformation matrix
        const matrix = new THREE.Matrix4();
        const tileType = tileTypes.getTileType(tileTypeId);
        
        // Position with height offset
        const worldPos = position.clone();
        worldPos.y += tileTypes.getTileHeightOffset(tileTypeId);
        
        // Apply rotation if supported
        if (tileTypes.isRotatable(tileTypeId)) {
            matrix.makeRotationY(rotation);
            matrix.setPosition(worldPos);
        } else {
            matrix.makeTranslation(worldPos.x, worldPos.y, worldPos.z);
        }
        
        // Set instance matrix
        instancedMesh.setMatrixAt(instanceId, matrix);
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        // Update count
        instancedMesh.count = Math.max(instancedMesh.count, instanceId + 1);
        
        // Store instance data
        const instanceData = {
            id: instanceId,
            position: position.clone(),
            rotation: rotation,
            matrix: matrix.clone()
        };
        
        this.instances.get(tileTypeId).set(instanceId, instanceData);
        
        // Add edge lines for this instance
        const edgeGroup = this.instancedEdges.get(tileTypeId);
        if (edgeGroup) {
            const geometry = tileTypes.getGeometry(tileTypeId);
            const edgeGeometry = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ 
                color: 0x000000,
                transparent: true,
                opacity: 0.5,
                depthTest: true
            });
            const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            edgeLines.position.copy(worldPos);
            if (tileTypes.isRotatable(tileTypeId)) {
                edgeLines.rotation.y = rotation;
            }
            edgeLines.userData.instanceId = instanceId;
            edgeGroup.add(edgeLines);
        }
        
        return instanceId;
    }
    
    /**
     * Remove a tile instance from the renderer
     */
    removeTileInstance(tileTypeId, instanceId) {
        const instancedMesh = this.instancedMeshes.get(tileTypeId);
        if (!instancedMesh) return false;
        
        const instanceMap = this.instances.get(tileTypeId);
        if (!instanceMap.has(instanceId)) return false;
        
        // Mark instance as invisible by scaling to zero
        const invisibleMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
        instancedMesh.setMatrixAt(instanceId, invisibleMatrix);
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        // Remove edge lines for this instance
        const edgeGroup = this.instancedEdges.get(tileTypeId);
        if (edgeGroup) {
            const edgeToRemove = edgeGroup.children.find(
                child => child.userData.instanceId === instanceId
            );
            if (edgeToRemove) {
                edgeGroup.remove(edgeToRemove);
                if (edgeToRemove.geometry) edgeToRemove.geometry.dispose();
                if (edgeToRemove.material) edgeToRemove.material.dispose();
            }
        }
        
        // Remove from instance tracking
        instanceMap.delete(instanceId);
        
        // Add to free IDs for reuse
        this.freeInstanceIds.get(tileTypeId).add(instanceId);
        
        return true;
    }
    
    /**
     * Update a tile instance's position or rotation
     */
    updateTileInstance(tileTypeId, instanceId, position, rotation = 0) {
        const instancedMesh = this.instancedMeshes.get(tileTypeId);
        if (!instancedMesh) return false;
        
        const instanceMap = this.instances.get(tileTypeId);
        const instanceData = instanceMap.get(instanceId);
        if (!instanceData) return false;
        
        // Update position and rotation
        instanceData.position.copy(position);
        instanceData.rotation = rotation;
        
        // Create new transformation matrix
        const matrix = new THREE.Matrix4();
        const worldPos = position.clone();
        worldPos.y += tileTypes.getTileHeightOffset(tileTypeId);
        
        if (tileTypes.isRotatable(tileTypeId)) {
            matrix.makeRotationY(rotation);
            matrix.setPosition(worldPos);
        } else {
            matrix.makeTranslation(worldPos.x, worldPos.y, worldPos.z);
        }
        
        instanceData.matrix.copy(matrix);
        
        // Update instance matrix
        instancedMesh.setMatrixAt(instanceId, matrix);
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        return true;
    }
    
    /**
     * Get next available instance ID for a tile type
     */
    getNextInstanceId(tileTypeId) {
        const freeIds = this.freeInstanceIds.get(tileTypeId);
        
        // Reuse free ID if available
        if (freeIds.size > 0) {
            const id = freeIds.values().next().value;
            freeIds.delete(id);
            return id;
        }
        
        // Get next sequential ID
        const nextId = this.nextInstanceId.get(tileTypeId);
        if (nextId >= this.maxInstancesPerType) {
            return null; // No more instances available
        }
        
        this.nextInstanceId.set(tileTypeId, nextId + 1);
        return nextId;
    }
    
    /**
     * Get instance data for a specific tile instance
     */
    getInstanceData(tileTypeId, instanceId) {
        const instanceMap = this.instances.get(tileTypeId);
        return instanceMap ? instanceMap.get(instanceId) : null;
    }
    
    /**
     * Get all instances for a tile type
     */
    getInstances(tileTypeId) {
        const instanceMap = this.instances.get(tileTypeId);
        return instanceMap ? Array.from(instanceMap.values()) : [];
    }
    
    /**
     * Get total instance count for a tile type
     */
    getInstanceCount(tileTypeId) {
        const instanceMap = this.instances.get(tileTypeId);
        return instanceMap ? instanceMap.size : 0;
    }
    
    /**
     * Get total instance count across all tile types
     */
    getTotalInstanceCount() {
        let total = 0;
        this.instances.forEach(instanceMap => {
            total += instanceMap.size;
        });
        return total;
    }
    
    /**
     * Clear all instances for a specific tile type
     */
    clearTileType(tileTypeId) {
        const instancedMesh = this.instancedMeshes.get(tileTypeId);
        if (!instancedMesh) return;
        
        // Reset instance count
        instancedMesh.count = 0;
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        // Clear edge lines
        const edgeGroup = this.instancedEdges.get(tileTypeId);
        if (edgeGroup) {
            while (edgeGroup.children.length > 0) {
                const child = edgeGroup.children[0];
                edgeGroup.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        }
        
        // Clear tracking data
        this.instances.get(tileTypeId).clear();
        this.freeInstanceIds.get(tileTypeId).clear();
        this.nextInstanceId.set(tileTypeId, 0);
    }
    
    /**
     * Clear all instances
     */
    clearAllInstances() {
        this.instancedMeshes.forEach((mesh, tileTypeId) => {
            this.clearTileType(tileTypeId);
        });
    }
    
    /**
     * Optimize instance arrays by compacting them
     * Removes gaps left by deleted instances
     */
    optimizeInstances(tileTypeId) {
        const instancedMesh = this.instancedMeshes.get(tileTypeId);
        if (!instancedMesh) return;
        
        const instanceMap = this.instances.get(tileTypeId);
        const instances = Array.from(instanceMap.values());
        
        // Clear current data
        this.clearTileType(tileTypeId);
        
        // Re-add instances in compact order
        instances.forEach(instanceData => {
            this.addTileInstance(
                tileTypeId,
                instanceData.position,
                instanceData.rotation
            );
        });
    }
    
    /**
     * Enable or disable frustum culling for better performance
     */
    setFrustumCulling(enabled) {
        this.frustumCulling = enabled;
        this.instancedMeshes.forEach(mesh => {
            mesh.frustumCulled = enabled;
        });
    }
    
    /**
     * Update LOD based on camera distance
     * Can be used to reduce instance detail at distance
     */
    updateLOD(cameraPosition) {
        // This is a placeholder for LOD implementation
        // Could reduce instance count or switch to lower detail meshes
        // based on distance from camera
    }
    
    /**
     * Get rendering statistics
     */
    getRenderStats() {
        const stats = {
            totalDrawCalls: this.instancedMeshes.size,
            totalInstances: this.getTotalInstanceCount(),
            instancesByType: {},
            memoryUsage: 0
        };
        
        this.instances.forEach((instanceMap, tileTypeId) => {
            stats.instancesByType[tileTypeId] = instanceMap.size;
        });
        
        // Estimate memory usage (rough calculation)
        stats.memoryUsage = stats.totalInstances * 64; // 64 bytes per matrix
        
        return stats;
    }
    
    /**
     * Enable/disable rendering for a specific layer
     */
    setLayerVisible(layerName, visible) {
        const layer = this.renderLayers[layerName];
        if (layer) {
            layer.visible = visible;
        }
    }
    
    /**
     * Get render layer visibility
     */
    isLayerVisible(layerName) {
        const layer = this.renderLayers[layerName];
        return layer ? layer.visible : false;
    }
    
    /**
     * Cleanup resources
     */
    dispose() {
        // Dispose instanced meshes
        this.instancedMeshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.instancedMeshes.clear();
        
        // Clear tracking data
        this.instances.clear();
        this.freeInstanceIds.clear();
        this.nextInstanceId.clear();
        
        // Remove render layers from scene
        Object.values(this.renderLayers).forEach(layer => {
            this.scene.remove(layer);
        });
        
        console.log('TileRenderer disposed');
    }
}