import { GridCoordinate, WorldPosition } from '../types';

/**
 * Voxel system constants
 */
export const VOXEL_SIZE = 0.05; // 5cm voxels
export const GRID_SIZE = 1.0;   // 1m grid cells
export const VOXELS_PER_GRID = GRID_SIZE / VOXEL_SIZE; // 20 voxels per grid cell
export const CHUNK_SIZE = 16;   // 16x16 grid cells per chunk

/**
 * Types of voxels that can be placed
 */
export enum VoxelType {
  Air = 0,           // Empty space (transparent)
  Grass = 1,         // Grass block (green)
  Dirt = 2,          // Dirt block (brown)
  Stone = 3,         // Stone block (gray)
  Wood = 4,          // Wood block (brown/tan)
  Sand = 5,          // Sand block (yellow)
  Water = 6,         // Water block (blue, translucent)
  Glass = 7,         // Glass block (transparent with edges)
  Metal = 8,         // Metal block (silver)
  Brick = 9,         // Brick block (red)
}

/**
 * Properties for each voxel type
 */
export interface VoxelTypeProperties {
  name: string;
  color: number;        // Three.js color (hex)
  transparent: boolean; // Whether the voxel is see-through
  solid: boolean;       // Whether the voxel blocks movement
  opacity: number;      // Alpha value (0-1)
  texture?: string;     // Optional texture name
}

/**
 * Registry of voxel type properties
 */
export const VOXEL_PROPERTIES: Record<VoxelType, VoxelTypeProperties> = {
  [VoxelType.Air]: {
    name: 'Air',
    color: 0x000000,
    transparent: true,
    solid: false,
    opacity: 0.0,
  },
  [VoxelType.Grass]: {
    name: 'Grass',
    color: 0x4CAF50,
    transparent: false,
    solid: true,
    opacity: 1.0,
  },
  [VoxelType.Dirt]: {
    name: 'Dirt',
    color: 0x8D6E63,
    transparent: false,
    solid: true,
    opacity: 1.0,
  },
  [VoxelType.Stone]: {
    name: 'Stone',
    color: 0x9E9E9E,
    transparent: false,
    solid: true,
    opacity: 1.0,
  },
  [VoxelType.Wood]: {
    name: 'Wood',
    color: 0xD7CCC8,
    transparent: false,
    solid: true,
    opacity: 1.0,
  },
  [VoxelType.Sand]: {
    name: 'Sand',
    color: 0xFFEB3B,
    transparent: false,
    solid: true,
    opacity: 1.0,
  },
  [VoxelType.Water]: {
    name: 'Water',
    color: 0x2196F3,
    transparent: true,
    solid: false,
    opacity: 0.7,
  },
  [VoxelType.Glass]: {
    name: 'Glass',
    color: 0xE1F5FE,
    transparent: true,
    solid: true,
    opacity: 0.3,
  },
  [VoxelType.Metal]: {
    name: 'Metal',
    color: 0x607D8B,
    transparent: false,
    solid: true,
    opacity: 1.0,
  },
  [VoxelType.Brick]: {
    name: 'Brick',
    color: 0xF44336,
    transparent: false,
    solid: true,
    opacity: 1.0,
  },
};

/**
 * Local coordinate within a voxel chunk (0-19 for each axis)
 */
export interface VoxelCoordinate {
  readonly x: number; // 0-19 (within chunk)
  readonly y: number; // 0-19 (within chunk)
  readonly z: number; // 0-19 (within chunk)
}

/**
 * Chunk coordinate in the world grid system
 */
export interface ChunkCoordinate {
  readonly x: number; // Chunk X position
  readonly z: number; // Chunk Z position
}

/**
 * Global voxel coordinate in the world
 */
export interface GlobalVoxelCoordinate {
  readonly x: number; // Global voxel X position
  readonly y: number; // Global voxel Y position
  readonly z: number; // Global voxel Z position
}

/**
 * Individual voxel data stored in chunks
 */
export interface VoxelData {
  type: VoxelType;
  metadata?: Record<string, any>; // For custom properties
}

/**
 * Face directions for voxel meshing
 */
export enum VoxelFace {
  Top = 0,    // +Y
  Bottom = 1, // -Y
  North = 2,  // +Z
  South = 3,  // -Z
  East = 4,   // +X
  West = 5,   // -X
}

/**
 * Normal vectors for each face direction
 */
