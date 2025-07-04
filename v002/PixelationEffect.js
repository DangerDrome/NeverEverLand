// PixelationEffect.js - v002
// Post-processing pixelation effect for retro look
// Assumes EffectComposer, RenderPass, ShaderPass are available on window (classic script style)

class PixelationEffect {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     * @param {number} pixelSize
     */
    constructor(renderer, scene, camera, pixelSize = 4) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.pixelSize = pixelSize;
        this._setupComposer();
        this._setupShader();
    }

    _setupComposer() {
        this.composer = new window.EffectComposer(this.renderer);
        this.renderPass = new window.RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);
    }

    _setupShader() {
        this.pixelationShader = {
            name: 'PixelationShader',
            uniforms: {
                'tDiffuse': { value: null },
                'resolution': { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                'pixelSize': { value: this.pixelSize },
                'gridColor': { value: new THREE.Color(0x000000) }
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
                uniform float pixelSize;
                uniform vec3 gridColor;
                varying vec2 vUv;
                void main() {
                    vec2 coord = vUv * resolution;
                    vec2 pixelCoord = floor(coord / pixelSize) * pixelSize;
                    vec2 offset = coord - pixelCoord;
                    vec4 color = texture2D(tDiffuse, (pixelCoord + vec2(0.5)) / resolution);
                    if (offset.x < 1.0 || offset.y < 1.0) {
                        gl_FragColor = vec4(gridColor, 1.0);
                    } else {
                        gl_FragColor = color;
                    }
                }
            `
        };
        this.pixelationPass = new window.ShaderPass(this.pixelationShader);
        this.pixelationPass.renderToScreen = true;
        this.composer.addPass(this.pixelationPass);
    }

    render() {
        this.composer.render();
    }

    setPixelSize(pixelSize) {
        this.pixelSize = Math.max(1, Math.min(20, pixelSize));
        if (this.pixelationShader && this.pixelationShader.uniforms) {
            this.pixelationShader.uniforms.pixelSize.value = this.pixelSize;
        }
    }

    increasePixelation() { this.setPixelSize(this.pixelSize + 1); }
    decreasePixelation() { this.setPixelSize(this.pixelSize - 1); }

    onWindowResize(width, height) {
        this.composer.setSize(width, height);
        if (this.pixelationShader && this.pixelationShader.uniforms) {
            this.pixelationShader.uniforms.resolution.value.set(width, height);
        }
    }

    getPixelSize() { return this.pixelSize; }
}
window.PixelationEffect = PixelationEffect; 