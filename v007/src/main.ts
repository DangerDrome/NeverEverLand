import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { TiltShiftPass } from './postprocessing/TiltShiftPass';
import { VoxelEngine, VoxelType } from './engine/VoxelEngine';
import { VoxelRenderer } from './engine/VoxelRenderer';
import { AssetPreviewScene } from './ui/AssetPreviewScene';
import { DrawingSystem } from './interaction/DrawingSystem';
import { PerformanceMonitor } from './ui/Performance';
import { DirectionIndicator } from './ui/DirectionIndicator';
import { VoxelPanel } from './ui/VoxelPanel';
import { LayerPanel } from './ui/LayerPanel';
import { ToolsPanel } from './ui/ToolsPanel';
import { FileManager } from './io/FileManager';
import { DynamicGrid } from './ui/DynamicGrid';
import { BoxSelectionTool } from './tools/BoxSelectionTool';
import { attachPerformanceTest } from './utils/PerformanceTest';
import { MenuBar } from './ui/MenuBar';
import { testBaking } from './debug/TestBaking';
import { visualBakingTest } from './debug/VisualBakingTest';
import { debugBaking } from './debug/DebugBaking';
import { testTopFaces } from './debug/TestTopFaces';
import { testPlatformFaces } from './debug/TestPlatformFaces';
import { debugBakedFaces, clearDebugArrows } from './debug/DebugBakedFaces';
import { debugMissingFaces } from './debug/DebugMissingFaces';
import { testBoundaryFaces } from './debug/TestBoundaryFaces';
import { verifyGreedyMeshing } from './debug/VerifyGreedyMeshing';
import { compareBaking } from './debug/CompareBaking';
import { testSeparatedVoxels } from './debug/TestSeparatedVoxels';
import { testBoundaryFix } from './debug/TestBoundaryFix';
import { ActionLogger } from './ui/ActionLogger';
import { testAllFaces } from './debug/TestAllFaces';
import { ColorRegistry } from './engine/ColorRegistry';

// =====================================
// settings - Customize your experience
// =====================================

export const settings = {
    // Camera Settings
    camera: {
        frustumSize: 20,              // Size of the orthographic camera view
        position: {                   // Initial camera position
            x: 20,
            y: 20,
            z: 20
        },
        lookAt: {                      // Where camera looks at initially
            x: 0,
            y: 0,
            z: 0
        },
        // IMPORTANT: Negative near plane is the solution for orthographic cameras!
        // This allows the camera to see objects "behind" its position, preventing
        // clipping issues when zooming in/out with extreme zoom ranges (0.1x - 20x)
        near: -500,                    // Negative value prevents near clipping at all zoom levels
        far: 2000                      // Extended far plane for large scenes
    },
    
    // Controls Settings
    controls: {
        enableDamping: true,           // Smooth camera movement
        dampingFactor: 0.25,           // High damping factor for minimal easing (was 0.05)
        screenSpacePanning: true,      // Pan in screen space
        minZoom: 0.1,                  // Maximum zoom out (smaller = further out)
        maxZoom: 20,                   // Maximum zoom in (larger = closer)
        mouseButtons: {                // Mouse button configuration
            left: THREE.MOUSE.ROTATE,
            middle: THREE.MOUSE.PAN,
            right: THREE.MOUSE.ROTATE
        }
    },
    
    // Renderer Settings
    renderer: {
        antialias: true,               // Enable antialiasing
        powerPreference: "high-performance", // GPU preference
        shadowMap: {
            enabled: true,             // Enable shadows
            type: THREE.PCFSoftShadowMap   // PCF Soft shadows for smoother gradients
        }
    },
    
    // Scene Settings
    scene: {
        backgroundColor: 0x87CEEB,     // Sky blue background
        fog: {
            enabled: false,             // Toggle fog effect
            color: 0x87CEEB,           // Fog color (default matches sky for seamless blend)
                                       // Try: 0xffffff (white), 0x000000 (black), 0xffcc88 (sunset)
            opacity: 1.0,              // Fog opacity/density (0.0 = transparent, 1.0 = opaque)
                                       // Note: This affects fog density calculation
            near: 10,                  // Fog start distance
            far: 100                   // Fog end distance
        },
        
        // Global Shadow Settings
        shadows: {
            // Shadow Darkness/Opacity (controlled via ambient light intensity)
            // 0.0 = pitch black shadows, 1.0 = no shadows visible
            darkness: 0.4,             // How dark shadows appear (0.4 = 60% shadow opacity)
            
            // Shadow Color Tint (affects ambient light color)
            colorTint: 0x000000,       // Shadow color tint (use 0x000000 for pure black)
                                      // Try 0x0000ff for blue shadows, 0x4a4a8f for purple
            
            // Calculated ambient intensity (don't modify directly)
            // This will be calculated as: 1.0 - darkness
            getAmbientIntensity: function() { return 1.0 - this.darkness; }
        }
    },
    
    // Lighting Settings
    lighting: {
        ambient: {
            color: 0xffffff,           // Ambient light color
            intensity: 0.6             // Ambient light intensity (controls shadow darkness)
                                      // Higher = lighter shadows, Lower = darker shadows
        },
        directional: {
            color: 0xffffff,           // Directional light color
            intensity: 0.8,            // Directional light intensity
            position: {                // Light position (increased for better coverage)
                x: 100,
                y: 200,
                z: 100
            },
            shadow: {
                // Shadow Map Quality
                mapSize: 8192,         // Maximum resolution for ultra-smooth shadows
                
                // Shadow Camera Configuration
                camera: {              
                    // Orthographic shadow camera bounds (area that casts shadows)
                    left: -20,         // Very tight bounds for maximum precision
                    right: 20,         // Ultra-focused on visible area
                    top: 20,           // Minimal area = best quality
                    bottom: -20,       // Tightly fit to scene
                    near: 0.1,         // Very close near plane
                    far: 300           // Optimized far plane
                },
                
                // Shadow Bias Settings (fine-tune to prevent artifacts)
                bias: 0.00001,         // Minimal bias for accurate shadows
                normalBias: 0.01,     // Minimal normal bias
                radius: 1.0,           // Slightly softer for smooth transitions
                blurSamples: 16        // Maximum samples for silky smooth gradients
            }
        }
    },
    
    // Ground Plane Settings
    ground: {
        size: 10000,                     // Ground plane size (doubled)
        color: 0xaaaaaa,               // Ground color (medium grey)
        roughness: 0.8,                // Material roughness
        metalness: 0.2,                // Material metalness
        yPosition: -0.001             // Y position (slightly below 0 to prevent z-fighting)
    },
    
    // Grid Settings
    grid: {
        size: 100,                     // Grid size
        divisions: 100,                // Number of grid divisions
        colorCenterLine: 0x444444,     // Center line color
        colorGrid: 0x222222,           // Grid line color
        opacity: 0.4,                  // Grid opacity
        showGrid: true,                // Whether to show grid initially
        axisLines: {
            xColor: 0xff6666,          // X-axis color (bright red)
            zColor: 0x6666ff,          // Z-axis color (bright blue)
            opacity: 0.5,              // Axis line opacity
            length: 50                 // Axis line length (extends from -length to +length)
        }
    },
    
    // Test Scene Settings
    testScene: {
        enabled: true,                 // Whether to create test scene on start
        mode: 'empty',                 // 'empty', 'flat', 'starter' - START WITH EMPTY SCENE
        flatGround: {
            sizeX: 3,                  // Half-width of flat ground
            sizeZ: 3                   // Half-depth of flat ground
        }
    },
    
    // Post-Processing Effects
    postProcessing: {
        enabled: true,                 // Enable post-processing effects
        
        // Tilt-Shift Depth of Field (v006 style)
        tiltShift: {
            enabled: false,           // Start disabled (off by default)
            focusPosition: 0.5,        // Y position of focus band (0-1, 0.5 = center)
            focusBandwidth: 0.3,       // Width of sharp focus band
            blurStrength: 10.0,         // Maximum blur amount
            gammaCorrection: 2.2,      // Gamma correction to compensate for blur darkening
            bladeCount: 6              // Aperture blade count (0=circular, 3-8=polygonal bokeh)
        }
    },
    
    // Performance Settings
    performance: {
        highPerformanceMode: true,     // Enable high performance optimizations
        showStats: false,              // Show performance stats on start
        targetFPS: 60                  // Target frames per second
    },
    
    // UI Settings
    ui: {
        showLoadingScreen: true,       // Show loading screen
        defaultBrushSize: 1,           // Default brush size
        defaultVoxelType: VoxelType.GRASS, // Default voxel type
        showWireframe: true            // Show wireframe/edges on startup
    },
    
    // Color Palette Settings - Organized by color families
    colorPalettes: {
        default: {
            name: 'Default',
            colors: [
                // Row 1 - Grayscale
                { name: 'Pure White', hex: '#FFFFFF' },
                { name: 'Light Gray', hex: '#E0E0E0' },
                { name: 'Medium Gray', hex: '#9E9E9E' },
                { name: 'Dark Gray', hex: '#424242' },
                
                // Row 2 - Reds
                { name: 'Light Red', hex: '#FFCDD2' },
                { name: 'Soft Red', hex: '#EF9A9A' },
                { name: 'Pure Red', hex: '#F44336' },
                { name: 'Dark Red', hex: '#C62828' },
                
                // Row 3 - Greens
                { name: 'Light Green', hex: '#C8E6C9' },
                { name: 'Soft Green', hex: '#A5D6A7' },
                { name: 'Pure Green', hex: '#4CAF50' },
                { name: 'Dark Green', hex: '#2E7D32' },
                
                // Row 4 - Blues
                { name: 'Light Blue', hex: '#BBDEFB' },
                { name: 'Soft Blue', hex: '#90CAF9' },
                { name: 'Pure Blue', hex: '#2196F3' },
                { name: 'Dark Blue', hex: '#1565C0' }
            ]
        },
        earth: {
            name: 'Earth',
            colors: [
                // Row 1 - Browns
                { name: 'Dark Soil', hex: '#3E2723' },
                { name: 'Rich Earth', hex: '#5D4037' },
                { name: 'Clay', hex: '#795548' },
                { name: 'Sandy Brown', hex: '#A1887F' },
                
                // Row 2 - Greens
                { name: 'Deep Forest', hex: '#1B5E20' },
                { name: 'Pine', hex: '#2E7D32' },
                { name: 'Moss', hex: '#558B2F' },
                { name: 'Sage', hex: '#689F38' },
                
                // Row 3 - Earth Tones
                { name: 'Terracotta', hex: '#BF360C' },
                { name: 'Rust', hex: '#D84315' },
                { name: 'Copper', hex: '#E65100' },
                { name: 'Ochre', hex: '#F57C00' },
                
                // Row 4 - Stone
                { name: 'Granite', hex: '#616161' },
                { name: 'Limestone', hex: '#9E9E9E' },
                { name: 'Sandstone', hex: '#BCAAA4' },
                { name: 'Chalk', hex: '#D7CCC8' }
            ]
        },
        skin: {
            name: 'Skin',
            colors: [
                // Row 1 - Light Tones
                { name: 'Porcelain', hex: '#FFF5F0' },
                { name: 'Fair', hex: '#FFE0CC' },
                { name: 'Light Beige', hex: '#F5DEB3' },
                { name: 'Warm Beige', hex: '#E8C5A0' },
                
                // Row 2 - Medium Tones
                { name: 'Natural', hex: '#D4A574' },
                { name: 'Golden', hex: '#C19A6B' },
                { name: 'Tan', hex: '#B08D57' },
                { name: 'Bronze', hex: '#9C7A3C' },
                
                // Row 3 - Deep Tones
                { name: 'Caramel', hex: '#8D5524' },
                { name: 'Honey', hex: '#7B4B3A' },
                { name: 'Chocolate', hex: '#5D4037' },
                { name: 'Coffee', hex: '#4E342E' },
                
                // Row 4 - Dark Tones
                { name: 'Mahogany', hex: '#3E2723' },
                { name: 'Ebony', hex: '#2C1810' },
                { name: 'Deep Brown', hex: '#1A0E08' },
                { name: 'Onyx', hex: '#0D0605' }
            ]
        },
        user: {
            name: 'User',
            colors: [
                { name: 'Custom 1', hex: '#FF6B6B' }
            ]
        }
    },
    // Keep the default palette as colorPalette for backward compatibility
    colorPalette: [
        // Row 1 - Grayscale
        { name: 'Pure White', hex: '#FFFFFF' },
        { name: 'Light Gray', hex: '#E0E0E0' },
        { name: 'Medium Gray', hex: '#9E9E9E' },
        { name: 'Dark Gray', hex: '#424242' },
        
        // Row 2 - Reds
        { name: 'Light Red', hex: '#FFCDD2' },
        { name: 'Soft Red', hex: '#EF9A9A' },
        { name: 'Pure Red', hex: '#F44336' },
        { name: 'Dark Red', hex: '#C62828' },
        
        // Row 3 - Greens
        { name: 'Light Green', hex: '#C8E6C9' },
        { name: 'Soft Green', hex: '#A5D6A7' },
        { name: 'Pure Green', hex: '#4CAF50' },
        { name: 'Dark Green', hex: '#2E7D32' },
        
        // Row 4 - Blues
        { name: 'Light Blue', hex: '#BBDEFB' },
        { name: 'Soft Blue', hex: '#90CAF9' },
        { name: 'Pure Blue', hex: '#2196F3' },
        { name: 'Dark Blue', hex: '#1565C0' }
    ],
    
    // Voxel Settings
    voxel: {
        size: 0.1                      // Fixed voxel size at 0.1m for high detail
    },
    
    // Brush Settings
    brush: {
        presetSizes: [1, 2, 4, 6, 8, 10], // Brush sizes (cubic: 1x1x1, 2x2x2, 4x4x4, etc.)
        defaultSizeIndex: 0,               // Start with single voxel (1x1x1)
        defaultSize: 1                     // Default brush size
    },
    
    // Application version
    version: '0.7.1'
};

