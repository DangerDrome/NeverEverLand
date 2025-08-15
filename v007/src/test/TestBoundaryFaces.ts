import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';
import * as THREE from 'three';

/**
 * Test boundary face generation
 */
export function testBoundaryFaces() {
    console.log('=== Test Boundary Faces ===');
    
    // Create a simple line of voxels to test each axis
    const scenarios = [
        {
            name: 'X-axis line',
            voxels: [
                [0, 0, 0], [1, 0, 0], [2, 0, 0]
            ],
            expectedFaces: {
                'X-': 1, // at x=0
                'X+': 1, // at x=2
                'Y-': 3, // bottom faces
                'Y+': 3, // top faces
                'Z-': 3, // back faces
                'Z+': 3  // front faces
            }
        },
        {
            name: 'Y-axis line',
            voxels: [
                [0, 0, 0], [0, 1, 0], [0, 2, 0]
            ],
            expectedFaces: {
                'X-': 3,
                'X+': 3,
                'Y-': 1,
                'Y+': 1,
                'Z-': 3,
                'Z+': 3
            }
        },
        {
            name: 'Z-axis line',
            voxels: [
                [0, 0, 0], [0, 0, 1], [0, 0, 2]
            ],
            expectedFaces: {
                'X-': 3,
                'X+': 3,
                'Y-': 3,
                'Y+': 3,
                'Z-': 1,
                'Z+': 1
            }
        }
    ];
    
    for (const scenario of scenarios) {
        console.log(`\n--- ${scenario.name} ---`);
        
        // Create voxel map
        const voxelMap = new Map<string, VoxelType>();
        for (const [x, y, z] of scenario.voxels) {
            voxelMap.set(`${x},${y},${z}`, VoxelType.STONE);
        }
        
        // Generate mesh
        const generator = new BakedMeshGenerator(0.1);
        const result = generator.generateOptimizedMesh(voxelMap);
        
        if (!result.opaqueMesh) {
            console.error('No mesh generated!');
            continue;
        }
        
        // Count faces by normal direction
        const faceCounts: Record<string, number> = {
            'X-': 0, 'X+': 0,
            'Y-': 0, 'Y+': 0,
            'Z-': 0, 'Z+': 0
        };
        
        const geometry = result.opaqueMesh.geometry;
        const normals = geometry.attributes.normal.array;
        const indexCount = geometry.index ? geometry.index.count : 0;
        
        // Each face has 6 indices (2 triangles)
        for (let i = 0; i < indexCount; i += 6) {
            // Get normal from first vertex of the face
            const index = geometry.index!.array[i];
            const nx = normals[index * 3];
            const ny = normals[index * 3 + 1];
            const nz = normals[index * 3 + 2];
            
            if (nx < 0) faceCounts['X-']++;
            else if (nx > 0) faceCounts['X+']++;
            else if (ny < 0) faceCounts['Y-']++;
            else if (ny > 0) faceCounts['Y+']++;
            else if (nz < 0) faceCounts['Z-']++;
            else if (nz > 0) faceCounts['Z+']++;
        }
        
        console.log('Face counts:', faceCounts);
        console.log('Expected:', scenario.expectedFaces);
        
        // Check for missing faces
        for (const [dir, expected] of Object.entries(scenario.expectedFaces)) {
            if (faceCounts[dir] !== expected) {
                console.error(`❌ ${dir} faces: expected ${expected}, got ${faceCounts[dir]}`);
            } else {
                console.log(`✓ ${dir} faces: ${faceCounts[dir]}`);
            }
        }
    }
}

// Make available globally
(window as any).testBoundaryFaces = testBoundaryFaces;