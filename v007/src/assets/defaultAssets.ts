import { VoxelType } from '../engine/VoxelEngine';
import { AssetInfo } from './types';

// Default assets that ship with the application
// These will be stored as .vox files in the public/assets folder
export const DEFAULT_ASSETS: Partial<Record<VoxelType, AssetInfo[]>> = {
    [VoxelType.AIR]: [],
    
    [VoxelType.GRASS]: [
        {
            id: 'grass_hill',
            name: 'Grass Hill',
            type: VoxelType.GRASS,
            path: '/assets/grass/grass_hill.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['grass', 'hill', 'terrain']
        },
        {
            id: 'grass_patch',
            name: 'Grass Patch',
            type: VoxelType.GRASS,
            path: '/assets/grass/grass_patch.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['grass']
        },
        {
            id: 'grass_patch_01',
            name: 'Grass Patch 01',
            type: VoxelType.GRASS,
            path: '/assets/grass/grass_patch_01.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['grass']
        },
        {
            id: 'grass_steps',
            name: 'Grass Steps',
            type: VoxelType.GRASS,
            path: '/assets/grass/grass_steps.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['grass', 'steps', 'terrain']
        }
    ],
    
    [VoxelType.DIRT]: [
        {
            id: 'dirt_mound',
            name: 'Dirt Mound',
            type: VoxelType.DIRT,
            path: '/assets/dirt/dirt_mound.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['dirt', 'hill', 'terrain']
        },
        {
            id: 'dirt_path',
            name: 'Dirt Path',
            type: VoxelType.DIRT,
            path: '/assets/dirt/dirt_path.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['dirt', 'path', 'road']
        },
        {
            id: 'dirt_pile',
            name: 'Dirt Pile',
            type: VoxelType.DIRT,
            path: '/assets/dirt/dirt_pile.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['dirt', 'pile']
        }
    ],
    
    [VoxelType.STONE]: [
        {
            id: 'stone_block',
            name: 'Stone Block',
            type: VoxelType.STONE,
            path: '/assets/stone/stone_block.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['stone', 'block', 'cube']
        },
        {
            id: 'stone_pillar',
            name: 'Stone Pillar',
            type: VoxelType.STONE,
            path: '/assets/stone/stone_pillar.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['stone', 'pillar', 'column']
        },
        {
            id: 'stone_wall',
            name: 'Stone Wall',
            type: VoxelType.STONE,
            path: '/assets/stone/stone_wall.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['stone', 'wall', 'barrier']
        }
    ],
    
    [VoxelType.WOOD]: [
        {
            id: 'wood_floor',
            name: 'Wood Floor',
            type: VoxelType.WOOD,
            path: '/assets/wood/wood_floor.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['wood', 'floor', 'platform']
        },
        {
            id: 'wood_plank',
            name: 'Wood Plank',
            type: VoxelType.WOOD,
            path: '/assets/wood/wood_plank.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['wood']
        },
        {
            id: 'wood_post',
            name: 'Wood Post',
            type: VoxelType.WOOD,
            path: '/assets/wood/wood_post.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['wood', 'pillar', 'column']
        }
    ],
    
    [VoxelType.LEAVES]: [
        {
            id: 'leaves_bush',
            name: 'Leaves Bush',
            type: VoxelType.LEAVES,
            path: '/assets/leaves/leaves_bush.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['leaves', 'bush', 'nature']
        },
        {
            id: 'leaves_hedge',
            name: 'Leaves Hedge',
            type: VoxelType.LEAVES,
            path: '/assets/leaves/leaves_hedge.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['leaves', 'hedge', 'decoration']
        },
        {
            id: 'leaves_sphere',
            name: 'Leaves Sphere',
            type: VoxelType.LEAVES,
            path: '/assets/leaves/leaves_sphere.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['leaves', 'sphere', 'round']
        }
    ],
    
    [VoxelType.WATER]: [
        {
            id: 'water_fall',
            name: 'Water Fall',
            type: VoxelType.WATER,
            path: '/assets/water/water_fall.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['water', 'waterfall', 'cascade']
        },
        {
            id: 'water_pool',
            name: 'Water Pool',
            type: VoxelType.WATER,
            path: '/assets/water/water_pool.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['water', 'pool', 'pond']
        },
        {
            id: 'water_stream',
            name: 'Water Stream',
            type: VoxelType.WATER,
            path: '/assets/water/water_stream.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['water', 'stream', 'river']
        }
    ],
    
    [VoxelType.SAND]: [
        {
            id: 'sand_castle',
            name: 'Sand Castle',
            type: VoxelType.SAND,
            path: '/assets/sand/sand_castle.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['sand', 'castle']
        },
        {
            id: 'sand_dune',
            name: 'Sand Dune',
            type: VoxelType.SAND,
            path: '/assets/sand/sand_dune.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['sand', 'dune', 'desert']
        },
        {
            id: 'sand_path',
            name: 'Sand Path',
            type: VoxelType.SAND,
            path: '/assets/sand/sand_path.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['sand', 'path', 'road']
        }
    ],
    
    [VoxelType.SNOW]: [
        {
            id: 'snow_pile',
            name: 'Snow Pile',
            type: VoxelType.SNOW,
            path: '/assets/snow/snow_pile.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['snow', 'pile']
        },
        {
            id: 'snow_wall',
            name: 'Snow Wall',
            type: VoxelType.SNOW,
            path: '/assets/snow/snow_wall.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['snow', 'wall', 'barrier']
        },
        {
            id: 'snowman',
            name: 'Snowman',
            type: VoxelType.SNOW,
            path: '/assets/snow/snowman.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['snow', 'snowman']
        }
    ],
    
    [VoxelType.ICE]: [
        {
            id: 'ice_block',
            name: 'Ice Block',
            type: VoxelType.ICE,
            path: '/assets/ice/ice_block.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['ice', 'block', 'cube']
        },
        {
            id: 'ice_platform',
            name: 'Ice Platform',
            type: VoxelType.ICE,
            path: '/assets/ice/ice_platform.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['ice']
        },
        {
            id: 'ice_spike',
            name: 'Ice Spike',
            type: VoxelType.ICE,
            path: '/assets/ice/ice_spike.vox',
            size: { x: 3, y: 3, z: 3 },
            tags: ['ice', 'spike']
        }
    ],
};
