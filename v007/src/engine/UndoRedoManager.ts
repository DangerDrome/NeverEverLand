import { VoxelType, VoxelEngine } from './VoxelEngine';
import { VoxelPosition } from '../types';

interface VoxelOperation {
    type: 'add' | 'remove';
    position: VoxelPosition;
    voxelType: VoxelType;
    previousType: VoxelType;
}

interface OperationGroup {
    operations: VoxelOperation[];
    timestamp: number;
}

export class UndoRedoManager {
    private undoStack: OperationGroup[] = [];
    private redoStack: OperationGroup[] = [];
    private currentGroup: VoxelOperation[] = [];
    private lastOperationTime: number = 0;
    private readonly maxHistorySize: number;
    private readonly groupingTimeMs: number = 100; // Group operations within 100ms
    private voxelEngine: VoxelEngine;
    private groupTimer: NodeJS.Timeout | null = null;
    
    constructor(voxelEngine: VoxelEngine, maxHistorySize: number = 100) {
        this.voxelEngine = voxelEngine;
        this.maxHistorySize = maxHistorySize;
    }
    
    /**
     * Record a voxel operation
     */
    recordOperation(
        position: VoxelPosition, 
        newType: VoxelType, 
        previousType: VoxelType
    ): void {
        const operation: VoxelOperation = {
            type: newType === VoxelType.AIR ? 'remove' : 'add',
            position: { ...position }, // Clone position to avoid reference issues
            voxelType: newType,
            previousType: previousType
        };
        
        // Add to current group
        this.currentGroup.push(operation);
        
        // Clear any existing timer
        if (this.groupTimer) {
            clearTimeout(this.groupTimer);
        }
        
        // Set timer to finalize group
        this.groupTimer = setTimeout(() => {
            this.finalizeGroup();
        }, this.groupingTimeMs);
        
        // Clear redo stack when new operation is performed
        this.redoStack = [];
    }
    
    /**
     * Finalize the current group of operations
     */
    private finalizeGroup(): void {
        if (this.currentGroup.length === 0) return;
        
        // Create operation group
        const group: OperationGroup = {
            operations: [...this.currentGroup],
            timestamp: Date.now()
        };
        
        // Add to undo stack
        this.undoStack.push(group);
        
        // Limit history size
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift(); // Remove oldest
        }
        
        // Clear current group
        this.currentGroup = [];
        this.groupTimer = null;
    }
    
    /**
     * Force finalize any pending operations
     */
    finalizePendingOperations(): void {
        if (this.groupTimer) {
            clearTimeout(this.groupTimer);
            this.groupTimer = null;
        }
        this.finalizeGroup();
    }
    
    /**
     * Undo the last operation group
     */
    undo(): boolean {
        // Finalize any pending operations first
        this.finalizePendingOperations();
        
        if (this.undoStack.length === 0) return false;
        
        const group = this.undoStack.pop()!;
        
        // Apply operations in reverse order
        for (let i = group.operations.length - 1; i >= 0; i--) {
            const op = group.operations[i];
            // Restore previous state without recording undo
            this.voxelEngine.setVoxel(
                op.position.x,
                op.position.y,
                op.position.z,
                op.previousType,
                false // Don't record undo operations
            );
        }
        
        // Update rendering
        this.voxelEngine.updateInstances();
        
        // Add to redo stack
        this.redoStack.push(group);
        
        return true;
    }
    
    /**
     * Redo the last undone operation group
     */
    redo(): boolean {
        if (this.redoStack.length === 0) return false;
        
        const group = this.redoStack.pop()!;
        
        // Apply operations in original order
        for (const op of group.operations) {
            this.voxelEngine.setVoxel(
                op.position.x,
                op.position.y,
                op.position.z,
                op.voxelType,
                false // Don't record undo operations
            );
        }
        
        // Update rendering
        this.voxelEngine.updateInstances();
        
        // Add back to undo stack
        this.undoStack.push(group);
        
        return true;
    }
    
    /**
     * Clear all history
     */
    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
        this.currentGroup = [];
        if (this.groupTimer) {
            clearTimeout(this.groupTimer);
            this.groupTimer = null;
        }
    }
    
    /**
     * Get the number of available undo operations
     */
    getUndoCount(): number {
        return this.undoStack.length + (this.currentGroup.length > 0 ? 1 : 0);
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
        // Rough estimate: each operation takes about 40 bytes
        const totalOperations = 
            this.undoStack.reduce((sum, group) => sum + group.operations.length, 0) +
            this.redoStack.reduce((sum, group) => sum + group.operations.length, 0) +
            this.currentGroup.length;
        
        return totalOperations * 40;
    }
}