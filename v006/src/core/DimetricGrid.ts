import * as THREE from 'three';
import { GridConfig, GridLevel, GridCoordinate, WorldPosition, CoordinateUtils } from '@types';

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
      cellSize: 1,
      gridWidth: 100,
      gridDepth: 100,
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
   * Clip line to grid bounds
   */
  private clipLineToBounds(
    x1: number, z1: number, x2: number, z2: number,
    halfWidth: number, halfDepth: number
  ): { x1: number; z1: number; x2: number; z2: number } | null {
    // Simple bounds check for now
    const clippedX1 = Math.max(-halfWidth, Math.min(halfWidth, x1));
    const clippedZ1 = Math.max(-halfDepth, Math.min(halfDepth, z1));
    const clippedX2 = Math.max(-halfWidth, Math.min(halfWidth, x2));
    const clippedZ2 = Math.max(-halfDepth, Math.min(halfDepth, z2));
    
    return { x1: clippedX1, z1: clippedZ1, x2: clippedX2, z2: clippedZ2 };
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
   * Highlight a grid cell
   */
  public highlightCell(coord: GridCoordinate): void {
    if (!this.highlightMesh) return;
    
    const worldPos = CoordinateUtils.gridToWorld(coord, this.config.cellSize);
    // Center the highlight in the cell (grid coords are at cell corners)
    this.highlightMesh.position.set(
      worldPos.x + this.config.cellSize * 0.5, 
      0.01, // Slightly above ground
      worldPos.z + this.config.cellSize * 0.5
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