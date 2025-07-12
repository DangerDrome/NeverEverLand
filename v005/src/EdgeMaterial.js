/**
 * EdgeMaterial.js - MeshPhongMaterial with edge darkening effect
 */

import * as THREE from 'three';

export class EdgeMaterial extends THREE.MeshPhongMaterial {
    constructor(options = {}) {
        super({
            vertexColors: true,
            side: THREE.DoubleSide,
            flatShading: true,
            color: 0xffffff,
            emissive: 0x222222,
            emissiveIntensity: 0.3,
            shininess: 0
        });
        
        this.edgeWidth = options.edgeWidth || 0.05;
        this.edgeDarkness = options.edgeDarkness || 0.6;
        
        // Modify the shader to add edge darkening
        this.onBeforeCompile = (shader) => {
            // Add uniforms
            shader.uniforms.edgeWidth = { value: this.edgeWidth };
            shader.uniforms.edgeDarkness = { value: this.edgeDarkness };
            
            // Add varying to vertex shader
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                varying vec2 vUv;`
            );
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <uv_vertex>',
                `#include <uv_vertex>
                vUv = uv;`
            );
            
            // Modify fragment shader
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform float edgeWidth;
                uniform float edgeDarkness;
                varying vec2 vUv;`
            );
            
            // Add edge darkening before output
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <output_fragment>',
                `#include <output_fragment>
                
                // Calculate edge factor
                float edgeX = min(vUv.x, 1.0 - vUv.x);
                float edgeY = min(vUv.y, 1.0 - vUv.y);
                float edgeFactor = min(edgeX, edgeY);
                float edge = 1.0 - smoothstep(0.0, edgeWidth, edgeFactor);
                
                // Darken edges
                gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * (1.0 - edgeDarkness), edge);`
            );
        };
    }
}