import { World } from './core/World.js';
import { TransformSystem } from './systems/TransformSystem.js';
import { RenderingSystem } from './systems/RenderingSystem.js';
import { InputSystem } from './systems/InputSystem.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { AnimationSystem } from './systems/AnimationSystem.js';

import { TransformComponent } from './components/TransformComponent.js';
import { RenderableComponent, CameraComponent, LightComponent } from './components/RenderableComponent.js';
import { InputComponent } from './components/InputComponent.js';
import { 
    RigidbodyComponent, 
    BoxColliderComponent, 
    SphereColliderComponent, 
    PlaneColliderComponent,
    PhysicsMaterialComponent 
} from './components/PhysicsComponent.js';
import { 
    AnimatorComponent, 
    TweenComponent 
} from './components/AnimationComponent.js';

/**
 * Main Game Engine
 * Orchestrates the ECS world and provides high-level API
 */
export class GameEngine {
    constructor(container) {
        this.container = container;
        this.renderer = null;
        this.world = new World();
        
        // Engine state
        this.running = false;
        this.paused = false;
        this.lastTime = 0;
        this.targetFPS = 60;
        this.fixedTimeStep = 1000 / this.targetFPS;
        this.accumulator = 0;
        this.maxFrameTime = 250; // Prevent spiral of death
        
        // Demo integration
        this.currentDemo = null;
        this.onUpdate = null;
        
        // Performance tracking
        this.frameCount = 0;
        this.fpsHistory = [];
        this.performanceStats = {
            averageFPS: 0,
            minFPS: 60,
            maxFPS: 60,
            frameTime: 0
        };
        
        // Settings
        this.settings = {
            antialias: false,
            shadows: true,
            pixelRatio: window.devicePixelRatio,
            alpha: true,
            powerPreference: 'high-performance'
        };
        
        this.initialize();
    }
    
    initialize() {
        try {
            // Create Three.js renderer
            this.createRenderer();
            
            // Register component pools for performance
            this.registerComponentPools();
            
            // Create core systems
            this.createCoreSystems();
            
            // Setup default scene
            this.setupDefaultScene();
            
            console.log('GameEngine initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize GameEngine:', error);
            throw error;
        }
    }
    
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.settings.antialias,
            alpha: this.settings.alpha,
            powerPreference: this.settings.powerPreference
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(this.settings.pixelRatio);
        this.renderer.setClearColor(0x87CEEB, 1); // Sky blue
        
        // Enable shadows if requested
        if (this.settings.shadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        // Add to container
        this.container.appendChild(this.renderer.domElement);
        
        console.log('WebGL Renderer created:', this.renderer.info);
    }
    
    registerComponentPools() {
        // Register pools for commonly used components
        this.world.registerComponentPool(TransformComponent, 1000);
        this.world.registerComponentPool(RenderableComponent, 500);
        this.world.registerComponentPool(CameraComponent, 10);
        this.world.registerComponentPool(LightComponent, 50);
        this.world.registerComponentPool(InputComponent, 10);
        
        // Physics component pools
        this.world.registerComponentPool(RigidbodyComponent, 200);
        this.world.registerComponentPool(BoxColliderComponent, 150);
        this.world.registerComponentPool(SphereColliderComponent, 100);
        this.world.registerComponentPool(PlaneColliderComponent, 20);
        this.world.registerComponentPool(PhysicsMaterialComponent, 50);
        
        // Animation component pools
        this.world.registerComponentPool(AnimatorComponent, 100);
        this.world.registerComponentPool(TweenComponent, 200);
        
        console.log('Component pools registered');
    }
    
    createCoreSystems() {
        // Create systems in priority order
        const inputSystem = new InputSystem(this.world, this.renderer.domElement);
        const animationSystem = new AnimationSystem(this.world);
        const physicsSystem = new PhysicsSystem(this.world);
        const transformSystem = new TransformSystem(this.world);
        const cameraSystem = new CameraSystem(this.world);
        const renderingSystem = new RenderingSystem(this.world, this.renderer);
        
        // Add systems to world (order matters for execution)
        this.world.addSystem(inputSystem);        // Priority 10
        this.world.addSystem(animationSystem);    // Priority 12
        this.world.addSystem(physicsSystem);      // Priority 15
        this.world.addSystem(transformSystem);    // Priority 18
        this.world.addSystem(cameraSystem);       // Priority 20
        this.world.addSystem(renderingSystem);    // Priority 25
        
        // Store references for easy access
        this.inputSystem = inputSystem;
        this.animationSystem = animationSystem;
        this.physicsSystem = physicsSystem;
        this.transformSystem = transformSystem;
        this.cameraSystem = cameraSystem;
        this.renderingSystem = renderingSystem;
        
        // Initialize animation presets
        this.animationSystem.createPresetAnimations();
        
        console.log('Core systems created');
    }
    
