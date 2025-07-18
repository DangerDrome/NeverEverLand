import * as THREE from 'three';
import { DimetricCamera } from '@core/Camera';
import { DimetricGrid } from '@core/DimetricGrid';
import { 
  EditorState, 
  EditorConfig, 
  EditorMode, 
  GridLevel, 
  TileRotation,
  GridCoordinate,
  WorldPosition,
  CoordinateUtils 
} from '@types';
import { CameraTest } from './debug/CameraTest';

/**
 * Main tile editor class
 * Coordinates all editor systems and handles user input
 */
export class TileEditor {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: DimetricCamera;
  private grid: DimetricGrid;
  
  // Editor state
  private state: EditorState;
  private config: EditorConfig;
  
  // Input handling
  private mouse: THREE.Vector2;
  private raycaster: THREE.Raycaster;
  private groundPlane: THREE.Plane;
  private isPanning: boolean = false;
  
  // Animation
  private animationId: number | null = null;
  private clock: THREE.Clock;
  private fps: number = 0;
  private frameCount: number = 0;
  private fpsTime: number = 0;
  
  // UI elements
  private coordinateDisplay: HTMLElement | null;
  private fpsDisplay: HTMLElement | null;

  constructor(container: HTMLElement, config?: Partial<EditorConfig>) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    // Default configuration
    this.config = {
      defaultMode: EditorMode.Select,
      showGrid: true,
      defaultGridLevel: GridLevel.Standard,
      enableShortcuts: true,
      showCoordinates: true,
      showFPS: true,
      ...config,
    };
    
    // Initial state
    this.state = {
      mode: this.config.defaultMode,
      selectedTileId: null,
      gridVisible: this.config.showGrid,
      gridLevel: this.config.defaultGridLevel,
      rotation: TileRotation.Deg0,
      highlightedCell: null,
      cameraZoom: 20,
    };
    
    // Get UI elements
    this.coordinateDisplay = document.getElementById('coordinates');
    this.fpsDisplay = document.getElementById('fps-counter');
    
    // Initialize Three.js
    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initGrid();
    this.initLighting();
    this.initEventListeners();
    
