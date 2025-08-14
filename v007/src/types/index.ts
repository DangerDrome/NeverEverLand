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
    ICE = 9,
    // Custom color slots (10-25) for color picker
    CUSTOM_1 = 10,
    CUSTOM_2 = 11,
    CUSTOM_3 = 12,
    CUSTOM_4 = 13,
    CUSTOM_5 = 14,
    CUSTOM_6 = 15,
    CUSTOM_7 = 16,
    CUSTOM_8 = 17,
    CUSTOM_9 = 18,
    CUSTOM_10 = 19,
    CUSTOM_11 = 20,
    CUSTOM_12 = 21,
    CUSTOM_13 = 22,
    CUSTOM_14 = 23,
    CUSTOM_15 = 24,
    CUSTOM_16 = 25
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