    setupDefaultScene() {
        // Create default lighting
        this.createDefaultLighting();
        
        // Create default camera
        this.createDefaultCamera();
        
        console.log('Default scene setup complete');
    }
    
    createDefaultLighting() {
        // Ambient light
        const ambientLight = this.world.createEntity();
        const ambientLightComp = this.world.acquireComponent(LightComponent);
        ambientLightComp.type = 'ambient';
        ambientLightComp.color = 0x404040;
        ambientLightComp.intensity = 0.6;
        
        this.world.addComponent(ambientLight, ambientLightComp);
        this.world.addComponent(ambientLight, this.world.acquireComponent(TransformComponent));
        
        // Directional light (sun)
        const directionalLight = this.world.createEntity();
        const dirLightComp = this.world.acquireComponent(LightComponent);
        dirLightComp.type = 'directional';
        dirLightComp.color = 0xffffff;
        dirLightComp.intensity = 0.8;
        dirLightComp.castShadow = this.settings.shadows;
        
        const dirLightTransform = this.world.acquireComponent(TransformComponent);
        dirLightTransform.setPosition(10, 20, 10);
        
        this.world.addComponent(directionalLight, dirLightComp);
        this.world.addComponent(directionalLight, dirLightTransform);
        
        return { ambientLight, directionalLight };
    }
    
    createDefaultCamera() {
        const cameraEntity = this.world.createEntity();
        
        const cameraComp = this.world.acquireComponent(CameraComponent);
        const transform = this.world.acquireComponent(TransformComponent);
        
        // Set up isometric camera
        transform.setPosition(15, 15, 15);
        transform.lookAt({ x: 0, y: 0, z: 0 });
        
        cameraComp.isOrthographic = true;
        cameraComp.viewSize = 20;
        cameraComp.near = 0.1;
        cameraComp.far = 1000;
        
        this.world.addComponent(cameraEntity, cameraComp);
        this.world.addComponent(cameraEntity, transform);
        
        // Set as main camera
        this.renderingSystem.setActiveCamera(cameraComp);
        
        console.log('Default camera created');
        return cameraEntity;
    }
    
    // Demo integration
    setCurrentDemo(demo) {
        this.currentDemo = demo;
        if (demo && demo.update) {
            this.onUpdate = (deltaTime) => demo.update(deltaTime);
        } else {
            this.onUpdate = null;
        }
    }
    
    // Main game loop
    start() {
        if (this.running) return;
        
        this.running = true;
        this.paused = false;
        this.lastTime = performance.now();
        
        console.log('GameEngine started');
        this.gameLoop();
    }
    
    pause() {
        this.paused = true;
        console.log('GameEngine paused');
    }
    
    resume() {
        if (!this.running) return;
        
        this.paused = false;
        this.lastTime = performance.now(); // Reset timing
        console.log('GameEngine resumed');
        this.gameLoop();
    }
    
    stop() {
        this.running = false;
        this.paused = false;
        console.log('GameEngine stopped');
    }
    
