// Physics Demo - Standalone (No ES6 modules)
class PhysicsDemo {
    constructor(gameEngine) {
        this.engine = gameEngine;
        this.currentMode = 1;
        this.spawnTimer = 0;
        this.spawnInterval = 1.0;
        this.objects = [];
        this.helpShown = false;
        
        // Demo modes
        this.modes = {
            1: 'Bouncing Balls',
            2: 'Collision Test', 
            3: 'Stack Demo',
            4: 'Force Field',
            5: 'Friction Test'
        };
        
        console.log('🔬 Physics Demo initialized');
        console.log('Press H for help, 1-5 for demo modes');
    }
    
    async initialize() {
        console.log('🏗️ Initializing Physics Demo...');
        
        // Create ground plane
        console.log('🏗️ Creating ground...');
        this.createGround();
        
        // Create walls
        console.log('🏗️ Creating walls...');
        this.createWalls();
        
        // Start with mode 1
        console.log('🏗️ Setting initial mode...');
        this.setMode(1);
        
        // Show initial help
        this.showHelp();
        
        console.log('Physics Demo ready! Current mode:', this.modes[this.currentMode]);
        
        // Debug: Check if engine systems are running
        console.log('🔧 Engine systems status:');
        console.log('- Physics System:', this.engine.physicsSystem ? 'EXISTS' : 'MISSING');
        console.log('- Rendering System:', this.engine.renderingSystem ? 'EXISTS' : 'MISSING');
        console.log('- World entity count:', this.engine.world.stats.entityCount);
    }
    
    createGround() {
        console.log('🏗️ Creating ground entity...');
        const ground = this.engine.createEntity();
        console.log('🏗️ Ground entity ID:', ground.id);
        
        // Transform
        const transform = this.engine.world.acquireComponent(TransformComponent);
        transform.setPosition(0, -1, 0);
        this.engine.addComponent(ground, transform);
        console.log('🏗️ Ground transform set to (0, -1, 0)');
        
        // Renderable
        const renderable = this.engine.world.acquireComponent(RenderableComponent);
        renderable.setGeometry(new THREE.BoxGeometry(40, 2, 40));
        renderable.setMaterial(new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
        this.engine.addComponent(ground, renderable);
        console.log('🏗️ Ground renderable added - 40x2x40 brown box');
        
        // Physics
        const rigidbody = this.engine.world.acquireComponent(RigidbodyComponent);
        rigidbody.isKinematic = true;
        rigidbody.mass = 0;
        this.engine.addComponent(ground, rigidbody);
        console.log('🏗️ Ground rigidbody added (kinematic)');
        
        const collider = this.engine.world.acquireComponent(BoxColliderComponent);
        collider.setSize(40, 2, 40);
        this.engine.addComponent(ground, collider);
        console.log('🏗️ Ground collider added');
        
        // Physics material
        const material = this.engine.world.acquireComponent(PhysicsMaterialComponent);
        material.friction = 0.7;
        material.restitution = 0.2;
        material.name = 'ground';
        this.engine.addComponent(ground, material);
        
        console.log('✅ Ground created successfully');
    }
    
    createWalls() {
        const wallPositions = [
            { pos: [0, 5, 20], size: [40, 10, 2] },   // Back
            { pos: [0, 5, -20], size: [40, 10, 2] },  // Front  
            { pos: [20, 5, 0], size: [2, 10, 40] },   // Right
            { pos: [-20, 5, 0], size: [2, 10, 40] }   // Left
        ];
        
        wallPositions.forEach((wall, index) => {
            const entity = this.engine.createEntity();
            
            const transform = this.engine.world.acquireComponent(TransformComponent);
            transform.setPosition(...wall.pos);
            this.engine.addComponent(entity, transform);
            
            const renderable = this.engine.world.acquireComponent(RenderableComponent);
            renderable.setGeometry(new THREE.BoxGeometry(...wall.size));
            renderable.setMaterial(new THREE.MeshLambertMaterial({ 
                color: 0x666666,
                transparent: true,
                opacity: 0.3
            }));
            this.engine.addComponent(entity, renderable);
            
            const rigidbody = this.engine.world.acquireComponent(RigidbodyComponent);
            rigidbody.isKinematic = true;
            rigidbody.mass = 0;
            this.engine.addComponent(entity, rigidbody);
            
            const collider = this.engine.world.acquireComponent(BoxColliderComponent);
            collider.setSize(...wall.size);
            this.engine.addComponent(entity, collider);
        });
        
        console.log('Walls created');
    }
    
    setMode(mode) {
        this.currentMode = mode;
        this.clearDynamicObjects();
        
        switch (mode) {
            case 1: this.setupBouncingBalls(); break;
            case 2: this.setupCollisionTest(); break;
            case 3: this.setupStackDemo(); break;
            case 4: this.setupForceField(); break;
            case 5: this.setupFrictionTest(); break;
        }
        
        console.log(`Mode ${mode}: ${this.modes[mode]}`);
    }
    
    setupBouncingBalls() {
        // Create initial balls
        for (let i = 0; i < 5; i++) {
            this.spawnBall();
        }
    }
    
    setupCollisionTest() {
        const materials = [
            { name: 'bouncy', color: 0xff4444, restitution: 0.9, friction: 0.1 },
            { name: 'ice', color: 0x44aaff, restitution: 0.1, friction: 0.05 },
            { name: 'rubber', color: 0x44ff44, restitution: 0.8, friction: 0.8 },
            { name: 'metal', color: 0xaaaaaa, restitution: 0.3, friction: 0.7 }
        ];
        
        materials.forEach((mat, index) => {
            const ball = this.createBall(
                -15 + index * 10,
                5,
                0,
                mat.color
            );
            
            const material = this.engine.world.acquireComponent(PhysicsMaterialComponent);
            material.restitution = mat.restitution;
            material.friction = mat.friction;
            material.name = mat.name;
            this.engine.addComponent(ball, material);
            
            this.objects.push(ball);
        });
    }
    
    setupStackDemo() {
        // Create a tower of boxes
        for (let i = 0; i < 8; i++) {
            const box = this.createBox(0, 1 + i * 2.1, 5, 0x8B4513);
            this.objects.push(box);
        }
        
        // Create a heavy ball to knock it down
        setTimeout(() => {
            const ball = this.createBall(-10, 15, 5, 0xff0000);
            const rigidbody = ball.getComponent('RigidbodyComponent');
            rigidbody.mass = 10;
            rigidbody.addImpulse(new THREE.Vector3(5, 0, 0));
            this.objects.push(ball);
        }, 1000);
    }
    
    setupForceField() {
        // Create objects around the edges
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const radius = 15;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            const ball = this.createBall(x, 5, z, 0x9966ff);
            this.objects.push(ball);
        }
        
        this.forceFieldActive = true;
    }
    
