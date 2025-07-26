import * as THREE from 'three';
import { GridCoordinate, StackDirection } from '../types';
import { VoxelType, VOXEL_PROPERTIES } from './VoxelTypes';

/**
 * Simple tile system that creates 1x1m blocks instead of voxels
 */
export class SimpleTileSystem {
  private scene: THREE.Scene;
  private tiles: Map<string, THREE.Mesh> = new Map();
  private tileGeometry: THREE.BoxGeometry;
  private materials: Map<VoxelType, THREE.Material> = new Map();
  // Material cache: key is "voxelType,tintLevel" where tintLevel is 0-10
  private materialCache: Map<string, THREE.Material> = new Map();
  private layerHeight: number = 0.1; // Height of each layer
  private maxLayers: number = 50; // Maximum height in layers
  private tileSize: number = 0.1; // Current tile scale factor
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Make tiles thin (10cm tall) so they sit on the grid like floor tiles
    this.tileGeometry = new THREE.BoxGeometry(this.tileSize, 0.1, this.tileSize);
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
    for (let layer = 0; layer < this.maxLayers; layer++) {
      const key = `${coord.x},${coord.z},${layer}`;
      if (this.tiles.has(key)) {
        topLayer = layer;
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
   * Place a tile at grid coordinate
   */
  public placeTile(coord: GridCoordinate, type: VoxelType, stackOnTop: boolean = true, replaceExisting: boolean = false, stackDirection: StackDirection = StackDirection.Up): void {
    // Don't place air
    if (type === VoxelType.Air) return;
    
    let startLayer = 0;
    let actualCoord = coord;
    
    if (replaceExisting) {
      // Replace mode: remove all existing tiles at this position
      this.removeTile(coord);
    } else if (stackOnTop) {
      // Stack mode: place based on direction
      if (stackDirection === StackDirection.Up) {
        // Original behavior: stack on top
        const topLayer = this.getTopLayer(coord);
        startLayer = topLayer + 1;
        
        // Check if we've reached max height
        if (startLayer >= this.maxLayers) {
          console.warn('Maximum height reached at', coord);
          return;
        }
      } else if (stackDirection === StackDirection.Down) {
        // Stack downward (not common, but included for completeness)
        startLayer = 0;
        // Would need to shift existing tiles up, but that's complex
        // For now, just place at layer 0
      } else {
        // Horizontal stacking: find next position in the given direction
        const nextPos = this.getNextPositionInDirection(coord, stackDirection);
        if (nextPos) {
          actualCoord = nextPos;
          startLayer = 0;
        } else {
          console.warn('Could not find valid position in direction', stackDirection);
          return;
        }
      }
    } else {
      // No stack, no replace: place at ground level (layer 0) without removing existing
      startLayer = 0;
      // Check if layer 0 is already occupied
      const key = `${actualCoord.x},${actualCoord.z},${startLayer}`;
      if (this.tiles.has(key)) {
        // Layer 0 is occupied, don't place anything
        return;
      }
    }
    
    // Place single tile (removed multi-layer logic for grass and dirt)
    this.placeSingleTile(actualCoord, type, startLayer);
  }
  
  /**
   * Place a tile at a specific layer (used for face-based placement)
   */
  public placeTileAtLayer(coord: GridCoordinate, type: VoxelType, layer: number): void {
    // Don't place air
    if (type === VoxelType.Air) return;
    
    // Check if layer is valid
    if (layer < 0 || layer >= this.maxLayers) {
      console.warn('Invalid layer:', layer);
      return;
    }
    
    // Check if position is already occupied
    const key = `${coord.x},${coord.z},${layer}`;
    if (this.tiles.has(key)) {
      // Position occupied - silently ignore
      // console.warn(`Cannot place tile at (${coord.x}, ${coord.z}, layer ${layer}) - position already occupied`);
      return;
    }
    
    this.placeSingleTile(coord, type, layer);
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
    // Position tile based on sub-grid coordinates and tile size
    const yPos = this.layerHeight / 2 + (layer * this.layerHeight);
    const worldX = coord.x * this.tileSize + this.tileSize * 0.5;
    const worldZ = coord.z * this.tileSize + this.tileSize * 0.5;
    mesh.position.set(worldX, yPos, worldZ); 
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type, coord, layer, tileSize: this.tileSize };
    
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
   * Remove a tile at a specific layer
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
   * Remove a tile at grid coordinate
   */
  public removeTile(coord: GridCoordinate, removeAll: boolean = false): void {
    if (removeAll) {
      // Remove all layers at this position
      for (let layer = 0; layer < this.maxLayers; layer++) {
        const key = `${coord.x},${coord.z},${layer}`;
        const mesh = this.tiles.get(key);
        
        if (mesh) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.tiles.delete(key);
        }
      }
    } else {
      // Remove only the top layer
      const topLayer = this.getTopLayer(coord);
      if (topLayer >= 0) {
        const key = `${coord.x},${coord.z},${topLayer}`;
        const mesh = this.tiles.get(key);
        
        if (mesh) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.tiles.delete(key);
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
   * Set tile size for new tiles only (doesn't affect existing tiles)
   */
  public setTileSize(size: number): void {
    this.tileSize = size;
    
    // Dispose old geometry
    this.tileGeometry.dispose();
    
    // Create new geometry with updated size for future tiles
    this.tileGeometry = new THREE.BoxGeometry(this.tileSize, 0.1, this.tileSize);
    
    console.log(`Tile size set to ${size.toFixed(1)}x${size.toFixed(1)} for new tiles`);
  }
  
  /**
   * Get current tile size
   */
  public getTileSize(): number {
    return this.tileSize;
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