export const FACE_NORMALS: Record<VoxelFace, [number, number, number]> = {
  [VoxelFace.Top]:    [0,  1,  0],
  [VoxelFace.Bottom]: [0, -1,  0],
  [VoxelFace.North]:  [0,  0,  1],
  [VoxelFace.South]:  [0,  0, -1],
  [VoxelFace.East]:   [1,  0,  0],
  [VoxelFace.West]:   [-1, 0,  0],
};

/**
 * Utility functions for voxel coordinate conversion
 */
export class VoxelUtils {
  /**
   * Convert grid coordinate to chunk coordinate
   */
  static gridToChunk(gridCoord: GridCoordinate): ChunkCoordinate {
    return {
      x: Math.floor(gridCoord.x / CHUNK_SIZE),
      z: Math.floor(gridCoord.z / CHUNK_SIZE),
    };
  }

  /**
   * Convert grid coordinate to local voxel coordinate within chunk
   */
  static gridToVoxel(gridCoord: GridCoordinate): VoxelCoordinate {
    const localGridX = gridCoord.x % CHUNK_SIZE;
    const localGridZ = gridCoord.z % CHUNK_SIZE;
    
    return {
      x: localGridX * VOXELS_PER_GRID,
      y: 0, // Default to ground level
      z: localGridZ * VOXELS_PER_GRID,
    };
  }

  /**
   * Convert voxel coordinate to world position
   */
  static voxelToWorld(voxelCoord: GlobalVoxelCoordinate): WorldPosition {
    return {
      x: voxelCoord.x * VOXEL_SIZE,
      y: voxelCoord.y * VOXEL_SIZE,
      z: voxelCoord.z * VOXEL_SIZE,
    };
  }

  /**
   * Convert world position to voxel coordinate
   */
  static worldToVoxel(worldPos: WorldPosition): GlobalVoxelCoordinate {
    return {
      x: Math.floor(worldPos.x / VOXEL_SIZE),
      y: Math.floor(worldPos.y / VOXEL_SIZE),
      z: Math.floor(worldPos.z / VOXEL_SIZE),
    };
  }

  /**
   * Get chunk key for efficient storage
   */
  static getChunkKey(chunkCoord: ChunkCoordinate): string {
    return `${chunkCoord.x},${chunkCoord.z}`;
  }

  /**
   * Get voxel key for efficient storage within chunk
   */
  static getVoxelKey(voxelCoord: VoxelCoordinate): string {
    return `${voxelCoord.x},${voxelCoord.y},${voxelCoord.z}`;
  }

  /**
   * Check if voxel coordinate is within chunk bounds
   */
  static isValidVoxelCoord(voxelCoord: VoxelCoordinate): boolean {
    return voxelCoord.x >= 0 && voxelCoord.x < VOXELS_PER_GRID &&
           voxelCoord.y >= 0 && voxelCoord.y < VOXELS_PER_GRID &&
           voxelCoord.z >= 0 && voxelCoord.z < VOXELS_PER_GRID;
  }

  /**
   * Check if a voxel face should be rendered (if neighbor is transparent)
   */
  static shouldRenderFace(voxelType: VoxelType, neighborType: VoxelType): boolean {
    // Don't render air
    if (voxelType === VoxelType.Air) return false;
    
    // Always render if neighbor is air
    if (neighborType === VoxelType.Air) return true;
    
    // Don't render face if neighbor is opaque and same type
    const voxelProps = VOXEL_PROPERTIES[voxelType];
    const neighborProps = VOXEL_PROPERTIES[neighborType];
    
    if (!neighborProps.transparent && voxelType === neighborType) {
      return false;
    }
    
    // Render if this voxel is opaque and neighbor is transparent
    return !voxelProps.transparent && neighborProps.transparent;
  }
}

/**
 * Color mapping for voxel types (for minimap display)
 * Converts Three.js hex colors to CSS hex strings
 */
export const VoxelTypeColors: { [key in VoxelType]: string } = {
  [VoxelType.Air]: 'transparent',
  [VoxelType.Grass]: '#4CAF50',
  [VoxelType.Dirt]: '#8D6E63',
  [VoxelType.Stone]: '#9E9E9E',
  [VoxelType.Wood]: '#D7CCC8',
  [VoxelType.Sand]: '#FFEB3B',
  [VoxelType.Water]: '#2196F3',
  [VoxelType.Glass]: '#E1F5FE',
  [VoxelType.Metal]: '#607D8B',
  [VoxelType.Brick]: '#F44336',
};