    setupFrictionTest() {
        // Create ramps with different friction
        const ramps = [
            { x: -10, friction: 0.1, color: 0x44aaff, name: 'ice' },
            { x: 0, friction: 0.5, color: 0x888888, name: 'normal' },
            { x: 10, friction: 0.9, color: 0x8B4513, name: 'rough' }
        ];
        
        ramps.forEach(ramp => {
            // Create ramp
            const rampEntity = this.engine.createEntity();
            
            const transform = this.engine.world.acquireComponent(TransformComponent);
            transform.setPosition(ramp.x, 2, 5);
            transform.setRotation(0, 0, -0.3); // 30 degree slope
            this.engine.addComponent(rampEntity, transform);
            
            const renderable = this.engine.world.acquireComponent(RenderableComponent);
            renderable.setGeometry(new THREE.BoxGeometry(6, 0.5, 8));
            renderable.setMaterial(new THREE.MeshLambertMaterial({ color: ramp.color }));
            this.engine.addComponent(rampEntity, renderable);
            
            const rigidbody = this.engine.world.acquireComponent(RigidbodyComponent);
            rigidbody.isKinematic = true;
            this.engine.addComponent(rampEntity, rigidbody);
            
            const collider = this.engine.world.acquireComponent(BoxColliderComponent);
            collider.setSize(6, 0.5, 8);
            this.engine.addComponent(rampEntity, collider);
            
            const material = this.engine.world.acquireComponent(PhysicsMaterialComponent);
            material.friction = ramp.friction;
            material.name = ramp.name;
            this.engine.addComponent(rampEntity, material);
            
            // Create ball on ramp
            const ball = this.createBall(ramp.x, 8, 0, 0xff6600);
            this.objects.push(ball);
        });
    }
    
    spawnBall() {
        const x = (Math.random() - 0.5) * 30;
        const z = (Math.random() - 0.5) * 30;
        const y = 10 + Math.random() * 10;
        
        const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        console.log(`🏀 Creating ball at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}) with color`, color);
        const ball = this.createBall(x, y, z, color);
        this.objects.push(ball);
        console.log('🏀 Ball created, total objects:', this.objects.length);
        
        return ball;
    }
    
    createBall(x, y, z, color) {
        console.log('🏗️ Creating ball entity...');
        const ball = this.engine.createEntity();
        console.log('🏗️ Ball entity created with ID:', ball.id);
        
        // Transform
        const transform = this.engine.world.acquireComponent(TransformComponent);
        transform.setPosition(x, y, z);
        this.engine.addComponent(ball, transform);
        console.log('🏗️ Transform added at position:', x, y, z);
        
        // Renderable
        const renderable = this.engine.world.acquireComponent(RenderableComponent);
        renderable.setGeometry(new THREE.SphereGeometry(0.5, 16, 16));
        renderable.setMaterial(new THREE.MeshLambertMaterial({ color }));
        this.engine.addComponent(ball, renderable);
        console.log('🏗️ Renderable added with color:', color);
        
        // Physics
        const rigidbody = this.engine.world.acquireComponent(RigidbodyComponent);
        rigidbody.mass = 1;
        rigidbody.useGravity = true;
        this.engine.addComponent(ball, rigidbody);
        console.log('🏗️ Rigidbody added');
        
        const collider = this.engine.world.acquireComponent(SphereColliderComponent);
        collider.setRadius(0.5);
        this.engine.addComponent(ball, collider);
        console.log('🏗️ Collider added');
        
        // Debug: Check what components the ball actually has
        console.log('🏗️ Ball components:', Array.from(ball.components.keys()));
        
        return ball;
    }
    
