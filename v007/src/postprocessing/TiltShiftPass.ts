import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Simple tilt-shift effect pass for orthographic cameras
 * Creates a horizontal band of focus with blur outside
 * Based on v006 implementation
 */
export class TiltShiftPass extends Pass {
  private material: THREE.ShaderMaterial;
  private fsQuad: FullScreenQuad;
  
  // Configurable parameters
  public focusPosition: number = 0.5;     // 0-1, screen Y position of focus
  public focusBandwidth: number = 0.3;    // Width of sharp focus band
  public blurStrength: number = 2.0;      // Maximum blur amount
  public gammaCorrection: number = 1.2;   // Gamma correction to compensate for blur darkening
  public bladeCount: number = 6;          // Number of aperture blades (3-8, 0 for circular)

  constructor(width: number, height: number) {
    super();
    
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        focusPosition: { value: this.focusPosition },
        focusBandwidth: { value: this.focusBandwidth },
        blurStrength: { value: this.blurStrength },
        gammaCorrection: { value: this.gammaCorrection },
        bladeCount: { value: this.bladeCount },
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
        uniform float gammaCorrection;
        uniform float bladeCount;
        
        varying vec2 vUv;
        
        #define PI 3.14159265359
        
        // Generate bokeh sampling pattern based on blade count
        vec2 getBokehOffset(float angle, float radius, float blades) {
          if (blades < 2.5) {
            // Circular bokeh
            return vec2(cos(angle), sin(angle)) * radius;
          }
          
          // Polygonal bokeh based on blade count
          float anglePerBlade = 2.0 * PI / blades;
          float bladeAngle = floor(angle / anglePerBlade) * anglePerBlade;
          float nextBladeAngle = bladeAngle + anglePerBlade;
          
          // Interpolate between blade positions for smoother shape
          float t = (angle - bladeAngle) / anglePerBlade;
          vec2 p1 = vec2(cos(bladeAngle), sin(bladeAngle));
          vec2 p2 = vec2(cos(nextBladeAngle), sin(nextBladeAngle));
          
          // Create polygon shape
          vec2 dir = mix(p1, p2, t);
          float shapeFactor = 1.0 / cos((angle - bladeAngle - anglePerBlade * 0.5));
          
          return dir * radius * min(shapeFactor, 1.5); // Limit shape factor to prevent extreme distortion
        }
        
        // Bokeh blur with configurable blade count
        vec4 bokehBlur(sampler2D tex, vec2 uv, float strength, float blades) {
          vec4 color = vec4(0.0);
          vec2 texelSize = 1.0 / resolution;
          float totalWeight = 0.0;
          
          // Use more samples for better quality bokeh
          const int rings = 3;
          const int samplesPerRing = 8;
          
          // Center sample
          color += texture2D(tex, uv) * 0.25;
          totalWeight += 0.25;
          
          // Ring samples
          for(int ring = 1; ring <= rings; ring++) {
            float ringRadius = float(ring) * strength;
            float ringWeight = 1.0 / float(ring + 1); // Weight decreases with distance
            
            for(int sampleIdx = 0; sampleIdx < samplesPerRing; sampleIdx++) {
              float angle = float(sampleIdx) * 2.0 * PI / float(samplesPerRing);
              // Add rotation to each ring for better coverage
              angle += float(ring) * 0.5;
              
              vec2 offset = getBokehOffset(angle, ringRadius, blades) * texelSize;
              color += texture2D(tex, uv + offset) * ringWeight;
              totalWeight += ringWeight;
            }
          }
          
          return color / totalWeight;
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
          
          // Apply bokeh blur with blade count
          vec4 blurredColor;
          if (blurAmount > 0.01) {
            blurredColor = bokehBlur(tDiffuse, uv, blurAmount, bladeCount);
          } else {
            blurredColor = texture2D(tDiffuse, uv);
          }
          
          // Apply gamma correction to compensate for darkening
          vec3 gammaCorrected = pow(blurredColor.rgb, vec3(1.0 / gammaCorrection));
          gl_FragColor = vec4(gammaCorrected, blurredColor.a);
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
    this.material.uniforms.gammaCorrection.value = this.gammaCorrection;
    this.material.uniforms.bladeCount.value = this.bladeCount;

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