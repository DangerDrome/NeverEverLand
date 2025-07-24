import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { DimetricCamera } from '@core/Camera';
import { DimetricGrid } from '@core/DimetricGrid';
import { SimpleTileSystem } from '@core/SimpleTileSystem';
import { VoxelType, VOXEL_PROPERTIES } from '@core/VoxelTypes';
import { globalConfig } from '../config/globalConfig';
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
import { SunControlPanel } from '@ui/SunControlPanel';
import { SHADOW_MAP_SIZE, MAX_PIXEL_RATIO } from '@core/constants';
import { isMobile, isTouchDevice } from '../utils/mobile';
import { TiltShiftPass } from '@core/TiltShiftPass';
import { GammaPass } from '@core/GammaPass';
import { BloomPass } from '@core/BloomPass';
import { EffectsPanel } from '@ui/EffectsPanel';

/**
 * Action types for undo/redo system
 */
enum ActionType {
  PLACE = 'PLACE',
  REMOVE = 'REMOVE'
}

/**
 * Represents a single tile in a layer
 */
interface TileData {
  type: VoxelType;
  layer: number;
}

/**
 * Represents an action that can be undone/redone
 */
interface EditorAction {
  type: ActionType;
  coord: GridCoordinate;
  // For PLACE actions: what was placed and what was there before
  placedTiles?: TileData[];
  removedTiles?: TileData[];
  // For context
  stackMode?: boolean;
  voxelType?: VoxelType;
}

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
  
  // Post-processing
  private composer!: EffectComposer;
  private ssaoPass!: SSAOPass;
  private tiltShiftPass!: TiltShiftPass;
  private gammaPass!: GammaPass;
  private bloomPass!: BloomPass;
  private aoEnabled: boolean = false; // Will be set from config
  private tiltShiftEnabled: boolean = false;
  private gammaEnabled: boolean = false;
  private bloomEnabled: boolean = false;
  
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
  
  // Performance optimization
  private isInteracting: boolean = false;
  private interactionTimeout: number | null = null;
  
  // Animation
  private animationId: number | null = null;
  private clock: THREE.Clock;
  private frameCount: number = 0;
  private fpsTime: number = 0;
  private uiUpdateTime: number = 0;
  private UI_UPDATE_INTERVAL: number = 1000 / 30; // Will be updated from config
  
  // Placement mode
  private stackMode: boolean = true;
  private tileSize: number = 0.1;
  
  // Sky system
  private skyEnabled: boolean = false;
  private sunMesh: THREE.Mesh | null = null;
  private skyGradientTexture: THREE.Texture | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private secondaryLight: THREE.DirectionalLight | null = null;
  private lastSunPosition: THREE.Vector3 = new THREE.Vector3();
  
  // UI elements
  private coordinateDisplay: HTMLElement | null;
  private infoPanel: InfoPanel | null = null;
  private minimapPanel: MinimapPanel | null = null;
  private tilePalette: TilePalette | null = null;
  private sunControlPanel: SunControlPanel | null = null;
  private effectsPanel: EffectsPanel | null = null;
  
  // Preview
  private previewMesh: THREE.Mesh | null = null;
  private previewMaterial: THREE.Material | null = null;
  
  // Undo/Redo system
  private undoStack: EditorAction[] = [];
  private redoStack: EditorAction[] = [];
  private maxHistorySize: number = 50;

  private replaceMode: boolean = false;

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
      cameraZoom: 6, // Start zoomed in close to the action
    };
    
    // Apply config settings
    const cfg = globalConfig.getConfig();
    this.UI_UPDATE_INTERVAL = 1000 / cfg.uiUpdateRate;
    
    // Get UI elements
    this.coordinateDisplay = document.getElementById('coordinates');
    
    // Initialize Three.js
    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initGrid();
    this.initTileSystem();
    this.initLighting();
    this.initPostProcessing();
    this.initEventListeners();
    
    // Defer UI panel creation to ensure StyleUI is ready
    requestAnimationFrame(() => {
      // Always create tile palette
      this.tilePalette = new TilePalette(this.container, this);
      
      // Only create desktop panels if not on mobile
      if (!isMobile()) {
        this.infoPanel = new InfoPanel(this.container, this);
        this.minimapPanel = new MinimapPanel(this.container, this);
        this.sunControlPanel = new SunControlPanel(this.container, this);
        this.effectsPanel = new EffectsPanel(this.container, this);
        
        // Give minimap access to tile system
        if (this.minimapPanel) {
          this.minimapPanel.setTileSystem(this.tileSystem);
        }
        
        // Sun control panel is visible on desktop
        if (this.sunControlPanel) {
          this.sunControlPanel.setVisible(true);
        }
      }
    });
  }

  /**
   * Initialize WebGL renderer
   */
  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Disable for better performance
      alpha: true,
      powerPreference: 'high-performance',
    });
    
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows for more realism
    
    this.container.appendChild(this.renderer.domElement);
    
    // Set size after appending to DOM
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  /**
   * Initialize Three.js scene
   */
  private initScene(): void {
    this.scene = new THREE.Scene();
    // Use dark theme background color by default
    this.scene.background = new THREE.Color(0x161614); // --bg-layer-4 dark theme
    
    // Add fog for depth
    this.scene.fog = new THREE.Fog(0x161614, 50, 200);
    
    // Create gradient texture for sky
    this.createSkyGradient();
  }
  
  /**
   * Create sky gradient texture
   */
  private createSkyGradient(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    
    // Sky blue to lighter blue gradient
    gradient.addColorStop(0, '#E0F6FF'); // Light blue at top
    gradient.addColorStop(0.4, '#87CEEB'); // Sky blue
    gradient.addColorStop(1, '#B0E0E6'); // Powder blue at horizon
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1, 256);
    
    this.skyGradientTexture = new THREE.CanvasTexture(canvas);
    this.skyGradientTexture.needsUpdate = true;
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
    this.initPreview();
  }
  
  /**
   * Initialize preview mesh
   */
  private initPreview(): void {
    // Create semi-transparent preview material with contrasting cyan color
    this.previewMaterial = new THREE.MeshPhongMaterial({
      color: 0x00FFFF, // Bright cyan for visibility
      transparent: true,
      opacity: 0.5,
      emissive: 0x444444,
      emissiveIntensity: 0.3,
    });
    
    // Create preview mesh (uses current tile size)
    const geometry = new THREE.BoxGeometry(this.tileSize, 0.1, this.tileSize);
    this.previewMesh = new THREE.Mesh(geometry, this.previewMaterial);
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);
  }

  /**
   * Initialize scene lighting
   */
  private initLighting(): void {
    // Ambient light for overall illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.3); // Lower ambient for more dramatic lighting
    this.scene.add(ambient);
    
    // Primary directional light (main sun shadow)
    this.directionalLight = new THREE.DirectionalLight(0xffeeaa, 1.4); // Warmer color and higher intensity
    this.directionalLight.position.set(5, 10, 5);
    this.directionalLight.castShadow = true;
    
    // Primary shadow properties - cover full grid area
    const cfg = globalConfig.getConfig();
    this.directionalLight.shadow.mapSize.width = cfg.shadowMapSize;
    this.directionalLight.shadow.mapSize.height = cfg.shadowMapSize;
    this.directionalLight.shadow.camera.near = 1;
    this.directionalLight.shadow.camera.far = 100;
    this.directionalLight.shadow.camera.left = -60;
    this.directionalLight.shadow.camera.right = 60;
    this.directionalLight.shadow.camera.top = 60;
    this.directionalLight.shadow.camera.bottom = -60;
    this.directionalLight.shadow.bias = -0.0005;
    
    this.scene.add(this.directionalLight);
    
    // Secondary directional light (softer fill shadow) - only if enabled
    if (cfg.secondaryShadows) {
      this.secondaryLight = new THREE.DirectionalLight(0x88ccff, 0.2); // Cool blue fill light
      this.secondaryLight.position.set(-3, 8, -3); // Opposite angle
      this.secondaryLight.castShadow = true;
    
    // Secondary shadow properties (smaller for performance but still cover grid)
    this.secondaryLight.shadow.mapSize.width = 512; // Smaller for performance
    this.secondaryLight.shadow.mapSize.height = 512;
    this.secondaryLight.shadow.camera.near = 1;
    this.secondaryLight.shadow.camera.far = 80;
    this.secondaryLight.shadow.camera.left = -50;
    this.secondaryLight.shadow.camera.right = 50;
    this.secondaryLight.shadow.camera.top = 50;
    this.secondaryLight.shadow.camera.bottom = -50;
    this.secondaryLight.shadow.bias = -0.001;
      
      this.scene.add(this.secondaryLight);
    }
    
    // Create sun
    this.createSun();
  }
  
  /**
   * Create sun mesh
   */
  private createSun(): void {
    // Create sun geometry
    const sunGeometry = new THREE.SphereGeometry(2, 16, 16);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFD700, // Gold color
    });
    
    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunMesh.position.set(30, 60, 30); // Higher and further for better shadows
    this.sunMesh.visible = false; // Hidden by default
    
    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(2.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFAA,
      transparent: true,
      opacity: 0.3,
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.sunMesh.add(glowMesh);
    
    this.scene.add(this.sunMesh);
  }
  
  /**
   * Initialize post-processing effects
   */
  private initPostProcessing(): void {
    const cfg = globalConfig.getConfig();
    this.aoEnabled = cfg.ambientOcclusionEnabled;
    this.tiltShiftEnabled = false; // Start disabled
    this.gammaEnabled = false;
    this.bloomEnabled = false;
    
    if (!cfg.postProcessingEnabled) {
      return; // Skip post-processing setup entirely
    }
    
    try {
      // Create effect composer
      this.composer = new EffectComposer(this.renderer);
      
      // Add render pass
      const renderPass = new RenderPass(this.scene, this.camera.getCamera());
      this.composer.addPass(renderPass);
      
      // Add SSAO pass with optimized settings
      if (this.aoEnabled) {
        this.ssaoPass = new SSAOPass(this.scene, this.camera.getCamera());
        this.ssaoPass.kernelRadius = 8; // Smaller radius for performance
        this.ssaoPass.minDistance = 0.01;
        this.ssaoPass.maxDistance = 0.1; // Short range for better performance
        this.ssaoPass.output = SSAOPass.OUTPUT.Default;
        this.composer.addPass(this.ssaoPass);
      }
      
      // Add tilt-shift pass
      this.tiltShiftPass = new TiltShiftPass(
        this.container.clientWidth,
        this.container.clientHeight
      );
      this.tiltShiftPass.enabled = this.tiltShiftEnabled;
      this.composer.addPass(this.tiltShiftPass);

      // Add Bloom pass (before gamma for better results)
      this.bloomPass = new BloomPass(this.container.clientWidth, this.container.clientHeight);
      this.bloomPass.enabled = this.bloomEnabled;
      this.composer.addPass(this.bloomPass);

      // Add Gamma pass (should be last to adjust final output)
      this.gammaPass = new GammaPass();
      this.gammaPass.enabled = this.gammaEnabled;
      this.composer.addPass(this.gammaPass);
      
      // Set composer size
      this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
      
      console.log('Post-processing initialized successfully');
    } catch (error) {
      console.warn('Post-processing failed to initialize, falling back to direct rendering:', error);
      this.aoEnabled = false; // Disable AO if initialization failed
      this.tiltShiftEnabled = false;
      this.gammaEnabled = false;
      this.bloomEnabled = false;
    }
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
    
    // Touch events for mobile
    if (isTouchDevice()) {
      this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this));
      this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));
      this.renderer.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));
    }
    
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
      this.startInteraction();
      this.camera.updatePan(event.clientX, event.clientY);
      // Don't update anything else during panning
      return;
    }
    
    // Update mouse coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Only update grid highlight when not panning and not interacting
    if (!this.isPanning && !this.isInteracting) {
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
      this.startInteraction();
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
      this.endInteraction();
    }
  }

  /**
   * Handle mouse wheel
   */
  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.startInteraction();
    
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
    
    // Update grid opacity based on zoom (only when not interacting for performance)
    if (!this.isInteracting) {
      this.grid.updateOpacity(this.state.cameraZoom);
    }
    
    this.endInteraction();
  }

  // Touch event properties for mobile
  private touchStartData: { x: number; y: number; time: number } | null = null;
  private lastTouchDistance: number = 0;
  private touchPanning: boolean = false;

  /**
   * Handle touch start
   */
  private onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    if (event.touches.length === 1) {
      // Single touch - for drawing (placing/erasing)
      const touch = event.touches[0];
      this.touchStartData = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      
      // Update mouse position for highlighting
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
      this.updateGridHighlight();
      
      // Start drawing immediately if in place or erase mode
      if (this.state.highlightedCell && (this.state.mode === EditorMode.Place || this.state.mode === EditorMode.Erase)) {
        if (this.state.mode === EditorMode.Place) {
          this.placeVoxel(this.state.highlightedCell);
        } else if (this.state.mode === EditorMode.Erase) {
          this.removeVoxel(this.state.highlightedCell);
        }
      }
    } else if (event.touches.length === 2) {
      // Two touches - for panning
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      // Store center point for panning
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      this.touchStartData = {
        x: centerX,
        y: centerY,
        time: Date.now()
      };
      this.touchPanning = true;
      this.startInteraction();
      this.camera.startPan(centerX, centerY);
      
      // Also store distance for pinch zoom
      this.lastTouchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    }
  }

  /**
   * Handle touch move
   */
  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    if (event.touches.length === 1 && this.touchStartData && !this.touchPanning) {
      // Single touch - continue drawing
      const touch = event.touches[0];
      
      // Update mouse position
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
      this.updateGridHighlight();
      
      // Continue drawing if in place or erase mode
      if (this.state.highlightedCell && (this.state.mode === EditorMode.Place || this.state.mode === EditorMode.Erase)) {
        if (this.state.mode === EditorMode.Place) {
          this.placeVoxel(this.state.highlightedCell);
        } else if (this.state.mode === EditorMode.Erase) {
          this.removeVoxel(this.state.highlightedCell);
        }
      }
    } else if (event.touches.length === 2) {
      // Two touches - pan and pinch zoom
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      // Calculate center point for panning
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      if (this.touchPanning && this.touchStartData) {
        this.camera.updatePan(centerX, centerY);
      }
      
      // Handle pinch zoom
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (this.lastTouchDistance > 0) {
        const delta = (this.lastTouchDistance - distance) * 3; // Scale factor for touch zoom
        this.startInteraction();
        this.camera.zoom(delta);
        this.state.cameraZoom = this.camera.getZoomLevel();
      }
      
      this.lastTouchDistance = distance;
    }
  }

  /**
   * Handle touch end
   */
  private onTouchEnd(event: TouchEvent): void {
    // Reset touch state
    this.touchStartData = null;
    this.touchPanning = false;
    this.lastTouchDistance = 0;
    this.endInteraction();
  }

  /**
   * Handle keyboard input
   */
  private onKeyDown(event: KeyboardEvent): void {
    // Handle Ctrl+Z for undo and Ctrl+Y for redo
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'z':
          if (event.shiftKey) {
            // Ctrl+Shift+Z = Redo (alternative)
            this.redo();
          } else {
            // Ctrl+Z = Undo
            this.undo();
          }
          event.preventDefault();
          return;
        case 'y':
          // Ctrl+Y = Redo
          this.redo();
          event.preventDefault();
          return;
      }
    }
    
    switch (event.key) {
      case 'g':
      case 'G':
        this.toggleGrid();
        break;
      case '1':
        this.setState({ mode: EditorMode.Place });
        break;
      case '2':
        this.setState({ mode: EditorMode.Select });
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
      case 'o':
      case 'O':
        this.toggleAmbientOcclusion();
        break;
      case 't':
      case 'T':
        this.toggleTiltShift();
        break;
      case 'p':
      case 'P':
        this.toggleGamma();
        break;
      case 'b':
      case 'B':
        this.toggleBloom();
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
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.tiltShiftPass) {
      this.tiltShiftPass.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.setSize(width, height);
    }
  }

  /**
   * Update grid highlight based on mouse position
   */
  private updateGridHighlight(): void {
    const worldPos = this.getMouseWorldPosition();
    if (worldPos) {
      // Use tile size as grid cell size for snapping
      const gridCoord = CoordinateUtils.worldToGrid(worldPos, this.tileSize);
      
      // Always update preview position for perfect mouse alignment
      if (this.previewMesh && this.state.mode === EditorMode.Place) {
        // Calculate which layer the voxel will be placed at based on current mode settings
        let targetLayer = 0;
        const shouldStackOnTop = !this.replaceMode && this.stackMode;
        
        if (this.replaceMode) {
          // Replace mode: place at layer 0
          targetLayer = 0;
        } else if (shouldStackOnTop) {
          // Stack mode: place on top of existing tiles
          const topLayer = this.tileSystem.getTopLayer(gridCoord);
          targetLayer = topLayer + 1;
        } else {
          // No stack, no replace: place at layer 0
          targetLayer = 0;
        }
        
        // Position preview using the same logic as actual tile placement
        const layerHeight = 0.1; // Same as SimpleTileSystem.layerHeight
        const actualYPos = layerHeight / 2 + (targetLayer * layerHeight);
        
        // Clamp preview Y position to stay close to mouse cursor for better UX
        // If the actual placement would be more than 2 units above mouse intersection, 
        // show preview closer to mouse but with reduced opacity to indicate it's not the real position
        const maxYOffset = 2.0; // Maximum distance above mouse intersection
        const mouseY = worldPos.y; // This is typically 0 from ground plane intersection
        const clampedYPos = Math.min(actualYPos, mouseY + maxYOffset);
        const isPreviewClamped = clampedYPos < actualYPos;
        
        this.previewMesh.position.set(
          gridCoord.x * this.tileSize + this.tileSize * 0.5,
          clampedYPos,
          gridCoord.z * this.tileSize + this.tileSize * 0.5
        );
        this.previewMesh.visible = true;
        
        // Update preview color and opacity based on whether it's clamped
        if (this.previewMaterial) {
          (this.previewMaterial as THREE.MeshPhongMaterial).color.setHex(0x00FFFF); // Bright cyan for visibility
          // Reduce opacity if preview is clamped to indicate it's not the exact position
          (this.previewMaterial as THREE.MeshPhongMaterial).opacity = isPreviewClamped ? 0.3 : 0.5;
        }
      } else if (this.previewMesh) {
        this.previewMesh.visible = false;
      }
      
      // Update highlighted cell
      if (!this.state.highlightedCell || !CoordinateUtils.coordsEqual(this.state.highlightedCell, gridCoord)) {
        this.state.highlightedCell = gridCoord;
        this.grid.highlightCell(gridCoord, this.tileSize);
        
        // Update height display for preview
        this.updateHeightDisplay(gridCoord);
      }
    } else {
      this.grid.clearHighlight();
      this.state.highlightedCell = null;
      
      // Hide preview
      if (this.previewMesh) {
        this.previewMesh.visible = false;
      }
    }
    
    // Update coordinate display with height
    if (this.coordinateDisplay && this.config.showCoordinates && this.state.highlightedCell) {
      const mode = this.state.mode === EditorMode.Place ? `Place ${VoxelType[this.selectedVoxelType]}` :
                  this.state.mode === EditorMode.Erase ? 'Erase' : 'Select';
      const baseHeight = this.tileSystem.getBaseWorldHeight(this.state.highlightedCell, this.tileSize);
      const subGridPos = `(${(this.state.highlightedCell.x * this.tileSize).toFixed(2)}, ${(this.state.highlightedCell.z * this.tileSize).toFixed(2)})`;
      
      // Update coordinate display (first child)
      const coordElement = this.coordinateDisplay.children[0] as HTMLElement;
      if (coordElement) {
        coordElement.textContent = `Sub-Grid: ${subGridPos} | Height: ${baseHeight.toFixed(1)}m | Mode: ${mode}`;
      }
      
      // Update voxel count display (second child)
      const voxelCountElement = this.coordinateDisplay.children[1] as HTMLElement;
      if (voxelCountElement) {
        const voxelCount = this.tileSystem.getAllTiles().size;
        voxelCountElement.textContent = `Voxels: ${voxelCount}`;
      }
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
    // Capture state before placing
    const beforeState = this.captureTileState(gridCoord);
    
    // Place based on replace mode and stack mode
    // If replace mode is enabled, don't stack on top (replace existing)
    // If stack mode is enabled and replace mode is disabled, stack on top
    const shouldStackOnTop = !this.replaceMode && this.stackMode;
    this.tileSystem.placeTile(gridCoord, this.selectedVoxelType, shouldStackOnTop, this.replaceMode);
    
    // Capture state after placing
    const afterState = this.captureTileState(gridCoord);
    
    // Record action for undo/redo
    const action: EditorAction = {
      type: ActionType.PLACE,
      coord: { ...gridCoord },
      placedTiles: afterState,
      removedTiles: beforeState,
      stackMode: this.stackMode,
      voxelType: this.selectedVoxelType
    };
    this.recordAction(action);
    
    // Update height display
    this.updateHeightDisplay(gridCoord);
  }

  /**
   * Remove tile at grid position
   */
  private removeVoxel(gridCoord: GridCoordinate): void {
    // Capture state before removing
    const beforeState = this.captureTileState(gridCoord);
    
    // Only record action if there was something to remove
    if (beforeState.length > 0) {
      this.tileSystem.removeTile(gridCoord);
      
      // Record action for undo/redo
      const action: EditorAction = {
        type: ActionType.REMOVE,
        coord: { ...gridCoord },
        removedTiles: beforeState
      };
      this.recordAction(action);
    }
    
    // Update height display
    this.updateHeightDisplay(gridCoord);
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
    
    // Update coordinate display to show voxel type and height
    if (this.coordinateDisplay && this.state.highlightedCell) {
      const height = this.tileSystem.getWorldHeight(this.state.highlightedCell);
      
      // Update coordinate display (first child)
      const coordElement = this.coordinateDisplay.children[0] as HTMLElement;
      if (coordElement) {
        coordElement.textContent = `Grid: (${this.state.highlightedCell.x}, ${this.state.highlightedCell.z}) | Height: ${height.toFixed(1)}m | Voxel: ${VoxelType[this.selectedVoxelType]}`;
      }
      
      // Update voxel count display (second child)
      const voxelCountElement = this.coordinateDisplay.children[1] as HTMLElement;
      if (voxelCountElement) {
        const voxelCount = this.tileSystem.getAllTiles().size;
        voxelCountElement.textContent = `Voxels: ${voxelCount}`;
      }
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
    
    // Update preview color to use contrasting color for visibility
    if (this.previewMesh && this.previewMaterial) {
      (this.previewMaterial as THREE.MeshPhongMaterial).color.setHex(0x00FFFF); // Bright cyan for visibility
    }
  }
  
  /**
   * Set stack mode (called by TilePalette)
   */
  public setStackMode(enabled: boolean): void {
    this.stackMode = enabled;
    console.log('Stack mode:', enabled ? 'ON' : 'OFF');
  }
  
  /**
   * Set tile size (called by TilePalette)
   */
  public setTileSize(size: number): void {
    this.tileSize = size;
    this.tileSystem.setTileSize(size);
    this.updatePreviewGeometry();
    console.log('Tile size:', size.toFixed(1) + 'x' + size.toFixed(1));
  }
  
  /**
   * Update preview mesh geometry to match current tile size
   */
  private updatePreviewGeometry(): void {
    if (this.previewMesh) {
      // Dispose old geometry
      this.previewMesh.geometry.dispose();
      
      // Create new geometry with current tile size
      this.previewMesh.geometry = new THREE.BoxGeometry(this.tileSize, 0.1, this.tileSize);
    }
  }
  
  /**
   * Get current tile size
   */
  public getTileSize(): number {
    return this.tileSize;
  }
  
  /**
   * Start interaction (panning/zooming) - disable expensive operations
   */
  private startInteraction(): void {
    this.isInteracting = true;
    
    // Clear any existing timeout
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
    }
  }
  
  /**
   * End interaction - re-enable expensive operations after delay
   */
  private endInteraction(): void {
    // Clear any existing timeout
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
    }
    
    // Set timeout to end interaction after 100ms of inactivity
    this.interactionTimeout = window.setTimeout(() => {
      this.isInteracting = false;
      // Update grid opacity when interaction ends
      this.grid.updateOpacity(this.state.cameraZoom);
    }, 100);
  }
  
  /**
   * Clear all tiles
   */
  public clearAllTiles(): void {
    this.tileSystem.clear();
    console.log('All tiles cleared');
    // Clear undo/redo history since all context is lost
    this.undoStack = [];
    this.redoStack = [];
  }
  
  /**
   * Capture the current tile state at a coordinate
   */
  private captureTileState(coord: GridCoordinate): TileData[] {
    const tiles: TileData[] = [];
    // Get all tiles at this coordinate by checking each layer
    for (let layer = 0; layer < 50; layer++) { // maxLayers from SimpleTileSystem
      const key = `${coord.x},${coord.z},${layer}`;
      const mesh = (this.tileSystem as any).tiles.get(key);
      if (mesh && mesh.userData) {
        tiles.push({
          type: mesh.userData.type,
          layer: mesh.userData.layer
        });
      }
    }
    return tiles;
  }
  
  /**
   * Record an action for undo/redo
   */
  private recordAction(action: EditorAction): void {
    // Add to undo stack
    this.undoStack.push(action);
    
    // Clear redo stack (new action invalidates redo history)
    this.redoStack = [];
    
    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }
  
  /**
   * Undo the last action
   */
  public undo(): void {
    const action = this.undoStack.pop();
    if (!action) {
      console.log('Nothing to undo');
      return;
    }
    
    if (action.type === ActionType.PLACE) {
      // Undo a place action: remove what was placed, restore what was there
      this.tileSystem.removeTile(action.coord, true); // Remove all at this position
      
      // Restore what was there before
      if (action.removedTiles) {
        for (const tile of action.removedTiles) {
          (this.tileSystem as any).placeSingleTile(action.coord, tile.type, tile.layer);
        }
      }
    } else if (action.type === ActionType.REMOVE) {
      // Undo a remove action: restore what was removed
      if (action.removedTiles) {
        for (const tile of action.removedTiles) {
          (this.tileSystem as any).placeSingleTile(action.coord, tile.type, tile.layer);
        }
      }
    }
    
    // Move action to redo stack
    this.redoStack.push(action);
    
    // Update displays
    if (this.state.highlightedCell && CoordinateUtils.coordsEqual(this.state.highlightedCell, action.coord)) {
      this.updateHeightDisplay(action.coord);
    }
    
    console.log('Undid action at', action.coord);
  }
  
  /**
   * Redo the last undone action
   */
  public redo(): void {
    const action = this.redoStack.pop();
    if (!action) {
      console.log('Nothing to redo');
      return;
    }
    
    if (action.type === ActionType.PLACE) {
      // Redo a place action: place what was originally placed
      if (action.placedTiles && action.voxelType && action.stackMode !== undefined) {
        this.tileSystem.placeTile(action.coord, action.voxelType, action.stackMode);
      }
    } else if (action.type === ActionType.REMOVE) {
      // Redo a remove action: remove again
      this.tileSystem.removeTile(action.coord);
    }
    
    // Move action back to undo stack
    this.undoStack.push(action);
    
    // Update displays
    if (this.state.highlightedCell && CoordinateUtils.coordsEqual(this.state.highlightedCell, action.coord)) {
      this.updateHeightDisplay(action.coord);
    }
    
    console.log('Redid action at', action.coord);
  }
  
  /**
   * Check if undo is available
   */
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  
  /**
   * Check if redo is available
   */
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  
  /**
   * Toggle ambient occlusion
   */
  private toggleAmbientOcclusion(): void {
    this.aoEnabled = !this.aoEnabled;
    console.log('Ambient Occlusion:', this.aoEnabled ? 'ON' : 'OFF');
  }
  
  /**
   * Set ambient occlusion (called by TilePalette)
   */
  public setAmbientOcclusion(enabled: boolean): void {
    this.aoEnabled = enabled;
  }
  
  /**
   * Toggle tilt-shift effect
   */
  public toggleTiltShift(enabled?: boolean): void {
    this.tiltShiftEnabled = enabled !== undefined ? enabled : !this.tiltShiftEnabled;
    if (this.tiltShiftPass) {
      this.tiltShiftPass.enabled = this.tiltShiftEnabled;
    }
    console.log('Tilt-shift:', this.tiltShiftEnabled ? 'ON' : 'OFF');
  }

  /**
   * Set tilt-shift focus position
   */
  public setTiltShiftFocus(position: number): void {
    if (this.tiltShiftPass) {
      this.tiltShiftPass.focusPosition = position;
      console.log('Tilt-shift focus position:', position);
    }
  }

  /**
   * Set tilt-shift blur strength
   */
  public setTiltShiftBlur(strength: number): void {
    if (this.tiltShiftPass) {
      this.tiltShiftPass.blurStrength = strength;
      console.log('Tilt-shift blur strength:', strength);
    }
  }

  /**
   * Toggle Gamma effect
   */
  public toggleGamma(enabled?: boolean): void {
    this.gammaEnabled = enabled !== undefined ? enabled : !this.gammaEnabled;
    if (this.gammaPass) {
      this.gammaPass.enabled = this.gammaEnabled;
    }
    console.log('Gamma:', this.gammaEnabled ? 'ON' : 'OFF');
  }

  /**
   * Set Gamma exposure
   */
  public setGammaExposure(exposure: number): void {
    if (this.gammaPass) {
      this.gammaPass.gamma = exposure;
      console.log('Gamma exposure:', exposure);
    }
  }

  /**
   * Toggle Bloom effect
   */
  public toggleBloom(enabled?: boolean): void {
    this.bloomEnabled = enabled !== undefined ? enabled : !this.bloomEnabled;
    if (this.bloomPass) {
      this.bloomPass.enabled = this.bloomEnabled;
    }
    console.log('Bloom:', this.bloomEnabled ? 'ON' : 'OFF');
  }

  /**
   * Set Bloom intensity
   */
  public setBloomIntensity(intensity: number): void {
    if (this.bloomPass) {
      this.bloomPass.strength = intensity;
      console.log('Bloom strength:', intensity);
    }
  }
  
  /**
   * Update height display in coordinate HUD
   */
  private updateHeightDisplay(coord: GridCoordinate): void {
    // Height info is now included in the coordinate display updates
    // This method is kept for backward compatibility but does nothing
  }
  
  /**
   * Toggle sky system (visuals only)
   */
  public toggleSky(enabled: boolean): void {
    this.skyEnabled = enabled;
    
    if (enabled) {
      // Use gradient background
      this.scene.background = this.skyGradientTexture;
      // Update fog to match sky
      this.scene.fog = new THREE.Fog(0xB0E0E6, 50, 200); // Powder blue fog
      // Show sun mesh
      if (this.sunMesh) {
        this.sunMesh.visible = true;
      }
      // Brighter lighting for daytime
      if (this.directionalLight) {
        this.directionalLight.intensity = 0.8;
        this.directionalLight.color.setHex(0xFFF5E6); // Warm sunlight
      }
      if (this.secondaryLight) {
        this.secondaryLight.intensity = 0.4; // Stronger fill light
        this.secondaryLight.color.setHex(0xF0F8FF); // Cool fill light
      }
      // Update ambient light for daytime
      const ambient = this.scene.children.find(child => child instanceof THREE.AmbientLight) as THREE.AmbientLight;
      if (ambient) {
        ambient.intensity = 0.7;
        ambient.color.setHex(0xFFF5E6); // Warm white
      }
    } else {
      // Use dark background
      this.scene.background = new THREE.Color(0x161614);
      // Dark fog
      this.scene.fog = new THREE.Fog(0x161614, 50, 200);
      // Hide sun mesh
      if (this.sunMesh) {
        this.sunMesh.visible = false;
      }
      // Dimmer lighting for dark theme
      if (this.directionalLight) {
        this.directionalLight.intensity = 0.6;
        this.directionalLight.color.setHex(0xFFFFFF);
      }
      if (this.secondaryLight) {
        this.secondaryLight.intensity = 0.2; // Dimmer fill light
        this.secondaryLight.color.setHex(0xFFFFFF);
      }
      // Reset ambient light
      const ambient = this.scene.children.find(child => child instanceof THREE.AmbientLight) as THREE.AmbientLight;
      if (ambient) {
        ambient.intensity = 0.6;
        ambient.color.setHex(0xFFFFFF);
      }
    }
    
    console.log('Sky visuals:', enabled ? 'ON' : 'OFF');
  }
  
  /**
   * Update sun position (called by SunControlPanel)
   */
  public updateSunPosition(x: number, y: number, z: number): void {
    if (this.sunMesh) {
      this.sunMesh.position.set(x, y, z);
    }
    
    // Skip expensive light updates during interaction
    if (this.isInteracting) return;
    
    // Always update directional light position from sun (independent of sky visuals)
    if (this.directionalLight) {
      const newPosition = new THREE.Vector3(x, y, z);
      
      // Only update if position changed significantly (optimization)
      if (this.lastSunPosition.distanceTo(newPosition) > 1.0) { // Increased threshold from 0.1 to 1.0
        this.directionalLight.position.copy(newPosition);
        this.directionalLight.target.position.set(0, 0, 0);
        this.directionalLight.updateMatrixWorld();
        
        // Calculate sun elevation (0-1 where 1 is directly overhead)
        const elevation = Math.max(0, Math.min(1, y / 50));
        
        // Adjust light intensity based on elevation
        // Lower sun = more dramatic orange light
        // Higher sun = brighter white light
        const intensity = 0.8 + elevation * 0.8; // 0.8 to 1.6
        this.directionalLight.intensity = intensity;
        
        // Adjust color based on elevation
        // Low sun: warm orange/red
        // High sun: bright white/yellow
        const r = 1.0;
        const g = 0.7 + elevation * 0.3; // 0.7 to 1.0
        const b = 0.4 + elevation * 0.6; // 0.4 to 1.0
        this.directionalLight.color.setRGB(r, g, b);
        
        // Adjust ambient light based on sun height
        const ambient = this.scene.children.find(child => child instanceof THREE.AmbientLight) as THREE.AmbientLight;
        if (ambient) {
          // Lower sun = darker ambient (more contrast)
          // Higher sun = lighter ambient
          ambient.intensity = 0.15 + elevation * 0.25; // 0.15 to 0.4
          
          // Also tint ambient light
          // Low sun: cool blue ambient (simulating sky light)
          // High sun: neutral ambient
          ambient.color.setRGB(
            0.7 + elevation * 0.3,  // 0.7 to 1.0
            0.8 + elevation * 0.2,  // 0.8 to 1.0
            1.0                     // Always full blue
          );
        }
        
        // Update primary shadow camera - maintain full grid coverage
        this.directionalLight.shadow.camera.far = 100;
        this.directionalLight.shadow.camera.left = -60;
        this.directionalLight.shadow.camera.right = 60;
        this.directionalLight.shadow.camera.top = 60;
        this.directionalLight.shadow.camera.bottom = -60;
        this.directionalLight.shadow.camera.updateProjectionMatrix();
        
        // Update secondary light to maintain relative angle to primary sun
        if (this.secondaryLight) {
          // Calculate secondary position based on primary sun direction
          const sunDirection = newPosition.clone().normalize();
          
          // Create secondary light at 45° offset from primary sun
          const secondaryDirection = sunDirection.clone();
          // Rotate around Y axis by 45 degrees for side lighting
          const cos45 = Math.cos(Math.PI / 4);
          const sin45 = Math.sin(Math.PI / 4);
          const newX = secondaryDirection.x * cos45 - secondaryDirection.z * sin45;
          const newZ = secondaryDirection.x * sin45 + secondaryDirection.z * cos45;
          secondaryDirection.x = newX;
          secondaryDirection.z = newZ;
          
          // Position secondary light at same distance as primary
          const distance = newPosition.length();
          this.secondaryLight.position.copy(secondaryDirection.multiplyScalar(distance));
          this.secondaryLight.target.position.set(0, 0, 0);
          this.secondaryLight.updateMatrixWorld();
          
          // Make secondary light more subtle and complementary
          // Low sun = stronger blue fill light
          // High sun = weaker fill light
          this.secondaryLight.intensity = 0.3 * (1 - elevation * 0.5); // 0.3 to 0.15
          
          // Update secondary shadow camera - maintain grid coverage
          this.secondaryLight.shadow.camera.far = 80;
          this.secondaryLight.shadow.camera.left = -50;
          this.secondaryLight.shadow.camera.right = 50;
          this.secondaryLight.shadow.camera.top = 50;
          this.secondaryLight.shadow.camera.bottom = -50;
          this.secondaryLight.shadow.camera.updateProjectionMatrix();
        }
        
        this.lastSunPosition.copy(newPosition);
      } else {
        // Still update positions but skip expensive shadow camera updates
        this.directionalLight.position.copy(newPosition);
        this.directionalLight.updateMatrixWorld();
        
        if (this.secondaryLight) {
          // Update secondary light position relative to primary (fast update)
          const sunDirection = newPosition.clone().normalize();
          const secondaryDirection = sunDirection.clone();
          // Rotate around Y axis by 45 degrees
          const cos45 = Math.cos(Math.PI / 4);
          const sin45 = Math.sin(Math.PI / 4);
          const newX = secondaryDirection.x * cos45 - secondaryDirection.z * sin45;
          const newZ = secondaryDirection.x * sin45 + secondaryDirection.z * cos45;
          secondaryDirection.x = newX;
          secondaryDirection.z = newZ;
          
          const distance = newPosition.length();
          this.secondaryLight.position.copy(secondaryDirection.multiplyScalar(distance));
          this.secondaryLight.updateMatrixWorld();
        }
      }
    }
  }

  /**
   * Main animation loop
   */
  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    const deltaMs = delta * 1000;
    
    // Update FPS
    this.updateFPS(delta);
    
    // No need to update tile system - it's immediate
    
    // Update UI panels at reduced frequency (30fps instead of 60fps)
    this.uiUpdateTime += deltaMs;
    if (this.uiUpdateTime >= this.UI_UPDATE_INTERVAL) {
      this.uiUpdateTime = 0;
      
      if (this.infoPanel) {
        this.infoPanel.update();
      }
      if (this.minimapPanel) {
        this.minimapPanel.update();
      }
      // Only update sun control panel if visible and not interacting
      if (this.sunControlPanel && !this.isInteracting) {
        this.sunControlPanel.update();
      }
      if (this.effectsPanel) {
        this.effectsPanel.update();
      }
    }
    
    // Render scene - use post-processing when effects are enabled
    // Tilt-shift stays active during interaction for smooth experience
    const hasEffects = this.aoEnabled || this.tiltShiftEnabled || this.gammaEnabled || this.bloomEnabled;
    const shouldUsePostProcessing = hasEffects && this.composer && 
      (!this.isInteracting || this.tiltShiftEnabled);
    
    if (shouldUsePostProcessing) {
      // Temporarily disable expensive SSAO during interaction for performance
      if (this.ssaoPass && this.isInteracting) {
        this.ssaoPass.enabled = false;
      }
      
      this.composer.render();
      
      // Restore SSAO to proper state after render
      if (this.ssaoPass) {
        this.ssaoPass.enabled = this.aoEnabled;
      }
    } else {
      this.renderer.render(this.scene, this.camera.getCamera());
    }
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
    if (this.aoEnabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera.getCamera());
    }
    
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
    
    // Clear interaction timeout
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
    }
    
    // Dispose of Three.js resources
    this.grid.dispose();
    this.tileSystem.dispose();
    if (this.composer) {
      this.composer.dispose();
    }
    this.renderer.dispose();
    
    // Dispose preview mesh
    if (this.previewMesh) {
      this.previewMesh.geometry.dispose();
      if (this.previewMaterial) {
        this.previewMaterial.dispose();
      }
    }
    
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
    if (this.sunControlPanel) {
      this.sunControlPanel.dispose();
    }
    if (this.effectsPanel) {
      this.effectsPanel.dispose();
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

  public setReplaceMode(enabled: boolean): void {
    this.replaceMode = enabled;
  }
}