    createBox(x, y, z, color) {
        const box = this.engine.createEntity();
        
        const transform = this.engine.world.acquireComponent(TransformComponent);
        transform.setPosition(x, y, z);
        this.engine.addComponent(box, transform);
        
        const renderable = this.engine.world.acquireComponent(RenderableComponent);
        renderable.setGeometry(new THREE.BoxGeometry(2, 2, 2));
        renderable.setMaterial(new THREE.MeshLambertMaterial({ color }));
        this.engine.addComponent(box, renderable);
        
        const rigidbody = this.engine.world.acquireComponent(RigidbodyComponent);
        rigidbody.mass = 1;
        this.engine.addComponent(box, rigidbody);
        
        const collider = this.engine.world.acquireComponent(BoxColliderComponent);
        collider.setSize(2, 2, 2);
        this.engine.addComponent(box, collider);
        
        return box;
    }
    
    clearDynamicObjects() {
        this.objects.forEach(obj => {
            this.engine.destroyEntity(obj);
        });
        this.objects = [];
        this.forceFieldActive = false;
    }
    
    update(deltaTime) {
        // Auto-spawn in bouncing balls mode (temporarily disabled for debugging)
        if (false && this.currentMode === 1) {
            this.spawnTimer += deltaTime;
            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnTimer = 0;
                if (this.objects.length < 20) {
                    this.spawnBall();
                }
            }
        }
        
        // Force field mode
        if (this.currentMode === 4 && this.forceFieldActive) {
            this.objects.forEach(obj => {
                const rigidbody = obj.getComponent('RigidbodyComponent');
                const transform = obj.getComponent('TransformComponent');
                
                if (rigidbody && transform) {
                    // Apply force toward center
                    const forceDirection = new THREE.Vector3(0, 5, 0).sub(transform.position);
                    forceDirection.normalize();
                    forceDirection.multiplyScalar(20);
                    rigidbody.addForce(forceDirection);
                }
            });
        }
        
        // Remove objects that fall too far
        this.objects = this.objects.filter(obj => {
            const transform = obj.getComponent('TransformComponent');
            if (transform && transform.position.y < -20) {
                this.engine.destroyEntity(obj);
                return false;
            }
            return true;
        });
    }
    
    onKeyPress(key) {
        console.log('🔬 Physics Demo received key:', key);
        switch (key.toLowerCase()) {
            case ' ':
                console.log('🏀 Spawning ball...');
                this.spawnBall();
                break;
            case 'g':
                this.engine.physicsSystem.enableGravity = !this.engine.physicsSystem.enableGravity;
                console.log('Gravity:', this.engine.physicsSystem.enableGravity ? 'ON' : 'OFF');
                break;
            case 'c':
                this.clearDynamicObjects();
                console.log('Dynamic objects cleared');
                break;
            case 'm':
                this.nextMode();
                break;
            case 'r':
                this.setMode(this.currentMode);
                break;
            case 'h':
                this.showHelp();
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                this.setMode(parseInt(key));
                break;
        }
    }
    
    onClick(event) {
        // Apply upward impulse to objects near click
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.objects.forEach(obj => {
            const rigidbody = obj.getComponent('RigidbodyComponent');
            if (rigidbody) {
                rigidbody.addImpulse(new THREE.Vector3(0, 5, 0));
            }
        });
        
        console.log('Impulse applied to all objects!');
    }
    
    nextMode() {
        this.currentMode = (this.currentMode % 5) + 1;
        this.setMode(this.currentMode);
    }
    
    showHelp() {
        console.log(`
🔬 PHYSICS DEMO CONTROLS:
- Space: Spawn ball at random position
- Click: Apply upward impulse to objects
- G: Toggle gravity on/off
- C: Clear all dynamic objects
- M: Next demo mode
- R: Reset current mode
- H: Show this help
- 1-5: Switch to specific mode

Current Mode: ${this.currentMode} - ${this.modes[this.currentMode]}

Available Modes:
1. Bouncing Balls - Auto-spawning physics objects
2. Collision Test - Different materials (bouncy, ice, rubber, metal)
3. Stack Demo - Box tower knocked down by heavy ball
4. Force Field - Objects attracted to center point
5. Friction Test - Ramps with different friction coefficients
        `);
        this.helpShown = true;
    }
}

// Make globally available
window.PhysicsDemo = PhysicsDemo;