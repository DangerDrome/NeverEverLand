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
  private layerHeight: number = 0.1; // Height of each layer
  
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
   * Place a tile at grid coordinate
   */
  public placeTile(coord: GridCoordinate, type: VoxelType): void {
    // Remove existing tiles at this position
    this.removeTile(coord);
    
    // Don't place air
    if (type === VoxelType.Air) return;
    
    // Special handling for multi-layer tiles
    if (type === VoxelType.Grass) {
      // Grass: 3 layers (sand, dirt, grass)
      this.placeSingleTile(coord, VoxelType.Sand, 0);  // Bottom layer
      this.placeSingleTile(coord, VoxelType.Dirt, 1);  // Middle layer
      this.placeSingleTile(coord, VoxelType.Grass, 2); // Top layer
    } else if (type === VoxelType.Dirt) {
      // Dirt: 2 layers (sand, dirt)
      this.placeSingleTile(coord, VoxelType.Sand, 0);  // Bottom layer
      this.placeSingleTile(coord, VoxelType.Dirt, 1);  // Top layer
    } else {
      // Normal single tile placement
      this.placeSingleTile(coord, type, 0);
    }
  }
  
  /**
   * Place a single tile layer
   */
  private placeSingleTile(coord: GridCoordinate, type: VoxelType, layer: number): void {
    const key = `${coord.x},${coord.z},${layer}`;
    
    // Create new tile mesh
    const material = this.materials.get(type);
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
   * Remove a tile at grid coordinate
   */
  public removeTile(coord: GridCoordinate): void {
    // Remove all layers at this position
    for (let layer = 0; layer < 3; layer++) {
      const key = `${coord.x},${coord.z},${layer}`;
      const mesh = this.tiles.get(key);
      
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.tiles.delete(key);
      }
    }
  }
  
  /**
   * Get tile at coordinate (returns top-most tile type)
   */
  public getTile(coord: GridCoordinate): VoxelType {
    // Check from top layer down
    for (let layer = 2; layer >= 0; layer--) {
      const key = `${coord.x},${coord.z},${layer}`;
      const mesh = this.tiles.get(key);
      if (mesh) {
        return mesh.userData.type;
      }
    }
    return VoxelType.Air;
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
  }
}