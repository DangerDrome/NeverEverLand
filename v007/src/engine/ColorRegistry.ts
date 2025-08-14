import { VoxelType } from '../types';

/**
 * ColorRegistry manages the mapping between colors and VoxelTypes.
 * Once a color is assigned a VoxelType, it never changes.
 * This ensures voxels keep their original colors forever.
 */
export class ColorRegistry {
    private static instance: ColorRegistry;
    private colorToTypeMap: Map<string, VoxelType> = new Map();
    private typeToColorMap: Map<VoxelType, string> = new Map();
    private nextAvailableType: number = VoxelType.CUSTOM_1;
    
    // Maximum custom color slots (we'll expand VoxelType enum to have more)
    private static readonly MAX_CUSTOM_TYPES = 256; // CUSTOM_1 through CUSTOM_256
    
    private constructor() {
        // Initialize with default mappings for standard voxel types
        this.typeToColorMap.set(VoxelType.AIR, '#000000');
        this.typeToColorMap.set(VoxelType.GRASS, '#90EE90');
        this.typeToColorMap.set(VoxelType.DIRT, '#8B6914');
        this.typeToColorMap.set(VoxelType.STONE, '#696969');
        this.typeToColorMap.set(VoxelType.WOOD, '#DEB887');
        this.typeToColorMap.set(VoxelType.LEAVES, '#32CD32');
        this.typeToColorMap.set(VoxelType.WATER, '#87CEEB');
        this.typeToColorMap.set(VoxelType.SAND, '#FFE4B5');
        this.typeToColorMap.set(VoxelType.SNOW, '#F0F8FF');
        this.typeToColorMap.set(VoxelType.ICE, '#87CEEB');
    }
    
    static getInstance(): ColorRegistry {
        if (!ColorRegistry.instance) {
            ColorRegistry.instance = new ColorRegistry();
        }
        return ColorRegistry.instance;
    }
    
    /**
     * Get or create a VoxelType for a given color.
     * If the color already has a type, return it.
     * Otherwise, assign a new type.
     */
    getOrCreateVoxelType(hexColor: string): VoxelType | null {
        // Normalize color to uppercase
        const normalizedColor = hexColor.toUpperCase();
        
        // Check if this color already has a type
        const existingType = this.colorToTypeMap.get(normalizedColor);
        if (existingType !== undefined) {
            return existingType;
        }
        
        // Check if we have available slots
        if (this.nextAvailableType > VoxelType.CUSTOM_1 + ColorRegistry.MAX_CUSTOM_TYPES - 1) {
            console.error('No more custom color slots available!');
            return null;
        }
        
        // Assign new type
        const newType = this.nextAvailableType as VoxelType;
        this.colorToTypeMap.set(normalizedColor, newType);
        this.typeToColorMap.set(newType, normalizedColor);
        
        // Update VoxelRenderer and AssetPreviewScene with the new color
        // This adds the color definition to the VOXEL_TYPES object
        if ((window as any).VoxelRenderer) {
            (window as any).VoxelRenderer.updateCustomColors([{
                hex: normalizedColor,
                voxelType: newType
            }]);
        }
        if ((window as any).AssetPreviewScene) {
            (window as any).AssetPreviewScene.updateCustomColors([{
                hex: normalizedColor,
                voxelType: newType
            }]);
        }
        
        this.nextAvailableType++;
        
        console.log(`Registered new color ${normalizedColor} as VoxelType ${newType}`);
        return newType;
    }
    
    /**
     * Get the color for a given VoxelType
     */
    getColor(type: VoxelType): string | null {
        return this.typeToColorMap.get(type) || null;
    }
    
    /**
     * Get the VoxelType for a given color (if it exists)
     */
    getVoxelType(hexColor: string): VoxelType | null {
        const normalizedColor = hexColor.toUpperCase();
        return this.colorToTypeMap.get(normalizedColor) || null;
    }
    
    /**
     * Get statistics about color usage
     */
    getStats(): { totalColors: number; availableSlots: number } {
        return {
            totalColors: this.colorToTypeMap.size,
            availableSlots: ColorRegistry.MAX_CUSTOM_TYPES - (this.nextAvailableType - VoxelType.CUSTOM_1)
        };
    }
}