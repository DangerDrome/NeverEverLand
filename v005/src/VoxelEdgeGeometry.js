/**
 * VoxelEdgeGeometry.js - Custom edge geometry for voxels
 * Creates edges only for visible faces
 */

import * as THREE from 'three';

export class VoxelEdgeGeometry extends THREE.BufferGeometry {
    constructor(voxelGeometry) {
        super();
        
        const positions = voxelGeometry.attributes.position;
        const normals = voxelGeometry.attributes.normal;
        const indices = voxelGeometry.index;
        
        const edgePositions = [];
        const edgeMap = new Map(); // Track edges to avoid duplicates
        
        // Process each face (6 vertices = 2 triangles per face)
        for (let i = 0; i < indices.count; i += 6) {
            // Get the 4 unique vertices of this face
            const i0 = indices.array[i];
            const i1 = indices.array[i + 1];
            const i2 = indices.array[i + 2];
            const i3 = indices.array[i + 4]; // Skip duplicate vertex
            
            // Get positions
            const p0 = new THREE.Vector3(
                positions.array[i0 * 3],
                positions.array[i0 * 3 + 1],
                positions.array[i0 * 3 + 2]
            );
            const p1 = new THREE.Vector3(
                positions.array[i1 * 3],
                positions.array[i1 * 3 + 1],
                positions.array[i1 * 3 + 2]
            );
            const p2 = new THREE.Vector3(
                positions.array[i2 * 3],
                positions.array[i2 * 3 + 1],
                positions.array[i2 * 3 + 2]
            );
            const p3 = new THREE.Vector3(
                positions.array[i3 * 3],
                positions.array[i3 * 3 + 1],
                positions.array[i3 * 3 + 2]
            );
            
            // Define edges for this face
            const edges = [
                [p0, p1],
                [p1, p3],
                [p3, p2],
                [p2, p0]
            ];
            
            // Add each edge
            for (const [start, end] of edges) {
                // Create a unique key for this edge
                const key = this.createEdgeKey(start, end);
                
                if (!edgeMap.has(key)) {
                    edgeMap.set(key, true);
                    edgePositions.push(
                        start.x, start.y, start.z,
                        end.x, end.y, end.z
                    );
                }
            }
        }
        
        this.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    }
    
    createEdgeKey(v1, v2) {
        // Create a unique key for an edge regardless of vertex order
        const coords1 = [v1.x, v1.y, v1.z].map(n => n.toFixed(3)).join(',');
        const coords2 = [v2.x, v2.y, v2.z].map(n => n.toFixed(3)).join(',');
        return coords1 < coords2 ? `${coords1}_${coords2}` : `${coords2}_${coords1}`;
    }
}