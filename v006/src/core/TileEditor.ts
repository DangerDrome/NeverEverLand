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
  StackDirection,
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
  stackDirection?: StackDirection;
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
  private targetLayer: number | null = null; // Track target layer for face-based placement
  
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
  private stackDirection: StackDirection = StackDirection.Up;
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
  private faceHighlightMesh: THREE.Mesh | null = null;
  private faceHighlightMaterial: THREE.Material | null = null;
  
  // Alignment lines
  private alignmentLinesGroup: THREE.Group | null = null;
  private alignmentLineMaterials: THREE.ShaderMaterial[] = [];
  
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
      cameraZoom: 3, // Start zoomed in very close to the action
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
    // Create semi-transparent preview material with contrasting red color
    this.previewMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF0000, // Bright red for visibility
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
    
    // Create face highlight material - bright yellow-orange for visibility
    this.faceHighlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFA500, // Orange color
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    
    // Create face highlight mesh (a plane that will be positioned on voxel faces)
    const faceGeometry = new THREE.PlaneGeometry(this.tileSize * 0.98, this.tileSize * 0.98); // Slightly smaller to show edges
    this.faceHighlightMesh = new THREE.Mesh(faceGeometry, this.faceHighlightMaterial);
    this.faceHighlightMesh.visible = false;
    this.scene.add(this.faceHighlightMesh);
    
    // Create alignment lines
    this.initAlignmentLines();
  }
  
  /**
   * Initialize alignment lines for placement guides
   */
  private initAlignmentLines(): void {
    // Create shader for screen-space distance-based fading
    const createFadingLineShader = () => {
      return new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0x00FF00) },
          opacity: { value: 0.5 }
        },
        vertexShader: `
          varying vec2 vScreenPos;
          varying vec3 vWorldPos;
          
          void main() {
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            // Convert to screen space coordinates
            vScreenPos = gl_Position.xy / gl_Position.w;
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float opacity;
          varying vec2 vScreenPos;
          varying vec3 vWorldPos;
          
          void main() {
            // Create dashed line effect based on world position
            // Use the maximum component to handle all axis directions properly
            float maxCoord = max(abs(vWorldPos.x), max(abs(vWorldPos.y), abs(vWorldPos.z)));
            float dash = mod(maxCoord * 10.0, 1.0);
            if (dash > 0.5) discard;
            
            // Fade based on distance from screen center
            float screenDist = length(vScreenPos);
            float fadeStart = 0.2;
            float fadeEnd = 1.0;
            float fadeFactor = 1.0 - smoothstep(fadeStart, fadeEnd, screenDist);
            
            gl_FragColor = vec4(color, opacity * fadeFactor);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });
    };
    
    // Create group to hold all alignment lines
    this.alignmentLinesGroup = new THREE.Group();
    this.alignmentLinesGroup.visible = false;
    
    // Create edge lines for voxel faces - 12 edges total
    const createEdgeLine = (start: number[], end: number[]) => {
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([...start, ...end]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const material = createFadingLineShader();
      this.alignmentLineMaterials.push(material);
      return new THREE.LineSegments(geometry, material);
    };
    
    const s = this.tileSize * 0.5; // half size
    const h = 0.05; // half height
    const extend = 50; // How far to extend the lines
    
    // Top face edges (4 lines)
    const topNorth = createEdgeLine([-extend, h, -s], [extend, h, -s]);
    topNorth.name = 'topNorth';
    const topSouth = createEdgeLine([-extend, h, s], [extend, h, s]);
    topSouth.name = 'topSouth';
    const topEast = createEdgeLine([s, h, -extend], [s, h, extend]);
    topEast.name = 'topEast';
    const topWest = createEdgeLine([-s, h, -extend], [-s, h, extend]);
    topWest.name = 'topWest';
    
    // Bottom face edges (4 lines)
    const bottomNorth = createEdgeLine([-extend, -h, -s], [extend, -h, -s]);
    bottomNorth.name = 'bottomNorth';
    const bottomSouth = createEdgeLine([-extend, -h, s], [extend, -h, s]);
    bottomSouth.name = 'bottomSouth';
    const bottomEast = createEdgeLine([s, -h, -extend], [s, -h, extend]);
    bottomEast.name = 'bottomEast';
    const bottomWest = createEdgeLine([-s, -h, -extend], [-s, -h, extend]);
    bottomWest.name = 'bottomWest';
    
    // Vertical edges (4 lines)
    const vertNE = createEdgeLine([s, -extend, -s], [s, extend, -s]);
    vertNE.name = 'vertNE';
    const vertNW = createEdgeLine([-s, -extend, -s], [-s, extend, -s]);
    vertNW.name = 'vertNW';
    const vertSE = createEdgeLine([s, -extend, s], [s, extend, s]);
    vertSE.name = 'vertSE';
    const vertSW = createEdgeLine([-s, -extend, s], [-s, extend, s]);
    vertSW.name = 'vertSW';
    
    // Add all edge lines to the group
    this.alignmentLinesGroup.add(topNorth, topSouth, topEast, topWest);
    this.alignmentLinesGroup.add(bottomNorth, bottomSouth, bottomEast, bottomWest);
    this.alignmentLinesGroup.add(vertNE, vertNW, vertSE, vertSW);
    
    this.scene.add(this.alignmentLinesGroup);
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
      case 'd':
      case 'D':
        this.cycleStackDirection();
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
    // First try raycasting against existing voxels
    const voxelIntersection = this.getVoxelIntersection();
    
    if (voxelIntersection && this.previewMesh && this.state.mode === EditorMode.Place) {
      // Show preview on the face of the intersected voxel
      const { position, normal, gridCoord, layer, voxelType, localPoint } = voxelIntersection;
      this.showPreviewOnFace(position, normal, gridCoord, layer, voxelType, localPoint);
      
      // Update highlighted cell to the target position
      const targetCoord = this.getTargetCoordFromFace(gridCoord, normal);
      if (targetCoord && (!this.state.highlightedCell || !CoordinateUtils.coordsEqual(this.state.highlightedCell, targetCoord))) {
        this.state.highlightedCell = targetCoord;
        this.grid.highlightCell(targetCoord, this.tileSize);
        this.updateHeightDisplay(targetCoord);
      }
      return;
    }
    
    // Fall back to ground plane intersection
    const worldPos = this.getMouseWorldPosition();
    if (worldPos) {
      // Clear target layer and hide face highlight when not on a voxel face
      this.targetLayer = null;
      if (this.faceHighlightMesh) {
        this.faceHighlightMesh.visible = false;
      }
      
      // Use tile size as grid cell size for snapping
      const gridCoord = CoordinateUtils.worldToGrid(worldPos, this.tileSize);
      
      // Check if hovering over empty space (for initial placement)
      const existingTile = this.tileSystem.getTile(gridCoord);
      const hasExistingVoxel = existingTile !== VoxelType.Air;
      
      // Show preview on ground for initial placement when no voxel exists
      if (this.previewMesh && this.state.mode === EditorMode.Place && !hasExistingVoxel) {
        // Calculate preview position - tiles should be centered in their grid cells
        // Grid lines are at 0, 0.1, 0.2, etc. so cell (0,0) goes from 0 to 0.1
        const previewX = gridCoord.x * this.tileSize + this.tileSize * 0.5;
        const previewY = 0.05; // Center of 0.1 tall tile, bottom at Y=0
        const previewZ = gridCoord.z * this.tileSize + this.tileSize * 0.5;
        
        // Debug: log positions to verify alignment
        // console.log(`Grid coord: (${gridCoord.x}, ${gridCoord.z}), Preview pos: (${previewX.toFixed(3)}, ${previewZ.toFixed(3)})`);
        
        this.previewMesh.position.set(previewX, previewY, previewZ);
        this.previewMesh.visible = true;
        
        if (this.previewMaterial) {
          (this.previewMaterial as THREE.MeshPhongMaterial).color.setHex(0xFF0000);
          (this.previewMaterial as THREE.MeshPhongMaterial).opacity = 0.5;
        }
        
        // Don't show alignment lines for ground placement
        if (this.alignmentLinesGroup) {
          this.alignmentLinesGroup.visible = false;
        }
      } else if (this.previewMesh) {
        this.previewMesh.visible = false;
        // Hide alignment lines when not placing
        if (this.alignmentLinesGroup) {
          this.alignmentLinesGroup.visible = false;
        }
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
      
      // Hide preview, face highlight and alignment lines
      if (this.previewMesh) {
        this.previewMesh.visible = false;
      }
      if (this.faceHighlightMesh) {
        this.faceHighlightMesh.visible = false;
      }
      if (this.alignmentLinesGroup) {
        this.alignmentLinesGroup.visible = false;
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
   * Get intersection with existing voxel meshes
   */
  private getVoxelIntersection(): { position: THREE.Vector3; normal: THREE.Vector3; gridCoord: GridCoordinate; layer: number; voxelType: VoxelType; localPoint: THREE.Vector3 } | null {
    // Update raycaster
    const cam = this.camera.getCamera();
    cam.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.mouse, cam);
    
    // Get all tile meshes from the tile system
    const tileMeshes = this.tileSystem.getTileMeshes();
    
    // Intersect with tile meshes
    const intersections = this.raycaster.intersectObjects(tileMeshes, false);
    
    if (intersections.length > 0) {
      const intersection = intersections[0];
      if (intersection.face) {
        // Get the grid coordinate of the intersected tile
        const mesh = intersection.object as THREE.Mesh;
        const gridCoord = mesh.userData.coord as GridCoordinate;
        
        // Transform face normal to world space
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        const worldNormal = intersection.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        
        // Calculate local point on the voxel face
        const localPoint = mesh.worldToLocal(intersection.point.clone());
        
        return {
          position: intersection.point.clone(),
          normal: worldNormal,
          gridCoord: gridCoord,
          layer: mesh.userData.layer || 0,
          voxelType: mesh.userData.type || VoxelType.Grass,
          localPoint: localPoint
        };
      }
    }
    
    return null;
  }
  
  /**
   * Check if a point is near a voxel edge
   */
  private isNearEdge(localPoint: THREE.Vector3, normal: THREE.Vector3): boolean {
    const edgeThreshold = 0.02; // Within 2cm of edge (relative to tile size)
    const halfSize = 0.05; // Half of the voxel height (0.1)
    
    // Check which face we're on and test the appropriate edges
    if (Math.abs(normal.y) > 0.5) {
      // Top/bottom face - check X and Z edges
      const distToXEdge = Math.min(
        Math.abs(localPoint.x + halfSize),
        Math.abs(localPoint.x - halfSize)
      );
      const distToZEdge = Math.min(
        Math.abs(localPoint.z + halfSize),
        Math.abs(localPoint.z - halfSize)
      );
      return distToXEdge < edgeThreshold || distToZEdge < edgeThreshold;
    } else if (Math.abs(normal.x) > 0.5) {
      // East/west face - check Y and Z edges
      const distToYEdge = Math.min(
        Math.abs(localPoint.y + halfSize),
        Math.abs(localPoint.y - halfSize)
      );
      const distToZEdge = Math.min(
        Math.abs(localPoint.z + halfSize),
        Math.abs(localPoint.z - halfSize)
      );
      return distToYEdge < edgeThreshold || distToZEdge < edgeThreshold;
    } else if (Math.abs(normal.z) > 0.5) {
      // North/south face - check X and Y edges
      const distToXEdge = Math.min(
        Math.abs(localPoint.x + halfSize),
        Math.abs(localPoint.x - halfSize)
      );
      const distToYEdge = Math.min(
        Math.abs(localPoint.y + halfSize),
        Math.abs(localPoint.y - halfSize)
      );
      return distToXEdge < edgeThreshold || distToYEdge < edgeThreshold;
    }
    
    return false;
  }
  
  /**
   * Show preview on a specific face of a voxel
   */
  private showPreviewOnFace(position: THREE.Vector3, normal: THREE.Vector3, sourceCoord: GridCoordinate, sourceLayer: number, voxelType: VoxelType, localPoint: THREE.Vector3): void {
    if (!this.previewMesh) return;
    
    // Show face highlight
    this.showFaceHighlight(sourceCoord, normal, sourceLayer);
    
    // Get the target coordinate based on the face normal
    const targetCoord = this.getTargetCoordFromFace(sourceCoord, normal);
    if (!targetCoord) return;
    
    // Get the Y position of the source voxel using the actual layer clicked
    const layerHeight = 0.1;
    const sourceY = layerHeight / 2 + (sourceLayer * layerHeight);
    
    // Position preview at the target location
    let targetY = sourceY; // Default to same height as source
    let targetLayerNum = sourceLayer; // Default to same layer as source
    
    // Only adjust Y position based on face normal when stack mode is enabled
    if (this.stackMode) {
      if (Math.abs(normal.y) > 0.5) {
        if (normal.y > 0) {
          // Top face - place above
          targetLayerNum = sourceLayer + 1;
          targetY = layerHeight / 2 + (targetLayerNum * layerHeight);
        } else {
          // Bottom face - place below
          targetLayerNum = Math.max(0, sourceLayer - 1);
          targetY = layerHeight / 2 + (targetLayerNum * layerHeight);
        }
      } else {
        // Side face - place at same layer as the clicked voxel
        targetLayerNum = sourceLayer;
        targetY = sourceY;
      }
    } else {
      // When stack mode is off, always preview at ground level (layer 0)
      targetLayerNum = 0;
      targetY = layerHeight / 2;
    }
    
    // Store the target layer for placement
    this.targetLayer = targetLayerNum;
    
    this.previewMesh.position.set(
      targetCoord.x * this.tileSize + this.tileSize * 0.5,
      targetY,
      targetCoord.z * this.tileSize + this.tileSize * 0.5
    );
    
    this.previewMesh.visible = true;
    
    // Update preview appearance
    if (this.previewMaterial) {
      (this.previewMaterial as THREE.MeshPhongMaterial).color.setHex(0xFF0000);
      (this.previewMaterial as THREE.MeshPhongMaterial).opacity = 0.5;
    }
    
    // Show alignment lines for the hovered voxel face
    this.updateAlignmentLines(
      sourceCoord.x * this.tileSize + this.tileSize * 0.5,
      sourceY,
      sourceCoord.z * this.tileSize + this.tileSize * 0.5,
      voxelType,
      normal
    );
  }
  
  /**
   * Show face highlight on the hovered voxel face
   */
  private showFaceHighlight(coord: GridCoordinate, normal: THREE.Vector3, layer: number): void {
    if (!this.faceHighlightMesh) return;
    
    // Get the voxel position using the actual layer
    const layerHeight = 0.1;
    const voxelY = layerHeight / 2 + (layer * layerHeight);
    
    // Calculate face center position
    const centerX = coord.x * this.tileSize + this.tileSize * 0.5;
    const centerZ = coord.z * this.tileSize + this.tileSize * 0.5;
    
    // Offset the highlight slightly from the face to prevent z-fighting
    const offset = 0.001;
    
    // Position and rotate the highlight based on which face
    if (Math.abs(normal.y) > 0.5) {
      // Top or bottom face
      this.faceHighlightMesh.position.set(
        centerX,
        voxelY + (normal.y > 0 ? layerHeight/2 + offset : -layerHeight/2 - offset),
        centerZ
      );
      // Rotate to be horizontal
      this.faceHighlightMesh.rotation.set(Math.PI / 2, 0, 0);
    } else if (Math.abs(normal.x) > 0.5) {
      // East or west face
      this.faceHighlightMesh.position.set(
        centerX + (normal.x > 0 ? this.tileSize/2 + offset : -this.tileSize/2 - offset),
        voxelY,
        centerZ
      );
      // Rotate to face east/west
      this.faceHighlightMesh.rotation.set(0, Math.PI / 2, 0);
    } else if (Math.abs(normal.z) > 0.5) {
      // North or south face
      this.faceHighlightMesh.position.set(
        centerX,
        voxelY,
        centerZ + (normal.z > 0 ? this.tileSize/2 + offset : -this.tileSize/2 - offset)
      );
      // No rotation needed for north/south faces
      this.faceHighlightMesh.rotation.set(0, 0, 0);
    }
    
    this.faceHighlightMesh.visible = true;
  }
  
  /**
   * Update alignment lines position and color
   */
  private updateAlignmentLines(x: number, y: number, z: number, voxelType: VoxelType, normal?: THREE.Vector3): void {
    if (!this.alignmentLinesGroup || this.alignmentLineMaterials.length === 0) return;
    
    // Get voxel color from properties
    const voxelProps = VOXEL_PROPERTIES[voxelType];
    if (voxelProps) {
      // Update all material colors to match voxel
      const color = new THREE.Color(voxelProps.color);
      this.alignmentLineMaterials.forEach(material => {
        material.uniforms.color.value = color;
      });
    }
    
    // Hide all lines first
    this.alignmentLinesGroup.children.forEach(child => {
      child.visible = false;
    });
    
    if (normal) {
      // Position the group at the voxel center
      this.alignmentLinesGroup.position.set(x, y, z);
      
      if (Math.abs(normal.y) > 0.5) {
        // Top/bottom face - show the 4 edge lines of that face
        if (normal.y > 0) {
          // Top face
          const topNorth = this.alignmentLinesGroup.getObjectByName('topNorth');
          const topSouth = this.alignmentLinesGroup.getObjectByName('topSouth');
          const topEast = this.alignmentLinesGroup.getObjectByName('topEast');
          const topWest = this.alignmentLinesGroup.getObjectByName('topWest');
          if (topNorth) topNorth.visible = true;
          if (topSouth) topSouth.visible = true;
          if (topEast) topEast.visible = true;
          if (topWest) topWest.visible = true;
        } else {
          // Bottom face
          const bottomNorth = this.alignmentLinesGroup.getObjectByName('bottomNorth');
          const bottomSouth = this.alignmentLinesGroup.getObjectByName('bottomSouth');
          const bottomEast = this.alignmentLinesGroup.getObjectByName('bottomEast');
          const bottomWest = this.alignmentLinesGroup.getObjectByName('bottomWest');
          if (bottomNorth) bottomNorth.visible = true;
          if (bottomSouth) bottomSouth.visible = true;
          if (bottomEast) bottomEast.visible = true;
          if (bottomWest) bottomWest.visible = true;
        }
      } else if (Math.abs(normal.x) > 0.5) {
        // Left/right face - show the 4 edge lines of that face
        if (normal.x > 0) {
          // Right face (+X)
          const topEast = this.alignmentLinesGroup.getObjectByName('topEast');
          const bottomEast = this.alignmentLinesGroup.getObjectByName('bottomEast');
          const vertNE = this.alignmentLinesGroup.getObjectByName('vertNE');
          const vertSE = this.alignmentLinesGroup.getObjectByName('vertSE');
          if (topEast) topEast.visible = true;
          if (bottomEast) bottomEast.visible = true;
          if (vertNE) vertNE.visible = true;
          if (vertSE) vertSE.visible = true;
        } else {
          // Left face (-X)
          const topWest = this.alignmentLinesGroup.getObjectByName('topWest');
          const bottomWest = this.alignmentLinesGroup.getObjectByName('bottomWest');
          const vertNW = this.alignmentLinesGroup.getObjectByName('vertNW');
          const vertSW = this.alignmentLinesGroup.getObjectByName('vertSW');
          if (topWest) topWest.visible = true;
          if (bottomWest) bottomWest.visible = true;
          if (vertNW) vertNW.visible = true;
          if (vertSW) vertSW.visible = true;
        }
      } else if (Math.abs(normal.z) > 0.5) {
        // Front/back face - show the 4 edge lines of that face
        if (normal.z > 0) {
          // Front face (+Z)
          const topSouth = this.alignmentLinesGroup.getObjectByName('topSouth');
          const bottomSouth = this.alignmentLinesGroup.getObjectByName('bottomSouth');
          const vertSE = this.alignmentLinesGroup.getObjectByName('vertSE');
          const vertSW = this.alignmentLinesGroup.getObjectByName('vertSW');
          if (topSouth) topSouth.visible = true;
          if (bottomSouth) bottomSouth.visible = true;
          if (vertSE) vertSE.visible = true;
          if (vertSW) vertSW.visible = true;
        } else {
          // Back face (-Z)
          const topNorth = this.alignmentLinesGroup.getObjectByName('topNorth');
          const bottomNorth = this.alignmentLinesGroup.getObjectByName('bottomNorth');
          const vertNE = this.alignmentLinesGroup.getObjectByName('vertNE');
          const vertNW = this.alignmentLinesGroup.getObjectByName('vertNW');
          if (topNorth) topNorth.visible = true;
          if (bottomNorth) bottomNorth.visible = true;
          if (vertNE) vertNE.visible = true;
          if (vertNW) vertNW.visible = true;
        }
      }
    } else {
      // No normal provided, show all lines at the given position
      this.alignmentLinesGroup.position.set(x, y, z);
      this.alignmentLinesGroup.children.forEach(child => {
        child.visible = true;
      });
    }
    
    // Show the alignment lines
    this.alignmentLinesGroup.visible = true;
  }
  
  /**
   * Get target coordinate based on face normal
   */
  private getTargetCoordFromFace(sourceCoord: GridCoordinate, normal: THREE.Vector3): GridCoordinate | null {
    // Determine which face was hit based on normal
    let offsetX = 0;
    let offsetZ = 0;
    
    // Use a threshold to determine the primary axis
    const threshold = 0.5;
    
    if (Math.abs(normal.x) > threshold) {
      offsetX = normal.x > 0 ? 1 : -1;
    } else if (Math.abs(normal.z) > threshold) {
      offsetZ = normal.z > 0 ? 1 : -1;
    }
    
    // For vertical faces, we still use the same coordinate but stack vertically
    if (Math.abs(normal.y) > threshold) {
      return sourceCoord;
    }
    
    return {
      x: sourceCoord.x + offsetX,
      z: sourceCoord.z + offsetZ
    };
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
    // Use the highlighted cell which has already been calculated based on face detection
    const targetCoord = this.state.highlightedCell || gridCoord;
    
    // Capture state before placing
    const beforeState = this.captureTileState(targetCoord);
    
    // Check if we have a specific layer from face detection
    if (this.targetLayer !== null && this.stackMode) {
      // Use specific layer placement for face-based placement only in stack mode
      this.tileSystem.placeTileAtLayer(targetCoord, this.selectedVoxelType, this.targetLayer);
      this.targetLayer = null; // Reset after use
    } else {
      // Fall back to normal placement logic
      const shouldStackOnTop = !this.replaceMode && this.stackMode;
      this.tileSystem.placeTile(targetCoord, this.selectedVoxelType, shouldStackOnTop, this.replaceMode, this.stackDirection);
    }
    
    // Capture state after placing
    const afterState = this.captureTileState(targetCoord);
    
    // Record action for undo/redo
    const action: EditorAction = {
      type: ActionType.PLACE,
      coord: { ...targetCoord },
      placedTiles: afterState,
      removedTiles: beforeState,
      stackMode: this.stackMode,
      stackDirection: this.stackDirection,
      voxelType: this.selectedVoxelType
    };
    this.recordAction(action);
    
    // Update height display
    this.updateHeightDisplay(targetCoord);
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
      (this.previewMaterial as THREE.MeshPhongMaterial).color.setHex(0xFF0000); // Bright cyan for visibility
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
   * Set stack direction (called by TilePalette)
   */
  public setStackDirection(direction: StackDirection): void {
    this.stackDirection = direction;
    console.log('Stack direction:', direction);
  }
  
  /**
   * Get current stack direction
   */
  public getStackDirection(): StackDirection {
    return this.stackDirection;
  }
  
  /**
   * Cycle through stack directions
   */
  public cycleStackDirection(): void {
    const directions = [
      StackDirection.Up,
      StackDirection.North,
      StackDirection.East,
      StackDirection.South,
      StackDirection.West
    ];
    
    const currentIndex = directions.indexOf(this.stackDirection);
    const nextIndex = (currentIndex + 1) % directions.length;
    this.stackDirection = directions[nextIndex]!;
    
    console.log('Stack direction:', this.stackDirection);
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
    
    if (this.faceHighlightMesh) {
      // Dispose old geometry
      this.faceHighlightMesh.geometry.dispose();
      
      // Create new geometry with current tile size
      this.faceHighlightMesh.geometry = new THREE.PlaneGeometry(this.tileSize * 0.98, this.tileSize * 0.98);
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
        const direction = action.stackDirection || StackDirection.Up;
        this.tileSystem.placeTile(action.coord, action.voxelType, action.stackMode, false, direction);
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
    
    // Dispose face highlight mesh
    if (this.faceHighlightMesh) {
      this.faceHighlightMesh.geometry.dispose();
      if (this.faceHighlightMaterial) {
        this.faceHighlightMaterial.dispose();
      }
    }
    
    // Dispose alignment lines
    if (this.alignmentLinesGroup) {
      this.alignmentLinesGroup.traverse((child) => {
        if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
          child.geometry.dispose();
        }
      });
      this.alignmentLineMaterials.forEach(material => material.dispose());
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