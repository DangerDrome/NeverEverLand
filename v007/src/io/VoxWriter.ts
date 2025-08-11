import { VoxelType } from '../types';

/**
 * VOX file format writer for MagicaVoxel .vox files
 * Exports voxel data to MagicaVoxel format
 */

interface VoxelData {
    x: number;
    y: number;
    z: number;
    type: VoxelType;
}

export class VoxWriter {
    private buffer: ArrayBuffer;
    private view: DataView;
    private offset: number;
    
    // Color palette for voxel types (RGBA format)
    private readonly typeColors: Record<VoxelType, number> = {
        [VoxelType.AIR]: 0x00000000,
        [VoxelType.GRASS]: 0x90EE90FF,
        [VoxelType.DIRT]: 0x8B6914FF,
        [VoxelType.STONE]: 0x696969FF,
        [VoxelType.WOOD]: 0xDEB887FF,
        [VoxelType.LEAVES]: 0x32CD32FF,
        [VoxelType.WATER]: 0x00CED1CC,  // Semi-transparent
        [VoxelType.SAND]: 0xFFE4B5FF,
        [VoxelType.SNOW]: 0xF0F8FFFF,
        [VoxelType.ICE]: 0x87CEEBE6     // Semi-transparent
    };
    
    constructor() {
        // Start with 10MB buffer (can grow if needed)
        this.buffer = new ArrayBuffer(10 * 1024 * 1024);
        this.view = new DataView(this.buffer);
        this.offset = 0;
    }
    
    /**
     * Create a VOX file from voxel data
     */
    createVoxFile(voxelsByType: Map<VoxelType, Set<string>>): ArrayBuffer {
        this.offset = 0;
        
        // Write VOX header
        this.writeString('VOX ');
        this.writeInt32(150); // Version 150
        
        // Calculate bounds and collect all voxels
        const allVoxels: VoxelData[] = [];
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            
            for (const posKey of positions) {
                const [x, y, z] = posKey.split(',').map(Number);
                allVoxels.push({ x, y, z, type });
                
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                minZ = Math.min(minZ, z);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                maxZ = Math.max(maxZ, z);
            }
        }
        
        // Calculate model size
        const sizeX = Math.max(1, maxX - minX + 1);
        const sizeY = Math.max(1, maxY - minY + 1);
        const sizeZ = Math.max(1, maxZ - minZ + 1);
        
        // Ensure size fits in VOX limits (256x256x256)
        if (sizeX > 256 || sizeY > 256 || sizeZ > 256) {
            console.warn('Model exceeds VOX size limits (256x256x256), will be truncated');
        }
        
        // Create color palette and map voxel types to indices
        const palette = this.createPalette();
        const typeToIndex = this.createTypeToIndexMap();
        
        // Prepare voxel data with adjusted coordinates
        const voxelData: { x: number; y: number; z: number; index: number }[] = [];
        for (const voxel of allVoxels) {
            // Adjust coordinates to be relative to min bounds
            // Convert from Y-up (Three.js) to Z-up (MagicaVoxel)
            const adjX = Math.min(255, Math.max(0, voxel.x - minX));
            const adjY = Math.min(255, Math.max(0, voxel.z - minZ)); // Z becomes Y
            const adjZ = Math.min(255, Math.max(0, voxel.y - minY)); // Y becomes Z
            
            voxelData.push({
                x: adjX,
                y: adjY,
                z: adjZ,
                index: typeToIndex.get(voxel.type) || 1
            });
        }
        
        // Calculate chunk sizes
        const sizeChunkContent = 12; // 3 int32s for x, y, z
        const voxelChunkContent = 4 + voxelData.length * 4; // numVoxels + voxel data
        const paletteChunkContent = 256 * 4; // 256 RGBA colors
        
        const mainChunkChildren = 
            12 + sizeChunkContent +      // SIZE chunk
            12 + voxelChunkContent +      // XYZI chunk
            12 + paletteChunkContent;     // RGBA chunk
        
