// 3D to Pixel Art Demo - Simple & Clean Implementation

// Configuration
const config = {
    baseResolution: { width: 320, height: 240 },
    pixelScale: 3,
    ditherIntensity: 1.0,
    ditherType: 'bayer4',
    colorDepth: 16,
    showOriginal: false,
    showGrid: true,
    gridSize: 20,
    gridDivisions: 20,
    gradientDithering: true,
    noiseAmount: 0.5,
    noiseMethod: 'ign',
    // Edge detection
    edgeDetection: true,
    edgeThreshold: 0.1,
    edgeColor: '#000000',
    edgeMethod: 'sobel', // 'sobel', 'fwidth', 'normal'
    // Normal shading
    normalShading: true,
    normalIntensity: 0.5,
    normalMethod: 'lambert', // 'lambert', 'toon', 'fresnel'
    normalDithering: true,
    // Color palette
    usePalette: false,
    palette: 'gameboy', // 'gameboy', 'cga', 'pico8', 'nes', 'zx'
    // Temporal effects
    frameBlending: 0.0,
    temporalOffset: false,
    frameRateLimit: 60,
    // Color enhancement
    saturation: 1.0,
    contrast: 1.0,
    brightness: 1.0,
    hueShift: 0.0,
    temperature: 0.0,
    // Pattern options
    patternRotation: 0.0,
    patternScale: 1.0,
    // Outline enhancement
    outlineWidth: 1.0,
    outlineMode: 'outer', // 'inner', 'outer', 'both'
    outlineOpacity: 1.0,
    // Post-processing
    bloom: false,
    bloomIntensity: 0.5,
    bloomThreshold: 0.8,
    vignette: false,
    vignetteIntensity: 0.5,
    chromaticAberration: 0.0,
    scanlines: false,
    scanlineIntensity: 0.5,
    // Advanced dithering
    ditherBlendMode: 'normal', // 'normal', 'multiply', 'overlay', 'screen'
    adaptiveDithering: false,
    perChannelDither: false,
    errorDiffusion: false,
    errorDiffusionStrength: 0.5,
    // Lighting
    lightingModel: 'phong', // 'phong', 'blinn-phong', 'pbr-simple'
    ambientLightColor: '#303030',
    ambientLightIntensity: 0.3,
    directionalLight1Color: '#FFFFFF',
    directionalLight1Intensity: 1.0,
    directionalLight1Direction: { x: 1, y: 1, z: 0.5 },
    directionalLight2Color: '#4080FF',
    directionalLight2Intensity: 0.0,
    directionalLight2Direction: { x: -1, y: 0.5, z: -0.5 },
    pointLight1Color: '#FFAA00',
    pointLight1Intensity: 0.0,
    pointLight1Position: { x: 5, y: 5, z: 5 },
    pointLight1Radius: 10.0,
    specularIntensity: 0.5,
    specularPower: 32.0,
    ambientOcclusion: false,
    ambientOcclusionRadius: 0.5,
    ambientOcclusionIntensity: 0.5,
    // Material properties
    metallic: 0.0,
    roughness: 0.5,
    emissionColor: '#000000',
    emissionIntensity: 0.0,
    // Camera
    cameraOrthoScale: 10,
    cameraTiltX: 26.57,
    cameraTiltY: 45,
    cameraRoll: 25  // Compensate for visual roll offset
};

// Scene setup
let scene, camera, renderer;
let pixelRenderTarget, normalTarget, depthTarget;
let testObjects = [];
let gridHelper;
let depthMaterial, normalMaterial;
let rotateObjects = true;
let currentScene = 'geometric';
let exportController = null;

// Temporal effects
let previousFrame = null;
let frameCount = 0;
let lastFrameTime = performance.now();

// Color palettes
const palettes = {
    gameboy: [
        [15, 56, 15],
        [48, 98, 48],
        [139, 172, 15],
        [155, 188, 15]
    ],
    cga: [
        [0, 0, 0],
        [0, 170, 170],
        [170, 0, 170],
        [170, 170, 170]
    ],
    pico8: [
        [0, 0, 0],
        [29, 43, 83],
        [126, 37, 83],
        [0, 135, 81],
        [171, 82, 54],
        [95, 87, 79],
        [194, 195, 199],
        [255, 241, 232],
        [255, 0, 77],
        [255, 163, 0],
        [255, 236, 39],
        [0, 228, 54],
        [41, 173, 255],
        [131, 118, 156],
        [255, 119, 168],
        [255, 204, 170]
    ],
    nes: [
        [0, 0, 0],
        [252, 252, 252],
        [248, 56, 0],
        [252, 160, 68]
    ],
    zx: [
        [0, 0, 0],
        [0, 0, 215],
        [215, 0, 0],
        [215, 0, 215],
        [0, 215, 0],
        [0, 215, 215],
        [215, 215, 0],
        [215, 215, 215]
    ]
};

// Presets - with all settings for consistency
const basePresetSettings = {
    // Camera (maintain dimetric projection with visual correction)
    cameraTiltX: 26.57,
    cameraTiltY: 45,
    cameraRoll: 25,  // Visually corrected for proper dimetric view
    cameraOrthoScale: 10,
    // Color enhancement defaults
    saturation: 1.0,
    contrast: 1.0,
    brightness: 1.0,
    hueShift: 0.0,
    temperature: 0.0,
    // Pattern defaults
    patternRotation: 0.0,
    patternScale: 1.0,
    // Temporal defaults
    frameBlending: 0.0,
    temporalOffset: false,
    // Advanced dithering defaults
    ditherBlendMode: 'normal',
    adaptiveDithering: false,
    perChannelDither: false,
    errorDiffusion: false,
    errorDiffusionStrength: 0.5,
    // Lighting defaults
    lightingModel: 'phong',
    ambientLightColor: '#303030',
    ambientLightIntensity: 0.3,
    directionalLight1Color: '#FFFFFF',
    directionalLight1Intensity: 1.0,
    directionalLight2Color: '#4080FF',
    directionalLight2Intensity: 0.0,
    pointLight1Color: '#FFAA00',
    pointLight1Intensity: 0.0,
    specularIntensity: 0.5,
    specularPower: 32.0,
    ambientOcclusion: false,
    ambientOcclusionRadius: 0.5,
    ambientOcclusionIntensity: 0.5,
    // Material defaults
    metallic: 0.0,
    roughness: 0.5,
    emissionColor: '#000000',
    emissionIntensity: 0.0,
    // Post-processing defaults
    vignette: false,
    vignetteIntensity: 0.5,
    scanlines: false,
    scanlineIntensity: 0.5,
    chromaticAberration: 0.0,
    // Outline defaults
    outlineWidth: 1.0,
    outlineMode: 'outer',
    outlineOpacity: 1.0
};