    // Add debug test scene (temporary)
    if (window.location.hash === '#debug') {
      CameraTest.createTestScene(this.scene);
      const ratios = CameraTest.calculateDimetricRatios();
      console.log('Dimetric ratios:', ratios);
    }
  }

  /**
   * Initialize WebGL renderer
   */
  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.container.appendChild(this.renderer.domElement);
    
    // Set size after appending to DOM
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  /**
   * Initialize Three.js scene
   */
  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2a2a);
    
    // Add fog for depth
    this.scene.fog = new THREE.Fog(0x2a2a2a, 50, 200);
  }

  /**
   * Initialize dimetric camera
   */
  private initCamera(): void {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new DimetricCamera(aspect, this.state.cameraZoom);
  }

  /**
   * Initialize grid system
   */
  private initGrid(): void {
    this.grid = new DimetricGrid(this.scene, {
      cellSize: 1,
      gridWidth: 100,
      gridDepth: 100,
    });
    
    this.grid.setVisible(this.state.gridVisible);
  }

  /**
   * Initialize scene lighting
   */
  private initLighting(): void {
    // Ambient light for overall illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    
    // Directional light for shadows and depth
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 5);
    directional.castShadow = true;
    
    // Configure shadow properties
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.camera.near = 0.1;
    directional.shadow.camera.far = 50;
    directional.shadow.camera.left = -20;
    directional.shadow.camera.right = 20;
    directional.shadow.camera.top = 20;
    directional.shadow.camera.bottom = -20;
    
    this.scene.add(directional);
  }

  /**
   * Initialize event listeners
   */
  private initEventListeners(): void {
    // Mouse events
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.renderer.domElement.addEventListener('wheel', this.onWheel.bind(this));
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Keyboard events
    if (this.config.enableShortcuts) {
      window.addEventListener('keydown', this.onKeyDown.bind(this));
    }
    
    // Window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * Handle mouse movement
   */
  private onMouseMove(event: MouseEvent): void {
    // Handle camera panning first
    if (event.buttons === 4) { // Middle mouse button
      this.camera.updatePan(event.clientX, event.clientY);
      // Don't update anything else during panning
      return;
    }
    
    // Update mouse coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Only update grid highlight when not panning
    if (!this.isPanning) {
      this.updateGridHighlight();
    }
  }

  /**
   * Handle mouse down
   */
  private onMouseDown(event: MouseEvent): void {
    if (event.button === 1) { // Middle mouse
      this.isPanning = true;
      this.camera.startPan(event.clientX, event.clientY);
      event.preventDefault();
    } else if (event.button === 0) { // Left mouse
      // Handle tile placement/selection
      this.handleLeftClick();
    } else if (event.button === 2) { // Right mouse
      // Handle tile removal/context menu
      this.handleRightClick();
    }
  }

  /**
   * Handle mouse up
   */
  private onMouseUp(event: MouseEvent): void {
    if (event.button === 1) { // Middle mouse
      this.isPanning = false;
      this.camera.endPan();
    }
  }

  /**
   * Handle mouse wheel
   */
  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    // Use deltaY directly for smoother zooming
    const delta = event.deltaY;
    this.camera.zoom(delta);
    this.state.cameraZoom = this.camera.getZoomLevel();
    
    // Update grid opacity based on zoom
    this.grid.updateOpacity(this.state.cameraZoom);
  }

  /**
   * Handle keyboard input
   */
  private onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'g':
      case 'G':
        this.toggleGrid();
        break;
      case '1':
        this.setState({ mode: EditorMode.Select });
        break;
      case '2':
        this.setState({ mode: EditorMode.Place });
        break;
      case '3':
        this.setState({ mode: EditorMode.Erase });
        break;
      case 'r':
      case 'R':
        this.rotateTile();
        break;
    }
  }

  /**
   * Handle window resize
   */
  private onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.updateAspectRatio(width / height);
    this.renderer.setSize(width, height);
  }

  /**
   * Update grid highlight based on mouse position
   */
  private updateGridHighlight(): void {
    const worldPos = this.getMouseWorldPosition();
    if (worldPos) {
      const gridCoord = CoordinateUtils.worldToGrid(worldPos);
      
      // Update highlighted cell
      if (!this.state.highlightedCell || !CoordinateUtils.coordsEqual(this.state.highlightedCell, gridCoord)) {
        this.state.highlightedCell = gridCoord;
        this.grid.highlightCell(gridCoord);
        
        // Update coordinate display
        if (this.coordinateDisplay && this.config.showCoordinates) {
          this.coordinateDisplay.textContent = `Grid: (${gridCoord.x}, ${gridCoord.z})`;
        }
      }
    } else {
      this.grid.clearHighlight();
      this.state.highlightedCell = null;
    }
  }

  /**
   * Get mouse position in world space
   */
  private getMouseWorldPosition(): WorldPosition | null {
    // Ensure camera matrices are up to date
    const cam = this.camera.getCamera();
    cam.updateMatrixWorld(true);
    
    this.raycaster.setFromCamera(this.mouse, cam);
    
    const intersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, intersection)) {
      return {
        x: intersection.x,
        y: intersection.y,
        z: intersection.z,
      };
    }
    
    return null;
  }

  /**
   * Handle left click
   */
  private handleLeftClick(): void {
    if (!this.state.highlightedCell) return;
    
    switch (this.state.mode) {
      case EditorMode.Place:
        // TODO: Place tile at highlighted position
        console.log('Place tile at', this.state.highlightedCell);
        break;
      case EditorMode.Select:
        // TODO: Select tile at position
        console.log('Select tile at', this.state.highlightedCell);
        break;
    }
  }

  /**
   * Handle right click
   */
  private handleRightClick(): void {
    if (!this.state.highlightedCell) return;
    
    if (this.state.mode === EditorMode.Erase) {
      // TODO: Remove tile at position
      console.log('Remove tile at', this.state.highlightedCell);
    }
  }

  /**
   * Toggle grid visibility
   */
  private toggleGrid(): void {
    this.state.gridVisible = !this.state.gridVisible;
    this.grid.setVisible(this.state.gridVisible);
  }

  /**
   * Rotate tile
   */
  private rotateTile(): void {
    const rotations = [
      TileRotation.Deg0,
      TileRotation.Deg90,
      TileRotation.Deg180,
      TileRotation.Deg270,
    ];
    
    const currentIndex = rotations.indexOf(this.state.rotation);
    const nextIndex = (currentIndex + 1) % rotations.length;
    this.state.rotation = rotations[nextIndex]!;
    
    console.log('Rotation:', this.state.rotation);
  }

  /**
   * Update editor state
   */
  private setState(partial: Partial<EditorState>): void {
    this.state = { ...this.state, ...partial };
  }

  /**
   * Main animation loop
   */
  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    
    // Update FPS
    this.updateFPS(delta);
    
    // Render scene
    this.renderer.render(this.scene, this.camera.getCamera());
  }

  /**
   * Update FPS counter
   */
  private updateFPS(delta: number): void {
    this.frameCount++;
    this.fpsTime += delta;
    
    if (this.fpsTime >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTime = 0;
      
      if (this.fpsDisplay && this.config.showFPS) {
        this.fpsDisplay.textContent = `FPS: ${this.fps}`;
      }
    }
  }

  /**
   * Start the editor
   */
  public start(): void {
    // Force initial camera update before starting render loop
    this.camera.getCamera().updateMatrixWorld(true);
    this.camera.getCamera().updateProjectionMatrix();
    
    // Initial render to ensure everything is set up
    this.renderer.render(this.scene, this.camera.getCamera());
    
    // Start animation loop
    this.animate();
  }

  /**
   * Stop the editor
   */
  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.stop();
    
    // Dispose of Three.js resources
    this.grid.dispose();
    this.renderer.dispose();
    
    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    if (this.config.enableShortcuts) {
      window.removeEventListener('keydown', this.onKeyDown.bind(this));
    }
  }

  /**
   * Get current editor state
   */
  public getState(): Readonly<EditorState> {
    return this.state;
  }

  /**
   * Get Three.js scene (for extensions)
   */
  public getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get camera controller
   */
  public getCamera(): DimetricCamera {
    return this.camera;
  }
}