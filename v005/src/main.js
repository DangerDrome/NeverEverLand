
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NeverEverlandUI } from './NeverEverlandUI.js';
import { SelectionManager } from './SelectionManager.js';
import { AdaptiveGrid } from './AdaptiveGrid.js';
import { TileMapSystem } from './TileMapSystem.js';
import { TileRenderer } from './TileRenderer.js';
import { HybridVoxelWorld } from './HybridVoxelWorld.js';
import { PostProcessingManager } from './PostProcessingManager.js';

class GameEngine {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = null;
        
        // Set up orthographic camera for isometric view
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
        
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
            // Try to disable vsync
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: false
        });
        
        // Try to get unthrottled context
        const gl = this.renderer.getContext();
        if (gl.getExtension) {
            const ext = gl.getExtension('WEBGL_lose_context');
            console.log('WebGL extensions:', gl.getSupportedExtensions());
        }
        
        this.player = { position: new THREE.Vector3(0, 0, 5) }; // Mock player
        this.mapBounds = { x: -50, z: -50, width: 100, height: 100 }; // Mock map bounds
        
        // Camera control properties
        this.frustumSize = frustumSize;
        this.minZoom = 5;
        this.maxZoom = 50;
        this.isPanning = false;
        this.panStart = new THREE.Vector2();
        this.panDelta = new THREE.Vector2();
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.cameraVelocity = new THREE.Vector3(0, 0, 0);
        this.panDamping = 0.85; // Less momentum for snappier response
        this.mousePos = new THREE.Vector2();
        this.enableEdgePan = false; // Can be toggled with 'E' key
        
        // Performance tracking
        this.clock = new THREE.Clock();
        this.frameCount = 0;
        this.fpsTime = 0;
        this.useRAF = true; // Toggle between RAF and setTimeout
        this.targetFPS = 60;
        
        // Selection manager will be initialized after renderer is set up
        this.selectionManager = null;
        this.postProcessingManager = null;

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Don't use high DPI on high refresh displays - this can cause throttling
        this.renderer.setPixelRatio(1); // Force pixel ratio to 1
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        
        // Log renderer capabilities and check for throttling
        console.log('Renderer info:', {
            pixelRatio: this.renderer.getPixelRatio(),
            maxTextureSize: this.renderer.capabilities.maxTextureSize,
            precision: this.renderer.capabilities.precision,
            powerPreference: this.renderer.capabilities.powerPreference
        });
        
        
        // Try to prevent throttling
        this.renderer.domElement.style.transform = 'translateZ(0)'; // Force GPU acceleration
        this.renderer.domElement.style.willChange = 'transform'; // Hint browser about animations

        // Add adaptive grid system
        this.adaptiveGrid = new AdaptiveGrid(100, this.camera, this.scene);

        // Axes helper removed - now displayed in Control Panel

        // Test objects removed - use tile system instead

        // Add ambient light for better visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Add directional light for face shading differences
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        // Load Link GLTF model
        const loader = new GLTFLoader();
        loader.load(
            '/test_assets/link/scene.gltf',
            (gltf) => {
                this.model = gltf.scene;
                
                // Calculate bounding box to get current height
                const box = new THREE.Box3().setFromObject(this.model);
                const size = box.getSize(new THREE.Vector3());
                const currentHeight = size.y;
                
                // Scale to make character 2 meters tall
                const targetHeight = 2; // 2 meters
                const scaleFactor = targetHeight / currentHeight;
                this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);
                
                // Position at ground level
                this.model.position.set(0, 0, 0);
                this.scene.add(this.model);
                
                console.log(`Character scaled from ${currentHeight.toFixed(2)}m to ${targetHeight}m (scale: ${scaleFactor.toFixed(2)})`);
                
                // Add animations if available
                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(this.model);
                    const action = this.mixer.clipAction(gltf.animations[0]);
                    action.play();
                }
                
                // Select the model automatically when it loads
                if (this.selectionManager) {
                    this.selectionManager.selectObject(this.model);
                }
                
                // Focus on scene after model loads
                this.focusOnSelection();
            },
            (progress) => {
                console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading GLTF model:', error);
                // No fallback geometry - use tile system instead
            }
        );

        // Set up isometric camera position and rotation
        // For true isometric: rotate 45° around Y, then tilt down ~35.264°
        const distance = 20;
        const height = distance * Math.sin(Math.atan(1/Math.sqrt(2))); // ~35.264° in radians
        const groundDistance = distance * Math.cos(Math.atan(1/Math.sqrt(2)));
        
        // Position camera at 45° angle around Y axis
        this.camera.position.set(
            groundDistance * Math.cos(Math.PI/4),
            height,
            groundDistance * Math.sin(Math.PI/4)
        );
        this.camera.lookAt(0, 0, 0);
        
        // Store camera settings for later use
        this.cameraDistance = distance;

        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Camera controls
        this.setupCameraControls();
        
        // Initialize selection manager after renderer is ready
        this.selectionManager = new SelectionManager(this);
        
        // Initialize post-processing manager
        this.postProcessingManager = new PostProcessingManager(this.renderer, this.scene, this.camera);
        
        // Initialize tile system
        this.tileRenderer = new TileRenderer(this.scene);
        this.tileMapSystem = new TileMapSystem(this.scene, this.camera, this.adaptiveGrid, this.selectionManager, this.tileRenderer);
        
        // Initialize hybrid voxel system
        this.voxelWorld = new HybridVoxelWorld(this.scene, this.camera, this.renderer);
        this.voxelWorld.setTileMapSystem(this.tileMapSystem);
        
        // Connect tile system to hybrid voxel world
        this.tileMapSystem.setHybridVoxelWorld(this.voxelWorld);
        this.tileMapSystem.setHybridMode(true); // Enable hybrid mode by default
        
        // Initial focus will happen when model loads (see line 166)
    }
    
    
    setupCameraControls() {
        // Mouse wheel zoom
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // Get mouse position in normalized device coordinates (-1 to +1)
            const rect = this.renderer.domElement.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Convert mouse position to world space before zoom
            const worldMouseBefore = this.screenToWorld(mouseX, mouseY);
            
            // Apply zoom
            const zoomDelta = e.deltaY > 0 ? 1.1 : 0.9;
            this.frustumSize = Math.max(this.minZoom, Math.min(this.maxZoom, this.frustumSize * zoomDelta));
            this.updateCameraProjection();
            
            // Convert mouse position to world space after zoom
            const worldMouseAfter = this.screenToWorld(mouseX, mouseY);
            
            // Adjust camera target to keep mouse position fixed
            if (worldMouseBefore && worldMouseAfter) {
                this.cameraTarget.x += worldMouseBefore.x - worldMouseAfter.x;
                this.cameraTarget.z += worldMouseBefore.z - worldMouseAfter.z;
                this.updateCameraPosition();
            }
        });
        
        // Middle mouse pan
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                this.isPanning = true;
                this.panStart.set(e.clientX, e.clientY);
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            
            const deltaX = e.clientX - this.panStart.x;
            const deltaY = e.clientY - this.panStart.y;
            
            // Adaptive pan speed based on zoom level
            const basePanSpeed = 0.001;
            const panSpeed = this.frustumSize * basePanSpeed;
            
            // Simple isometric conversion:
            // Moving right = +X, +Z
            // Moving down = -X, +Z
            const worldDX = (deltaX + deltaY) * panSpeed;
            const worldDZ = (-deltaX + deltaY) * panSpeed;
            
            // Store velocity for momentum (currently disabled)
            // this.cameraVelocity.x = -worldDX;
            // this.cameraVelocity.z = -worldDZ;
            
            // Apply movement directly (no momentum)
            this.cameraTarget.x -= worldDX;
            this.cameraTarget.z -= worldDZ;
            
            this.updateCameraPosition();
            
            this.panStart.set(e.clientX, e.clientY);
        });
        
        window.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                this.isPanning = false;
            }
        });
        
        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'f' || e.key === 'F') {
                this.focusOnSelection();
            }
            // Toggle animation method with T key
            if (e.key === 't' || e.key === 'T') {
                this.useRAF = !this.useRAF;
                console.log(`Switched to ${this.useRAF ? 'requestAnimationFrame' : 'setTimeout'} mode`);
            }
            // Clear selection with Escape key
            if (e.key === 'Escape') {
                this.selectionManager.clearSelection();
            }
            // Toggle grid visibility with G key
            if (e.key === 'g' || e.key === 'G') {
                const isVisible = this.adaptiveGrid.gridGroups.major.visible;
                this.adaptiveGrid.setVisible(!isVisible);
                console.log(`Grid ${!isVisible ? 'shown' : 'hidden'}`);
            }
        });
        
        // Prevent context menu on right click
        this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    updateCameraProjection() {
        const aspect = window.innerWidth / window.innerHeight;
        
        this.camera.left = -this.frustumSize * aspect / 2;
        this.camera.right = this.frustumSize * aspect / 2;
        this.camera.top = this.frustumSize / 2;
        this.camera.bottom = -this.frustumSize / 2;
        
        this.camera.updateProjectionMatrix();
    }
    
    updateCameraPosition() {
        const height = this.cameraDistance * Math.sin(Math.atan(1/Math.sqrt(2)));
        const groundDistance = this.cameraDistance * Math.cos(Math.atan(1/Math.sqrt(2)));
        
        this.camera.position.set(
            this.cameraTarget.x + groundDistance * Math.cos(Math.PI/4),
            this.cameraTarget.y + height,
            this.cameraTarget.z + groundDistance * Math.sin(Math.PI/4)
        );
        
        this.camera.lookAt(this.cameraTarget);
    }
    
    screenToWorld(ndcX, ndcY) {
        // Create a raycaster from the camera through the mouse position
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
        
        // Create a plane at Y=0 (ground level)
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        
        // Find where the ray intersects the ground plane
        if (raycaster.ray.intersectPlane(plane, intersection)) {
            return intersection;
        }
        
        return null;
    }
    
    focusOnSelection() {
        // Create a box that encompasses all objects in the scene
        const box = new THREE.Box3();
        
        // Check if we have selected objects
        const selectedObjects = this.selectionManager ? this.selectionManager.getSelectedObjects() : [];
        
        if (selectedObjects.length > 0) {
            // Focus on selected objects
            selectedObjects.forEach(obj => {
                box.expandByObject(obj);
            });
        } else {
            // Add all visible objects to the bounding box
            if (this.model) {
                box.expandByObject(this.model);
            }
            
            
            // Include a reasonable area around origin if box is too small
            box.expandByPoint(new THREE.Vector3(-10, 0, -10));
            box.expandByPoint(new THREE.Vector3(10, 0, 10));
        }
        
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Set camera target to scene center
        this.cameraTarget.copy(center);
        
        // Adjust zoom to fit the scene with some padding
        // For isometric view, consider all dimensions but weight Y less since it's viewed at angle
        const maxDim = Math.max(size.x, size.z, size.y * 0.7); // Include Y but reduce its impact
        
        // Use different padding based on whether we're focusing on specific objects or the whole scene
        if (selectedObjects.length > 0) {
            // Focusing on specific selected objects - consider height for tall objects, good padding
            this.frustumSize = maxDim * 1.8;
        } else {
            // Focusing on all objects (F key with nothing selected) - much tighter since it includes large grid area
            this.frustumSize = maxDim * 0.4;
        }
        
        this.updateCameraProjection();
        this.updateCameraPosition();
    }
    
    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        
        this.camera.left = -this.frustumSize * aspect / 2;
        this.camera.right = this.frustumSize * aspect / 2;
        this.camera.top = this.frustumSize / 2;
        this.camera.bottom = -this.frustumSize / 2;
        
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update post-processing size
        if (this.postProcessingManager) {
            this.postProcessingManager.setSize(window.innerWidth, window.innerHeight);
        }
        
        // Also resize selection manager canvas
        if (this.selectionManager) {
            this.selectionManager.resizeCanvas();
        }
    }

    getVisibleEntities() {
        // Mock implementation
        return [
            { position: new THREE.Vector3(10, 0, 10), type: 'enemy' },
            { position: new THREE.Vector3(-15, 0, -5), type: 'npc' },
        ];
    }

    animate(timestamp) {
        // Schedule next frame based on mode
        if (this.useRAF) {
            requestAnimationFrame((t) => this.animate(t));
        } else {
            // Force 60 FPS with setTimeout
            setTimeout(() => this.animate(performance.now()), 1000 / this.targetFPS);
        }
        
        // Initialize on first frame
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp || performance.now();
            this.frameAccumulator = 0;
            return;
        }
        
        // Calculate delta time
        const now = timestamp || performance.now();
        const deltaMs = now - this.lastTimestamp;
        this.lastTimestamp = now;
        
        // Always render every frame
        const delta = deltaMs / 1000; // Convert to seconds
        
        // Track actual FPS
        this.frameCount++;
        this.fpsTime += delta;
        
        if (this.fpsTime >= 1.0) {
            this.frameCount = 0;
            this.fpsTime = 0;
        }

        // Update animations if mixer exists
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // MOMENTUM DISABLED - To re-enable momentum/inertia panning, uncomment this block
        // Apply camera momentum when not panning
        /*
        if (!this.isPanning && (Math.abs(this.cameraVelocity.x) > 0.01 || Math.abs(this.cameraVelocity.z) > 0.01)) {
            this.cameraTarget.x += this.cameraVelocity.x;
            this.cameraTarget.z += this.cameraVelocity.z;
            
            // Apply damping
            this.cameraVelocity.x *= this.panDamping;
            this.cameraVelocity.z *= this.panDamping;
            
            // Stop when velocity is very small (higher threshold for quicker stop)
            if (Math.abs(this.cameraVelocity.x) < 0.01) this.cameraVelocity.x = 0;
            if (Math.abs(this.cameraVelocity.z) < 0.01) this.cameraVelocity.z = 0;
            
            this.updateCameraPosition();
        }
        */

        // Rotate model with delta time (unless voxelizing)
        const rotationSpeed = 1; // radians per second
        if (!this.stopModelRotation && this.model) {
            this.model.rotation.y += rotationSpeed * delta;
        }

        // Update adaptive grid
        if (this.adaptiveGrid) {
            this.adaptiveGrid.update();
        }

        // Update voxel world
        if (this.voxelWorld) {
            this.voxelWorld.update(delta);
        }

        // Render with post-processing
        if (this.postProcessingManager) {
            this.postProcessingManager.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        
        if (this.ui) {
            this.ui.update();
        }
    }

    setUI(ui) {
        this.ui = ui;
    }
}

