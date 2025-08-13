import { VoxWriter } from '../io/VoxWriter';
import { VoxelType } from '../engine/VoxelEngine';
import * as fs from 'fs';
import * as path from 'path';

// Create sample assets for each voxel type
async function createSampleAssets() {
    const writer = new VoxWriter();
    const basePath = path.join(__dirname, '../../public/assets');
    
    // Ensure directories exist
    const types = ['grass', 'stone', 'wood', 'dirt', 'leaves', 'water', 'sand', 'snow', 'ice'];
    for (const type of types) {
        const dir = path.join(basePath, type);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    
    // GRASS ASSETS
    // Small tree (3x5x3)
    const smallTreeVoxels = new Map<VoxelType, Set<string>>();
    const woodTrunk = new Set<string>();
    woodTrunk.add('1,0,1');
    woodTrunk.add('1,1,1');
    woodTrunk.add('1,2,1');
    smallTreeVoxels.set(VoxelType.WOOD, woodTrunk);
    
    const treeLeaves = new Set<string>();
    // Top
    treeLeaves.add('1,4,1');
    // Upper crown
    ['0,3,1', '1,3,0', '1,3,1', '1,3,2', '2,3,1'].forEach(v => treeLeaves.add(v));
    // Lower crown
    for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
            if (x !== 1 || z !== 1) treeLeaves.add(`${x},2,${z}`);
        }
    }
    smallTreeVoxels.set(VoxelType.LEAVES, treeLeaves);
    
    const smallTreeBuffer = writer.createVoxFile(smallTreeVoxels);
    fs.writeFileSync(path.join(basePath, 'grass/small_tree.vox'), Buffer.from(smallTreeBuffer));
    console.log('Created grass/small_tree.vox');
    
    // Large tree (5x7x5)
    const largeTreeVoxels = new Map<VoxelType, Set<string>>();
    const largeTrunk = new Set<string>();
    // Thick trunk
    for (let y = 0; y < 4; y++) {
        largeTrunk.add(`2,${y},2`);
        if (y < 3) {
            largeTrunk.add(`1,${y},2`);
            largeTrunk.add(`2,${y},1`);
            largeTrunk.add(`3,${y},2`);
            largeTrunk.add(`2,${y},3`);
        }
    }
    largeTreeVoxels.set(VoxelType.WOOD, largeTrunk);
    
    const largeCrown = new Set<string>();
    // Large crown
    for (let y = 3; y < 7; y++) {
        const radius = y === 6 ? 1 : 2;
        for (let x = 2 - radius; x <= 2 + radius; x++) {
            for (let z = 2 - radius; z <= 2 + radius; z++) {
                if (x >= 0 && x < 5 && z >= 0 && z < 5) {
                    largeCrown.add(`${x},${y},${z}`);
                }
            }
        }
    }
    largeTreeVoxels.set(VoxelType.LEAVES, largeCrown);
    
    const largeTreeBuffer = writer.createVoxFile(largeTreeVoxels);
    fs.writeFileSync(path.join(basePath, 'grass/large_tree.vox'), Buffer.from(largeTreeBuffer));
    console.log('Created grass/large_tree.vox');
    
    // Flower (1x2x1)
    const flowerVoxels = new Map<VoxelType, Set<string>>();
    const stem = new Set<string>();
    stem.add('0,0,0');
    flowerVoxels.set(VoxelType.GRASS, stem);
    const flower = new Set<string>();
    flower.add('0,1,0');
    flowerVoxels.set(VoxelType.LEAVES, flower);
    
    const flowerBuffer = writer.createVoxFile(flowerVoxels);
    fs.writeFileSync(path.join(basePath, 'grass/flower.vox'), Buffer.from(flowerBuffer));
    console.log('Created grass/flower.vox');
    
    // STONE ASSETS
    // Small rock (2x1x2)
    const smallRockVoxels = new Map<VoxelType, Set<string>>();
    const smallStone = new Set<string>();
    smallStone.add('0,0,0');
    smallStone.add('0,0,1');
    smallStone.add('1,0,0');
    smallStone.add('1,0,1');
    smallRockVoxels.set(VoxelType.STONE, smallStone);
    
    const smallRockBuffer = writer.createVoxFile(smallRockVoxels);
    fs.writeFileSync(path.join(basePath, 'stone/small_rock.vox'), Buffer.from(smallRockBuffer));
    console.log('Created stone/small_rock.vox');
    
    // Large rock (3x2x3)
    const largeRockVoxels = new Map<VoxelType, Set<string>>();
    const largeStone = new Set<string>();
    // Bottom layer - full
    for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
            largeStone.add(`${x},0,${z}`);
        }
    }
    // Top layer - irregular
    largeStone.add('0,1,1');
    largeStone.add('1,1,0');
    largeStone.add('1,1,1');
    largeStone.add('1,1,2');
    largeStone.add('2,1,1');
    largeRockVoxels.set(VoxelType.STONE, largeStone);
    
    const largeRockBuffer = writer.createVoxFile(largeRockVoxels);
    fs.writeFileSync(path.join(basePath, 'stone/large_rock.vox'), Buffer.from(largeRockBuffer));
    console.log('Created stone/large_rock.vox');
    
    // Pillar (1x4x1)
    const pillarVoxels = new Map<VoxelType, Set<string>>();
    const pillarStone = new Set<string>();
    for (let y = 0; y < 4; y++) {
        pillarStone.add(`0,${y},0`);
    }
    pillarVoxels.set(VoxelType.STONE, pillarStone);
    
    const pillarBuffer = writer.createVoxFile(pillarVoxels);
    fs.writeFileSync(path.join(basePath, 'stone/pillar.vox'), Buffer.from(pillarBuffer));
    console.log('Created stone/pillar.vox');
    
    // WOOD ASSETS
    // Crate (2x2x2)
    const crateVoxels = new Map<VoxelType, Set<string>>();
    const crateWood = new Set<string>();
    for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
                crateWood.add(`${x},${y},${z}`);
            }
        }
    }
    crateVoxels.set(VoxelType.WOOD, crateWood);
    
    const crateBuffer = writer.createVoxFile(crateVoxels);
    fs.writeFileSync(path.join(basePath, 'wood/crate.vox'), Buffer.from(crateBuffer));
    console.log('Created wood/crate.vox');
    
    // Barrel (2x3x2)
    const barrelVoxels = new Map<VoxelType, Set<string>>();
    const barrelWood = new Set<string>();
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 2; x++) {
            for (let z = 0; z < 2; z++) {
                barrelWood.add(`${x},${y},${z}`);
            }
        }
    }
    barrelVoxels.set(VoxelType.WOOD, barrelWood);
    
    const barrelBuffer = writer.createVoxFile(barrelVoxels);
    fs.writeFileSync(path.join(basePath, 'wood/barrel.vox'), Buffer.from(barrelBuffer));
    console.log('Created wood/barrel.vox');
    
    // Fence (4x2x1)
    const fenceVoxels = new Map<VoxelType, Set<string>>();
    const fenceWood = new Set<string>();
    // Posts
    fenceWood.add('0,0,0');
    fenceWood.add('0,1,0');
    fenceWood.add('3,0,0');
    fenceWood.add('3,1,0');
    // Rails
    fenceWood.add('1,1,0');
    fenceWood.add('2,1,0');
    fenceVoxels.set(VoxelType.WOOD, fenceWood);
    
    const fenceBuffer = writer.createVoxFile(fenceVoxels);
    fs.writeFileSync(path.join(basePath, 'wood/fence.vox'), Buffer.from(fenceBuffer));
    console.log('Created wood/fence.vox');
    
    // LEAVES ASSETS
    // Bush (2x2x2)
    const bushVoxels = new Map<VoxelType, Set<string>>();
    const bushLeaves = new Set<string>();
    for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
                bushLeaves.add(`${x},${y},${z}`);
            }
        }
    }
    bushVoxels.set(VoxelType.LEAVES, bushLeaves);
    
    const bushBuffer = writer.createVoxFile(bushVoxels);
    fs.writeFileSync(path.join(basePath, 'leaves/bush.vox'), Buffer.from(bushBuffer));
    console.log('Created leaves/bush.vox');
    
    // Hedge (4x2x1)
    const hedgeVoxels = new Map<VoxelType, Set<string>>();
    const hedgeLeaves = new Set<string>();
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 2; y++) {
            hedgeLeaves.add(`${x},${y},0`);
        }
    }
    hedgeVoxels.set(VoxelType.LEAVES, hedgeLeaves);
    
    const hedgeBuffer = writer.createVoxFile(hedgeVoxels);
    fs.writeFileSync(path.join(basePath, 'leaves/hedge.vox'), Buffer.from(hedgeBuffer));
    console.log('Created leaves/hedge.vox');
    
    // Topiary (2x3x2)
    const topiaryVoxels = new Map<VoxelType, Set<string>>();
    const topiaryLeaves = new Set<string>();
    // Sphere-like shape
    for (let y = 0; y < 3; y++) {
        const shrink = y === 0 || y === 2 ? 1 : 0;
        for (let x = shrink; x < 2 - shrink; x++) {
            for (let z = shrink; z < 2 - shrink; z++) {
                topiaryLeaves.add(`${x},${y},${z}`);
            }
        }
    }
    // Full middle layer
    for (let x = 0; x < 2; x++) {
        for (let z = 0; z < 2; z++) {
            topiaryLeaves.add(`${x},1,${z}`);
        }
    }
    topiaryVoxels.set(VoxelType.LEAVES, topiaryLeaves);
    
    const topiaryBuffer = writer.createVoxFile(topiaryVoxels);
    fs.writeFileSync(path.join(basePath, 'leaves/topiary.vox'), Buffer.from(topiaryBuffer));
    console.log('Created leaves/topiary.vox');
    
    console.log('\nAll sample assets created successfully!');
    console.log('Assets are located in public/assets/');
}

// Run if called directly
if (require.main === module) {
    createSampleAssets().catch(console.error);
}

export { createSampleAssets };