const presets = {
    'Default': {
        ...basePresetSettings,
        pixelScale: 3,
        ditherIntensity: 1.0,
        colorDepth: 16,
        gradientDithering: true,
        noiseAmount: 0.5,
        noiseMethod: 'ign',
        edgeDetection: true,
        edgeThreshold: 0.1,
        normalShading: true,
        normalIntensity: 0.5,
        normalDithering: true
    },
    'Game Boy': {
        ...basePresetSettings,
        pixelScale: 4,
        ditherIntensity: 1.0,
        colorDepth: 4,
        gradientDithering: true,
        noiseAmount: 0.3,
        noiseMethod: 'bayer8',
        edgeDetection: false,
        normalShading: true,
        normalIntensity: 0.7,
        normalDithering: true,
        usePalette: true,
        palette: 'gameboy'
    },
    '1-bit': {
        ...basePresetSettings,
        pixelScale: 2,
        ditherIntensity: 1.0,
        colorDepth: 2,
        gradientDithering: true,
        noiseAmount: 0.8,
        noiseMethod: 'ign',
        edgeDetection: true,
        edgeThreshold: 0.05,
        normalShading: false,
        // High contrast lighting for 1-bit
        ambientLightIntensity: 0.1,
        directionalLight1Intensity: 1.2,
        contrast: 1.2
    },
    'CGA': {
        pixelScale: 3,
        ditherIntensity: 0.8,
        colorDepth: 4,
        gradientDithering: false,
        edgeDetection: false,
        normalShading: true,
        normalIntensity: 0.3,
        normalDithering: false
    },
    'Pixel Perfect': {
        ...basePresetSettings,
        pixelScale: 1,
        ditherIntensity: 0.6,
        colorDepth: 32,
        gradientDithering: true,
        noiseAmount: 0.2,
        noiseMethod: 'blue',
        edgeDetection: true,
        edgeThreshold: 0.15,
        normalShading: true,
        normalIntensity: 0.4,
        normalDithering: false,
        // Enhanced quality settings
        ambientOcclusion: true,
        ambientOcclusionIntensity: 0.3,
        adaptiveDithering: true
    },
    'Manga Style': {
        pixelScale: 2,
        ditherIntensity: 1.0,
        colorDepth: 2,
        gradientDithering: true,
        noiseAmount: 0.4,
        noiseMethod: 'halftone',
        edgeDetection: true,
        edgeThreshold: 0.08,
        edgeMethod: 'normal',
        normalShading: true,
        normalIntensity: 0.8,
        normalDithering: true,
        normalMethod: 'toon'
    },
    'Retro Terminal': {
        pixelScale: 3,
        ditherIntensity: 1.0,
        colorDepth: 2,
        gradientDithering: false,
        edgeDetection: false,
        normalShading: false,
        usePalette: true,
        palette: 'gameboy'
    },
    'PC-98': {
        pixelScale: 2,
        ditherIntensity: 0.9,
        colorDepth: 16,
        gradientDithering: true,
        noiseAmount: 0.5,
        noiseMethod: 'checker',
        edgeDetection: false,
        normalShading: true,
        normalIntensity: 0.3,
        normalDithering: false
    },
    'Newspaper': {
        pixelScale: 4,
        ditherIntensity: 1.0,
        colorDepth: 2,
        gradientDithering: true,
        noiseAmount: 0.7,
        noiseMethod: 'halftone',
        edgeDetection: true,
        edgeThreshold: 0.12,
        edgeMethod: 'sobel',
        normalShading: false
    },
    'Obra Dinn': {
        pixelScale: 2,
        ditherIntensity: 1.0,
        colorDepth: 2,
        gradientDithering: true,
        noiseAmount: 0.6,
        noiseMethod: 'void',
        edgeDetection: true,
        edgeThreshold: 0.05,
        edgeMethod: 'depth',
        normalShading: true,
        normalIntensity: 0.7,
        normalDithering: true
    },
    'Watercolor': {
        pixelScale: 3,
        ditherIntensity: 0.4,
        colorDepth: 32,
        gradientDithering: true,
        noiseAmount: 0.8,
        noiseMethod: 'triangle',
        edgeDetection: true,
        edgeThreshold: 0.2,
        edgeMethod: 'normal',
        normalShading: true,
        normalIntensity: 0.2,
        normalDithering: false
    },
    'Arcade': {
        pixelScale: 4,
        ditherIntensity: 0.7,
        colorDepth: 8,
        gradientDithering: false,
        edgeDetection: false,
        normalShading: true,
        normalIntensity: 0.5,
        normalDithering: false,
        normalMethod: 'toon',
        usePalette: true,
        palette: 'pico8'
    },
    'ASCII Art': {
        pixelScale: 8,
        ditherIntensity: 1.0,
        colorDepth: 2,
        gradientDithering: true,
        noiseAmount: 0.3,
        noiseMethod: 'bayer8',
        edgeDetection: false,
        normalShading: true,
        normalIntensity: 0.6,
        normalDithering: true
    },
    'Film Noir': {
        ...basePresetSettings,
        pixelScale: 2,
        ditherIntensity: 0.8,
        colorDepth: 4,
        gradientDithering: true,
        noiseAmount: 0.5,
        noiseMethod: 'white',
        edgeDetection: true,
        edgeThreshold: 0.1,
        edgeMethod: 'sobel',
        normalShading: true,
        normalIntensity: 0.9,
        normalDithering: false,
        normalMethod: 'fresnel',
        // Advanced lighting for dramatic shadows
        lightingModel: 'phong',
        ambientLightIntensity: 0.1,
        directionalLight1Intensity: 1.5,
        directionalLight1Color: '#E0E0E0',
        directionalLight2Color: '#4080FF',
        directionalLight2Intensity: 0.3,
        specularIntensity: 1.0,
        specularPower: 64,
        contrast: 1.3,
        saturation: 0.3,
        vignette: true,
        vignetteIntensity: 0.7
    },
    'Crosshatch': {
        pixelScale: 2,
        ditherIntensity: 1.0,
        colorDepth: 2,
        gradientDithering: true,
        noiseAmount: 0.7,
        noiseMethod: 'roberts',
        edgeDetection: true,
        edgeThreshold: 0.06,
        normalShading: true,
        normalIntensity: 0.5,
        normalDithering: true
    },
    'VHS': {
        pixelScale: 3,
        ditherIntensity: 0.6,
        colorDepth: 16,
        gradientDithering: true,
        noiseAmount: 0.9,
        noiseMethod: 'white',
        edgeDetection: false,
        normalShading: true,
        normalIntensity: 0.3,
        normalDithering: false
    },
    'Blueprint': {
        pixelScale: 1,
        ditherIntensity: 0.3,
        colorDepth: 2,
        gradientDithering: false,
        edgeDetection: true,
        edgeThreshold: 0.03,
        edgeMethod: 'normal',
        normalShading: false,
        edgeColor: '#FFFFFF'
    },
    'Thermal': {
        pixelScale: 3,
        ditherIntensity: 0.8,
        colorDepth: 8,
        gradientDithering: true,
        noiseAmount: 0.4,
        noiseMethod: 'ign',
        edgeDetection: false,
        normalShading: true,
        normalIntensity: 1.0,
        normalDithering: false,
        normalMethod: 'lambert'
    },
    'Matrix': {
        ...basePresetSettings,
        pixelScale: 2,
        ditherIntensity: 1.0,
        colorDepth: 2,
        gradientDithering: true,
        noiseAmount: 0.6,
        noiseMethod: 'white',
        edgeDetection: true,
        edgeThreshold: 0.07,
        normalShading: false,
        edgeColor: '#00FF00',
        // Matrix green theme
        ambientLightColor: '#001100',
        ambientLightIntensity: 0.4,
        directionalLight1Color: '#00FF00',
        scanlines: true,
        scanlineIntensity: 0.7
    },
    'Cyberpunk': {
        ...basePresetSettings,
        pixelScale: 2,
        ditherIntensity: 0.7,
        colorDepth: 16,
        gradientDithering: true,
        noiseAmount: 0.5,
        noiseMethod: 'blue',
        edgeDetection: true,
        edgeThreshold: 0.08,
        edgeColor: '#FF00FF',
        normalShading: true,
        normalIntensity: 0.8,
        // Neon lighting
        lightingModel: 'blinn-phong',
        ambientLightColor: '#1A0033',
        ambientLightIntensity: 0.2,
        directionalLight1Color: '#FF00FF',
        directionalLight1Intensity: 1.2,
        directionalLight2Color: '#00FFFF',
        directionalLight2Intensity: 0.8,
        pointLight1Color: '#FFAA00',
        pointLight1Intensity: 1.0,
        pointLight1Radius: 15.0,
        // Material settings
        metallic: 0.7,
        roughness: 0.2,
        emissionColor: '#FF00FF',
        emissionIntensity: 0.3,
        specularIntensity: 1.5,
        specularPower: 64,
        // Post-processing
        bloom: true,
        bloomIntensity: 0.8,
        chromaticAberration: 0.02,
        contrast: 1.2,
        saturation: 1.4
    }
};