const gameEngine = new GameEngine();
const ui = new NeverEverlandUI(gameEngine);
gameEngine.setUI(ui);

// Make game engine globally accessible for UI components
window.gameEngine = gameEngine;

// Debug helpers
window.debugVoxels = () => {
    const vw = gameEngine.voxelWorld;
    console.log('VoxelWorld debug info:');
    console.log('- Tile chunks:', vw.tileChunks.size);
    console.log('- Tile instances:', vw.tileInstances.size);
    console.log('- Tile templates:', vw.tileTemplates.size);
    console.log('- Mesh update queue:', vw.meshUpdateQueue.length);
    console.log('- Tile chunks:', Array.from(vw.tileChunks.keys()));
    console.log('- Material:', vw.voxelMaterial);
    
    // Check if chunks have meshes
    vw.tileChunks.forEach((chunk, key) => {
        console.log(`Chunk ${key}: has mesh = ${!!chunk.mesh}, needs rebuild = ${chunk.needsRebuild()}`);
        if (chunk.mesh) {
            console.log(`  - Visible: ${chunk.mesh.visible}`);
            console.log(`  - Vertices: ${chunk.mesh.geometry.attributes.position.count}`);
            console.log(`  - Material: ${chunk.mesh.material.type}`);
            console.log(`  - Position:`, chunk.mesh.position);
            console.log(`  - In scene: ${chunk.mesh.parent === vw.scene}`);
        }
    });
    
    // Force rebuild a chunk to test
    console.log('\nForcing rebuild of first tile chunk...');
    const firstChunk = vw.tileChunks.values().next().value;
    if (firstChunk) {
        firstChunk.isDirty = true; // Mark chunk as dirty to trigger rebuild
        vw.queueChunkMeshUpdate(firstChunk);
        vw.processMeshUpdates();
    }
};

