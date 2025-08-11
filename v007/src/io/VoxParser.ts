import { VoxelType } from '../types';

/**
 * VOX file format parser for MagicaVoxel .vox files
 * Based on MagicaVoxel file format specification
 * https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt
 */

// VOX file structures
interface VoxChunk {
    id: string;
    contentSize: number;
    childrenSize: number;
    content: ArrayBuffer;
}

interface VoxSize {
    x: number;
    y: number;
    z: number;
}

interface VoxVoxel {
    x: number;
    y: number;
    z: number;
    colorIndex: number;
}

interface VoxColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

interface VoxModel {
    size: VoxSize;
    voxels: VoxVoxel[];
}

interface VoxData {
    version: number;
    models: VoxModel[];
    palette: VoxColor[];
}

export class VoxParser {
    private dataView: DataView | null = null;
    private offset: number = 0;
    
    /**
     * Parse a VOX file from an ArrayBuffer
     */
    async parseVoxFile(buffer: ArrayBuffer): Promise<VoxData> {
        this.dataView = new DataView(buffer);
        this.offset = 0;
        
        // Check VOX file header
        const magic = this.readString(4);
        if (magic !== 'VOX ') {
            throw new Error('Invalid VOX file: incorrect magic number');
        }
        
        // Read version
        const version = this.readInt32();
        console.log(`VOX file version: ${version}`);
        
        // Read MAIN chunk
        const mainChunk = this.readChunk();
        if (mainChunk.id !== 'MAIN') {
            throw new Error('Invalid VOX file: expected MAIN chunk');
        }
        
        // Parse children chunks
        const models: VoxModel[] = [];
        let palette: VoxColor[] | null = null;
        let currentModel: Partial<VoxModel> = {};
        
        // Process all chunks in the main chunk
        const endOffset = this.offset + mainChunk.childrenSize;
        while (this.offset < endOffset) {
            const chunk = this.readChunk();
            
            switch (chunk.id) {
                case 'SIZE':
                    currentModel.size = this.parseSizeChunk(chunk);
                    break;
                    
                case 'XYZI':
                    currentModel.voxels = this.parseVoxelChunk(chunk);
                    // Complete model when we have both size and voxels
                    if (currentModel.size && currentModel.voxels) {
                        models.push(currentModel as VoxModel);
                        currentModel = {};
                    }
                    break;
                    
                case 'RGBA':
                    palette = this.parsePaletteChunk(chunk);
                    break;
                    
                default:
                    // Skip unknown chunks
                    console.log(`Skipping unknown chunk: ${chunk.id}`);
            }
        }
        
        // Use default palette if none provided
        if (!palette) {
            palette = this.getDefaultPalette();
        }
        
        return {
            version,
            models,
            palette
        };
    }
    
    /**
     * Read a chunk from the file
     */
    private readChunk(): VoxChunk {
        const id = this.readString(4);
        const contentSize = this.readInt32();
        const childrenSize = this.readInt32();
        
        // Read content bytes
        const content = new ArrayBuffer(contentSize);
        const contentView = new Uint8Array(content);
        const sourceView = new Uint8Array(this.dataView!.buffer, this.offset, contentSize);
        contentView.set(sourceView);
        this.offset += contentSize;
        
        return {
            id,
            contentSize,
            childrenSize,
            content
        };
    }
    
    /**
     * Parse SIZE chunk
     */
    private parseSizeChunk(chunk: VoxChunk): VoxSize {
        const view = new DataView(chunk.content);
        return {
            x: view.getInt32(0, true),
            y: view.getInt32(4, true),
            z: view.getInt32(8, true)
        };
    }
    
    /**
     * Parse XYZI chunk (voxel data)
     */
    private parseVoxelChunk(chunk: VoxChunk): VoxVoxel[] {
        const view = new DataView(chunk.content);
        const numVoxels = view.getInt32(0, true);
        const voxels: VoxVoxel[] = [];
        
        for (let i = 0; i < numVoxels; i++) {
            const offset = 4 + i * 4;
            voxels.push({
                x: view.getUint8(offset),
                y: view.getUint8(offset + 1),
                z: view.getUint8(offset + 2),
                colorIndex: view.getUint8(offset + 3)
            });
        }
        
        return voxels;
    }
    
