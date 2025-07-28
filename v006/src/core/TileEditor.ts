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

// Extend window type to include styleUI
declare global {
  interface Window {
    styleUI?: {
      showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    };
  }
}

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
  private readonly BASE_GRID_SIZE = 0.1; // Base grid size that all voxels align to
  private readonly VOXEL_SIZE = 0.1; // All voxels are 0.1m cubes
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
  private dragStartLayer: number | null = null; // Layer where drag started for consistent placement
  private dragConstraint: 'horizontal' | 'vertical' | 'free' | null = null; // Constraint for current drag
  private dragStartPos: THREE.Vector2 | null = null; // Mouse position at drag start
  private dragDirection: THREE.Vector3 | null = null; // Detected or forced drag direction
  private dragStartCell: GridCoordinate | null = null; // Grid position where drag started
  private currentDragLayer: number = 0; // Current layer during vertical drag
  private dragStartWorld: THREE.Vector3 | null = null; // World position where drag started
  
  // Input handling
  private mouse: THREE.Vector2;
  private raycaster: THREE.Raycaster;
  private groundPlane: THREE.Plane;
  private isPanning: boolean = false;
  private isDrawing: boolean = false;
  private isTumbling: boolean = false;
  private tumbleStart: THREE.Vector2 = new THREE.Vector2();
  private currentRotationAngle: number = 0; // Current rotation in degrees (0, 45, 90, 135, etc.)
  private targetRotationAngle: number = 0; // Target rotation for smooth transitions
  private currentElevation: number = 0; // 0 = dimetric, 1 = top, -1 = bottom
  private targetElevation: number = 0;
  private animatedRotationAngle: number = 0; // For smooth transitions
  private animatedElevation: number = 0; // For smooth transitions
  private TUMBLE_SMOOTH_FACTOR: number = 0.15; // How quickly to interpolate (0.1 = slow, 0.3 = fast)
  private isErasing: boolean = false;
  private lastDrawnCell: GridCoordinate | null = null;
  private tilesPlacedDuringDrag: Set<string> = new Set(); // Track tiles placed during current drag
  private lastErasedVoxel: { coord: GridCoordinate; layer: number } | null = null;
  
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
  
  // Placement mode options - How these work together:
  // 1. Stack Mode (ON): Tiles can be placed on top of existing tiles
  //    - Click on top face → builds upward
  //    - Click on side face → builds at same level
  //    - Stack Direction controls preferred direction when auto-stacking
  // 2. Stack Mode (OFF): All tiles placed at ground level (Y=0)
  // 3. Replace Mode (ON): New tiles replace existing tiles at same position
  // 4. Replace Mode (OFF): New tiles stack on top of existing tiles
  // Common combinations:
  //    - Stack ON + Replace OFF = Build upward (Minecraft creative)
  //    - Stack OFF + Replace ON = Ground-only painting
  //    - Stack ON + Replace ON = Edit existing structures
  private stackMode: boolean = true;
  private stackDirection: StackDirection = StackDirection.Up;
  private brushSize: number = 1; // Brush size in voxels (1x1, 3x3, 5x5, etc.)
  
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
  private previewGroup: THREE.Group | null = null; // Group showing entire brush area
  private previewMaterial: THREE.Material | null = null;
  private faceHighlightMesh: THREE.Mesh | null = null;
  private faceHighlightMaterial: THREE.Material | null = null;
  private alignmentCage: THREE.Group | null = null;
  
  // Selection
  private selectionMaterial: THREE.Material | null = null;
  private selectionMeshes: Map<string, THREE.Mesh> = new Map();
  private isSelecting: boolean = false;
  private selectionRectangle: HTMLDivElement | null = null;
  private selectionStartScreen: THREE.Vector2 | null = null;
  private rectangleSelectionMode: boolean = false;
  
  // Drag visualization
  private dragDirectionHelper: THREE.ArrowHelper | null = null;
  
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
    // Ensure container has relative positioning for absolute children
    this.container.style.position = 'relative';
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
      selectedVoxels: new Set<string>(),
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
    
    // Initialize animated values to match initial camera state
    this.animatedRotationAngle = this.currentRotationAngle;
    this.animatedElevation = this.currentElevation;
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
    // Create semi-transparent material for better visibility
    this.previewMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FF00, // Bright green for visibility
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false, // Prevent depth issues
      depthTest: true,
    });
    
    // Create preview group that shows entire brush area
    this.previewGroup = new THREE.Group();
    this.previewGroup.visible = false;
    this.scene.add(this.previewGroup);
    
    // Keep the preview group from above, no need to recreate
    
    // Update preview to show brush area
    this.updatePreviewGeometry();
    
    // Create alignment cage to show which base grid cells will be occupied
    this.alignmentCage = new THREE.Group();
    this.alignmentCage.visible = false;
    this.scene.add(this.alignmentCage);
    this.updateAlignmentCage();
    
    // Create selection material
    this.selectionMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FF00, // Bright green for selection
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });
    
    // Create face highlight material - bright yellow-orange for visibility
    this.faceHighlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFA500, // Orange color
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    
    // Create selection rectangle element
    this.selectionRectangle = document.createElement('div');
    this.selectionRectangle.style.position = 'absolute';
    this.selectionRectangle.style.border = '2px solid #0080FF';
    this.selectionRectangle.style.backgroundColor = 'rgba(0, 128, 255, 0.1)';
    this.selectionRectangle.style.pointerEvents = 'none';
    this.selectionRectangle.style.display = 'none';
    this.selectionRectangle.style.zIndex = '100';
    this.container.appendChild(this.selectionRectangle);
    
    // Create face highlight mesh (a plane that will be positioned on voxel faces)
    const faceGeometry = new THREE.PlaneGeometry(this.VOXEL_SIZE * 0.98, this.VOXEL_SIZE * 0.98); // Slightly smaller to show edges
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
    
    const s = this.VOXEL_SIZE * 0.5; // half size
    const h = this.VOXEL_SIZE / 2; // half height
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
    // Handle camera tumbling (ALT + left mouse) - snap rotation
    if (this.isTumbling && event.buttons === 1) {
      this.startInteraction();
      const deltaX = event.clientX - this.tumbleStart.x;
      const deltaY = event.clientY - this.tumbleStart.y;
      
      // Calculate rotation based on horizontal mouse movement
      // Every 100 pixels = 45 degrees
      const rotationDelta = (deltaX / 100) * 45;
      let newAngle = this.currentRotationAngle + rotationDelta;
      
      // Snap to 45-degree increments
      const snapAngle = Math.round(newAngle / 45) * 45;
      
      // Calculate elevation based on vertical mouse movement
      // Every 150 pixels = switch between views
      const elevationDelta = deltaY / 150;
      let newElevation = this.currentElevation + elevationDelta;
      
      // Snap elevation to 0 only (disable top/bottom views)
      let snapElevation = 0;
      
      // Update camera if angle or elevation changed
      if (snapAngle !== this.targetRotationAngle || snapElevation !== this.targetElevation) {
        this.targetRotationAngle = snapAngle;
        this.targetElevation = snapElevation;
        // Don't update camera directly - let animation handle it
      }
      
      return;
    }
    
    // Handle camera panning first
    if (event.buttons === 4) { // Middle mouse button
      this.startInteraction();
      this.camera.updatePan(event.clientX, event.clientY);
      // Don't update anything else during panning
      return;
    }
    
    // Update mouse coordinates using renderer's actual size
    const rect = this.renderer.domElement.getBoundingClientRect();
    
    // Simple NDC calculation without scaling
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Only update grid highlight when not panning and not interacting
    if (!this.isPanning && !this.isInteracting) {
      this.updateGridHighlight();
      
      // Check if we should start drawing (mouse moved while button is down)
      if (!this.isDrawing && !this.isErasing && event.buttons === 1 && this.lastDrawnCell && this.state.mode === EditorMode.Place) {
        // Start drawing mode if we've moved significantly (not just to check for cell change)
        if (this.dragStartPos) {
          const currentPos = new THREE.Vector2(event.clientX, event.clientY);
          const distance = currentPos.distanceTo(this.dragStartPos);
          // Start dragging after 5 pixels of movement
          if (distance > 5) {
            this.isDrawing = true;
            this.tilesPlacedDuringDrag.clear(); // Clear tiles placed during previous drag
            
            // If drag constraint wasn't set by modifier keys, initialize it now
            if (this.dragConstraint === null) {
              // Default to horizontal for initial movement
              this.dragConstraint = 'horizontal';
            }
          }
        }
      }
      
      // Handle rectangle selection
      if (this.isSelecting && this.rectangleSelectionMode && this.selectionStartScreen && event.buttons > 0) {
        this.updateSelectionRectangle(event.clientX, event.clientY);
        return;
      }
      
      // Handle continuous drawing/erasing/selecting while dragging
      // Additional check: ensure mouse buttons are actually pressed
      if ((this.isDrawing || this.isErasing || (this.isSelecting && !this.rectangleSelectionMode)) && this.state.highlightedCell && event.buttons > 0) {
        // Auto-detect drag direction if not yet determined
        if (this.isDrawing && this.dragConstraint === null && this.dragStartPos && !this.dragDirection) {
          const currentPos = new THREE.Vector2(event.clientX, event.clientY);
          const delta = currentPos.clone().sub(this.dragStartPos);
          
          // Lower threshold for quicker direction detection (5 pixels instead of 10)
          if (delta.length() > 5) {
            const angle = Math.atan2(delta.y, delta.x);
            const absAngle = Math.abs(angle);
            
            // Determine if movement is more horizontal or vertical
            // Use 30-degree cone for more intuitive direction detection
            const horizontalThreshold = Math.PI / 6; // 30 degrees
            const verticalThreshold = Math.PI - Math.PI / 6; // 150 degrees
            
            if (absAngle < horizontalThreshold || absAngle > verticalThreshold) {
              // Horizontal movement
              this.dragConstraint = 'horizontal';
              
              // Calculate actual drag direction in world space with enhanced precision
              if (this.dragStartWorld && this.state.highlightedCell) {
                const currentWorld = new THREE.Vector3(
                  this.state.highlightedCell.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5,
                  this.dragStartWorld.y,
                  this.state.highlightedCell.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5
                );
                this.dragDirection = currentWorld.sub(this.dragStartWorld);
                
                // Ensure it's purely horizontal
                this.dragDirection.y = 0;
                
                // Normalize only if vector has length
                if (this.dragDirection.length() > 0.001) {
                  this.dragDirection.normalize();
                  
                  // Snap to cardinal directions if close (within 15 degrees)
                  const snapAngle = Math.atan2(this.dragDirection.z, this.dragDirection.x);
                  const snapThreshold = Math.PI / 12; // 15 degrees
                  
                  // Check cardinal directions
                  if (Math.abs(snapAngle) < snapThreshold) {
                    this.dragDirection.set(1, 0, 0); // East
                  } else if (Math.abs(snapAngle - Math.PI / 2) < snapThreshold) {
                    this.dragDirection.set(0, 0, 1); // North
                  } else if (Math.abs(snapAngle + Math.PI / 2) < snapThreshold) {
                    this.dragDirection.set(0, 0, -1); // South
                  } else if (Math.abs(Math.abs(snapAngle) - Math.PI) < snapThreshold) {
                    this.dragDirection.set(-1, 0, 0); // West
                  }
                } else {
                  this.dragDirection = new THREE.Vector3(1, 0, 0);
                }
              } else {
                this.dragDirection = new THREE.Vector3(1, 0, 0);
              }
            } else {
              // Vertical movement
              this.dragConstraint = 'vertical';
              this.dragDirection = new THREE.Vector3(0, 1, 0);
            }
            
            // Create or update drag direction visualization
            this.updateDragDirectionHelper();
          }
        }
        
        // Apply constraints to placement
        let targetCell = this.state.highlightedCell;
        let targetLayer = this.dragStartLayer || 0;
        
        // Make sure we have a valid target cell
        if (!targetCell) {
          // console.warn('No highlighted cell during drag');
          return;
        }
        
        if (this.isDrawing && this.dragConstraint === 'vertical' && this.stackMode) {
          // For vertical building, calculate layer based on mouse Y movement with smooth projection
          if (this.dragStartPos && this.dragStartCell) {
            const currentMousePos = new THREE.Vector2(event.clientX, event.clientY);
            const dragVector = currentMousePos.sub(this.dragStartPos);
            
            // Project drag vector onto vertical axis for smoother control
            // Use adaptive sensitivity based on zoom level
            const zoomFactor = Math.max(1, this.state.cameraZoom / 20);
            const sensitivity = 15 / zoomFactor; // More sensitive when zoomed in
            
            // Apply exponential scaling for finer control at small movements
            const rawDelta = -dragVector.y / sensitivity;
            const layerDelta = Math.sign(rawDelta) * Math.floor(Math.pow(Math.abs(rawDelta), 1.2));
            
            targetLayer = Math.max(0, Math.min(49, (this.dragStartLayer || 0) + layerDelta));
            
            // Keep X,Z from the drag start position for pure vertical building
            targetCell = { x: this.dragStartCell.x, z: this.dragStartCell.z };
          }
        }
        
        // Check if we've moved to a new cell or layer
        const cellChanged = !this.lastDrawnCell || !CoordinateUtils.coordsEqual(this.lastDrawnCell, targetCell);
        const layerChanged = this.isDrawing && this.currentDragLayer !== targetLayer;
        
        // Debug logging
        // if (this.isDrawing) {
        //   console.log(`Drag state - Cell: (${targetCell.x}, ${targetCell.z}), Changed: ${cellChanged}, Layer: ${targetLayer}, LayerChanged: ${layerChanged}, Constraint: ${this.dragConstraint}`);
        // }
        
        // Update current drag layer
        if (this.isDrawing) {
          this.currentDragLayer = targetLayer;
        }
        
        if (cellChanged || layerChanged) {
          if (this.isDrawing) {
            // Interpolate between positions
            if (this.lastDrawnCell && this.dragConstraint !== 'vertical') {
              this.drawLine(this.lastDrawnCell, targetCell, true);
            } else {
              this.placeVoxel(targetCell);
            }
          } else if (this.isErasing) {
            // Get the specific voxel under the cursor
            const voxelIntersection = this.getVoxelIntersection();
            if (voxelIntersection) {
              // Check if we've already erased this specific voxel
              const voxelKey = `${voxelIntersection.gridCoord.x},${voxelIntersection.gridCoord.z},${voxelIntersection.layer}`;
              const lastKey = this.lastErasedVoxel ? 
                `${this.lastErasedVoxel.coord.x},${this.lastErasedVoxel.coord.z},${this.lastErasedVoxel.layer}` : null;
              
              if (voxelKey !== lastKey) {
                this.removeVoxelAtLayer(voxelIntersection.gridCoord, voxelIntersection.layer);
                this.lastErasedVoxel = { coord: voxelIntersection.gridCoord, layer: voxelIntersection.layer };
              }
            }
          } else if (this.isSelecting) {
            // Paint selection
            const voxelIntersection = this.getVoxelIntersection();
            if (voxelIntersection) {
              // Only toggle if we haven't already processed this voxel
              this.toggleVoxelSelection(voxelIntersection.gridCoord, voxelIntersection.layer);
            } else if (this.lastDrawnCell === null) {
              // Started drag on empty space - clear any remaining selections
              this.clearSelection();
            }
          }
          
          this.lastDrawnCell = { ...targetCell };
        }
      } else if (event.buttons === 0) {
        // No buttons pressed - ensure drawing/erasing states are cleared
        this.isDrawing = false;
        this.isErasing = false;
        this.lastDrawnCell = null;
        this.lastErasedVoxel = null;
        this.tilesPlacedDuringDrag.clear(); // Clear tracking set
        this.dragStartWorld = null;
        this.dragDirection = null;
        this.dragConstraint = null;
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
      // Check for ALT key for tumbling
      if (event.altKey) {
        this.isTumbling = true;
        this.startInteraction();
        this.tumbleStart.set(event.clientX, event.clientY);
        event.preventDefault();
      } else if (this.state.mode === EditorMode.Place && this.state.highlightedCell) {
        // Don't set isDrawing yet - wait for mouse movement to distinguish click from drag
        this.lastDrawnCell = { ...this.state.highlightedCell };
        this.dragStartCell = { ...this.state.highlightedCell }; // Store initial cell position
        
        // Capture drag start position for direction detection
        this.dragStartPos = new THREE.Vector2(event.clientX, event.clientY);
        
        // Determine constraint based on modifier keys
        if (event.shiftKey && !event.ctrlKey) {
          this.dragConstraint = 'horizontal'; // Force horizontal
        } else if (event.ctrlKey && !event.shiftKey) {
          this.dragConstraint = 'vertical'; // Force vertical
        } else {
          this.dragConstraint = null; // Auto-detect from first movement
        }
        
        // Smart layer detection for drag start
        const voxelIntersection = this.getVoxelIntersection();
        if (voxelIntersection && this.stackMode) {
          const { normal, layer } = voxelIntersection;
          // For horizontal dragging, we'll determine layer per cell during the drag
          // For vertical dragging, use the clicked layer
          if (Math.abs(normal.y) > 0.5 && normal.y > 0) {
            // Clicking on top face - start from the layer above
            this.dragStartLayer = layer + 1;
          } else {
            // For side faces, use the clicked layer
            this.dragStartLayer = layer;
          }
          // console.log(`Drag start - voxel intersection detected, layer: ${layer}, dragStartLayer: ${this.dragStartLayer}`);
        } else if (this.stackMode && this.state.highlightedCell) {
          // No voxel intersection but in stack mode - check if we should stack on existing voxels
          const topLayer = this.tileSystem.getTopLayer(this.state.highlightedCell);
          if (topLayer >= 0) {
            // There's an existing voxel at this position, start from layer above
            this.dragStartLayer = topLayer + 1;
          } else {
            // Empty position - start at ground
            this.dragStartLayer = 0;
          }
          // console.log(`Drag start - no voxel intersection, topLayer: ${topLayer}, dragStartLayer: ${this.dragStartLayer}`);
        } else {
          // Non-stack mode or no highlighted cell - use ground level
          this.dragStartLayer = 0;
          // console.log(`Drag start - non-stack mode or no highlighted cell, dragStartLayer: 0`);
        }
        
        // Initialize current drag layer
        this.currentDragLayer = this.dragStartLayer;
        
        // Store world position at drag start
        if (this.state.highlightedCell) {
          const worldX = this.state.highlightedCell.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5;
          const worldZ = this.state.highlightedCell.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5;
          const worldY = this.VOXEL_SIZE / 2 + this.dragStartLayer * this.VOXEL_SIZE;
          this.dragStartWorld = new THREE.Vector3(worldX, worldY, worldZ);
        }
        
        // Place initial voxel - this will use targetLayer for single clicks
        this.placeVoxel(this.state.highlightedCell);
      } else if (this.state.mode === EditorMode.Erase && this.state.highlightedCell) {
        this.isErasing = true;
        this.lastDrawnCell = { ...this.state.highlightedCell };
        // Get the specific voxel to erase
        const voxelIntersection = this.getVoxelIntersection();
        if (voxelIntersection) {
          this.removeVoxelAtLayer(voxelIntersection.gridCoord, voxelIntersection.layer);
          this.lastErasedVoxel = { coord: voxelIntersection.gridCoord, layer: voxelIntersection.layer };
        }
      } else if (this.state.mode === EditorMode.Select) {
        // Start selection
        this.isSelecting = true;
        this.dragStartPos = new THREE.Vector2(event.clientX, event.clientY);
        
        // Check if clicking on a voxel or empty space
        const voxelIntersection = this.getVoxelIntersection();
        if (voxelIntersection && !event.shiftKey) {
          // Clicking on a voxel without shift - paint selection mode
          this.lastDrawnCell = { ...this.state.highlightedCell! };
          this.rectangleSelectionMode = false;
          this.toggleVoxelSelection(voxelIntersection.gridCoord, voxelIntersection.layer);
        } else {
          // Clicking on empty space or holding shift - rectangle selection mode
          this.rectangleSelectionMode = true;
          this.selectionStartScreen = new THREE.Vector2(event.clientX, event.clientY);
          
          // Clear selection if not holding shift
          if (!event.shiftKey) {
            this.clearSelection();
          }
          this.lastDrawnCell = null;
        }
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
    // Handle rectangle selection completion
    if (this.isSelecting && this.rectangleSelectionMode && this.selectionStartScreen) {
      this.completeRectangleSelection(event.clientX, event.clientY);
      this.hideSelectionRectangle();
    }
    
    // Always clear all drawing/erasing states on any mouse up to prevent stuck states
    this.isDrawing = false;
    this.isErasing = false;
    this.lastDrawnCell = null;
    this.lastErasedVoxel = null;
    this.tilesPlacedDuringDrag.clear(); // Clear tracking set
    this.dragStartLayer = null;
    this.dragStartWorld = null;
    this.dragDirection = null;
    this.dragConstraint = null;
    this.dragStartPos = null;
    this.dragStartCell = null;
    this.currentDragLayer = 0; // Reset current drag layer
    this.isSelecting = false;
    this.rectangleSelectionMode = false;
    this.selectionStartScreen = null;
    
    // Remove drag direction helper
    if (this.dragDirectionHelper) {
      this.scene.remove(this.dragDirectionHelper);
      this.dragDirectionHelper = null;
    }
    
    // Handle specific button releases
    if (event.button === 1) { // Middle mouse
      this.isPanning = false;
      this.camera.endPan();
      this.endInteraction();
    } else if (event.button === 0 && this.isTumbling) { // Left mouse
      this.isTumbling = false;
      this.currentRotationAngle = this.targetRotationAngle; // Commit the rotation
      this.currentElevation = this.targetElevation; // Commit the elevation
      this.endInteraction();
    }
  }

  /**
   * Handle mouse wheel
   */
  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.startInteraction();
    
    // Update mouse coordinates using renderer's actual size
    const rect = this.renderer.domElement.getBoundingClientRect();
    
    // Simple NDC calculation without scaling
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Get world position under mouse for zoom-to-mouse
    // Use the current placement height if available
    const zoomPlaneHeight = this.targetLayer !== null ? this.targetLayer * this.VOXEL_SIZE : 0;
    const worldPos = this.getMouseWorldPosition(zoomPlaneHeight);
    
    // Normalize deltaY for consistent zoom speed across different devices
    // Some mice report 1, others 100, others 120 per notch
    const delta = Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 10);
    
    // Debug zoom
    // console.log(`Wheel event - deltaY: ${event.deltaY}, normalized delta: ${delta}`);
    
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
          const voxelIntersection = this.getVoxelIntersection();
          if (voxelIntersection) {
            this.removeVoxelAtLayer(voxelIntersection.gridCoord, voxelIntersection.layer);
          }
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
          const voxelIntersection = this.getVoxelIntersection();
          if (voxelIntersection) {
            this.removeVoxelAtLayer(voxelIntersection.gridCoord, voxelIntersection.layer);
          }
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
    // Don't process shortcuts if user is typing in an input field
    const activeElement = document.activeElement;
    if (activeElement && 
        (activeElement.tagName === 'INPUT' || 
         activeElement.tagName === 'TEXTAREA' ||
         activeElement.getAttribute('contenteditable') === 'true')) {
      return;
    }
    
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
      case 'a':
      case 'A':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          // Select all visible voxels
          // TODO: Implement select all
        } else if (this.state.mode === EditorMode.Select) {
          // Clear selection
          this.clearSelection();
        }
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
    // If we're dragging, handle preview differently
    if (this.isDrawing && this.dragStartLayer !== null && this.state.mode === EditorMode.Place && this.dragStartWorld) {
      // Get current mouse position in world space
      let worldPos: WorldPosition | null = null;
      
      if (this.dragConstraint === 'vertical') {
        // For vertical dragging, raycast at the current drag layer height
        const planeHeight = this.currentDragLayer * this.VOXEL_SIZE;
        worldPos = this.getMouseWorldPosition(planeHeight);
      } else if (this.dragConstraint === 'horizontal') {
        // For horizontal dragging, raycast at the drag start height
        const planeHeight = this.dragStartLayer * this.VOXEL_SIZE;
        worldPos = this.getMouseWorldPosition(planeHeight);
        
        if (worldPos && this.dragStartWorld) {
          // Project the mouse position onto the horizontal plane at drag start height
          // This keeps the preview aligned with the drag vector
          const mouseWorld = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
          
          // For pure horizontal constraint, we can optionally lock to axis
          // based on initial drag direction
          if (this.dragDirection) {
            // Enhanced vector projection for smoother dragging
            const dragVector = mouseWorld.clone().sub(this.dragStartWorld);
            
            // Calculate projection length with damping for stability
            const rawProjection = dragVector.dot(this.dragDirection);
            
            // Apply smoothing to reduce jitter
            const smoothingFactor = 0.85;
            const projectedLength = rawProjection * smoothingFactor;
            
            // Calculate projected position
            const projectedPos = this.dragStartWorld.clone().add(
              this.dragDirection.clone().multiplyScalar(projectedLength)
            );
            
            // Snap to grid for cleaner placement
            const gridSnappedPos = {
              x: Math.round(projectedPos.x / this.BASE_GRID_SIZE) * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5,
              y: projectedPos.y,
              z: Math.round(projectedPos.z / this.BASE_GRID_SIZE) * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5
            };
            
            worldPos = gridSnappedPos;
          }
        }
      } else {
        // No constraint yet - use ground plane
        worldPos = this.getMouseWorldPosition(0);
      }
      
      if (worldPos) {
        const gridCoord = CoordinateUtils.worldToGrid(worldPos, this.BASE_GRID_SIZE);
        
        // Update highlighted cell for horizontal dragging
        if (this.dragConstraint !== 'vertical') {
          this.state.highlightedCell = gridCoord;
          this.grid.highlightCell(gridCoord, this.BASE_GRID_SIZE);
        } else {
          // For vertical dragging, keep highlight at drag start position
          if (this.dragStartCell) {
            this.state.highlightedCell = this.dragStartCell;
            this.grid.highlightCell(this.dragStartCell, this.BASE_GRID_SIZE);
          }
        }
        
        // Show preview during drag
        if (this.previewGroup) {
          this.updateDragPreview(gridCoord);
        }
      }
      return;
    }
    
    // Normal (non-dragging) voxel intersection check
    const voxelIntersection = this.getVoxelIntersection();
    
    if (voxelIntersection && this.previewGroup) {
      const { position, normal, gridCoord, layer, voxelType, localPoint } = voxelIntersection;
      
      if (this.state.mode === EditorMode.Place) {
        // Show preview on the face of the intersected voxel for placement
        this.showPreviewOnFace(position, normal, gridCoord, layer, voxelType, localPoint);
        
        // Update highlighted cell to the target position
        const targetCoord = this.getTargetCoordFromFace(gridCoord, normal);
        if (targetCoord && (!this.state.highlightedCell || !CoordinateUtils.coordsEqual(this.state.highlightedCell, targetCoord))) {
          this.state.highlightedCell = targetCoord;
          this.grid.highlightCell(targetCoord, this.BASE_GRID_SIZE);
          this.updateHeightDisplay(targetCoord);
        }
      } else if (this.state.mode === EditorMode.Erase || this.state.mode === EditorMode.Select) {
        // For erase and select modes, highlight the existing voxel
        this.showVoxelHighlight(gridCoord, layer);
        
        // Update highlighted cell
        if (!this.state.highlightedCell || !CoordinateUtils.coordsEqual(this.state.highlightedCell, gridCoord)) {
          this.state.highlightedCell = gridCoord;
          this.grid.highlightCell(gridCoord, this.BASE_GRID_SIZE);
          this.updateHeightDisplay(gridCoord);
        }
      }
      return;
    }
    
    // Fall back to ground plane intersection
    // When placing on empty space, check if we should use a different plane height
    let fallbackPlaneHeight = 0;
    if (this.state.mode === EditorMode.Place && this.targetLayer !== null) {
      // If we have a target layer from previous placement, use that height
      fallbackPlaneHeight = this.targetLayer * this.VOXEL_SIZE;
    }
    
    const worldPos = this.getMouseWorldPosition(fallbackPlaneHeight);
    if (worldPos) {
      // Clear target layer and hide face highlight when not on a voxel face
      this.targetLayer = null;
      if (this.faceHighlightMesh) {
        this.faceHighlightMesh.visible = false;
      }
      
      // Convert world position to base grid coordinates
      const gridCoord = CoordinateUtils.worldToGrid(worldPos, this.BASE_GRID_SIZE);
      
      // Check if hovering over empty space (for initial placement)
      // For brush painting, we need to check if any of the cells in the brush area are filled
      const snappedX = Math.floor(gridCoord.x / this.brushSize) * this.brushSize;
      const snappedZ = Math.floor(gridCoord.z / this.brushSize) * this.brushSize;
      
      // Check all cells that the brush would paint
      let hasExistingVoxel = false;
      for (let dx = 0; dx < this.brushSize; dx++) {
        for (let dz = 0; dz < this.brushSize; dz++) {
          const checkCoord = { x: snappedX + dx, z: snappedZ + dz };
          if (this.tileSystem.getTile(checkCoord) !== VoxelType.Air) {
            hasExistingVoxel = true;
            break;
          }
        }
        if (hasExistingVoxel) break;
      }
      
      // Show preview for placement - during dragging or on empty cells
      const showPreview = this.previewGroup && this.state.mode === EditorMode.Place && 
                         (!hasExistingVoxel || (this.isDrawing && this.dragStartLayer !== null));
      
      if (showPreview) {
        // Calculate preview position for the brush area
        // Snap brush position to align with grid
        const snappedBrushX = Math.floor(gridCoord.x / this.brushSize) * this.brushSize;
        const snappedBrushZ = Math.floor(gridCoord.z / this.brushSize) * this.brushSize;
        let previewX = snappedBrushX * this.BASE_GRID_SIZE + this.brushSize * this.VOXEL_SIZE * 0.5;
        let previewZ = snappedBrushZ * this.BASE_GRID_SIZE + this.brushSize * this.VOXEL_SIZE * 0.5;
        // Calculate preview Y position based on drag constraint
        let previewY = this.VOXEL_SIZE / 2; // Default ground level
        let previewLayer = 0; // Default layer
        
        if (this.isDrawing && this.dragStartLayer !== null) {
          if (this.dragConstraint === 'vertical' && this.dragStartPos && this.stackMode) {
            // For vertical dragging, use the currentDragLayer we're tracking
            previewY = this.VOXEL_SIZE / 2 + this.currentDragLayer * this.VOXEL_SIZE;
            previewLayer = this.currentDragLayer;
            // Also update the preview position to stay at the drag start cell
            if (this.dragStartCell) {
              const dragSnappedX = Math.floor(this.dragStartCell.x / this.brushSize) * this.brushSize;
              const dragSnappedZ = Math.floor(this.dragStartCell.z / this.brushSize) * this.brushSize;
              previewX = dragSnappedX * this.BASE_GRID_SIZE + this.brushSize * this.VOXEL_SIZE * 0.5;
              previewZ = dragSnappedZ * this.BASE_GRID_SIZE + this.brushSize * this.VOXEL_SIZE * 0.5;
            }
          } else {
            // Horizontal dragging - maintain start layer
            previewY = this.VOXEL_SIZE / 2 + this.dragStartLayer * this.VOXEL_SIZE;
            previewLayer = this.dragStartLayer;
          }
        }
        
        // Check if the target position is already occupied
        const targetGridCoord = this.dragConstraint === 'vertical' && this.dragStartCell ? this.dragStartCell : gridCoord;
        const isOccupied = this.tileSystem.getTileMeshes().some(mesh => {
          const { coord, layer } = mesh.userData;
          return coord.x === targetGridCoord.x && coord.z === targetGridCoord.z && layer === previewLayer;
        });
        
        // Only show preview if position is not occupied
        if (!isOccupied) {
          // Debug: log positions to verify alignment
          // console.log(`Grid coord: (${gridCoord.x}, ${gridCoord.z}), Preview pos: (${previewX.toFixed(3)}, ${previewZ.toFixed(3)}), Tile size: ${this.tileSize}`);
          
          this.previewGroup.position.set(previewX, previewY, previewZ);
          this.previewGroup.visible = true;
          
          // Update alignment cage position
          if (this.alignmentCage) {
            this.alignmentCage.position.set(previewX, previewY, previewZ);
            this.alignmentCage.visible = true;
          }
        } else {
          this.previewGroup.visible = false;
          if (this.alignmentCage) {
            this.alignmentCage.visible = false;
          }
        }
        
        if (this.previewMaterial) {
          (this.previewMaterial as THREE.MeshBasicMaterial).color.setHex(0x00FF00);
          (this.previewMaterial as THREE.MeshBasicMaterial).opacity = 0.4;
        }
        
        // Don't show alignment lines for ground placement
        if (this.alignmentLinesGroup) {
          this.alignmentLinesGroup.visible = false;
        }
      } else if (this.previewGroup) {
        this.previewGroup.visible = false;
        if (this.alignmentCage) {
          this.alignmentCage.visible = false;
        }
        // Hide alignment lines when not placing
        if (this.alignmentLinesGroup) {
          this.alignmentLinesGroup.visible = false;
        }
      }
      
      // Update highlighted cell - use the snapped coordinate for larger voxels
      const highlightCoord = { x: snappedX, z: snappedZ };
      if (!this.state.highlightedCell || !CoordinateUtils.coordsEqual(this.state.highlightedCell, highlightCoord)) {
        this.state.highlightedCell = highlightCoord;
        // Highlight with the actual voxel size
        this.grid.highlightCell(highlightCoord, this.brushSize * this.VOXEL_SIZE);
        
        // Update height display for preview
        this.updateHeightDisplay(highlightCoord);
      }
    } else {
      this.grid.clearHighlight();
      this.state.highlightedCell = null;
      
      // Hide preview, face highlight and alignment lines
      if (this.previewGroup) {
        this.previewGroup.visible = false;
      }
      if (this.alignmentCage) {
        this.alignmentCage.visible = false;
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
      const baseHeight = this.tileSystem.getBaseWorldHeight(this.state.highlightedCell, this.VOXEL_SIZE);
      const subGridPos = `(${(this.state.highlightedCell.x * this.BASE_GRID_SIZE).toFixed(2)}, ${(this.state.highlightedCell.z * this.BASE_GRID_SIZE).toFixed(2)})`;
      
      // Add drag constraint indicator with direction info
      let constraintInfo = '';
      if (this.isDrawing && this.dragConstraint) {
        const constraintText = this.dragConstraint === 'horizontal' ? 'Horizontal' : 
                              this.dragConstraint === 'vertical' ? 'Vertical' : 'Free';
        
        // Add direction vector info for horizontal dragging
        let directionInfo = '';
        if (this.dragConstraint === 'horizontal' && this.dragDirection) {
          const dirX = this.dragDirection.x;
          const dirZ = this.dragDirection.z;
          
          // Determine cardinal direction
          let cardinal = '';
          if (Math.abs(dirX) > Math.abs(dirZ)) {
            cardinal = dirX > 0 ? 'E' : 'W';
          } else {
            cardinal = dirZ > 0 ? 'N' : 'S';
          }
          
          directionInfo = ` [${cardinal}]`;
        } else if (this.dragConstraint === 'vertical') {
          const layerInfo = this.currentDragLayer;
          directionInfo = ` [Layer ${layerInfo}]`;
        }
        
        constraintInfo = ` | Drag: ${constraintText}${directionInfo}`;
      }
      
      // Update coordinate display (first child)
      const coordElement = this.coordinateDisplay.children[0] as HTMLElement;
      if (coordElement) {
        coordElement.textContent = `Sub-Grid: ${subGridPos} | Height: ${baseHeight.toFixed(1)}m | Mode: ${mode}${constraintInfo}`;
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
   * Update preview during drag operations
   */
  private updateDragPreview(gridCoord: GridCoordinate): void {
    if (!this.previewGroup) return;
    
    // Calculate snapped position for brush area
    const snappedX = Math.floor(gridCoord.x / this.brushSize) * this.brushSize;
    const snappedZ = Math.floor(gridCoord.z / this.brushSize) * this.brushSize;
    let previewX = snappedX * this.BASE_GRID_SIZE + this.brushSize * this.VOXEL_SIZE * 0.5;
    let previewZ = snappedZ * this.BASE_GRID_SIZE + this.brushSize * this.VOXEL_SIZE * 0.5;
    let previewY = this.VOXEL_SIZE / 2; // Default ground level
    let previewLayer = 0;
    
    if (this.dragConstraint === 'vertical' && this.stackMode) {
      // For vertical dragging, lock X,Z to start position and adjust Y
      if (this.dragStartCell) {
        const dragSnappedX = Math.floor(this.dragStartCell.x / this.brushSize) * this.brushSize;
        const dragSnappedZ = Math.floor(this.dragStartCell.z / this.brushSize) * this.brushSize;
        previewX = dragSnappedX * this.BASE_GRID_SIZE + this.brushSize * this.VOXEL_SIZE * 0.5;
        previewZ = dragSnappedZ * this.BASE_GRID_SIZE + this.brushSize * this.VOXEL_SIZE * 0.5;
      }
      previewY = this.VOXEL_SIZE / 2 + this.currentDragLayer * this.VOXEL_SIZE;
      previewLayer = this.currentDragLayer;
    } else if (this.dragConstraint === 'horizontal' && this.stackMode) {
      // For horizontal dragging in stack mode, find the top layer at current position
      // Exclude tiles placed during this drag operation
      const topLayer = this.isDrawing ? this.getTopLayerExcludingCurrentDrag(gridCoord) : this.tileSystem.getTopLayer(gridCoord);
      previewLayer = topLayer + 1;
      previewY = this.VOXEL_SIZE / 2 + previewLayer * this.VOXEL_SIZE;
    } else {
      // For non-stack mode, maintain the drag start layer
      previewY = this.VOXEL_SIZE / 2 + (this.dragStartLayer || 0) * this.VOXEL_SIZE;
      previewLayer = this.dragStartLayer || 0;
    }
    
    // Check if position is occupied at the preview layer
    const targetCoord = this.dragConstraint === 'vertical' && this.dragStartCell ? this.dragStartCell : gridCoord;
    const isOccupied = this.tileSystem.getTileMeshes().some(mesh => {
      const { coord, layer } = mesh.userData;
      return coord.x === targetCoord.x && coord.z === targetCoord.z && layer === previewLayer;
    });
    
    // Show preview only if position is not occupied
    if (!isOccupied) {
      this.previewGroup.position.set(previewX, previewY, previewZ);
      this.previewGroup.visible = true;
      
      // Update alignment cage position
      if (this.alignmentCage) {
        this.alignmentCage.position.set(previewX, previewY, previewZ);
        this.alignmentCage.visible = true;
      }
    } else {
      this.previewGroup.visible = false;
      if (this.alignmentCage) {
        this.alignmentCage.visible = false;
      }
    }
    
    // Update material
    if (this.previewMaterial) {
      (this.previewMaterial as THREE.MeshBasicMaterial).color.setHex(0xFF0000);
      (this.previewMaterial as THREE.MeshBasicMaterial).opacity = 0.8;
    }
    
    // Hide face highlight and alignment lines during drag
    if (this.faceHighlightMesh) {
      this.faceHighlightMesh.visible = false;
    }
    if (this.alignmentLinesGroup) {
      this.alignmentLinesGroup.visible = false;
    }
  }

  /**
   * Get mouse position in world space
   */
  private getMouseWorldPosition(planeHeight: number = 0): WorldPosition | null {
    // Ensure camera matrices are up to date
    const cam = this.camera.getCamera();
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    
    // For orthographic camera, we need to ensure proper raycaster setup
    this.raycaster.setFromCamera(this.mouse, cam);
    
    // Create a plane at the specified height
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeHeight);
    
    // Debug logging - uncomment to diagnose mouse offset issues
    // const rayOrigin = this.raycaster.ray.origin.clone();
    // const rayDirection = this.raycaster.ray.direction.clone();
    // console.log(`Mouse NDC: (${this.mouse.x.toFixed(3)}, ${this.mouse.y.toFixed(3)})`);
    // console.log(`Ray origin: (${rayOrigin.x.toFixed(3)}, ${rayOrigin.y.toFixed(3)}, ${rayOrigin.z.toFixed(3)})`);
    // console.log(`Ray direction: (${rayDirection.x.toFixed(3)}, ${rayDirection.y.toFixed(3)}, ${rayDirection.z.toFixed(3)})`);
    
    const intersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, intersection)) {
      // console.log(`World intersection: (${intersection.x.toFixed(3)}, ${intersection.y.toFixed(3)}, ${intersection.z.toFixed(3)})`);
      // console.log(`Grid coord: (${Math.floor(intersection.x / 0.1)}, ${Math.floor(intersection.z / 0.1)})`);
      
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
      // For orthographic cameras, we need to be more careful about which intersection to use
      // Sort by distance to ensure we get the closest face
      intersections.sort((a, b) => a.distance - b.distance);
      
      // Filter out intersections that are behind the camera or at grazing angles
      const validIntersections = intersections.filter(intersection => {
        if (!intersection.face) return false;
        
        // Get the face normal in world space
        const mesh = intersection.object as THREE.Mesh;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        const worldNormal = intersection.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        
        // Check if the face is pointing towards the camera (dot product with ray direction)
        const dotProduct = worldNormal.dot(this.raycaster.ray.direction);
        
        // Only consider faces that are facing the camera (negative dot product)
        // and not at too shallow an angle (which can cause precision issues)
        return dotProduct < -0.1; // Threshold to avoid grazing angles
      });
      
      if (validIntersections.length > 0) {
        const intersection = validIntersections[0];
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
    }
    
    return null;
  }
  
  /**
   * Check if a point is near a voxel edge
   */
  private isNearEdge(localPoint: THREE.Vector3, normal: THREE.Vector3): boolean {
    const edgeThreshold = 0.02; // Within 2cm of edge (relative to voxel size)
    const halfSize = this.VOXEL_SIZE / 2; // Half of the voxel height
    
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
   * Show voxel highlight for erase/select modes
   */
  private showVoxelHighlight(coord: GridCoordinate, layer: number): void {
    if (!this.previewGroup) return;
    
    // Position preview over the existing voxel
    const layerHeight = this.VOXEL_SIZE;
    const y = layerHeight / 2 + (layer * layerHeight);
    
    // For existing voxels, we use the coordinate as stored (already in base grid units)
    this.previewGroup.position.set(
      coord.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5,
      y,
      coord.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5
    );
    
    this.previewGroup.visible = true;
    
    // Update alignment cage position and visibility
    if (this.alignmentCage) {
      this.alignmentCage.position.set(
        coord.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5,
        y,
        coord.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5
      );
      this.alignmentCage.visible = true;
    }
    
    // Update preview appearance based on mode
    if (this.previewMaterial) {
      const material = this.previewMaterial as THREE.MeshBasicMaterial;
      if (this.state.mode === EditorMode.Erase) {
        material.color.setHex(0xFF0000); // Red for erase
        material.opacity = 0.6;
      } else if (this.state.mode === EditorMode.Select) {
        material.color.setHex(0x0080FF); // Blue for select
        material.opacity = 0.8;
      }
    }
    
    // Hide face highlight and alignment lines
    if (this.faceHighlightMesh) {
      this.faceHighlightMesh.visible = false;
    }
    if (this.alignmentLinesGroup) {
      this.alignmentLinesGroup.visible = false;
    }
  }
  
  /**
   * Show preview on a specific face of a voxel
   */
  private showPreviewOnFace(position: THREE.Vector3, normal: THREE.Vector3, sourceCoord: GridCoordinate, sourceLayer: number, voxelType: VoxelType, localPoint: THREE.Vector3): void {
    if (!this.previewGroup) return;
    
    // Debug: Log face detection
    // console.log(`Face detected - Normal: (${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)}), Layer: ${sourceLayer}`);
    
    // Show face highlight
    this.showFaceHighlight(sourceCoord, normal, sourceLayer);
    
    // Get the target coordinate based on the face normal
    const targetCoord = this.getTargetCoordFromFace(sourceCoord, normal);
    if (!targetCoord) return;
    
    // Get the Y position of the source voxel using the actual layer clicked
    const layerHeight = this.VOXEL_SIZE;
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
    
    // Check if the target position is already occupied
    const isOccupied = this.tileSystem.getTileMeshes().some(mesh => {
      const { coord, layer } = mesh.userData;
      return coord.x === targetCoord.x && coord.z === targetCoord.z && layer === targetLayerNum;
    });
    
    // If position is occupied, don't show preview or store target layer
    if (isOccupied) {
      this.previewGroup.visible = false;
      if (this.alignmentCage) {
        this.alignmentCage.visible = false;
      }
      this.targetLayer = null;
      return;
    }
    
    // Store the target layer for placement
    this.targetLayer = targetLayerNum;
    
    // Debug: Log target layer calculation
    // console.log(`Target layer set to: ${targetLayerNum} (from source layer: ${sourceLayer}, normal.y: ${normal.y})`);
    
    this.previewGroup.position.set(
      targetCoord.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5,
      targetY,
      targetCoord.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5
    );
    
    this.previewGroup.visible = true;
    
    // Update alignment cage position and visibility
    if (this.alignmentCage) {
      this.alignmentCage.position.set(
        targetCoord.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5,
        targetY,
        targetCoord.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5
      );
      this.alignmentCage.visible = true;
    }
    
    // Update preview appearance
    if (this.previewMaterial) {
      (this.previewMaterial as THREE.MeshBasicMaterial).color.setHex(0xFF0000);
      (this.previewMaterial as THREE.MeshBasicMaterial).opacity = 0.8;
    }
    
    // Show alignment lines for the hovered voxel face
    this.updateAlignmentLines(
      sourceCoord.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5,
      sourceY,
      sourceCoord.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5,
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
    const layerHeight = this.VOXEL_SIZE;
    const voxelY = layerHeight / 2 + (layer * layerHeight);
    
    // Calculate face center position
    const centerX = coord.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5;
    const centerZ = coord.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5;
    
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
        centerX + (normal.x > 0 ? this.VOXEL_SIZE/2 + offset : -this.VOXEL_SIZE/2 - offset),
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
        centerZ + (normal.z > 0 ? this.VOXEL_SIZE/2 + offset : -this.VOXEL_SIZE/2 - offset)
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
    
    // For face-based placement, offset by the brush size
    if (Math.abs(normal.x) > threshold) {
      // Offset by the brush size in grid units
      offsetX = normal.x > 0 ? this.brushSize : -this.brushSize;
    } else if (Math.abs(normal.z) > threshold) {
      // Offset by the brush size in grid units
      offsetZ = normal.z > 0 ? this.brushSize : -this.brushSize;
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
   * Toggle selection of a voxel
   */
  private toggleVoxelSelection(coord: GridCoordinate, layer: number): void {
    const key = `${coord.x},${coord.z},${layer}`;
    
    if (this.state.selectedVoxels.has(key)) {
      // Deselect
      this.state.selectedVoxels.delete(key);
      this.removeSelectionHighlight(key);
    } else {
      // Select
      this.state.selectedVoxels.add(key);
      this.addSelectionHighlight(coord, layer);
    }
  }
  
  /**
   * Add selection highlight mesh
   */
  private addSelectionHighlight(coord: GridCoordinate, layer: number): void {
    const key = `${coord.x},${coord.z},${layer}`;
    
    // Remove existing highlight if any
    this.removeSelectionHighlight(key);
    
    // Create selection highlight mesh
    const geometry = new THREE.BoxGeometry(this.VOXEL_SIZE, this.VOXEL_SIZE, this.VOXEL_SIZE);
    const mesh = new THREE.Mesh(geometry, this.selectionMaterial!);
    
    // Position the highlight
    const layerHeight = this.VOXEL_SIZE;
    const y = layerHeight / 2 + (layer * layerHeight);
    mesh.position.set(
      coord.x * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5,
      y,
      coord.z * this.BASE_GRID_SIZE + this.BASE_GRID_SIZE * 0.5
    );
    
    // Make it slightly larger to encompass the voxel
    mesh.scale.set(1.05, 1.05, 1.05);
    
    this.scene.add(mesh);
    this.selectionMeshes.set(key, mesh);
  }
  
  /**
   * Remove selection highlight mesh
   */
  private removeSelectionHighlight(key: string): void {
    const mesh = this.selectionMeshes.get(key);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.selectionMeshes.delete(key);
    }
  }
  
  /**
   * Clear all selections
   */
  private clearSelection(): void {
    this.state.selectedVoxels.clear();
    this.selectionMeshes.forEach((mesh, key) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    this.selectionMeshes.clear();
  }
  
  /**
   * Update selection rectangle visual
   */
  private updateSelectionRectangle(currentX: number, currentY: number): void {
    if (!this.selectionRectangle || !this.selectionStartScreen) return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    const startX = this.selectionStartScreen.x - rect.left;
    const startY = this.selectionStartScreen.y - rect.top;
    const endX = currentX - rect.left;
    const endY = currentY - rect.top;
    
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    this.selectionRectangle.style.left = `${left}px`;
    this.selectionRectangle.style.top = `${top}px`;
    this.selectionRectangle.style.width = `${width}px`;
    this.selectionRectangle.style.height = `${height}px`;
    this.selectionRectangle.style.display = 'block';
  }
  
  /**
   * Hide selection rectangle
   */
  private hideSelectionRectangle(): void {
    if (this.selectionRectangle) {
      this.selectionRectangle.style.display = 'none';
    }
  }
  
  /**
   * Complete rectangle selection
   */
  private completeRectangleSelection(endX: number, endY: number): void {
    if (!this.selectionStartScreen) return;
    
    // Get screen bounds
    const minX = Math.min(this.selectionStartScreen.x, endX);
    const maxX = Math.max(this.selectionStartScreen.x, endX);
    const minY = Math.min(this.selectionStartScreen.y, endY);
    const maxY = Math.max(this.selectionStartScreen.y, endY);
    
    // Get all tile meshes
    const tileMeshes = this.tileSystem.getTileMeshes();
    
    // Check each voxel if it's within the rectangle
    tileMeshes.forEach(mesh => {
      const { coord, layer } = mesh.userData;
      
      // Project voxel position to screen
      const worldPos = mesh.position.clone();
      const screenPos = this.worldToScreen(worldPos);
      
      // Check if within rectangle
      if (screenPos.x >= minX && screenPos.x <= maxX && 
          screenPos.y >= minY && screenPos.y <= maxY) {
        // Add to selection
        const key = `${coord.x},${coord.z},${layer}`;
        if (!this.state.selectedVoxels.has(key)) {
          this.state.selectedVoxels.add(key);
          this.addSelectionHighlight(coord, layer);
        }
      }
    });
  }
  
  /**
   * Update drag direction visualization helper
   */
  private updateDragDirectionHelper(): void {
    // Remove existing helper
    if (this.dragDirectionHelper) {
      this.scene.remove(this.dragDirectionHelper);
      this.dragDirectionHelper = null;
    }
    
    // Only show for horizontal dragging
    if (this.dragConstraint === 'horizontal' && this.dragStartWorld && this.dragDirection) {
      const origin = this.dragStartWorld.clone();
      origin.y += 0.1; // Slightly above the voxels
      
      const length = 3; // Length of the arrow
      const color = 0x00ff00; // Green color
      const headLength = 0.3;
      const headWidth = 0.2;
      
      this.dragDirectionHelper = new THREE.ArrowHelper(
        this.dragDirection,
        origin,
        length,
        color,
        headLength,
        headWidth
      );
      
      this.scene.add(this.dragDirectionHelper);
    }
  }
  
  /**
   * Convert world position to screen coordinates
   */
  private worldToScreen(worldPos: THREE.Vector3): THREE.Vector2 {
    const vector = worldPos.clone();
    vector.project(this.camera.getCamera());
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = (vector.x + 1) * rect.width / 2 + rect.left;
    const y = (-vector.y + 1) * rect.height / 2 + rect.top;
    
    return new THREE.Vector2(x, y);
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
    const voxelIntersection = this.getVoxelIntersection();
    if (voxelIntersection) {
      this.removeVoxelAtLayer(voxelIntersection.gridCoord, voxelIntersection.layer);
    }
  }

  /**
   * Place tile at grid position
   */
  private placeVoxel(gridCoord: GridCoordinate): void {
    // Use the highlighted cell which has already been calculated based on face detection
    const targetCoord = this.state.highlightedCell || gridCoord;
    
    // Debug: log placement position
    // const baseGridSize = 0.1;
    // const worldX = targetCoord.x * baseGridSize + baseGridSize * 0.5;
    // const worldZ = targetCoord.z * baseGridSize + baseGridSize * 0.5;
    // console.log(`Placing voxel at grid (${targetCoord.x}, ${targetCoord.z}), world (${worldX.toFixed(3)}, ${worldZ.toFixed(3)}), tile size: ${this.tileSize}`);
    
    // Capture state before placing
    const beforeState = this.captureTileState(targetCoord);
    
    // Determine the layer to use based on context
    let layerToUse: number | null = null;
    
    if (this.isDrawing) {
      // When dragging, handle different constraints
      if (this.dragConstraint === 'vertical' && this.stackMode) {
        // For vertical dragging, use the current drag layer
        layerToUse = this.currentDragLayer;
      } else if (this.dragConstraint === 'horizontal' && this.stackMode) {
        // For horizontal dragging in stack mode, stack on top of existing voxels
        // But exclude voxels placed during this drag operation
        const topLayer = this.getTopLayerExcludingCurrentDrag(targetCoord);
        layerToUse = topLayer + 1;
      } else {
        // Non-stack mode or no constraint - use drag start layer
        layerToUse = this.dragStartLayer;
      }
    } else {
      // Not dragging - use target layer from face detection
      layerToUse = this.targetLayer;
    }
    
    // console.log(`PlaceVoxel at (${targetCoord.x}, ${targetCoord.z}) - Using layer: ${layerToUse}, targetLayer: ${this.targetLayer}, isDrawing: ${this.isDrawing}, dragConstraint: ${this.dragConstraint}, dragStartLayer: ${this.dragStartLayer}`);
    
    // Check if we have a specific layer
    if (layerToUse !== null && this.stackMode) {
      // Use specific layer placement for face-based placement only in stack mode
      this.tileSystem.placeTileAtLayer(targetCoord, this.selectedVoxelType, layerToUse);
      // Only reset targetLayer if we're not dragging
      if (!this.isDrawing) {
        this.targetLayer = null;
      }
    } else {
      // Fall back to normal placement logic
      const shouldStackOnTop = !this.replaceMode && this.stackMode;
      this.tileSystem.placeTile(targetCoord, this.selectedVoxelType, shouldStackOnTop, this.replaceMode, this.stackDirection);
    }
    
    // Capture state after placing
    const afterState = this.captureTileState(targetCoord);
    
    // Track tiles placed during this drag operation
    if (this.isDrawing && layerToUse !== null) {
      const key = `${targetCoord.x},${targetCoord.z},${layerToUse}`;
      this.tilesPlacedDuringDrag.add(key);
    }
    
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
   * Remove tile at specific layer
   */
  private removeVoxelAtLayer(gridCoord: GridCoordinate, layer: number): void {
    // Capture state before removing
    const beforeState = this.captureTileState(gridCoord);
    const tileAtLayer = beforeState.find(t => t.layer === layer);
    
    // Only record action if there was something to remove at this layer
    if (tileAtLayer) {
      this.tileSystem.removeTileAtLayer(gridCoord, layer);
      
      // Record action for undo/redo
      const action: EditorAction = {
        type: ActionType.REMOVE,
        coord: { ...gridCoord },
        removedTiles: [tileAtLayer]
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
        // Use placeVoxel which now handles all the layer logic correctly
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
    if (this.previewGroup && this.previewMaterial) {
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
   * Set brush size (called by TilePalette)
   */
  public setBrushSize(size: number): void {
    // Convert tile size values to brush sizes (1, 2, 3, 5, 10)
    let brushSizeInVoxels = 1;
    if (size <= 0.1) {
      brushSizeInVoxels = 1;
    } else if (size <= 0.2) {
      brushSizeInVoxels = 2;
    } else if (size <= 0.3) {
      brushSizeInVoxels = 3;
    } else if (size <= 0.5) {
      brushSizeInVoxels = 5;
    } else {
      brushSizeInVoxels = 10;
    }
    
    this.brushSize = brushSizeInVoxels;
    this.tileSystem.setBrushSize(brushSizeInVoxels);
    this.updatePreviewGeometry();
    this.updateAlignmentCage();
    console.log('Brush size:', brushSizeInVoxels + 'x' + brushSizeInVoxels + ' voxels');
  }
  
  /**
   * Update alignment cage to show which base grid cells will be occupied
   */
  private updateAlignmentCage(): void {
    if (!this.alignmentCage) return;
    
    // Clear existing cage
    while (this.alignmentCage.children.length > 0) {
      const child = this.alignmentCage.children[0];
      this.alignmentCage.remove(child);
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    
    // Calculate how many base grid cells this brush occupies
    const cellsPerSide = this.brushSize;
    
    // Create grid lines for the cage
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00FFFF, // Cyan for visibility
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });
    
    // Create horizontal lines
    const points: THREE.Vector3[] = [];
    const halfSize = (this.brushSize * this.VOXEL_SIZE) / 2;
    
    for (let i = 0; i <= cellsPerSide; i++) {
      const offset = -halfSize + i * this.BASE_GRID_SIZE;
      // X-direction lines
      points.push(new THREE.Vector3(-halfSize, 0.01, offset));
      points.push(new THREE.Vector3(halfSize, 0.01, offset));
      // Z-direction lines
      points.push(new THREE.Vector3(offset, 0.01, -halfSize));
      points.push(new THREE.Vector3(offset, 0.01, halfSize));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const lines = new THREE.LineSegments(geometry, lineMaterial);
    this.alignmentCage.add(lines);
  }

  /**
   * Update preview mesh geometry to match current brush size
   */
  private updatePreviewGeometry(): void {
    if (!this.previewGroup || !this.previewMaterial) return;
    
    // Clear existing preview voxels
    while (this.previewGroup.children.length > 0) {
      const child = this.previewGroup.children[0];
      this.previewGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        // Remove edge children
        while (child.children.length > 0) {
          const edgeChild = child.children[0];
          child.remove(edgeChild);
          if (edgeChild instanceof THREE.LineSegments) {
            edgeChild.geometry.dispose();
            (edgeChild.material as THREE.Material).dispose();
          }
        }
      }
    }
    
    // Create voxels for the brush area
    const voxelGeometry = new THREE.BoxGeometry(this.VOXEL_SIZE, this.VOXEL_SIZE, this.VOXEL_SIZE);
    const edgesMaterial = new THREE.LineBasicMaterial({ 
      color: 0xFFFFFF,
      linewidth: 2,
      transparent: true,
      opacity: 0.6
    });
    
    for (let dx = 0; dx < this.brushSize; dx++) {
      for (let dz = 0; dz < this.brushSize; dz++) {
        // Create voxel mesh
        const voxelMesh = new THREE.Mesh(voxelGeometry, this.previewMaterial);
        voxelMesh.renderOrder = 1;
        
        // Position relative to brush origin (bottom-left corner)
        voxelMesh.position.set(
          dx * this.VOXEL_SIZE,
          0,
          dz * this.VOXEL_SIZE
        );
        
        // Add edges
        const edgesGeometry = new THREE.EdgesGeometry(voxelGeometry);
        const edgesMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial.clone());
        voxelMesh.add(edgesMesh);
        
        this.previewGroup.add(voxelMesh);
      }
    }
    
    // Add center marker at brush center
    const centerOffset = (this.brushSize * this.VOXEL_SIZE) / 2;
    const sphereGeometry = new THREE.SphereGeometry(0.02, 8, 8);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xFF0000,
      depthWrite: false,
      depthTest: false 
    });
    const centerMarker = new THREE.Mesh(sphereGeometry, sphereMaterial);
    centerMarker.position.set(centerOffset, this.VOXEL_SIZE / 2, centerOffset);
    this.previewGroup.add(centerMarker);
    
    // Update face highlight if it exists
    if (this.faceHighlightMesh) {
      this.faceHighlightMesh.geometry.dispose();
      this.faceHighlightMesh.geometry = new THREE.PlaneGeometry(this.VOXEL_SIZE * 0.98, this.VOXEL_SIZE * 0.98);
    }
  }
  
  /**
   * Get current voxel size
   */
  public getVoxelSize(): number {
    return this.VOXEL_SIZE;
  }
  
  /**
   * Get current brush size
   */
  public getBrushSize(): number {
    return this.brushSize;
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
   * Get the top layer at a coordinate, excluding tiles placed during the current drag
   */
  private getTopLayerExcludingCurrentDrag(coord: GridCoordinate): number {
    let topLayer = -1;
    // Check each layer from bottom to top
    for (let layer = 0; layer < 50; layer++) { // maxLayers from SimpleTileSystem
      const key = `${coord.x},${coord.z},${layer}`;
      // Skip if this tile was placed during the current drag
      if (this.tilesPlacedDuringDrag.has(key)) {
        continue;
      }
      // Check if there's a tile at this layer
      const mesh = (this.tileSystem as any).tiles.get(key);
      if (mesh) {
        topLayer = layer;
      }
    }
    return topLayer;
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
    
    // Smooth camera tumbling animation
    if (Math.abs(this.animatedRotationAngle - this.targetRotationAngle) > 0.1 || 
        Math.abs(this.animatedElevation - this.targetElevation) > 0.01) {
      // Lerp rotation angle
      this.animatedRotationAngle += (this.targetRotationAngle - this.animatedRotationAngle) * this.TUMBLE_SMOOTH_FACTOR;
      this.animatedElevation += (this.targetElevation - this.animatedElevation) * this.TUMBLE_SMOOTH_FACTOR;
      
      // Update camera with interpolated values
      this.updateCameraRotation(this.animatedRotationAngle, this.animatedElevation);
    }
    
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
   * Update camera rotation with snap angles
   */
  private updateCameraRotation(angle: number, elevation: number = 0): void {
    // Normalize angle to 0-360 range
    const normalizedAngle = ((angle % 360) + 360) % 360;
    
    // Apply rotation and elevation to camera
    this.camera.setRotation(normalizedAngle, elevation);
    
    // Update info panel mini scene to match
    if (this.infoPanel) {
      this.infoPanel.updateCameraOrientation(normalizedAngle, elevation);
    }
    
    // Update grid highlight since view has changed
    this.updateGridHighlight();
  }

  /**
   * Dispose of resources
   */
  /**
   * Show save dialog
   */
  public showSaveDialog(): void {
    // Create modal content
    const content = document.createElement('div');
    content.style.padding = 'var(--space-3) 0';
    
    // Add description
    const description = document.createElement('p');
    description.style.marginBottom = 'var(--space-4)';
    description.style.color = 'var(--text-secondary)';
    description.style.fontSize = 'var(--font-size-sm)';
    description.textContent = 'Enter a name for your level:';
    content.appendChild(description);
    
    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input';
    input.placeholder = 'My Level';
    input.value = `Level ${new Date().toLocaleDateString()}`;
    input.style.width = '100%';
    content.appendChild(input);
    
    // Create modal
    const modal = (window as any).UI.modal({
      title: 'Save Level',
      content: content,
      size: 'sm',
      footer: [
        {
          text: 'Cancel',
          variant: 'secondary',
          onClick: () => modal.close()
        },
        {
          text: 'Save',
          variant: 'primary',
          onClick: () => {
            const filename = input.value.trim() || 'Untitled Level';
            this.saveLevel(filename);
            modal.close();
          }
        }
      ]
    });
    
    // Show modal
    modal.open();
    
    // Focus input and select text
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);
    
    // Handle enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const filename = input.value.trim() || 'Untitled Level';
        this.saveLevel(filename);
        modal.close();
      }
    });
  }
  
  /**
   * Save the current level to a JSON file
   */
  public saveLevel(filename: string = 'level'): void {
    // Generate thumbnail first
    const thumbnail = this.generateThumbnail();
    
    // Get tile data from the tile system
    const tiles = this.tileSystem.serialize();
    
    // Create save data object
    const saveData = {
      version: 1,
      tiles: tiles,
      camera: {
        zoom: this.camera.getCamera().zoom,
        x: this.camera.getTarget().x,
        z: this.camera.getTarget().z
      },
      thumbnail: thumbnail
    };
    
    // Convert to JSON
    const json = JSON.stringify(saveData, null, 2);
    
    // Sanitize filename
    const sanitizedFilename = filename
      .replace(/[^a-z0-9\s\-_]/gi, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase() || 'level';
    
    // Create blob and download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizedFilename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Save to recent levels in localStorage
    this.addToRecentLevels(a.download, saveData);
    
    // Show success message
    if (window.styleUI && window.styleUI.showToast) {
      window.styleUI.showToast(`Level saved as ${a.download}`, 'success');
    }
  }
  
  /**
   * Generate a thumbnail of the current scene
   */
  private generateThumbnail(): string {
    // Set thumbnail size
    const thumbnailWidth = 128;
    const thumbnailHeight = 96;
    
    // Create a temporary renderer for the thumbnail
    const thumbnailRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    thumbnailRenderer.setSize(thumbnailWidth, thumbnailHeight);
    thumbnailRenderer.setPixelRatio(1); // Use pixel ratio 1 for consistent thumbnails
    
    // Copy renderer settings
    thumbnailRenderer.shadowMap.enabled = this.renderer.shadowMap.enabled;
    thumbnailRenderer.shadowMap.type = this.renderer.shadowMap.type;
    thumbnailRenderer.toneMapping = this.renderer.toneMapping;
    thumbnailRenderer.toneMappingExposure = this.renderer.toneMappingExposure;
    
    // Render the scene with the thumbnail renderer
    thumbnailRenderer.render(this.scene, this.camera.getCamera());
    
    // Get the data URL
    const dataURL = thumbnailRenderer.domElement.toDataURL('image/jpeg', 0.7);
    
    // Clean up the temporary renderer
    thumbnailRenderer.dispose();
    
    // Return base64 string without the data URL prefix
    return dataURL.replace(/^data:image\/jpeg;base64,/, '');
  }
  
  /**
   * Add a level to the recent levels list
   */
  private addToRecentLevels(filename: string, levelData: any): void {
    try {
      const recentLevels = this.getRecentLevels();
      
      // Add new level to the beginning
      recentLevels.unshift({
        name: filename,
        timestamp: Date.now(),
        data: levelData
      });
      
      // Keep only the last 10 levels
      if (recentLevels.length > 10) {
        recentLevels.length = 10;
      }
      
      localStorage.setItem('nevereverland-recent-levels', JSON.stringify(recentLevels));
    } catch (e) {
      console.warn('Failed to save to recent levels:', e);
    }
  }
  
  /**
   * Get recent levels from localStorage
   */
  private getRecentLevels(): any[] {
    try {
      const stored = localStorage.getItem('nevereverland-recent-levels');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }
  
  /**
   * Load a level from a JSON file
   */
  public loadLevel(file: File): void {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const saveData = JSON.parse(json);
        
        // Validate save data
        if (!saveData.version || !saveData.tiles) {
          throw new Error('Invalid save file format');
        }
        
        // Clear current level and load tiles
        this.tileSystem.deserialize(saveData.tiles);
        
        // Restore camera position if available
        if (saveData.camera) {
          if (saveData.camera.zoom) {
            this.camera.getCamera().zoom = saveData.camera.zoom;
            this.camera.getCamera().updateProjectionMatrix();
          }
          if (saveData.camera.x !== undefined && saveData.camera.z !== undefined) {
            this.camera.setTarget(saveData.camera.x, 0, saveData.camera.z);
          }
        }
        
        // Clear undo/redo history
        this.undoStack = [];
        this.redoStack = [];
        
        // Show success message
        if (window.styleUI && window.styleUI.showToast) {
          window.styleUI.showToast('Level loaded successfully', 'success');
        }
      } catch (error) {
        console.error('Failed to load level:', error);
        if (window.styleUI && window.styleUI.showToast) {
          window.styleUI.showToast('Failed to load level: ' + error.message, 'error');
        }
      }
    };
    
    reader.readAsText(file);
  }

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
    if (this.previewGroup) {
      // Dispose all children in the preview group
      while (this.previewGroup.children.length > 0) {
        const child = this.previewGroup.children[0];
        this.previewGroup.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          // Remove edge children
          while (child.children.length > 0) {
            const edgeChild = child.children[0];
            child.remove(edgeChild);
            if (edgeChild instanceof THREE.LineSegments) {
              edgeChild.geometry.dispose();
              (edgeChild.material as THREE.Material).dispose();
            }
          }
        }
      }
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