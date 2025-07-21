import * as THREE from 'three';
import { GridConfig, GridLevel, GridCoordinate, CoordinateUtils } from '../types';
import { DEFAULT_CELL_SIZE, DEFAULT_GRID_WIDTH, DEFAULT_GRID_DEPTH } from './constants';

/**
 * Dimetric grid system for isometric tile editor
 * Creates diamond-shaped grid cells in proper dimetric projection
 */
export class DimetricGrid {
  private scene: THREE.Scene;
  private config: GridConfig;
  private gridGroups: Map<GridLevel, THREE.Group>;
  private materials: Map<GridLevel, THREE.LineBasicMaterial>;
  private highlightMesh: THREE.Mesh | null = null;
  private visible: boolean = true;

  constructor(scene: THREE.Scene, config?: Partial<GridConfig>) {
    this.scene = scene;
    
    // Default configuration
    this.config = {
      cellSize: DEFAULT_CELL_SIZE,
      gridWidth: DEFAULT_GRID_WIDTH,
      gridDepth: DEFAULT_GRID_DEPTH,
      colors: {
        major: 0x888888,
        standard: 0x555555,
        fine: 0x333333,
      },
      opacities: {
        major: 1.0,
        standard: 0.7,
        fine: 0.4,
      },
      ...config,
    };

    this.gridGroups = new Map();
    this.materials = new Map();

    this.createGridLevels();
    this.createHighlightMesh();
  }

  /**
   * Create grid levels with different densities
   */
  private createGridLevels(): void {
    // Major grid (10x10 cells)
    this.createGridLevel(GridLevel.Major, 10, this.config.colors.major, this.config.opacities.major);
    
    // Standard grid (1x1 cells)
    this.createGridLevel(GridLevel.Standard, 1, this.config.colors.standard, this.config.opacities.standard);
    
    // Fine grid (0.5x0.5 cells) - for precise placement
    this.createGridLevel(GridLevel.Fine, 0.5, this.config.colors.fine, this.config.opacities.fine);
  }

  /**
   * Create a single grid level
   */
  private createGridLevel(level: GridLevel, spacing: number, color: number, opacity: number): void {
    const group = new THREE.Group();
    group.name = `grid-${level}`;
    
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
    });
    
    this.materials.set(level, material);
    
    // Create diamond grid pattern
    const geometry = this.createDiamondGridGeometry(spacing);
    const lines = new THREE.LineSegments(geometry, material);
    
    group.add(lines);
    this.gridGroups.set(level, group);
    this.scene.add(group);
  }

  /**
   * Create square grid geometry that appears as diamonds in dimetric view
   */
  private createDiamondGridGeometry(spacing: number): THREE.BufferGeometry {
    const vertices: number[] = [];
    const halfWidth = (this.config.gridWidth * this.config.cellSize) / 2;
    const halfDepth = (this.config.gridDepth * this.config.cellSize) / 2;
    
    // Create a SQUARE grid in world space
    // When viewed from dimetric angle, squares will appear as diamonds
    
    // Lines parallel to X axis
    const numLinesZ = Math.floor((halfDepth * 2) / spacing) + 1;
    for (let i = 0; i < numLinesZ; i++) {
      const z = -halfDepth + i * spacing;
      
      vertices.push(-halfWidth, 0, z);
      vertices.push(halfWidth, 0, z);
    }
    
    // Lines parallel to Z axis  
    const numLinesX = Math.floor((halfWidth * 2) / spacing) + 1;
    for (let i = 0; i < numLinesX; i++) {
      const x = -halfWidth + i * spacing;
      
      vertices.push(x, 0, -halfDepth);
      vertices.push(x, 0, halfDepth);
    }
    
    // Create buffer geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
    return geometry;
  }


  /**
   * Create highlight mesh for grid cells
   */
  private createHighlightMesh(): void {
    // Create a square plane that will appear as diamond from dimetric view
    const geometry = new THREE.PlaneGeometry(
      this.config.cellSize, 
      this.config.cellSize
    );
    
    // Rotate to lie flat on the ground (Y-up)
    geometry.rotateX(-Math.PI / 2);
    
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    
    this.highlightMesh = new THREE.Mesh(geometry, material);
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);
  }

  /**
   * Highlight a grid cell (supports sub-grid highlighting)
   */
  public highlightCell(coord: GridCoordinate, cellSize: number = this.config.cellSize): void {
    if (!this.highlightMesh) return;
    
    // Update highlight mesh size if needed
    const currentGeometry = this.highlightMesh.geometry as THREE.PlaneGeometry;
    const currentSize = currentGeometry.parameters.width;
    if (Math.abs(currentSize - cellSize) > 0.001) {
      // Dispose old geometry and create new one with correct size
      currentGeometry.dispose();
      const newGeometry = new THREE.PlaneGeometry(cellSize, cellSize);
      newGeometry.rotateX(-Math.PI / 2);
      this.highlightMesh.geometry = newGeometry;
    }
    
    // Position highlight at sub-grid location
    const worldX = coord.x * cellSize + cellSize * 0.5;
    const worldZ = coord.z * cellSize + cellSize * 0.5;
    this.highlightMesh.position.set(
      worldX, 
      0.01, // Slightly above ground
      worldZ
    );
    this.highlightMesh.visible = true;
  }

  /**
   * Clear cell highlighting
   */
  public clearHighlight(): void {
    if (this.highlightMesh) {
      this.highlightMesh.visible = false;
    }
  }

  /**
   * Set grid visibility
   */
  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.gridGroups.forEach(group => {
      group.visible = visible;
    });
  }

  /**
   * Set visibility for specific grid level
   */
  public setLevelVisible(level: GridLevel, visible: boolean): void {
    const group = this.gridGroups.get(level);
    if (group) {
      group.visible = visible;
    }
  }

  /**
   * Update grid opacity based on camera zoom
   */
  public updateOpacity(zoomLevel: number): void {
    // Fade out fine grid when zoomed out
    if (zoomLevel > 20) {
      this.setLevelVisible(GridLevel.Fine, false);
    } else {
      this.setLevelVisible(GridLevel.Fine, this.visible);
    }
    
    // Fade out standard grid when very zoomed out
    if (zoomLevel > 40) {
      this.setLevelVisible(GridLevel.Standard, false);
    } else {
      this.setLevelVisible(GridLevel.Standard, this.visible);
    }
  }

  /**
   * Get grid configuration
   */
  public getConfig(): Readonly<GridConfig> {
    return this.config;
  }

  /**
   * Dispose of grid resources
   */
  public dispose(): void {
    this.gridGroups.forEach(group => {
      this.scene.remove(group);
      group.traverse(child => {
        if (child instanceof THREE.LineSegments) {
          child.geometry.dispose();
        }
      });
    });
    
    this.materials.forEach(material => material.dispose());
    
    if (this.highlightMesh) {
      this.scene.remove(this.highlightMesh);
      this.highlightMesh.geometry.dispose();
      (this.highlightMesh.material as THREE.Material).dispose();
    }
    
    this.gridGroups.clear();
    this.materials.clear();
  }
}