    gameLoop() {
        if (!this.running) return;
        
        if (this.paused) {
            requestAnimationFrame(() => this.gameLoop());
            return;
        }
        
        const currentTime = performance.now();
        let deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Prevent spiral of death
        if (deltaTime > this.maxFrameTime) {
            deltaTime = this.maxFrameTime;
        }
        
        // Fixed timestep with accumulator
        this.accumulator += deltaTime;
        
        while (this.accumulator >= this.fixedTimeStep) {
            const fixedDeltaTime = this.fixedTimeStep / 1000; // Convert to seconds
            
            // Update world with fixed timestep
            this.world.update(fixedDeltaTime);
            
            // Update current demo
            if (this.onUpdate) {
                this.onUpdate(fixedDeltaTime);
            }
            
            this.accumulator -= this.fixedTimeStep;
        }
        
        // Update performance stats
        this.updatePerformanceStats(deltaTime);
        
        // Continue loop
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updatePerformanceStats(deltaTime) {
        this.frameCount++;
        this.performanceStats.frameTime = deltaTime;
        
        const fps = 1000 / deltaTime;
        this.fpsHistory.push(fps);
        
        // Keep last 60 frames for average
        if (this.fpsHistory.length > 60) {
            this.fpsHistory.shift();
        }
        
        // Calculate stats
        this.performanceStats.averageFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        this.performanceStats.minFPS = Math.min(...this.fpsHistory);
        this.performanceStats.maxFPS = Math.max(...this.fpsHistory);
    }
    
    // Public API methods
    
    // Entity management
    createEntity() {
        return this.world.createEntity();
    }
    
    destroyEntity(entity) {
        this.world.destroyEntity(entity);
    }
    
    // Component management
    addComponent(entity, component) {
        return this.world.addComponent(entity, component);
    }
    
    removeComponent(entity, componentType) {
        return this.world.removeComponent(entity, componentType);
    }
    
    getComponent(entity, componentType) {
        return entity.getComponent(componentType);
    }
    
    // System management
    addSystem(system) {
        return this.world.addSystem(system);
    }
    
    removeSystem(systemType) {
        return this.world.removeSystem(systemType);
    }
    
    getSystem(systemType) {
        return this.world.getSystem(systemType);
    }
    
    // Query entities
    query(componentTypes) {
        return this.world.query(componentTypes);
    }
    
    // Camera helpers
    getMainCamera() {
        return this.cameraSystem.getMainCamera();
    }
    
    focusCamera(target, offset = null) {
        const mainCamera = this.getMainCamera();
        if (mainCamera) {
            this.cameraSystem.focusOnEntity(mainCamera, target, offset);
        }
    }
    
    // Utility methods
    screenToWorld(screenX, screenY) {
        const mainCamera = this.getMainCamera();
        if (mainCamera) {
            return this.cameraSystem.screenToWorld(mainCamera, screenX, screenY, this.renderer);
        }
        return null;
    }
    
    worldToScreen(worldX, worldY, worldZ) {
        const mainCamera = this.getMainCamera();
        if (mainCamera) {
            return this.cameraSystem.worldToScreen(mainCamera, worldX, worldY, worldZ, this.renderer);
        }
        return null;
    }
    
    // Performance and debug
    getStats() {
        const worldStats = this.world.getStats();
        const renderStats = this.renderingSystem.getRenderStats();
        
        return {
            ...worldStats,
            rendering: renderStats,
            performance: this.performanceStats,
            frameCount: this.frameCount
        };
    }
    
    // Settings
    setSetting(key, value) {
        this.settings[key] = value;
        
        // Apply settings that can be changed at runtime
        switch (key) {
            case 'shadows':
                this.renderer.shadowMap.enabled = value;
                break;
            case 'pixelRatio':
                this.renderer.setPixelRatio(value);
                break;
        }
    }
    
    getSetting(key) {
        return this.settings[key];
    }
    
    // Event handling
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.renderer.setSize(width, height);
        this.renderingSystem.onWindowResize(width, height);
        this.cameraSystem.onWindowResize(width, height);
        
        console.log(`Window resized to ${width}x${height}`);
    }
    
    // Input event forwarding to current demo
    onKeyPress(key) {
        if (this.currentDemo && this.currentDemo.onKeyPress) {
            this.currentDemo.onKeyPress(key);
        }
    }
    
    // Helper methods for physics and animation
    addPhysicsToEntity(entity, rigidbodyOptions = {}, colliderOptions = {}) {
        const rigidbody = this.world.acquireComponent(RigidbodyComponent);
        Object.assign(rigidbody, rigidbodyOptions);
        this.addComponent(entity, rigidbody);
        
        if (colliderOptions.type) {
            let collider;
            switch (colliderOptions.type) {
                case 'box':
                    collider = this.world.acquireComponent(BoxColliderComponent);
                    if (colliderOptions.size) {
                        collider.setSize(colliderOptions.size.x, colliderOptions.size.y, colliderOptions.size.z);
                    }
                    break;
                case 'sphere':
                    collider = this.world.acquireComponent(SphereColliderComponent);
                    if (colliderOptions.radius) {
                        collider.setRadius(colliderOptions.radius);
                    }
                    break;
                case 'plane':
                    collider = this.world.acquireComponent(PlaneColliderComponent);
                    if (colliderOptions.normal) {
                        collider.setNormal(colliderOptions.normal.x, colliderOptions.normal.y, colliderOptions.normal.z);
                    }
                    break;
                default:
                    console.warn('Unknown collider type:', colliderOptions.type);
                    return;
            }
            this.addComponent(entity, collider);
        }
        
        return entity;
    }
    
    addAnimationToEntity(entity, animationType = 'tween') {
        if (animationType === 'tween') {
            const tweenComponent = this.world.acquireComponent(TweenComponent);
            this.addComponent(entity, tweenComponent);
        } else if (animationType === 'animator') {
            const animator = this.world.acquireComponent(AnimatorComponent);
            this.addComponent(entity, animator);
        }
        
        return entity;
    }
    
    // Window resize handling
    onWindowResize(width, height) {
        // Update renderer
        this.renderer.setSize(width, height);
        
        // Update camera system
        if (this.cameraSystem) {
            this.cameraSystem.onWindowResize(width, height);
        }
        
        console.log(`GameEngine resized to ${width}x${height}`);
    }
    
    // Get comprehensive stats
    getStats() {
        const worldStats = this.world.getStats();
        const animationStats = this.animationSystem?.getStats() || {};
        const physicsStats = this.physicsSystem?.getStats() || {};
        
        return {
            engine: {
                running: this.running,
                paused: this.paused,
                frameCount: this.frameCount,
                ...this.performanceStats
            },
            world: worldStats,
            animation: animationStats,
            physics: physicsStats
        };
    }
    
    // Cleanup
    destroy() {
        this.stop();
        
        // Clean up renderer
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        
        // Clear world
        this.world.clear();
        
        console.log('GameEngine destroyed');
    }
}