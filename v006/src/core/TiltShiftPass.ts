import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Simple tilt-shift effect pass for orthographic cameras
 * Creates a horizontal band of focus with blur outside
 */
export class TiltShiftPass extends Pass {
  private material: THREE.ShaderMaterial;
  private fsQuad: FullScreenQuad;
  
  // Configurable parameters
  public focusPosition: number = 0.5;     // 0-1, screen Y position of focus
  public focusBandwidth: number = 0.3;    // Width of sharp focus band
  public blurStrength: number = 2.0;      // Maximum blur amount

  constructor(width: number, height: number) {
    super();
    
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        focusPosition: { value: this.focusPosition },
        focusBandwidth: { value: this.focusBandwidth },
        blurStrength: { value: this.blurStrength },
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
        uniform vec2 resolution;
        uniform float focusPosition;
        uniform float focusBandwidth;
        uniform float blurStrength;
        
        varying vec2 vUv;
        
        // Gaussian blur with proper weights to prevent darkening
        vec4 blur(sampler2D tex, vec2 uv, float strength) {
          vec4 color = vec4(0.0);
          vec2 texelSize = 1.0 / resolution;
          
          // Properly normalized 3x3 Gaussian kernel
          float weights[9];
          weights[0] = 0.0625; weights[1] = 0.125; weights[2] = 0.0625;
          weights[3] = 0.125;  weights[4] = 0.25;  weights[5] = 0.125;
          weights[6] = 0.0625; weights[7] = 0.125; weights[8] = 0.0625;
          // These weights sum to exactly 1.0
          
          int index = 0;
          for(int i = -1; i <= 1; i++) {
            for(int j = -1; j <= 1; j++) {
              vec2 offset = vec2(float(i), float(j)) * texelSize * strength;
              float weight = weights[index++];
              color += texture2D(tex, uv + offset) * weight;
            }
          }
          
          return color;
        }
        
        void main() {
          vec2 uv = vUv;
          
          // Calculate distance from focus band center
          float distanceFromFocus = abs(uv.y - focusPosition);
          
          // Calculate blur amount based on distance from focus band
          float blurAmount = 0.0;
          if (distanceFromFocus > focusBandwidth * 0.5) {
            float excess = distanceFromFocus - (focusBandwidth * 0.5);
            blurAmount = smoothstep(0.0, 0.3, excess) * blurStrength;
          }
          
          // Always apply blur to ensure consistent processing
          // Use minimum blur of 0.01 to avoid branching issues
          blurAmount = max(blurAmount, 0.01);
          gl_FragColor = blur(tDiffuse, uv, blurAmount);
        }
      `
    });
    
    this.fsQuad = new FullScreenQuad(this.material);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.focusPosition.value = this.focusPosition;
    this.material.uniforms.focusBandwidth.value = this.focusBandwidth;
    this.material.uniforms.blurStrength.value = this.blurStrength;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  setSize(width: number, height: number): void {
    this.material.uniforms.resolution.value.set(width, height);
  }

  dispose(): void {
    this.material.dispose();
    this.fsQuad.dispose();
  }
} 