    /**
     * Parse RGBA chunk (palette)
     */
    private parsePaletteChunk(chunk: VoxChunk): VoxColor[] {
        const view = new DataView(chunk.content);
        const palette: VoxColor[] = [];
        
        // VOX palette has 256 colors (indices 1-255, 0 is reserved)
        for (let i = 0; i < 256; i++) {
            const offset = i * 4;
            if (offset < chunk.content.byteLength) {
                palette.push({
                    r: view.getUint8(offset),
                    g: view.getUint8(offset + 1),
                    b: view.getUint8(offset + 2),
                    a: view.getUint8(offset + 3)
                });
            }
        }
        
        return palette;
    }
    
    /**
     * Get default MagicaVoxel palette
     */
    private getDefaultPalette(): VoxColor[] {
        // Default palette colors from MagicaVoxel
        const defaultColors = [
            0x00000000, 0xffffffff, 0xffccffff, 0xff99ffff, 0xff66ffff, 0xff33ffff, 0xff00ffff, 0xffffccff, 
            0xffccccff, 0xff99ccff, 0xff66ccff, 0xff33ccff, 0xff00ccff, 0xffff99ff, 0xffcc99ff, 0xff9999ff,
            0xff6699ff, 0xff3399ff, 0xff0099ff, 0xffff66ff, 0xffcc66ff, 0xff9966ff, 0xff6666ff, 0xff3366ff,
            0xff0066ff, 0xffff33ff, 0xffcc33ff, 0xff9933ff, 0xff6633ff, 0xff3333ff, 0xff0033ff, 0xffff00ff,
            0xffcc00ff, 0xff9900ff, 0xff6600ff, 0xff3300ff, 0xff0000ff, 0xffffffcc, 0xffccffcc, 0xff99ffcc,
            0xff66ffcc, 0xff33ffcc, 0xff00ffcc, 0xffffcccc, 0xffcccccc, 0xff99cccc, 0xff66cccc, 0xff33cccc,
            0xff00cccc, 0xffff99cc, 0xffcc99cc, 0xff9999cc, 0xff6699cc, 0xff3399cc, 0xff0099cc, 0xffff66cc,
            0xffcc66cc, 0xff9966cc, 0xff6666cc, 0xff3366cc, 0xff0066cc, 0xffff33cc, 0xffcc33cc, 0xff9933cc,
            0xff6633cc, 0xff3333cc, 0xff0033cc, 0xffff00cc, 0xffcc00cc, 0xff9900cc, 0xff6600cc, 0xff3300cc,
            0xff0000cc, 0xffffff99, 0xffccff99, 0xff99ff99, 0xff66ff99, 0xff33ff99, 0xff00ff99, 0xffffcc99,
            0xffcccc99, 0xff99cc99, 0xff66cc99, 0xff33cc99, 0xff00cc99, 0xffff9999, 0xffcc9999, 0xff999999,
            0xff669999, 0xff339999, 0xff009999, 0xffff6699, 0xffcc6699, 0xff996699, 0xff666699, 0xff336699,
            0xff006699, 0xffff3399, 0xffcc3399, 0xff993399, 0xff663399, 0xff333399, 0xff003399, 0xffff0099,
            0xffcc0099, 0xff990099, 0xff660099, 0xff330099, 0xff000099, 0xffffff66, 0xffccff66, 0xff99ff66,
            0xff66ff66, 0xff33ff66, 0xff00ff66, 0xffffcc66, 0xffcccc66, 0xff99cc66, 0xff66cc66, 0xff33cc66,
            0xff00cc66, 0xffff9966, 0xffcc9966, 0xff999966, 0xff669966, 0xff339966, 0xff009966, 0xffff6666,
            0xffcc6666, 0xff996666, 0xff666666, 0xff336666, 0xff006666, 0xffff3366, 0xffcc3366, 0xff993366,
            0xff663366, 0xff333366, 0xff003366, 0xffff0066, 0xffcc0066, 0xff990066, 0xff660066, 0xff330066,
            0xff000066, 0xffffff33, 0xffccff33, 0xff99ff33, 0xff66ff33, 0xff33ff33, 0xff00ff33, 0xffffcc33,
            0xffcccc33, 0xff99cc33, 0xff66cc33, 0xff33cc33, 0xff00cc33, 0xffff9933, 0xffcc9933, 0xff999933,
            0xff669933, 0xff339933, 0xff009933, 0xffff6633, 0xffcc6633, 0xff996633, 0xff666633, 0xff336633,
            0xff006633, 0xffff3333, 0xffcc3333, 0xff993333, 0xff663333, 0xff333333, 0xff003333, 0xffff0033,
            0xffcc0033, 0xff990033, 0xff660033, 0xff330033, 0xff000033, 0xffffff00, 0xffccff00, 0xff99ff00,
            0xff66ff00, 0xff33ff00, 0xff00ff00, 0xffffcc00, 0xffcccc00, 0xff99cc00, 0xff66cc00, 0xff33cc00,
            0xff00cc00, 0xffff9900, 0xffcc9900, 0xff999900, 0xff669900, 0xff339900, 0xff009900, 0xffff6600,
            0xffcc6600, 0xff996600, 0xff666600, 0xff336600, 0xff006600, 0xffff3300, 0xffcc3300, 0xff993300,
            0xff663300, 0xff333300, 0xff003300, 0xffff0000, 0xffcc0000, 0xff990000, 0xff660000, 0xff330000,
            0xff0000ee, 0xff0000dd, 0xff0000bb, 0xff0000aa, 0xff000088, 0xff000077, 0xff000055, 0xff000044,
            0xff000022, 0xff000011, 0xff00ee00, 0xff00dd00, 0xff00bb00, 0xff00aa00, 0xff008800, 0xff007700,
            0xff005500, 0xff004400, 0xff002200, 0xff001100, 0xffee0000, 0xffdd0000, 0xffbb0000, 0xffaa0000,
            0xff880000, 0xff770000, 0xff550000, 0xff440000, 0xff220000, 0xff110000, 0xffeeeeee, 0xffdddddd,
            0xffbbbbbb, 0xffaaaaaa, 0xff888888, 0xff777777, 0xff555555, 0xff444444, 0xff222222, 0xff111111
        ];
        
        return defaultColors.map(c => ({
            r: (c >> 24) & 0xff,
            g: (c >> 16) & 0xff,
            b: (c >> 8) & 0xff,
            a: c & 0xff
        }));
    }
    
