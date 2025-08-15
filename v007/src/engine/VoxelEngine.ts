import * as THREE from 'three';
import { VoxelRenderer } from './VoxelRenderer';
import { VoxelType, VoxelPosition, RaycastHit } from '../types';
import { UndoRedoManager } from './UndoRedoManager';
import { VoxelLayer } from './VoxelLayer';
import { BakedMeshWireframe } from './BakedMeshWireframe';

export { VoxelType };

export class VoxelEngine {
    private scene: THREE.Scene;
    private voxelSize: number;
    private layers: VoxelLayer[];
    private activeLayerId: string;
    private renderer: VoxelRenderer;
    private undoRedoManager: UndoRedoManager;
    private layerIdCounter: number = 0;
    private bakedMeshes: Map<string, { opaque?: THREE.Mesh; transparent?: THREE.Mesh }> = new Map();
    private bakedWireframe: BakedMeshWireframe;
    
    // Batch update system
    private batchMode: boolean = false;
    private batchedChanges: Set<string> = new Set();
    private updateTimer: number | null = null;
    private lastUpdateTime: number = 0;
    private readonly MIN_UPDATE_INTERVAL = 8; // ~120fps for smoother drawing
    
    constructor(scene: THREE.Scene, showWireframe = true, voxelSize = 0.1) {
        this.scene = scene;
        this.voxelSize = voxelSize; // Current voxel size for the world
        
        // Initialize with a default layer
        this.layers = [];
        const defaultLayer = this.createLayer('Layer 1');
        this.activeLayerId = defaultLayer.id;
        
        // Voxel renderer handles all rendering
        this.renderer = new VoxelRenderer(scene, this.voxelSize, showWireframe);
        
        // Initialize baked mesh wireframe system
        this.bakedWireframe = new BakedMeshWireframe();
        this.bakedWireframe.setVisible(showWireframe);
        
        // Initialize undo/redo manager
        this.undoRedoManager = new UndoRedoManager(this);
    }
    
    // Getter for voxel size
    getVoxelSize(): number {
        return this.voxelSize;
    }
    
    // Get current voxel size (alias for getVoxelSize)
    getCurrentVoxelSize(): number {
        return this.voxelSize;
    }
    
    // Layer management methods
    createLayer(name?: string): VoxelLayer {
        const id = `layer_${++this.layerIdCounter}`;
        const layerName = name || `Layer ${this.layerIdCounter}`;
        const layer = new VoxelLayer(id, layerName);
        this.layers.push(layer);
        return layer;
    }
    
    deleteLayer(layerId: string): boolean {
        // Can't delete the last layer
        if (this.layers.length <= 1) return false;
        
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index === -1) return false;
        
        const layer = this.layers[index];
        
        // Clean up baked meshes if any
        if (layer.isBaked) {
            this.removeBakedMeshes(layerId);
        }
        
        // Remove the layer
        this.layers.splice(index, 1);
        
        // If this was the active layer, switch to the first layer
        if (this.activeLayerId === layerId && this.layers.length > 0) {
            this.activeLayerId = this.layers[0].id;
        }
        
        // Trigger update
        this.updateInstances();
        
