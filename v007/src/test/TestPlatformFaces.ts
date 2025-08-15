import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';
import { SimpleBakedMeshGenerator } from '../engine/SimpleBakedMeshGenerator';

/**
 * Test face generation for a platform (should have visible top faces)
 */
export function testPlatformFaces() {
    console.log('=== Testing Platform Face Generation ===');
    
    // Create a 3x1x3 platform (flat, one layer high)
    const voxels = new Map<string, VoxelType>();
    for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
            voxels.set(`${x},0,${z}`, VoxelType.GRASS);
        }
    }
    
    console.log('Created 3x1x3 platform (9 voxels)');
    console.log('Expected faces:');
    console.log('  - 1 top face (merged by greedy meshing)');
    console.log('  - 1 bottom face (merged)');
    console.log('  - 4 side faces (one per edge)');
    console.log('  Total: 6 faces with greedy meshing');
    
    // Test with SimpleBakedMeshGenerator
    console.log('\n--- Simple Generator (no merging) ---');
    const simpleGen = new SimpleBakedMeshGenerator(0.1);
    const simpleResult = simpleGen.generateSimpleMesh(voxels);
    console.log('Simple faces:', simpleResult.metadata.faceCount);
    console.log('Expected: 9 top + 9 bottom + 12 sides = 30 faces');
    
    // Test with BakedMeshGenerator
    console.log('\n--- Baked Generator (with greedy meshing) ---');
    const bakedGen = new BakedMeshGenerator(0.1);
    const bakedResult = bakedGen.generateOptimizedMesh(voxels);
    console.log('Baked faces:', bakedResult.metadata.faceCount);
    
    // Check face reduction
    const reduction = ((1 - bakedResult.metadata.faceCount / simpleResult.metadata.faceCount) * 100).toFixed(1);
    console.log(`\nFace reduction: ${reduction}%`);
    
    // List face positions and normals if available
    if (bakedResult.opaqueMesh) {
        const positions = bakedResult.opaqueMesh.geometry.getAttribute('position');
        const normals = bakedResult.opaqueMesh.geometry.getAttribute('normal');
        
        console.log('\nFace details (first vertex of each face):');
        for (let i = 0; i < bakedResult.metadata.faceCount; i++) {
            const idx = i * 4 * 3; // 4 vertices per face, 3 components per vertex
            const pos = [
                positions.array[idx].toFixed(1),
                positions.array[idx + 1].toFixed(1),
                positions.array[idx + 2].toFixed(1)
            ];
            const norm = [
                normals.array[idx].toFixed(0),
                normals.array[idx + 1].toFixed(0),
                normals.array[idx + 2].toFixed(0)
            ];
            console.log(`  Face ${i}: pos=(${pos.join(',')}) normal=(${norm.join(',')})`);
            
            // Highlight top faces
            if (parseFloat(norm[1]) > 0) {
                console.log('    ^ This is a TOP face');
            }
        }
    }
}

// Make it available globally
(window as any).testPlatformFaces = testPlatformFaces;