/**
 * Grid coordinate in the tile grid system
 * Represents integer positions on the isometric grid
 */
export interface GridCoordinate {
  readonly x: number;
  readonly z: number;
}

/**
 * World position in 3D space
 * Used for Three.js object positioning
 */
export interface WorldPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Screen position in pixels
 * Used for mouse input and UI positioning
 */
export interface ScreenPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Represents a single cell in the isometric grid
 */
export interface GridCell {
  coord: GridCoordinate;
  worldPos: WorldPosition;
  screenPos?: ScreenPosition;
  isHighlighted: boolean;
  hasTile: boolean;
  tileId?: string;
}

/**
 * Grid configuration options
 */
export interface GridConfig {
  /** Size of each grid cell in world units */
  cellSize: number;
  /** Number of cells in X direction */
  gridWidth: number;
  /** Number of cells in Z direction */
  gridDepth: number;
  /** Grid line colors for different levels */
  colors: {
    major: number;
    standard: number;
    fine: number;
  };
  /** Grid line opacities */
  opacities: {
    major: number;
    standard: number;
    fine: number;
  };
}

/**
 * Utility functions for coordinate conversions
 */
export class CoordinateUtils {
  /**
   * Convert grid coordinates to world position  
   * Grid (0,0) maps to world (0, 0, 0) - cell corner at origin
   * Add 0.5 to grid coords to get cell center
   */
  static gridToWorld(grid: GridCoordinate, cellSize: number = 1): WorldPosition {
    return {
      x: grid.x * cellSize,
      y: 0,
      z: grid.z * cellSize,
    };
  }

  /**
   * Convert world position to grid coordinates
   * Snaps to nearest grid cell
   */
  static worldToGrid(world: WorldPosition, cellSize: number = 1): GridCoordinate {
    return {
      x: Math.floor(world.x / cellSize),
      z: Math.floor(world.z / cellSize),
    };
  }

  /**
   * Create a unique key for a grid coordinate
   * Used for Map storage
   */
  static getGridKey(coord: GridCoordinate): string {
    return `${coord.x},${coord.z}`;
  }

  /**
   * Parse a grid key back to coordinates
   */
  static parseGridKey(key: string): GridCoordinate {
    const [x, z] = key.split(',').map(Number);
    return { x, z };
  }

  /**
   * Calculate distance between two grid coordinates
   * Uses Manhattan distance
   */
  static gridDistance(a: GridCoordinate, b: GridCoordinate): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }

  /**
   * Check if two coordinates are equal
   */
  static coordsEqual(a: GridCoordinate, b: GridCoordinate): boolean {
    return a.x === b.x && a.z === b.z;
  }
}