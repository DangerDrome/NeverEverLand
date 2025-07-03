/**
 * Main application class for the Isometric Farming Game
 * Ties together all components: camera, grid, controls, and effects
 */
class IsometricFarmingGame {
    constructor() {
        console.log('🎮 IsometricFarmingGame constructor called');
        
        // Core Three.js components
        this.scene = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Game components
        this.isometricCamera = null;
        this.tileGrid = null;
        this.cameraControls = null;
        this.pixelationEffect = null;
        
        // Configuration
        this.config = {
            gridSize: { width: 10, height: 10 },
            tileSize: 2,
            pixelSize: 4,
            cameraViewSize: 20
        };
        
        this.usePostProcessing = false; // Start without post-processing to debug
        
        console.log('🔧 Config:', this.config);
        
        this.init();
    }
    
    /**
     * Initialize the game
     */
    init() {
        console.log('🚀 Starting game initialization...');
        try {
            this.setupRenderer();
            this.setupScene();
            this.setupCamera();
            this.setupGrid();
            this.setupLighting();
            this.setupControls();
            
            if (this.usePostProcessing) {
                this.setupPostProcessing();
            }
            
            this.setupEventListeners();
            
            // Start the game loop
            this.animate();
            
            console.log('✅ Isometric Farming Game initialized successfully!');
            console.log('🎮 Controls: WASD/Arrow Keys to pan, Mouse Wheel to zoom, Q/E to adjust pixelation');
            console.log('📷 Camera position:', this.isometricCamera.getCamera().position);
            console.log('🌍 Scene children:', this.scene.children.length);
            
            // Log scene structure
            console.log('🔍 Scene structure:');
            this.scene.children.forEach((child, index) => {
                console.log(`  ${index}: ${child.type} - ${child.name || 'unnamed'}`);
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize game:', error);
            console.error('Stack trace:', error.stack);
        }
    }
    
    /**
     * Set up the Three.js renderer
     */
    setupRenderer() {
        console.log('🖥️ Setting up renderer...');
        
        // Check if THREE is available
        if (typeof THREE === 'undefined') {
            throw new Error('THREE.js is not loaded');
        }
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: false, // Disable for pixel art style
            alpha: true 
        });
        
        console.log('📐 Window size:', window.innerWidth, 'x', window.innerHeight);
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB, 1); // Sky blue background
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        console.log('🎨 Renderer settings:', {
            clearColor: this.renderer.getClearColor().getHex(),
            size: { width: this.renderer.domElement.width, height: this.renderer.domElement.height },
            shadowMap: this.renderer.shadowMap.enabled
        });
        