    /**
     * Read a string from the buffer
     */
    private readString(length: number): string {
        const bytes = new Uint8Array(this.dataView!.buffer, this.offset, length);
        this.offset += length;
        return String.fromCharCode(...bytes);
    }
    
    /**
     * Read a 32-bit integer (little endian)
     */
    private readInt32(): number {
        const value = this.dataView!.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }
    
    /**
     * Convert VOX data to our voxel engine format
     * Maps VOX colors to our VoxelType enum
     */
    convertToVoxelData(voxData: VoxData): Map<string, VoxelType> {
        const voxels = new Map<string, VoxelType>();
        
        for (const model of voxData.models) {
            for (const voxel of model.voxels) {
                // Convert from VOX coordinate system (Z-up) to Three.js (Y-up)
                const x = voxel.x - Math.floor(model.size.x / 2);
                const y = voxel.z; // Z becomes Y
                const z = voxel.y - Math.floor(model.size.y / 2);
                
                // Map color to voxel type
                const color = voxData.palette[voxel.colorIndex - 1]; // -1 because index 0 is reserved
                const voxelType = this.colorToVoxelType(color);
                
                const key = `${x},${y},${z}`;
                voxels.set(key, voxelType);
            }
        }
        
        return voxels;
    }
    
    /**
     * Map a color to the closest VoxelType
     */
    private colorToVoxelType(color: VoxColor): VoxelType {
        // Simple color matching - can be improved with better heuristics
        const rgb = (color.r << 16) | (color.g << 8) | color.b;
        
        // Check for common colors
        if (color.g > 200 && color.r < 150 && color.b < 150) {
            return VoxelType.GRASS; // Green
        } else if (color.r > 100 && color.g > 60 && color.b < 50) {
            return VoxelType.DIRT; // Brown
        } else if (color.r > 200 && color.g > 180 && color.b > 140) {
            return VoxelType.SAND; // Sandy
        } else if (color.b > 200 && color.r < 150 && color.g < 200) {
            return VoxelType.WATER; // Blue
        } else if (color.r > 200 && color.g > 200 && color.b > 200) {
            return VoxelType.SNOW; // White
        } else if (Math.abs(color.r - color.g) < 20 && Math.abs(color.g - color.b) < 20) {
            return VoxelType.STONE; // Gray
        } else if (color.r > 150 && color.g > 100 && color.b < 100) {
            return VoxelType.WOOD; // Wood brown
        } else if (color.g > color.r && color.g > color.b) {
            return VoxelType.LEAVES; // Green
        } else {
            return VoxelType.STONE; // Default
        }
    }
}