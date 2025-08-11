import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelEngine, VoxelType } from './engine/VoxelEngine';
import { DrawingSystem } from './interaction/DrawingSystem';
import { PerformanceMonitor } from './ui/Performance';
import { DirectionIndicator } from './ui/DirectionIndicator';
import { VoxelPanel } from './ui/VoxelPanel';

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
            type: THREE.PCFSoftShadowMap // Shadow quality
        }
    },
    
    // Scene Settings
    scene: {
        backgroundColor: 0x87CEEB,     // Sky blue background
        fog: {
            enabled: false,            // Toggle fog effect
            near: 50,                  // Fog start distance
            far: 200                   // Fog end distance
        }
    },
    
    // Lighting Settings
    lighting: {
        ambient: {
            color: 0xffffff,           // Ambient light color
            intensity: 0.6             // Ambient light intensity
        },
        directional: {
            color: 0xffffff,           // Directional light color
            intensity: 0.8,            // Directional light intensity
            position: {                // Light position
                x: 50,
                y: 100,
                z: 50
            },
            shadow: {
                mapSize: 2048,         // Shadow map resolution
                camera: {              // Shadow camera bounds
                    left: -50,
                    right: 50,
                    top: 50,
                    bottom: -50
                }
            }
        }
    },
    
    // Ground Plane Settings
    ground: {
        size: 200,                     // Ground plane size
        color: 0xaaaaaa,               // Ground color (medium grey)
        roughness: 0.8,                // Material roughness
        metalness: 0.2,                // Material metalness
        yPosition: -0.01              // Y position (slightly below to avoid z-fighting)
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
        mode: 'flat',                  // 'empty', 'flat', 'starter'
        flatGround: {
            sizeX: 3,                  // Half-width of flat ground
            sizeZ: 3                   // Half-depth of flat ground
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
        defaultVoxelType: VoxelType.GRASS // Default voxel type
    }
};