// Dithering shader
const ditherShader = {
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tNormal;
        uniform sampler2D tDepth;
        uniform vec2 resolution;
        uniform float pixelSize;
        uniform float intensity;
        uniform float time;
        uniform bool gradientDithering;
        uniform float noiseAmount;
        uniform int noiseMethod;
        uniform float colorDepth;
        // Edge detection
        uniform bool edgeDetection;
        uniform float edgeThreshold;
        uniform vec3 edgeColor;
        uniform int edgeMethod; // 0=sobel, 1=fwidth, 2=normal
        // Normal shading
        uniform bool normalShading;
        uniform float normalIntensity;
        uniform int normalMethod; // 0=lambert, 1=toon, 2=fresnel
        uniform bool normalDithering;
        uniform vec3 lightDirection;
        // Extended lighting
        uniform int lightingModel; // 0=phong, 1=blinn-phong, 2=pbr-simple
        uniform vec3 ambientLightColor;
        uniform float ambientLightIntensity;
        uniform vec3 directionalLight1Color;
        uniform float directionalLight1Intensity;
        uniform vec3 directionalLight1Direction;
        uniform vec3 directionalLight2Color;
        uniform float directionalLight2Intensity;
        uniform vec3 directionalLight2Direction;
        uniform vec3 pointLight1Color;
        uniform float pointLight1Intensity;
        uniform vec3 pointLight1Position;
        uniform float pointLight1Radius;
        uniform float specularIntensity;
        uniform float specularPower;
        uniform bool ambientOcclusion;
        uniform float ambientOcclusionRadius;
        uniform float ambientOcclusionIntensity;
        // cameraPosition is already defined by Three.js
        // Material properties
        uniform float metallic;
        uniform float roughness;
        uniform vec3 emissionColor;
        uniform float emissionIntensity;
        // Palette
        uniform bool usePalette;
        uniform vec3 paletteColors[16];
        uniform int paletteSize;
        // Color enhancement
        uniform float saturation;
        uniform float contrast;
        uniform float brightness;
        uniform float hueShift;
        uniform float temperature;
        // Pattern options
        uniform float patternRotation;
        uniform float patternScale;
        // Outline enhancement
        uniform float outlineWidth;
        uniform float outlineOpacity;
        uniform int outlineMode; // 0=outer, 1=inner, 2=both
        // Post-processing
        uniform bool bloom;
        uniform float bloomIntensity;
        uniform float bloomThreshold;
        uniform bool vignette;
        uniform float vignetteIntensity;
        uniform float chromaticAberration;
        uniform bool scanlines;
        uniform float scanlineIntensity;
        // Temporal
        uniform sampler2D tPrevious;
        uniform float frameBlending;
        uniform bool temporalOffset;
        uniform float frameTime;
        // Advanced dithering
        uniform int ditherBlendMode; // 0=normal, 1=multiply, 2=overlay, 3=screen
        uniform bool adaptiveDithering;
        uniform bool perChannelDither;
        uniform bool errorDiffusion;
        uniform float errorDiffusionStrength;
        
        varying vec2 vUv;
        
        float bayer4x4(vec2 pos) {
            // Apply pattern scale and rotation
            vec2 scaledPos = pos / patternScale;
            if (abs(patternRotation) > 0.001) {
                float s = sin(patternRotation);
                float c = cos(patternRotation);
                scaledPos = vec2(
                    scaledPos.x * c - scaledPos.y * s,
                    scaledPos.x * s + scaledPos.y * c
                );
            }
            
            const mat4 bayerMatrix = mat4(
                0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
                12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
                3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
                15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
            );
            
            ivec2 p = ivec2(mod(scaledPos, 4.0));
            return bayerMatrix[p.y][p.x];
        }
        
        // Interleaved Gradient Noise (from Jorge Jimenez)
        float interleavedGradientNoise(vec2 pos) {
            vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
            return fract(magic.z * fract(dot(pos, magic.xy)));
        }
        
        // Simple hash for blue noise approximation
        float hash(vec2 p) {
            p = fract(p * vec2(443.8975, 397.2973));
            p += dot(p.xy, p.yx + 19.19);
            return fract(p.x * p.y);
        }
        
        // White noise
        float whiteNoise(vec2 pos) {
            return fract(sin(dot(pos, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        // 8x8 Bayer matrix for finer gradients
        float bayer8x8(vec2 pos) {
            const float matrix[64] = float[](
                0.0, 32.0, 8.0, 40.0, 2.0, 34.0, 10.0, 42.0,
                48.0, 16.0, 56.0, 24.0, 50.0, 18.0, 58.0, 26.0,
                12.0, 44.0, 4.0, 36.0, 14.0, 46.0, 6.0, 38.0,
                60.0, 28.0, 52.0, 20.0, 62.0, 30.0, 54.0, 22.0,
                3.0, 35.0, 11.0, 43.0, 1.0, 33.0, 9.0, 41.0,
                51.0, 19.0, 59.0, 27.0, 49.0, 17.0, 57.0, 25.0,
                15.0, 47.0, 7.0, 39.0, 13.0, 45.0, 5.0, 37.0,
                63.0, 31.0, 55.0, 23.0, 61.0, 29.0, 53.0, 21.0
            );
            ivec2 p = ivec2(mod(pos, 8.0));
            return matrix[p.y * 8 + p.x] / 64.0;
        }
        
        // Void and cluster dithering pattern
        float voidAndCluster(vec2 pos) {
            vec2 p = floor(pos / 4.0);
            float cluster = hash(p);
            vec2 localPos = mod(pos, 4.0);
            float localPattern = bayer4x4(localPos);
            return mix(localPattern, cluster, 0.5);
        }
        
        // Triangle distribution noise
        float triangleNoise(vec2 pos) {
            float n1 = fract(sin(dot(pos, vec2(12.9898, 78.233))) * 43758.5453);
            float n2 = fract(sin(dot(pos + vec2(1.0), vec2(12.9898, 78.233))) * 43758.5453);
            return (n1 + n2) * 0.5; // Average of two uniform random = triangle distribution
        }
        
        // Checkerboard pattern
        float checkerboard(vec2 pos) {
            ivec2 p = ivec2(floor(pos));
            return float((p.x + p.y) % 2);
        }
        
        // Halftone pattern
        float halftone(vec2 pos) {
            vec2 p = mod(pos * 0.25, 1.0) - 0.5;
            float dist = length(p);
            return 1.0 - smoothstep(0.0, 0.5, dist);
        }
        
        // Roberts cross pattern
        float robertsCross(vec2 pos) {
            const mat2 roberts = mat2(1.0, 0.0, 0.0, -1.0);
            vec2 p = mod(pos, 2.0);
            return step(0.5, roberts[int(p.y)][int(p.x)]);
        }
        
        // Advanced dithering blend modes
        float blendDither(float base, float dither, int mode) {
            if (mode == 0) return dither; // Normal
            else if (mode == 1) return base * dither; // Multiply
            else if (mode == 2) { // Overlay
                if (base < 0.5) return 2.0 * base * dither;
                else return 1.0 - 2.0 * (1.0 - base) * (1.0 - dither);
            }
            else if (mode == 3) return 1.0 - (1.0 - base) * (1.0 - dither); // Screen
            return dither;
        }
        
        // Adaptive dithering based on local contrast
        float getAdaptiveThreshold(vec2 uv, sampler2D tex) {
            vec2 texelSize = 1.0 / resolution;
            float center = dot(texture2D(tex, uv).rgb, vec3(0.299, 0.587, 0.114));
            
            // Sample neighbors
            float tl = dot(texture2D(tex, uv + vec2(-texelSize.x, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            float tr = dot(texture2D(tex, uv + vec2(texelSize.x, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            float bl = dot(texture2D(tex, uv + vec2(-texelSize.x, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            float br = dot(texture2D(tex, uv + vec2(texelSize.x, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            
            // Calculate local variance
            float avg = (center + tl + tr + bl + br) / 5.0;
            float variance = abs(center - avg) + abs(tl - avg) + abs(tr - avg) + abs(bl - avg) + abs(br - avg);
            
            // Adjust threshold based on variance
            return mix(0.5, variance * 2.0, 0.5);
        }
        
        // Simple error diffusion (Floyd-Steinberg approximation)
        vec3 applyErrorDiffusion(vec2 uv, vec3 color, float strength) {
            vec2 texelSize = 1.0 / resolution;
            vec3 quantized = floor(color * colorDepth + 0.5) / colorDepth;
            vec3 error = (color - quantized) * strength;
            
            // Distribute error to neighbors (simplified)
            vec3 distributed = error * 0.25;
            vec3 noise = vec3(
                hash(uv + vec2(1.0, 0.0)),
                hash(uv + vec2(0.0, 1.0)),
                hash(uv + vec2(1.0, 1.0))
            );
            
            return quantized + distributed * noise;
        }
        
        // Color adjustment functions
        vec3 adjustSaturation(vec3 color, float sat) {
            float gray = dot(color, vec3(0.299, 0.587, 0.114));
            return mix(vec3(gray), color, sat);
        }
        
        vec3 adjustContrast(vec3 color, float con) {
            return (color - 0.5) * con + 0.5;
        }
        
        vec3 adjustHue(vec3 color, float hue) {
            float angle = hue * 3.14159265 * 2.0;
            float s = sin(angle);
            float c = cos(angle);
            mat3 hueRotate = mat3(
                0.299 + 0.701 * c + 0.168 * s,
                0.299 - 0.299 * c + 0.413 * s,
                0.299 - 0.328 * c - 1.413 * s,
                0.587 - 0.587 * c + 0.330 * s,
                0.587 + 0.413 * c + 0.035 * s,
                0.587 - 0.588 * c + 1.049 * s,
                0.114 - 0.114 * c - 0.497 * s,
                0.114 - 0.114 * c - 0.194 * s,
                0.114 + 0.886 * c + 0.772 * s
            );
            return clamp(color * hueRotate, 0.0, 1.0);
        }
        
        vec3 adjustTemperature(vec3 color, float temp) {
            vec3 warmFilter = vec3(1.0, 0.9, 0.7);
            vec3 coolFilter = vec3(0.7, 0.9, 1.0);
            vec3 tempFilter = mix(vec3(1.0), temp > 0.0 ? warmFilter : coolFilter, abs(temp));
            return color * tempFilter;
        }
        
        // Get noise value based on selected method
        float getNoise(vec2 pos, int method) {
            if (method == 0) return interleavedGradientNoise(pos);
            else if (method == 1) return hash(pos);
            else if (method == 2) return whiteNoise(pos);
            else if (method == 3) return bayer8x8(pos);
            else if (method == 4) return voidAndCluster(pos);
            else if (method == 5) return triangleNoise(pos);
            else if (method == 6) return checkerboard(pos);
            else if (method == 7) return halftone(pos);
            else if (method == 8) return robertsCross(pos);
            return interleavedGradientNoise(pos);
        }
        
        // Sobel edge detection
        float sobelEdge(sampler2D tex, vec2 uv) {
            vec2 texelSize = (1.0 / resolution) * outlineWidth;
            
            float tl = dot(texture2D(tex, uv + vec2(-texelSize.x, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            float tm = dot(texture2D(tex, uv + vec2(0.0, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            float tr = dot(texture2D(tex, uv + vec2(texelSize.x, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            float ml = dot(texture2D(tex, uv + vec2(-texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float mm = dot(texture2D(tex, uv).rgb, vec3(0.299, 0.587, 0.114));
            float mr = dot(texture2D(tex, uv + vec2(texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float bl = dot(texture2D(tex, uv + vec2(-texelSize.x, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            float bm = dot(texture2D(tex, uv + vec2(0.0, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            float br = dot(texture2D(tex, uv + vec2(texelSize.x, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
            
            float gx = -1.0 * tl + 1.0 * tr + -2.0 * ml + 2.0 * mr + -1.0 * bl + 1.0 * br;
            float gy = -1.0 * tl + -2.0 * tm + -1.0 * tr + 1.0 * bl + 2.0 * bm + 1.0 * br;
            
            return length(vec2(gx, gy));
        }
        
        // Normal-based edge detection
        float normalEdge(vec2 uv) {
            vec2 texelSize = (1.0 / resolution) * outlineWidth;
            vec3 n0 = texture2D(tNormal, uv).rgb * 2.0 - 1.0;
            vec3 n1 = texture2D(tNormal, uv + vec2(texelSize.x, 0.0)).rgb * 2.0 - 1.0;
            vec3 n2 = texture2D(tNormal, uv + vec2(0.0, texelSize.y)).rgb * 2.0 - 1.0;
            
            float d1 = 1.0 - dot(n0, n1);
            float d2 = 1.0 - dot(n0, n2);
            
            return max(d1, d2);
        }
        
        // Depth-based edge detection
        float depthEdge(vec2 uv) {
            vec2 texelSize = (1.0 / resolution) * outlineWidth;
            float d0 = texture2D(tDepth, uv).r;
            float d1 = texture2D(tDepth, uv + vec2(texelSize.x, 0.0)).r;
            float d2 = texture2D(tDepth, uv + vec2(0.0, texelSize.y)).r;
            
            return max(abs(d0 - d1), abs(d0 - d2));
        }
        
        // Calculate ambient occlusion
        float calculateAO(vec2 uv) {
            float ao = 1.0;
            if (ambientOcclusion) {
                vec2 texelSize = (1.0 / resolution) * ambientOcclusionRadius;
                float depth = texture2D(tDepth, uv).r;
                
                float totalOcclusion = 0.0;
                float samples = 0.0;
                
                for (int i = -2; i <= 2; i++) {
                    for (int j = -2; j <= 2; j++) {
                        if (i == 0 && j == 0) continue;
                        vec2 offset = vec2(float(i), float(j)) * texelSize;
                        float sampleDepth = texture2D(tDepth, uv + offset).r;
                        totalOcclusion += step(depth - 0.001, sampleDepth);
                        samples += 1.0;
                    }
                }
                
                ao = totalOcclusion / samples;
                ao = mix(1.0, ao, ambientOcclusionIntensity);
            }
            return ao;
        }
        
        // Advanced lighting calculation
        vec3 calculateLighting(vec3 baseColor, vec3 normal, vec3 worldPos, vec2 screenPos) {
            vec3 n = normalize(normal * 2.0 - 1.0);
            vec3 viewDir = normalize(cameraPosition - worldPos);
            
            // Material adjustments
            vec3 albedo = baseColor;
            vec3 f0 = mix(vec3(0.04), albedo, metallic); // Fresnel reflectance at normal incidence
            
            // Start with ambient light
            vec3 lighting = ambientLightColor * ambientLightIntensity * (1.0 - metallic * 0.5);
            
            // Directional light 1
            if (directionalLight1Intensity > 0.0) {
                vec3 l1 = normalize(directionalLight1Direction);
                float ndotl1 = max(0.0, dot(n, l1));
                
                // Diffuse
                vec3 diffuse1 = directionalLight1Color * ndotl1 * directionalLight1Intensity;
                
                // Specular
                vec3 specular1 = vec3(0.0);
                if (specularIntensity > 0.0 && ndotl1 > 0.0) {
                    vec3 reflectDir = reflect(-l1, n);
                    float spec = 0.0;
                    
                    // Adjust specular power based on roughness
                    float adjustedPower = mix(128.0, 4.0, roughness) * (specularPower / 32.0);
                    
                    if (lightingModel == 0) { // Phong
                        spec = pow(max(0.0, dot(viewDir, reflectDir)), adjustedPower);
                    } else if (lightingModel == 1) { // Blinn-Phong
                        vec3 halfwayDir = normalize(l1 + viewDir);
                        spec = pow(max(0.0, dot(n, halfwayDir)), adjustedPower);
                    } else if (lightingModel == 2) { // PBR-simple
                        vec3 halfwayDir = normalize(l1 + viewDir);
                        float NdotH = max(0.0, dot(n, halfwayDir));
                        float VdotH = max(0.0, dot(viewDir, halfwayDir));
                        
                        // Simplified GGX distribution
                        float roughness2 = roughness * roughness;
                        float d = NdotH * NdotH * (roughness2 - 1.0) + 1.0;
                        float ggx = roughness2 / (3.14159265 * d * d);
                        
                        // Simplified Fresnel
                        vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - VdotH, 5.0);
                        
                        spec = ggx * fresnel.x; // Use x component for grayscale
                    }
                    
                    // Metallic affects specular color
                    vec3 specColor = mix(vec3(1.0), directionalLight1Color, metallic);
                    specular1 = specColor * spec * specularIntensity * directionalLight1Intensity;
                }
                
                lighting += diffuse1 + specular1;
            }
            
            // Directional light 2
            if (directionalLight2Intensity > 0.0) {
                vec3 l2 = normalize(directionalLight2Direction);
                float ndotl2 = max(0.0, dot(n, l2));
                
                vec3 diffuse2 = directionalLight2Color * ndotl2 * directionalLight2Intensity;
                
                vec3 specular2 = vec3(0.0);
                if (specularIntensity > 0.0 && ndotl2 > 0.0) {
                    vec3 reflectDir = reflect(-l2, n);
                    float spec = 0.0;
                    
                    if (lightingModel == 0) { // Phong
                        spec = pow(max(0.0, dot(viewDir, reflectDir)), specularPower);
                    } else if (lightingModel == 1) { // Blinn-Phong
                        vec3 halfwayDir = normalize(l2 + viewDir);
                        spec = pow(max(0.0, dot(n, halfwayDir)), specularPower);
                    }
                    
                    specular2 = directionalLight2Color * spec * specularIntensity * directionalLight2Intensity;
                }
                
                lighting += diffuse2 + specular2;
            }
            
            // Point light 1
            if (pointLight1Intensity > 0.0) {
                vec3 lightPos = pointLight1Position;
                vec3 lightDir = lightPos - worldPos;
                float distance = length(lightDir);
                lightDir = normalize(lightDir);
                
                float attenuation = 1.0 - smoothstep(0.0, pointLight1Radius, distance);
                
                if (attenuation > 0.0) {
                    float ndotl = max(0.0, dot(n, lightDir));
                    vec3 diffuse = pointLight1Color * ndotl * pointLight1Intensity * attenuation;
                    
                    vec3 specular = vec3(0.0);
                    if (specularIntensity > 0.0 && ndotl > 0.0) {
                        vec3 reflectDir = reflect(-lightDir, n);
                        float spec = 0.0;
                        
                        if (lightingModel == 0) { // Phong
                            spec = pow(max(0.0, dot(viewDir, reflectDir)), specularPower);
                        } else if (lightingModel == 1) { // Blinn-Phong
                            vec3 halfwayDir = normalize(lightDir + viewDir);
                            spec = pow(max(0.0, dot(n, halfwayDir)), specularPower);
                        }
                        
                        specular = pointLight1Color * spec * specularIntensity * pointLight1Intensity * attenuation;
                    }
                    
                    lighting += diffuse + specular;
                }
            }
            
            return lighting;
        }
        
        // Normal shading methods
        vec3 applyNormalShading(vec3 color, vec3 normal, vec2 screenPos, vec2 uv) {
            vec3 n = normalize(normal * 2.0 - 1.0);
            vec3 worldPos = vec3(uv * 2.0 - 1.0, 0.0) * 10.0; // Approximate world position
            
            // Calculate full lighting
            vec3 lighting = calculateLighting(color, normal, worldPos, screenPos);
            
            // Apply ambient occlusion
            float ao = calculateAO(uv);
            lighting *= ao;
            
            // Legacy normal method support (for presets)
            if (normalMethod == 2) { // Fresnel
                vec3 viewDir = vec3(0.0, 0.0, 1.0);
                float fresnel = pow(1.0 - max(0.0, dot(n, viewDir)), 2.0);
                lighting = mix(lighting, vec3(1.0), fresnel * 0.5);
            }
            
            // Apply dithering to the lighting if enabled
            vec3 litColor = color * lighting;
            if (normalDithering) {
                float threshold = bayer4x4(screenPos);
                float lightValue = dot(lighting, vec3(0.299, 0.587, 0.114));
                lightValue = step(threshold, lightValue);
                litColor = color * lightValue;
            }
            
            return mix(color, litColor, normalIntensity);
        }
        
        void main() {
            // Pixelate
            vec2 dxy = pixelSize / resolution;
            vec2 coord = dxy * floor(vUv / dxy);
            vec4 color = texture2D(tDiffuse, coord);
            
            // Detect gradients by sampling neighbors
            float gradientStrength = 0.0;
            if (gradientDithering) {
                vec2 texelSize = 1.0 / resolution;
                vec3 col0 = texture2D(tDiffuse, coord + vec2(-texelSize.x, 0)).rgb;
                vec3 col1 = texture2D(tDiffuse, coord + vec2(texelSize.x, 0)).rgb;
                vec3 col2 = texture2D(tDiffuse, coord + vec2(0, -texelSize.y)).rgb;
                vec3 col3 = texture2D(tDiffuse, coord + vec2(0, texelSize.y)).rgb;
                
                vec3 dx = col1 - col0;
                vec3 dy = col3 - col2;
                gradientStrength = length(dx) + length(dy);
                gradientStrength = smoothstep(0.0, 0.1, gradientStrength);
            }
            
            // Apply color depth reduction first
            vec3 quantizedColor = color.rgb;
            if (colorDepth < 32.0) {
                float levels = colorDepth;
                quantizedColor = floor(color.rgb * levels + 0.5) / levels;
            }
            
            // Apply palette if enabled
            if (usePalette) {
                float minDist = 1000.0;
                vec3 closestColor = quantizedColor;
                
                for (int i = 0; i < 16; i++) {
                    if (i >= paletteSize) break;
                    vec3 paletteColor = paletteColors[i] / 255.0;
                    float dist = distance(quantizedColor, paletteColor);
                    if (dist < minDist) {
                        minDist = dist;
                        closestColor = paletteColor;
                    }
                }
                
                quantizedColor = closestColor;
            }
            
            // Convert to grayscale
            float gray = dot(quantizedColor, vec3(0.299, 0.587, 0.114));
            
            // Apply dithering
            vec2 screenPos = gl_FragCoord.xy;
            float threshold = bayer4x4(screenPos);
            
            // Adaptive dithering adjustment
            if (adaptiveDithering) {
                float adaptiveThresh = getAdaptiveThreshold(coord, tDiffuse);
                threshold = mix(threshold, adaptiveThresh, 0.5);
            }
            
            // Apply temporal offset if enabled
            if (temporalOffset) {
                screenPos += vec2(mod(frameTime, 4.0), mod(frameTime * 0.7, 4.0));
            }
            
            // Mix in noise for gradients
            if (gradientDithering && gradientStrength > 0.0) {
                float noise = getNoise(screenPos, noiseMethod);
                threshold = mix(threshold, noise, gradientStrength * noiseAmount);
            }
            
            vec3 finalColor = quantizedColor;
            
            // Apply error diffusion if enabled
            if (errorDiffusion) {
                finalColor = applyErrorDiffusion(coord, quantizedColor, errorDiffusionStrength);
            }
            
            // Per-channel dithering
            if (perChannelDither) {
                float rDither = step(threshold, finalColor.r);
                float gDither = step(threshold * 1.1, finalColor.g); // Slight offset for variation
                float bDither = step(threshold * 0.9, finalColor.b);
                vec3 ditheredColor = vec3(rDither, gDither, bDither);
                finalColor = mix(finalColor, ditheredColor, intensity);
            } else {
                // Standard grayscale dithering
                float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
                float dithered = blendDither(gray, step(threshold, gray), ditherBlendMode);
                finalColor = mix(finalColor, vec3(dithered), intensity);
            }
            
            // Apply normal shading if enabled
            if (normalShading) {
                vec3 normal = texture2D(tNormal, coord).rgb;
                finalColor = applyNormalShading(finalColor, normal, screenPos, coord);
            }
            
            // Apply edge detection if enabled
            if (edgeDetection) {
                float edge = 0.0;
                
                if (edgeMethod == 0) { // Sobel
                    edge = sobelEdge(tDiffuse, coord);
                } else if (edgeMethod == 1) { // Depth
                    edge = depthEdge(coord);
                } else if (edgeMethod == 2) { // Normal
                    edge = normalEdge(coord);
                }
                
                if (edge > edgeThreshold) {
                    finalColor = mix(finalColor, edgeColor, smoothstep(edgeThreshold, edgeThreshold * 2.0, edge) * outlineOpacity);
                }
            }
            
            // Apply color adjustments
            finalColor = adjustSaturation(finalColor, saturation);
            finalColor = adjustContrast(finalColor, contrast);
            finalColor = finalColor * brightness;
            finalColor = adjustHue(finalColor, hueShift);
            finalColor = adjustTemperature(finalColor, temperature);
            
            // Add emission
            if (emissionIntensity > 0.0) {
                finalColor += emissionColor * emissionIntensity;
            }
            
            // Scanlines with dithering
            if (scanlines) {
                float scanline = sin(gl_FragCoord.y * 0.1) * 0.5 + 0.5;
                float scanlineEffect = mix(1.0, scanline, scanlineIntensity);
                
                // Dither the scanline effect
                float scanlineDither = bayer4x4(screenPos + vec2(0.0, 100.0)); // Offset to avoid pattern conflict
                scanlineEffect = mix(1.0, scanlineEffect, step(scanlineDither, scanlineIntensity));
                
                finalColor *= scanlineEffect;
            }
            
            // Vignette with dithering
            if (vignette) {
                vec2 vigCoords = vUv * 2.0 - 1.0;
                float vigDistance = dot(vigCoords, vigCoords);
                float vig = 1.0 - vigDistance * vignetteIntensity;
                
                // Dither the vignette based on distance from center
                float vignetteDither = bayer4x4(screenPos + vec2(50.0, 50.0)); // Offset pattern
                float ditheredVig = mix(1.0, vig, step(vignetteDither, 1.0 - vigDistance * 0.5));
                
                finalColor *= ditheredVig;
            }
            
            // Temporal blending
            if (frameBlending > 0.0) {
                vec3 previousColor = texture2D(tPrevious, vUv).rgb;
                finalColor = mix(finalColor, previousColor, frameBlending);
            }
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

// Helper functions
function updateCamera() {
    const distance = 20;
    const xRad = config.cameraTiltX * Math.PI / 180;
    const yRad = config.cameraTiltY * Math.PI / 180;
    const rollRad = config.cameraRoll * Math.PI / 180;
    
    const x = distance * Math.sin(yRad) * Math.cos(xRad);
    const y = distance * Math.sin(xRad);
    const z = distance * Math.cos(yRad) * Math.cos(xRad);
    
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.rotation.z = rollRad;
    
    // Update orthographic scale
    const aspect = window.innerWidth / window.innerHeight;
    const d = config.cameraOrthoScale;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
}

function download(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function applyPreset(preset) {
    for (let key in preset) {
        if (config.hasOwnProperty(key)) {
            config[key] = preset[key];
        }
    }
    // Update GUI to reflect changes
    for (let i in gui.__controllers) {
        gui.__controllers[i].updateDisplay();
    }
    // Update grid visibility
    if (gridHelper) gridHelper.visible = config.showGrid;
    // Rebuild render targets if pixel scale changed
    setupPostProcessing();
}

let gui; // Store GUI reference

// Convert palette to Three.js format
function getPaletteColors(paletteName) {
    const palette = palettes[paletteName];
    const colors = [];
    for (let i = 0; i < 16; i++) {
        if (i < palette.length) {
            colors.push(new THREE.Vector3(palette[i][0], palette[i][1], palette[i][2]));
        } else {
            colors.push(new THREE.Vector3(0, 0, 0));
        }
    }
    return colors;
}

// Performance tracking
const perfStats = {
    fps: 0,
    frames: 0,
    lastTime: performance.now(),
    updateStats: function() {
        this.frames++;
        const currentTime = performance.now();
        if (currentTime >= this.lastTime + 1000) {
            this.fps = Math.round((this.frames * 1000) / (currentTime - this.lastTime));
            this.frames = 0;
            this.lastTime = currentTime;
            
            // Update DOM
            document.getElementById('fps').textContent = this.fps;
            document.getElementById('drawCalls').textContent = renderer.info.render.calls;
            document.getElementById('triangles').textContent = renderer.info.render.triangles;
            if (pixelRenderTarget) {
                document.getElementById('resolution').textContent = 
                    `${pixelRenderTarget.width}x${pixelRenderTarget.height}`;
            }
        }
    }
};

// Initialize
function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(1); // Force pixel ratio 1
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 10, 50);
    
    // Dimetric camera
    const aspect = window.innerWidth / window.innerHeight;
    const d = config.cameraOrthoScale;
    camera = new THREE.OrthographicCamera(
        -d * aspect, d * aspect,
        d, -d,
        0.1, 1000
    );
    
    // Update camera function
    updateCamera();
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 512;
    directionalLight.shadow.mapSize.height = 512;
    scene.add(directionalLight);
    
    // Create test objects
    createTestObjects();
    
    // Setup post-processing
    setupPostProcessing();
    
    // GUI
    setupGUI();
}

function clearScene() {
    // Remove all test objects
    testObjects.forEach(obj => {
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    });
    testObjects = [];
    
    // Remove ground
    const ground = scene.getObjectByName('ground');
    if (ground) {
        scene.remove(ground);
        ground.geometry.dispose();
        ground.material.dispose();
    }
}

function createTestObjects() {
    clearScene();
    
    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x7CFC00 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.name = 'ground';
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create isometric grid
    createIsometricGrid();
    
    if (currentScene === 'geometric') {
        createGeometricScene();
    } else if (currentScene === 'terrain') {
        createTerrainScene();
    } else if (currentScene === 'character') {
        createCharacterScene();
    } else if (currentScene === 'architecture') {
        createArchitectureScene();
    }
}

function createGeometricScene() {
    // Simple objects with flat colors
    const colors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xF38181];
    const geometries = [
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.SphereGeometry(1.5, 8, 6),
        new THREE.ConeGeometry(1.5, 3, 6),
        new THREE.CylinderGeometry(1, 1, 3, 8),
        new THREE.TorusGeometry(1.5, 0.5, 4, 8)
    ];
    
    for (let i = 0; i < 5; i++) {
        const geo = geometries[i];
        const mat = new THREE.MeshLambertMaterial({ 
            color: colors[i],
            flatShading: true
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        // Position in a circle
        const angle = (i / 5) * Math.PI * 2;
        mesh.position.x = Math.cos(angle) * 6;
        mesh.position.y = 1.5;
        mesh.position.z = Math.sin(angle) * 6;
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        scene.add(mesh);
        testObjects.push(mesh);
    }
    
    // Add a sphere with gradient material to test gradient dithering
    const gradientGeo = new THREE.SphereGeometry(2, 32, 16);
    const gradientMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                float gradient = dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
                vec3 color = mix(vec3(0.2, 0.3, 0.8), vec3(0.9, 0.8, 0.3), gradient);
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
    const gradientSphere = new THREE.Mesh(gradientGeo, gradientMat);
    gradientSphere.position.set(0, 3, 0);
    gradientSphere.castShadow = true;
    scene.add(gradientSphere);
    testObjects.push(gradientSphere);
}

function createTerrainScene() {
    // Create terrain with height variation
    const size = 20;
    const segments = 20;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    
    // Add height variation
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 1];
        vertices[i + 2] = Math.sin(x * 0.5) * Math.cos(z * 0.5) * 2 + 
                         Math.random() * 0.5;
    }
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshLambertMaterial({ 
        color: 0x8B7355,
        flatShading: true 
    });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = 0;
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);
    testObjects.push(terrain);
    
    // Add some trees
    for (let i = 0; i < 10; i++) {
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.4, 2, 6),
            new THREE.MeshLambertMaterial({ color: 0x4A3C28 })
        );
        const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(1.5, 3, 6),
            new THREE.MeshLambertMaterial({ color: 0x228B22 })
        );
        
        trunk.position.set(
            (Math.random() - 0.5) * 15,
            1,
            (Math.random() - 0.5) * 15
        );
        leaves.position.copy(trunk.position);
        leaves.position.y += 2.5;
        
        trunk.castShadow = true;
        leaves.castShadow = true;
        
        scene.add(trunk);
        scene.add(leaves);
        testObjects.push(trunk, leaves);
    }
}

function createCharacterScene() {
    // Simple character made of primitives
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 2, 1),
        new THREE.MeshLambertMaterial({ color: 0x4169E1 })
    );
    body.position.y = 2;
    
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xFFDBB4 })
    );
    head.position.y = 3.5;
    
    // Arms
    const armGeo = new THREE.BoxGeometry(0.3, 1.5, 0.3);
    const armMat = new THREE.MeshLambertMaterial({ color: 0xFFDBB4 });
    
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-1, 2, 0);
    
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(1, 2, 0);
    
    // Legs
    const legGeo = new THREE.BoxGeometry(0.4, 1.5, 0.4);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
    
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.4, 0.75, 0);
    
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.4, 0.75, 0);
    
    [body, head, leftArm, rightArm, leftLeg, rightLeg].forEach(part => {
        part.castShadow = true;
        scene.add(part);
        testObjects.push(part);
    });
    
    // Add some props
    const sword = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 3, 0.1),
        new THREE.MeshLambertMaterial({ color: 0xC0C0C0 })
    );
    sword.position.set(2, 1.5, 0);
    sword.rotation.z = Math.PI / 6;
    sword.castShadow = true;
    scene.add(sword);
    testObjects.push(sword);
}

function createArchitectureScene() {
    // Simple building structures
    const buildingMat = new THREE.MeshLambertMaterial({ color: 0x8B7D6B });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    
    // Main building
    const building = new THREE.Mesh(
        new THREE.BoxGeometry(6, 4, 6),
        buildingMat
    );
    building.position.y = 2;
    building.castShadow = true;
    scene.add(building);
    testObjects.push(building);
    
    // Roof
    const roofGeo = new THREE.ConeGeometry(5, 2, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
    testObjects.push(roof);
    
    // Windows
    const windowMat = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
            const window = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 0.1),
                windowMat
            );
            window.position.set(
                (i - 0.5) * 2,
                2 + (j - 0.5) * 1.5,
                3.05
            );
            scene.add(window);
            testObjects.push(window);
        }
    }
    
    // Door
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 2.5, 0.1),
        new THREE.MeshLambertMaterial({ color: 0x654321 })
    );
    door.position.set(0, 1.25, 3.05);
    scene.add(door);
    testObjects.push(door);
    
    // Add some smaller buildings
    for (let i = 0; i < 3; i++) {
        const smallBuilding = new THREE.Mesh(
            new THREE.BoxGeometry(3, 2.5, 3),
            buildingMat
        );
        smallBuilding.position.set(
            (i - 1) * 8,
            1.25,
            -8
        );
        smallBuilding.castShadow = true;
        scene.add(smallBuilding);
        testObjects.push(smallBuilding);
        
        const smallRoof = new THREE.Mesh(
            new THREE.ConeGeometry(2.5, 1.5, 4),
            roofMat
        );
        smallRoof.position.copy(smallBuilding.position);
        smallRoof.position.y += 2.5;
        smallRoof.rotation.y = Math.PI / 4;
        smallRoof.castShadow = true;
        scene.add(smallRoof);
        testObjects.push(smallRoof);
    }
}

function createIsometricGrid() {
    // Create grid lines for isometric view
    const size = config.gridSize;
    const divisions = config.gridDivisions;
    
    // Create a group to hold all grid lines
    gridHelper = new THREE.Group();
    gridHelper.name = 'IsometricGrid';
    
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x000000, 
        opacity: 0.2,
        transparent: true
    });
    
    // Create grid lines parallel to X axis
    for (let i = 0; i <= divisions; i++) {
        const geometry = new THREE.BufferGeometry();
        const z = (i / divisions - 0.5) * size;
        const points = [
            new THREE.Vector3(-size/2, 0.01, z),
            new THREE.Vector3(size/2, 0.01, z)
        ];
        geometry.setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        gridHelper.add(line);
    }
    
    // Create grid lines parallel to Z axis
    for (let i = 0; i <= divisions; i++) {
        const geometry = new THREE.BufferGeometry();
        const x = (i / divisions - 0.5) * size;
        const points = [
            new THREE.Vector3(x, 0.01, -size/2),
            new THREE.Vector3(x, 0.01, size/2)
        ];
        geometry.setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        gridHelper.add(line);
    }
    
    gridHelper.visible = config.showGrid;
    scene.add(gridHelper);
}

function setupPostProcessing() {
    // Create low-res render target
    const pixelWidth = Math.floor(window.innerWidth / config.pixelScale);
    const pixelHeight = Math.floor(window.innerHeight / config.pixelScale);
    
    pixelRenderTarget = new THREE.WebGLRenderTarget(pixelWidth, pixelHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false
    });
    
    // Create normal render target
    normalTarget = new THREE.WebGLRenderTarget(pixelWidth, pixelHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType
    });
    
    // Create depth render target
    depthTarget = new THREE.WebGLRenderTarget(pixelWidth, pixelHeight, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        depthTexture: new THREE.DepthTexture(),
        depthBuffer: true
    });
    
    // Create previous frame buffer for temporal effects
    if (previousFrame) previousFrame.dispose();
    previousFrame = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
    });
    
    // Create materials for rendering normals and depth
    normalMaterial = new THREE.MeshNormalMaterial();
    depthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking
    });
    
    // Custom dither pass setup (simplified)
    updateShaderUniforms();
}

function updateShaderUniforms() {
    // We'll apply shader in render loop
}

function setupGUI() {
    gui = new dat.GUI();
    
    // Presets
    const presetController = {
        preset: 'Default',
        savePreset: () => {
            const preset = {};
            for (let key in config) {
                if (key !== 'baseResolution' && key !== 'showOriginal' && key !== 'showGrid' && key !== 'gridSize' && key !== 'gridDivisions') {
                    preset[key] = config[key];
                }
            }
            const json = JSON.stringify(preset, null, 2);
            download('preset.json', json);
        },
        loadPreset: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const preset = JSON.parse(e.target.result);
                        applyPreset(preset);
                    } catch (err) {
                        console.error('Invalid preset file');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }
    };
    
    gui.add(presetController, 'preset', Object.keys(presets)).name('Preset').onChange((value) => {
        applyPreset(presets[value]);
    });
    gui.add(presetController, 'savePreset').name('Save Preset');
    gui.add(presetController, 'loadPreset').name('Load Preset');
    
    // Export controls
    exportController = {
        isRecording: false,
        frames: [],
        frameCount: 60,
        frameDelay: 50,
        screenshot: () => {
            // Render at exact pixel resolution
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = pixelRenderTarget.width;
            tempCanvas.height = pixelRenderTarget.height;
            
            renderer.setRenderTarget(pixelRenderTarget);
            renderer.render(scene, camera);
            
            // Apply shader to temp canvas
            renderPixelated();
            
            // Get the main canvas data
            const dataURL = renderer.domElement.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `pixelart_${Date.now()}.png`;
            link.href = dataURL;
            link.click();
        },
        screenshotPixel: () => {
            // Save at exact pixel resolution
            renderer.setRenderTarget(pixelRenderTarget);
            renderer.render(scene, camera);
            renderer.setRenderTarget(null);
            
            // Read pixels from render target
            const width = pixelRenderTarget.width;
            const height = pixelRenderTarget.height;
            const buffer = new Uint8Array(width * height * 4);
            renderer.readRenderTargetPixels(pixelRenderTarget, 0, 0, width, height, buffer);
            
            // Create canvas and put pixel data
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(width, height);
            
            // Flip Y axis (WebGL to Canvas)
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const srcIdx = (y * width + x) * 4;
                    const dstIdx = ((height - y - 1) * width + x) * 4;
                    imageData.data[dstIdx] = buffer[srcIdx];
                    imageData.data[dstIdx + 1] = buffer[srcIdx + 1];
                    imageData.data[dstIdx + 2] = buffer[srcIdx + 2];
                    imageData.data[dstIdx + 3] = buffer[srcIdx + 3];
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            // Download
            canvas.toBlob((blob) => {
                const link = document.createElement('a');
                link.download = `pixelart_${width}x${height}_${Date.now()}.png`;
                link.href = URL.createObjectURL(blob);
                link.click();
            });
        },
        recordGIF: () => {
            if (exportController.isRecording) {
                exportController.isRecording = false;
                
                // Create GIF data
                const gifData = `data:text/plain;charset=utf-8,GIF recording would require gif.js library.
Frame count: ${exportController.frames.length}
Frame delay: ${exportController.frameDelay}ms
To implement: Add gif.js library and encode frames.`;
                
                download(`animation_${Date.now()}.txt`, gifData);
                exportController.frames = [];
                alert('GIF recording stopped. (Note: Full GIF encoding requires additional library)');
            } else {
                exportController.isRecording = true;
                exportController.frames = [];
                alert(`Recording ${exportController.frameCount} frames...`);
            }
        },
        exportSpriteSheet: () => {
            const cols = 8;
            const rows = Math.ceil(16 / cols);
            const frameWidth = pixelRenderTarget.width;
            const frameHeight = pixelRenderTarget.height;
            
            const canvas = document.createElement('canvas');
            canvas.width = frameWidth * cols;
            canvas.height = frameHeight * rows;
            const ctx = canvas.getContext('2d');
            
            // Save current rotation state
            const wasRotating = rotateObjects;
            rotateObjects = true;
            
            // Capture frames
            for (let i = 0; i < 16; i++) {
                // Rotate objects for each frame
                testObjects.forEach((obj, j) => {
                    obj.rotation.y = (i / 16) * Math.PI * 2;
                });
                
                // Render frame
                renderPixelated();
                
                // Copy to sprite sheet
                const x = (i % cols) * frameWidth;
                const y = Math.floor(i / cols) * frameHeight;
                
                ctx.drawImage(
                    renderer.domElement,
                    0, 0, renderer.domElement.width, renderer.domElement.height,
                    x, y, frameWidth, frameHeight
                );
            }
            
            // Restore rotation state
            rotateObjects = wasRotating;
            
            // Download sprite sheet
            canvas.toBlob((blob) => {
                const link = document.createElement('a');
                link.download = `spritesheet_${frameWidth}x${frameHeight}_${Date.now()}.png`;
                link.href = URL.createObjectURL(blob);
                link.click();
            });
        },
        exportPalette: () => {
            let paletteData = 'Pixel Art Renderer Palette Export\n';
            paletteData += '================================\n\n';
            
            if (config.usePalette) {
                paletteData += `Active Palette: ${config.palette}\n`;
                paletteData += 'Colors:\n';
                
                const colors = palettes[config.palette];
                colors.forEach((color, i) => {
                    const hex = '#' + color.map(c => c.toString(16).padStart(2, '0')).join('');
                    paletteData += `  ${i + 1}. RGB(${color.join(', ')}) - ${hex}\n`;
                });
            } else {
                paletteData += `Color Depth: ${config.colorDepth} colors\n`;
                paletteData += 'No specific palette active - using color quantization\n';
            }
            
            paletteData += '\nCurrent Settings:\n';
            paletteData += `  Dither Type: ${config.ditherType}\n`;
            paletteData += `  Dither Intensity: ${config.ditherIntensity}\n`;
            paletteData += `  Pixel Scale: ${config.pixelScale}\n`;
            
            // Export as .pal format (simple text format)
            download(`palette_${config.palette || 'custom'}_${Date.now()}.pal`, paletteData);
        },
        exportGIMP: () => {
            // Export palette in GIMP format
            let gplData = 'GIMP Palette\n';
            gplData += `Name: ${config.palette || 'PixelArt'}\n`;
            gplData += 'Columns: 0\n#\n';
            
            if (config.usePalette) {
                const colors = palettes[config.palette];
                colors.forEach((color, i) => {
                    gplData += `${color[0].toString().padStart(3)} ${color[1].toString().padStart(3)} ${color[2].toString().padStart(3)}\tColor ${i + 1}\n`;
                });
            }
            
            download(`${config.palette || 'custom'}.gpl`, gplData);
        }
    };
    
    // Add export GUI controls
    const exportFolder = gui.addFolder('Export Options');
    exportFolder.add(exportController, 'screenshot').name('Screenshot (Full)');
    exportFolder.add(exportController, 'screenshotPixel').name('Screenshot (Pixel)');
    exportFolder.add(exportController, 'recordGIF').name('Record GIF (Basic)');
    exportFolder.add(exportController, 'frameCount', 10, 120, 1).name('GIF Frames');
    exportFolder.add(exportController, 'frameDelay', 16, 200, 1).name('Frame Delay (ms)');
    exportFolder.add(exportController, 'exportSpriteSheet').name('Export Sprite Sheet');
    exportFolder.add(exportController, 'exportPalette').name('Export Palette (.pal)');
    exportFolder.add(exportController, 'exportGIMP').name('Export GIMP Palette');
    exportFolder.open();
    
    // Scene controls
    const sceneController = {
        scene: currentScene
    };
    gui.add(sceneController, 'scene', {
        'Geometric Shapes': 'geometric',
        'Terrain': 'terrain',
        'Character': 'character',
        'Architecture': 'architecture'
    }).name('Scene').onChange((value) => {
        currentScene = value;
        createTestObjects();
    });
    
    gui.add(config, 'pixelScale', 1, 8, 1).name('Pixel Scale').onChange(() => {
        setupPostProcessing();
    });
    
    gui.add(config, 'ditherIntensity', 0, 1).name('Dither Intensity');
    gui.add(config, 'showOriginal').name('Show Original');
    gui.add(config, 'colorDepth', [2, 4, 8, 16, 32]).name('Color Depth');
    
    // Advanced Dithering folder
    const advancedDitherFolder = gui.addFolder('Advanced Dithering');
    advancedDitherFolder.add(config, 'ditherBlendMode', ['normal', 'multiply', 'overlay', 'screen']).name('Blend Mode');
    advancedDitherFolder.add(config, 'adaptiveDithering').name('Adaptive');
    advancedDitherFolder.add(config, 'perChannelDither').name('Per Channel');
    advancedDitherFolder.add(config, 'errorDiffusion').name('Error Diffusion');
    advancedDitherFolder.add(config, 'errorDiffusionStrength', 0, 1).name('Diffusion Strength');
    
    // Palette controls
    const paletteFolder = gui.addFolder('Color Palette');
    paletteFolder.add(config, 'usePalette').name('Use Palette');
    paletteFolder.add(config, 'palette', {
        'Game Boy': 'gameboy',
        'CGA': 'cga',
        'PICO-8': 'pico8',
        'NES': 'nes',
        'ZX Spectrum': 'zx'
    }).name('Palette');
    
    // Gradient dithering controls
    gui.add(config, 'gradientDithering').name('Gradient Dithering');
    gui.add(config, 'noiseAmount', 0, 1).name('Noise Amount');
    gui.add(config, 'noiseMethod', {
        'IGN (Interleaved)': 'ign',
        'Blue Noise': 'blue',
        'White Noise': 'white',
        'Bayer 8x8': 'bayer8',
        'Void & Cluster': 'void',
        'Triangle Noise': 'triangle',
        'Checkerboard': 'checker',
        'Halftone': 'halftone',
        'Roberts Cross': 'roberts'
    }).name('Noise Method');
    
    // Grid controls
    gui.add(config, 'showGrid').name('Show Grid').onChange((value) => {
        if (gridHelper) gridHelper.visible = value;
    });
    
    // Edge detection controls
    const edgeFolder = gui.addFolder('Edge Detection');
    edgeFolder.add(config, 'edgeDetection').name('Enable');
    edgeFolder.add(config, 'edgeThreshold', 0, 1).name('Threshold');
    edgeFolder.addColor(config, 'edgeColor').name('Edge Color');
    edgeFolder.add(config, 'edgeMethod', {
        'Sobel': 'sobel',
        'Depth': 'depth',
        'Normal': 'normal'
    }).name('Method');
    
    // Normal shading controls
    const normalFolder = gui.addFolder('Normal Shading');
    normalFolder.add(config, 'normalShading').name('Enable');
    normalFolder.add(config, 'normalIntensity', 0, 1).name('Intensity');
    normalFolder.add(config, 'normalDithering').name('1-bit Dither');
    normalFolder.add(config, 'normalMethod', {
        'Lambert': 'lambert',
        'Toon': 'toon',
        'Fresnel': 'fresnel'
    }).name('Method');
    
    // Color Enhancement folder
    const colorFolder = gui.addFolder('Color Enhancement');
    colorFolder.add(config, 'saturation', 0, 2).name('Saturation');
    colorFolder.add(config, 'contrast', 0, 2).name('Contrast');
    colorFolder.add(config, 'brightness', 0, 2).name('Brightness');
    colorFolder.add(config, 'hueShift', -1, 1).name('Hue Shift');
    colorFolder.add(config, 'temperature', -1, 1).name('Temperature');
    
    // Pattern Options folder
    const patternFolder = gui.addFolder('Pattern Options');
    patternFolder.add(config, 'patternRotation', 0, Math.PI * 2).name('Rotation');
    patternFolder.add(config, 'patternScale', 0.1, 5).name('Scale');
    
    // Temporal Effects folder
    const temporalFolder = gui.addFolder('Temporal Effects');
    temporalFolder.add(config, 'frameBlending', 0, 0.95).name('Frame Blending');
    temporalFolder.add(config, 'temporalOffset').name('Temporal Offset');
    temporalFolder.add(config, 'frameRateLimit', 1, 60, 1).name('Frame Rate Limit');
    
    // Post-processing folder
    const postFolder = gui.addFolder('Post-processing');
    postFolder.add(config, 'vignette').name('Vignette');
    postFolder.add(config, 'vignetteIntensity', 0, 1).name('Vignette Intensity');
    postFolder.add(config, 'scanlines').name('Scanlines');
    postFolder.add(config, 'scanlineIntensity', 0, 1).name('Scanline Intensity');
    postFolder.add(config, 'chromaticAberration', 0, 0.1).name('Chromatic Aberration');
    
    // Camera Controls folder
    const cameraFolder = gui.addFolder('Camera Controls');
    cameraFolder.add(config, 'cameraOrthoScale', 1, 20).name('Zoom').onChange(() => updateCamera());
    cameraFolder.add(config, 'cameraTiltX', 0, 90).name('Tilt X').onChange(() => updateCamera());
    cameraFolder.add(config, 'cameraTiltY', 0, 360).name('Tilt Y').onChange(() => updateCamera());
    cameraFolder.add(config, 'cameraRoll', -180, 180).name('Roll').onChange(() => updateCamera());
    
    // Advanced Lighting folder
    const lightingFolder = gui.addFolder('Advanced Lighting');
    lightingFolder.add(config, 'lightingModel', ['phong', 'blinn-phong', 'pbr-simple']).name('Model');
    
    // Ambient light
    const ambientFolder = lightingFolder.addFolder('Ambient Light');
    ambientFolder.addColor(config, 'ambientLightColor').name('Color');
    ambientFolder.add(config, 'ambientLightIntensity', 0, 1).name('Intensity');
    
    // Directional light 1
    const dir1Folder = lightingFolder.addFolder('Directional Light 1');
    dir1Folder.addColor(config, 'directionalLight1Color').name('Color');
    dir1Folder.add(config, 'directionalLight1Intensity', 0, 2).name('Intensity');
    dir1Folder.add(config.directionalLight1Direction, 'x', -1, 1).name('Direction X');
    dir1Folder.add(config.directionalLight1Direction, 'y', -1, 1).name('Direction Y');
    dir1Folder.add(config.directionalLight1Direction, 'z', -1, 1).name('Direction Z');
    
    // Directional light 2
    const dir2Folder = lightingFolder.addFolder('Directional Light 2');
    dir2Folder.addColor(config, 'directionalLight2Color').name('Color');
    dir2Folder.add(config, 'directionalLight2Intensity', 0, 2).name('Intensity');
    dir2Folder.add(config.directionalLight2Direction, 'x', -1, 1).name('Direction X');
    dir2Folder.add(config.directionalLight2Direction, 'y', -1, 1).name('Direction Y');
    dir2Folder.add(config.directionalLight2Direction, 'z', -1, 1).name('Direction Z');
    
    // Point light 1
    const point1Folder = lightingFolder.addFolder('Point Light 1');
    point1Folder.addColor(config, 'pointLight1Color').name('Color');
    point1Folder.add(config, 'pointLight1Intensity', 0, 2).name('Intensity');
    point1Folder.add(config.pointLight1Position, 'x', -20, 20).name('Position X');
    point1Folder.add(config.pointLight1Position, 'y', -20, 20).name('Position Y');
    point1Folder.add(config.pointLight1Position, 'z', -20, 20).name('Position Z');
    point1Folder.add(config, 'pointLight1Radius', 1, 50).name('Radius');
    
    // Specular
    const specularFolder = lightingFolder.addFolder('Specular');
    specularFolder.add(config, 'specularIntensity', 0, 2).name('Intensity');
    specularFolder.add(config, 'specularPower', 1, 128).name('Power');
    
    // Ambient Occlusion
    const aoFolder = lightingFolder.addFolder('Ambient Occlusion');
    aoFolder.add(config, 'ambientOcclusion').name('Enable');
    aoFolder.add(config, 'ambientOcclusionRadius', 0.1, 2).name('Radius');
    aoFolder.add(config, 'ambientOcclusionIntensity', 0, 1).name('Intensity');
    
    // Material Properties folder
    const materialFolder = gui.addFolder('Material Properties');
    materialFolder.add(config, 'metallic', 0, 1).name('Metallic');
    materialFolder.add(config, 'roughness', 0, 1).name('Roughness');
    materialFolder.addColor(config, 'emissionColor').name('Emission Color');
    materialFolder.add(config, 'emissionIntensity', 0, 2).name('Emission Intensity');
    
    // Add animation controls
    const animFolder = gui.addFolder('Animation');
    animFolder.add({ rotate: rotateObjects }, 'rotate').name('Rotate Objects').onChange((value) => {
        rotateObjects = value;
    });
    animFolder.open();
}

// Simple post-process render
function renderPixelated() {
    if (config.showOriginal) {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        return;
    }
    
    // Render to low-res target
    renderer.setRenderTarget(pixelRenderTarget);
    renderer.render(scene, camera);
    
    // Render normals
    scene.overrideMaterial = normalMaterial;
    renderer.setRenderTarget(normalTarget);
    renderer.render(scene, camera);
    
    // Render depth
    scene.overrideMaterial = depthMaterial;
    renderer.setRenderTarget(depthTarget);
    renderer.render(scene, camera);
    
    // Reset override
    scene.overrideMaterial = null;
    
    // Create fullscreen quad with dither shader
    const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: pixelRenderTarget.texture },
                tNormal: { value: normalTarget.texture },
                tDepth: { value: depthTarget.depthTexture },
                resolution: { value: new THREE.Vector2(pixelRenderTarget.width, pixelRenderTarget.height) },
                pixelSize: { value: 1.0 },
                intensity: { value: config.ditherIntensity },
                time: { value: performance.now() * 0.001 },
                gradientDithering: { value: config.gradientDithering },
                noiseAmount: { value: config.noiseAmount },
                noiseMethod: { value: config.noiseMethod === 'ign' ? 0 : 
                                      config.noiseMethod === 'blue' ? 1 :
                                      config.noiseMethod === 'white' ? 2 : 
                                      config.noiseMethod === 'bayer8' ? 3 :
                                      config.noiseMethod === 'void' ? 4 :
                                      config.noiseMethod === 'triangle' ? 5 :
                                      config.noiseMethod === 'checker' ? 6 :
                                      config.noiseMethod === 'halftone' ? 7 :
                                      config.noiseMethod === 'roberts' ? 8 : 0 },
                colorDepth: { value: parseFloat(config.colorDepth) },
                // Edge detection
                edgeDetection: { value: config.edgeDetection },
                edgeThreshold: { value: config.edgeThreshold },
                edgeColor: { value: new THREE.Color(config.edgeColor) },
                edgeMethod: { value: config.edgeMethod === 'sobel' ? 0 :
                                    config.edgeMethod === 'depth' ? 1 :
                                    config.edgeMethod === 'normal' ? 2 : 0 },
                // Normal shading
                normalShading: { value: config.normalShading },
                normalIntensity: { value: config.normalIntensity },
                normalMethod: { value: config.normalMethod === 'lambert' ? 0 :
                                      config.normalMethod === 'toon' ? 1 :
                                      config.normalMethod === 'fresnel' ? 2 : 0 },
                normalDithering: { value: config.normalDithering },
                lightDirection: { value: new THREE.Vector3(1, 1, 0.5).normalize() },
                // Extended lighting
                lightingModel: { value: config.lightingModel === 'phong' ? 0 : 
                                       config.lightingModel === 'blinn-phong' ? 1 : 2 },
                ambientLightColor: { value: new THREE.Color(config.ambientLightColor) },
                ambientLightIntensity: { value: config.ambientLightIntensity },
                directionalLight1Color: { value: new THREE.Color(config.directionalLight1Color) },
                directionalLight1Intensity: { value: config.directionalLight1Intensity },
                directionalLight1Direction: { value: new THREE.Vector3(
                    config.directionalLight1Direction.x,
                    config.directionalLight1Direction.y,
                    config.directionalLight1Direction.z
                ).normalize() },
                directionalLight2Color: { value: new THREE.Color(config.directionalLight2Color) },
                directionalLight2Intensity: { value: config.directionalLight2Intensity },
                directionalLight2Direction: { value: new THREE.Vector3(
                    config.directionalLight2Direction.x,
                    config.directionalLight2Direction.y,
                    config.directionalLight2Direction.z
                ).normalize() },
                pointLight1Color: { value: new THREE.Color(config.pointLight1Color) },
                pointLight1Intensity: { value: config.pointLight1Intensity },
                pointLight1Position: { value: new THREE.Vector3(
                    config.pointLight1Position.x,
                    config.pointLight1Position.y,
                    config.pointLight1Position.z
                ) },
                pointLight1Radius: { value: config.pointLight1Radius },
                specularIntensity: { value: config.specularIntensity },
                specularPower: { value: config.specularPower },
                ambientOcclusion: { value: config.ambientOcclusion },
                ambientOcclusionRadius: { value: config.ambientOcclusionRadius },
                ambientOcclusionIntensity: { value: config.ambientOcclusionIntensity },
                // Material properties
                metallic: { value: config.metallic },
                roughness: { value: config.roughness },
                emissionColor: { value: new THREE.Color(config.emissionColor) },
                emissionIntensity: { value: config.emissionIntensity },
                // Palette
                usePalette: { value: config.usePalette },
                paletteColors: { value: getPaletteColors(config.palette) },
                paletteSize: { value: palettes[config.palette].length },
                // Color enhancement
                saturation: { value: config.saturation },
                contrast: { value: config.contrast },
                brightness: { value: config.brightness },
                hueShift: { value: config.hueShift },
                temperature: { value: config.temperature },
                // Pattern
                patternRotation: { value: config.patternRotation },
                patternScale: { value: config.patternScale },
                // Outline
                outlineWidth: { value: config.outlineWidth },
                outlineOpacity: { value: config.outlineOpacity },
                outlineMode: { value: config.outlineMode === 'outer' ? 0 : config.outlineMode === 'inner' ? 1 : 2 },
                // Post-processing
                bloom: { value: config.bloom },
                bloomIntensity: { value: config.bloomIntensity },
                bloomThreshold: { value: config.bloomThreshold },
                vignette: { value: config.vignette },
                vignetteIntensity: { value: config.vignetteIntensity },
                chromaticAberration: { value: config.chromaticAberration },
                scanlines: { value: config.scanlines },
                scanlineIntensity: { value: config.scanlineIntensity },
                // Temporal
                tPrevious: { value: previousFrame ? previousFrame.texture : null },
                frameBlending: { value: config.frameBlending },
                temporalOffset: { value: config.temporalOffset },
                frameTime: { value: frameCount },
                // Advanced dithering
                ditherBlendMode: { value: config.ditherBlendMode === 'normal' ? 0 :
                                         config.ditherBlendMode === 'multiply' ? 1 :
                                         config.ditherBlendMode === 'overlay' ? 2 : 3 },
                adaptiveDithering: { value: config.adaptiveDithering },
                perChannelDither: { value: config.perChannelDither },
                errorDiffusion: { value: config.errorDiffusion },
                errorDiffusionStrength: { value: config.errorDiffusionStrength }
            },
            vertexShader: ditherShader.vertexShader,
            fragmentShader: ditherShader.fragmentShader,
            depthWrite: false,
            depthTest: false
        })
    );
    
    // Render to screen
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    
    renderer.setRenderTarget(null);
    renderer.render(quadScene, orthoCamera);
    
    // Save current frame for temporal blending
    if (config.frameBlending > 0) {
        renderer.setRenderTarget(previousFrame);
        renderer.render(quadScene, orthoCamera);
        renderer.setRenderTarget(null);
    }
    
    // Update frame count for temporal offset
    frameCount++;
}

// Animation loop
let lastRenderTime = 0;
function animate(currentTime) {
    requestAnimationFrame(animate);
    
    // Frame rate limiting
    const frameInterval = 1000 / config.frameRateLimit;
    const deltaTime = currentTime - lastRenderTime;
    
    if (deltaTime < frameInterval) {
        return; // Skip this frame
    }
    
    // Adjust for frame rate limit
    lastRenderTime = currentTime - (deltaTime % frameInterval);
    
    // Rotate objects if enabled
    if (rotateObjects) {
        testObjects.forEach((obj, i) => {
            obj.rotation.y += 0.01;
            obj.rotation.x = Math.sin(Date.now() * 0.001 + i) * 0.2;
        });
    }
    
    renderPixelated();
    perfStats.updateStats();
    
    // Capture frame for GIF recording if active
    if (exportController && exportController.isRecording) {
        if (exportController.frames.length < exportController.frameCount) {
            // Capture current frame
            const frameData = renderer.domElement.toDataURL('image/png');
            exportController.frames.push(frameData);
            
            // Stop recording when we have enough frames
            if (exportController.frames.length >= exportController.frameCount) {
                exportController.recordGIF(); // This will stop recording and export
            }
        }
    }
}

// Handle resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    
    camera.left = -10 * aspect;
    camera.right = 10 * aspect;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
    setupPostProcessing();
});

// Start
init();
animate();