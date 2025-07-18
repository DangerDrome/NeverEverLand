import {
  VoxelType,
  VoxelData,
  VoxelCoordinate,
  ChunkCoordinate,
  GlobalVoxelCoordinate,
  VOXELS_PER_GRID,
  CHUNK_SIZE,
  VoxelUtils
} from './VoxelTypes';

/**
 * Represents a chunk of voxel data
 * Each chunk contains CHUNK_SIZE × CHUNK_SIZE grid cells
 * Each grid cell contains VOXELS_PER_GRID³ voxels (20³ = 8,000 voxels per grid cell)
 */
export class VoxelChunk {
  private coordinate: ChunkCoordinate;
  private voxels: Map<string, VoxelData>;
  private isDirty: boolean = true;
  private isEmpty: boolean = true;
  
  constructor(coordinate: ChunkCoordinate) {
    this.coordinate = coordinate;
    this.voxels = new Map();
  }

  /**
   * Get the chunk's coordinate
   */
  public getCoordinate(): ChunkCoordinate {
    return this.coordinate;
  }

  /**
   * Check if chunk needs re-meshing
   */
  public getIsDirty(): boolean {
    return this.isDirty;
  }

  /**
   * Mark chunk as clean (meshed)
   */
  public setClean(): void {
    this.isDirty = false;
  }

  /**
   * Mark chunk as dirty (needs re-meshing)
   */
  public setDirty(): void {
    this.isDirty = true;
  }

  /**
   * Check if chunk is empty (contains no solid voxels)
   */
  public getIsEmpty(): boolean {
    return this.isEmpty;
  }

  /**
   * Get voxel at local coordinate within chunk
   */
  public getVoxel(localCoord: VoxelCoordinate): VoxelData {
    if (!this.isValidLocalCoordinate(localCoord)) {
      return { type: VoxelType.Air };
    }

    const key = VoxelUtils.getVoxelKey(localCoord);
    return this.voxels.get(key) || { type: VoxelType.Air };
  }

  /**
   * Set voxel at local coordinate within chunk
   */
  public setVoxel(localCoord: VoxelCoordinate, voxel: VoxelData): void {
    if (!this.isValidLocalCoordinate(localCoord)) {
      console.warn('Invalid voxel coordinate:', localCoord);
      return;
    }

    const key = VoxelUtils.getVoxelKey(localCoord);
    
    // If setting to air, remove from sparse storage
    if (voxel.type === VoxelType.Air) {
      this.voxels.delete(key);
    } else {
      this.voxels.set(key, voxel);
      this.isEmpty = false;
    }

    // Check if chunk is now empty
    if (this.voxels.size === 0) {
      this.isEmpty = true;
    }

    this.setDirty();
  }

  /**
   * Get voxel using global coordinate (converts to local)
   */
  public getVoxelGlobal(globalCoord: GlobalVoxelCoordinate): VoxelData {
    const localCoord = this.globalToLocalCoordinate(globalCoord);
    return this.getVoxel(localCoord);
  }

  /**
   * Set voxel using global coordinate (converts to local)
   */
  public setVoxelGlobal(globalCoord: GlobalVoxelCoordinate, voxel: VoxelData): void {
    const localCoord = this.globalToLocalCoordinate(globalCoord);
    this.setVoxel(localCoord, voxel);
  }