// Example usage:
ui.showDamage(120, new THREE.Vector3(0, 1, 0));
// Debug: Check voxel world

// Demonstrate state updates
let currentHealth = 100;
let currentMana = 50;

setInterval(() => {
    currentHealth -= 5;
    if (currentHealth < 0) currentHealth = 100;
    ui.stateManager.update('player.health', currentHealth);

    currentMana += 10;
    if (currentMana > 100) currentMana = 0;
    ui.stateManager.update('player.mana', currentMana);
}, 1000);

// Add some items to the hotbar with Lucide icons
ui.components.get('hotbar').updateItem(0, { id: 'potion', name: 'Health Potion', iconName: 'heart' });
ui.components.get('hotbar').updateItem(1, { id: 'sword', name: 'Sword', iconName: 'sword' });
ui.components.get('hotbar').updateItem(2, { id: 'shield', name: 'Shield', iconName: 'shield' });

// Add some dummy items to the inventory with Lucide icons
ui.components.get('inventory').addItem({ id: 'item1', name: 'Ancient Sword', iconName: 'swords', description: 'A very old and rusty sword.' });
ui.components.get('inventory').addItem({ id: 'item2', name: 'Magic Potion', iconName: 'flask-conical', description: 'Restores a small amount of mana.' });
ui.components.get('inventory').addItem({ id: 'item3', name: 'Leather Armor', iconName: 'shirt', description: 'Lightweight and flexible armor.' });
ui.components.get('inventory').addItem({ id: 'item4', name: 'Gold Coin', iconName: 'coins', description: 'A shiny gold coin.', quantity: 5 });

