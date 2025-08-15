import { VoxelType } from '../types';
import * as THREE from 'three';
import { BakedMeshGenerator } from './BakedMeshGenerator';
import { AllFacesBakedMeshGenerator } from './AllFacesBakedMeshGenerator';
import { FixedBakedMeshGenerator } from './FixedBakedMeshGenerator';
import { ActionLogger } from '../ui/ActionLogger';

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
    
    // Baking properties
    public isBaked: boolean = false;
    public bakedOpaqueMesh?: THREE.Mesh;
    public bakedTransparentMesh?: THREE.Mesh;
    private bakedMetadata?: {
        originalVoxelCount: number;
        vertexCount: number;
        faceCount: number;
    };
    private originalVoxelData?: Map<string, VoxelType>; // Store for unbaking
    
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
        // Prevent modifications to baked layers
        if (this.isBaked) {
            ActionLogger.getInstance().log('Cannot modify baked layer. Unbake first.', 2000);
            return false;
        }
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
        // Prevent clearing baked layers
        if (this.isBaked) {
            console.warn('Cannot clear baked layer. Unbake first.');
            return;
        }
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
        // Unbake if necessary
        if (this.isBaked) {
            this.unbake();
        }
        
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
    
    /**
     * Bake layer into optimized mesh geometry
     * Reduces vertex count by 99%+ using greedy meshing
     */
    bake(voxelSize: number = 0.1): void {
        if (this.isBaked) {
            console.warn('Layer is already baked');
            return;
        }
        
        if (this.voxels.size === 0) {
            console.warn('Cannot bake empty layer');
            return;
        }
        
        // Store original voxel data for unbaking
        this.originalVoxelData = new Map(this.voxels);
        
        // Generate optimized meshes
        // Use AllFacesBakedMeshGenerator to create ALL faces (no greedy meshing)
        const generator = new AllFacesBakedMeshGenerator(voxelSize);
        const result = generator.generateOptimizedMesh(this.voxels);
        
        // Store baked meshes and metadata
        this.bakedOpaqueMesh = result.opaqueMesh || undefined;
        this.bakedTransparentMesh = result.transparentMesh || undefined;
        this.bakedMetadata = result.metadata;
        
        // Mark as baked
        this.isBaked = true;
        
        ActionLogger.getInstance().log(`Baked layer '${this.name}': ${result.metadata.originalVoxelCount} voxels → ${result.metadata.faceCount} faces`, 3000);
    }
    
    /**
     * Unbake layer to restore editable voxels
     */
    unbake(): void {
        if (!this.isBaked) {
            console.warn('Layer is not baked');
            return;
        }
        
        if (!this.originalVoxelData) {
            console.error('Cannot unbake: original voxel data missing');
            return;
        }
        
        // Clean up baked meshes
        if (this.bakedOpaqueMesh) {
            this.bakedOpaqueMesh.geometry.dispose();
            if (this.bakedOpaqueMesh.material instanceof THREE.Material) {
                this.bakedOpaqueMesh.material.dispose();
            }
            this.bakedOpaqueMesh = undefined;
        }
        
        if (this.bakedTransparentMesh) {
            this.bakedTransparentMesh.geometry.dispose();
            if (this.bakedTransparentMesh.material instanceof THREE.Material) {
                this.bakedTransparentMesh.material.dispose();
            }
            this.bakedTransparentMesh = undefined;
        }
        
        // Restore original voxel data
        this.voxels = new Map(this.originalVoxelData);
        
        // Rebuild voxelsByType
        this.voxelsByType.clear();
        for (const [key, type] of this.voxels) {
            if (type !== VoxelType.AIR) {
                if (!this.voxelsByType.has(type)) {
                    this.voxelsByType.set(type, new Set());
                }
                this.voxelsByType.get(type)!.add(key);
            }
        }
        
        // Clear baking state
        this.isBaked = false;
        this.originalVoxelData = undefined;
        this.bakedMetadata = undefined;
        
        console.log(`Unbaked layer '${this.name}'`);
    }
    
    /**
     * Get baking metadata
     */
    getBakingMetadata() {
        return this.bakedMetadata;
    }
}