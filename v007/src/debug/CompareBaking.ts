import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';
import * as THREE from 'three';

/**
 * Compare greedy meshing vs expected face counts
 */
export function compareBaking() {
    console.log('=== Compare Baking Methods ===');
    
    // Test case: 3x3x3 solid cube
    const solidCube = new Map<string, VoxelType>();
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            for (let z = 0; z < 3; z++) {
                solidCube.set(`${x},${y},${z}`, VoxelType.STONE);
            }
        }
    }
    
    console.log('\nTest: 3x3x3 solid cube (27 voxels)');
    const gen = new BakedMeshGenerator(0.1);
    const result = gen.generateOptimizedMesh(solidCube);
    
    console.log('Greedy meshing result:', result.metadata.faceCount, 'faces');
    console.log('Expected without merging: 54 faces (only exterior faces)');
    console.log('Expected with perfect merging: 6 faces (one per side)');
    
    // Let's analyze what faces are actually being generated
    if (result.opaqueMesh) {
        const geometry = result.opaqueMesh.geometry;
        const positions = geometry.attributes.position.array;
        const normals = geometry.attributes.normal.array;
        
        // Count faces by normal direction
        const faceCounts: Record<string, number> = {};
        const faceDetails: Record<string, any[]> = {};
        
        // Each face has 4 vertices
        for (let i = 0; i < positions.length; i += 12) { // 4 vertices * 3 components
            const nx = normals[i];
            const ny = normals[i + 1];
            const nz = normals[i + 2];
            
            let dir = '';
            if (nx < 0) dir = 'X-';
            else if (nx > 0) dir = 'X+';
            else if (ny < 0) dir = 'Y-';
            else if (ny > 0) dir = 'Y+';
            else if (nz < 0) dir = 'Z-';
            else if (nz > 0) dir = 'Z+';
            
            faceCounts[dir] = (faceCounts[dir] || 0) + 1;
            
            // Store face details for analysis
            if (!faceDetails[dir]) faceDetails[dir] = [];
            
            // Get the 4 vertices of this face
            const v1 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const v2 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
            const v3 = new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);
            const v4 = new THREE.Vector3(positions[i + 9], positions[i + 10], positions[i + 11]);
            
            // Calculate face bounds
            const minX = Math.min(v1.x, v2.x, v3.x, v4.x);
            const maxX = Math.max(v1.x, v2.x, v3.x, v4.x);
            const minY = Math.min(v1.y, v2.y, v3.y, v4.y);
            const maxY = Math.max(v1.y, v2.y, v3.y, v4.y);
            const minZ = Math.min(v1.z, v2.z, v3.z, v4.z);
            const maxZ = Math.max(v1.z, v2.z, v3.z, v4.z);
            
            faceDetails[dir].push({
                minX, maxX, minY, maxY, minZ, maxZ,
                width: maxX - minX,
                height: maxY - minY,
                depth: maxZ - minZ
            });
        }
        
        console.log('\nFace analysis:');
        for (const [dir, count] of Object.entries(faceCounts)) {
            console.log(`${dir}: ${count} faces`);
            if (faceDetails[dir]) {
                for (let i = 0; i < faceDetails[dir].length; i++) {
                    const f = faceDetails[dir][i];
                    console.log(`  Face ${i}: pos=(${f.minX.toFixed(1)},${f.minY.toFixed(1)},${f.minZ.toFixed(1)}) size=(${f.width.toFixed(1)},${f.height.toFixed(1)},${f.depth.toFixed(1)})`);
                }
            }
        }
    }
    
    // Test with a more complex shape to see if faces are truly missing
    console.log('\n\nTest: L-shape to check for missing faces');
    const lShape = new Map<string, VoxelType>();
    // Create an L shape
    lShape.set('0,0,0', VoxelType.STONE);
    lShape.set('1,0,0', VoxelType.STONE);
    lShape.set('2,0,0', VoxelType.STONE);
    lShape.set('0,0,1', VoxelType.STONE);
    lShape.set('0,0,2', VoxelType.STONE);
    
    const lResult = gen.generateOptimizedMesh(lShape);
    console.log('L-shape faces:', lResult.metadata.faceCount);
    
    // This shape should have faces at:
    // - All exterior boundaries
    // - Internal corner where the L bends
    
    return { solidCube, lShape };
}

// Make available globally
(window as any).compareBaking = compareBaking;