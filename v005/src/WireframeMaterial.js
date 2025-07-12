/**
 * WireframeMaterial.js - Simple approach using wireframe overlay
 */

import * as THREE from 'three';

export class WireframeMaterial extends THREE.MeshPhongMaterial {
    constructor(options = {}) {
        super({
            vertexColors: true,
            side: THREE.DoubleSide,
            flatShading: true,
            color: 0xffffff,
            emissive: 0x222222,
            emissiveIntensity: 0.3,
            shininess: 0,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
    }
    
    createWireframe() {
        // Create a wireframe material for edges
        return new THREE.MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
            opacity: 0.3,
            transparent: true
        });
    }
}