import * as THREE from 'three';

export enum VoxelType {
    AIR = 0,
    GRASS = 1,
    DIRT = 2,
    STONE = 3,
    WOOD = 4,
    LEAVES = 5,
    WATER = 6,
    SAND = 7,
    SNOW = 8,
    ICE = 9
}

export interface VoxelTypeDefinition {
    color: number | string;  // Allow hex strings like '#FF0000' for IDE color preview
    transparent?: boolean;
    opacity?: number;
}

export interface VoxelPosition {
    x: number;
    y: number;
    z: number;
}

export interface RaycastHit {
    voxelPos: VoxelPosition;
    adjacentPos: VoxelPosition;
    point: THREE.Vector3;
    normal: THREE.Vector3;
    distance: number;
}

export type DrawMode = 'add' | 'remove';
export type ToolMode = 'brush' | 'box' | 'line' | 'fill';