        // Write MAIN chunk
        this.writeString('MAIN');
        this.writeInt32(0); // No content
        this.writeInt32(mainChunkChildren); // Children size
        
        // Write SIZE chunk
        this.writeString('SIZE');
        this.writeInt32(sizeChunkContent);
        this.writeInt32(0); // No children
        this.writeInt32(Math.min(256, sizeX));
        this.writeInt32(Math.min(256, sizeZ)); // Z becomes Y in VOX
        this.writeInt32(Math.min(256, sizeY)); // Y becomes Z in VOX
        
        // Write XYZI chunk (voxel data)
        this.writeString('XYZI');
        this.writeInt32(voxelChunkContent);
        this.writeInt32(0); // No children
        this.writeInt32(voxelData.length); // Number of voxels
        
        for (const voxel of voxelData) {
            this.writeByte(voxel.x);
            this.writeByte(voxel.y);
            this.writeByte(voxel.z);
            this.writeByte(voxel.index);
        }
        
        // Write RGBA chunk (palette)
        this.writeString('RGBA');
        this.writeInt32(paletteChunkContent);
        this.writeInt32(0); // No children
        
        for (const color of palette) {
            this.writeByte((color >> 24) & 0xFF); // R
            this.writeByte((color >> 16) & 0xFF); // G
            this.writeByte((color >> 8) & 0xFF);  // B
            this.writeByte(color & 0xFF);         // A
        }
        
        // Return the used portion of the buffer
        return this.buffer.slice(0, this.offset);
    }
    
    /**
     * Create color palette for VOX file
     */
    private createPalette(): number[] {
        const palette: number[] = [];
        
        // VOX palette has 256 entries
        // We'll put our voxel type colors at the beginning
        const typeOrder = [
            VoxelType.GRASS,
            VoxelType.DIRT,
            VoxelType.STONE,
            VoxelType.WOOD,
            VoxelType.LEAVES,
            VoxelType.WATER,
            VoxelType.SAND,
            VoxelType.SNOW,
            VoxelType.ICE
        ];
        
        // Add our voxel type colors
        for (const type of typeOrder) {
            palette.push(this.typeColors[type]);
        }
        
        // Fill rest with default palette colors
        while (palette.length < 256) {
            // Generate a gradient of colors
            const t = palette.length / 256;
            const r = Math.floor(255 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2)));
            const g = Math.floor(255 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 + 2)));
            const b = Math.floor(255 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 + 4)));
            palette.push((r << 24) | (g << 16) | (b << 8) | 0xFF);
        }
        
        return palette;
    }
    
    /**
     * Create mapping from VoxelType to palette index
     */
    private createTypeToIndexMap(): Map<VoxelType, number> {
        const map = new Map<VoxelType, number>();
        
        // Map types to palette indices (1-based, 0 is reserved in VOX)
        map.set(VoxelType.GRASS, 1);
        map.set(VoxelType.DIRT, 2);
        map.set(VoxelType.STONE, 3);
        map.set(VoxelType.WOOD, 4);
        map.set(VoxelType.LEAVES, 5);
        map.set(VoxelType.WATER, 6);
        map.set(VoxelType.SAND, 7);
        map.set(VoxelType.SNOW, 8);
        map.set(VoxelType.ICE, 9);
        
        return map;
    }
    
    /**
     * Write a string to the buffer
     */
    private writeString(str: string): void {
        for (let i = 0; i < str.length; i++) {
            this.view.setUint8(this.offset++, str.charCodeAt(i));
        }
    }
    
    /**
     * Write a 32-bit integer (little endian)
     */
    private writeInt32(value: number): void {
        this.view.setInt32(this.offset, value, true);
        this.offset += 4;
    }
    
    /**
     * Write a byte
     */
    private writeByte(value: number): void {
        this.view.setUint8(this.offset++, value);
    }
}