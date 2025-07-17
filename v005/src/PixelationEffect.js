import * as THREE from 'three';

/**
 * PixelationEffect - Custom shader for pixelation post-processing effect
 */
export class PixelationEffect {
    static getShader() {
        return {
            uniforms: {
                tDiffuse: { value: null },
                pixelSize: { value: 4.0 },
                resolution: { value: new THREE.Vector2(1920, 1080) }
            },
            
            vertexShader: `
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float pixelSize;
                uniform vec2 resolution;
                varying vec2 vUv;
                
                void main() {
                    vec2 dxy = pixelSize / resolution;
                    vec2 coord = dxy * floor(vUv / dxy);
                    gl_FragColor = texture2D(tDiffuse, coord);
                }
            `
        };
    }
    
    static createMaterial() {
        const shader = this.getShader();
        return new THREE.ShaderMaterial({
            uniforms: shader.uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader
        });
    }
}