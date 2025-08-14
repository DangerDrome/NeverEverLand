import { VoxelType } from '../types';

/**
 * Represents a single layer in the voxel world
 * Each layer maintains its own voxel storage and properties
 */
export class VoxelLayer {
    public id: string;
    public name: string;
    public visible: boolean = true;
    public opacity: number = 1.0;
    public locked: boolean = false;
    
    // Asset editing properties
    public isEditingAsset: boolean = false;
    public editingAssetId?: string;
    public editingAssetType?: VoxelType;
    
    // Voxel storage - same structure as original VoxelEngine
    private voxels: Map<string, VoxelType>;
    private voxelsByType: Map<VoxelType, Set<string>>;
    
    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
        this.voxels = new Map();
        this.voxelsByType = new Map();
        
        // Initialize voxelsByType for all types
        for (const type of Object.values(VoxelType)) {
            if (typeof type === 'number' && type !== VoxelType.AIR) {
                this.voxelsByType.set(type, new Set());
            }
        }
    }
    
    /**
     * Set a voxel in this layer
     */
    setVoxel(key: string, type: VoxelType): boolean {
        const oldType = this.voxels.get(key) || VoxelType.AIR;
        
        // No change needed
        if (oldType === type) return false;
        
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
    
    /**
     * Get voxel type at position
     */
    getVoxel(key: string): VoxelType {
        return this.voxels.get(key) || VoxelType.AIR;
    }
    
    /**
     * Clear all voxels in this layer
     */
    clear(): void {
        this.voxels.clear();
        for (const set of this.voxelsByType.values()) {
            set.clear();
        }
    }
    
    /**
     * Get voxel count in this layer
     */
    getVoxelCount(): number {
        return this.voxels.size;
    }
    
    /**
     * Get all voxels map
     */
    getVoxels(): Map<string, VoxelType> {
        return this.voxels;
    }
    
    /**
     * Get voxels by type map
     */
    getVoxelsByType(): Map<VoxelType, Set<string>> {
        return this.voxelsByType;
    }
    
    /**
     * Export layer data
     */
    exportData(): any {
        const voxelData: any = {};
        
        // Export all voxels by type
        for (const [type, positions] of this.voxelsByType.entries()) {
            if (type !== VoxelType.AIR && positions.size > 0) {
                voxelData[type] = Array.from(positions);
            }
        }
        
        return {
            id: this.id,
            name: this.name,
            visible: this.visible,
            opacity: this.opacity,
            locked: this.locked,
            voxels: voxelData
        };
    }
    
    /**
     * Import layer data
     */
    importData(data: any): void {
        if (data.name) this.name = data.name;
        if (data.visible !== undefined) this.visible = data.visible;
        if (data.opacity !== undefined) this.opacity = data.opacity;
        if (data.locked !== undefined) this.locked = data.locked;
        
        // Clear existing voxels
        this.clear();
        
        // Import voxels
        if (data.voxels) {
            for (const [typeStr, positions] of Object.entries(data.voxels)) {
                const type = parseInt(typeStr) as VoxelType;
                if (type in VoxelType && Array.isArray(positions)) {
                    for (const posKey of positions as string[]) {
                        this.setVoxel(posKey, type);
                    }
                }
            }
        }
    }
}