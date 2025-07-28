import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelEngine, VoxelType } from './engine/VoxelEngine';
import { DrawingSystem } from './interaction/DrawingSystem';
import { PerformanceMonitor } from './ui/Performance';
import { DirectionIndicator } from './ui/DirectionIndicator';
import { VoxelPanel } from './ui/VoxelPanel';

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
        // Hide loading, show UI
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
        const statsEl = document.getElementById('stats');
        if (statsEl) statsEl.style.display = 'block';
        const controlsEl = document.getElementById('controls');
        if (controlsEl) controlsEl.style.display = 'block';
        
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        const containerEl = document.getElementById('container');
        if (containerEl) containerEl.appendChild(this.renderer.domElement);
        
        // Setup camera
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 20;
        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            0.1,
            1000
        );
        
        // Position camera for isometric view
        this.camera.position.set(20, 20, 20);
        this.camera.lookAt(0, 0, 0);
        console.log('Camera position:', this.camera.position);
        console.log('Camera looking at:', new THREE.Vector3(0, 0, 0));
        
        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minZoom = 0.5;
        this.controls.maxZoom = 10;
        
        // Configure mouse buttons: LEFT = rotate, MIDDLE = pan, RIGHT = pan
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        };
        
        // Setup scene
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        // this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200); // Disable fog for now
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xaaaaaa,  // Medium grey
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01; // Slightly below to avoid z-fighting
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Enhanced grid with balanced visibility
        this.gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
        this.gridHelper.material.opacity = 0.4;
        this.gridHelper.material.transparent = true;
        this.scene.add(this.gridHelper);
        
        // Add subtle main axis lines for X and Z
        // X-axis line (subtle red tint)
        const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-50, 0.01, 0),
            new THREE.Vector3(50, 0.01, 0)
        ]);
        const xAxisLine = new THREE.Line(xAxisGeometry, new THREE.LineBasicMaterial({ 
            color: 0x884444, 
            opacity: 0.5, 
            transparent: true
        }));
        this.scene.add(xAxisLine);
        
        // Z-axis line (subtle blue tint)
        const zAxisGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.01, -50),
            new THREE.Vector3(0, 0.01, 50)
        ]);
        const zAxisLine = new THREE.Line(zAxisGeometry, new THREE.LineBasicMaterial({ 
            color: 0x444488, 
            opacity: 0.5, 
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
        const frustumSize = 20;
        
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
        
        // Option 1: Start with empty scene (uncomment if preferred)
        // this.voxelEngine.updateInstances();
        // return;
        
        // Option 2: Simple flat ground (current)
        for (let x = -3; x <= 3; x++) {
            for (let z = -3; z <= 3; z++) {
                this.voxelEngine.setVoxel(x, 0, z, VoxelType.GRASS);
            }
        }
        
        // Option 3: Just a few starter blocks
        // this.voxelEngine.setVoxel(0, 0, 0, VoxelType.GRASS);
        // this.voxelEngine.setVoxel(1, 0, 0, VoxelType.SAND);
        // this.voxelEngine.setVoxel(-1, 0, 0, VoxelType.DIRT);
        // this.voxelEngine.setVoxel(0, 0, 1, VoxelType.WATER);
        // this.voxelEngine.setVoxel(0, 0, -1, VoxelType.STONE);
        
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