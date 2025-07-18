import * as THREE from 'three';
import { GridCoordinate } from '../types';
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
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Make tiles thin (10cm tall) so they sit on the grid like floor tiles
    this.tileGeometry = new THREE.BoxGeometry(1, 0.1, 1);
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
   * Get a cached material with height-based tinting
   * This prevents creating a new material for every single tile
   */
  private getCachedMaterial(type: VoxelType, layer: number): THREE.Material {
    // Quantize the tint level to reduce material variations
    // Using 10 levels of tinting instead of infinite variations
    const tintLevel = Math.floor((layer / this.maxLayers) * 10);
    const cacheKey = `${type},${tintLevel}`;
    
    // Check cache first
    const cached = this.materialCache.get(cacheKey);
    if (cached) return cached;
    
    // Create new material only if not cached
    const baseMaterial = this.materials.get(type);
    if (!baseMaterial) return baseMaterial!;
    
    const material = (baseMaterial as THREE.MeshPhongMaterial).clone();
    
    // Apply consistent tinting based on quantized level
    const tintFactor = tintLevel / 10 * 0.2; // 0 to 0.2 range
    
    const baseColor = (baseMaterial as THREE.MeshPhongMaterial).color;
    const r = baseColor.r + (1 - baseColor.r) * tintFactor;
    const g = baseColor.g + (1 - baseColor.g) * tintFactor;
    const b = baseColor.b + (1 - baseColor.b) * tintFactor;
    material.color.setRGB(r, g, b);
    
    // Cache the material
    this.materialCache.set(cacheKey, material);
    
    return material;
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
   * Place a tile at grid coordinate
   */
  public placeTile(coord: GridCoordinate, type: VoxelType, stackOnTop: boolean = true): void {
    // Don't place air
    if (type === VoxelType.Air) return;
    
    let startLayer = 0;
    
    if (stackOnTop) {
      // Find the top layer and place above it
      const topLayer = this.getTopLayer(coord);
      startLayer = topLayer + 1;
      
      // Check if we've reached max height
      if (startLayer >= this.maxLayers) {
        console.warn('Maximum height reached at', coord);
        return;
      }
    } else {
      // Replace existing tiles at this position
      this.removeTile(coord);
    }
    
    // Special handling for multi-layer tiles
    if (type === VoxelType.Grass) {
      // Grass: 3 layers (sand, dirt, grass)
      this.placeSingleTile(coord, VoxelType.Sand, startLayer);
      this.placeSingleTile(coord, VoxelType.Dirt, startLayer + 1);
      this.placeSingleTile(coord, VoxelType.Grass, startLayer + 2);
    } else if (type === VoxelType.Dirt) {
      // Dirt: 2 layers (sand, dirt)
      this.placeSingleTile(coord, VoxelType.Sand, startLayer);
      this.placeSingleTile(coord, VoxelType.Dirt, startLayer + 1);
    } else {
      // Normal single tile placement
      this.placeSingleTile(coord, type, startLayer);
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
    // Center tile in grid cell and position based on layer
    const yPos = this.layerHeight / 2 + (layer * this.layerHeight);
    mesh.position.set(coord.x + 0.5, yPos, coord.z + 0.5); 
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