  /**
   * Fill a region with the same voxel type
   */
  public fillRegion(
    start: VoxelCoordinate,
    end: VoxelCoordinate,
    voxel: VoxelData
  ): void {
    const minX = Math.max(0, Math.min(start.x, end.x));
    const maxX = Math.min(this.getMaxCoordinate(), Math.max(start.x, end.x));
    const minY = Math.max(0, Math.min(start.y, end.y));
    const maxY = Math.min(this.getMaxCoordinate(), Math.max(start.y, end.y));
    const minZ = Math.max(0, Math.min(start.z, end.z));
    const maxZ = Math.min(this.getMaxCoordinate(), Math.max(start.z, end.z));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          this.setVoxel({ x, y, z }, voxel);
        }
      }
    }
  }

  /**
   * Clear all voxels in chunk
   */
  public clear(): void {
    this.voxels.clear();
    this.isEmpty = true;
    this.setDirty();
  }

  /**
   * Get all non-air voxels for iteration
   */
  public getNonAirVoxels(): Array<{ coord: VoxelCoordinate; voxel: VoxelData }> {
    const result: Array<{ coord: VoxelCoordinate; voxel: VoxelData }> = [];
    
    for (const [key, voxel] of this.voxels.entries()) {
      const parts = key.split(',');
      const x = Number(parts[0] || 0);
      const y = Number(parts[1] || 0);
      const z = Number(parts[2] || 0);
      result.push({
        coord: { x, y, z },
        voxel
      });
    }
    
    return result;
  }

  /**
   * Iterate through all possible voxel positions (for meshing)
   * Calls callback for each position with voxel data
   */
  public forEachVoxel(callback: (coord: VoxelCoordinate, voxel: VoxelData) => void): void {
    const maxCoord = this.getMaxCoordinate();
    
    for (let x = 0; x <= maxCoord; x++) {
      for (let y = 0; y <= maxCoord; y++) {
        for (let z = 0; z <= maxCoord; z++) {
          const coord: VoxelCoordinate = { x, y, z };
          const voxel = this.getVoxel(coord);
          callback(coord, voxel);
        }
      }
    }
  }

  /**
   * Get memory usage info
   */
  public getMemoryInfo(): { storedVoxels: number; totalPossibleVoxels: number } {
    const totalPossibleVoxels = Math.pow(CHUNK_SIZE * VOXELS_PER_GRID, 3);
    return {
      storedVoxels: this.voxels.size,
      totalPossibleVoxels
    };
  }

  /**
   * Serialize chunk data for saving
   */
  public serialize(): any {
    const voxelArray: Array<{
      x: number;
      y: number;
      z: number;
      type: VoxelType;
      metadata?: any;
    }> = [];

    for (const [key, voxel] of this.voxels.entries()) {
      const parts = key.split(',');
      const x = Number(parts[0] || 0);
      const y = Number(parts[1] || 0);
      const z = Number(parts[2] || 0);
      voxelArray.push({
        x, y, z,
        type: voxel.type,
        metadata: voxel.metadata
      });
    }

    return {
      coordinate: this.coordinate,
      voxels: voxelArray,
      isEmpty: this.isEmpty
    };
  }

  /**
   * Deserialize chunk data from saved data
   */
  public static deserialize(data: any): VoxelChunk {
    const chunk = new VoxelChunk(data.coordinate);
    
    for (const voxelData of data.voxels) {
      const coord: VoxelCoordinate = {
        x: voxelData.x,
        y: voxelData.y,
        z: voxelData.z
      };
      
      const voxel: VoxelData = {
        type: voxelData.type,
        metadata: voxelData.metadata
      };
      
      chunk.setVoxel(coord, voxel);
    }
    
    chunk.isEmpty = data.isEmpty;
    chunk.setClean(); // Assume loaded chunks don't need immediate re-meshing
    
    return chunk;
  }

  /**
   * Check if local coordinate is valid within this chunk
   */
  private isValidLocalCoordinate(coord: VoxelCoordinate): boolean {
    const maxCoord = this.getMaxCoordinate();
    return coord.x >= 0 && coord.x <= maxCoord &&
           coord.y >= 0 && coord.y <= maxCoord &&
           coord.z >= 0 && coord.z <= maxCoord;
  }

  /**
   * Convert global voxel coordinate to local chunk coordinate
   */
  private globalToLocalCoordinate(globalCoord: GlobalVoxelCoordinate): VoxelCoordinate {
    const chunkSizeVoxels = CHUNK_SIZE * VOXELS_PER_GRID;
    
    return {
      x: globalCoord.x - (this.coordinate.x * chunkSizeVoxels),
      y: globalCoord.y, // Y is always absolute
      z: globalCoord.z - (this.coordinate.z * chunkSizeVoxels)
    };
  }

  /**
   * Get maximum coordinate value for this chunk
   */
  private getMaxCoordinate(): number {
    return (CHUNK_SIZE * VOXELS_PER_GRID) - 1;
  }

  /**
   * Convert local coordinate to global coordinate
   */
  public localToGlobalCoordinate(localCoord: VoxelCoordinate): GlobalVoxelCoordinate {
    const chunkSizeVoxels = CHUNK_SIZE * VOXELS_PER_GRID;
    
    return {
      x: localCoord.x + (this.coordinate.x * chunkSizeVoxels),
      y: localCoord.y, // Y is always absolute
      z: localCoord.z + (this.coordinate.z * chunkSizeVoxels)
    };
  }

  /**
   * Get neighbor voxel (may be in adjacent chunk)
   * Returns null if neighbor is outside this chunk
   */
  public getNeighborVoxel(
    coord: VoxelCoordinate,
    deltaX: number,
    deltaY: number,
    deltaZ: number
  ): VoxelData | null {
    const neighborCoord: VoxelCoordinate = {
      x: coord.x + deltaX,
      y: coord.y + deltaY,
      z: coord.z + deltaZ
    };

    // If neighbor is within this chunk, return it
    if (this.isValidLocalCoordinate(neighborCoord)) {
      return this.getVoxel(neighborCoord);
    }

    // Neighbor is outside this chunk
    return null;
  }
}