class VoxelApp {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera | null;
    private renderer: THREE.WebGLRenderer | null;
    private controls: OrbitControls | null;
    private voxelEngine: VoxelEngine | null;
    private drawingSystem: DrawingSystem | null;
    private performanceMonitor: PerformanceMonitor | null;
    private directionIndicator: DirectionIndicator | null;
    private voxelPanel: VoxelPanel | null;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private gridHelper: THREE.GridHelper | null = null;
    private axisLines: THREE.Line[] = [];
    
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.voxelEngine = null;
        this.drawingSystem = null;
        this.performanceMonitor = null;
        this.directionIndicator = null;
        this.voxelPanel = null;
        
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
            this.scene.fog = new THREE.Fog(
                SETTINGS.scene.backgroundColor,
                SETTINGS.scene.fog.near,
                SETTINGS.scene.fog.far
            );
        }
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(
            SETTINGS.lighting.ambient.color,
            SETTINGS.lighting.ambient.intensity
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
        directionalLight.shadow.mapSize.width = SETTINGS.lighting.directional.shadow.mapSize;
        directionalLight.shadow.mapSize.height = SETTINGS.lighting.directional.shadow.mapSize;
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
        
        // Add subtle main axis lines for X and Z
        const axisLength = SETTINGS.grid.axisLines.length;
        
        // X-axis line (subtle red tint)
        const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-axisLength, 0.01, 0),
            new THREE.Vector3(axisLength, 0.01, 0)
        ]);
        const xAxisLine = new THREE.Line(xAxisGeometry, new THREE.LineBasicMaterial({ 
            color: SETTINGS.grid.axisLines.xColor, 
            opacity: SETTINGS.grid.axisLines.opacity, 
            transparent: true
        }));
        this.scene.add(xAxisLine);
        
        // Z-axis line (subtle blue tint)
        const zAxisGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.01, -axisLength),
            new THREE.Vector3(0, 0.01, axisLength)
        ]);
        const zAxisLine = new THREE.Line(zAxisGeometry, new THREE.LineBasicMaterial({ 
            color: SETTINGS.grid.axisLines.zColor, 
            opacity: SETTINGS.grid.axisLines.opacity, 
            transparent: true
        }));
        this.scene.add(zAxisLine);
        
        // Store references for toggling
        this.axisLines = [xAxisLine, zAxisLine];
        
        // Initialize systems
        this.voxelEngine = new VoxelEngine(this.scene);
        this.drawingSystem = new DrawingSystem(this.voxelEngine);
        this.performanceMonitor = new PerformanceMonitor();
        this.directionIndicator = new DirectionIndicator();
        this.voxelPanel = new VoxelPanel(this.drawingSystem);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start render loop
        this.animate();
        
        // Add some initial voxels for testing
        console.log('Creating test scene...');
        this.createTestScene();
        console.log('Voxel count after test scene:', this.voxelEngine.getVoxelCount());
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
    }
    
    onMouseMove(event: MouseEvent) {
        // Get the canvas bounding rect for accurate mouse position
        const rect = this.renderer!.domElement.getBoundingClientRect();
        
        // Calculate normalized device coordinates relative to canvas
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera!);
        
        const hit = this.voxelEngine!.raycast(this.raycaster);
        
        // Update preview
        this.drawingSystem!.updatePreview(hit);
        
        // Continue drawing if mouse is held down (brush mode only)
        if (event.buttons && this.drawingSystem!.isDrawing && 
            this.drawingSystem!.toolMode === 'brush' && hit) {
            let pos;
            
            // When adding voxels, constrain to the initial drawing surface
            if (this.drawingSystem!.drawMode === 'add' && this.drawingSystem!.drawingSurface) {
                const voxelSize = this.voxelEngine!.getVoxelSize();
                const normal = this.drawingSystem!.drawingSurface.normal;
                
                // Determine which axis is dominant in the normal
                const absX = Math.abs(normal.x);
                const absY = Math.abs(normal.y);
                const absZ = Math.abs(normal.z);
                
                if (absY > absX && absY > absZ) {
                    // Horizontal surface (floor/ceiling)
                    // Use hit point for X/Z but constrain Y
                    pos = {
                        x: Math.floor(hit.point.x / voxelSize + 0.5),
                        y: this.drawingSystem!.drawingSurface.basePos.y,
                        z: Math.floor(hit.point.z / voxelSize + 0.5)
                    };
                } else if (absX > absY && absX > absZ) {
                    // Vertical surface facing X (east/west wall)
                    // Constrain X, use hit point for Y/Z
                    pos = {
                        x: this.drawingSystem!.drawingSurface.basePos.x,
                        y: Math.floor(hit.point.y / voxelSize + 0.5),
                        z: Math.floor(hit.point.z / voxelSize + 0.5)
                    };
                } else {
                    // Vertical surface facing Z (north/south wall)
                    // Constrain Z, use hit point for X/Y
                    pos = {
                        x: Math.floor(hit.point.x / voxelSize + 0.5),
                        y: Math.floor(hit.point.y / voxelSize + 0.5),
                        z: this.drawingSystem!.drawingSurface.basePos.z
                    };
                }
            } else {
                // For removal or if no surface stored, use normal logic
                pos = this.drawingSystem!.drawMode === 'add' ? hit.adjacentPos : hit.voxelPos;
            }
            
            this.drawingSystem!.applyBrush(pos.x, pos.y, pos.z);
        }
    }
    
    onMouseDown(event: MouseEvent) {
        // Left click - add voxels (unless Alt is held for rotation)
        if (event.button === 0 && !event.altKey) {
            if (this.voxelEngine && this.drawingSystem) {
                const hit = this.voxelEngine.raycast(this.raycaster);
                if (hit) {
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
            case 'b':
            case 'B':
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('brush');
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('brush');
                }
                break;
            case 'x':
            case 'X':
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('box');
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('box');
                }
                break;
            case 'l':
            case 'L':
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('line');
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('line');
                }
                break;
            case 'p':
            case 'P':
                if (this.drawingSystem) {
                    this.drawingSystem.setToolMode('fill');
                }
                if (this.voxelPanel) {
                    this.voxelPanel.updateToolMode('fill');
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
                // Simple flat ground
                const sizeX = SETTINGS.testScene.flatGround.sizeX;
                const sizeZ = SETTINGS.testScene.flatGround.sizeZ;
                for (let x = -sizeX; x <= sizeX; x++) {
                    for (let z = -sizeZ; z <= sizeZ; z++) {
                        this.voxelEngine.setVoxel(x, 0, z, VoxelType.GRASS);
                    }
                }
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
        
        // Render main scene
        if (this.renderer && this.camera) {
            this.renderer.render(this.scene, this.camera);
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