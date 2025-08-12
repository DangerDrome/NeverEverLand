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
import { BoxSelectionTool } from './tools/BoxSelectionTool';

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
            enabled: true,            // Start disabled like v006
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
        
        // Enhanced grid with balanced visibility
        this.gridHelper = new THREE.GridHelper(
            SETTINGS.grid.size,
            SETTINGS.grid.divisions,
            SETTINGS.grid.colorCenterLine,
            SETTINGS.grid.colorGrid
        );
        this.gridHelper.material.opacity = SETTINGS.grid.opacity;
        this.gridHelper.material.transparent = true;
        this.scene.add(this.gridHelper);
        
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
        
        // Initialize tilt-shift button (ON by default)
        const tiltShiftButton = document.getElementById('tiltshift-toggle-button') as HTMLButtonElement;
        if (tiltShiftButton) {
            const tiltShiftIcon = tiltShiftButton.querySelector('span');
            tiltShiftButton.style.background = 'rgba(100, 200, 100, 0.3)';
            tiltShiftButton.style.borderColor = 'rgba(100, 200, 100, 0.8)';
            if (tiltShiftIcon) tiltShiftIcon.style.color = 'rgba(100, 255, 100, 1)';
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
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Mouse events
        if (this.renderer) {
            this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
            this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
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
        
        // Update preview
        this.drawingSystem!.updatePreview(hit);
        
        // Continue drawing if mouse is held down (brush or eraser mode)
        if (event.buttons && this.drawingSystem!.isDrawing && 
            (this.drawingSystem!.toolMode === 'brush' || this.drawingSystem!.toolMode === 'eraser')) {
            
            // For eraser, we need to handle the case where hit might be null (no voxel under cursor)
            // but we still want to continue erasing along the constrained plane
            if (!hit && this.drawingSystem!.toolMode === 'eraser' && this.drawingSystem!.drawingSurface) {
                // Project mouse ray onto the constrained plane for continuous erasing
                const voxelSize = this.voxelEngine!.getVoxelSize();
                const normal = this.drawingSystem!.drawingSurface.normal;
                const basePos = this.drawingSystem!.drawingSurface.basePos;
                
                // Get a point along the ray
                const rayPoint = this.raycaster.ray.origin.clone().add(
                    this.raycaster.ray.direction.clone().multiplyScalar(10)
                );
                
                // Convert to voxel coordinates and constrain to plane
                const absX = Math.abs(normal.x);
                const absY = Math.abs(normal.y);
                const absZ = Math.abs(normal.z);
                
                let pos;
                if (absY > absX && absY > absZ) {
                    // Horizontal plane - use ray's X/Z, constrained Y
                    pos = {
                        x: Math.floor(rayPoint.x / voxelSize),
                        y: basePos.y,
                        z: Math.floor(rayPoint.z / voxelSize)
                    };
                } else if (absX > absY && absX > absZ) {
                    // Vertical X plane - constrained X, use ray's Y/Z
                    pos = {
                        x: basePos.x,
                        y: Math.floor(rayPoint.y / voxelSize),
                        z: Math.floor(rayPoint.z / voxelSize)
                    };
                } else {
                    // Vertical Z plane - use ray's X/Y, constrained Z
                    pos = {
                        x: Math.floor(rayPoint.x / voxelSize),
                        y: Math.floor(rayPoint.y / voxelSize),
                        z: basePos.z
                    };
                }
                
                this.drawingSystem!.applyBrush(pos.x, pos.y, pos.z);
                return;
            }
            
            if (!hit) return; // No hit and not erasing with constraint
            
            let pos;
            
            // Constrain to the initial drawing surface to prevent unwanted voxel modifications
            if (this.drawingSystem!.drawingSurface) {
                const normal = this.drawingSystem!.drawingSurface.normal;
                
                // Determine which axis is dominant in the normal
                const absX = Math.abs(normal.x);
                const absY = Math.abs(normal.y);
                const absZ = Math.abs(normal.z);
                
                // Get the appropriate base position
                const targetPos = this.drawingSystem!.toolMode === 'eraser' ? hit.voxelPos : hit.adjacentPos;
                
                if (absY > absX && absY > absZ) {
                    // Horizontal surface (floor/ceiling)
                    // Use current position for X/Z but constrain Y to the initial plane
                    pos = {
                        x: targetPos.x,
                        y: this.drawingSystem!.drawingSurface.basePos.y,
                        z: targetPos.z
                    };
                } else if (absX > absY && absX > absZ) {
                    // Vertical surface facing X (east/west wall)
                    // Constrain X to the initial plane, use current position for Y/Z
                    pos = {
                        x: this.drawingSystem!.drawingSurface.basePos.x,
                        y: targetPos.y,
                        z: targetPos.z
                    };
                } else {
                    // Vertical surface facing Z (north/south wall)
                    // Constrain Z to the initial plane, use current position for X/Y
                    pos = {
                        x: targetPos.x,
                        y: targetPos.y,
                        z: this.drawingSystem!.drawingSurface.basePos.z
                    };
                }
            } else {
                // If no surface stored (shouldn't happen), use normal logic
                pos = this.drawingSystem!.drawMode === 'add' ? hit.adjacentPos : hit.voxelPos;
            }
            
            this.drawingSystem!.applyBrush(pos.x, pos.y, pos.z);
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
        
        // Left click - add voxels (unless Alt is held for rotation)
        if (event.button === 0 && !event.altKey) {
            if (this.voxelEngine && this.drawingSystem) {
                const hit = this.voxelEngine.raycast(this.raycaster);
                console.log('Left click hit:', hit);
                if (hit) {
                    console.log('Starting drawing at:', hit.adjacentPos, 'on face with normal:', hit.normal);
                    this.drawingSystem.startDrawing(hit, 'add');
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
                break;
        }
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
        if (this.gridHelper) {
            this.gridHelper.visible = !this.gridHelper.visible;
            // Toggle axis lines as well
            this.axisLines.forEach(line => {
                line.visible = this.gridHelper!.visible;
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
        console.log('VoxelApp started successfully');
    } catch (error) {
        console.error('Error starting VoxelApp:', error);
    }
});