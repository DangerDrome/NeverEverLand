import * as THREE from 'three';
import { VoxelEngine } from '../engine/VoxelEngine';

/**
 * Debug visualization for baked faces
 */
export function debugBakedFaces(scene: THREE.Scene, voxelEngine: VoxelEngine) {
    console.log('=== Debug Baked Faces ===');
    
    // Get all baked meshes from layers
    const layers = voxelEngine.getLayers();
    let bakedMeshCount = 0;
    
    for (const layer of layers) {
        if (layer.isBaked && layer.visible) {
            console.log(`\nLayer "${layer.name}" is baked`);
            
            if (layer.bakedOpaqueMesh) {
                bakedMeshCount++;
                const mesh = layer.bakedOpaqueMesh;
                const geometry = mesh.geometry;
                
                // Get attributes
                const positions = geometry.getAttribute('position');
                const normals = geometry.getAttribute('normal');
                
                // Count faces by normal direction
                const faceCounts = {
                    'X+': 0, 'X-': 0,
                    'Y+': 0, 'Y-': 0,
                    'Z+': 0, 'Z-': 0
                };
                
                // Check each face (4 vertices per face)
                for (let i = 0; i < positions.count; i += 4) {
                    const nx = normals.array[i * 3];
                    const ny = normals.array[i * 3 + 1];
                    const nz = normals.array[i * 3 + 2];
                    
                    if (nx > 0.5) faceCounts['X+']++;
                    else if (nx < -0.5) faceCounts['X-']++;
                    else if (ny > 0.5) faceCounts['Y+']++;
                    else if (ny < -0.5) faceCounts['Y-']++;
                    else if (nz > 0.5) faceCounts['Z+']++;
                    else if (nz < -0.5) faceCounts['Z-']++;
                }
                
                console.log('Face counts by direction:', faceCounts);
                
                // Add debug arrows for ALL faces
                console.log('Adding normal arrows for all faces...');
                
                for (let i = 0; i < positions.count; i += 4) {
                    const nx = normals.array[i * 3];
                    const ny = normals.array[i * 3 + 1];
                    const nz = normals.array[i * 3 + 2];
                    
                    // Calculate center of face
                    const x1 = positions.array[i * 3];
                    const y1 = positions.array[i * 3 + 1];
                    const z1 = positions.array[i * 3 + 2];
                    
                    const x2 = positions.array[(i + 2) * 3]; // Diagonal vertex
                    const y2 = positions.array[(i + 2) * 3 + 1];
                    const z2 = positions.array[(i + 2) * 3 + 2];
                    
                    const centerX = (x1 + x2) / 2;
                    const centerY = (y1 + y2) / 2;
                    const centerZ = (z1 + z2) / 2;
                    
                    // Create arrow helper
                    const origin = new THREE.Vector3(centerX, centerY, centerZ);
                    const direction = new THREE.Vector3(nx, ny, nz);
                    const length = 0.3;
                    
                    // Color based on direction
                    let color = 0xffffff;
                    if (Math.abs(nx) > 0.5) color = nx > 0 ? 0xff0000 : 0xaa0000; // Red for X
                    else if (Math.abs(ny) > 0.5) color = ny > 0 ? 0x00ff00 : 0x00aa00; // Green for Y
                    else if (Math.abs(nz) > 0.5) color = nz > 0 ? 0x0000ff : 0x0000aa; // Blue for Z
                    
                    const arrow = new THREE.ArrowHelper(direction, origin, length, color, length * 0.3, length * 0.2);
                    scene.add(arrow);
                    
                    // Store reference for cleanup
                    (window as any).debugArrows = (window as any).debugArrows || [];
                    (window as any).debugArrows.push(arrow);
                }
            }
        }
    }
    
    if (bakedMeshCount === 0) {
        console.log('No baked layers found. Bake a layer first!');
    }
    
    console.log('\nTo remove debug arrows, run: clearDebugArrows()');
}

// Function to clear debug arrows
export function clearDebugArrows(scene: THREE.Scene) {
    const arrows = (window as any).debugArrows || [];
    for (const arrow of arrows) {
        scene.remove(arrow);
    }
    (window as any).debugArrows = [];
    console.log('Cleared debug arrows');
}

// Make available globally
(window as any).debugBakedFaces = (scene: THREE.Scene, voxelEngine: VoxelEngine) => debugBakedFaces(scene, voxelEngine);
(window as any).clearDebugArrows = (scene: THREE.Scene) => clearDebugArrows(scene);