        // Add to DOM
        const container = document.getElementById('gameContainer');
        if (container) {
            container.appendChild(this.renderer.domElement);
            console.log('✅ Renderer canvas added to DOM');
            console.log('🎯 Canvas element:', this.renderer.domElement);
            console.log('📊 Canvas size:', this.renderer.domElement.clientWidth, 'x', this.renderer.domElement.clientHeight);
        } else {
            throw new Error('Could not find gameContainer element');
        }
    }
    
    /**
     * Set up the Three.js scene
     */
    setupScene() {
        console.log('🌍 Setting up scene...');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Ensure background is set
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 100); // Add atmospheric fog
        console.log('✅ Scene created with background color:', this.scene.background.getHex());
    }
    
    /**
     * Set up the isometric camera
     */
    setupCamera() {
        console.log('📷 Setting up camera...');
        const aspectRatio = window.innerWidth / window.innerHeight;
        console.log('📐 Aspect ratio:', aspectRatio);
        
        this.isometricCamera = new IsometricCamera(aspectRatio, this.config.cameraViewSize);
        console.log('✅ Camera created at position:', this.isometricCamera.getCamera().position);
        console.log('🔍 Camera view size:', this.isometricCamera.viewSize);
        console.log('🎯 Camera looking at:', this.isometricCamera.getCamera().getWorldDirection(new THREE.Vector3()));
    }
    
    /**
     * Set up the tile grid
     */
    setupGrid() {
        console.log('🔲 Setting up grid...');
        this.tileGrid = new TileGrid(
            this.config.gridSize.width,
            this.config.gridSize.height,
            this.config.tileSize
        );
        
        const gridGroup = this.tileGrid.getGroup();
        this.scene.add(gridGroup);
        
        console.log('✅ Grid created with', gridGroup.children.length, 'tiles');
        console.log('📊 Grid dimensions:', this.tileGrid.getDimensions());
        console.log('🎯 Grid position:', gridGroup.position);
    }
    
    /**
     * Set up scene lighting for isometric view
     */
    setupLighting() {
        console.log('💡 Setting up lighting...');
        
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        console.log('🌅 Ambient light added');
        
        // Directional light for shadows and depth
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        
        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -25;
        directionalLight.shadow.camera.right = 25;
        directionalLight.shadow.camera.top = 25;
        directionalLight.shadow.camera.bottom = -25;
        
        this.scene.add(directionalLight);
        console.log('☀️ Directional light added at:', directionalLight.position);
        
        // Optional: Add a subtle rim light
        const rimLight = new THREE.DirectionalLight(0x8bc5ff, 0.3);
        rimLight.position.set(-10, 5, -10);
        this.scene.add(rimLight);
        console.log('🌙 Rim light added');
        
        console.log('✅ Lighting setup complete. Total lights:', 3);
    }
    
    /**
     * Set up camera controls
     */
    setupControls() {
        console.log('🎮 Setting up controls...');
        this.cameraControls = new CameraControls(
            this.isometricCamera,
            this.renderer.domElement
        );
        
        // Add pixelation control keys
        document.addEventListener('keydown', (event) => {
            switch (event.code) {
                case 'KeyQ':
                    if (this.pixelationEffect) {
                        this.pixelationEffect.decreasePixelation();
                        console.log(`Pixelation: ${this.pixelationEffect.getPixelSize()}`);
                    }
                    break;
                case 'KeyE':
                    if (this.pixelationEffect) {
                        this.pixelationEffect.increasePixelation();
                        console.log(`Pixelation: ${this.pixelationEffect.getPixelSize()}`);
                    }
                    break;
                case 'KeyP':
                    // Toggle post-processing
                    this.togglePostProcessing();
                    break;
            }
        });
        
        console.log('✅ Controls setup complete');
    }
    
    /**
     * Set up post-processing effects
     */
    setupPostProcessing() {
        console.log('🎨 Setting up post-processing...');
        try {
            this.pixelationEffect = new PixelationEffect(
                this.renderer,
                this.scene,
                this.isometricCamera.getCamera(),
                this.config.pixelSize
            );
            console.log('✅ Post-processing setup complete');
        } catch (error) {
            console.error('❌ Failed to setup post-processing:', error);
            this.usePostProcessing = false;
        }
    }
    
    /**
     * Toggle post-processing on/off
     */
    togglePostProcessing() {
        this.usePostProcessing = !this.usePostProcessing;
        
        if (this.usePostProcessing && !this.pixelationEffect) {
            this.setupPostProcessing();
        }
        
        console.log('🎨 Post-processing:', this.usePostProcessing ? 'enabled' : 'disabled');
    }
    
    /**
     * Set up event listeners for window resize, etc.
     */
    setupEventListeners() {
        console.log('👂 Setting up event listeners...');
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Optional: Add debug info display
        this.setupDebugInfo();
        console.log('✅ Event listeners setup complete');
    }
    
    /**
     * Handle window resize
     */
    onWindowResize() {
        console.log('📐 Window resized to:', window.innerWidth, 'x', window.innerHeight);
        const newAspectRatio = window.innerWidth / window.innerHeight;
        
        // Update camera
        this.isometricCamera.onWindowResize(newAspectRatio);
        
        // Update renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update post-processing
        if (this.pixelationEffect) {
            this.pixelationEffect.onWindowResize(window.innerWidth, window.innerHeight);
        }
    }
    
    /**
     * Add some sample objects to the scene for visual interest
     */
    addSampleObjects() {
        console.log('🌳 Adding sample objects...');
        // Add a few sample objects (trees, buildings, etc.)
        const sampleObjects = [];
        
        // Simple tree representation
        const treeGeometry = new THREE.ConeGeometry(0.5, 2, 8);
        const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        
        for (let i = 0; i < 5; i++) {
            const tree = new THREE.Mesh(treeGeometry, treeMaterial);
            tree.position.set(
                (Math.random() - 0.5) * 15,
                1,
                (Math.random() - 0.5) * 15
            );
            tree.castShadow = true;
            tree.receiveShadow = true;
            
            this.scene.add(tree);
            sampleObjects.push(tree);
            console.log(`🌲 Tree ${i + 1} added at:`, tree.position);
        }
        
        // Simple house representation
        const houseGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const houseMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        const house = new THREE.Mesh(houseGeometry, houseMaterial);
        house.position.set(3, 0.75, 3);
        house.castShadow = true;
        house.receiveShadow = true;
        
        this.scene.add(house);
        sampleObjects.push(house);
        console.log('🏠 House added at:', house.position);
        
        console.log('✅ Sample objects added:', sampleObjects.length);
        return sampleObjects;
    }
    
    /**
     * Set up debug information display
     */
    setupDebugInfo() {
        // Create debug info element if it doesn't exist
        if (!document.getElementById('debugInfo')) {
            const debugDiv = document.createElement('div');
            debugDiv.id = 'debugInfo';
            debugDiv.style.cssText = `
                position: absolute;
                top: 150px;
                left: 10px;
                color: white;
                font-family: monospace;
                font-size: 11px;
                background: rgba(0, 0, 0, 0.7);
                padding: 5px;
                border-radius: 3px;
                z-index: 101;
            `;
            document.body.appendChild(debugDiv);
        }
        
        this.debugInfo = document.getElementById('debugInfo');
    }
    
    /**
     * Update debug information
     */
    updateDebugInfo() {
        if (this.debugInfo) {
            const camera = this.isometricCamera.getCamera();
            const pos = camera.position;
            
            this.debugInfo.innerHTML = `
                Camera: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})<br>
                Zoom: ${this.isometricCamera.viewSize.toFixed(1)}<br>
                Post-processing: ${this.usePostProcessing ? 'ON' : 'OFF'}<br>
                Scene objects: ${this.scene.children.length}<br>
                Renderer size: ${this.renderer.domElement.width}x${this.renderer.domElement.height}<br>
                Press P to toggle post-processing
            `;
        }
    }
    
    /**
     * Main animation loop
     */
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const deltaTime = this.clock.getDelta();
        
        // Update controls
        if (this.cameraControls) {
            this.cameraControls.update(deltaTime);
        }
        
        // Render scene
        if (this.usePostProcessing && this.pixelationEffect) {
            // Update post-processing effects
            this.pixelationEffect.updateFilmGrain(this.clock.elapsedTime);
            // Render with post-processing
            this.pixelationEffect.render();
        } else {
            // Render normally
            this.renderer.render(this.scene, this.isometricCamera.getCamera());
        }
        
        // Update debug info
        this.updateDebugInfo();
    }
    
    /**
     * Get current game state for debugging
     * @returns {Object} Current game state
     */
    getGameState() {
        return {
            camera: {
                position: this.isometricCamera.getCamera().position,
                viewSize: this.isometricCamera.viewSize
            },
            grid: this.tileGrid.getDimensions(),
            controls: this.cameraControls.getState(),
            pixelation: this.pixelationEffect ? this.pixelationEffect.getPixelSize() : 'disabled',
            usePostProcessing: this.usePostProcessing,
            sceneChildren: this.scene.children.length
        };
    }
}

// Auto-start the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM Content Loaded');
    console.log('🔍 THREE.js available:', typeof THREE !== 'undefined');
    console.log('📦 THREE.js version:', THREE?.REVISION || 'unknown');
    
    // Create the game instance
    const game = new IsometricFarmingGame();
    
    // Add some sample objects for visual interest
    game.addSampleObjects();
    
    // Make game instance available globally for debugging
    window.game = game;
    
    console.log('🎮 Game started! Access via window.game for debugging.');
    console.log('⌨️ Press P to toggle post-processing effects.');
    
    // Test manual render after a short delay
    setTimeout(() => {
        console.log('🧪 Manual render test...');
        if (game.renderer && game.scene && game.isometricCamera) {
            game.renderer.render(game.scene, game.isometricCamera.getCamera());
            console.log('✅ Manual render completed');
        }
    }, 100);
}); 