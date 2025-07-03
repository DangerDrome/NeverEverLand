/**
 * PixelationEffect class for creating retro pixel art post-processing
 * Creates a chunky, pixelated look perfect for isometric farming games
 */
class PixelationEffect {
    constructor(renderer, scene, camera, pixelSize = 4) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.pixelSize = pixelSize;
        
        this.setupComposer();
        this.setupPixelationShader();
    }
    
    /**
     * Set up the effect composer for post-processing
     */
    setupComposer() {
        this.composer = new window.EffectComposer(this.renderer);
        
        // Render pass - renders the scene
        this.renderPass = new window.RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);
    }
    
    /**
     * Create custom pixelation shader
     */
    setupPixelationShader() {
        // Custom pixelation shader
        this.pixelationShader = {
            name: 'PixelationShader',
            uniforms: {
                'tDiffuse': { value: null },
                'resolution': { 
                    value: new THREE.Vector2(
                        window.innerWidth, 
                        window.innerHeight
                    ) 
                },
                'pixelSize': { value: this.pixelSize }
            },
            
            vertexShader: /* glsl */`
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            
            fragmentShader: /* glsl */`
                uniform sampler2D tDiffuse;
                uniform vec2 resolution;
                uniform float pixelSize;
                varying vec2 vUv;
                
                void main() {
                    // Calculate pixel grid
                    vec2 pixelGrid = floor(vUv * resolution / pixelSize) * pixelSize / resolution;
                    
                    // Sample texture at pixelated coordinates
                    vec4 color = texture2D(tDiffuse, pixelGrid);
                    
                    // Apply slight contrast and saturation boost for retro feel
                    color.rgb = pow(color.rgb, vec3(0.9));
                    color.rgb = mix(vec3(dot(color.rgb, vec3(0.299, 0.587, 0.114))), color.rgb, 1.2);
                    
                    gl_FragColor = color;
                }
            `
        };
        
        // Create shader pass
        this.pixelationPass = new window.ShaderPass(this.pixelationShader);
        this.pixelationPass.renderToScreen = true;
        this.composer.addPass(this.pixelationPass);
    }
    
    /**
     * Render the scene with pixelation effect
     */
    render() {
        this.composer.render();
    }
    
    /**
     * Update pixelation strength
     * @param {number} pixelSize - Size of pixels (higher = more pixelated)
     */
    setPixelSize(pixelSize) {
        this.pixelSize = Math.max(1, Math.min(20, pixelSize)); // Clamp between 1-20
        if (this.pixelationShader && this.pixelationShader.uniforms) {
            this.pixelationShader.uniforms.pixelSize.value = this.pixelSize;
        }
    }
    
    /**
     * Increase pixelation
     */
    increasePixelation() {
        this.setPixelSize(this.pixelSize + 1);
    }
    
    /**
     * Decrease pixelation
     */
    decreasePixelation() {
        this.setPixelSize(this.pixelSize - 1);
    }
    
    /**
     * Handle window resize
     * @param {number} width - New window width
     * @param {number} height - New window height
     */
    onWindowResize(width, height) {
        this.composer.setSize(width, height);
        if (this.pixelationShader && this.pixelationShader.uniforms) {
            this.pixelationShader.uniforms.resolution.value.set(width, height);
        }
    }
    
    /**
     * Get current pixel size
     * @returns {number} Current pixel size
     */
    getPixelSize() {
        return this.pixelSize;
    }
    
    /**
     * Toggle pixelation effect on/off
     * @param {boolean} enabled - Whether effect is enabled
     */
    setEnabled(enabled) {
        if (this.pixelationPass) {
            this.pixelationPass.enabled = enabled;
        }
    }
    
    /**
     * Add additional post-processing effects
     * Can be extended to add film grain, vignette, etc.
     */
    addRetroEffects() {
        // Film grain shader (optional enhancement)
        const filmGrainShader = {
            name: 'FilmGrainShader',
            uniforms: {
                'tDiffuse': { value: null },
                'time': { value: 0 },
                'nIntensity': { value: 0.1 },
                'sIntensity': { value: 0.05 },
                'sCount': { value: 2048 }
            },
            
            vertexShader: /* glsl */`
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            
            fragmentShader: /* glsl */`
                uniform float time;
                uniform float nIntensity;
                uniform float sIntensity;
                uniform float sCount;
                uniform sampler2D tDiffuse;
                varying vec2 vUv;
                
                float random(vec2 co) {
                    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    
                    // Add film grain
                    float noise = random(vUv + time) * nIntensity;
                    
                    // Add scanlines
                    float scanline = sin(vUv.y * sCount) * sIntensity;
                    
                    color.rgb += noise + scanline;
                    
                    gl_FragColor = color;
                }
            `
        };
        
        this.filmGrainPass = new window.ShaderPass(filmGrainShader);
        this.composer.insertPass(this.filmGrainPass, this.composer.passes.length - 1);
        
        return this.filmGrainPass;
    }
    
    /**
     * Update film grain animation (if enabled)
     * @param {number} time - Current time
     */
    updateFilmGrain(time) {
        if (this.filmGrainPass && this.filmGrainPass.uniforms) {
            this.filmGrainPass.uniforms.time.value = time;
        }
    }
} 