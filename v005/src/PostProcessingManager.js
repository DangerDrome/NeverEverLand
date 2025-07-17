import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { PixelationEffect } from './PixelationEffect.js';

/**
 * PostProcessingManager handles all post-processing effects for the game
 */
export class PostProcessingManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        this.composer = null;
        this.renderPass = null;
        this.bloomPass = null;
        this.pixelationPass = null;
        
        this.isEnabled = false;
        this.pixelationEnabled = false;
        this.bloomEnabled = false;
        
        // Don't initialize composer immediately - lazy load when needed
        this.composerInitialized = false;
        
        this.pixelSize = 4;
        this.bloomStrength = 1.0;
        
        // Don't initialize immediately - wait until effects are needed
        console.log('PostProcessingManager created (composer will initialize when needed)');
    }
    
    initializeComposer() {
        if (this.composerInitialized) return;
        
        console.log('Initializing post-processing composer...');
        
        // Create effect composer
        this.composer = new EffectComposer(this.renderer);
        
        // Add render pass (always first)
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);
        
        // Initialize bloom pass
        const size = this.renderer.getSize(new THREE.Vector2());
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(size.x, size.y),
            this.bloomStrength,
            0.4,
            0.85
        );
        this.bloomPass.enabled = this.bloomEnabled;
        this.composer.addPass(this.bloomPass);
        
        // Initialize pixelation pass
        this.pixelationPass = new ShaderPass(PixelationEffect.getShader());
        this.pixelationPass.uniforms.pixelSize.value = this.pixelSize;
        this.pixelationPass.uniforms.resolution.value = new THREE.Vector2(size.x, size.y);
        this.pixelationPass.enabled = this.pixelationEnabled;
        this.composer.addPass(this.pixelationPass);
        
        this.composerInitialized = true;
        console.log('PostProcessingManager composer initialized');
    }
    
    togglePostProcessing() {
        this.isEnabled = !this.isEnabled;
        console.log('Post-processing:', this.isEnabled ? 'enabled' : 'disabled');
        return this.isEnabled;
    }
    
    setPixelationEnabled(enabled) {
        this.pixelationEnabled = enabled;
        if (enabled) {
            this.initializeComposer(); // Initialize composer when effect is first enabled
        }
        if (this.pixelationPass) {
            this.pixelationPass.enabled = enabled;
        }
        console.log('Pixelation effect:', enabled ? 'enabled' : 'disabled');
    }
    
    setPixelSize(size) {
        this.pixelSize = size;
        if (this.pixelationPass) {
            this.pixelationPass.uniforms.pixelSize.value = size;
        }
        console.log('Pixel size set to:', size);
    }
    
    setBloomEnabled(enabled) {
        this.bloomEnabled = enabled;
        if (enabled) {
            this.initializeComposer(); // Initialize composer when effect is first enabled
        }
        if (this.bloomPass) {
            this.bloomPass.enabled = enabled;
        }
        console.log('Bloom effect:', enabled ? 'enabled' : 'disabled');
    }
    
    setBloomStrength(strength) {
        this.bloomStrength = strength;
        if (this.bloomPass) {
            this.bloomPass.strength = strength;
        }
        console.log('Bloom strength set to:', strength);
    }
    
    isPixelationEnabled() {
        return this.pixelationEnabled;
    }
    
    isBloomEnabled() {
        return this.bloomEnabled;
    }
    
    getPixelSize() {
        return this.pixelSize;
    }
    
    getBloomStrength() {
        return this.bloomStrength;
    }
    
    render() {
        // Only use post-processing if enabled AND at least one effect is active
        const hasActiveEffects = this.pixelationEnabled || this.bloomEnabled;
        
        if (this.isEnabled && hasActiveEffects && this.composer) {
            this.composer.render();
        } else {
            // Use direct rendering for better performance when no effects are active
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    setSize(width, height) {
        if (this.composer) {
            this.composer.setSize(width, height);
        }
        
        if (this.pixelationPass) {
            this.pixelationPass.uniforms.resolution.value.set(width, height);
        }
        
        if (this.bloomPass) {
            this.bloomPass.setSize(width, height);
        }
    }
    
    dispose() {
        if (this.composer) {
            this.composer.dispose();
        }
        console.log('PostProcessingManager disposed');
    }
}