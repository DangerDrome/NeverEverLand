export * from './coordinates';

// Import types needed in this file
import { WorldPosition, GridCoordinate } from './coordinates';

/**
 * Editor modes
 */
export enum EditorMode {
  Select = 'select',
  Place = 'place',
  Erase = 'erase',
  Paint = 'paint',
  Rectangle = 'rectangle',
  Line = 'line',
}

/**
 * Grid display levels
 */
export enum GridLevel {
  Major = 'major',       // 10m grid
  Standard = 'standard', // 1m grid
  Fine = 'fine',        // 0.5m grid
  UltraFine = 'ultrafine', // 0.1m grid (tile size)
}

/**
 * Tile categories
 */
export enum TileCategory {
  Terrain = 'terrain',
  Structure = 'structure',
  Nature = 'nature',
  Decoration = 'decoration',
}

/**
 * Tile rotation angles (in 90-degree increments)
 */
export enum TileRotation {
  Deg0 = 0,
  Deg90 = 90,
  Deg180 = 180,
  Deg270 = 270,
}

/**
 * Stack direction for tile placement
 */
export enum StackDirection {
  Up = 'up',        // +Y axis (default)
  Down = 'down',    // -Y axis
  North = 'north',  // +Z axis
  South = 'south',  // -Z axis
  East = 'east',    // +X axis
  West = 'west',    // -X axis
}

/**
 * Tile definition
 */
export interface TileDefinition {
  id: string;
  name: string;
  category: TileCategory;
  color: number; // Three.js color
  size: {
    width: number;
    height: number;
    depth: number;
  };
  rotatable: boolean;
  stackable: boolean;
  solid: boolean;
  icon?: string; // Lucide icon name
}

/**
 * Placed tile instance
 */
export interface TileInstance {
  id: string;
  tileDefId: string;
  position: WorldPosition;
  rotation: TileRotation;
  metadata?: Record<string, any>;
}

/**
 * Editor state
 */
export interface EditorState {
  mode: EditorMode;
  selectedTileId: string | null;
  gridVisible: boolean;
  gridLevel: GridLevel;
  rotation: TileRotation;
  highlightedCell: GridCoordinate | null;
  cameraZoom: number;
  selectedVoxels: Set<string>; // Keys are "x,z,layer"
}

/**
 * Editor configuration
 */
export interface EditorConfig {
  /** Initial editor mode */
  defaultMode: EditorMode;
  /** Show grid on startup */
  showGrid: boolean;
  /** Default grid level */
  defaultGridLevel: GridLevel;
  /** Enable keyboard shortcuts */
  enableShortcuts: boolean;
  /** Show coordinate display */
  showCoordinates: boolean;
  /** Show FPS counter */
  showFPS: boolean;
}