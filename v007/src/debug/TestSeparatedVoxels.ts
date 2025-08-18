import { VoxelEngine, VoxelType } from '../engine/VoxelEngine';
import { VoxelLayer } from '../engine/VoxelLayer';
import * as THREE from 'three';

/**
 * Test baking with separated voxels that should NOT be merged
 */
export function testSeparatedVoxels(scene: THREE.Scene, voxelEngine: VoxelEngine) {
    console.log('=== Test Separated Voxels ===');
    
    // Clear existing voxels
    voxelEngine.clear();
    
    // Create a new layer
    const testLayer = voxelEngine.createLayer('Separated Test');
    voxelEngine.setActiveLayer(testLayer.id);
    
    // Test 1: Voxels with gaps (should have all faces)
    console.log('\nTest 1: Voxels with 1-block gaps');
    // Place voxels at 0,0,0  2,0,0  4,0,0 (gaps at 1 and 3)
    voxelEngine.setVoxel(0, 0, 0, VoxelType.STONE);
    voxelEngine.setVoxel(2, 0, 0, VoxelType.STONE);
    voxelEngine.setVoxel(4, 0, 0, VoxelType.STONE);
    
    // Each voxel should have 6 faces since they're isolated
    console.log('Expected: 18 faces (3 voxels × 6 faces each)');
    
    // Test 2: Checkerboard pattern at y=2
    console.log('\nTest 2: Checkerboard pattern');
    for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
            if ((x + z) % 2 === 0) {
                voxelEngine.setVoxel(x, 2, z, VoxelType.WOOD);
            }
        }
    }
    
    // Test 3: Staircase pattern
    console.log('\nTest 3: Staircase (should show all step faces)');
    voxelEngine.setVoxel(0, 4, 0, VoxelType.DIRT);
    voxelEngine.setVoxel(1, 5, 0, VoxelType.DIRT);
    voxelEngine.setVoxel(2, 6, 0, VoxelType.DIRT);
    
    // Now bake the layer
    console.log('\nBaking layer...');
    testLayer.bake(0.1);
    
    // Analyze the result
    const metadata = testLayer.getBakingMetadata();
    if (metadata) {
        console.log('Baked result:', metadata.faceCount, 'faces from', metadata.originalVoxelCount, 'voxels');
        
        // Expected faces:
        // Test 1: 3 isolated voxels = 18 faces
        // Test 2: 5 checkerboard voxels = ~26 faces (some internal faces)
        // Test 3: 3 staircase voxels = ~14 faces (some faces touch)
        // Total: ~58 faces (approximately, depending on overlaps)
    }
    
    // Add visual indicators
    const group = new THREE.Group();
    group.name = 'SeparatedVoxelsTest';
    
    // Add labels
    const labelGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    const labelMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    // Mark the gap positions
    const gapPositions = [
        { x: 1, y: 0, z: 0, label: 'Gap1' },
        { x: 3, y: 0, z: 0, label: 'Gap2' }
    ];
    
    for (const pos of gapPositions) {
        const marker = new THREE.Mesh(labelGeometry, labelMaterial);
        marker.position.set(pos.x * 0.1 + 0.05, pos.y * 0.1 + 0.05, pos.z * 0.1 + 0.05);
        group.add(marker);
    }
    
    scene.add(group);
    
    console.log('Visual test created. Red markers show where gaps should be.');
    console.log('If greedy meshing merged across gaps, faces will be missing!');
    
    return testLayer;
}

// Make available globally
(window as any).testSeparatedVoxels = (scene: THREE.Scene, engine: VoxelEngine) => testSeparatedVoxels(scene, engine);