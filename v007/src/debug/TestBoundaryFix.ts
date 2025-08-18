import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';

/**
 * Test that boundary face detection is fixed
 */
export function testBoundaryFix() {
    console.log('=== Test Boundary Fix ===');
    
    // Test 1: Single voxel at origin - should have all 6 faces
    console.log('\nTest 1: Single voxel at origin (0,0,0)');
    const singleVoxel = new Map<string, VoxelType>();
    singleVoxel.set('0,0,0', VoxelType.STONE);
    
    const gen1 = new BakedMeshGenerator(0.1);
    const result1 = gen1.generateOptimizedMesh(singleVoxel);
    
    console.log('Generated faces:', result1.metadata.faceCount);
    console.log('Expected: 6 faces (one per side)');
    console.log(result1.metadata.faceCount === 6 ? '✓ PASS' : '✗ FAIL');
    
    // Test 2: 2x2x2 cube at origin - should have 24 exterior faces
    console.log('\nTest 2: 2x2x2 cube at origin');
    const cube = new Map<string, VoxelType>();
    for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
                cube.set(`${x},${y},${z}`, VoxelType.STONE);
            }
        }
    }
    
    const gen2 = new BakedMeshGenerator(0.1);
    const result2 = gen2.generateOptimizedMesh(cube);
    
    console.log('Generated faces:', result2.metadata.faceCount);
    console.log('Expected: 6 faces (with perfect greedy meshing)');
    console.log('Note: Each side should be one 2x2 merged face');
    
    // Test 3: Hollow frame (like in the screenshot)
    console.log('\nTest 3: Hollow frame structure');
    const frame = new Map<string, VoxelType>();
    
    // Create a 5x5x1 frame (hollow square)
    for (let x = 0; x < 5; x++) {
        for (let z = 0; z < 5; z++) {
            // Only place voxels on the edges
            if (x === 0 || x === 4 || z === 0 || z === 4) {
                frame.set(`${x},0,${z}`, VoxelType.STONE);
            }
        }
    }
    
    const gen3 = new BakedMeshGenerator(0.1);
    const result3 = gen3.generateOptimizedMesh(frame);
    
    console.log('Generated faces:', result3.metadata.faceCount);
    console.log('This should include:');
    console.log('- Exterior faces on all sides');
    console.log('- Interior faces facing the hollow center');
    console.log('- All boundary faces at the edges');
    
    // Count voxels with interior faces
    let interiorFaceCount = 0;
    for (let x = 1; x < 4; x++) {
        if (frame.has(`${x},0,1`)) interiorFaceCount++; // Bottom edge
        if (frame.has(`${x},0,3`)) interiorFaceCount++; // Top edge
    }
    for (let z = 1; z < 4; z++) {
        if (frame.has(`1,0,${z}`)) interiorFaceCount++; // Left edge
        if (frame.has(`3,0,${z}`)) interiorFaceCount++; // Right edge
    }
    
    console.log(`Expected at least ${interiorFaceCount} interior-facing segments`);
    
    return {
        singleVoxelPassed: result1.metadata.faceCount === 6,
        results: [result1, result2, result3]
    };
}

// Make available globally
(window as any).testBoundaryFix = testBoundaryFix;