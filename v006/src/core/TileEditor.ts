import * as THREE from 'three';
import { DimetricCamera } from '@core/Camera';
import { DimetricGrid } from '@core/DimetricGrid';
import { SimpleTileSystem } from '@core/SimpleTileSystem';
import { VoxelType } from '@core/VoxelTypes';
import { 
  EditorState, 
  EditorConfig, 
  EditorMode, 
  GridLevel, 
  TileRotation,
  WorldPosition,
  CoordinateUtils,
  GridCoordinate 
} from '../types';
import { InfoPanel } from '@ui/InfoPanel';
import { MinimapPanel } from '@ui/MinimapPanel';
import { TilePalette } from '@ui/TilePalette';
import { SHADOW_MAP_SIZE, MAX_PIXEL_RATIO } from '@core/constants';

/**
 * Main tile editor class
 * Coordinates all editor systems and handles user input
 */
export class TileEditor {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: DimetricCamera;
  private grid!: DimetricGrid;
  
  // Tile system
  private tileSystem!: SimpleTileSystem;
  private selectedVoxelType: VoxelType = VoxelType.Grass;
  
  // Editor state
  private state: EditorState;
  private config: EditorConfig;
  
  // Input handling
  private mouse: THREE.Vector2;
  private raycaster: THREE.Raycaster;
  private groundPlane: THREE.Plane;
  private isPanning: boolean = false;
  private isDrawing: boolean = false;
  private isErasing: boolean = false;
  private lastDrawnCell: GridCoordinate | null = null;
  
  // Animation
  private animationId: number | null = null;
  private clock: THREE.Clock;
  private frameCount: number = 0;
  private fpsTime: number = 0;
  
  // UI elements
  private coordinateDisplay: HTMLElement | null;
  private infoPanel: InfoPanel | null = null;
  private minimapPanel: MinimapPanel | null = null;
  private tilePalette: TilePalette | null = null;

  constructor(container: HTMLElement, config?: Partial<EditorConfig>) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    // Default configuration
    this.config = {
      defaultMode: EditorMode.Place, // Changed to Place mode by default
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
    
    // Initialize Three.js
    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initGrid();
    this.initTileSystem();
    this.initLighting();
    this.initEventListeners();
    
    // Defer UI panel creation to ensure StyleUI is ready
    requestAnimationFrame(() => {
      this.infoPanel = new InfoPanel(this.container, this);
      this.minimapPanel = new MinimapPanel(this.container, this);
      this.tilePalette = new TilePalette(this.container, this);
      
      // Give minimap access to tile system
      if (this.minimapPanel) {
        this.minimapPanel.setTileSystem(this.tileSystem);
      }
    });
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
    
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
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
    // Use dark theme background color
    this.scene.background = new THREE.Color(0x161614); // --bg-layer-4 dark theme
    
    // Add fog for depth
    this.scene.fog = new THREE.Fog(0x161614, 50, 200);
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
    this.grid = new DimetricGrid(this.scene);
    // Using default values from constants
    
    this.grid.setVisible(this.state.gridVisible);
  }

