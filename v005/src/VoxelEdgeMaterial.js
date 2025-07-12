/**
 * VoxelEdgeMaterial.js - Custom material for voxels with edge highlighting
 * 
 * Uses a shader to darken edges of voxel faces for a nice outlined look
 */

import * as THREE from 'three';

export class VoxelEdgeMaterial extends THREE.ShaderMaterial {
    constructor(options = {}) {
        const vertexShader = `
            varying vec2 vUv;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            // Use the color attribute if available, otherwise default to white
            #ifdef USE_COLOR
                attribute vec3 color;
            #endif
            
            void main() {
                vUv = uv;
                
                #ifdef USE_COLOR
                    vColor = color;
                #else
                    vColor = vec3(1.0, 1.0, 1.0);
                #endif
                
                vNormal = normalize(normalMatrix * normal);
                
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                
                gl_Position = projectionMatrix * mvPosition;
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
                edgeDarkness: { value: options.edgeDarkness || 0.5 },
                ambientLight: { value: new THREE.Vector3(0.4, 0.4, 0.4) },
                directionalLightColor: { value: new THREE.Vector3(0.8, 0.8, 0.8) },
                directionalLightDirection: { value: new THREE.Vector3(5, 10, 5).normalize() }
            },
            vertexShader,
            fragmentShader,
            vertexColors: true,
            side: THREE.DoubleSide,
            defines: {
                'USE_COLOR': ''
            }
        });
    }
    
    // Update lighting uniforms when scene lights change
    updateLighting(ambientIntensity, directionalLight) {
        if (ambientIntensity !== undefined) {
            this.uniforms.ambientLight.value.setScalar(ambientIntensity);
        }
        
        if (directionalLight) {
            this.uniforms.directionalLightColor.value.copy(directionalLight.color).multiplyScalar(directionalLight.intensity);
            this.uniforms.directionalLightDirection.value.copy(directionalLight.position).normalize();
        }
    }
    
    // Adjust edge parameters
    setEdgeWidth(width) {
        this.uniforms.edgeWidth.value = width;
    }
    
    setEdgeDarkness(darkness) {
        this.uniforms.edgeDarkness.value = darkness;
    }
}