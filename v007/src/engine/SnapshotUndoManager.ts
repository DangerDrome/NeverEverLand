import { VoxelType, VoxelEngine } from './VoxelEngine';

interface LayerSnapshot {
    id: string;
    name: string;
    visible: boolean;
    opacity: number;
    locked: boolean;
    isEditingAsset: boolean;
    editingAssetId?: string;
    editingAssetType?: VoxelType;
    isBaked: boolean;
    voxels: Map<string, VoxelType>;
}

interface SceneSnapshot {
    // Layer data - complete layer state
    layers: LayerSnapshot[];
    // Active layer ID
    activeLayerId: string;
    // Current selection
    selection: Array<{ x: number; y: number; z: number; type: VoxelType }>;
    // Timestamp for this snapshot
    timestamp: number;
}

export class SnapshotUndoManager {
    private undoStack: SceneSnapshot[] = [];
    private redoStack: SceneSnapshot[] = [];
    private voxelEngine: VoxelEngine;
    private selectionCallback: ((selection: Array<{ x: number; y: number; z: number; type: VoxelType }>) => void) | null = null;
    private layerUICallback: (() => void) | null = null;
    private readonly maxHistorySize: number;
    private lastSnapshotTime: number = 0;
    private readonly snapshotDelayMs: number = 300; // Delay before taking snapshot after last change
    private snapshotTimer: number | null = null;
    private isRestoring: boolean = false; // Flag to prevent snapshots during restoration
    
    constructor(voxelEngine: VoxelEngine, maxHistorySize: number = 50) {
        this.voxelEngine = voxelEngine;
        this.maxHistorySize = maxHistorySize;
    }
    
    /**
     * Set the callback for selection restoration
     */
    setSelectionCallback(callback: (selection: Array<{ x: number; y: number; z: number; type: VoxelType }>) => void): void {
        this.selectionCallback = callback;
    }
    
    /**
     * Set the callback for layer UI updates
     */
    setLayerUICallback(callback: () => void): void {
        this.layerUICallback = callback;
    }
    
    /**
     * Take a snapshot of the current scene state
     */
    private takeSnapshot(): SceneSnapshot {
        // Get all layers and their state
        const layers = this.voxelEngine.getAllLayers();
        const layerSnapshots: LayerSnapshot[] = [];
        
        for (const layer of layers) {
            // Create a deep copy of the layer's voxel data
            const voxelsCopy = new Map<string, VoxelType>();
            for (const [key, type] of layer.getVoxels().entries()) {
                voxelsCopy.set(key, type);
            }
            
            layerSnapshots.push({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                locked: layer.locked,
                isEditingAsset: layer.isEditingAsset,
                editingAssetId: layer.editingAssetId,
                editingAssetType: layer.editingAssetType,
                isBaked: layer.isBaked,
                voxels: voxelsCopy
            });
        }
        
        // Get current active layer ID
        const activeLayer = this.voxelEngine.getActiveLayer();
        const activeLayerId = activeLayer ? activeLayer.id : '';
        
        // Get current selection (will be set externally)
        const selection = this.currentSelection ? [...this.currentSelection] : [];
        
        return {
            layers: layerSnapshots,
            activeLayerId: activeLayerId,
            selection: selection,
            timestamp: Date.now()
        };
    }
    
    // Store current selection for snapshot
    private currentSelection: Array<{ x: number; y: number; z: number; type: VoxelType }> = [];
    
    /**
     * Update the current selection (called before taking snapshot)
     */
    updateCurrentSelection(selection: Array<{ x: number; y: number; z: number; type: VoxelType }>): void {
        this.currentSelection = selection.map(v => ({ ...v }));
    }
    
    /**
     * Schedule a snapshot after changes
     */
    scheduleSnapshot(): void {
        // Don't schedule snapshots during restoration
        if (this.isRestoring) return;
        
        // Clear any existing timer
        if (this.snapshotTimer) {
            window.clearTimeout(this.snapshotTimer);
        }
        
        // Schedule new snapshot
        this.snapshotTimer = window.setTimeout(() => {
            this.saveSnapshot();
            this.snapshotTimer = null;
        }, this.snapshotDelayMs);
        
        // Clear redo stack when new changes are made
        this.redoStack = [];
    }
    
    /**
     * Save a snapshot immediately
     */
    saveSnapshot(): void {
        // Clear any pending timer
        if (this.snapshotTimer) {
            window.clearTimeout(this.snapshotTimer);
            this.snapshotTimer = null;
        }
        
        const snapshot = this.takeSnapshot();
        this.undoStack.push(snapshot);
        
        // Limit history size
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift(); // Remove oldest
        }
        
        this.lastSnapshotTime = Date.now();
        