class VoxelApp {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera | null;
    private renderer: THREE.WebGLRenderer | null;
    private composer: EffectComposer | null;
    private tiltShiftPass: TiltShiftPass | null;
    private controls: OrbitControls | null;
    private voxelEngine: VoxelEngine | null;
    private drawingSystem: DrawingSystem | null;
    private performanceMonitor: PerformanceMonitor | null;
    private directionIndicator: DirectionIndicator | null;
    private voxelPanel: VoxelPanel | null;
    private layerPanel: LayerPanel | null;
    private toolsPanel: ToolsPanel | null;
    private fileManager: FileManager | null;
    private boxSelectionTool: BoxSelectionTool | null;
    private menuBar: MenuBar | null;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private gridHelper: THREE.GridHelper | null = null;
    private dynamicGrid: DynamicGrid | null = null;
    private axisLines: (THREE.Mesh | THREE.Line)[] = [];
    private xAxisLine: THREE.Mesh | null = null;
    private xAxisGlow: THREE.Mesh | null = null;
    private zAxisLine: THREE.Mesh | null = null;
    private zAxisGlow: THREE.Mesh | null = null;
    private lastInteractionTime: number = 0;
    private axisIdleFadeTimer: number = 0;
    private selectionMode: boolean = false;
    private lastMousePos: { x: number; y: number } = { x: 0, y: 0 };
    private currentBrushSize: number = settings.brush.defaultSize;
    private currentBrushIndex: number = settings.brush.defaultSizeIndex;
    private isMiddleMouseDragging: boolean = false;
    private isRotating: boolean = false;
    
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.tiltShiftPass = null;
        this.controls = null;
        this.voxelEngine = null;
        this.drawingSystem = null;
        this.performanceMonitor = null;
        this.directionIndicator = null;
        this.voxelPanel = null;
        this.layerPanel = null;
        this.toolsPanel = null;
        this.fileManager = null;
        this.boxSelectionTool = null;
        this.menuBar = null;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Initialize interaction time to 0 so axes start faded
        this.lastInteractionTime = 0;
        