        return true;
    }
    
    setActiveLayer(layerId: string): boolean {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            this.activeLayerId = layerId;
            return true;
        }
        return false;
    }
    
    getActiveLayer(): VoxelLayer | null {
        return this.layers.find(l => l.id === this.activeLayerId) || null;
    }
    
    getAllLayers(): VoxelLayer[] {
        return [...this.layers];
    }
    
    moveLayer(layerId: string, newIndex: number): boolean {
        const currentIndex = this.layers.findIndex(l => l.id === layerId);
        if (currentIndex === -1 || newIndex < 0 || newIndex >= this.layers.length) {
            return false;
        }
        
        // Remove and reinsert at new position
        const [layer] = this.layers.splice(currentIndex, 1);
        this.layers.splice(newIndex, 0, layer);
        return true;
    }
    
    duplicateLayer(layerId: string): VoxelLayer | null {
        const sourceLayer = this.layers.find(l => l.id === layerId);
        if (!sourceLayer) return null;
        
        const newLayer = this.createLayer(`${sourceLayer.name} copy`);
        
        // Copy all voxels
        const exportData = sourceLayer.exportData();
        newLayer.importData(exportData);
        
        return newLayer;
    }
    
    mergeLayerDown(layerId: string): boolean {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index <= 0) return false; // Can't merge first layer down
        
        const sourceLayer = this.layers[index];
        const targetLayer = this.layers[index - 1];
        
        // Copy all voxels from source to target
        for (const [key, type] of sourceLayer.getVoxels()) {
            targetLayer.setVoxel(key, type);
        }
        
        // Delete the source layer
        this.deleteLayer(layerId);
        return true;
    }
    
    // Create position key for voxel storage
    private positionKey(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }
    
    // Parse position from key
    private parsePositionKey(key: string): VoxelPosition {
        const [x, y, z] = key.split(',').map(Number);
        return { x, y, z };
    }
    
    // Voxel size is fixed at 0.1m, no need for dynamic sizing
    
    // Set a voxel at the given position
    setVoxel(x: number, y: number, z: number, type: VoxelType, recordUndo: boolean = true): boolean {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        
        // Prevent placing voxels below the ground plane
        if (y < 0) return false;
        
        const activeLayer = this.getActiveLayer();
        if (!activeLayer || activeLayer.locked) return false;
        
        const key = this.positionKey(x, y, z);
        const oldType = activeLayer.getVoxel(key);
        
        // No change needed
        if (oldType === type) return false;
        
        // Record operation for undo/redo if enabled
        if (recordUndo) {
            this.undoRedoManager.recordOperation(
                { x, y, z },
                type,
                oldType
            );
        }
        
        // Update voxel in active layer
        activeLayer.setVoxel(key, type);
        
        // Track changed voxel for batch update
        if (this.batchMode) {
            this.batchedChanges.add(key);
        }
        
        return true;
    }
    
    // Get voxel at position (checks all visible layers from top to bottom)
    getVoxel(x: number, y: number, z: number): VoxelType {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        
        const key = this.positionKey(x, y, z);
        
        // Check layers from top to bottom
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.visible) {
                const type = layer.getVoxel(key);
                if (type !== VoxelType.AIR) {
                    return type;
                }
            }
        }
        
        return VoxelType.AIR;
    }
    
    getVoxelWithLayerInfo(x: number, y: number, z: number): { type: VoxelType; layerId?: string; isBaked?: boolean } {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        
        const key = this.positionKey(x, y, z);
        
        // Check layers from top to bottom
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.visible) {
                const type = layer.getVoxel(key);
                if (type !== VoxelType.AIR) {
                    return {
                        type,
                        layerId: layer.id,
                        isBaked: layer.isBaked
                    };
                }
            }
        }
        
        return { type: VoxelType.AIR };
    }
    
    // Update all instance buffers
    updateInstances(): void {
        if (this.batchMode) {
            // In batch mode, defer the update
            this.scheduleUpdate();
        } else {
            // Immediate update
            this.performUpdate();
        }
    }
    
    // Start batch mode for multiple voxel operations
    startBatch(): void {
        this.batchMode = true;
        this.batchedChanges.clear();
    }
    
    // End batch mode and apply all changes
    endBatch(): void {
        if (!this.batchMode) return;
        
        this.batchMode = false;
        
        if (this.batchedChanges.size > 0) {
            this.performUpdate();
            this.batchedChanges.clear();
        }
        
        // Clear any pending timer
        if (this.updateTimer !== null) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
    }
    
    // Schedule an update with throttling
    private scheduleUpdate(): void {
        // Cancel existing timer
        if (this.updateTimer !== null) {
            clearTimeout(this.updateTimer);
        }
        
        // Calculate time since last update
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        
        if (timeSinceLastUpdate >= this.MIN_UPDATE_INTERVAL) {
            // Enough time has passed, update immediately
            this.performUpdate();
        } else {
            // Schedule update after minimum interval
            const delay = this.MIN_UPDATE_INTERVAL - timeSinceLastUpdate;
            this.updateTimer = window.setTimeout(() => {
                this.performUpdate();
                this.updateTimer = null;
            }, delay);
        }
    }
    
    // Perform the actual update
    private performUpdate(): void {
        // Update baked mesh visibility first
        this.updateBakedMeshVisibility();
        
        // Combine voxels from all visible NON-BAKED layers
        const combinedVoxelsByType = new Map<VoxelType, Set<string>>();
        
        // Initialize map for all voxel types
        for (const type of Object.values(VoxelType)) {
            if (typeof type === 'number' && type !== VoxelType.AIR) {
                combinedVoxelsByType.set(type, new Set());
            }
        }
        
        // Combine layers from bottom to top (skip baked layers)
        for (const layer of this.layers) {
            if (layer.visible && !layer.isBaked) {
                const layerVoxelsByType = layer.getVoxelsByType();
                for (const [type, positions] of layerVoxelsByType) {
                    const combinedSet = combinedVoxelsByType.get(type);
                    if (combinedSet) {
                        // Add all positions from this layer
                        for (const pos of positions) {
                            combinedSet.add(pos);
                        }
                    }
                }
            }
        }
        
        this.renderer.updateFromVoxelsByType(combinedVoxelsByType, this.batchMode);
        this.lastUpdateTime = Date.now();
        
        // Clear batched changes after update
        if (this.batchMode) {
            this.batchedChanges.clear();
        }
        
        // Force edge update even in batch mode for immediate visual feedback
        if (this.batchMode && this.renderer.getShowEdges()) {
            this.renderer.forceUpdateEdges();
        }
    }
    
    
    // Raycast to find voxel intersection using grid traversal
    raycast(raycaster: THREE.Raycaster): RaycastHit | null {
        // Get ray origin and direction
        const origin = raycaster.ray.origin.clone();
        const direction = raycaster.ray.direction.clone().normalize();
        
        // Convert to voxel space - just divide by voxel size, no offset
        const voxelOrigin = {
            x: origin.x / this.voxelSize,
            y: origin.y / this.voxelSize,
            z: origin.z / this.voxelSize
        };
        
        // Maximum ray distance in voxel units
        const maxDistance = 500; // Increased to 500 voxels for better reach
        
        // Use DDA (Digital Differential Analyzer) algorithm for voxel traversal
        let currentVoxel = {
            x: Math.floor(voxelOrigin.x),
            y: Math.floor(voxelOrigin.y),
            z: Math.floor(voxelOrigin.z)
        };
        
        // Calculate step direction
        const step = {
            x: direction.x > 0 ? 1 : -1,
            y: direction.y > 0 ? 1 : -1,
            z: direction.z > 0 ? 1 : -1
        };
        
        // Calculate distances to next voxel boundaries
        // Handle division by zero by using a large number instead of Infinity
        const tDelta = {
            x: direction.x !== 0 ? Math.abs(1.0 / direction.x) : 1e30,
            y: direction.y !== 0 ? Math.abs(1.0 / direction.y) : 1e30,
            z: direction.z !== 0 ? Math.abs(1.0 / direction.z) : 1e30
        };
        
        // Calculate initial distances to voxel boundaries
        const voxelBounds = {
            x: currentVoxel.x + (step.x > 0 ? 1 : 0),
            y: currentVoxel.y + (step.y > 0 ? 1 : 0),
            z: currentVoxel.z + (step.z > 0 ? 1 : 0)
        };
        
        // Calculate tMax with proper handling of zero direction components
        const tMax = {
            x: direction.x !== 0 ? (voxelBounds.x - voxelOrigin.x) / direction.x : 1e30,
            y: direction.y !== 0 ? (voxelBounds.y - voxelOrigin.y) / direction.y : 1e30,
            z: direction.z !== 0 ? (voxelBounds.z - voxelOrigin.z) / direction.z : 1e30
        };
        
        // Traverse voxels
        let distance = 0;
        let previousVoxel = { ...currentVoxel };
        let hitAxis = null;
        
        while (distance < maxDistance) {
            
            // Check if current voxel contains a solid voxel
            const voxelInfo = this.getVoxelWithLayerInfo(currentVoxel.x, currentVoxel.y, currentVoxel.z);
            if (voxelInfo.type !== VoxelType.AIR) {
                // We hit a voxel! Use the DDA traversal info to determine which face
                const normal = { x: 0, y: 0, z: 0 };
                let t = 0;
                
                // The face we hit is determined by which axis we came from
                // This is more reliable than calculating all face intersections
                if (hitAxis === 'x') {
                    normal.x = -step.x;
                    const planeX = currentVoxel.x * this.voxelSize + (step.x > 0 ? 0 : this.voxelSize);
                    t = (planeX - origin.x) / direction.x;
                } else if (hitAxis === 'y') {
                    normal.y = -step.y;
                    const planeY = currentVoxel.y * this.voxelSize + (step.y > 0 ? 0 : this.voxelSize);
                    t = (planeY - origin.y) / direction.y;
                } else if (hitAxis === 'z') {
                    normal.z = -step.z;
                    const planeZ = currentVoxel.z * this.voxelSize + (step.z > 0 ? 0 : this.voxelSize);
                    t = (planeZ - origin.z) / direction.z;
                } else {
                    // First voxel hit (we started inside or very close)
                    // Determine face based on ray direction relative to voxel center
                    const voxelCenter = {
                        x: (currentVoxel.x + 0.5) * this.voxelSize,
                        y: (currentVoxel.y + 0.5) * this.voxelSize,
                        z: (currentVoxel.z + 0.5) * this.voxelSize
                    };
                    
                    // Find the closest face by checking which boundary is nearest to ray origin
                    const relPos = {
                        x: origin.x - voxelCenter.x,
                        y: origin.y - voxelCenter.y,
                        z: origin.z - voxelCenter.z
                    };
                    
                    const absX = Math.abs(relPos.x);
                    const absY = Math.abs(relPos.y);
                    const absZ = Math.abs(relPos.z);
                    
                    if (absX >= absY && absX >= absZ) {
                        // X face is closest
                        normal.x = relPos.x > 0 ? 1 : -1;
                        const planeX = currentVoxel.x * this.voxelSize + (normal.x > 0 ? this.voxelSize : 0);
                        t = (planeX - origin.x) / direction.x;
                    } else if (absY >= absX && absY >= absZ) {
                        // Y face is closest
                        normal.y = relPos.y > 0 ? 1 : -1;
                        const planeY = currentVoxel.y * this.voxelSize + (normal.y > 0 ? this.voxelSize : 0);
                        t = (planeY - origin.y) / direction.y;
                    } else {
                        // Z face is closest
                        normal.z = relPos.z > 0 ? 1 : -1;
                        const planeZ = currentVoxel.z * this.voxelSize + (normal.z > 0 ? this.voxelSize : 0);
                        t = (planeZ - origin.z) / direction.z;
                    }
                }
                
                const point = origin.clone().add(direction.clone().multiplyScalar(t));
                
                // Calculate adjacent position based on hit normal
                const adjacentPos = {
                    x: currentVoxel.x + normal.x,
                    y: Math.max(0, currentVoxel.y + normal.y), // Prevent going below ground
                    z: currentVoxel.z + normal.z
                };
                
                return {
                    voxelPos: currentVoxel,
                    adjacentPos: adjacentPos,
                    point: point,
                    normal: new THREE.Vector3(normal.x, normal.y, normal.z),
                    distance: t,
                    layerId: voxelInfo.layerId,
                    isBakedLayer: voxelInfo.isBaked
                };
            }
            
            // Move to next voxel
            previousVoxel = { ...currentVoxel };
            
            if (tMax.x < tMax.y && tMax.x < tMax.z) {
                currentVoxel.x += step.x;
                distance = tMax.x;
                tMax.x += tDelta.x;
                hitAxis = 'x';
            } else if (tMax.y < tMax.z) {
                currentVoxel.y += step.y;
                distance = tMax.y;
                tMax.y += tDelta.y;
                hitAxis = 'y';
            } else {
                currentVoxel.z += step.z;
                distance = tMax.z;
                tMax.z += tDelta.z;
                hitAxis = 'z';
            }
        }
        
        // If no voxel hit, check infinite ground plane at y=0
        // Calculate ray-plane intersection for y=0 plane
        // Plane equation: y = 0, normal = (0, 1, 0)
        // Ray: P = origin + t * direction
        // Intersection: origin.y + t * direction.y = 0
        // Therefore: t = -origin.y / direction.y
        
        // Only proceed if ray is not parallel to ground plane (direction.y != 0)
        // and intersection is in front of ray origin (t > 0)
        if (Math.abs(direction.y) > 0.0001) {
            const t = -origin.y / direction.y;
            
            // Only return intersection if it's in front of the ray origin
            if (t > 0) {
                const point = origin.clone().add(direction.clone().multiplyScalar(t));
                
                // Calculate voxel position at ground intersection
                // Use Math.floor to get consistent voxel grid positions
                const voxelX = Math.floor(point.x / this.voxelSize);
                const voxelZ = Math.floor(point.z / this.voxelSize);
                
                // Determine normal based on ray direction
                // If ray comes from above, normal points up; if from below, normal points down
                const normal = direction.y < 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, -1, 0);
                
                // Adjust to place voxels on top of ground (y=0) when coming from above
                // or below ground when coming from below
                return {
                    voxelPos: {
                        x: voxelX,
                        y: direction.y < 0 ? -1 : 0,
                        z: voxelZ
                    },
                    adjacentPos: {
                        x: voxelX,
                        y: 0, // Always place on the ground (y=0), never below
                        z: voxelZ
                    },
                    point: point,
                    normal: normal,
                    distance: t
                };
            }
        }
        
        return null;
    }
    
    // Get total voxel count across all layers
    getVoxelCount(): number {
        let count = 0;
        for (const layer of this.layers) {
            count += layer.getVoxelCount();
        }
        return count;
    }
    
    // Export voxel data for saving (includes all layers)
    exportVoxels(): any {
        const voxelData: any = {
            version: '2.0', // Updated version for layer support
            timestamp: Date.now(),
            voxelSize: this.voxelSize,
            activeLayerId: this.activeLayerId,
            layers: []
        };
        
        // Export all layers
        for (const layer of this.layers) {
            voxelData.layers.push(layer.exportData());
        }
        
        return voxelData;
    }
    
    // Import voxel data from file
    importVoxels(data: any): void {
        if (!data) {
            throw new Error('Invalid voxel data format');
        }
        
        // Clear existing voxels
        this.clear();
        
        // Check if this is the new layer format
        if (data.version === '2.0' && data.layers) {
            // Import layers
            for (const layerData of data.layers) {
                const layer = this.createLayer(layerData.name);
                layer.importData(layerData);
            }
            
            // Set active layer if specified
            if (data.activeLayerId) {
                this.setActiveLayer(data.activeLayerId);
            }
        } else if (data.voxels) {
            // Old format - import into the default layer
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            // Import voxels by type
            for (const [typeStr, positions] of Object.entries(data.voxels)) {
                const type = parseInt(typeStr) as VoxelType;
                if (type in VoxelType && Array.isArray(positions)) {
                    for (const posKey of positions as string[]) {
                        const [x, y, z] = posKey.split(',').map(Number);
                        // Don't record undo operations when importing
                        this.setVoxel(x, y, z, type, false);
                    }
                }
            }
        } else {
            throw new Error('Invalid voxel data format');
        }
        
        console.log(`Imported ${this.getVoxelCount()} voxels from file`);
    }

    // Clear all voxels
    clear(): void {
        // Clear all layers but keep at least one
        this.layers = [];
        this.layerIdCounter = 0;
        const defaultLayer = this.createLayer('Layer 1');
        this.activeLayerId = defaultLayer.id;
        
        this.renderer.clear();
        
        // Clear undo history when clearing all voxels
        this.undoRedoManager.clear();
    }
    
    // Get bounds of all voxels across all layers
    getBounds(): { min: VoxelPosition; max: VoxelPosition } {
        let min = { x: Infinity, y: Infinity, z: Infinity };
        let max = { x: -Infinity, y: -Infinity, z: -Infinity };
        
        let hasVoxels = false;
        for (const layer of this.layers) {
            for (const posKey of layer.getVoxels().keys()) {
                const { x, y, z } = this.parsePositionKey(posKey);
                min.x = Math.min(min.x, x);
                min.y = Math.min(min.y, y);
                min.z = Math.min(min.z, z);
                max.x = Math.max(max.x, x);
                max.y = Math.max(max.y, y);
                max.z = Math.max(max.z, z);
                hasVoxels = true;
            }
        }
        
        // If no voxels, return default bounds
        if (!hasVoxels) {
            return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
        }
        
        return { min, max };
    }
    
    // Undo/Redo methods
    undo(): boolean {
        return this.undoRedoManager.undo();
    }
    
    redo(): boolean {
        return this.undoRedoManager.redo();
    }
    
    recordSelectionChange(
        previousSelection: Array<{ x: number; y: number; z: number; type: VoxelType }>,
        newSelection: Array<{ x: number; y: number; z: number; type: VoxelType }>
    ): void {
        this.undoRedoManager.recordSelectionChange(previousSelection, newSelection);
    }
    
    setSelectionCallback(callback: (selection: Array<{ x: number; y: number; z: number; type: VoxelType }>) => void): void {
        this.undoRedoManager.setSelectionCallback(callback);
    }
    
    finalizePendingOperations(): void {
        this.undoRedoManager.finalizePendingOperations();
    }
    
    getUndoCount(): number {
        return this.undoRedoManager.getUndoCount();
    }
    
    getRedoCount(): number {
        return this.undoRedoManager.getRedoCount();
    }
    
    clearUndoHistory(): void {
        this.undoRedoManager.clear();
    }
    
    // Toggle edge display
    toggleEdges(): void {
        this.renderer.toggleEdges();
        // Also toggle wireframe for baked meshes
        this.bakedWireframe.setVisible(this.renderer.getShowEdges());
    }
    
    // Get edge display state
    getShowEdges(): boolean {
        return this.renderer.getShowEdges();
    }
    
    // Force update edges
    forceUpdateEdges(): void {
        this.renderer.forceUpdateEdges();
    }
    
    // Get all voxels in the world (from all visible layers)
    getAllVoxels(): Array<{ x: number; y: number; z: number; type: VoxelType }> {
        const allVoxels: Array<{ x: number; y: number; z: number; type: VoxelType }> = [];
        const processedPositions = new Set<string>();
        
        // Iterate through layers from top to bottom
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.visible) {
                for (const [key, type] of layer.getVoxels().entries()) {
                    if (type !== VoxelType.AIR && !processedPositions.has(key)) {
                        const pos = this.parsePositionKey(key);
                        allVoxels.push({
                            x: pos.x,
                            y: pos.y,
                            z: pos.z,
                            type: type
                        });
                        processedPositions.add(key);
                    }
                }
            }
        }
        
        return allVoxels;
    }
    
    // Check if batch mode is active
    isBatchMode(): boolean {
        return this.batchMode;
    }
    
    // Get all layers
    getLayers(): VoxelLayer[] {
        return this.layers;
    }
    
    /**
     * Bake a layer for optimized rendering
     */
    bakeLayer(layerId: string): boolean {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || layer.isBaked) return false;
        
        // Remove old baked meshes if any
        this.removeBakedMeshes(layerId);
        
        // Bake the layer
        layer.bake(this.voxelSize);
        
        // Add baked meshes to scene
        if (layer.bakedOpaqueMesh || layer.bakedTransparentMesh) {
            const meshes: { opaque?: THREE.Mesh; transparent?: THREE.Mesh } = {};
            
            if (layer.bakedOpaqueMesh) {
                meshes.opaque = layer.bakedOpaqueMesh;
                this.scene.add(layer.bakedOpaqueMesh);
                layer.bakedOpaqueMesh.visible = layer.visible;
                // Create wireframe for opaque mesh
                this.bakedWireframe.updateWireframe(layer.bakedOpaqueMesh);
            }
            
            if (layer.bakedTransparentMesh) {
                meshes.transparent = layer.bakedTransparentMesh;
                this.scene.add(layer.bakedTransparentMesh);
                layer.bakedTransparentMesh.visible = layer.visible;
                // Ensure transparent mesh renders after opaque
                layer.bakedTransparentMesh.renderOrder = 1;
                // Create wireframe for transparent mesh
                this.bakedWireframe.updateWireframe(layer.bakedTransparentMesh);
            }
            
            this.bakedMeshes.set(layerId, meshes);
        }
        
        // Update rendering to exclude baked layer from instanced rendering
        this.updateInstances();
        
        return true;
    }
    
    /**
     * Unbake a layer to restore editable voxels
     */
    unbakeLayer(layerId: string): boolean {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || !layer.isBaked) return false;
        
        // Remove baked meshes from scene
        this.removeBakedMeshes(layerId);
        
        // Unbake the layer
        layer.unbake();
        
        // Update rendering to include unbaked layer
        this.updateInstances();
        
        return true;
    }
    
    /**
     * Remove baked meshes from scene
     */
    private removeBakedMeshes(layerId: string): void {
        const meshes = this.bakedMeshes.get(layerId);
        if (meshes) {
            if (meshes.opaque) {
                // Remove wireframe
                this.bakedWireframe.removeWireframe(meshes.opaque);
                // Remove mesh
                this.scene.remove(meshes.opaque);
                meshes.opaque.geometry.dispose();
                if (meshes.opaque.material instanceof THREE.Material) {
                    meshes.opaque.material.dispose();
                }
            }
            if (meshes.transparent) {
                // Remove wireframe
                this.bakedWireframe.removeWireframe(meshes.transparent);
                // Remove mesh
                this.scene.remove(meshes.transparent);
                meshes.transparent.geometry.dispose();
                if (meshes.transparent.material instanceof THREE.Material) {
                    meshes.transparent.material.dispose();
                }
            }
            this.bakedMeshes.delete(layerId);
        }
    }
    
    /**
     * Update visibility of baked meshes based on layer visibility
     */
    private updateBakedMeshVisibility(): void {
        for (const layer of this.layers) {
            if (layer.isBaked) {
                const meshes = this.bakedMeshes.get(layer.id);
                if (meshes) {
                    if (meshes.opaque) {
                        meshes.opaque.visible = layer.visible;
                        // Update wireframe visibility
                        this.bakedWireframe.updateVisibility(meshes.opaque, layer.visible);
                    }
                    if (meshes.transparent) {
                        meshes.transparent.visible = layer.visible;
                        // Update wireframe visibility
                        this.bakedWireframe.updateVisibility(meshes.transparent, layer.visible);
                    }
                }
            }
        }
    }
}