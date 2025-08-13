import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { TiltShiftPass } from './postprocessing/TiltShiftPass';
import { VoxelEngine, VoxelType } from './engine/VoxelEngine';
import { DrawingSystem } from './interaction/DrawingSystem';
import { PerformanceMonitor } from './ui/Performance';
import { DirectionIndicator } from './ui/DirectionIndicator';
import { VoxelPanel } from './ui/VoxelPanel';
import { FileManager } from './io/FileManager';
import { DynamicGrid } from './ui/DynamicGrid';
import { BoxSelectionTool } from './tools/BoxSelectionTool';
import { attachPerformanceTest } from './utils/PerformanceTest';

// =====================================
// SETTINGS - Customize your experience
// =====================================

const SETTINGS = {
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
        dampingFactor: 0.05,           // How smooth the damping is
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
        yPosition: 0                  // Y position (at exactly 0 to align with voxels)
    },
    
    // Grid Settings
    grid: {
        size: 100,                     // Grid size
        divisions: 100,                // Number of grid divisions
        colorCenterLine: 0x444444,     // Center line color
        colorGrid: 0x222222,           // Grid line color
        opacity: 0.4,                  // Grid opacity
        axisLines: {
            xColor: 0x884444,          // X-axis color (subtle red)
            zColor: 0x444488,          // Z-axis color (subtle blue)
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
        showStats: true,               // Show performance stats on start
        targetFPS: 60                  // Target frames per second
    },
    
    // UI Settings
    ui: {
        showLoadingScreen: true,       // Show loading screen
        showControls: true,            // Show controls panel
        showStats: true,               // Show stats panel
        defaultBrushSize: 1,           // Default brush size
        defaultVoxelType: VoxelType.GRASS, // Default voxel type
        showWireframe: true            // Show wireframe/edges on startup
    },
    
    // Voxel Settings
    voxel: {
        size: 0.1                      // Fixed voxel size at 0.1m for high detail
    },
    
    // Brush Settings
    brush: {
        presetSizes: [1, 2, 4, 6, 8, 10], // Brush sizes (cubic: 1x1x1, 2x2x2, 4x4x4, etc.)
        defaultSizeIndex: 0,               // Start with single voxel brush
        defaultSize: 1                     // Default brush size
    }
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
    private fileManager: FileManager | null;
    private boxSelectionTool: BoxSelectionTool | null;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private gridHelper: THREE.GridHelper | null = null;
    private dynamicGrid: DynamicGrid | null = null;
    private axisLines: (THREE.Mesh | THREE.Line)[] = [];
    private selectionMode: boolean = false;
    private lastMousePos: { x: number; y: number } = { x: 0, y: 0 };
    private currentBrushSize: number = SETTINGS.brush.defaultSize;
    private currentBrushIndex: number = SETTINGS.brush.defaultSizeIndex;
    
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
        this.fileManager = null;
        this.boxSelectionTool = null;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.init();
    }
    
    init() {
        // Hide loading, show UI based on settings
        if (SETTINGS.ui.showLoadingScreen) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
        }
        if (SETTINGS.ui.showStats) {
            const statsEl = document.getElementById('stats');
            if (statsEl) statsEl.style.display = 'block';
        }
        if (SETTINGS.ui.showControls) {
            const controlsEl = document.getElementById('controls');
            if (controlsEl) controlsEl.style.display = 'block';
        }
        
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: SETTINGS.renderer.antialias,
            powerPreference: SETTINGS.renderer.powerPreference
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = SETTINGS.renderer.shadowMap.enabled;
        this.renderer.shadowMap.type = SETTINGS.renderer.shadowMap.type;
        const containerEl = document.getElementById('container');
        if (containerEl) containerEl.appendChild(this.renderer.domElement);
        
        // Setup camera
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = SETTINGS.camera.frustumSize;
        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            SETTINGS.camera.near,
            SETTINGS.camera.far
        );
        
        // Position camera for isometric view
        this.camera.position.set(
            SETTINGS.camera.position.x,
            SETTINGS.camera.position.y,
            SETTINGS.camera.position.z
        );
        this.camera.lookAt(
            SETTINGS.camera.lookAt.x,
            SETTINGS.camera.lookAt.y,
            SETTINGS.camera.lookAt.z
        );
        
        // Set initial zoom level (more zoomed in)
        this.camera.zoom = 8.0;  // Start at 8x zoom for much closer initial view
        this.camera.updateProjectionMatrix();
        
        console.log('Camera position:', this.camera.position);
        console.log('Camera looking at:', new THREE.Vector3(0, 0, 0));
        
        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = SETTINGS.controls.enableDamping;
        this.controls.dampingFactor = SETTINGS.controls.dampingFactor;
        this.controls.screenSpacePanning = SETTINGS.controls.screenSpacePanning;
        this.controls.minZoom = SETTINGS.controls.minZoom;
        this.controls.maxZoom = SETTINGS.controls.maxZoom;
        
        // Configure mouse buttons
        this.controls.mouseButtons = {
            LEFT: SETTINGS.controls.mouseButtons.left,
            MIDDLE: SETTINGS.controls.mouseButtons.middle,
            RIGHT: SETTINGS.controls.mouseButtons.right
        };
        
        // Setup scene
        this.scene.background = new THREE.Color(SETTINGS.scene.backgroundColor);
        if (SETTINGS.scene.fog.enabled) {
            // Apply fog with custom color and adjusted density based on opacity
            const fogColor = new THREE.Color(SETTINGS.scene.fog.color);
            
            // Adjust fog distances based on opacity (lower opacity = further distances)
            const opacityMultiplier = 1.0 / Math.max(0.1, SETTINGS.scene.fog.opacity);
            const adjustedNear = SETTINGS.scene.fog.near * opacityMultiplier;
            const adjustedFar = SETTINGS.scene.fog.far * opacityMultiplier;
            
            this.scene.fog = new THREE.Fog(
                fogColor,
                adjustedNear,
                adjustedFar
            );
        }
        
        // Lighting with shadow control
        // Mix shadow color tint with white based on darkness
        const shadowTint = new THREE.Color(SETTINGS.scene.shadows.colorTint);
        const white = new THREE.Color(0xffffff);
        const ambientColor = white.clone().lerp(shadowTint, SETTINGS.scene.shadows.darkness * 0.3);
        
        const ambientLight = new THREE.AmbientLight(
            ambientColor,
            SETTINGS.scene.shadows.getAmbientIntensity()  // Use calculated intensity based on shadow darkness
        );
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(
            SETTINGS.lighting.directional.color,
            SETTINGS.lighting.directional.intensity
        );
        directionalLight.position.set(
            SETTINGS.lighting.directional.position.x,
            SETTINGS.lighting.directional.position.y,
            SETTINGS.lighting.directional.position.z
        );
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = SETTINGS.lighting.directional.shadow.camera.left;
        directionalLight.shadow.camera.right = SETTINGS.lighting.directional.shadow.camera.right;
        directionalLight.shadow.camera.top = SETTINGS.lighting.directional.shadow.camera.top;
        directionalLight.shadow.camera.bottom = SETTINGS.lighting.directional.shadow.camera.bottom;
        directionalLight.shadow.camera.near = SETTINGS.lighting.directional.shadow.camera.near;
        directionalLight.shadow.camera.far = SETTINGS.lighting.directional.shadow.camera.far;
        directionalLight.shadow.mapSize.width = SETTINGS.lighting.directional.shadow.mapSize;
        directionalLight.shadow.mapSize.height = SETTINGS.lighting.directional.shadow.mapSize;
        directionalLight.shadow.bias = SETTINGS.lighting.directional.shadow.bias;
        directionalLight.shadow.normalBias = SETTINGS.lighting.directional.shadow.normalBias;
        directionalLight.shadow.radius = SETTINGS.lighting.directional.shadow.radius;
        directionalLight.shadow.blurSamples = SETTINGS.lighting.directional.shadow.blurSamples;
        this.scene.add(directionalLight);
        
        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(
            SETTINGS.ground.size,
            SETTINGS.ground.size
        );
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: SETTINGS.ground.color,
            roughness: SETTINGS.ground.roughness,
            metalness: SETTINGS.ground.metalness
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = SETTINGS.ground.yPosition;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Create dynamic grid instead of static GridHelper
        this.dynamicGrid = new DynamicGrid(SETTINGS.grid.size);
        this.scene.add(this.dynamicGrid);
        
        // Keep old gridHelper reference for compatibility
        this.gridHelper = null;
        
        // Add thick glowing main axis lines for X and Z
        const axisLength = SETTINGS.grid.axisLines.length;
        const axisThickness = 0.005; // Thickness of the axis lines (0.5cm - reduced from 1.5cm)
        const axisHeight = 0.001; // Slightly above ground to avoid z-fighting
        
        // X-axis line (glowing red)
        const xAxisGeometry = new THREE.BoxGeometry(axisLength * 2, axisThickness, axisThickness);
        const xAxisMaterial = new THREE.MeshBasicMaterial({ 
            color: SETTINGS.grid.axisLines.xColor,
            opacity: 0.9,
            transparent: true
        });
        const xAxisLine = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
        xAxisLine.position.set(0, axisHeight, 0);
        xAxisLine.renderOrder = 1; // Render on top of ground
        this.scene.add(xAxisLine);
        
        // Add glow effect for X-axis
        const xGlowGeometry = new THREE.BoxGeometry(axisLength * 2, axisThickness * 3, axisThickness * 3);
        const xGlowMaterial = new THREE.MeshBasicMaterial({ 
            color: SETTINGS.grid.axisLines.xColor,
            opacity: 0.2,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        const xGlow = new THREE.Mesh(xGlowGeometry, xGlowMaterial);
        xGlow.position.set(0, axisHeight, 0);
        xGlow.renderOrder = 0;
        this.scene.add(xGlow);
        
        // Z-axis line (glowing blue)
        const zAxisGeometry = new THREE.BoxGeometry(axisThickness, axisThickness, axisLength * 2);
        const zAxisMaterial = new THREE.MeshBasicMaterial({ 
            color: SETTINGS.grid.axisLines.zColor,
            opacity: 0.9,
            transparent: true
        });
        const zAxisLine = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
        zAxisLine.position.set(0, axisHeight, 0);
        zAxisLine.renderOrder = 1;
        this.scene.add(zAxisLine);
        
        // Add glow effect for Z-axis
        const zGlowGeometry = new THREE.BoxGeometry(axisThickness * 3, axisThickness * 3, axisLength * 2);
        const zGlowMaterial = new THREE.MeshBasicMaterial({ 
            color: SETTINGS.grid.axisLines.zColor,
            opacity: 0.2,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        const zGlow = new THREE.Mesh(zGlowGeometry, zGlowMaterial);
        zGlow.position.set(0, axisHeight, 0);
        zGlow.renderOrder = 0;
        this.scene.add(zGlow);
        
        // Store references for toggling
        this.axisLines = [xAxisLine, xGlow, zAxisLine, zGlow];
        
        // Setup post-processing
        this.setupPostProcessing();
        
        // Initialize systems
        // Always use 0.1m voxel size for high detail
        this.voxelEngine = new VoxelEngine(this.scene, SETTINGS.ui.showWireframe, SETTINGS.voxel.size);
        this.drawingSystem = new DrawingSystem(this.voxelEngine);
        this.performanceMonitor = new PerformanceMonitor();
        this.directionIndicator = new DirectionIndicator();
        this.voxelPanel = new VoxelPanel(this.drawingSystem);
        
        // Connect asset manager to drawing system
        this.drawingSystem.setAssetManager(this.voxelPanel.getAssetManager());
        
        // Update tilt-shift button initial state after VoxelPanel creates it
        setTimeout(() => {
            const tiltShiftButton = document.getElementById('tiltshift-toggle-button') as HTMLButtonElement;
            if (tiltShiftButton && !SETTINGS.postProcessing.tiltShift.enabled) {
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
        console.log('Creating test scene...');
        this.createTestScene();
        console.log('Voxel count after test scene:', this.voxelEngine.getVoxelCount());
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
        // Initialize edge/wireframe button based on SETTINGS
        const edgeButton = document.getElementById('edge-toggle-button') as HTMLButtonElement;
        if (edgeButton && SETTINGS.ui.showWireframe) {
            const edgeIcon = edgeButton.querySelector('span');
            edgeButton.style.background = 'rgba(100, 200, 100, 0.3)';
            edgeButton.style.borderColor = 'rgba(100, 200, 100, 0.8)';
            if (edgeIcon) edgeIcon.style.color = 'rgba(100, 255, 100, 1)';
        }
        
    }
    
    setupPostProcessing() {
        if (!SETTINGS.postProcessing.enabled || !this.renderer || !this.camera) return;
        
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
            this.tiltShiftPass.focusPosition = SETTINGS.postProcessing.tiltShift.focusPosition;
            this.tiltShiftPass.focusBandwidth = SETTINGS.postProcessing.tiltShift.focusBandwidth;
            this.tiltShiftPass.blurStrength = SETTINGS.postProcessing.tiltShift.blurStrength;
            this.tiltShiftPass.gammaCorrection = SETTINGS.postProcessing.tiltShift.gammaCorrection;
            this.tiltShiftPass.bladeCount = SETTINGS.postProcessing.tiltShift.bladeCount;
            this.tiltShiftPass.enabled = SETTINGS.postProcessing.tiltShift.enabled;
            
            this.composer.addPass(this.tiltShiftPass);
            
            console.log('Post-processing initialized with tilt-shift');
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
        }
        
        // Keyboard events
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
    }
    
    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = SETTINGS.camera.frustumSize;
        
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
            
            if (this.boxSelectionTool.isInSelectionMode() && hit) {
                // Update selection box while dragging
                this.boxSelectionTool.updateSelection(hit.point);
            } else if (event.buttons === 1) {
                // Handle gizmo dragging
                this.boxSelectionTool.handleGizmoDrag(this.raycaster);
            }
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
        this.drawingSystem!.updatePreview(hit, constrainedPos || undefined);
        
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
                    // Try single voxel or contiguous selection first
                    const hit = this.voxelEngine!.raycast(this.raycaster);
                    if (hit) {
                        // Check if clicking on a voxel (not empty space)
                        // Pass voxelPos for single/double click selection
                        if (!this.boxSelectionTool.handleClick(hit.voxelPos, event.shiftKey)) {
                            // No voxel clicked, start box selection (pass shift key for additive selection)
                            this.boxSelectionTool.startSelection(hit.point, event.shiftKey);
                            // Disable orbit controls during selection
                            if (this.controls) this.controls.enabled = false;
                        } else {
                            // Single voxel or contiguous selection handled
                            // Keep controls enabled for now
                        }
                    }
                }
            }
            return;
        }
        
        // Left click - add or remove based on tool (unless Alt is held for rotation)
        if (event.button === 0 && !event.altKey) {
            if (this.voxelEngine && this.drawingSystem) {
                const hit = this.voxelEngine.raycast(this.raycaster);
                console.log('Left click hit:', hit);
                if (hit) {
                    // Check if eraser tool is selected
                    const mode = this.drawingSystem.toolMode === 'eraser' ? 'remove' : 'add';
                    console.log('Starting drawing at:', 
                        mode === 'add' ? hit.adjacentPos : hit.voxelPos, 
                        'on face with normal:', hit.normal,
                        'mode:', mode);
                    this.drawingSystem.startDrawing(hit, mode);
                    // Disable orbit controls to prevent rotation while drawing
                    if (this.controls) this.controls.enabled = false;
                }
            }
        } 
        // Right click - remove voxels (unless Alt is held)
        else if (event.button === 2 && !event.altKey) {
            if (this.voxelEngine && this.drawingSystem) {
                const hit = this.voxelEngine.raycast(this.raycaster);
                if (hit) {
                    this.drawingSystem.startDrawing(hit, 'remove');
                    // Disable orbit controls to prevent rotation while drawing
                    if (this.controls) this.controls.enabled = false;
                }
            }
        }
        // Alt + Left click or just Right click enables rotation
        else if ((event.button === 0 && event.altKey) || (event.button === 2 && event.altKey)) {
            if (this.controls) this.controls.enabled = true;
        }
    }
    
    onMouseUp(_event: MouseEvent) {
        // Handle selection mode
        if (this.selectionMode && this.boxSelectionTool) {
            if (this.boxSelectionTool.isInSelectionMode()) {
                this.boxSelectionTool.endSelection();
            }
            // End gizmo drag if active
            this.boxSelectionTool.handleGizmoMouseUp();
            // Re-enable controls
            if (this.controls) this.controls.enabled = true;
            return;
        }
        
        if (this.drawingSystem) {
            this.drawingSystem.stopDrawing();
        }
        // Re-enable controls after drawing
        if (this.controls) this.controls.enabled = true;
    }
    
    onWheel(event: WheelEvent) {
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
                this.camera.zoom = Math.max(SETTINGS.controls.minZoom, 
                    Math.min(SETTINGS.controls.maxZoom, this.camera.zoom));
                
                this.camera.updateProjectionMatrix();
                
                // Update dynamic grid if it exists
                if (this.dynamicGrid) {
                    this.dynamicGrid.update(this.camera.zoom);
                }
            }
        }
        // Otherwise, let OrbitControls handle it normally
    }
    
    onKeyDown(event: KeyboardEvent) {
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
                // Paste Selection
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
            // Q/E removed - use voxel panel or number keys 1-9 for voxel selection
            case 'g':
            case 'G':
                this.toggleGrid();
                break;
            case 'f':
            case 'F':
                // Focus camera on selection or scene contents (like Blender/Houdini)
                this.focusCameraOnTarget();
                break;
            case 'p':
            case 'P':
                // Toggle performance monitor (moved from 'f' key)
                if (this.performanceMonitor) {
                    this.performanceMonitor.toggle();
                }
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
                    this.boxSelectionTool.clearSelection();
                }
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('brush');
                    this.drawingSystem.showPreview();
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('brush');
                }
                break;
            case 'e':
            case 'E':
                // Exit selection mode when switching tools
                this.selectionMode = false;
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.clearSelection();
                }
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('eraser');
                    this.drawingSystem.showPreview();
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('eraser');
                }
                break;
            case 'x':
            case 'X':
                // Exit selection mode when switching tools
                this.selectionMode = false;
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.clearSelection();
                }
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('box');
                    this.drawingSystem.showPreview();
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('box');
                }
                break;
            case 'l':
            case 'L':
                // Exit selection mode when switching tools
                this.selectionMode = false;
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.clearSelection();
                }
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('line');
                    this.drawingSystem.showPreview();
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('line');
                }
                break;
            case 'p':
            case 'P':
                // Exit selection mode when switching tools
                this.selectionMode = false;
                if (this.boxSelectionTool) {
                    this.boxSelectionTool.clearSelection();
                }
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('fill');
                    this.drawingSystem.showPreview();
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('fill');
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
                    console.log('Wireframe:', this.voxelEngine.getShowEdges() ? 'ON' : 'OFF');
                }
                break;
            case 's':
            case 'S':
                // Toggle selection mode
                if (!event.ctrlKey && !event.metaKey) {
                    this.selectionMode = !this.selectionMode;
                    if (this.boxSelectionTool) {
                        if (!this.selectionMode) {
                            this.boxSelectionTool.clearSelection();
                        }
                    }
                    // Hide/show drawing preview based on selection mode
                    if (this.drawingSystem) {
                        if (this.selectionMode) {
                            this.drawingSystem.hidePreview();
                        } else {
                            this.drawingSystem.showPreview();
                        }
                    }
                    console.log('Selection mode:', this.selectionMode ? 'ON' : 'OFF');
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
                        this.boxSelectionTool.clearSelection();
                        console.log('Selection cleared');
                    }
                }
                // Also clear asset selection
                if (this.drawingSystem && this.drawingSystem.selectedAsset) {
                    this.drawingSystem.setSelectedAsset(null);
                    this.drawingSystem.setToolMode('brush');
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
        const frustumSize = SETTINGS.camera.frustumSize;
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
        
        if (!SETTINGS.testScene.enabled) {
            this.voxelEngine.updateInstances();
            return;
        }
        
        switch (SETTINGS.testScene.mode) {
            case 'empty':
                // Start with empty scene
                break;
                
            case 'flat':
                // Simple flat ground with water and snow features
                const sizeX = SETTINGS.testScene.flatGround.sizeX;
                const sizeZ = SETTINGS.testScene.flatGround.sizeZ;
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
        const presetSizes = SETTINGS.brush.presetSizes;
        
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
        const presetSizes = SETTINGS.brush.presetSizes;
        
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
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update controls
        if (this.controls) {
            this.controls.update();
        }
        
        // Update performance monitor
        if (this.performanceMonitor) {
            this.performanceMonitor.update();
        }
        
        // Update gizmo scale to maintain constant screen size
        if (this.boxSelectionTool && this.boxSelectionTool.getTransformGizmo()) {
            this.boxSelectionTool.getTransformGizmo().updateScale();
        }
        
        // Update drawing system for smooth preview animation
        if (this.drawingSystem) {
            this.drawingSystem.update();
        }
        
        // Update dynamic grid based on zoom
        if (this.dynamicGrid && this.camera) {
            this.dynamicGrid.update(this.camera.zoom);
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
            if (this.composer && SETTINGS.postProcessing.enabled) {
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
        console.log('Starting VoxelApp...');
        const app = new VoxelApp();
        (window as any).app = app;
        
        // Attach performance testing utilities
        const voxelEngine = app.getVoxelEngine();
        if (voxelEngine) {
            attachPerformanceTest(voxelEngine);
        }
        
        console.log('VoxelApp started successfully');
        console.log('Performance test available via window.perfTest - type perfTest.suite() to run tests');
    } catch (error) {
        console.error('Error starting VoxelApp:', error);
    }
});