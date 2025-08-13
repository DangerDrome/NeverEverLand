import { VoxelType } from '../engine/VoxelEngine';
import { AssetInfo } from './types';

// Default assets that ship with the application
// These will be stored as .vox files in the public/assets folder
export const DEFAULT_ASSETS: Record<VoxelType, AssetInfo[]> = {
    [VoxelType.AIR]: [],
    
    [VoxelType.GRASS]: [
        {
            id: 'grass_small_tree',
            name: 'Small Tree',
            type: VoxelType.GRASS,
            path: '/assets/grass/small_tree.vox',
            size: { x: 3, y: 5, z: 3 },
            tags: ['tree', 'nature', 'small']
        },
        {
            id: 'grass_large_tree',
            name: 'Large Tree',
            type: VoxelType.GRASS,
            path: '/assets/grass/large_tree.vox',
            size: { x: 5, y: 7, z: 5 },
            tags: ['tree', 'nature', 'large']
        },
        {
            id: 'grass_flower',
            name: 'Flower',
            type: VoxelType.GRASS,
            path: '/assets/grass/flower.vox',
            size: { x: 1, y: 2, z: 1 },
            tags: ['flower', 'nature', 'small', 'decoration']
        }
    ],
    
    [VoxelType.DIRT]: [],
    
    [VoxelType.STONE]: [
        {
            id: 'stone_small_rock',
            name: 'Small Rock',
            type: VoxelType.STONE,
            path: '/assets/stone/small_rock.vox',
            size: { x: 2, y: 1, z: 2 },
            tags: ['rock', 'small']
        },
        {
            id: 'stone_large_rock',
            name: 'Large Rock',
            type: VoxelType.STONE,
            path: '/assets/stone/large_rock.vox',
            size: { x: 3, y: 2, z: 3 },
            tags: ['rock', 'large']
        },
        {
            id: 'stone_pillar',
            name: 'Pillar',
            type: VoxelType.STONE,
            path: '/assets/stone/pillar.vox',
            size: { x: 1, y: 4, z: 1 },
            tags: ['pillar', 'column', 'structure']
        }
    ],
    
    [VoxelType.WOOD]: [
        {
            id: 'wood_crate',
            name: 'Crate',
            type: VoxelType.WOOD,
            path: '/assets/wood/crate.vox',
            size: { x: 2, y: 2, z: 2 },
            tags: ['crate', 'storage', 'box']
        },
        {
            id: 'wood_barrel',
            name: 'Barrel',
            type: VoxelType.WOOD,
            path: '/assets/wood/barrel.vox',
            size: { x: 2, y: 3, z: 2 },
            tags: ['barrel', 'storage']
        },
        {
            id: 'wood_fence',
            name: 'Fence',
            type: VoxelType.WOOD,
            path: '/assets/wood/fence.vox',
            size: { x: 4, y: 2, z: 1 },
            tags: ['fence', 'barrier', 'decoration']
        }
    ],
    
    [VoxelType.LEAVES]: [
        {
            id: 'leaves_bush',
            name: 'Bush',
            type: VoxelType.LEAVES,
            path: '/assets/leaves/bush.vox',
            size: { x: 2, y: 2, z: 2 },
            tags: ['bush', 'nature', 'foliage']
        },
        {
            id: 'leaves_hedge',
            name: 'Hedge',
            type: VoxelType.LEAVES,
            path: '/assets/leaves/hedge.vox',
            size: { x: 4, y: 2, z: 1 },
            tags: ['hedge', 'decoration', 'barrier']
        },
        {
            id: 'leaves_topiary',
            name: 'Topiary',
            type: VoxelType.LEAVES,
            path: '/assets/leaves/topiary.vox',
            size: { x: 2, y: 3, z: 2 },
            tags: ['topiary', 'decoration', 'shaped']
        }
    ],
    
    [VoxelType.WATER]: [],
    
    [VoxelType.SAND]: [],
    
    [VoxelType.SNOW]: [],
    
    [VoxelType.ICE]: []
};