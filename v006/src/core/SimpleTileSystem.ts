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
    const key = `${coord.x},${coord.z}`;
    
    // Remove existing tile if any
    this.removeTile(coord);
    
    // Don't place air
    if (type === VoxelType.Air) return;
    
    // Create new tile mesh
    const material = this.materials.get(type);
    if (!material) return;
    
    const mesh = new THREE.Mesh(this.tileGeometry, material);
    // Center tile in grid cell and position so bottom sits on grid
    mesh.position.set(coord.x + 0.5, 0.05, coord.z + 0.5); 
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type, coord };
    
    this.tiles.set(key, mesh);
    this.scene.add(mesh);
  }
  
  /**
   * Remove a tile at grid coordinate
   */
  public removeTile(coord: GridCoordinate): void {
    const key = `${coord.x},${coord.z}`;
    const mesh = this.tiles.get(key);
    
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.tiles.delete(key);
    }
  }
  
  /**
   * Get tile at coordinate
   */
  public getTile(coord: GridCoordinate): VoxelType {
    const key = `${coord.x},${coord.z}`;
    const mesh = this.tiles.get(key);
    return mesh ? mesh.userData.type : VoxelType.Air;
  }
  
  /**
   * Get all placed tiles
   */
  public getAllTiles(): Map<string, { coord: GridCoordinate; type: VoxelType }> {
    const result = new Map();
    this.tiles.forEach((mesh, key) => {
      result.set(key, {
        coord: mesh.userData.coord,
        type: mesh.userData.type
      });
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