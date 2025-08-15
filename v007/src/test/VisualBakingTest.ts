import * as THREE from 'three';
import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';
import { SimpleBakedMeshGenerator } from '../engine/SimpleBakedMeshGenerator';
import { VoxelLayer } from '../engine/VoxelLayer';

/**
 * Visual test for baking system that creates a simple structure
 * and shows before/after baking
 */
export function visualBakingTest(scene: THREE.Scene, voxelEngine: any) {
    console.log('=== Visual Baking Test ===');
    
    // Create a new layer for testing
    const testLayer = new VoxelLayer('Baking Test Layer', voxelEngine.renderer);
    
    // Create a simple L-shaped structure
    const positions = [
        // Base
        [0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0],
        [0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 0, 1],
        [0, 0, 2], [1, 0, 2], [2, 0, 2], [3, 0, 2],
        // Wall
        [0, 1, 0], [0, 2, 0], [0, 3, 0],
        [0, 1, 1], [0, 2, 1], [0, 3, 1],
        [0, 1, 2], [0, 2, 2], [0, 3, 2],
    ];
    
    // Add voxels to layer
    for (const [x, y, z] of positions) {
        testLayer.setVoxel(`${x},${y},${z}`, VoxelType.STONE);
    }
    
    console.log(`Created test structure with ${testLayer.getVoxelCount()} voxels`);
    
    // Add layer to engine
    voxelEngine.addLayer(testLayer);
    
    // Create comparison meshes
    const voxelSize = 0.1;
    const offset = new THREE.Vector3(10, 0, 0); // Offset for side-by-side comparison
    
    // Get voxels using the getVoxels method
    const voxelMap = testLayer.getVoxels();
    
    // Generate simple mesh (all faces)
    console.log('\nGenerating simple mesh...');
    const simpleGen = new SimpleBakedMeshGenerator(voxelSize);
    const simpleResult = simpleGen.generateSimpleMesh(voxelMap);
    
    if (simpleResult.opaqueMesh) {
        simpleResult.opaqueMesh.position.copy(offset);
        scene.add(simpleResult.opaqueMesh);
        console.log(`Simple mesh: ${simpleResult.metadata.faceCount} faces, ${simpleResult.metadata.vertexCount} vertices`);
    }
    
    // Generate optimized mesh (greedy meshing)
    console.log('\nGenerating optimized mesh...');
    const bakedGen = new BakedMeshGenerator(voxelSize);
    const bakedResult = bakedGen.generateOptimizedMesh(voxelMap);
    
    if (bakedResult.opaqueMesh) {
        bakedResult.opaqueMesh.position.copy(offset.clone().multiplyScalar(2));
        scene.add(bakedResult.opaqueMesh);
        console.log(`Optimized mesh: ${bakedResult.metadata.faceCount} faces, ${bakedResult.metadata.vertexCount} vertices`);
    }
    
    // Calculate reduction
    const reduction = ((1 - bakedResult.metadata.faceCount / simpleResult.metadata.faceCount) * 100).toFixed(1);
    console.log(`\nFace reduction: ${reduction}%`);
    
    // Test actual baking functionality
    console.log('\nTesting layer baking...');
    const voxelCountBefore = testLayer.getVoxelCount();
    testLayer.bake(voxelSize);
    const voxelCountAfter = testLayer.getVoxelCount();
    
    console.log(`Layer baked: ${testLayer.isBaked}`);
    console.log(`Voxel count before: ${voxelCountBefore}, after: ${voxelCountAfter}`);
    console.log(`Has baked mesh: ${!!testLayer.bakedOpaqueMesh}`);
    
    // Test unbaking
    console.log('\nTesting unbaking...');
    testLayer.unbake();
    const voxelCountUnbaked = testLayer.getVoxelCount();
    console.log(`Layer unbaked: ${!testLayer.isBaked}`);
    console.log(`Voxel count after unbaking: ${voxelCountUnbaked}`);
    
    return {
        layer: testLayer,
        simpleResult,
        bakedResult
    };
}

// Make available globally
(window as any).visualBakingTest = visualBakingTest;