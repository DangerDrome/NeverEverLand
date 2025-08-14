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
    // Custom color slots (10-265) for color picker - dynamically assigned
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
    CUSTOM_16 = 25,
    // Extended custom slots for unlimited colors
    CUSTOM_17 = 26,
    CUSTOM_18 = 27,
    CUSTOM_19 = 28,
    CUSTOM_20 = 29,
    CUSTOM_21 = 30,
    CUSTOM_22 = 31,
    CUSTOM_23 = 32,
    CUSTOM_24 = 33,
    CUSTOM_25 = 34,
    CUSTOM_26 = 35,
    CUSTOM_27 = 36,
    CUSTOM_28 = 37,
    CUSTOM_29 = 38,
    CUSTOM_30 = 39,
    CUSTOM_31 = 40,
    CUSTOM_32 = 41,
    // ... We'll generate the rest programmatically to avoid a huge enum
    CUSTOM_256 = 265  // Maximum custom slot
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