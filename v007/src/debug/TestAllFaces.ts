import { VoxelType } from '../types';
import { AllFacesBakedMeshGenerator } from '../engine/AllFacesBakedMeshGenerator';

/**
 * Test that AllFacesBakedMeshGenerator creates faces with proper culling
 */
export function testAllFaces() {
    console.log('=== Test All Faces Generator (with Face Culling) ===');
    
    // Test 1: Single voxel - should have exactly 6 faces
    console.log('\nTest 1: Single voxel');
    const single = new Map<string, VoxelType>();
    single.set('0,0,0', VoxelType.STONE);
    
    const gen1 = new AllFacesBakedMeshGenerator(0.1);
    const result1 = gen1.generateOptimizedMesh(single);
    
    console.log('Faces:', result1.metadata.faceCount);
    console.log('Expected: 6');
    console.log(result1.metadata.faceCount === 6 ? '✓ PASS' : '✗ FAIL');
    
    // Test 2: 3 voxels in a row - internal faces should be culled
    console.log('\nTest 2: Three voxels in a row');
    const row = new Map<string, VoxelType>();
    row.set('0,0,0', VoxelType.STONE);
    row.set('1,0,0', VoxelType.STONE);
    row.set('2,0,0', VoxelType.STONE);
    
    const gen2 = new AllFacesBakedMeshGenerator(0.1);
    const result2 = gen2.generateOptimizedMesh(row);
    
    console.log('Faces:', result2.metadata.faceCount);
    console.log('Expected: 14 (3×6=18 faces - 4 internal faces)');
    console.log('Internal faces culled: 2 between voxel 0-1, 2 between voxel 1-2');
    console.log(result2.metadata.faceCount === 14 ? '✓ PASS' : '✗ FAIL');
    
    // Test 3: 2x2x2 cube - many internal faces should be culled
    console.log('\nTest 3: 2x2x2 cube');
    const cube = new Map<string, VoxelType>();
    for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
                cube.set(`${x},${y},${z}`, VoxelType.STONE);
            }
        }
    }
    
    const gen3 = new AllFacesBakedMeshGenerator(0.1);
    const result3 = gen3.generateOptimizedMesh(cube);
    
    console.log('Faces:', result3.metadata.faceCount);
    console.log('Expected: 24 (only exterior faces, all internal faces culled)');
    console.log('Max possible: 48 (8 voxels × 6 faces)');
    console.log(result3.metadata.faceCount === 24 ? '✓ PASS' : '✗ FAIL');
    
    console.log('\n=== Summary ===');
    console.log('AllFacesBakedMeshGenerator now includes face culling:');
    console.log('- Internal faces between adjacent voxels are removed');
    console.log('- Only exterior faces are rendered');
    console.log('- This provides significant geometry reduction while maintaining water-tight meshes');
    
    return {
        test1Pass: result1.metadata.faceCount === 6,
        test2Pass: result2.metadata.faceCount === 14,
        test3Pass: result3.metadata.faceCount === 24
    };
}

// Make available globally
(window as any).testAllFaces = testAllFaces;