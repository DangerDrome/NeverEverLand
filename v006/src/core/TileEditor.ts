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
  private aoEnabled: boolean = false; // Will be set from config
  
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
  
  // Preview
  private previewMesh: THREE.Mesh | null = null;
  private previewMaterial: THREE.Material | null = null;

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
    // Create semi-transparent preview material
    this.previewMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      emissive: 0x444444,
      emissiveIntensity: 0.3,
    });
    
    // Create preview mesh (same geometry as tiles)
    const geometry = new THREE.BoxGeometry(1, 0.1, 1);
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
    
    // Primary shadow properties
    const cfg = globalConfig.getConfig();
    this.directionalLight.shadow.mapSize.width = cfg.shadowMapSize;
    this.directionalLight.shadow.mapSize.height = cfg.shadowMapSize;
    this.directionalLight.shadow.camera.near = 1;
    this.directionalLight.shadow.camera.far = 30;
    this.directionalLight.shadow.camera.left = -15;
    this.directionalLight.shadow.camera.right = 15;
    this.directionalLight.shadow.camera.top = 15;
    this.directionalLight.shadow.camera.bottom = -15;
    this.directionalLight.shadow.bias = -0.0005;
    
    this.scene.add(this.directionalLight);
    
    // Secondary directional light (softer fill shadow) - only if enabled
    if (cfg.secondaryShadows) {
      this.secondaryLight = new THREE.DirectionalLight(0x88ccff, 0.2); // Cool blue fill light
      this.secondaryLight.position.set(-3, 8, -3); // Opposite angle
      this.secondaryLight.castShadow = true;
    
    // Secondary shadow properties (smaller, softer)
    this.secondaryLight.shadow.mapSize.width = 512; // Smaller for performance
    this.secondaryLight.shadow.mapSize.height = 512;
    this.secondaryLight.shadow.camera.near = 1;
    this.secondaryLight.shadow.camera.far = 25;
    this.secondaryLight.shadow.camera.left = -12;
    this.secondaryLight.shadow.camera.right = 12;
    this.secondaryLight.shadow.camera.top = 12;
    this.secondaryLight.shadow.camera.bottom = -12;
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
      this.ssaoPass = new SSAOPass(this.scene, this.camera.getCamera());
      
      // Ultrathink AO settings - minimal but effective
      this.ssaoPass.kernelRadius = 8; // Smaller radius for performance
      this.ssaoPass.minDistance = 0.01;
      this.ssaoPass.maxDistance = 0.1; // Short range for better performance
      this.ssaoPass.output = SSAOPass.OUTPUT.Default;
      
      this.composer.addPass(this.ssaoPass);
      
      // Set composer size
      this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
      
      console.log('Post-processing initialized successfully');
    } catch (error) {
      console.warn('Post-processing failed to initialize, falling back to direct rendering:', error);
      this.aoEnabled = false; // Disable AO if initialization failed
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
      // Single touch - for placing/erasing or panning
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
    } else if (event.touches.length === 2) {
      // Two touches - for pinch zoom
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
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
    
    if (event.touches.length === 1 && this.touchStartData) {
      // Single touch - pan or draw
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.touchStartData.x;
      const deltaY = touch.clientY - this.touchStartData.y;
      
      // Start panning if moved more than threshold
      if (!this.touchPanning && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        this.touchPanning = true;
        this.startInteraction();
        this.camera.startPan(this.touchStartData.x, this.touchStartData.y);
      }
      
      if (this.touchPanning) {
        this.camera.updatePan(touch.clientX, touch.clientY);
      }
    } else if (event.touches.length === 2) {
      // Two touches - pinch zoom
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
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
    if (this.touchStartData && !this.touchPanning && event.changedTouches.length === 1) {
      // Check if it was a tap (short duration, minimal movement)
      const timeDiff = Date.now() - this.touchStartData.time;
      if (timeDiff < 300 && this.state.highlightedCell) {
        // Treat as a tap - place or erase
        if (this.state.mode === EditorMode.Place) {
          this.placeVoxel(this.state.highlightedCell);
        } else if (this.state.mode === EditorMode.Erase) {
          this.removeVoxel(this.state.highlightedCell);
        }
      }
    }
    
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
      case 'o':
      case 'O':
        this.toggleAmbientOcclusion();
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
        
        // Update preview position
        if (this.previewMesh && this.state.mode === EditorMode.Place) {
          const worldHeight = this.tileSystem.getWorldHeight(gridCoord);
          this.previewMesh.position.set(
            gridCoord.x + 0.5,
            worldHeight + 0.05,
            gridCoord.z + 0.5
          );
          this.previewMesh.visible = true;
          
          // Update preview color based on selected voxel type
          const voxelProps = VOXEL_PROPERTIES[this.selectedVoxelType];
          if (voxelProps && this.previewMaterial) {
            (this.previewMaterial as any).color.setHex(voxelProps.color);
          }
          
          // Update height display for preview
          this.updateHeightDisplay(gridCoord);
        } else if (this.previewMesh) {
          this.previewMesh.visible = false;
        }
        
        // Update coordinate display with height
        if (this.coordinateDisplay && this.config.showCoordinates) {
          const mode = this.state.mode === EditorMode.Place ? `Place ${VoxelType[this.selectedVoxelType]}` :
                      this.state.mode === EditorMode.Erase ? 'Erase' : 'Select';
          const height = this.tileSystem.getWorldHeight(gridCoord);
          this.coordinateDisplay.textContent = `Grid: (${gridCoord.x}, ${gridCoord.z}) | Height: ${height.toFixed(1)}m | Mode: ${mode}`;
        }
      }
    } else {
      this.grid.clearHighlight();
      this.state.highlightedCell = null;
      
      // Hide preview
      if (this.previewMesh) {
        this.previewMesh.visible = false;
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
    // Place based on stack mode
    this.tileSystem.placeTile(gridCoord, this.selectedVoxelType, this.stackMode);
    
    // Update height display
    this.updateHeightDisplay(gridCoord);
  }

  /**
   * Remove tile at grid position
   */
  private removeVoxel(gridCoord: GridCoordinate): void {
    this.tileSystem.removeTile(gridCoord);
    
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
      this.coordinateDisplay.textContent = `Grid: (${this.state.highlightedCell.x}, ${this.state.highlightedCell.z}) | Height: ${height.toFixed(1)}m | Voxel: ${VoxelType[this.selectedVoxelType]}`;
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
    
    // Update preview color
    if (this.previewMesh) {
      const voxelProps = VOXEL_PROPERTIES[type];
      if (voxelProps) {
        (this.previewMaterial as THREE.MeshPhongMaterial).color.setHex(voxelProps.color);
      }
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
        
        // Update primary shadow camera
        this.directionalLight.shadow.camera.far = 40;
        this.directionalLight.shadow.camera.left = -20;
        this.directionalLight.shadow.camera.right = 20;
        this.directionalLight.shadow.camera.top = 20;
        this.directionalLight.shadow.camera.bottom = -20;
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
          
          // Update secondary shadow camera
          this.secondaryLight.shadow.camera.far = 30;
          this.secondaryLight.shadow.camera.left = -15;
          this.secondaryLight.shadow.camera.right = 15;
          this.secondaryLight.shadow.camera.top = 15;
          this.secondaryLight.shadow.camera.bottom = -15;
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
    }
    
    // Render scene - skip post-processing during interaction for performance
    if (this.aoEnabled && this.composer && !this.isInteracting) {
      this.composer.render();
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