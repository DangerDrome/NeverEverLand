/**
 * VoxelEdgeMaterialFixed.js - Fixed version with proper shader attributes
 */

import * as THREE from 'three';

export class VoxelEdgeMaterialFixed extends THREE.ShaderMaterial {
    constructor(options = {}) {
        const vertexShader = `
            attribute vec3 color;
            
            varying vec2 vUv;
            varying vec3 vColor;
            varying vec3 vNormal;
            
            void main() {
                vUv = uv;
                vColor = color;
                vNormal = normalize(normalMatrix * normal);
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform float edgeWidth;
            uniform float edgeDarkness;
            
            varying vec2 vUv;
            varying vec3 vColor;
            varying vec3 vNormal;
            
            void main() {
                // Calculate edge factor based on UV coordinates
                float edgeX = min(vUv.x, 1.0 - vUv.x);
                float edgeY = min(vUv.y, 1.0 - vUv.y);
                float edgeFactor = min(edgeX, edgeY);
                
                // Smooth step for edge detection
                float edge = 1.0 - smoothstep(0.0, edgeWidth, edgeFactor);
                
                // Simple lighting
                vec3 normal = normalize(vNormal);
                vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
                float light = max(dot(normal, lightDir), 0.0) * 0.5 + 0.5;
                
                // Apply vertex color with lighting
                vec3 finalColor = vColor * light;
                
                // Darken edges
                finalColor = mix(finalColor, finalColor * (1.0 - edgeDarkness), edge);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
        
        super({
            uniforms: {
                edgeWidth: { value: options.edgeWidth || 0.02 },
                edgeDarkness: { value: options.edgeDarkness || 0.5 }
            },
            vertexShader,
            fragmentShader,
            vertexColors: true,
            side: THREE.DoubleSide
        });
    }
    
    setEdgeWidth(width) {
        this.uniforms.edgeWidth.value = width;
    }
    
    setEdgeDarkness(darkness) {
        this.uniforms.edgeDarkness.value = darkness;
    }
}