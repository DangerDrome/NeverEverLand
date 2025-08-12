import * as THREE from 'three';
import { VoxelRenderer } from './VoxelRenderer';
import { VoxelType, VoxelPosition, RaycastHit } from '../types';
import { UndoRedoManager } from './UndoRedoManager';

export { VoxelType };

export class VoxelEngine {
    private scene: THREE.Scene;
    private voxelSize: number;
    private voxels: Map<string, VoxelType>;
    private voxelsByType: Map<VoxelType, Set<string>>;
    private renderer: VoxelRenderer;
    private undoRedoManager: UndoRedoManager;
    
    constructor(scene: THREE.Scene, showWireframe = true, voxelSize = 0.1) {
        this.scene = scene;
        this.voxelSize = voxelSize; // Current voxel size for the world
        
        // Simple voxel storage
        this.voxels = new Map(); // key: "x,y,z" string, value: voxel type
        this.voxelsByType = new Map(); // key: voxel type, value: Set of position strings
        
        // Voxel renderer handles all rendering
        this.renderer = new VoxelRenderer(scene, this.voxelSize, showWireframe);
        
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
        
        const key = this.positionKey(x, y, z);
        const oldType = this.voxels.get(key) || VoxelType.AIR;
        
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
        
        // Update voxels map
        if (type === VoxelType.AIR) {
            this.voxels.delete(key);
        } else {
            this.voxels.set(key, type);
        }
        
        // Update voxelsByType map
        if (oldType !== VoxelType.AIR) {
            const oldTypeSet = this.voxelsByType.get(oldType);
            if (oldTypeSet) {
                oldTypeSet.delete(key);
            }
        }
        
        if (type !== VoxelType.AIR) {
            if (!this.voxelsByType.has(type)) {
                this.voxelsByType.set(type, new Set());
            }
            this.voxelsByType.get(type)!.add(key);
        }
        
        return true;
    }
    
    // Get voxel at position
    getVoxel(x: number, y: number, z: number): VoxelType {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        
        const key = this.positionKey(x, y, z);
        return this.voxels.get(key) || VoxelType.AIR;
    }
    
    // Update all instance buffers
    updateInstances(): void {
        // Use the new renderer
        this.renderer.updateFromVoxelsByType(this.voxelsByType);
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
            const voxelType = this.getVoxel(currentVoxel.x, currentVoxel.y, currentVoxel.z);
            if (voxelType !== VoxelType.AIR) {
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
                    y: currentVoxel.y + normal.y,
                    z: currentVoxel.z + normal.z
                };
                
                return {
                    voxelPos: currentVoxel,
                    adjacentPos: adjacentPos,
                    point: point,
                    normal: new THREE.Vector3(normal.x, normal.y, normal.z),
                    distance: t
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
        
        // If no voxel hit, check ground plane at y=0
        if (origin.y > 0 && direction.y < 0) {
            const t = -origin.y / direction.y;
            const point = origin.clone().add(direction.clone().multiplyScalar(t));
            
            // Calculate voxel position at ground intersection
            // Use Math.floor to get consistent voxel grid positions
            const voxelX = Math.floor(point.x / this.voxelSize);
            const voxelZ = Math.floor(point.z / this.voxelSize);
            
            // Adjust to place voxels on top of ground (y=0)
            return {
                voxelPos: {
                    x: voxelX,
                    y: -1,
                    z: voxelZ
                },
                adjacentPos: {
                    x: voxelX,
                    y: 0,
                    z: voxelZ
                },
                point: point,
                normal: new THREE.Vector3(0, 1, 0),
                distance: t
            };
        }
        
        return null;
    }
    
    // Get total voxel count
    getVoxelCount(): number {
        return this.voxels.size;
    }
    
    // Export voxel data for saving
    exportVoxels(): any {
        const voxelData: any = {
            version: '1.0',
            timestamp: Date.now(),
            voxelSize: this.voxelSize,
            voxels: {}
        };
        
        // Export all voxels by type
        for (const [type, positions] of this.voxelsByType.entries()) {
            if (type !== VoxelType.AIR && positions.size > 0) {
                voxelData.voxels[type] = Array.from(positions);
            }
        }
        
        return voxelData;
    }
    
    // Import voxel data from file
    importVoxels(data: any): void {
        if (!data || !data.voxels) {
            throw new Error('Invalid voxel data format');
        }
        
        // Clear existing voxels
        this.clear();
        
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
        
        console.log(`Imported ${this.getVoxelCount()} voxels from file`);
    }

    // Clear all voxels
    clear(): void {
        this.voxels.clear();
        this.voxelsByType.clear();
        
        // Re-initialize type maps
        for (const type of Object.values(VoxelType)) {
            if (typeof type === 'number') {
                this.voxelsByType.set(type, new Set());
            }
        }
        
        this.renderer.clear();
        
        // Clear undo history when clearing all voxels
        this.undoRedoManager.clear();
    }
    
    // Get bounds of all voxels
    getBounds(): { min: VoxelPosition; max: VoxelPosition } {
        let min = { x: Infinity, y: Infinity, z: Infinity };
        let max = { x: -Infinity, y: -Infinity, z: -Infinity };
        
        for (const posKey of this.voxels.keys()) {
            const { x, y, z } = this.parsePositionKey(posKey);
            min.x = Math.min(min.x, x);
            min.y = Math.min(min.y, y);
            min.z = Math.min(min.z, z);
            max.x = Math.max(max.x, x);
            max.y = Math.max(max.y, y);
            max.z = Math.max(max.z, z);
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
    }
    
    // Get edge display state
    getShowEdges(): boolean {
        return this.renderer.getShowEdges();
    }
    
    // Get all voxels in the world
    getAllVoxels(): Array<{ x: number; y: number; z: number; type: VoxelType }> {
        const allVoxels: Array<{ x: number; y: number; z: number; type: VoxelType }> = [];
        
        // Iterate through all stored voxels
        for (const [key, type] of this.voxels.entries()) {
            if (type !== VoxelType.AIR) {
                const pos = this.parsePositionKey(key);
                allVoxels.push({
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    type: type
                });
            }
        }
        
        return allVoxels;
    }
}