  /**
   * Initialize tile system
   */
  private initTileSystem(): void {
    this.tileSystem = new SimpleTileSystem(this.scene);
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
    directional.shadow.mapSize.width = SHADOW_MAP_SIZE;
    directional.shadow.mapSize.height = SHADOW_MAP_SIZE;
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
      
      // Handle continuous drawing/erasing while dragging
      // Additional check: ensure mouse buttons are actually pressed
      if ((this.isDrawing || this.isErasing) && this.state.highlightedCell && event.buttons > 0) {
        // Check if we've moved to a new cell
        if (!this.lastDrawnCell || !CoordinateUtils.coordsEqual(this.lastDrawnCell, this.state.highlightedCell)) {
          // Interpolate between last position and current to fill gaps
          if (this.lastDrawnCell) {
            this.drawLine(this.lastDrawnCell, this.state.highlightedCell, this.isDrawing);
          } else {
            // First cell
            if (this.isDrawing) {
              this.placeVoxel(this.state.highlightedCell);
            } else {
              this.removeVoxel(this.state.highlightedCell);
            }
          }
          this.lastDrawnCell = { ...this.state.highlightedCell };
        }
      } else if (event.buttons === 0) {
        // No buttons pressed - ensure drawing/erasing states are cleared
        this.isDrawing = false;
        this.isErasing = false;
        this.lastDrawnCell = null;
      }
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
      if (this.state.mode === EditorMode.Place && this.state.highlightedCell) {
        this.isDrawing = true;
        this.lastDrawnCell = { ...this.state.highlightedCell };
        this.placeVoxel(this.state.highlightedCell);
      } else if (this.state.mode === EditorMode.Erase && this.state.highlightedCell) {
        this.isErasing = true;
        this.lastDrawnCell = { ...this.state.highlightedCell };
        this.removeVoxel(this.state.highlightedCell);
      } else if (this.state.mode === EditorMode.Select) {
        // Handle selection
        this.handleLeftClick();
      }
    } else if (event.button === 2) { // Right mouse
      if (this.state.highlightedCell) {
        this.isErasing = true;
        this.lastDrawnCell = { ...this.state.highlightedCell };
        this.removeVoxel(this.state.highlightedCell);
      }
    }
  }

  /**
   * Handle mouse up
   */
  private onMouseUp(event: MouseEvent): void {
    // Always clear all drawing/erasing states on any mouse up to prevent stuck states
    this.isDrawing = false;
    this.isErasing = false;
    this.lastDrawnCell = null;
    
    // Handle specific button releases
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
    
    // Update mouse coordinates for world position calculation
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Get world position under mouse for zoom-to-mouse
    const worldPos = this.getMouseWorldPosition();
    
    // Use deltaY directly for smoother zooming
    const delta = event.deltaY;
    if (worldPos) {
      this.camera.zoom(delta, new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z));
    } else {
      this.camera.zoom(delta);
    }
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
      case 'q':
      case 'Q':
        this.cycleVoxelType();
        break;
      case '4':
        this.selectedVoxelType = VoxelType.Grass;
        console.log('Selected:', VoxelType[this.selectedVoxelType]);
        break;
      case '5':
        this.selectedVoxelType = VoxelType.Stone;
        console.log('Selected:', VoxelType[this.selectedVoxelType]);
        break;
      case '6':
        this.selectedVoxelType = VoxelType.Wood;
        console.log('Selected:', VoxelType[this.selectedVoxelType]);
        break;
      case '7':
        this.selectedVoxelType = VoxelType.Dirt;
        console.log('Selected:', VoxelType[this.selectedVoxelType]);
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
          const mode = this.state.mode === EditorMode.Place ? `Place ${VoxelType[this.selectedVoxelType]}` :
                      this.state.mode === EditorMode.Erase ? 'Erase' : 'Select';
          this.coordinateDisplay.textContent = `Grid: (${gridCoord.x}, ${gridCoord.z}) | Mode: ${mode}`;
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
        this.placeVoxel(this.state.highlightedCell);
        break;
      case EditorMode.Select:
        // TODO: Implement selection functionality
        console.log('Select tile at', this.state.highlightedCell);
        break;
    }
  }

  /**
   * Handle right click
   */
  private handleRightClick(): void {
    if (!this.state.highlightedCell) return;
    
    // Right click always removes voxels regardless of mode
    this.removeVoxel(this.state.highlightedCell);
  }

  /**
   * Place tile at grid position
   */
  private placeVoxel(gridCoord: GridCoordinate): void {
    // Only place if no tile exists at this position
    const existingTile = this.tileSystem.getTile(gridCoord);
    if (existingTile === VoxelType.Air) {
      this.tileSystem.placeTile(gridCoord, this.selectedVoxelType);
    }
  }

  /**
   * Remove tile at grid position
   */
  private removeVoxel(gridCoord: GridCoordinate): void {
    this.tileSystem.removeTile(gridCoord);
  }
  
  /**
   * Draw a line of tiles between two grid coordinates
   */
  private drawLine(from: GridCoordinate, to: GridCoordinate, place: boolean): void {
    // Bresenham's line algorithm for grid coordinates
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.z - from.z);
    const sx = from.x < to.x ? 1 : -1;
    const sy = from.z < to.z ? 1 : -1;
    let err = dx - dy;
    
    let x = from.x;
    let z = from.z;
    
    // Draw tiles along the line
    while (true) {
      if (place) {
        this.placeVoxel({ x, z });
      } else {
        this.removeVoxel({ x, z });
      }
      
      // Check if we've reached the end
      if (x === to.x && z === to.z) break;
      
      // Calculate next position
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        z += sy;
      }
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
   * Cycle through available voxel types
   */
  private cycleVoxelType(): void {
    const voxelTypes = [
      VoxelType.Grass,
      VoxelType.Dirt,
      VoxelType.Stone,
      VoxelType.Wood,
      VoxelType.Sand,
      VoxelType.Brick,
      VoxelType.Metal,
      VoxelType.Glass
    ];
    
    const currentIndex = voxelTypes.indexOf(this.selectedVoxelType);
    const nextIndex = (currentIndex + 1) % voxelTypes.length;
    this.selectedVoxelType = voxelTypes[nextIndex]!;
    
    console.log('Selected voxel type:', VoxelType[this.selectedVoxelType]);
    
    // Update coordinate display to show voxel type
    if (this.coordinateDisplay) {
      this.coordinateDisplay.textContent = `Grid: (${this.state.highlightedCell?.x || 0}, ${this.state.highlightedCell?.z || 0}) | Voxel: ${VoxelType[this.selectedVoxelType]}`;
    }
  }

  /**
   * Update editor state
   */
  private setState(partial: Partial<EditorState>): void {
    this.state = { ...this.state, ...partial };
  }
  
  /**
   * Set editor mode (called by TilePalette)
   */
  public setMode(mode: EditorMode): void {
    this.setState({ mode });
  }
  
  /**
   * Set selected voxel type (called by TilePalette)
   */
  public setSelectedVoxelType(type: VoxelType): void {
    this.selectedVoxelType = type;
  }

  /**
   * Main animation loop
   */
  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    
    // Update FPS
    this.updateFPS(delta);
    
    // No need to update tile system - it's immediate
    
    // Update UI panels
    if (this.infoPanel) {
      this.infoPanel.update();
    }
    if (this.minimapPanel) {
      this.minimapPanel.update();
    }
    
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
      // FPS is now tracked by info panel
      this.frameCount = 0;
      this.fpsTime = 0;
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
    this.tileSystem.dispose();
    this.renderer.dispose();
    
    // Dispose of UI elements
    if (this.infoPanel) {
      this.infoPanel.dispose();
    }
    if (this.minimapPanel) {
      this.minimapPanel.dispose();
    }
    if (this.tilePalette) {
      this.tilePalette.dispose();
    }
    
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
  
  /**
   * Get renderer (for info panel)
   */
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
  
  /**
   * Get tile system (for direct access in stress test)
   */
  public getTileSystem(): SimpleTileSystem {
    return this.tileSystem;
  }
}