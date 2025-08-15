import * as THREE from 'three';
import { VoxelType } from '../types';
import { ColorRegistry } from './ColorRegistry';
import { BakedMeshGenerator } from './BakedMeshGenerator';

/**
 * Debug version of BakedMeshGenerator with logging
 */
export class DebugBakedMeshGenerator extends BakedMeshGenerator {
    generateOptimizedMesh(voxels: Map<string, VoxelType>): {
        opaqueMesh: THREE.Mesh | null;
        transparentMesh: THREE.Mesh | null;
        metadata: {
            originalVoxelCount: number;
            vertexCount: number;
            faceCount: number;
        };
    } {
        console.log('=== Debug Baked Mesh Generator ===');
        console.log('Input voxels:', voxels.size);
        
        // Log voxel positions
        const positions = Array.from(voxels.keys()).sort();
        console.log('Voxel positions:', positions);
        
        // Get bounds
        let minY = Infinity, maxY = -Infinity;
        for (const key of voxels.keys()) {
            const [x, y, z] = key.split(',').map(Number);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
        console.log('Y bounds:', minY, 'to', maxY);
        
        const result = super.generateOptimizedMesh(voxels);
        
        console.log('Result:', result.metadata);
        return result;
    }
    
    // Override using public method to avoid access issues
    generateOptimizedMeshWithDebug(voxels: Map<string, VoxelType>) {
        return this.generateOptimizedMesh(voxels);
    }
}