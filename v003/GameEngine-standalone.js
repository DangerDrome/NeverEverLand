// NeverEverLand v003 - GameEngine Standalone
// Bundled for serverless usage (no ES6 modules)

(function() {
    'use strict';
    
    // Check if already loaded
    if (window.GameEngine) {
        console.log('GameEngine already loaded, skipping...');
        return;
    }

    // === Core ECS Classes ===
    class Component {
        constructor() {
            this.entity = null;
            this.active = true;
        }
        
        setEntity(entity) {
            this.entity = entity;
            return this;
        }
        
        reset() {
            this.entity = null;
            this.active = true;
        }
    }

    class Entity {
        static nextId = 2000; // Start from 2000 to avoid conflicts
        
        constructor() {
            this.id = Entity.nextId++;
            this.components = new Map();
            this.active = true;
        }
        
        addComponent(component) {
            component.setEntity(this);
            this.components.set(component.constructor.name, component);
            return this;
        }
        
        removeComponent(componentType) {
            const component = this.components.get(componentType);
            if (component) {
                component.reset();
                this.components.delete(componentType);
            }
            return this;
        }
        
        getComponent(componentType) {
            return this.components.get(componentType);
        }
        
        hasComponent(componentType) {
            return this.components.has(componentType);
        }
        
        hasComponents(componentTypes) {
            return componentTypes.every(type => this.hasComponent(type));
        }
    }

    class System {
        constructor(world, priority = 10) {
            this.world = world;
            this.priority = priority;
            this.enabled = true;
            this.requiredComponents = [];
        }
        
        update(deltaTime) {
            if (!this.enabled) return;
            
            const entities = this.world.query(this.requiredComponents);
            entities.forEach(entity => this.processEntity(entity, deltaTime));
        }
        
        processEntity(entity, deltaTime) {
            // Override in derived classes
        }
        
        onEntityAdded(entity) {
            // Override in derived classes
        }
        
        onEntityRemoved(entity) {
            // Override in derived classes
        }
    }

    class World {
        constructor() {
            this.entities = new Map();
            this.systems = [];
            this.queries = new Map();
            this.componentPools = new Map();
            this.stats = {
                entityCount: 0,
                componentCount: 0,
                systemCount: 0,
                queryCount: 0
            };
        }
        
        createEntity() {
            const entity = new Entity();
            this.entities.set(entity.id, entity);
            this.stats.entityCount = this.entities.size;
            return entity;
        }
        
        destroyEntity(entity) {
            if (this.entities.has(entity.id)) {
                // Return components to pools
                entity.components.forEach(component => {
                    this.releaseComponent(component);
                });
                
                this.entities.delete(entity.id);
                this.stats.entityCount = this.entities.size;
            }
        }
        
        addComponent(entity, component) {
            entity.addComponent(component);
            this.stats.componentCount++;
            return component;
        }
        
        removeComponent(entity, componentType) {
            const component = entity.getComponent(componentType);
            if (component) {
                entity.removeComponent(componentType);
                this.releaseComponent(component);
                this.stats.componentCount--;
            }
        }
        
        addSystem(system) {
            this.systems.push(system);
            this.systems.sort((a, b) => a.priority - b.priority);
            this.stats.systemCount = this.systems.length;
            return system;
        }
        
        removeSystem(systemType) {
            const index = this.systems.findIndex(s => s instanceof systemType);
            if (index !== -1) {
                this.systems.splice(index, 1);
                this.stats.systemCount = this.systems.length;
            }
        }
        
        getSystem(systemType) {
            return this.systems.find(s => s instanceof systemType);
        }
        
        query(componentTypes) {
            const key = componentTypes.sort().join(',');
            
            if (!this.queries.has(key)) {
                const results = [];
                this.entities.forEach(entity => {
                    if (entity.hasComponents(componentTypes)) {
                        results.push(entity);
                    }
                });
                this.queries.set(key, results);
                this.stats.queryCount = this.queries.size;
            }
            
            return this.queries.get(key);
        }
        
        update(deltaTime) {
            // Clear query cache each frame
            this.queries.clear();
            
            // Update all systems
            this.systems.forEach(system => system.update(deltaTime));
        }
        
        registerComponentPool(componentClass, poolSize) {
            const pool = [];
            for (let i = 0; i < poolSize; i++) {
                pool.push(new componentClass());
            }
            this.componentPools.set(componentClass.name, pool);
        }
        
        acquireComponent(componentClass) {
            const poolName = componentClass.name;
            const pool = this.componentPools.get(poolName);
            
            if (pool && pool.length > 0) {
                return pool.pop();
            }
            
            return new componentClass();
        }
        
        releaseComponent(component) {
            const poolName = component.constructor.name;
            const pool = this.componentPools.get(poolName);
            
            if (pool) {
                component.reset();
                pool.push(component);
            }
        }
        
        getStats() {
            return { ...this.stats };
        }
        
        clear() {
            this.entities.clear();
            this.systems = [];
            this.queries.clear();
            this.stats = {
                entityCount: 0,
                componentCount: 0,
                systemCount: 0,
                queryCount: 0
            };
        }
    }

    // === Components ===
    class TransformComponent extends Component {
        constructor() {
            super();
            this.position = new THREE.Vector3(0, 0, 0);
            this.rotation = new THREE.Euler(0, 0, 0);
            this.scale = new THREE.Vector3(1, 1, 1);
            this.matrix = new THREE.Matrix4();
            this.worldMatrix = new THREE.Matrix4();
            this.parent = null;
            this.children = [];
            this.isDirty = true;
        }
        
        setPosition(x, y, z) {
            this.position.set(x, y, z);
            this.isDirty = true;
            return this;
        }
        
        setRotation(x, y, z) {
            this.rotation.set(x, y, z);
            this.isDirty = true;
            return this;
        }
        
        setScale(x, y, z) {
            this.scale.set(x, y, z);
            this.isDirty = true;
            return this;
        }
        
        lookAt(target) {
            const tempMatrix = new THREE.Matrix4();
            tempMatrix.lookAt(this.position, new THREE.Vector3(target.x, target.y, target.z), new THREE.Vector3(0, 1, 0));
            this.rotation.setFromRotationMatrix(tempMatrix);
            this.isDirty = true;
            return this;
        }
        
        updateMatrix() {
            if (this.isDirty) {
                this.matrix.compose(this.position, new THREE.Quaternion().setFromEuler(this.rotation), this.scale);
                this.isDirty = false;
            }
        }
        
        reset() {
            super.reset();
            this.position.set(0, 0, 0);
            this.rotation.set(0, 0, 0);
            this.scale.set(1, 1, 1);
            this.parent = null;
            this.children = [];
            this.isDirty = true;
        }
    }

    class RenderableComponent extends Component {
        constructor() {
            super();
            this.geometry = null;
            this.material = null;
            this.mesh = null;
            this.visible = true;
            this.castShadow = true;
            this.receiveShadow = true;
        }
        
        setGeometry(geometry) {
            this.geometry = geometry;
            this.updateMesh();
            return this;
        }
        
        setMaterial(material) {
            this.material = material;
            this.updateMesh();
            return this;
        }
        
        updateMesh() {
            if (this.geometry && this.material) {
                if (this.mesh) {
                    this.mesh.geometry = this.geometry;
                    this.mesh.material = this.material;
                } else {
                    this.mesh = new THREE.Mesh(this.geometry, this.material);
                    this.mesh.castShadow = this.castShadow;
                    this.mesh.receiveShadow = this.receiveShadow;
                }
            }
        }
        
        reset() {
            super.reset();
            this.geometry = null;
            this.material = null;
            if (this.mesh) {
                if (this.mesh.parent) {
                    this.mesh.parent.remove(this.mesh);
                }
                this.mesh = null;
            }
            this.visible = true;
        }
    }

    class CameraComponent extends Component {
        constructor() {
            super();
            this.camera = null;
            this.isOrthographic = false;
            this.fov = 75;
            this.aspect = window.innerWidth / window.innerHeight;
            this.near = 0.1;
            this.far = 1000;
            this.viewSize = 10;
            this.isMain = false;
            this.createCamera();
        }
        
        createCamera() {
            if (this.isOrthographic) {
                const frustum = this.viewSize;
                this.camera = new THREE.OrthographicCamera(
                    -frustum * this.aspect, frustum * this.aspect,
                    frustum, -frustum,
                    this.near, this.far
                );
            } else {
                this.camera = new THREE.PerspectiveCamera(this.fov, this.aspect, this.near, this.far);
            }
        }
        
        updateProjection() {
            if (this.isOrthographic) {
                const frustum = this.viewSize;
                this.camera.left = -frustum * this.aspect;
                this.camera.right = frustum * this.aspect;
                this.camera.top = frustum;
                this.camera.bottom = -frustum;
                this.camera.updateProjectionMatrix();
            } else {
                this.camera.fov = this.fov;
                this.camera.aspect = this.aspect;
                this.camera.updateProjectionMatrix();
            }
        }
        
        reset() {
            super.reset();
            this.isMain = false;
        }
    }

    class LightComponent extends Component {
        constructor() {
            super();
            this.light = null;
            this.type = 'directional';
            this.color = 0xffffff;
            this.intensity = 1;
            this.castShadow = false;
            this.createLight();
        }
        
        createLight() {
            switch (this.type) {
                case 'ambient':
                    this.light = new THREE.AmbientLight(this.color, this.intensity);
                    break;
                case 'directional':
                    this.light = new THREE.DirectionalLight(this.color, this.intensity);
                    this.light.castShadow = this.castShadow;
                    break;
                case 'point':
                    this.light = new THREE.PointLight(this.color, this.intensity);
                    this.light.castShadow = this.castShadow;
                    break;
                case 'spot':
                    this.light = new THREE.SpotLight(this.color, this.intensity);
                    this.light.castShadow = this.castShadow;
                    break;
            }
        }
        
        reset() {
            super.reset();
            this.castShadow = false;
            this.color = 0xffffff;
            this.intensity = 1;
        }
    }

    // Physics Components
    class RigidbodyComponent extends Component {
        constructor() {
            super();
            this.mass = 1;
            this.velocity = new THREE.Vector3(0, 0, 0);
            this.acceleration = new THREE.Vector3(0, 0, 0);
            this.angularVelocity = new THREE.Vector3(0, 0, 0);
            this.forces = [];
            this.isKinematic = false;
            this.useGravity = true;
            this.drag = 0.01;
            this.angularDrag = 0.05;
            this.isSleeping = false;
            this.sleepThreshold = 0.01;
            this.freezePosition = { x: false, y: false, z: false };
            this.freezeRotation = { x: false, y: false, z: false };
        }
        
        addForce(force) {
            this.forces.push(force.clone());
            this.wakeUp();
        }
        
        addImpulse(impulse) {
            this.velocity.add(impulse.clone().divideScalar(this.mass));
            this.wakeUp();
        }
        
        wakeUp() {
            this.isSleeping = false;
        }
        
        reset() {
            super.reset();
            this.mass = 1;
            this.velocity.set(0, 0, 0);
            this.acceleration.set(0, 0, 0);
            this.angularVelocity.set(0, 0, 0);
            this.forces = [];
            this.isKinematic = false;
            this.useGravity = true;
            this.isSleeping = false;
        }
    }

    class BoxColliderComponent extends Component {
        constructor() {
            super();
            this.size = new THREE.Vector3(1, 1, 1);
            this.center = new THREE.Vector3(0, 0, 0);
            this.isTrigger = false;
        }
        
        setSize(x, y, z) {
            this.size.set(x, y, z);
            return this;
        }
        
        reset() {
            super.reset();
            this.size.set(1, 1, 1);
            this.center.set(0, 0, 0);
            this.isTrigger = false;
        }
    }

    class SphereColliderComponent extends Component {
        constructor() {
            super();
            this.radius = 0.5;
            this.center = new THREE.Vector3(0, 0, 0);
            this.isTrigger = false;
        }
        
        setRadius(radius) {
            this.radius = radius;
            return this;
        }
        
        reset() {
            super.reset();
            this.radius = 0.5;
            this.center.set(0, 0, 0);
            this.isTrigger = false;
        }
    }

    class PlaneColliderComponent extends Component {
        constructor() {
            super();
            this.normal = new THREE.Vector3(0, 1, 0);
            this.distance = 0;
            this.isTrigger = false;
        }
        
        setNormal(x, y, z) {
            this.normal.set(x, y, z).normalize();
            return this;
        }
        
        reset() {
            super.reset();
            this.normal.set(0, 1, 0);
            this.distance = 0;
            this.isTrigger = false;
        }
    }

    class PhysicsMaterialComponent extends Component {
        constructor() {
            super();
            this.friction = 0.5;
            this.restitution = 0.3;
            this.density = 1;
            this.name = 'default';
        }
        
        reset() {
            super.reset();
            this.friction = 0.5;
            this.restitution = 0.3;
            this.density = 1;
            this.name = 'default';
        }
    }

    // Animation Components
    class TweenComponent extends Component {
        constructor() {
            super();
            this.tweens = [];
            this.isPlaying = false;
            this.isPaused = false;
            this.currentTween = null;
        }
        
        addTween(tween) {
            this.tweens.push(tween);
            return this;
        }
        
        play() {
            this.isPlaying = true;
            this.isPaused = false;
            return this;
        }
        
        pause() {
            this.isPaused = true;
            return this;
        }
        
        stop() {
            this.isPlaying = false;
            this.isPaused = false;
            this.currentTween = null;
            return this;
        }
        
        reset() {
            super.reset();
            this.tweens = [];
            this.isPlaying = false;
            this.isPaused = false;
            this.currentTween = null;
        }
    }

    class AnimatorComponent extends Component {
        constructor() {
            super();
            this.currentState = 'idle';
            this.states = new Map();
            this.transitions = new Map();
            this.parameters = new Map();
            this.isPlaying = true;
        }
        
        addState(name, animation) {
            this.states.set(name, animation);
            return this;
        }
        
        addTransition(fromState, toState, condition) {
            const key = `${fromState}->${toState}`;
            this.transitions.set(key, condition);
            return this;
        }
        
        setParameter(name, value) {
            this.parameters.set(name, value);
            return this;
        }
        
        reset() {
            super.reset();
            this.currentState = 'idle';
            this.states.clear();
            this.transitions.clear();
            this.parameters.clear();
            this.isPlaying = true;
        }
    }

    // === Systems ===
    class TransformSystem extends System {
        constructor(world) {
            super(world, 18);
            this.requiredComponents = ['TransformComponent'];
        }
        
        processEntity(entity, deltaTime) {
            const transform = entity.getComponent('TransformComponent');
            transform.updateMatrix();
        }
    }

    class RenderingSystem extends System {
        constructor(world, renderer) {
            super(world, 25);
            this.renderer = renderer;
            this.scene = new THREE.Scene();
            this.activeCamera = null;
            this.requiredComponents = ['TransformComponent', 'RenderableComponent'];
            
            this.scene.background = new THREE.Color(0x87CEEB);
        }
        
        processEntity(entity, deltaTime) {
            const transform = entity.getComponent('TransformComponent');
            const renderable = entity.getComponent('RenderableComponent');
            
            if (renderable.mesh && renderable.visible) {
                // Update mesh position directly instead of using matrix
                renderable.mesh.position.copy(transform.position);
                renderable.mesh.rotation.copy(transform.rotation);
                renderable.mesh.scale.copy(transform.scale);
                renderable.mesh.matrixAutoUpdate = true;
                
                if (!renderable.mesh.parent) {
                    this.scene.add(renderable.mesh);
                    console.log('🎨 Added mesh to scene for entity', entity.id, 'at position', transform.position.toArray());
                }
            }
        }
        
        update(deltaTime) {
            super.update(deltaTime);
            
            // Process renderable entities
            
            // Handle lights
            this.world.query(['LightComponent']).forEach(entity => {
                const light = entity.getComponent('LightComponent');
                if (light.light && !light.light.parent) {
                    this.scene.add(light.light);
                }
            });
            
            // Handle cameras
            this.world.query(['CameraComponent']).forEach(entity => {
                const camera = entity.getComponent('CameraComponent');
                const transform = entity.getComponent('TransformComponent');
                
                if (camera.camera && transform) {
                    camera.camera.position.copy(transform.position);
                    camera.camera.rotation.copy(transform.rotation);
                    
                    if (camera.isMain && !this.activeCamera) {
                        this.activeCamera = camera.camera;
                    }
                }
            });
            
            // Render
            if (this.activeCamera) {
                this.renderer.render(this.scene, this.activeCamera);
            }
        }
        
        setActiveCamera(cameraComponent) {
            this.activeCamera = cameraComponent.camera;
            cameraComponent.isMain = true;
        }
        
        onWindowResize(width, height) {
            if (this.activeCamera) {
                if (this.activeCamera.isOrthographicCamera) {
                    const aspect = width / height;
                    const frustum = this.activeCamera.top;
                    this.activeCamera.left = -frustum * aspect;
                    this.activeCamera.right = frustum * aspect;
                    this.activeCamera.updateProjectionMatrix();
                } else {
                    this.activeCamera.aspect = width / height;
                    this.activeCamera.updateProjectionMatrix();
                }
            }
        }
    }

    class PhysicsSystem extends System {
        constructor(world) {
            super(world, 15);
            this.gravity = new THREE.Vector3(0, -9.81, 0);
            this.enableGravity = true;
            this.requiredComponents = ['TransformComponent', 'RigidbodyComponent'];
        }
        
        processEntity(entity, deltaTime) {
            const transform = entity.getComponent('TransformComponent');
            const rigidbody = entity.getComponent('RigidbodyComponent');
            
            if (rigidbody.isKinematic || rigidbody.isSleeping) return;
            
            // Apply gravity
            if (rigidbody.useGravity && this.enableGravity) {
                rigidbody.forces.push(this.gravity.clone().multiplyScalar(rigidbody.mass));
            }
            
            // Apply forces
            rigidbody.acceleration.set(0, 0, 0);
            rigidbody.forces.forEach(force => {
                rigidbody.acceleration.add(force.clone().divideScalar(rigidbody.mass));
            });
            rigidbody.forces = [];
            
            // Apply drag
            const dragForce = rigidbody.velocity.clone().multiplyScalar(-rigidbody.drag);
            rigidbody.acceleration.add(dragForce);
            
            // Update velocity
            rigidbody.velocity.add(rigidbody.acceleration.clone().multiplyScalar(deltaTime));
            
            // Update position
            const deltaPosition = rigidbody.velocity.clone().multiplyScalar(deltaTime);
            transform.position.add(deltaPosition);
            transform.isDirty = true;
            
            // Check for sleeping
            if (rigidbody.velocity.length() < rigidbody.sleepThreshold) {
                rigidbody.isSleeping = true;
            }
        }
        
        getStats() {
            return {
                gravity: this.gravity.clone(),
                enableGravity: this.enableGravity
            };
        }
    }

    class AnimationSystem extends System {
        constructor(world) {
            super(world, 12);
            this.globalTimeScale = 1.0;
            this.isPaused = false;
            this.requiredComponents = ['TransformComponent'];
        }
        
        update(deltaTime) {
            if (this.isPaused) return;
            
            const scaledDeltaTime = deltaTime * this.globalTimeScale;
            
            this.world.query(['TransformComponent', 'TweenComponent']).forEach(entity => {
                this.processTweenEntity(entity, scaledDeltaTime);
            });
            
            this.world.query(['TransformComponent', 'AnimatorComponent']).forEach(entity => {
                this.processAnimatorEntity(entity, scaledDeltaTime);
            });
        }
        
        processTweenEntity(entity, deltaTime) {
            const tween = entity.getComponent('TweenComponent');
            if (!tween.isPlaying || tween.isPaused) return;
        }
        
        processAnimatorEntity(entity, deltaTime) {
            const animator = entity.getComponent('AnimatorComponent');
            if (!animator.isPlaying) return;
        }
        
        getStats() {
            return {
                globalTimeScale: this.globalTimeScale,
                isPaused: this.isPaused
            };
        }
    }

    // === Game Engine ===
    class GameEngine {
        constructor(container) {
            this.container = container;
            this.renderer = null;
            this.world = new World();
            this.running = false;
            this.paused = false;
            this.lastTime = 0;
            this.targetFPS = 60;
            this.fixedTimeStep = 1000 / this.targetFPS;
            this.accumulator = 0;
            this.maxFrameTime = 250;
            this.currentDemo = null;
            this.onUpdate = null;
            this.frameCount = 0;
            this.fpsHistory = [];
            this.performanceStats = {
                averageFPS: 0,
                minFPS: 60,
                maxFPS: 60,
                frameTime: 0
            };
            
            this.initialize();
        }
        
        initialize() {
            try {
                this.createRenderer();
                this.registerComponentPools();
                this.createCoreSystems();
                this.setupDefaultScene();
                console.log('GameEngine initialized successfully');
            } catch (error) {
                console.error('Failed to initialize GameEngine:', error);
                throw error;
            }
        }
        
        createRenderer() {
            // Check if there's already a canvas in the container
            const existingCanvas = this.container.querySelector('canvas');
            
            if (existingCanvas) {
                // Reuse existing canvas
                this.renderer = new THREE.WebGLRenderer({
                    canvas: existingCanvas,
                    antialias: false,
                    alpha: true,
                    powerPreference: 'high-performance'
                });
                console.log('WebGL Renderer reusing existing canvas');
            } else {
                // Create new canvas
                this.renderer = new THREE.WebGLRenderer({
                    antialias: false,
                    alpha: true,
                    powerPreference: 'high-performance'
                });
                this.container.appendChild(this.renderer.domElement);
                console.log('WebGL Renderer created new canvas');
            }
            
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setClearColor(0x87CEEB, 1);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        registerComponentPools() {
            this.world.registerComponentPool(TransformComponent, 1000);
            this.world.registerComponentPool(RenderableComponent, 500);
            this.world.registerComponentPool(CameraComponent, 10);
            this.world.registerComponentPool(LightComponent, 50);
            this.world.registerComponentPool(RigidbodyComponent, 200);
            this.world.registerComponentPool(BoxColliderComponent, 150);
            this.world.registerComponentPool(SphereColliderComponent, 100);
            this.world.registerComponentPool(PlaneColliderComponent, 20);
            this.world.registerComponentPool(PhysicsMaterialComponent, 50);
            this.world.registerComponentPool(AnimatorComponent, 100);
            this.world.registerComponentPool(TweenComponent, 200);
            console.log('Component pools registered');
        }
        
        createCoreSystems() {
            this.animationSystem = new AnimationSystem(this.world);
            this.physicsSystem = new PhysicsSystem(this.world);
            this.transformSystem = new TransformSystem(this.world);
            this.renderingSystem = new RenderingSystem(this.world, this.renderer);
            
            this.world.addSystem(this.animationSystem);
            this.world.addSystem(this.physicsSystem);
            this.world.addSystem(this.transformSystem);
            this.world.addSystem(this.renderingSystem);
            
            console.log('Core systems created');
        }
        
        setupDefaultScene() {
            this.createDefaultLighting();
            this.createDefaultCamera();
            console.log('Default scene setup complete');
        }
        
        createDefaultLighting() {
            const ambientLight = this.world.createEntity();
            const ambientLightComp = this.world.acquireComponent(LightComponent);
            ambientLightComp.type = 'ambient';
            ambientLightComp.color = 0x404040;
            ambientLightComp.intensity = 0.6;
            
            this.world.addComponent(ambientLight, ambientLightComp);
            this.world.addComponent(ambientLight, this.world.acquireComponent(TransformComponent));
            
            const directionalLight = this.world.createEntity();
            const dirLightComp = this.world.acquireComponent(LightComponent);
            dirLightComp.type = 'directional';
            dirLightComp.color = 0xffffff;
            dirLightComp.intensity = 0.8;
            dirLightComp.castShadow = true;
            
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
            
            transform.setPosition(20, 15, 20);
            transform.lookAt({ x: 0, y: 0, z: 0 });
            
            cameraComp.isOrthographic = false;
            cameraComp.fov = 60;
            
            console.log('📷 Camera positioned at (20, 15, 20) looking at (0, 0, 0) with perspective FOV 60');
            cameraComp.near = 0.1;
            cameraComp.far = 1000;
            
            this.world.addComponent(cameraEntity, cameraComp);
            this.world.addComponent(cameraEntity, transform);
            
            this.renderingSystem.setActiveCamera(cameraComp);
            console.log('Default camera created');
            return cameraEntity;
        }
        
        setCurrentDemo(demo) {
            this.currentDemo = demo;
            if (demo && demo.update) {
                this.onUpdate = (deltaTime) => demo.update(deltaTime);
            } else {
                this.onUpdate = null;
            }
        }
        
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
            this.lastTime = performance.now();
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
            
            if (deltaTime > this.maxFrameTime) {
                deltaTime = this.maxFrameTime;
            }
            
            this.accumulator += deltaTime;
            
            while (this.accumulator >= this.fixedTimeStep) {
                const fixedDeltaTime = this.fixedTimeStep / 1000;
                this.world.update(fixedDeltaTime);
                
                if (this.onUpdate) {
                    this.onUpdate(fixedDeltaTime);
                }
                
                this.accumulator -= this.fixedTimeStep;
            }
            
            this.updatePerformanceStats(deltaTime);
            requestAnimationFrame(() => this.gameLoop());
        }
        
        updatePerformanceStats(deltaTime) {
            this.frameCount++;
            this.performanceStats.frameTime = deltaTime;
            
            const fps = 1000 / deltaTime;
            this.fpsHistory.push(fps);
            
            if (this.fpsHistory.length > 60) {
                this.fpsHistory.shift();
            }
            
            this.performanceStats.averageFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
            this.performanceStats.minFPS = Math.min(...this.fpsHistory);
            this.performanceStats.maxFPS = Math.max(...this.fpsHistory);
        }
        
        // Public API
        createEntity() { return this.world.createEntity(); }
        destroyEntity(entity) { this.world.destroyEntity(entity); }
        addComponent(entity, component) { return this.world.addComponent(entity, component); }
        removeComponent(entity, componentType) { return this.world.removeComponent(entity, componentType); }
        getComponent(entity, componentType) { return entity.getComponent(componentType); }
        query(componentTypes) { return this.world.query(componentTypes); }
        
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
        
        onWindowResize() {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.renderer.setSize(width, height);
            this.renderingSystem.onWindowResize(width, height);
            console.log(`Window resized to ${width}x${height}`);
        }
        
        destroy() {
            this.stop();
            if (this.renderer) {
                // Clear the scene but don't dispose or remove canvas
                this.renderer.clear();
                // Don't dispose or remove - let original demo reuse it
                console.log('GameEngine renderer cleared, canvas preserved');
            }
            this.world.clear();
            console.log('GameEngine destroyed');
        }
    }

    // Make everything globally available for serverless usage
    window.GameEngine = GameEngine;
    window.TransformComponent = TransformComponent;
    window.RenderableComponent = RenderableComponent;
    window.CameraComponent = CameraComponent;
    window.LightComponent = LightComponent;
    window.RigidbodyComponent = RigidbodyComponent;
    window.BoxColliderComponent = BoxColliderComponent;
    window.SphereColliderComponent = SphereColliderComponent;
    window.PlaneColliderComponent = PlaneColliderComponent;
    window.PhysicsMaterialComponent = PhysicsMaterialComponent;
    window.TweenComponent = TweenComponent;
    window.AnimatorComponent = AnimatorComponent;

    console.log('🚀 GameEngine standalone loaded successfully!');
    
})();