import * as THREE from 'three';
import { VoxelChunk } from './VoxelChunk';
import {
  VoxelType,
  VoxelData,
  ChunkCoordinate,
  GlobalVoxelCoordinate,
  VoxelUtils,
  CHUNK_SIZE
} from './VoxelTypes';
import { WorldPosition } from '../types';

/**
 * Configuration for VoxelWorld
 */
export interface VoxelWorldConfig {
  /** Maximum chunks to keep loaded in memory */
  maxLoadedChunks: number;
  /** Radius of chunks to keep loaded around camera */
  renderDistance: number;
  /** Whether to automatically generate terrain */
  autoGenerate: boolean;
}

/**
 * Main voxel world container that manages all chunks
 * Handles chunk loading/unloading, LOD, and world-level operations
 */
export class VoxelWorld {
  private scene: THREE.Scene;
  private config: VoxelWorldConfig;
  private chunks: Map<string, VoxelChunk>;
  private chunkMeshes: Map<string, THREE.Mesh>;
  private cameraPosition: THREE.Vector3;
  
  // Performance tracking
  private loadedChunkCount: number = 0;
  private lastCameraChunk: ChunkCoordinate | null = null;

  constructor(scene: THREE.Scene, config?: Partial<VoxelWorldConfig>) {
    this.scene = scene;
    this.config = {
      maxLoadedChunks: 100,
      renderDistance: 8,
      autoGenerate: false,
      ...config
    };
    
    this.chunks = new Map();
    this.chunkMeshes = new Map();
    this.cameraPosition = new THREE.Vector3();
  }

  /**
   * Update world based on camera position (call each frame)
   */
  public update(cameraPosition: THREE.Vector3): void {
    this.cameraPosition.copy(cameraPosition);
    
    // Convert camera position to chunk coordinate
    const worldPos: WorldPosition = {
      x: cameraPosition.x,
      y: cameraPosition.y,
      z: cameraPosition.z
    };
    const voxelCoord = VoxelUtils.worldToVoxel(worldPos);
    const cameraChunk = this.globalVoxelToChunk(voxelCoord);
    
    // Only update chunks if camera moved to a different chunk
    if (!this.lastCameraChunk || 
        this.lastCameraChunk.x !== cameraChunk.x || 
        this.lastCameraChunk.z !== cameraChunk.z) {
      
      this.updateChunkLoading(cameraChunk);
      this.lastCameraChunk = cameraChunk;
    }
  }

  /**
   * Get voxel at global coordinate
   */
  public getVoxel(globalCoord: GlobalVoxelCoordinate): VoxelData {
    const chunkCoord = this.globalVoxelToChunk(globalCoord);
    const chunk = this.getChunk(chunkCoord);
    
    if (!chunk) {
      return { type: VoxelType.Air };
    }
    
    return chunk.getVoxelGlobal(globalCoord);
  }

  /**
   * Set voxel at global coordinate
   */
  public setVoxel(globalCoord: GlobalVoxelCoordinate, voxel: VoxelData): void {
    const chunkCoord = this.globalVoxelToChunk(globalCoord);
    const chunk = this.getOrCreateChunk(chunkCoord);
    
    chunk.setVoxelGlobal(globalCoord, voxel);
  }

  /**
   * Get voxel at world position
   */
  public getVoxelAtWorldPos(worldPos: WorldPosition): VoxelData {
    const voxelCoord = VoxelUtils.worldToVoxel(worldPos);
    return this.getVoxel(voxelCoord);
  }

  /**
   * Set voxel at world position
   */
  public setVoxelAtWorldPos(worldPos: WorldPosition, voxel: VoxelData): void {
    const voxelCoord = VoxelUtils.worldToVoxel(worldPos);
    this.setVoxel(voxelCoord, voxel);
  }

