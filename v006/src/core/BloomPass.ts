import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Simple wrapper around Three.js UnrealBloomPass
 */
export class BloomPass extends UnrealBloomPass {
  constructor(width: number, height: number) {
    const resolution = new THREE.Vector2(width, height);
    const strength = 1.5;
    const radius = 0.4;
    const threshold = 0.2; // Much lower threshold so more pixels bloom
    
    super(resolution, strength, radius, threshold);
  }
} 