import { VoxelType } from '../engine/VoxelEngine';
import { AssetInfo } from './types';

// Default assets that ship with the application
// These will be stored as .vox files in the public/assets folder
export const DEFAULT_ASSETS: Partial<Record<VoxelType, AssetInfo[]>> = {
    [VoxelType.AIR]: [],
    
    [VoxelType.GRASS]: [
        {
            id: 'grass_patch',
            name: 'Grass Patch',
            type: VoxelType.GRASS,
            path: '/assets/grass/grass_patch.vox',
            size: { x: 3, y: 1, z: 3 },
            tags: ['grass', 'ground', 'flat']
        },
        {
            id: 'grass_hill',
            name: 'Small Hill',
            type: VoxelType.GRASS,
            path: '/assets/grass/grass_hill.vox',
            size: { x: 5, y: 3, z: 5 },
            tags: ['grass', 'hill', 'terrain']
        },
        {
            id: 'grass_steps',
            name: 'Grass Steps',
            type: VoxelType.GRASS,
            path: '/assets/grass/grass_steps.vox',
            size: { x: 4, y: 3, z: 4 },
            tags: ['grass', 'steps', 'terrain']
        }
    ],
    
    [VoxelType.DIRT]: [
        {
            id: 'dirt_mound',
            name: 'Dirt Mound',
            type: VoxelType.DIRT,
            path: '/assets/dirt/dirt_mound.vox',
            size: { x: 3, y: 2, z: 3 },
            tags: ['dirt', 'mound', 'terrain']
        },
        {
            id: 'dirt_path',
            name: 'Dirt Path',
            type: VoxelType.DIRT,
            path: '/assets/dirt/dirt_path.vox',
            size: { x: 5, y: 1, z: 2 },
            tags: ['dirt', 'path', 'road']
        },
        {
            id: 'dirt_pile',
            name: 'Dirt Pile',
            type: VoxelType.DIRT,
            path: '/assets/dirt/dirt_pile.vox',
            size: { x: 2, y: 2, z: 2 },
            tags: ['dirt', 'pile', 'small']
        }
    ],
    
    [VoxelType.STONE]: [
        {
            id: 'stone_block',
            name: 'Stone Block',
            type: VoxelType.STONE,
            path: '/assets/stone/stone_block.vox',
            size: { x: 2, y: 2, z: 2 },
            tags: ['stone', 'block', 'cube']
        },
        {
            id: 'stone_wall',
            name: 'Stone Wall',
            type: VoxelType.STONE,
            path: '/assets/stone/stone_wall.vox',
            size: { x: 4, y: 3, z: 1 },
            tags: ['stone', 'wall', 'barrier']
        },
        {
            id: 'stone_pillar',
            name: 'Stone Pillar',
            type: VoxelType.STONE,
            path: '/assets/stone/stone_pillar.vox',
            size: { x: 1, y: 4, z: 1 },
            tags: ['pillar', 'column', 'structure']
        }
    ],
    
    [VoxelType.WOOD]: [
        {
            id: 'wood_plank',
            name: 'Wood Plank',
            type: VoxelType.WOOD,
            path: '/assets/wood/wood_plank.vox',
            size: { x: 3, y: 1, z: 1 },
            tags: ['wood', 'plank', 'board']
        },
        {
            id: 'wood_post',
            name: 'Wood Post',
            type: VoxelType.WOOD,
            path: '/assets/wood/wood_post.vox',
            size: { x: 1, y: 3, z: 1 },
            tags: ['wood', 'post', 'pillar']
        },
        {
            id: 'wood_floor',
            name: 'Wood Floor',
            type: VoxelType.WOOD,
            path: '/assets/wood/wood_floor.vox',
            size: { x: 3, y: 1, z: 3 },
            tags: ['wood', 'floor', 'platform']
        }
    ],
    
    [VoxelType.LEAVES]: [
        {
            id: 'leaves_bush',
            name: 'Leaves Bush',
            type: VoxelType.LEAVES,
            path: '/assets/leaves/leaves_bush.vox',
            size: { x: 2, y: 2, z: 2 },
            tags: ['bush', 'nature', 'foliage']
        },
        {
            id: 'leaves_hedge',
            name: 'Leaves Hedge',
            type: VoxelType.LEAVES,
            path: '/assets/leaves/leaves_hedge.vox',
            size: { x: 4, y: 2, z: 1 },
            tags: ['hedge', 'decoration', 'barrier']
        },
        {
            id: 'leaves_sphere',
            name: 'Leaves Sphere',
            type: VoxelType.LEAVES,
            path: '/assets/leaves/leaves_sphere.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['sphere', 'round', 'foliage']
        }
    ],
    
    [VoxelType.WATER]: [
        {
            id: 'water_pool',
            name: 'Water Pool',
            type: VoxelType.WATER,
            path: '/assets/water/water_pool.vox',
            size: { x: 3, y: 1, z: 3 },
            tags: ['water', 'pool', 'pond']
        },
        {
            id: 'water_stream',
            name: 'Water Stream',
            type: VoxelType.WATER,
            path: '/assets/water/water_stream.vox',
            size: { x: 5, y: 1, z: 1 },
            tags: ['water', 'stream', 'river']
        },
        {
            id: 'water_fall',
            name: 'Water Fall',
            type: VoxelType.WATER,
            path: '/assets/water/water_fall.vox',
            size: { x: 1, y: 4, z: 1 },
            tags: ['water', 'waterfall', 'cascade']
        }
    ],
    
    [VoxelType.SAND]: [
        {
            id: 'sand_dune',
            name: 'Sand Dune',
            type: VoxelType.SAND,
            path: '/assets/sand/sand_dune.vox',
            size: { x: 4, y: 2, z: 3 },
            tags: ['sand', 'dune', 'desert']
        },
        {
            id: 'sand_castle',
            name: 'Sand Castle',
            type: VoxelType.SAND,
            path: '/assets/sand/sand_castle.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['sand', 'castle', 'beach']
        },
        {
            id: 'sand_path',
            name: 'Sand Path',
            type: VoxelType.SAND,
            path: '/assets/sand/sand_path.vox',
            size: { x: 3, y: 1, z: 3 },
            tags: ['sand', 'path', 'trail']
        }
    ],
    
    [VoxelType.SNOW]: [
        {
            id: 'snow_pile',
            name: 'Snow Pile',
            type: VoxelType.SNOW,
            path: '/assets/snow/snow_pile.vox',
            size: { x: 3, y: 2, z: 3 },
            tags: ['snow', 'pile', 'mound']
        },
        {
            id: 'snowman',
            name: 'Snowman',
            type: VoxelType.SNOW,
            path: '/assets/snow/snowman.vox',
            size: { x: 2, y: 3, z: 2 },
            tags: ['snow', 'snowman', 'winter']
        },
        {
            id: 'snow_wall',
            name: 'Snow Wall',
            type: VoxelType.SNOW,
            path: '/assets/snow/snow_wall.vox',
            size: { x: 4, y: 2, z: 1 },
            tags: ['snow', 'wall', 'barrier']
        }
    ],
    
    [VoxelType.ICE]: [
        {
            id: 'ice_block',
            name: 'Ice Block',
            type: VoxelType.ICE,
            path: '/assets/ice/ice_block.vox',
            size: { x: 2, y: 2, z: 2 },
            tags: ['ice', 'block', 'cube']
        },
        {
            id: 'ice_spike',
            name: 'Ice Spike',
            type: VoxelType.ICE,
            path: '/assets/ice/ice_spike.vox',
            size: { x: 2, y: 4, z: 2 },
            tags: ['ice', 'spike', 'icicle']
        },
        {
            id: 'ice_platform',
            name: 'Ice Platform',
            type: VoxelType.ICE,
            path: '/assets/ice/ice_platform.vox',
            size: { x: 3, y: 1, z: 3 },
            tags: ['ice', 'platform', 'floor']
        }
    ]
};