  /**
   * Fill a region with voxels
   */
  public fillRegion(
    start: GlobalVoxelCoordinate,
    end: GlobalVoxelCoordinate,
    voxel: VoxelData
  ): void {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          this.setVoxel({ x, y, z }, voxel);
        }
      }
    }
  }

  /**
   * Clear all voxels in a region
   */
  public clearRegion(start: GlobalVoxelCoordinate, end: GlobalVoxelCoordinate): void {
    this.fillRegion(start, end, { type: VoxelType.Air });
  }

  /**
   * Generate simple terrain for testing
   */
  public generateTestTerrain(centerChunk: ChunkCoordinate, radius: number = 2): void {
    for (let x = centerChunk.x - radius; x <= centerChunk.x + radius; x++) {
      for (let z = centerChunk.z - radius; z <= centerChunk.z + radius; z++) {
        const chunk = this.getOrCreateChunk({ x, z });
        this.generateChunkTerrain(chunk);
      }
    }
  }

  /**
   * Get all loaded chunks
   */
  public getLoadedChunks(): VoxelChunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Get chunk at coordinate (may return null if not loaded)
   */
  public getChunk(chunkCoord: ChunkCoordinate): VoxelChunk | null {
    const key = VoxelUtils.getChunkKey(chunkCoord);
    return this.chunks.get(key) || null;
  }

  /**
   * Get or create chunk at coordinate
   */
  public getOrCreateChunk(chunkCoord: ChunkCoordinate): VoxelChunk {
    const key = VoxelUtils.getChunkKey(chunkCoord);
    let chunk = this.chunks.get(key);
    
    if (!chunk) {
      chunk = new VoxelChunk(chunkCoord);
      this.chunks.set(key, chunk);
      this.loadedChunkCount++;
      
      // Generate terrain if auto-generate is enabled
      if (this.config.autoGenerate) {
        this.generateChunkTerrain(chunk);
      }
    }
    
    return chunk;
  }

  /**
   * Unload chunk and remove from memory
   */
  public unloadChunk(chunkCoord: ChunkCoordinate): void {
    const key = VoxelUtils.getChunkKey(chunkCoord);
    
    // Remove chunk data
    if (this.chunks.delete(key)) {
      this.loadedChunkCount--;
    }
    
    // Remove mesh from scene
    const mesh = this.chunkMeshes.get(key);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.chunkMeshes.delete(key);
    }
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryInfo(): {
    loadedChunks: number;
    maxChunks: number;
    totalVoxels: number;
    meshes: number;
  } {
    let totalVoxels = 0;
    for (const chunk of this.chunks.values()) {
      totalVoxels += chunk.getMemoryInfo().storedVoxels;
    }
    
    return {
      loadedChunks: this.loadedChunkCount,
      maxChunks: this.config.maxLoadedChunks,
      totalVoxels,
      meshes: this.chunkMeshes.size
    };
  }

  /**
   * Serialize world data for saving
   */
  public serialize(): any {
    const chunkData: any[] = [];
    
    for (const chunk of this.chunks.values()) {
      if (!chunk.getIsEmpty()) {
        chunkData.push(chunk.serialize());
      }
    }
    
    return {
      config: this.config,
      chunks: chunkData
    };
  }

  /**
   * Load world data from serialized data
   */
  public static deserialize(scene: THREE.Scene, data: any): VoxelWorld {
    const world = new VoxelWorld(scene, data.config);
    
    for (const chunkData of data.chunks) {
      const chunk = VoxelChunk.deserialize(chunkData);
      const key = VoxelUtils.getChunkKey(chunk.getCoordinate());
      world.chunks.set(key, chunk);
      world.loadedChunkCount++;
    }
    
    return world;
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Clear all chunks
    for (const chunkCoord of Array.from(this.chunks.keys())) {
      const coord = this.parseChunkKey(chunkCoord);
      if (coord) {
        this.unloadChunk(coord);
      }
    }
    
    this.chunks.clear();
    this.chunkMeshes.clear();
    this.loadedChunkCount = 0;
  }

  /**
   * Convert global voxel coordinate to chunk coordinate
   */
  private globalVoxelToChunk(globalCoord: GlobalVoxelCoordinate): ChunkCoordinate {
    const chunkSizeVoxels = CHUNK_SIZE * 20; // 20 voxels per grid cell
    
    return {
      x: Math.floor(globalCoord.x / chunkSizeVoxels),
      z: Math.floor(globalCoord.z / chunkSizeVoxels)
    };
  }

  /**
   * Update chunk loading based on camera position
   */
  private updateChunkLoading(cameraChunk: ChunkCoordinate): void {
    const renderDistance = this.config.renderDistance;
    const chunksToLoad: ChunkCoordinate[] = [];
    const chunksToUnload: ChunkCoordinate[] = [];
    
    // Determine which chunks should be loaded
    for (let x = cameraChunk.x - renderDistance; x <= cameraChunk.x + renderDistance; x++) {
      for (let z = cameraChunk.z - renderDistance; z <= cameraChunk.z + renderDistance; z++) {
        const distance = Math.sqrt((x - cameraChunk.x) ** 2 + (z - cameraChunk.z) ** 2);
        if (distance <= renderDistance) {
          chunksToLoad.push({ x, z });
        }
      }
    }
    
    // Find chunks that are too far away
    for (const chunk of this.chunks.values()) {
      const coord = chunk.getCoordinate();
      const distance = Math.sqrt(
        (coord.x - cameraChunk.x) ** 2 + (coord.z - cameraChunk.z) ** 2
      );
      
      if (distance > renderDistance) {
        chunksToUnload.push(coord);
      }
    }
    
    // Unload distant chunks first
    for (const coord of chunksToUnload) {
      this.unloadChunk(coord);
    }
    
    // Load nearby chunks
    for (const coord of chunksToLoad) {
      if (!this.getChunk(coord)) {
        this.getOrCreateChunk(coord);
      }
    }
  }

  /**
   * Generate simple terrain for a chunk
   */
  private generateChunkTerrain(chunk: VoxelChunk): void {
    // Simple terrain generation - only generate a flat floor for now
    const chunkSizeVoxels = CHUNK_SIZE * 20;
    
    // Only generate every 4th voxel to reduce density
    const step = 4;
    for (let x = 0; x < chunkSizeVoxels; x += step) {
      for (let z = 0; z < chunkSizeVoxels; z += step) {
        // Just create a flat grass floor at y=0
        chunk.setVoxel({ x, y: 0, z }, { type: VoxelType.Grass });
        
        // Add some random blocks for visual interest
        if (Math.random() < 0.05) {
          const height = Math.floor(Math.random() * 3) + 1;
          for (let y = 1; y <= height; y++) {
            chunk.setVoxel({ x, y, z }, { type: VoxelType.Stone });
          }
        }
      }
    }
  }

  /**
   * Parse chunk key back to coordinate
   */
  private parseChunkKey(key: string): ChunkCoordinate | null {
    const parts = key.split(',');
    if (parts.length !== 2) return null;
    
    const x = parseInt(parts[0]!);
    const z = parseInt(parts[1]!);
    
    if (isNaN(x) || isNaN(z)) return null;
    
    return { x, z };
  }
}