import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';
import { SimpleBakedMeshGenerator } from '../engine/SimpleBakedMeshGenerator';

/**
 * Test baking system with a simple 3x3x3 cube
 */
export function testBaking() {
    console.log('=== Testing Baking System ===');
    
    // Create a simple 3x3x3 cube of grass voxels
    const voxels = new Map<string, VoxelType>();
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            for (let z = 0; z < 3; z++) {
                voxels.set(`${x},${y},${z}`, VoxelType.GRASS);
            }
        }
    }
    
    console.log('Created test structure: 3x3x3 cube with', voxels.size, 'voxels');
    
    // Test SimpleBakedMeshGenerator
    console.log('\n--- Testing SimpleBakedMeshGenerator ---');
    const simpleGenerator = new SimpleBakedMeshGenerator(0.1);
    const simpleResult = simpleGenerator.generateSimpleMesh(voxels);
    
    console.log('Simple mesh results:');
    console.log('- Faces:', simpleResult.metadata.faceCount);
    console.log('- Vertices:', simpleResult.metadata.vertexCount);
    console.log('- Has opaque mesh:', !!simpleResult.opaqueMesh);
    console.log('- Has transparent mesh:', !!simpleResult.transparentMesh);
    
    if (simpleResult.opaqueMesh) {
        const positions = simpleResult.opaqueMesh.geometry.getAttribute('position');
        console.log('- Opaque mesh vertex count:', positions.count);
        
        // Log first few face positions
        console.log('First few faces:');
        for (let i = 0; i < Math.min(3, positions.count / 4); i++) {
            const baseIdx = i * 4 * 3; // 4 vertices per face, 3 components per vertex
            console.log(`  Face ${i}: vertex 0 at (${
                positions.array[baseIdx].toFixed(2)}, ${
                positions.array[baseIdx + 1].toFixed(2)}, ${
                positions.array[baseIdx + 2].toFixed(2)})`);
        }
    }
    
    // Test BakedMeshGenerator
    console.log('\n--- Testing BakedMeshGenerator ---');
    const bakedGenerator = new BakedMeshGenerator(0.1);
    const bakedResult = bakedGenerator.generateOptimizedMesh(voxels);
    
    console.log('Baked mesh results:');
    console.log('- Faces:', bakedResult.metadata.faceCount);
    console.log('- Vertices:', bakedResult.metadata.vertexCount);
    console.log('- Has opaque mesh:', !!bakedResult.opaqueMesh);
    console.log('- Has transparent mesh:', !!bakedResult.transparentMesh);
    
    if (bakedResult.opaqueMesh) {
        const positions = bakedResult.opaqueMesh.geometry.getAttribute('position');
        console.log('- Opaque mesh vertex count:', positions.count);
        
        // Log first few face positions
        console.log('First few faces:');
        for (let i = 0; i < Math.min(3, positions.count / 4); i++) {
            const baseIdx = i * 4 * 3; // 4 vertices per face, 3 components per vertex
            console.log(`  Face ${i}: vertex 0 at (${
                positions.array[baseIdx].toFixed(2)}, ${
                positions.array[baseIdx + 1].toFixed(2)}, ${
                positions.array[baseIdx + 2].toFixed(2)})`);
        }
    }
    
    // Compare results
    console.log('\n--- Comparison ---');
    console.log('Face reduction:', 
        ((1 - bakedResult.metadata.faceCount / simpleResult.metadata.faceCount) * 100).toFixed(1) + '%');
    console.log('Vertex reduction:', 
        ((1 - bakedResult.metadata.vertexCount / simpleResult.metadata.vertexCount) * 100).toFixed(1) + '%');
    
    // Expected: 3x3x3 cube should have 54 exposed faces total (6 faces per side, 9 voxels per face)
    // With greedy meshing, each side should become 1 large face, so 6 faces total
    console.log('\nExpected simple faces: 54 (6 sides × 9 voxels)');
    console.log('Expected greedy faces: 6 (1 per side)');
    
    return { simpleResult, bakedResult };
}

// Make it available globally for testing
(window as any).testBaking = testBaking;