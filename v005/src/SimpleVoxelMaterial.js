/**
 * SimpleVoxelMaterial.js - Simple material for testing voxel rendering
 */

import * as THREE from 'three';

export class SimpleVoxelMaterial extends THREE.MeshPhongMaterial {
    constructor() {
        super({
            vertexColors: true,
            side: THREE.DoubleSide,
            flatShading: true,
            color: 0xffffff, // White to allow vertex colors to show
            emissive: 0x333333,
            emissiveIntensity: 0.2,
            shininess: 0
        });
    }
}