        this.init();
    }
    
    init() {
        // Hide loading, show UI based on settings
        if (settings.ui.showLoadingScreen) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
        }
        
        // Load version info and update info bar
        this.loadVersionInfo();
        
        // Initialize ActionLogger
        import('./ui/ActionLogger').then(({ ActionLogger }) => {
            const logger = ActionLogger.getInstance();
            logger.log('Application started');
        });
        
        // Setup renderer
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        this.renderer = new THREE.WebGLRenderer({ 
            canvas,
            antialias: settings.renderer.antialias,
            powerPreference: settings.renderer.powerPreference
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = settings.renderer.shadowMap.enabled;
        this.renderer.shadowMap.type = settings.renderer.shadowMap.type;
        const containerEl = document.getElementById('container');
        if (containerEl) containerEl.appendChild(this.renderer.domElement);
        
        // Setup camera
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = settings.camera.frustumSize;
        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            settings.camera.near,
            settings.camera.far
        );
        
        // Position camera for isometric view
        this.camera.position.set(
            settings.camera.position.x,
            settings.camera.position.y,
            settings.camera.position.z
        );
        this.camera.lookAt(
            settings.camera.lookAt.x,
            settings.camera.lookAt.y,
            settings.camera.lookAt.z
        );
        
        // Set initial zoom level (more zoomed in)
        this.camera.zoom = 8.0;  // Start at 8x zoom for much closer initial view
        this.camera.updateProjectionMatrix();
        
        // Camera initialized at position (20, 20, 20)
        
        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = settings.controls.enableDamping;
        this.controls.dampingFactor = settings.controls.dampingFactor;
        this.controls.screenSpacePanning = settings.controls.screenSpacePanning;
        this.controls.minZoom = settings.controls.minZoom;
        this.controls.maxZoom = settings.controls.maxZoom;
        
        // Configure mouse buttons
        this.controls.mouseButtons = {
            LEFT: settings.controls.mouseButtons.left,
            MIDDLE: settings.controls.mouseButtons.middle,
            RIGHT: settings.controls.mouseButtons.right
        };
        
        // Set minimum polar angle to prevent camera from going below ground
        // Small buffer for cinematic feel without interfering with voxel editing
        // The ground is at y = -0.001, so we want to prevent the camera from looking up from below
        this.controls.minPolarAngle = Math.PI * 0.05; // ~9 degrees from top, allows good top-down editing
        this.controls.maxPolarAngle = Math.PI * 0.49; // ~88 degrees, just prevents going fully below horizontal
        
        // Track camera state to detect rotation vs zoom/pan
        let lastCameraRotation = this.camera.position.clone();
        let lastTarget = this.controls.target.clone();
        
        // Add event listener for camera changes
        this.controls.addEventListener('change', () => {
            // Only register interaction if we're actively rotating
            if (this.isRotating) {
                this.registerInteraction();
            }
        });
        
        // Setup scene
        this.scene.background = new THREE.Color(settings.scene.backgroundColor);
        if (settings.scene.fog.enabled) {
            // Apply fog with custom color and adjusted density based on opacity
            const fogColor = new THREE.Color(settings.scene.fog.color);
            
            // Adjust fog distances based on opacity (lower opacity = further distances)
            const opacityMultiplier = 1.0 / Math.max(0.1, settings.scene.fog.opacity);
            const adjustedNear = settings.scene.fog.near * opacityMultiplier;
            const adjustedFar = settings.scene.fog.far * opacityMultiplier;
            
            this.scene.fog = new THREE.Fog(
                fogColor,
                adjustedNear,
                adjustedFar
            );
        }
        
        // Lighting with shadow control
        // Mix shadow color tint with white based on darkness
        const shadowTint = new THREE.Color(settings.scene.shadows.colorTint);
        const white = new THREE.Color(0xffffff);
        const ambientColor = white.clone().lerp(shadowTint, settings.scene.shadows.darkness * 0.3);
        
        const ambientLight = new THREE.AmbientLight(
            ambientColor,
            settings.scene.shadows.getAmbientIntensity()  // Use calculated intensity based on shadow darkness
        );
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(
            settings.lighting.directional.color,
            settings.lighting.directional.intensity
        );
        directionalLight.position.set(
            settings.lighting.directional.position.x,
            settings.lighting.directional.position.y,
            settings.lighting.directional.position.z
        );
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = settings.lighting.directional.shadow.camera.left;
        directionalLight.shadow.camera.right = settings.lighting.directional.shadow.camera.right;
        directionalLight.shadow.camera.top = settings.lighting.directional.shadow.camera.top;
        directionalLight.shadow.camera.bottom = settings.lighting.directional.shadow.camera.bottom;
        directionalLight.shadow.camera.near = settings.lighting.directional.shadow.camera.near;
        directionalLight.shadow.camera.far = settings.lighting.directional.shadow.camera.far;
        directionalLight.shadow.mapSize.width = settings.lighting.directional.shadow.mapSize;
        directionalLight.shadow.mapSize.height = settings.lighting.directional.shadow.mapSize;
        directionalLight.shadow.bias = settings.lighting.directional.shadow.bias;
        directionalLight.shadow.normalBias = settings.lighting.directional.shadow.normalBias;
        directionalLight.shadow.radius = settings.lighting.directional.shadow.radius;
        directionalLight.shadow.blurSamples = settings.lighting.directional.shadow.blurSamples;
        this.scene.add(directionalLight);
        
        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(
            settings.ground.size,
            settings.ground.size
        );
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: settings.ground.color,
            roughness: settings.ground.roughness,
            metalness: settings.ground.metalness
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = settings.ground.yPosition;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Create dynamic grid instead of static GridHelper
        this.dynamicGrid = new DynamicGrid(settings.grid.size);
        this.scene.add(this.dynamicGrid);
        
        // Keep old gridHelper reference for compatibility
        this.gridHelper = null;
        
        // Add thick glowing main axis lines for X and Z
        const axisLength = settings.grid.axisLines.length;
        const axisThickness = 0.002; // Thinner axis lines (0.2cm)
        const axisHeight = 0.001; // Slightly above ground to avoid z-fighting
        
        // X-axis line (glowing red)
        const xAxisGeometry = new THREE.BoxGeometry(axisLength * 2, axisThickness, axisThickness);
        const xAxisMaterial = new THREE.MeshBasicMaterial({ 
            color: settings.grid.axisLines.xColor,
            opacity: 0,       // Start invisible
            transparent: true,
            depthWrite: false
        });
        const xAxisLine = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
        xAxisLine.position.set(0, axisHeight, 0);
        xAxisLine.renderOrder = 1; // Render on top of ground
        this.scene.add(xAxisLine);
        
        // Add glow effect for X-axis
        const xGlowGeometry = new THREE.BoxGeometry(axisLength * 2, axisThickness * 3, axisThickness * 3);
        const xGlowMaterial = new THREE.MeshBasicMaterial({ 
            color: settings.grid.axisLines.xColor,
            opacity: 0,       // Start invisible
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const xGlow = new THREE.Mesh(xGlowGeometry, xGlowMaterial);
        xGlow.position.set(0, axisHeight, 0);
        xGlow.renderOrder = 0;
        this.scene.add(xGlow);
        
        // Z-axis line (glowing blue)
        const zAxisGeometry = new THREE.BoxGeometry(axisThickness, axisThickness, axisLength * 2);
        const zAxisMaterial = new THREE.MeshBasicMaterial({ 
            color: settings.grid.axisLines.zColor,
            opacity: 0,       // Start invisible
            transparent: true,
            depthWrite: false
        });
        const zAxisLine = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
        zAxisLine.position.set(0, axisHeight, 0);
        zAxisLine.renderOrder = 1;
        this.scene.add(zAxisLine);
        
        // Add glow effect for Z-axis
        const zGlowGeometry = new THREE.BoxGeometry(axisThickness * 3, axisThickness * 3, axisLength * 2);
        const zGlowMaterial = new THREE.MeshBasicMaterial({ 
            color: settings.grid.axisLines.zColor,
            opacity: 0,       // Start invisible
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const zGlow = new THREE.Mesh(zGlowGeometry, zGlowMaterial);
        zGlow.position.set(0, axisHeight, 0);
        zGlow.renderOrder = 0;
        this.scene.add(zGlow);
        
        // Store references for toggling
        this.axisLines = [xAxisLine, xGlow, zAxisLine, zGlow];
        // Store axis references separately for bird's eye fade
        this.xAxisLine = xAxisLine;
        this.xAxisGlow = xGlow;
        this.zAxisLine = zAxisLine;
        this.zAxisGlow = zGlow;
        
        // Setup post-processing
        this.setupPostProcessing();
        
        // Make VoxelRenderer, AssetPreviewScene, and ColorRegistry globally available
        // Colors are now managed by ColorRegistry on demand
        (window as any).VoxelRenderer = VoxelRenderer;
        (window as any).AssetPreviewScene = AssetPreviewScene;
        (window as any).ColorRegistry = ColorRegistry;
        
        // Initialize systems
        // Always use 0.1m voxel size for high detail
        this.voxelEngine = new VoxelEngine(this.scene, settings.ui.showWireframe, settings.voxel.size);
        this.drawingSystem = new DrawingSystem(this.voxelEngine);
        this.performanceMonitor = new PerformanceMonitor();
        this.directionIndicator = new DirectionIndicator();
        this.voxelPanel = new VoxelPanel(this.drawingSystem);
        this.layerPanel = new LayerPanel(this.voxelEngine, () => {
            // Update callback - re-render when layer state changes
            this.voxelEngine?.updateInstances();
        });
        
        // Create tools panel
        this.toolsPanel = new ToolsPanel();
        this.toolsPanel.setDrawingSystem(this.drawingSystem);
        this.toolsPanel.setVoxelEngine(this.voxelEngine);
        
        // Connect asset manager to drawing system
        this.drawingSystem.setAssetManager(this.voxelPanel.getAssetManager());
        
        // Add layer panel to the page
        document.body.appendChild(this.layerPanel.getElement());
        
        // Update tilt-shift button initial state after VoxelPanel creates it
        setTimeout(() => {
            const tiltShiftButton = document.getElementById('tiltshift-toggle-button') as HTMLButtonElement;
            if (tiltShiftButton && !settings.postProcessing.tiltShift.enabled) {
                const tiltShiftIcon = tiltShiftButton.querySelector('span');
                tiltShiftButton.style.background = 'rgba(100, 100, 100, 0.2)';
                tiltShiftButton.style.borderColor = 'transparent';
                if (tiltShiftIcon) tiltShiftIcon.style.color = 'rgba(255, 255, 255, 0.8)';
            }
        }, 0);
        
        // Initialize file manager and connect to panel
        this.fileManager = new FileManager(this.voxelEngine);
        this.voxelPanel.setFileManager(this.fileManager);
        this.voxelPanel.setVoxelEngine(this.voxelEngine);
        this.voxelPanel.setToolsPanel(this.toolsPanel);
        
        // Initialize menu bar
        if (this.voxelEngine && this.drawingSystem && this.fileManager && this.directionIndicator && this.layerPanel) {
            const voxelRenderer = (this.voxelEngine as any).renderer as VoxelRenderer;
            const undoRedoManager = (this.voxelEngine as any).undoRedoManager;
            
            this.menuBar = new MenuBar(
                this.voxelEngine,
                voxelRenderer,
                this.drawingSystem,
                undoRedoManager,
                this.fileManager,
                this.directionIndicator,
                this.layerPanel
            );
        }
        
        // Initialize box selection tool
        if (this.camera) {
            this.boxSelectionTool = new BoxSelectionTool(this.scene, this.voxelEngine, this.camera);
            
            // Set up selection callback for undo/redo
            this.voxelEngine.setSelectionCallback((selection) => {
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.restoreSelection(selection);
                }
            });
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize button states
        this.initializeButtonStates();
        
        // Setup voxel size button handlers
        this.setupBrushSizeButtons();
        
        // Start render loop
        this.animate();
        
        // Add some initial voxels for testing
        // Creating test scene
        ActionLogger.getInstance().log('Initializing scene...', 1000);
        this.createTestScene();
        // Test scene created
        
        // Make test functions available globally
        (window as any).testBaking = testBaking;
        (window as any).visualBakingTest = () => visualBakingTest(this.scene, this.voxelEngine);
        (window as any).debugBaking = debugBaking;
        (window as any).testTopFaces = testTopFaces;
        (window as any).testPlatformFaces = testPlatformFaces;
        (window as any).debugBakedFaces = () => {
            if (this.voxelEngine) debugBakedFaces(this.scene, this.voxelEngine);
        };
        (window as any).clearDebugArrows = () => clearDebugArrows(this.scene);
        (window as any).debugMissingFaces = debugMissingFaces;
        (window as any).testBoundaryFaces = testBoundaryFaces;
        (window as any).verifyGreedyMeshing = verifyGreedyMeshing;
        (window as any).compareBaking = compareBaking;
        (window as any).testSeparatedVoxels = () => {
            if (this.voxelEngine) testSeparatedVoxels(this.scene, this.voxelEngine);
        };
        (window as any).testBoundaryFix = testBoundaryFix;
        (window as any).testAllFaces = testAllFaces;
    }
    
    setupBrushSizeButtons() {
        // Setup toggle button
        const toggleBtn = document.getElementById('brush-size-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.cycleBrushSize());
        }
        
        // Set initial value
        if (this.voxelPanel) {
            this.voxelPanel.updateBrushSize(this.currentBrushSize);
        }
    }
    
    initializeButtonStates() {
        // Initialize edge/wireframe button based on settings
        const edgeButton = document.getElementById('edge-toggle-button') as HTMLButtonElement;
        if (edgeButton && settings.ui.showWireframe) {
            const edgeIcon = edgeButton.querySelector('span');
            edgeButton.style.background = 'rgba(100, 200, 100, 0.3)';
            edgeButton.style.borderColor = 'rgba(100, 200, 100, 0.8)';
            if (edgeIcon) edgeIcon.style.color = 'rgba(100, 255, 100, 1)';
        }
        
        // Initialize tools panel wireframe button
        if (this.toolsPanel && settings.ui.showWireframe) {
            this.toolsPanel.updateWireframeButton(true);
        }
        
    }
    
    setupPostProcessing() {
        if (!settings.postProcessing.enabled || !this.renderer || !this.camera) return;
        
        try {
            // Create effect composer
            this.composer = new EffectComposer(this.renderer);
            
            // Add render pass
            const renderPass = new RenderPass(this.scene, this.camera);
            this.composer.addPass(renderPass);
            
            // Add tilt-shift pass (v006 style)
            this.tiltShiftPass = new TiltShiftPass(
                window.innerWidth,
                window.innerHeight
            );
            
            // Apply settings from config
            this.tiltShiftPass.focusPosition = settings.postProcessing.tiltShift.focusPosition;
            this.tiltShiftPass.focusBandwidth = settings.postProcessing.tiltShift.focusBandwidth;
            this.tiltShiftPass.blurStrength = settings.postProcessing.tiltShift.blurStrength;
            this.tiltShiftPass.gammaCorrection = settings.postProcessing.tiltShift.gammaCorrection;
            this.tiltShiftPass.bladeCount = settings.postProcessing.tiltShift.bladeCount;
            this.tiltShiftPass.enabled = settings.postProcessing.tiltShift.enabled;
            
            this.composer.addPass(this.tiltShiftPass);
            
            // Post-processing initialized with tilt-shift
            ActionLogger.getInstance().log('Tilt-shift enabled', 1500);
        } catch (error) {
            console.warn('Post-processing failed to initialize:', error);
            this.composer = null;
            this.tiltShiftPass = null;
        }
    }
    
    // Getter for voxel engine (for testing purposes)
    getVoxelEngine(): VoxelEngine | null {
        return this.voxelEngine;
    }
    
    private registerInteraction(): void {
        // Reset timers on any interaction
        this.lastInteractionTime = Date.now();
        this.axisIdleFadeTimer = 0;
    }
    
    async loadVersionInfo() {
        try {
            const response = await fetch('/public/version.json');
            const version = await response.json();
            
            const versionElement = document.getElementById('app-version');
            if (versionElement) {
                versionElement.textContent = version.version || '0.0.0';
                versionElement.title = `${version.name || 'Never Ever Land'} - ${version.codename || ''} (${version.build || ''})`;
            }
        } catch (error) {
            console.warn('Failed to load version info:', error);
            const versionElement = document.getElementById('app-version');
            if (versionElement) {
                versionElement.textContent = settings.version || '0.7.0';
            }
        }
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Mouse events
        if (this.renderer) {
            this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
            this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
            this.renderer.domElement.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
            this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // Drag and drop events
            this.renderer.domElement.addEventListener('dragover', (e) => this.onDragOver(e));
            this.renderer.domElement.addEventListener('dragleave', (e) => this.onDragLeave(e));
            this.renderer.domElement.addEventListener('drop', (e) => this.onDrop(e));
        }
        
        // Keyboard events
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Custom events from MenuBar
        window.addEventListener('resetCamera', () => {
            if (this.controls) {
                this.controls.reset();
            }
        });
        
        window.addEventListener('toggleTiltShift', () => {
            if (this.tiltShiftPass) {
                this.tiltShiftPass.enabled = !this.tiltShiftPass.enabled;
            }
        });
        
        // Handle toggle event from tools panel
        window.addEventListener('toggle-tiltshift', () => {
            if (this.tiltShiftPass) {
                this.tiltShiftPass.enabled = !this.tiltShiftPass.enabled;
                // Update tools panel button state
                if (this.toolsPanel) {
                    this.toolsPanel.updateTiltShiftButton(this.tiltShiftPass.enabled);
                }
                // Update voxel panel button if it exists
                const tiltShiftButton = document.getElementById('tiltshift-toggle-button') as HTMLButtonElement;
                if (tiltShiftButton) {
                    const isActive = this.tiltShiftPass.enabled;
                    const icon = tiltShiftButton.querySelector('span');
                    
                    if (isActive) {
                        tiltShiftButton.style.background = 'rgba(100, 200, 100, 0.3)';
                        tiltShiftButton.style.borderColor = 'rgba(100, 200, 100, 0.8)';
                        if (icon) icon.style.color = 'rgba(100, 255, 100, 1)';
                    } else {
                        tiltShiftButton.style.background = 'rgba(100, 100, 100, 0.2)';
                        tiltShiftButton.style.borderColor = 'transparent';
                        if (icon) icon.style.color = 'rgba(255, 255, 255, 0.8)';
                    }
                }
            }
        });
        
        window.addEventListener('toggleGrid', (e: Event) => {
            this.toggleGrid();
        });
        
        // Handle selection mode enable from tools panel
        window.addEventListener('enable-selection-mode', () => {
            this.selectionMode = true;
            if (this.drawingSystem) {
                this.drawingSystem.hidePreview();
                this.drawingSystem.clearConstraintPlane();
                this.drawingSystem.stopDrawing();
            }
        });
        
        // Handle selection mode disable from tools panel
        window.addEventListener('disable-selection-mode', () => {
            if (this.selectionMode) {
                this.selectionMode = false;
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.clearSelection(false); // Don't record undo when switching tools
                }
                if (this.drawingSystem) {
                    this.drawingSystem.showPreview();
                    this.updatePreviewAtCurrentMouse();
                }
            }
        });
    }
    
    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = settings.camera.frustumSize;
        
        if (this.camera) {
            this.camera.left = -frustumSize * aspect / 2;
            this.camera.right = frustumSize * aspect / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();
        }
        
        if (this.renderer) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        // Update composer size
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
        
        // Update tilt-shift size
        if (this.tiltShiftPass) {
            this.tiltShiftPass.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    onMouseMove(event: MouseEvent) {
        // Don't register interaction for simple mouse movement
        // Only register for actual clicks, drags, or other actions
        
        // Store last mouse position for paste location
        this.lastMousePos.x = event.clientX;
        this.lastMousePos.y = event.clientY;
        
        // Get the canvas bounding rect for accurate mouse position
        const rect = this.renderer!.domElement.getBoundingClientRect();
        
        // Calculate normalized device coordinates relative to canvas
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera!);
        
        const hit = this.voxelEngine!.raycast(this.raycaster);
        
        // Handle selection mode
        if (this.selectionMode && this.boxSelectionTool) {
            // Skip selection updates if Alt is held (camera tumbling)
            if (event.altKey) {
                return;
            }
            
            if (this.boxSelectionTool.isDoingScreenSpaceSelection()) {
                // Update screen space selection box
                this.boxSelectionTool.updateScreenSpaceSelection(event.clientX, event.clientY);
            } else if (this.boxSelectionTool.isInSelectionMode() && hit) {
                // Update selection box while dragging (old 3D selection - kept for compatibility)
                this.boxSelectionTool.updateSelection(hit.point);
            } else if (event.buttons === 1) {
                // Handle gizmo dragging
                this.boxSelectionTool.handleGizmoDrag(this.raycaster);
            } else if (event.buttons === 0 && this.boxSelectionTool.hasSelection()) {
                // Update gizmo hover when not dragging
                const gizmo = this.boxSelectionTool.getTransformGizmo();
                gizmo.onMouseHover(this.raycaster);
            }
            return;
        }
        
        // Handle fill tool selection
        if (this.drawingSystem && this.drawingSystem.isDoingFillSelection()) {
            this.drawingSystem.updateFillSelection(event.clientX, event.clientY);
            return;
        }
        
        // Calculate constrained position if we're actively drawing
        let constrainedPos = null;
        
        // Check if we should calculate constraints for dragging
        // This should work for brush, eraser, or when doing remove with right-click
        if (this.drawingSystem!.isDrawing && this.drawingSystem!.drawingSurface &&
            (this.drawingSystem!.toolMode === 'brush' || 
             this.drawingSystem!.toolMode === 'eraser' ||
             this.drawingSystem!.drawMode === 'remove')) {
            
            const voxelSize = this.voxelEngine!.getVoxelSize();
            const normal = this.drawingSystem!.drawingSurface.normal;
            const basePos = this.drawingSystem!.drawingSurface.basePos;
            const absX = Math.abs(normal.x);
            const absY = Math.abs(normal.y);
            const absZ = Math.abs(normal.z);
            
            // Project the ray to get mouse position in world space
            // We need to find where the ray intersects the constraint plane
            let planePoint: THREE.Vector3;
            const plane = new THREE.Plane();
            
            // Create a plane at the constraint position based on the surface normal
            // The key insight: for both add and remove modes, we want the plane at the FACE
            // where we clicked, not at the voxel center. This keeps the plane stable.
            const isRemoveMode = this.drawingSystem!.drawMode === 'remove';
            
            // Update the visual constraint plane if it exists
            if (this.drawingSystem!.constraintPlane) {
                // We'll update its position after calculating the plane
            }
            
            if (absY > absX && absY > absZ) {
                // Horizontal plane - constrain Y
                // For remove: if clicking top face (normal.y > 0), plane is at top of voxel
                // For add: plane is at the adjacent position (already handled by basePos)
                let yPos;
                if (isRemoveMode) {
                    // Place plane at the face we clicked (top or bottom of voxel)
                    if (normal.y > 0) {
                        // Clicked top face - plane at top of voxel
                        yPos = (basePos.y + 1) * voxelSize;
                    } else {
                        // Clicked bottom face - plane at bottom of voxel
                        yPos = basePos.y * voxelSize;
                    }
                } else {
                    // Add mode - plane at adjacent position
                    yPos = basePos.y * voxelSize + voxelSize * 0.5;
                }
                planePoint = new THREE.Vector3(0, yPos, 0);
                plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), planePoint);
            } else if (absX > absY && absX > absZ) {
                // Vertical X plane - constrain X
                let xPos;
                if (isRemoveMode) {
                    // Place plane at the face we clicked
                    if (normal.x > 0) {
                        xPos = (basePos.x + 1) * voxelSize;
                    } else {
                        xPos = basePos.x * voxelSize;
                    }
                } else {
                    xPos = basePos.x * voxelSize + voxelSize * 0.5;
                }
                planePoint = new THREE.Vector3(xPos, 0, 0);
                plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), planePoint);
            } else {
                // Vertical Z plane - constrain Z
                let zPos;
                if (isRemoveMode) {
                    // Place plane at the face we clicked
                    if (normal.z > 0) {
                        zPos = (basePos.z + 1) * voxelSize;
                    } else {
                        zPos = basePos.z * voxelSize;
                    }
                } else {
                    zPos = basePos.z * voxelSize + voxelSize * 0.5;
                }
                planePoint = new THREE.Vector3(0, 0, zPos);
                plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), planePoint);
            }
            
            // Find ray-plane intersection
            const intersection = new THREE.Vector3();
            const intersectionResult = this.raycaster.ray.intersectPlane(plane, intersection);
            
            if (intersectionResult) {
                // Convert intersection to voxel coordinates
                const voxelX = Math.floor(intersection.x / voxelSize);
                const voxelY = Math.floor(intersection.y / voxelSize);
                const voxelZ = Math.floor(intersection.z / voxelSize);
                
                // Apply constraint based on plane orientation
                if (absY > absX && absY > absZ) {
                    // Horizontal plane - use intersection X/Z, constrained Y
                    constrainedPos = {
                        x: voxelX,
                        y: basePos.y,
                        z: voxelZ
                    };
                } else if (absX > absY && absX > absZ) {
                    // Vertical X plane - constrained X, use intersection Y/Z
                    constrainedPos = {
                        x: basePos.x,
                        y: voxelY,
                        z: voxelZ
                    };
                } else {
                    // Vertical Z plane - use intersection X/Y, constrained Z
                    constrainedPos = {
                        x: voxelX,
                        y: voxelY,
                        z: basePos.z
                    };
                }
            } else {
                // Fallback: if plane intersection fails, use the base position
                // This can happen when ray is parallel to the plane
                console.log('Plane intersection failed, using base position');
                constrainedPos = basePos;
            }
        }
        
        // Update preview with constrained position during drawing
        // But don't constrain if we're in box tool height adjustment mode
        const isBoxHeightMode = this.drawingSystem!.toolMode === 'box' && 
                               (this.drawingSystem as any).boxState === 'height';
        
        // Skip preview updates during camera rotation
        if (!this.isRotating) {
            if (isBoxHeightMode) {
                // For box height adjustment, use unconstrained position
                // Pass raycaster to help calculate Y position
                this.drawingSystem!.updatePreview(hit);
                // Also need to pass raycaster for height calculation
                if (hit) {
                    (this.drawingSystem as any).updateToolPreview(hit, this.raycaster);
                }
            } else {
                // For other tools/modes, use constrained position
                this.drawingSystem!.updatePreview(hit, constrainedPos || undefined);
            }
        }
        
        // Continue drawing if mouse is held down
        // event.buttons: 1 = left, 2 = right, 4 = middle
        // This should work for brush, eraser, or when doing remove with right-click
        if (event.buttons && this.drawingSystem!.isDrawing && 
            (this.drawingSystem!.toolMode === 'brush' || 
             this.drawingSystem!.toolMode === 'eraser' ||
             this.drawingSystem!.drawMode === 'remove')) {
            
            // Check if we should continue based on button
            // For dragging, we just check if we're in drawing mode regardless of button
            // The mode (add/remove) was already set in onMouseDown
            if (constrainedPos) {
                // Apply brush at the constrained position
                // The VoxelEngine will handle whether a voxel exists there or not
                this.drawingSystem!.applyBrush(constrainedPos.x, constrainedPos.y, constrainedPos.z);
                this.voxelEngine!.updateInstances();
            } else if (hit) {
                // Fallback if no drawing surface (shouldn't happen normally)
                console.warn('Fallback to hit position - constraint failed!');
                const pos = this.drawingSystem!.drawMode === 'add' ? hit.adjacentPos : hit.voxelPos;
                this.drawingSystem!.applyBrush(pos.x, pos.y, pos.z);
                this.voxelEngine!.updateInstances();
            } else {
                // No constraint and no hit - can't continue drawing
                console.warn('No constraint position and no hit - drawing interrupted');
            }
        }
    }
    
    onMouseDown(event: MouseEvent) {
        // Don't register interaction for simple clicks
        
        // Track middle mouse button
        if (event.button === 1) {
            this.isMiddleMouseDragging = true;
        }
        
        // Track if we're starting a rotation
        // Left or right button with alt key, or right button in color palette/asset mode
        if ((event.button === 0 && event.altKey) || 
            (event.button === 2 && (this.voxelPanel?.isColorPaletteSelected() || 
                                   this.drawingSystem?.selectedAsset !== null))) {
            this.isRotating = true;
            // Hide the drawing preview while rotating
            if (this.drawingSystem) {
                this.drawingSystem.hidePreview();
            }
        }
        
        // Handle selection mode
        if (this.selectionMode && this.boxSelectionTool) {
            // If Alt is held, let orbit controls handle camera tumbling
            if (event.altKey) {
                // Don't interfere with camera controls
                return;
            }
            
            if (event.button === 0) {
                // Try gizmo interaction first (pass shift key for duplication)
                if (this.boxSelectionTool.handleGizmoMouseDown(this.raycaster, event.shiftKey)) {
                    // Disable orbit controls during transformation
                    if (this.controls) this.controls.enabled = false;
                } else {
                    // Try single or contiguous selection first
                    const hit = this.voxelEngine!.raycast(this.raycaster);
                    if (hit) {
                        // Check if clicking on a voxel (not empty space)
                        // Pass voxelPos for single/double click selection
                        if (!this.boxSelectionTool.handleClick(hit.voxelPos, event.shiftKey)) {
                            // No voxel clicked, start screen space selection
                            this.boxSelectionTool.startScreenSpaceSelection(event.clientX, event.clientY);
                            // Disable orbit controls during selection
                            if (this.controls) this.controls.enabled = false;
                        } else {
                            // Single or contiguous selection handled
                            // Keep controls enabled for now
                        }
                    } else {
                        // No hit - clicked on empty space
                        // Start screen space selection from mouse position
                        this.boxSelectionTool.startScreenSpaceSelection(event.clientX, event.clientY);
                        // Disable orbit controls during selection
                        if (this.controls) this.controls.enabled = false;
                    }
                }
            }
            return;
        }
        
        // Left click - add or remove based on tool (unless Alt is held for rotation)
        if (event.button === 0 && !event.altKey) {
            if (this.voxelEngine && this.drawingSystem) {
                // Handle fill tool with 2D selection
                if (this.drawingSystem.toolMode === 'fill') {
                    // Check for double click
                    const now = Date.now();
                    const lastClickTime = (this.drawingSystem as any).lastFillClickTime || 0;
                    const lastClickPos = (this.drawingSystem as any).lastFillClickPos || { x: 0, y: 0 };
                    const timeSinceLastClick = now - lastClickTime;
                    
                    // Check if it's a double click (within 300ms and at roughly the same position)
                    const dx = Math.abs(event.clientX - lastClickPos.x);
                    const dy = Math.abs(event.clientY - lastClickPos.y);
                    const isDoubleClick = timeSinceLastClick < 300 && dx < 5 && dy < 5;
                    
                    if (isDoubleClick) {
                        // Perform flood fill
                        const hit = this.voxelEngine.raycast(this.raycaster);
                        if (hit && hit.voxelPos) {
                            console.log('Double click detected - performing flood fill');
                            this.drawingSystem.applyFillTool(hit.voxelPos);
                        }
                        // Reset click time to prevent triple clicks
                        (this.drawingSystem as any).lastFillClickTime = 0;
                        (this.drawingSystem as any).lastFillClickPos = null;
                        (this.drawingSystem as any).isDoubleClickProcessed = true;
                        // Don't start selection
                        return;
                    } else {
                        // Store current click for next double-click detection
                        (this.drawingSystem as any).lastFillClickTime = now;
                        (this.drawingSystem as any).lastFillClickPos = { x: event.clientX, y: event.clientY };
                        
                        // Start 2D selection for fill tool
                        this.drawingSystem.startFillSelection(event.clientX, event.clientY);
                        // Store the click position to detect single clicks
                        (this.drawingSystem as any).fillClickStart = { x: event.clientX, y: event.clientY };
                        if (this.controls) this.controls.enabled = false;
                    }
                } else if (this.drawingSystem.toolMode === 'box' || this.drawingSystem.toolMode === 'line') {
                    // Box and Line tools handle their own clicks
                    const hit = this.voxelEngine.raycast(this.raycaster);
                    if (hit) {
                        const mode = this.drawingSystem.toolMode === 'eraser' ? 'remove' : 'add';
                        this.drawingSystem.startDrawing(hit, mode, event.shiftKey);
                        // Disable controls during box/line tool usage to prevent accidental tumbling
                        if (this.controls) this.controls.enabled = false;
                    }
                } else {
                    const hit = this.voxelEngine.raycast(this.raycaster);
                    // Left click hit detected
                    if (hit) {
                        // Check if eraser tool is selected
                        const mode = this.drawingSystem.toolMode === 'eraser' ? 'remove' : 'add';
                        // Starting drawing operation
                        this.drawingSystem.startDrawing(hit, mode, event.shiftKey);
                        // Disable orbit controls to prevent rotation while drawing
                        if (this.controls) this.controls.enabled = false;
                    }
                }
            }
        } 
        // Right click - remove voxels (unless Alt is held, in color palette mode, or asset is selected)
        else if (event.button === 2 && !event.altKey) {
            // Check if we're in color palette mode or have an asset selected
            const isAssetMode = this.drawingSystem && this.drawingSystem.selectedAsset !== null;
            const isColorPaletteMode = this.voxelPanel && this.voxelPanel.isColorPaletteSelected();
            
            if (isColorPaletteMode || isAssetMode) {
                // In color palette mode or asset mode, right-click enables tumble
                if (this.controls) this.controls.enabled = true;
            } else {
                // In other modes, right-click removes voxels or cancels box tool
                if (this.voxelEngine && this.drawingSystem) {
                    // Cancel box tool if in progress
                    if (this.drawingSystem.toolMode === 'box' && 
                        (this.drawingSystem as any).boxState !== 'idle') {
                        this.drawingSystem.cancelBoxTool();
                        // Re-enable controls after cancelling box tool
                        if (this.controls) this.controls.enabled = true;
                    } else {
                        // Otherwise, remove voxels
                        const hit = this.voxelEngine.raycast(this.raycaster);
                        if (hit) {
                            this.drawingSystem.startDrawing(hit, 'remove', event.shiftKey);
                            // Disable orbit controls to prevent rotation while drawing
                            if (this.controls) this.controls.enabled = false;
                        }
                    }
                }
            }
        }
        // Alt + Left click or just Right click enables rotation
        else if ((event.button === 0 && event.altKey) || (event.button === 2 && event.altKey)) {
            if (this.controls) this.controls.enabled = true;
        }
    }
    
    onMouseUp(event: MouseEvent) {
        // Don't register interaction for simple mouse up
        
        // Stop tracking middle mouse button
        if (event.button === 1) {
            this.isMiddleMouseDragging = false;
        }
        
        // Stop tracking rotation
        this.isRotating = false;
        // Show the drawing preview again after rotation
        if (this.drawingSystem && !this.selectionMode) {
            this.drawingSystem.showPreview();
        }
        
        // Handle selection mode
        if (this.selectionMode && this.boxSelectionTool) {
            if (this.boxSelectionTool.isDoingScreenSpaceSelection()) {
                this.boxSelectionTool.endScreenSpaceSelection(event.shiftKey);
            } else if (this.boxSelectionTool.isInSelectionMode()) {
                this.boxSelectionTool.endSelection();
            }
            // End gizmo drag if active
            this.boxSelectionTool.handleGizmoMouseUp();
            // Re-enable controls
            if (this.controls) this.controls.enabled = true;
            return;
        }
        
        if (this.drawingSystem) {
            // Handle fill tool selection end
            if (this.drawingSystem.isDoingFillSelection() && this.camera && this.scene) {
                // Check if this was a single click (no drag)
                const fillClickStart = (this.drawingSystem as any).fillClickStart;
                const isDoubleClickProcessed = (this.drawingSystem as any).isDoubleClickProcessed;
                
                // Skip if we just processed a double click
                if (isDoubleClickProcessed) {
                    (this.drawingSystem as any).isDoubleClickProcessed = false;
                    this.drawingSystem.endFillSelection(this.camera, this.scene);
                } else if (fillClickStart) {
                    const dx = Math.abs(event.clientX - fillClickStart.x);
                    const dy = Math.abs(event.clientY - fillClickStart.y);
                    
                    // If the mouse didn't move much, treat it as a single click
                    if (dx < 5 && dy < 5) {
                        // Cancel the fill selection
                        this.drawingSystem.endFillSelection(this.camera, this.scene);
                        
                        // Perform single voxel fill
                        const hit = this.voxelEngine.raycast(this.raycaster);
                        if (hit && hit.voxelPos) {
                            // Fill the voxel we're hovering over, not the adjacent position
                            const pos = hit.voxelPos;
                            this.drawingSystem.fillSingleVoxel(pos.x, pos.y, pos.z);
                        }
                    } else {
                        // Normal fill selection
                        this.drawingSystem.endFillSelection(this.camera, this.scene);
                    }
                    
                    // Clear the click start position
                    (this.drawingSystem as any).fillClickStart = null;
                }
            } else {
                this.drawingSystem.stopDrawing();
            }
        }
        // Re-enable controls after drawing
        if (this.controls) this.controls.enabled = true;
    }
    
    onWheel(event: WheelEvent) {
        // Don't register interaction for zoom - only for tumbling
        
        // If we're drawing and controls are disabled, handle zoom manually
        if (this.drawingSystem?.isDrawing && this.controls && !this.controls.enabled) {
            event.preventDefault();
            
            // Apply zoom with same logic as OrbitControls
            const delta = event.deltaY;
            const zoomSpeed = 0.95;
            
            if (this.camera) {
                if (delta > 0) {
                    // Zoom out
                    this.camera.zoom *= zoomSpeed;
                } else {
                    // Zoom in
                    this.camera.zoom /= zoomSpeed;
                }
                
                // Clamp zoom to min/max values from settings
                this.camera.zoom = Math.max(settings.controls.minZoom, 
                    Math.min(settings.controls.maxZoom, this.camera.zoom));
                
                this.camera.updateProjectionMatrix();
                
                // Update dynamic grid if it exists
                if (this.dynamicGrid) {
                    this.dynamicGrid.update(this.camera.zoom, this.camera, 1.0); // Full opacity during zoom
                }
            }
        }
        // Otherwise, let OrbitControls handle it normally
    }
    
    onKeyDown(event: KeyboardEvent) {
        this.registerInteraction();
        
        // Check for Ctrl+Z (undo) and Ctrl+Y (redo)
        if (event.ctrlKey || event.metaKey) {
            if (event.key === 'z' || event.key === 'Z') {
                event.preventDefault();
                if (this.voxelEngine) {
                    // Finalize any pending operations first
                    this.voxelEngine.finalizePendingOperations();
                    if (this.voxelEngine.undo()) {
                        console.log('Undo performed');
                    }
                }
            } else if (event.key === 'y' || event.key === 'Y') {
                event.preventDefault();
                if (this.voxelEngine && this.voxelEngine.redo()) {
                    console.log('Redo performed');
                }
            } else if (event.key === 'a' || event.key === 'A') {
                // Select All
                event.preventDefault();
                if (this.selectionMode && this.boxSelectionTool) {
                    this.boxSelectionTool.selectAll();
                }
            } else if (event.key === 'i' || event.key === 'I') {
                // Invert Selection
                event.preventDefault();
                if (this.selectionMode && this.boxSelectionTool) {
                    this.boxSelectionTool.invertSelection();
                }
            } else if (event.key === 'c' || event.key === 'C') {
                // Copy Selection
                event.preventDefault();
                if (this.selectionMode && this.boxSelectionTool) {
                    this.boxSelectionTool.copySelection();
                }
            } else if (event.key === 'x' || event.key === 'X') {
                // Cut Selection
                event.preventDefault();
                if (this.selectionMode && this.boxSelectionTool) {
                    this.boxSelectionTool.cutSelection();
                }
            } else if (event.key === 'v' || event.key === 'V') {
                // Paste Selection in selection mode, or activate voxel brush
                event.preventDefault();
                if (this.selectionMode && this.boxSelectionTool) {
                    // Get mouse world position for paste location
                    const mouse = new THREE.Vector2(
                        (this.lastMousePos.x / window.innerWidth) * 2 - 1,
                        -(this.lastMousePos.y / window.innerHeight) * 2 + 1
                    );
                    const raycaster = new THREE.Raycaster();
                    if (this.camera) {
                        raycaster.setFromCamera(mouse, this.camera);
                        
                        // Cast ray to ground plane
                        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                        const intersection = new THREE.Vector3();
                        raycaster.ray.intersectPlane(groundPlane, intersection);
                        
                        // Paste at intersection or without position
                        if (intersection.x !== 0 || intersection.z !== 0) {
                            this.boxSelectionTool.pasteSelection(intersection);
                        } else {
                            this.boxSelectionTool.pasteSelection();
                        }
                    }
                }
            }
            return;
        }
        
        switch(event.key) {
            case 'v':
            case 'V':
                // Activate color palette button
                const colorPaletteButton = document.getElementById('color-palette-button');
                if (colorPaletteButton) {
                    colorPaletteButton.click();
                }
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                if (this.drawingSystem) {
                    this.drawingSystem.setBrushSize(parseInt(event.key));
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateBrushSize(parseInt(event.key));
                }
                break;
            case 'q':
            case 'Q':
                // Rotate selection around Y axis (counter-clockwise)
                if (this.selectionMode && this.boxSelectionTool && this.boxSelectionTool.hasSelection()) {
                    this.boxSelectionTool.rotateSelection('y', -Math.PI / 2); // -90 degrees
                }
                break;
            case 'g':
            case 'G':
                this.toggleGrid();
                break;
            case 'f':
            case 'F':
                // Focus camera on selection or scene contents (like Blender/Houdini)
                this.focusCameraOnTarget();
                break;
            case 't':
            case 'T':
                // Toggle tilt-shift effect
                if (this.tiltShiftPass) {
                    this.tiltShiftPass.enabled = !this.tiltShiftPass.enabled;
                    console.log('Tilt-shift:', this.tiltShiftPass.enabled ? 'ON' : 'OFF');
                    
                    // Update button state
                    const tiltShiftButton = document.getElementById('tiltshift-toggle-button') as HTMLButtonElement;
                    if (tiltShiftButton) {
                        const isActive = this.tiltShiftPass.enabled;
                        const tiltShiftIcon = tiltShiftButton.querySelector('span');
                        
                        if (isActive) {
                            tiltShiftButton.style.background = 'rgba(100, 200, 100, 0.3)';
                            tiltShiftButton.style.borderColor = 'rgba(100, 200, 100, 0.8)';
                            if (tiltShiftIcon) tiltShiftIcon.style.color = 'rgba(100, 255, 100, 1)';
                        } else {
                            tiltShiftButton.style.background = 'rgba(100, 100, 100, 0.2)';
                            tiltShiftButton.style.borderColor = 'transparent';
                            if (tiltShiftIcon) tiltShiftIcon.style.color = 'rgba(255, 255, 255, 0.8)';
                        }
                    }
                }
                break;
            case 'b':
            case 'B':
                // Exit selection mode when switching tools
                this.selectionMode = false;
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.clearSelection(false); // Don't record undo when switching tools
                }
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('brush');
                    this.drawingSystem.showPreview();
                    this.updatePreviewAtCurrentMouse();
                    // Re-enable controls when switching tools
                    if (this.controls) this.controls.enabled = true;
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('brush');
                }
                if (this.toolsPanel) {
                    this.toolsPanel.selectTool('brush');
                }
                break;
            case 'e':
            case 'E':
                // Check if Shift is held for rotation
                if (event.shiftKey) {
                    // Rotate selection around Y axis (clockwise)
                    if (this.selectionMode && this.boxSelectionTool && this.boxSelectionTool.hasSelection()) {
                        this.boxSelectionTool.rotateSelection('y', Math.PI / 2); // 90 degrees
                    }
                } else {
                    // Exit selection mode when switching tools
                    this.selectionMode = false;
                    if (this.boxSelectionTool) {
                        this.boxSelectionTool.clearSelection(false); // Don't record undo when switching tools
                    }
                    if (this.drawingSystem) {
                        this.drawingSystem.setToolMode('eraser');
                        this.drawingSystem.showPreview();
                        this.updatePreviewAtCurrentMouse();
                        // Re-enable controls when switching tools
                        if (this.controls) this.controls.enabled = true;
                    }
                    if (this.voxelPanel) {
                        this.voxelPanel.updateToolMode('eraser');
                    }
                    if (this.toolsPanel) {
                        this.toolsPanel.selectTool('eraser');
                    }
                }
                break;
            case 'x':
            case 'X':
                // Exit selection mode when switching tools
                this.selectionMode = false;
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.clearSelection(false); // Don't record undo when switching tools
                }
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('box');
                    // Don't show single voxel preview for box tool
                    this.updatePreviewAtCurrentMouse();
                    // Re-enable controls when switching tools
                    if (this.controls) this.controls.enabled = true;
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('box');
                }
                if (this.toolsPanel) {
                    this.toolsPanel.selectTool('box');
                }
                break;
            case 'l':
            case 'L':
                // Exit selection mode when switching tools
                this.selectionMode = false;
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.clearSelection(false); // Don't record undo when switching tools
                }
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('line');
                    // Don't show single voxel preview for line tool
                    this.updatePreviewAtCurrentMouse();
                    // Re-enable controls when switching tools
                    if (this.controls) this.controls.enabled = true;
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('line');
                }
                if (this.toolsPanel) {
                    this.toolsPanel.selectTool('line');
                }
                break;
            case 'p':
            case 'P':
                // Exit selection mode when switching tools
                this.selectionMode = false;
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.clearSelection(false); // Don't record undo when switching tools
                }
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('fill');
                    // Don't show single voxel preview for fill tool
                    this.updatePreviewAtCurrentMouse();
                    // Re-enable controls when switching tools
                    if (this.controls) this.controls.enabled = true;
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('fill');
                }
                if (this.toolsPanel) {
                    this.toolsPanel.selectTool('fill');
                }
                break;
            case 'w':
            case 'W':
                // Toggle wireframe/edges
                if (this.voxelEngine) {
                    this.voxelEngine.toggleEdges();
                    const edgeButton = document.getElementById('edge-toggle-button') as HTMLButtonElement;
                    if (edgeButton) {
                        const isActive = this.voxelEngine.getShowEdges();
                        const edgeIcon = edgeButton.querySelector('span');
                        
                        if (isActive) {
                            edgeButton.style.background = 'rgba(100, 200, 100, 0.3)';
                            edgeButton.style.borderColor = 'rgba(100, 200, 100, 0.8)';
                            if (edgeIcon) edgeIcon.style.color = 'rgba(100, 255, 100, 1)';
                        } else {
                            edgeButton.style.background = 'rgba(100, 100, 100, 0.2)';
                            edgeButton.style.borderColor = 'transparent';
                            if (edgeIcon) edgeIcon.style.color = 'rgba(255, 255, 255, 0.8)';
                        }
                    }
                    // Update tools panel wireframe button
                    if (this.toolsPanel) {
                        this.toolsPanel.updateWireframeButton(this.voxelEngine.getShowEdges());
                    }
                    console.log('Wireframe:', this.voxelEngine.getShowEdges() ? 'ON' : 'OFF');
                }
                break;
            case 's':
            case 'S':
                // Activate selection tool
                if (!event.ctrlKey && !event.metaKey) {
                    if (this.toolsPanel) {
                        this.toolsPanel.selectTool('selection');
                    }
                    
                    console.log('Selection mode:', this.selectionMode ? 'ON' : 'OFF');
                    
                    // Update tools panel
                    if (this.toolsPanel && this.selectionMode) {
                        this.toolsPanel.selectTool('selection');
                    }
                }
                break;
            case 'Delete':
            case 'Backspace':
                // Delete selected voxels
                if (this.selectionMode && this.boxSelectionTool && this.boxSelectionTool.hasSelection()) {
                    this.boxSelectionTool.deleteSelectedVoxels();
                    console.log('Deleted selected voxels');
                }
                break;
            case '[':
                // Cycle brush size backward
                this.cycleBrushSizeReverse();
                break;
            case ']':
                // Cycle brush size forward
                this.cycleBrushSize();
                break;
            case 'Escape':
                // Cancel selection or transformation
                if (this.boxSelectionTool) {
                    if (this.boxSelectionTool.getTransformMode()) {
                        this.boxSelectionTool.cancelTransform();
                        console.log('Transformation cancelled');
                    } else if (this.boxSelectionTool.hasSelection()) {
                        this.boxSelectionTool.clearSelection(false); // Don't record undo when switching tools
                        console.log('Selection cleared');
                    }
                }
                // Also clear asset selection
                if (this.drawingSystem && this.drawingSystem.selectedAsset) {
                    this.drawingSystem.setSelectedAsset(null);
                    // Don't change tool mode - preserve current tool
                    console.log('Asset selection cleared');
                }
                break;
            case 'r':
            case 'R':
                // Rotate asset
                if (this.drawingSystem && this.drawingSystem.selectedAsset) {
                    this.drawingSystem.rotateAsset();
                }
                break;
        }
    }
    
    onDragOver(event: DragEvent): void {
        // Prevent default to allow drop
        event.preventDefault();
        
        // Check if the dragged item is a file
        if (event.dataTransfer?.types.includes('Files')) {
            event.dataTransfer.dropEffect = 'copy';
            
            // Add visual feedback
            const container = document.getElementById('container');
            if (container && !container.classList.contains('drag-over')) {
                container.classList.add('drag-over');
            }
        }
    }
    
    onDragLeave(event: DragEvent): void {
        // Remove visual feedback when leaving the drop zone
        const container = document.getElementById('container');
        if (container) {
            container.classList.remove('drag-over');
        }
    }
    
    onDrop(event: DragEvent): void {
        // Prevent default browser handling
        event.preventDefault();
        
        // Remove visual feedback
        const container = document.getElementById('container');
        if (container) {
            container.classList.remove('drag-over');
        }
        
        // Check if files were dropped
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return;
        
        // Process each dropped file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if it's a VOX file
            if (file.name.toLowerCase().endsWith('.vox')) {
                // Create a new layer for this VOX file
                const layer = this.voxelEngine?.createLayer(file.name.replace('.vox', ''));
                
                if (layer && this.fileManager) {
                    // Set the new layer as active
                    this.voxelEngine?.setActiveLayer(layer.id);
                    
                    // Import the VOX file into the new layer
                    this.fileManager.importToLayer(file, layer.id).then(() => {
                        console.log(`Imported ${file.name} into new layer "${layer.name}"`);
                        
                        // Refresh the layer panel to show the new layer
                        this.layerPanel?.refresh();
                        
                        // Update the preview for the new layer
                        const layerElement = document.querySelector(`[data-layer-id="${layer.id}"] .layer-preview`) as HTMLCanvasElement;
                        if (layerElement && this.layerPanel) {
                            // Trigger preview update (requires access to the private method, so we'll call refresh instead)
                            this.layerPanel.refresh();
                        }
                    }).catch((error) => {
                        console.error(`Failed to import ${file.name}:`, error);
                        // Remove the layer if import failed
                        this.voxelEngine?.deleteLayer(layer.id);
                        this.layerPanel?.refresh();
                    });
                }
            } else {
                console.warn(`Skipping non-VOX file: ${file.name}`);
            }
        }
    }
    
    focusCameraOnTarget(): void {
        if (!this.camera || !this.controls) return;
        
        let bounds: { min: THREE.Vector3; max: THREE.Vector3 } | null = null;
        
        // First check if we have a selection to focus on
        const selection = this.selectionMode && this.boxSelectionTool && this.boxSelectionTool.hasSelection() 
            ? this.boxSelectionTool.getSelection() 
            : [];
        const hasSelection = selection.length > 0;
        
        if (hasSelection) {
            // Calculate bounds of selection
            const voxelSize = this.voxelEngine?.getVoxelSize() || 0.1;
            const min = new THREE.Vector3(Infinity, Infinity, Infinity);
            const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
            
            for (const voxel of selection) {
                const worldPos = new THREE.Vector3(
                    voxel.x * voxelSize,
                    voxel.y * voxelSize,
                    voxel.z * voxelSize
                );
                min.min(worldPos);
                max.max(worldPos);
            }
            
            // Add voxel size to max to account for voxel dimensions
            max.add(new THREE.Vector3(voxelSize, voxelSize, voxelSize));
            bounds = { min, max };
        }
        
        // If no selection, focus on all voxels in the scene
        if (!hasSelection && this.voxelEngine) {
            const voxelBounds = this.voxelEngine.getBounds();
            const voxelSize = this.voxelEngine.getVoxelSize();
            
            if (voxelBounds.min.x !== Infinity) {
                // Convert voxel bounds to world coordinates
                bounds = {
                    min: new THREE.Vector3(
                        voxelBounds.min.x * voxelSize,
                        voxelBounds.min.y * voxelSize,
                        voxelBounds.min.z * voxelSize
                    ),
                    max: new THREE.Vector3(
                        (voxelBounds.max.x + 1) * voxelSize,
                        (voxelBounds.max.y + 1) * voxelSize,
                        (voxelBounds.max.z + 1) * voxelSize
                    )
                };
            } else {
                // No voxels in scene, focus on origin area
                bounds = {
                    min: new THREE.Vector3(-5, 0, -5),
                    max: new THREE.Vector3(5, 5, 5)
                };
            }
        }
        
        if (!bounds) return;
        
        // Calculate center and size of bounding box
        const center = new THREE.Vector3();
        center.addVectors(bounds.min, bounds.max).multiplyScalar(0.5);
        
        const size = new THREE.Vector3();
        size.subVectors(bounds.max, bounds.min);
        
        // Calculate the distance needed to fit the bounds in view
        const maxDim = Math.max(size.x, size.y, size.z);
        const fitDistance = maxDim * 2.5; // Adjust multiplier for better framing
        
        // Calculate new camera position maintaining CURRENT viewing angle
        // Get current camera direction relative to current target
        const currentDirection = new THREE.Vector3();
        currentDirection.subVectors(this.camera.position, this.controls.target).normalize();
        
        // Use current direction to position camera at the right distance from new center
        const newCameraPos = center.clone().add(currentDirection.multiplyScalar(fitDistance));
        
        // Check if we need to move at all (already focused on target)
        const currentTargetDist = this.controls.target.distanceTo(center);
        const currentCameraDist = this.camera.position.distanceTo(center);
        
        // Calculate appropriate zoom to fit the bounds
        const frustumSize = settings.camera.frustumSize;
        const aspect = window.innerWidth / window.innerHeight;
        
        // Calculate zoom based on current view direction to properly frame the bounds
        // Consider both horizontal and vertical fit
        const horizontalFit = (frustumSize * aspect) / (size.x + size.z * 0.5);
        const verticalFit = frustumSize / (size.y + size.z * 0.5);
        
        const targetZoom = Math.min(
            horizontalFit,
            verticalFit,
            4.0 // Max zoom
        ) * 0.8; // Scale down slightly for padding
        
        // If we're already close to the target, just adjust zoom
        if (currentTargetDist < maxDim * 0.1 && Math.abs(currentCameraDist - fitDistance) < maxDim * 0.5) {
            // Just animate zoom
            const startZoom = this.camera.zoom;
            const duration = 300;
            const startTime = Date.now();
            
            const animateZoom = () => {
                const elapsed = Date.now() - startTime;
                const t = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                
                if (this.camera) {
                    this.camera.zoom = startZoom + (targetZoom - startZoom) * eased;
                    this.camera.updateProjectionMatrix();
                }
                
                if (t < 1) {
                    requestAnimationFrame(animateZoom);
                } else {
                    console.log(hasSelection ? 
                        `Focused on ${selection.length} selected voxels (zoom only)` : 
                        `Focused on scene (${this.voxelEngine?.getVoxelCount() || 0} voxels, zoom only)`);
                }
            };
            
            animateZoom();
            return;
        }
        
        // Smoothly animate camera to new position
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startZoom = this.camera.zoom;
        
        // Animate over 500ms
        const duration = 500;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            
            // Use easing function for smooth animation
            const eased = 1 - Math.pow(1 - t, 3); // Cubic ease-out
            
            // Interpolate camera position
            if (this.camera) {
                this.camera.position.lerpVectors(startPos, newCameraPos, eased);
            }
            
            // Interpolate control target
            if (this.controls) {
                this.controls.target.lerpVectors(startTarget, center, eased);
            }
            
            // Interpolate zoom
            if (this.camera) {
                this.camera.zoom = startZoom + (targetZoom - startZoom) * eased;
                this.camera.updateProjectionMatrix();
            }
            
            // Update controls
            if (this.controls) {
                this.controls.update();
            }
            
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log(hasSelection ? 
                    `Focused on ${selection.length} selected voxels` : 
                    `Focused on scene (${this.voxelEngine?.getVoxelCount() || 0} voxels)`);
            }
        };
        
        animate();
    }
    
    createTestScene() {
        if (!this.voxelEngine) {
            console.error('VoxelEngine not initialized!');
            return;
        }
        
        if (!settings.testScene.enabled) {
            this.voxelEngine.updateInstances();
            return;
        }
        
        switch (settings.testScene.mode) {
            case 'empty':
                // Start with empty scene
                break;
                
            case 'flat':
                // Simple flat ground with water and snow features
                const sizeX = settings.testScene.flatGround.sizeX;
                const sizeZ = settings.testScene.flatGround.sizeZ;
                for (let x = -sizeX; x <= sizeX; x++) {
                    for (let z = -sizeZ; z <= sizeZ; z++) {
                        // Create a small pond in the corner
                        if (x >= 1 && x <= 3 && z >= 1 && z <= 3) {
                            this.voxelEngine.setVoxel(x, 0, z, VoxelType.WATER);
                            // Add some water depth
                            this.voxelEngine.setVoxel(x, 1, z, VoxelType.WATER);
                        } 
                        // Add some snow patches
                        else if ((x === -2 && z === -2) || (x === -1 && z === -2) || (x === -2 && z === -1)) {
                            this.voxelEngine.setVoxel(x, 0, z, VoxelType.GRASS);
                            this.voxelEngine.setVoxel(x, 1, z, VoxelType.SNOW);
                        }
                        // Regular grass
                        else {
                            this.voxelEngine.setVoxel(x, 0, z, VoxelType.GRASS);
                        }
                    }
                }
                // Add a small ice structure
                this.voxelEngine.setVoxel(0, 1, -2, VoxelType.ICE);
                this.voxelEngine.setVoxel(0, 2, -2, VoxelType.ICE);
                break;
                
            case 'starter':
                // Just a few starter blocks
                this.voxelEngine.setVoxel(0, 0, 0, VoxelType.GRASS);
                this.voxelEngine.setVoxel(1, 0, 0, VoxelType.SAND);
                this.voxelEngine.setVoxel(-1, 0, 0, VoxelType.DIRT);
                this.voxelEngine.setVoxel(0, 0, 1, VoxelType.WATER);
                this.voxelEngine.setVoxel(0, 0, -1, VoxelType.STONE);
                break;
        }
        
        this.voxelEngine.updateInstances();
    }
    
    toggleGrid() {
        if (this.dynamicGrid) {
            this.dynamicGrid.visible = !this.dynamicGrid.visible;
            // Toggle axis lines as well
            this.axisLines.forEach(line => {
                line.visible = this.dynamicGrid!.visible;
            });
        }
    }
    
    cycleBrushSize() {
        const presetSizes = settings.brush.presetSizes;
        
        // Move to next size, wrapping around to start
        this.currentBrushIndex = (this.currentBrushIndex + 1) % presetSizes.length;
        const newSize = presetSizes[this.currentBrushIndex];
        
        // Update the size
        this.currentBrushSize = newSize;
        
        // Update drawing system brush size
        if (this.drawingSystem) {
            this.drawingSystem.setBrushSize(newSize);
        }
        
        // Update UI
        if (this.voxelPanel) {
            this.voxelPanel.updateBrushSize(newSize);
        }
        
        // Show brush size info
        const brushVolume = newSize * newSize * newSize;
        console.log(`Brush size changed to: ${newSize}×${newSize}×${newSize} (${brushVolume} voxels)`);
    }
    
    cycleBrushSizeReverse() {
        const presetSizes = settings.brush.presetSizes;
        
        // Move to previous size, wrapping around to end
        this.currentBrushIndex = this.currentBrushIndex - 1;
        if (this.currentBrushIndex < 0) {
            this.currentBrushIndex = presetSizes.length - 1;
        }
        const newSize = presetSizes[this.currentBrushIndex];
        
        // Update the size
        this.currentBrushSize = newSize;
        
        // Update drawing system brush size
        if (this.drawingSystem) {
            this.drawingSystem.setBrushSize(newSize);
        }
        
        // Update UI
        if (this.voxelPanel) {
            this.voxelPanel.updateBrushSize(newSize);
        }
        
        // Show brush size info
        const brushVolume = newSize * newSize * newSize;
        console.log(`Brush size changed to: ${newSize}×${newSize}×${newSize} (${brushVolume} voxels)`);
    }
    
    updatePreviewAtCurrentMouse(): void {
        // Force a preview update using the current mouse position
        if (!this.drawingSystem || !this.voxelEngine) return;
        
        // Update raycaster with current mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera!);
        const hit = this.voxelEngine.raycast(this.raycaster);
        
        // Update preview with the hit (skip during rotation)
        if (!this.isRotating) {
            this.drawingSystem.updatePreview(hit);
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update controls
        if (this.controls) {
            this.controls.update();
            
            // Ensure camera target doesn't go below ground with minimal buffer
            // The ground is at y = -0.001, add small buffer to prevent clipping
            const minY = 0.0; // Keep target at ground level (voxels start at y=0)
            if (this.controls.target.y < minY) {
                // Smoothly adjust instead of hard clamping for cinematic motion
                const diff = minY - this.controls.target.y;
                this.controls.target.y += diff * 0.2; // Faster interpolation for responsiveness
            }
        }
        
        // Update performance monitor
        if (this.performanceMonitor) {
            this.performanceMonitor.update();
            
            // Update stats display with voxel count
            if (this.voxelEngine) {
                const voxelCount = this.voxelEngine.getVoxelCount();
                const instanceCount = (this.voxelEngine as any).renderer?.getTotalInstanceCount() || 0;
                this.performanceMonitor.render(voxelCount, instanceCount);
            }
        }
        
        // Update gizmo scale to maintain constant screen size
        if (this.boxSelectionTool && this.boxSelectionTool.getTransformGizmo()) {
            this.boxSelectionTool.getTransformGizmo().updateScale();
        }
        
        // Update drawing system for smooth preview animation
        if (this.drawingSystem) {
            this.drawingSystem.update();
        }
        
        // Update dynamic grid based on zoom and camera angle
        if (this.dynamicGrid && this.camera) {
            // Calculate idle fade factor for grid
            let idleFadeFactor = 1.0;
            if (this.axisIdleFadeTimer > 0) {
                idleFadeFactor = THREE.MathUtils.mapLinear(this.axisIdleFadeTimer, 0, 1000, 1.0, 0.0);
                idleFadeFactor = THREE.MathUtils.clamp(idleFadeFactor, 0.0, 1.0);
            }
            this.dynamicGrid.update(this.camera.zoom, this.camera, idleFadeFactor);
        }
        
        // Check for idle time since last interaction
        const currentTime = Date.now();
        const timeSinceLastInteraction = currentTime - this.lastInteractionTime;
        
        // Start fade after 0.5 seconds of no interaction
        if (timeSinceLastInteraction > 500) {
            this.axisIdleFadeTimer = timeSinceLastInteraction - 500;
        } else {
            this.axisIdleFadeTimer = 0;
        }
        
        // Update X and Z axes visibility and scale based on zoom and camera angle
        if (this.camera && (this.xAxisLine || this.zAxisLine)) {
            // Get camera direction
            const cameraDir = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDir);
            
            // Calculate angle between camera direction and ground plane normal (Y-up)
            const groundNormal = new THREE.Vector3(0, 1, 0);
            const dotProduct = Math.abs(cameraDir.dot(groundNormal));
            
            // Calculate scale factor based on zoom
            // When zoomed out (zoom < 1), scale up the axes
            // When zoomed in (zoom > 1), keep normal size
            let scaleFactor = 1;
            if (this.camera.zoom < 1) {
                // Inverse relationship - as zoom decreases, scale increases
                // At zoom 0.1, scale is 3x; at zoom 1, scale is 1x
                scaleFactor = THREE.MathUtils.mapLinear(this.camera.zoom, 0.1, 1.0, 3.0, 1.0);
                scaleFactor = THREE.MathUtils.clamp(scaleFactor, 1.0, 3.0);
            }
            
            // Calculate base opacity from camera angle
            let baseAxisOpacity = 0.5;
            let baseGlowOpacity = 0.1;
            
            // Fade out axes when looking nearly straight down (bird's eye view)
            if (dotProduct > 0.8) {
                // dotProduct > 0.8 means camera is within ~37 degrees of straight down
                baseAxisOpacity = THREE.MathUtils.mapLinear(dotProduct, 0.8, 1.0, 0.5, 0);
                baseGlowOpacity = THREE.MathUtils.mapLinear(dotProduct, 0.8, 1.0, 0.1, 0);
            }
            
            // Apply idle fade after camera stops moving
            let idleFadeFactor = 1.0;
            if (this.axisIdleFadeTimer > 0) {
                // Fade out over 1 second after idle starts
                idleFadeFactor = THREE.MathUtils.mapLinear(this.axisIdleFadeTimer, 0, 1000, 1.0, 0.0);
                idleFadeFactor = THREE.MathUtils.clamp(idleFadeFactor, 0.0, 1.0);
            }
            
            // Create color interpolation targets
            const fadeColor = new THREE.Color(0x333333); // Faint gray instead of dark
            const xColor = new THREE.Color(settings.grid.axisLines.xColor);
            const zColor = new THREE.Color(settings.grid.axisLines.zColor);
            
            // Update X-axis
            if (this.xAxisLine && this.xAxisGlow) {
                const xMat = this.xAxisLine.material as THREE.MeshBasicMaterial;
                const xGlowMat = this.xAxisGlow.material as THREE.MeshBasicMaterial;
                
                // Interpolate color to dark gray based on idle fade
                xMat.color.lerpColors(fadeColor, xColor, idleFadeFactor);
                xGlowMat.color.lerpColors(fadeColor, xColor, idleFadeFactor);
                
                // Apply both angle-based fade and idle fade to opacity
                xMat.opacity = baseAxisOpacity * idleFadeFactor;
                xGlowMat.opacity = baseGlowOpacity * idleFadeFactor;
                
                // Scale thickness, not length
                this.xAxisLine.scale.set(1, scaleFactor, scaleFactor);
                this.xAxisGlow.scale.set(1, scaleFactor, scaleFactor);
            }
            
            // Update Z-axis
            if (this.zAxisLine && this.zAxisGlow) {
                const zMat = this.zAxisLine.material as THREE.MeshBasicMaterial;
                const zGlowMat = this.zAxisGlow.material as THREE.MeshBasicMaterial;
                
                // Interpolate color to dark gray based on idle fade
                zMat.color.lerpColors(fadeColor, zColor, idleFadeFactor);
                zGlowMat.color.lerpColors(fadeColor, zColor, idleFadeFactor);
                
                // Apply both angle-based fade and idle fade to opacity
                zMat.opacity = baseAxisOpacity * idleFadeFactor;
                zGlowMat.opacity = baseGlowOpacity * idleFadeFactor;
                // Scale thickness, not length
                this.zAxisLine.scale.set(scaleFactor, scaleFactor, 1);
                this.zAxisGlow.scale.set(scaleFactor, scaleFactor, 1);
            }
        }
        
        // Update UI
        if (this.performanceMonitor) {
            const fpsEl = document.getElementById('fps');
            if (fpsEl) fpsEl.textContent = this.performanceMonitor.getFPS().toFixed(0);
        }
        if (this.voxelEngine) {
            const countEl = document.getElementById('voxel-count');
            if (countEl) countEl.textContent = this.voxelEngine.getVoxelCount().toString();
        }
        if (this.renderer) {
            const drawEl = document.getElementById('draw-calls');
            if (drawEl) drawEl.textContent = this.renderer.info.render.calls.toString();
        }
        if (this.drawingSystem) {
            const typeEl = document.getElementById('voxel-type');
            if (typeEl) typeEl.textContent = this.drawingSystem.getCurrentVoxelTypeName();
            const toolEl = document.getElementById('tool-mode');
            if (toolEl) toolEl.textContent = (this.drawingSystem as any).toolMode;
            const brushEl = document.getElementById('brush-size');
            if (brushEl) brushEl.textContent = (this.drawingSystem as any).brushSize.toString();
        }
        
        if ((performance as any).memory) {
            const memoryMB = ((performance as any).memory.usedJSHeapSize / 1048576).toFixed(1);
            const memEl = document.getElementById('memory');
            if (memEl) memEl.textContent = memoryMB;
        }
        
        // Render scene with post-processing or directly
        if (this.renderer && this.camera) {
            if (this.composer && settings.postProcessing.enabled) {
                this.composer.render();
            } else {
                this.renderer.render(this.scene, this.camera);
            }
        }
        
        // Update and render direction indicator
        if (this.directionIndicator && this.camera) {
            this.directionIndicator.update(this.camera);
            this.directionIndicator.render();
        }
    }
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
    try {
        // Starting VoxelApp...
        const logger = ActionLogger.getInstance();
        logger.log('Starting VoxelApp...', 5000);
        const app = new VoxelApp();
        (window as any).app = app;
        
        // Attach performance testing utilities
        const voxelEngine = app.getVoxelEngine();
        if (voxelEngine) {
            attachPerformanceTest(voxelEngine);
        }
        
        // VoxelApp started successfully
        logger.log('VoxelApp ready', 2000);
        // Performance test available via window.perfTest
    } catch (error) {
        console.error('Error starting VoxelApp:', error);
    }
});