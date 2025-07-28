import * as THREE from 'three';
import { GridCoordinate, StackDirection } from '../types';
import { VoxelType, VOXEL_PROPERTIES } from './VoxelTypes';

/**
 * Simple tile system that creates 1x1m blocks instead of voxels
 */
export class SimpleTileSystem {
  private readonly BASE_GRID_SIZE = 0.1; // Base grid size that all voxels align to
  private readonly VOXEL_SIZE = 0.1; // All voxels are 0.1m cubes
  private scene: THREE.Scene;
  private tiles: Map<string, THREE.Mesh> = new Map();
  private tileGeometry: THREE.BoxGeometry;
  private materials: Map<VoxelType, THREE.Material> = new Map();
  // Material cache: key is "voxelType,tintLevel" where tintLevel is 0-10
  private materialCache: Map<string, THREE.Material> = new Map();
  private get layerHeight(): number { return this.VOXEL_SIZE; } // Always 0.1m
  private maxLayers: number = 50; // Maximum height in layers
  private brushSize: number = 1; // Brush size in voxels (1 = 1x1, 3 = 3x3, etc.)
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // All voxels are 0.1m cubes
    this.tileGeometry = new THREE.BoxGeometry(this.VOXEL_SIZE, this.VOXEL_SIZE, this.VOXEL_SIZE);
    this.initMaterials();
  }
  
  private initMaterials(): void {
    // Create materials for each voxel type
    for (const [typeStr, props] of Object.entries(VOXEL_PROPERTIES)) {
      const type = parseInt(typeStr) as VoxelType;
      if (type === VoxelType.Air) continue;
      
      const material = new THREE.MeshPhongMaterial({
        color: props.color,
        transparent: props.transparent,
        opacity: props.opacity,
      });
      
      this.materials.set(type, material);
    }
  }
  
  
  /**
   * Get the top layer at a coordinate
   */
  public getTopLayer(coord: GridCoordinate): number {
    let topLayer = -1;
    
    // Check for voxels at this specific coordinate
    for (let layer = 0; layer < this.maxLayers; layer++) {
      const key = `${coord.x},${coord.z},${layer}`;
      if (this.tiles.has(key)) {
        topLayer = layer;
      }
    }
    return topLayer;
  }
  
  /**
   * Get the top layer within a brush area
   */
  public getTopLayerInBrushArea(coord: GridCoordinate): number {
    let topLayer = -1;
    
    // Check all cells in the brush area
    for (let dx = 0; dx < this.brushSize; dx++) {
      for (let dz = 0; dz < this.brushSize; dz++) {
        const checkCoord = { x: coord.x + dx, z: coord.z + dz };
        const cellTopLayer = this.getTopLayer(checkCoord);
        if (cellTopLayer > topLayer) {
          topLayer = cellTopLayer;
        }
      }
    }
    return topLayer;
  }

  /**
   * Find the next available position in a given direction
   */
  public getNextPositionInDirection(coord: GridCoordinate, direction: StackDirection): GridCoordinate | null {
    const directionOffsets: Record<StackDirection, { x: number; z: number; layer: number }> = {
      [StackDirection.Up]: { x: 0, z: 0, layer: 1 },
      [StackDirection.Down]: { x: 0, z: 0, layer: -1 },
      [StackDirection.North]: { x: 0, z: 1, layer: 0 },
      [StackDirection.South]: { x: 0, z: -1, layer: 0 },
      [StackDirection.East]: { x: 1, z: 0, layer: 0 },
      [StackDirection.West]: { x: -1, z: 0, layer: 0 }
    };

    const offset = directionOffsets[direction];
    
    if (direction === StackDirection.Up || direction === StackDirection.Down) {
      // For vertical stacking, return the same coordinate with layer adjustment
      // This will be handled in placeTile method
      return coord;
    } else {
      // For horizontal stacking, find the edge tile in the given direction
      let currentCoord = { ...coord };
      let nextCoord = { x: coord.x + offset.x, z: coord.z + offset.z };
      
      // Keep moving in the direction until we find an empty spot
      while (this.getTile(nextCoord) !== VoxelType.Air) {
        currentCoord = { ...nextCoord };
        nextCoord = { x: nextCoord.x + offset.x, z: nextCoord.z + offset.z };
      }
      
      return nextCoord;
    }
  }

  /**
   * Place voxels at grid coordinate using current brush size
   */
  public placeTile(coord: GridCoordinate, type: VoxelType, stackOnTop: boolean = true, replaceExisting: boolean = false, stackDirection: StackDirection = StackDirection.Up): void {
    // Don't place air
    if (type === VoxelType.Air) return;
    
    if (replaceExisting) {
      // Replace mode: remove all existing voxels in the brush area
      this.removeTile(coord);
    } else if (stackOnTop) {
      // Stack mode: place based on direction
      if (stackDirection === StackDirection.Up) {
        // For vertical stacking, place voxels in the brush area
        for (let dx = 0; dx < this.brushSize; dx++) {
          for (let dz = 0; dz < this.brushSize; dz++) {
            const voxelCoord = { x: coord.x + dx, z: coord.z + dz };
            const topLayer = this.getTopLayer(voxelCoord);
            const targetLayer = topLayer + 1;
            
            // Check if we've reached max height
            if (targetLayer >= this.maxLayers) {
              continue; // Skip this voxel
            }
            
            // Place single voxel
            this.placeSingleTile(voxelCoord, type, targetLayer);
          }
        }
      } else if (stackDirection === StackDirection.Down) {
        // Stack downward - place at layer 0
        for (let dx = 0; dx < this.brushSize; dx++) {
          for (let dz = 0; dz < this.brushSize; dz++) {
            const voxelCoord = { x: coord.x + dx, z: coord.z + dz };
            this.placeSingleTile(voxelCoord, type, 0);
          }
        }
      } else {
        // Horizontal stacking: find next position in the given direction
        const nextPos = this.getNextPositionInDirection(coord, stackDirection);
        if (nextPos) {
          this.placeTile(nextPos, type, false, false, stackDirection);
        } else {
          console.warn('Could not find valid position in direction', stackDirection);
        }
      }
    } else {
      // No stack, no replace: place at ground level (layer 0)
      for (let dx = 0; dx < this.brushSize; dx++) {
        for (let dz = 0; dz < this.brushSize; dz++) {
          const voxelCoord = { x: coord.x + dx, z: coord.z + dz };
          const key = `${voxelCoord.x},${voxelCoord.z},0`;
          
          // Only place if position is free
          if (!this.tiles.has(key)) {
            this.placeSingleTile(voxelCoord, type, 0);
          }
        }
      }
    }
  }
  
  /**
   * Place voxels at a specific layer using current brush size
   */
  public placeTileAtLayer(coord: GridCoordinate, type: VoxelType, layer: number): void {
    // Don't place air
    if (type === VoxelType.Air) return;
    
    // Check if layer is valid
    if (layer < 0 || layer >= this.maxLayers) {
      console.warn('Invalid layer:', layer);
      return;
    }
    
    // Place voxels in the brush area at the specified layer
    for (let dx = 0; dx < this.brushSize; dx++) {
      for (let dz = 0; dz < this.brushSize; dz++) {
        const voxelCoord = { x: coord.x + dx, z: coord.z + dz };
        const key = `${voxelCoord.x},${voxelCoord.z},${layer}`;
        
        // Only place if position is free
        if (!this.tiles.has(key)) {
          this.placeSingleTile(voxelCoord, type, layer);
        }
      }
    }
  }
  
  /**
   * Place a single tile layer
   */
  private placeSingleTile(coord: GridCoordinate, type: VoxelType, layer: number): void {
    const key = `${coord.x},${coord.z},${layer}`;
    
    // Get or create cached material with tinting
    const material = this.getCachedMaterial(type, layer);
    if (!material) return;
    
    const mesh = new THREE.Mesh(this.tileGeometry, material);
    // Position tile based on base grid coordinates
    const yPos = this.layerHeight / 2 + (layer * this.layerHeight);
    const worldX = coord.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5;
    const worldZ = coord.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5;
    mesh.position.set(worldX, yPos, worldZ); 
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type, coord, layer };
    
    this.tiles.set(key, mesh);
    this.scene.add(mesh);
  }
  
  /**
   * Get or create a cached material with appropriate tinting
   */
  private getCachedMaterial(type: VoxelType, layer: number): THREE.Material | null {
    const baseMaterial = this.materials.get(type);
    if (!baseMaterial) return null;
    
    // Quantize tint level to reduce number of materials (0-10 levels)
    const heightFactor = layer / this.maxLayers;
    const tintLevel = Math.round(heightFactor * 10);
    const cacheKey = `${type},${tintLevel}`;
    
    // Check cache first
    let material = this.materialCache.get(cacheKey);
    if (material) return material;
    
    // Create new material for this tint level
    material = (baseMaterial as THREE.MeshPhongMaterial).clone();
    
    // Apply height-based tint (no randomness for cached materials)
    const tintFactor = tintLevel / 10;
    
    // Tint towards lighter color as height increases
    const baseColor = (baseMaterial as THREE.MeshPhongMaterial).color;
    const r = baseColor.r + (1 - baseColor.r) * tintFactor * 0.2;
    const g = baseColor.g + (1 - baseColor.g) * tintFactor * 0.2;
    const b = baseColor.b + (1 - baseColor.b) * tintFactor * 0.2;
    (material as THREE.MeshPhongMaterial).color.setRGB(r, g, b);
    
    // Cache the material
    this.materialCache.set(cacheKey, material);
    return material;
  }
  
  /**
   * Remove a single voxel at a specific layer
   */
  public removeTileAtLayer(coord: GridCoordinate, layer: number): void {
    const key = `${coord.x},${coord.z},${layer}`;
    const mesh = this.tiles.get(key);
    
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.tiles.delete(key);
    }
  }
  
  /**
   * Remove voxels at grid coordinate using current brush size
   */
  public removeTile(coord: GridCoordinate, removeAll: boolean = false): void {
    if (removeAll) {
      // Remove all layers in the brush area
      for (let layer = 0; layer < this.maxLayers; layer++) {
        for (let dx = 0; dx < this.brushSize; dx++) {
          for (let dz = 0; dz < this.brushSize; dz++) {
            const voxelCoord = { x: coord.x + dx, z: coord.z + dz };
            this.removeTileAtLayer(voxelCoord, layer);
          }
        }
      }
    } else {
      // Remove only the top layer of each voxel in the brush area
      for (let dx = 0; dx < this.brushSize; dx++) {
        for (let dz = 0; dz < this.brushSize; dz++) {
          const voxelCoord = { x: coord.x + dx, z: coord.z + dz };
          const topLayer = this.getTopLayer(voxelCoord);
          if (topLayer >= 0) {
            this.removeTileAtLayer(voxelCoord, topLayer);
          }
        }
      }
    }
  }
  
  /**
   * Get tile at coordinate (returns top-most tile type)
   */
  public getTile(coord: GridCoordinate): VoxelType {
    const topLayer = this.getTopLayer(coord);
    if (topLayer >= 0) {
      const key = `${coord.x},${coord.z},${topLayer}`;
      const mesh = this.tiles.get(key);
      if (mesh) {
        return mesh.userData.type;
      }
    }
    return VoxelType.Air;
  }
  
  /**
   * Get the world height at a coordinate (for preview positioning)
   */
  public getWorldHeight(coord: GridCoordinate): number {
    const topLayer = this.getTopLayer(coord);
    return (topLayer + 1) * this.layerHeight;
  }
  
  /**
   * Get world height at sub-grid coordinate (based on containing full grid cell)
   */
  public getBaseWorldHeight(subGridCoord: GridCoordinate, tileSize: number): number {
    // Convert sub-grid coordinate to the containing full grid cell
    const fullGridCoord: GridCoordinate = {
      x: Math.floor(subGridCoord.x * tileSize),
      z: Math.floor(subGridCoord.z * tileSize)
    };
    
    return this.getWorldHeight(fullGridCoord);
  }
  
  /**
   * Get all tile meshes (for raycasting)
   */
  public getTileMeshes(): THREE.Mesh[] {
    return Array.from(this.tiles.values());
  }
  
  /**
   * Get all placed tiles
   */
  public getAllTiles(): Map<string, { coord: GridCoordinate; type: VoxelType }> {
    const result = new Map();
    const processedCoords = new Set<string>();
    
    // Only return one entry per x,z coordinate (the top-most tile)
    this.tiles.forEach((mesh, key) => {
      const coord = mesh.userData.coord;
      const coordKey = `${coord.x},${coord.z}`;
      
      if (!processedCoords.has(coordKey)) {
        processedCoords.add(coordKey);
        const topType = this.getTile(coord);
        result.set(coordKey, {
          coord: coord,
          type: topType
        });
      }
    });
    return result;
  }
  
  /**
   * Clear all tiles
   */
  public clear(): void {
    this.tiles.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    this.tiles.clear();
  }
  
  /**
   * Set brush size (how many voxels to place at once)
   */
  public setBrushSize(size: number): void {
    // Only allow specific brush sizes that make sense
    const validSizes = [1, 2, 3, 5, 10];
    const closestSize = validSizes.reduce((prev, curr) => {
      return Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev;
    });
    
    this.brushSize = closestSize;
    console.log(`Brush size set to ${closestSize}x${closestSize} voxels`);
  }
  
  /**
   * Get current brush size
   */
  public getBrushSize(): number {
    return this.brushSize;
  }
  
  /**
   * Get actual voxel size (always 0.1m)
   */
  public getVoxelSize(): number {
    return this.VOXEL_SIZE;
  }
  
  /**
   * Serialize all tiles to a simple format
   */
  public serialize(): Array<{x: number; z: number; layer: number; type: VoxelType}> {
    const tileData: Array<{x: number; z: number; layer: number; type: VoxelType}> = [];
    
    this.tiles.forEach((mesh, key) => {
      const { coord, layer, type } = mesh.userData;
      tileData.push({
        x: coord.x,
        z: coord.z,
        layer: layer,
        type: type
      });
    });
    
    return tileData;
  }
  
  /**
   * Deserialize tiles from saved data
   */
  public deserialize(tileData: Array<{x: number; z: number; layer: number; type: VoxelType}>): void {
    // Clear existing tiles
    this.clear();
    
    // Recreate tiles from saved data
    tileData.forEach(tile => {
      const coord: GridCoordinate = { x: tile.x, z: tile.z };
      this.placeSingleTile(coord, tile.type, tile.layer);
    });
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.clear();
    this.tileGeometry.dispose();
    this.materials.forEach(material => material.dispose());
    this.materialCache.forEach(material => material.dispose());
    this.materialCache.clear();
  }
}