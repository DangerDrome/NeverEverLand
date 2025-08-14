import { VoxelType, VoxelEngine } from './VoxelEngine';
import { VoxelPosition } from '../types';

interface VoxelOperation {
    type: 'add' | 'remove';
    position: VoxelPosition;
    voxelType: VoxelType;
    previousType: VoxelType;
}

interface SelectionOperation {
    type: 'selection';
    previousSelection: Array<{ x: number; y: number; z: number; type: VoxelType }>;
    newSelection: Array<{ x: number; y: number; z: number; type: VoxelType }>;
}

type Operation = VoxelOperation | SelectionOperation;

interface OperationGroup {
    operations: Operation[];
    timestamp: number;
}

export class UndoRedoManager {
    private undoStack: OperationGroup[] = [];
    private redoStack: OperationGroup[] = [];
    private currentGroup: Operation[] = [];
    private lastOperationTime: number = 0;
    private readonly maxHistorySize: number;
    private readonly groupingTimeMs: number = 100; // Group operations within 100ms
    private voxelEngine: VoxelEngine;
    private groupTimer: number | null = null;
    private selectionCallback: ((selection: Array<{ x: number; y: number; z: number; type: VoxelType }>) => void) | null = null;
    
    constructor(voxelEngine: VoxelEngine, maxHistorySize: number = 100) {
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
     * Record a selection change as an operation
     */
    recordSelectionChange(
        previousSelection: Array<{ x: number; y: number; z: number; type: VoxelType }>,
        newSelection: Array<{ x: number; y: number; z: number; type: VoxelType }>
    ): void {
        // Don't record if selections are the same
        if (this.selectionsEqual(previousSelection, newSelection)) return;
        
        const operation: SelectionOperation = {
            type: 'selection',
            previousSelection: previousSelection.map(v => ({ ...v })),
            newSelection: newSelection.map(v => ({ ...v }))
        };
        
        // Add to current group
        this.currentGroup.push(operation);
        
        // Clear any existing timer
        if (this.groupTimer) {
            window.clearTimeout(this.groupTimer);
        }
        
        // Set timer to finalize group
        this.groupTimer = window.setTimeout(() => {
            this.finalizeGroup();
        }, this.groupingTimeMs);
        
        // Clear redo stack when new operation is performed
        this.redoStack = [];
    }
    
    private selectionsEqual(a: Array<{ x: number; y: number; z: number; type: VoxelType }>, b: Array<{ x: number; y: number; z: number; type: VoxelType }>): boolean {
        if (a.length !== b.length) return false;
        const aSet = new Set(a.map(v => `${v.x},${v.y},${v.z}`));
        return b.every(v => aSet.has(`${v.x},${v.y},${v.z}`));
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
            window.clearTimeout(this.groupTimer);
        }
        
        // Set timer to finalize group
        this.groupTimer = window.setTimeout(() => {
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
            window.clearTimeout(this.groupTimer);
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
            
            if (op.type === 'selection') {
                // Restore previous selection
                if (this.selectionCallback) {
                    this.selectionCallback(op.previousSelection);
                }
            } else {
                // Restore previous voxel state without recording undo
                this.voxelEngine.setVoxel(
                    op.position.x,
                    op.position.y,
                    op.position.z,
                    op.previousType,
                    false // Don't record undo operations
                );
            }
        }
        
        // Update rendering
        this.voxelEngine.updateInstances();
        
        // Add to redo stack
        this.redoStack.push(group);
        
        // Log the undo operation
        import('../ui/ActionLogger').then(({ ActionLogger }) => {
            const logger = ActionLogger.getInstance();
            logger.log(ActionLogger.actions.undo());
        });
        
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
            if (op.type === 'selection') {
                // Restore new selection
                if (this.selectionCallback) {
                    this.selectionCallback(op.newSelection);
                }
            } else {
                this.voxelEngine.setVoxel(
                    op.position.x,
                    op.position.y,
                    op.position.z,
                    op.voxelType,
                    false // Don't record undo operations
                );
            }
        }
        
        // Update rendering
        this.voxelEngine.updateInstances();
        
        // Add back to undo stack
        this.undoStack.push(group);
        
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
        this.currentGroup = [];
        if (this.groupTimer) {
            window.clearTimeout(this.groupTimer);
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