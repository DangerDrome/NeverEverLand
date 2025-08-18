import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';
import { SimpleBakedMeshGenerator } from '../engine/SimpleBakedMeshGenerator';

/**
 * Debug baking with detailed logging
 */
export function debugBaking() {
    console.log('=== Debug Baking ===');
    
    // Create a simple 2x2x2 cube for easier debugging
    const voxels = new Map<string, VoxelType>();
    for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
                voxels.set(`${x},${y},${z}`, VoxelType.GRASS);
            }
        }
    }
    
    console.log('Created 2x2x2 cube with voxels at:');
    for (const key of voxels.keys()) {
        console.log('  ', key);
    }
    
    // Test with SimpleBakedMeshGenerator first
    console.log('\n--- Simple Generator (Expected: 24 faces) ---');
    const simpleGen = new SimpleBakedMeshGenerator(0.1);
    const simpleResult = simpleGen.generateSimpleMesh(voxels);
    console.log('Simple faces:', simpleResult.metadata.faceCount);
    
    // Test with BakedMeshGenerator
    console.log('\n--- Baked Generator (Expected: 6 faces) ---');
    const bakedGen = new BakedMeshGenerator(0.1);
    
    // Temporarily add debug logging to BakedMeshGenerator
    const originalGenerateFacesForAxis = bakedGen['generateFacesForAxis'];
    bakedGen['generateFacesForAxis'] = function(voxelMap: Map<string, VoxelType>, axis: 'x' | 'y' | 'z') {
        console.log(`\nProcessing ${axis} axis:`);
        const result = originalGenerateFacesForAxis.call(this, voxelMap, axis);
        console.log(`  Generated ${result.length} faces`);
        return result;
    };
    
    const bakedResult = bakedGen.generateOptimizedMesh(voxels);
    console.log('\nTotal baked faces:', bakedResult.metadata.faceCount);
    
    // Log face details if available
    if (bakedResult.opaqueMesh) {
        const positions = bakedResult.opaqueMesh.geometry.getAttribute('position');
        console.log('\nFirst face position:', 
            positions.array[0].toFixed(2), 
            positions.array[1].toFixed(2), 
            positions.array[2].toFixed(2)
        );
    }
}

// Make it available globally
(window as any).debugBaking = debugBaking;