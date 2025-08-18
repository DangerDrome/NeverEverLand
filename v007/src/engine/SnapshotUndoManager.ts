import { VoxelType, VoxelEngine } from './VoxelEngine';

interface SceneSnapshot {
    // All voxels in the scene
    voxels: Map<string, { x: number; y: number; z: number; type: VoxelType }>;
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
    private readonly maxHistorySize: number;
    private lastSnapshotTime: number = 0;
    private readonly snapshotDelayMs: number = 300; // Delay before taking snapshot after last change
    private snapshotTimer: number | null = null;
    
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
     * Take a snapshot of the current scene state
     */
    private takeSnapshot(): SceneSnapshot {
        // Get all voxels from the engine
        const allVoxels = this.voxelEngine.getAllVoxels();
        const voxelMap = new Map<string, { x: number; y: number; z: number; type: VoxelType }>();
        
        for (const voxel of allVoxels) {
            const key = `${voxel.x},${voxel.y},${voxel.z}`;
            voxelMap.set(key, { ...voxel });
        }
        
        // Get current selection (will be set externally)
        const selection = this.currentSelection ? [...this.currentSelection] : [];
        
        return {
            voxels: voxelMap,
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
        // First, clear all existing voxels
        const currentVoxels = this.voxelEngine.getAllVoxels();
        for (const voxel of currentVoxels) {
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR, false);
        }
        
        // Then restore voxels from snapshot
        for (const [key, voxel] of snapshot.voxels) {
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, voxel.type, false);
        }
        
        // Update rendering
        this.voxelEngine.updateInstances();
        
        // Restore selection
        if (this.selectionCallback) {
            this.selectionCallback(snapshot.selection);
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
            this.undoStack.reduce((sum, snapshot) => sum + snapshot.voxels.size, 0) +
            this.redoStack.reduce((sum, snapshot) => sum + snapshot.voxels.size, 0);
        
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