/**
 * VoxelEdgeTextureMaterial.js - Material that creates edge effect using UV coordinates
 */

import * as THREE from 'three';

export class VoxelEdgeTextureMaterial extends THREE.MeshPhongMaterial {
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
        
        this.edgeWidth = options.edgeWidth || 0.08;
        this.edgeColor = options.edgeColor || new THREE.Color(0x000000);
        this.edgeOpacity = options.edgeOpacity || 0.5;
        
        // Modify the shader to add edge darkening based on UV
        this.onBeforeCompile = (shader) => {
            // Add uniforms
            shader.uniforms.edgeWidth = { value: this.edgeWidth };
            shader.uniforms.edgeColor = { value: this.edgeColor };
            shader.uniforms.edgeOpacity = { value: this.edgeOpacity };
            
            // Add varying to vertex shader
            shader.vertexShader = shader.vertexShader.replace(
                '#include <uv_pars_vertex>',
                `#include <uv_pars_vertex>
                varying vec2 vUv;`
            );
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <uv_vertex>',
                `#include <uv_vertex>
                vUv = uv;`
            );
            
            // Modify fragment shader
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <uv_pars_fragment>',
                `#include <uv_pars_fragment>
                uniform float edgeWidth;
                uniform vec3 edgeColor;
                uniform float edgeOpacity;
                varying vec2 vUv;`
            );
            
            // Add edge darkening before output
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <output_fragment>',
                `#include <output_fragment>
                
                // Calculate distance to edge (0 at edge, 1 at center)
                float edgeX = min(vUv.x, 1.0 - vUv.x);
                float edgeY = min(vUv.y, 1.0 - vUv.y);
                float edgeDist = min(edgeX, edgeY);
                
                // Create edge line
                float edge = 1.0 - smoothstep(0.0, edgeWidth, edgeDist);
                
                // Mix edge color
                gl_FragColor.rgb = mix(gl_FragColor.rgb, edgeColor, edge * edgeOpacity);`
            );
            
            this._shader = shader;
        };
    }
    
    setEdgeWidth(width) {
        this.edgeWidth = width;
        if (this._shader) {
            this._shader.uniforms.edgeWidth.value = width;
        }
    }
    
    setEdgeOpacity(opacity) {
        this.edgeOpacity = opacity;
        if (this._shader) {
            this._shader.uniforms.edgeOpacity.value = opacity;
        }
    }
}