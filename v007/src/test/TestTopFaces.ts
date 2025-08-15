import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';
import { SimpleBakedMeshGenerator } from '../engine/SimpleBakedMeshGenerator';

/**
 * Test specifically for top face generation
 */
export function testTopFaces() {
    console.log('=== Testing Top Face Generation ===');
    
    // Create a single voxel at origin to test all 6 faces
    const voxels = new Map<string, VoxelType>();
    voxels.set('0,0,0', VoxelType.GRASS);
    
    console.log('Created single voxel at (0,0,0)');
    console.log('Expected: 6 faces (one for each direction)');
    
    // Test with SimpleBakedMeshGenerator
    console.log('\n--- Simple Generator ---');
    const simpleGen = new SimpleBakedMeshGenerator(0.1);
    const simpleResult = simpleGen.generateSimpleMesh(voxels);
    console.log('Simple faces:', simpleResult.metadata.faceCount);
    
    // Test with BakedMeshGenerator
    console.log('\n--- Baked Generator ---');
    const bakedGen = new BakedMeshGenerator(0.1);
    
    // Patch to add logging
    const originalGenerateFacesForAxis = bakedGen['generateFacesForAxis'];
    bakedGen['generateFacesForAxis'] = function(voxelMap: Map<string, VoxelType>, axis: 'x' | 'y' | 'z') {
        console.log(`\nChecking ${axis} axis:`);
        
        // Get bounds
        const bounds = this['getBounds'](voxelMap);
        if (bounds) {
            console.log(`  Bounds: [${bounds.min.join(',')}] to [${bounds.max.join(',')}]`);
            console.log(`  Will check slices from ${bounds.min[axis === 'x' ? 0 : axis === 'y' ? 1 : 2]} to ${bounds.max[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] + 1}`);
        }
        
        const result = originalGenerateFacesForAxis.call(this, voxelMap, axis);
        console.log(`  Generated ${result.length} faces`);
        
        // Log face details
        result.forEach((face, i) => {
            console.log(`    Face ${i}: pos=(${face.x},${face.y},${face.z}) normal=(${face.normal.x},${face.normal.y},${face.normal.z})`);
        });
        
        return result;
    };
    
    const bakedResult = bakedGen.generateOptimizedMesh(voxels);
    console.log('\nTotal baked faces:', bakedResult.metadata.faceCount);
    
    // Check if we have all 6 faces
    if (bakedResult.metadata.faceCount === 6) {
        console.log('✅ All faces generated correctly!');
    } else {
        console.log('❌ Missing faces! Expected 6, got', bakedResult.metadata.faceCount);
    }
}

// Make it available globally
(window as any).testTopFaces = testTopFaces;