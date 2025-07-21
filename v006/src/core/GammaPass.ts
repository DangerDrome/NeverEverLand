import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Gamma correction pass for color grading
 */
export class GammaPass extends Pass {
  private material: THREE.ShaderMaterial;
  private fsQuad: FullScreenQuad;
  
  // Configurable parameters
  public gamma: number = 1.0;        // Gamma correction value
  public brightness: number = 1.0;   // Brightness multiplier
  public contrast: number = 1.0;     // Contrast adjustment

  constructor() {
    super();
    
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        gamma: { value: this.gamma },
        brightness: { value: this.brightness },
        contrast: { value: this.contrast },
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
        uniform float gamma;
        uniform float brightness;
        uniform float contrast;
        
        varying vec2 vUv;
        
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          
          // Apply brightness
          color.rgb *= brightness;
          
          // Apply contrast (around mid-gray)
          color.rgb = ((color.rgb - 0.5) * contrast) + 0.5;
          
          // Apply gamma correction
          color.rgb = pow(color.rgb, vec3(1.0 / gamma));
          
          gl_FragColor = color;
        }
      `
    });
    
    this.fsQuad = new FullScreenQuad(this.material);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.gamma.value = this.gamma;
    this.material.uniforms.brightness.value = this.brightness;
    this.material.uniforms.contrast.value = this.contrast;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  dispose(): void {
    this.material.dispose();
    this.fsQuad.dispose();
  }
} 