/**
 * Shared constants for the tile editor
 */

// Dimetric projection angles
export const DIMETRIC_ELEVATION = Math.atan(0.5); // ~26.565° in radians
export const DIMETRIC_AZIMUTH = Math.PI / 4; // 45° in radians

// Grid constants
export const DEFAULT_CELL_SIZE = 1;
export const DEFAULT_GRID_WIDTH = 100;
export const DEFAULT_GRID_DEPTH = 100;

// Camera constants
export const DEFAULT_FRUSTUM_SIZE = 20;
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 100;
export const ZOOM_SPEED = 0.001;
export const PAN_SPEED = 1;

// Rendering constants
export const SHADOW_MAP_SIZE = 512; // Further reduced for ultrathink performance
export const MAX_PIXEL_RATIO = 2;

/**
 * Calculate camera position from dimetric angles
 * @param distance Distance from target
 * @returns Camera position coordinates
 */
export function calculateDimetricPosition(distance: number): { x: number; y: number; z: number } {
  const height = distance * Math.sin(DIMETRIC_ELEVATION);
  const groundDistance = distance * Math.cos(DIMETRIC_ELEVATION);
  const x = groundDistance * Math.cos(DIMETRIC_AZIMUTH);
  const z = groundDistance * Math.sin(DIMETRIC_AZIMUTH);
  
  return { x, y: height, z };
}