        // Log snapshot
        console.log(`Snapshot saved. Undo stack: ${this.undoStack.length}, Redo stack: ${this.redoStack.length}`);
    }
    
    /**
     * Force save snapshot if pending
     */
    finalizePendingOperations(): void {
        if (this.snapshotTimer) {
            window.clearTimeout(this.snapshotTimer);
            this.snapshotTimer = null;
            this.saveSnapshot();
        }
    }
    
    /**
     * Restore a snapshot to the scene
     */
    private restoreSnapshot(snapshot: SceneSnapshot): void {
        // Set flag to prevent snapshot triggers during restoration
        this.isRestoring = true;
        
        try {
            // Get current layers
            const currentLayers = this.voxelEngine.getAllLayers();
            const currentLayerMap = new Map(currentLayers.map(l => [l.id, l]));
            const snapshotLayerMap = new Map(snapshot.layers.map(l => [l.id, l]));
            
            // Remove layers that don't exist in snapshot
            for (const currentLayer of currentLayers) {
                if (!snapshotLayerMap.has(currentLayer.id)) {
                    this.voxelEngine.deleteLayer(currentLayer.id);
                }
            }
            
            // Add or update layers from snapshot
            for (let i = 0; i < snapshot.layers.length; i++) {
                const layerSnapshot = snapshot.layers[i];
                let layer = currentLayerMap.get(layerSnapshot.id);
                
                if (!layer) {
                    // Layer doesn't exist, create it
                    layer = this.voxelEngine.createLayer(layerSnapshot.name, layerSnapshot.id);
                }
                
                // Update layer properties
                layer.name = layerSnapshot.name;
                layer.visible = layerSnapshot.visible;
                layer.opacity = layerSnapshot.opacity;
                layer.locked = layerSnapshot.locked;
                layer.isEditingAsset = layerSnapshot.isEditingAsset;
                layer.editingAssetId = layerSnapshot.editingAssetId;
                layer.editingAssetType = layerSnapshot.editingAssetType;
                
                // Clear and restore voxels for this layer
                layer.clear();
                for (const [posKey, type] of layerSnapshot.voxels.entries()) {
                    layer.setVoxel(posKey, type);
                }
                
                // Ensure layer is at correct position
                const currentIndex = this.voxelEngine.getAllLayers().findIndex(l => l.id === layerSnapshot.id);
                if (currentIndex !== i && currentIndex !== -1) {
                    this.voxelEngine.moveLayer(layerSnapshot.id, i);
                }
            }
            
            // Restore active layer
            if (snapshot.activeLayerId) {
                this.voxelEngine.setActiveLayer(snapshot.activeLayerId);
            }
            
            // Update rendering
            this.voxelEngine.updateInstances();
            
            // Restore selection
            if (this.selectionCallback) {
                this.selectionCallback(snapshot.selection);
            }
            
            // Update layer UI
            if (this.layerUICallback) {
                this.layerUICallback();
            }
        } finally {
            // Always clear the flag even if an error occurs
            this.isRestoring = false;
        }
    }
    
    /**
     * Undo the last operation
     */
    undo(): boolean {
        // Finalize any pending snapshots first
        this.finalizePendingOperations();
        
        if (this.undoStack.length <= 1) {
            // Need at least 2 snapshots to undo (current + previous)
            return false;
        }
        
        // Pop current state and save to redo stack
        const currentState = this.undoStack.pop()!;
        this.redoStack.push(currentState);
        
        // Get previous state
        const previousState = this.undoStack[this.undoStack.length - 1];
        
        // Restore previous state
        this.restoreSnapshot(previousState);
        
        // Log the undo operation
        import('../ui/ActionLogger').then(({ ActionLogger }) => {
            const logger = ActionLogger.getInstance();
            logger.log(ActionLogger.actions.undo());
        });
        
        return true;
    }
    
    /**
     * Redo the last undone operation
     */
    redo(): boolean {
        if (this.redoStack.length === 0) return false;
        
        const redoState = this.redoStack.pop()!;
        this.undoStack.push(redoState);
        
        // Restore the redo state
        this.restoreSnapshot(redoState);
        
        // Log the redo operation
        import('../ui/ActionLogger').then(({ ActionLogger }) => {
            const logger = ActionLogger.getInstance();
            logger.log(ActionLogger.actions.redo());
        });
        
        return true;
    }
    
    /**
     * Clear all history
     */
    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
        if (this.snapshotTimer) {
            window.clearTimeout(this.snapshotTimer);
            this.snapshotTimer = null;
        }
        this.currentSelection = [];
    }
    
    /**
     * Get the number of available undo operations
     */
    getUndoCount(): number {
        return Math.max(0, this.undoStack.length - 1);
    }
    
    /**
     * Get the number of available redo operations
     */
    getRedoCount(): number {
        return this.redoStack.length;
    }
    
    /**
     * Get memory usage estimate in bytes
     */
    getMemoryUsage(): number {
        // Rough estimate: each voxel takes about 20 bytes in snapshot
        const totalVoxels = 
            this.undoStack.reduce((sum, snapshot) => {
                return sum + snapshot.layers.reduce((layerSum, layer) => layerSum + layer.voxels.size, 0);
            }, 0) +
            this.redoStack.reduce((sum, snapshot) => {
                return sum + snapshot.layers.reduce((layerSum, layer) => layerSum + layer.voxels.size, 0);
            }, 0);
        
        return totalVoxels * 20;
    }
    
    // Legacy compatibility methods
    recordOperation(position: any, newType: any, previousType: any): void {
        // Just schedule a snapshot
        this.scheduleSnapshot();
    }
    
    recordSelectionChange(previousSelection: any, newSelection: any): void {
        // Update current selection and schedule snapshot
        this.updateCurrentSelection(newSelection);
        this.scheduleSnapshot();
    }
}