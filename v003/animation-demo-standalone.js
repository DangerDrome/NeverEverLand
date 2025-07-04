// Animation Demo - Standalone (No ES6 modules)
class AnimationDemo {
    constructor(gameEngine) {
        this.engine = gameEngine;
        this.currentType = 1;
        this.objects = [];
        this.selectedObject = null;
        this.helpShown = false;
        this.time = 0;
        
        // Demo types
        this.types = {
            1: 'Basic Tweens',
            2: 'Animation States',
            3: 'Complex Sequences', 
            4: 'Physics Animation',
            5: 'UI Animations'
        };
        
        console.log('🎬 Animation Demo initialized');
        console.log('Press H for help, 1-5 for demo types');
    }
    
    async initialize() {
        // Start with type 1
        this.setType(1);
        
        // Show initial help
        this.showHelp();
        
        console.log('Animation Demo ready! Current type:', this.types[this.currentType]);
    }
    
    setType(type) {
        this.currentType = type;
        this.clearObjects();
        
        switch (type) {
            case 1: this.setupBasicTweens(); break;
            case 2: this.setupAnimationStates(); break;
            case 3: this.setupComplexSequences(); break;
            case 4: this.setupPhysicsAnimation(); break;
            case 5: this.setupUIAnimations(); break;
        }
        
        console.log(`Type ${type}: ${this.types[type]}`);
    }
    
    setupBasicTweens() {
        const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff];
        const animations = ['position', 'rotation', 'scale', 'color', 'bounce'];
        
        animations.forEach((anim, index) => {
            const obj = this.createAnimatedCube(-15 + index * 7, 3, 0, colors[index]);
            
            switch (anim) {
                case 'position':
                    this.animatePosition(obj);
                    break;
                case 'rotation':
                    this.animateRotation(obj);
                    break;
                case 'scale':
                    this.animateScale(obj);
                    break;
                case 'color':
                    this.animateColor(obj);
                    break;
                case 'bounce':
                    this.animateBounce(obj);
                    break;
            }
            
            this.objects.push(obj);
        });
    }
    
    setupAnimationStates() {
        // Create objects with state machines
        for (let i = 0; i < 5; i++) {
            const obj = this.createAnimatedCube(-10 + i * 5, 2, 0, 0x66aa66);
            this.setupStateMachine(obj);
            this.objects.push(obj);
        }
    }
    
    setupComplexSequences() {
        // Create objects with complex animation sequences
        for (let i = 0; i < 3; i++) {
            const obj = this.createAnimatedCube(-5 + i * 5, 3, 0, 0x9966ff);
            this.setupComplexSequence(obj, i);
            this.objects.push(obj);
        }
    }
    
    setupPhysicsAnimation() {
        // Create objects that simulate physics with animation
        for (let i = 0; i < 8; i++) {
            const x = -15 + i * 4;
            const obj = this.createAnimatedCube(x, 15, 0, 0xff6600);
            this.setupPhysicsSimulation(obj, i * 0.2);
            this.objects.push(obj);
        }
    }
    
    setupUIAnimations() {
        // Create UI-like animations
        const uiElements = [
            { type: 'button', pos: [-10, 5, 0] },
            { type: 'panel', pos: [0, 5, 0] },
            { type: 'progress', pos: [10, 5, 0] }
        ];
        
        uiElements.forEach(elem => {
            const obj = this.createAnimatedCube(...elem.pos, 0x44aaff);
            this.setupUIAnimation(obj, elem.type);
            this.objects.push(obj);
        });
    }
    
    createAnimatedCube(x, y, z, color) {
        const cube = this.engine.createEntity();
        
        // Transform
        const transform = this.engine.world.acquireComponent(TransformComponent);
        transform.setPosition(x, y, z);
        this.engine.addComponent(cube, transform);
        
        // Renderable
        const renderable = this.engine.world.acquireComponent(RenderableComponent);
        renderable.setGeometry(new THREE.BoxGeometry(1.5, 1.5, 1.5));
        renderable.setMaterial(new THREE.MeshLambertMaterial({ color }));
        this.engine.addComponent(cube, renderable);
        
        // Animation component
        const tween = this.engine.world.acquireComponent(TweenComponent);
        this.engine.addComponent(cube, tween);
        
        // Custom animation properties
        cube.animationData = {
            originalPosition: transform.position.clone(),
            originalRotation: transform.rotation.clone(),
            originalScale: transform.scale.clone(),
            originalColor: color,
            time: 0,
            phase: Math.random() * Math.PI * 2
        };
        
        return cube;
    }
    
    animatePosition(obj) {
        const transform = obj.getComponent('TransformComponent');
        const data = obj.animationData;
        
        obj.updateAnimation = (deltaTime) => {
            data.time += deltaTime;
            const offset = Math.sin(data.time + data.phase) * 3;
            transform.setPosition(
                data.originalPosition.x,
                data.originalPosition.y + offset,
                data.originalPosition.z
            );
        };
    }
    
    animateRotation(obj) {
        const transform = obj.getComponent('TransformComponent');
        const data = obj.animationData;
        
        obj.updateAnimation = (deltaTime) => {
            data.time += deltaTime;
            transform.setRotation(
                data.time,
                data.time * 0.7,
                data.time * 0.5
            );
        };
    }
    
    animateScale(obj) {
        const transform = obj.getComponent('TransformComponent');
        const data = obj.animationData;
        
        obj.updateAnimation = (deltaTime) => {
            data.time += deltaTime;
            const scale = 1 + Math.sin(data.time * 2) * 0.5;
            transform.setScale(scale, scale, scale);
        };
    }
    
    animateColor(obj) {
        const renderable = obj.getComponent('RenderableComponent');
        const data = obj.animationData;
        
        obj.updateAnimation = (deltaTime) => {
            data.time += deltaTime;
            const hue = (data.time * 0.5) % 1;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            renderable.material.color = color;
        };
    }
    
    animateBounce(obj) {
        const transform = obj.getComponent('TransformComponent');
        const data = obj.animationData;
        
        obj.updateAnimation = (deltaTime) => {
            data.time += deltaTime * 3;
            const bounce = Math.abs(Math.sin(data.time)) * 4;
            transform.setPosition(
                data.originalPosition.x,
                data.originalPosition.y + bounce,
                data.originalPosition.z
            );
        };
    }
    
    setupStateMachine(obj) {
        obj.state = 'idle';
        obj.stateTime = 0;
        obj.stateTransitions = {
            idle: { next: 'move', duration: 2 },
            move: { next: 'spin', duration: 3 },
            spin: { next: 'scale', duration: 2 },
            scale: { next: 'idle', duration: 2 }
        };
        
        const transform = obj.getComponent('TransformComponent');
        const data = obj.animationData;
        
        obj.updateAnimation = (deltaTime) => {
            obj.stateTime += deltaTime;
            const currentState = obj.stateTransitions[obj.state];
            
            // Execute current state
            switch (obj.state) {
                case 'idle':
                    // Gentle bob
                    data.time += deltaTime;
                    const bob = Math.sin(data.time * 2) * 0.2;
                    transform.setPosition(
                        data.originalPosition.x,
                        data.originalPosition.y + bob,
                        data.originalPosition.z
                    );
                    break;
                    
                case 'move':
                    // Move in circle
                    const angle = (obj.stateTime / currentState.duration) * Math.PI * 2;
                    transform.setPosition(
                        data.originalPosition.x + Math.cos(angle) * 2,
                        data.originalPosition.y,
                        data.originalPosition.z + Math.sin(angle) * 2
                    );
                    break;
                    
                case 'spin':
                    // Spin rapidly
                    transform.setRotation(
                        obj.stateTime * 10,
                        obj.stateTime * 7,
                        obj.stateTime * 5
                    );
                    break;
                    
                case 'scale':
                    // Scale up and down
                    const scalePhase = (obj.stateTime / currentState.duration) * Math.PI;
                    const scale = 1 + Math.sin(scalePhase) * 0.5;
                    transform.setScale(scale, scale, scale);
                    break;
            }
            
            // Check for state transition
            if (obj.stateTime >= currentState.duration) {
                obj.state = currentState.next;
                obj.stateTime = 0;
                
                // Reset transforms when transitioning
                if (obj.state === 'idle') {
                    transform.setPosition(...data.originalPosition.toArray());
                    transform.setRotation(0, 0, 0);
                    transform.setScale(1, 1, 1);
                }
            }
        };
    }
    
    setupComplexSequence(obj, delay) {
        obj.sequenceTime = -delay;
        obj.currentSequence = 0;
        obj.sequences = [
            { type: 'move', duration: 2, params: { target: [0, 8, 0] } },
            { type: 'rotate', duration: 1, params: { target: [0, Math.PI, 0] } },
            { type: 'scale', duration: 1.5, params: { target: [2, 0.5, 2] } },
            { type: 'return', duration: 2, params: {} }
        ];
        
        const transform = obj.getComponent('TransformComponent');
        const data = obj.animationData;
        
        obj.updateAnimation = (deltaTime) => {
            obj.sequenceTime += deltaTime;
            
            if (obj.sequenceTime < 0) return; // Delay
            
            const seq = obj.sequences[obj.currentSequence];
            if (!seq) return;
            
            const progress = Math.min(obj.sequenceTime / seq.duration, 1);
            const eased = this.easeInOutCubic(progress);
            
            switch (seq.type) {
                case 'move':
                    const targetPos = new THREE.Vector3(...seq.params.target);
                    transform.position.lerpVectors(data.originalPosition, targetPos, eased);
                    break;
                    
                case 'rotate':
                    const targetRot = new THREE.Euler(...seq.params.target);
                    transform.rotation.x = targetRot.x * eased;
                    transform.rotation.y = targetRot.y * eased;
                    transform.rotation.z = targetRot.z * eased;
                    break;
                    
                case 'scale':
                    const targetScale = new THREE.Vector3(...seq.params.target);
                    transform.scale.lerpVectors(new THREE.Vector3(1, 1, 1), targetScale, eased);
                    break;
                    
                case 'return':
                    transform.position.lerpVectors(transform.position, data.originalPosition, eased);
                    transform.rotation.x *= (1 - eased);
                    transform.rotation.y *= (1 - eased);
                    transform.rotation.z *= (1 - eased);
                    transform.scale.lerpVectors(transform.scale, new THREE.Vector3(1, 1, 1), eased);
                    break;
            }
            
            if (progress >= 1) {
                obj.currentSequence = (obj.currentSequence + 1) % obj.sequences.length;
                obj.sequenceTime = 0;
            }
        };
    }
    
    setupPhysicsSimulation(obj, delay) {
        obj.physicsTime = -delay;
        obj.velocity = new THREE.Vector3(0, 0, 0);
        obj.gravity = -20;
        obj.bounce = 0.7;
        obj.ground = 2;
        
        const transform = obj.getComponent('TransformComponent');
        const data = obj.animationData;
        
        obj.updateAnimation = (deltaTime) => {
            obj.physicsTime += deltaTime;
            
            if (obj.physicsTime < 0) return;
            
            // Apply gravity
            obj.velocity.y += obj.gravity * deltaTime;
            
            // Update position
            transform.position.add(obj.velocity.clone().multiplyScalar(deltaTime));
            
            // Bounce off ground
            if (transform.position.y <= obj.ground) {
                transform.position.y = obj.ground;
                obj.velocity.y = Math.abs(obj.velocity.y) * obj.bounce;
                
                // Add some randomness
                obj.velocity.x += (Math.random() - 0.5) * 2;
                obj.velocity.z += (Math.random() - 0.5) * 2;
            }
            
            // Reset if too far
            if (transform.position.y < -10 || transform.position.length() > 50) {
                transform.setPosition(...data.originalPosition.toArray());
                obj.velocity.set(0, 0, 0);
                obj.physicsTime = 0;
            }
        };
    }
    
    setupUIAnimation(obj, type) {
        obj.uiType = type;
        obj.uiTime = 0;
        obj.isHovered = false;
        
        const transform = obj.getComponent('TransformComponent');
        const renderable = obj.getComponent('RenderableComponent');
        const data = obj.animationData;
        
        obj.updateAnimation = (deltaTime) => {
            obj.uiTime += deltaTime;
            
            switch (type) {
                case 'button':
                    // Hover effect simulation
                    const hoverCycle = Math.sin(obj.uiTime * 2) > 0;
                    if (hoverCycle !== obj.isHovered) {
                        obj.isHovered = hoverCycle;
                    }
                    
                    const targetScale = obj.isHovered ? 1.2 : 1;
                    const currentScale = transform.scale.x;
                    const newScale = currentScale + (targetScale - currentScale) * deltaTime * 10;
                    transform.setScale(newScale, newScale, newScale);
                    
                    const targetColor = obj.isHovered ? 0x66ccff : data.originalColor;
                    renderable.material.color.lerp(new THREE.Color(targetColor), deltaTime * 5);
                    break;
                    
                case 'panel':
                    // Slide in/out animation
                    const slidePhase = (obj.uiTime * 0.5) % 4;
                    let offset = 0;
                    
                    if (slidePhase < 1) {
                        offset = this.easeOutCubic(slidePhase) * 5;
                    } else if (slidePhase < 2) {
                        offset = 5;
                    } else if (slidePhase < 3) {
                        offset = 5 - this.easeInCubic(slidePhase - 2) * 5;
                    }
                    
                    transform.setPosition(
                        data.originalPosition.x + offset,
                        data.originalPosition.y,
                        data.originalPosition.z
                    );
                    break;
                    
                case 'progress':
                    // Progress bar animation
                    const progress = (Math.sin(obj.uiTime) + 1) / 2;
                    transform.setScale(progress, 1, 1);
                    
                    // Color based on progress
                    const color = new THREE.Color().setHSL(progress * 0.3, 1, 0.5);
                    renderable.material.color = color;
                    break;
            }
        };
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    easeInCubic(t) {
        return t * t * t;
    }
    
    clearObjects() {
        this.objects.forEach(obj => {
            this.engine.destroyEntity(obj);
        });
        this.objects = [];
        this.selectedObject = null;
    }
    
    update(deltaTime) {
        // Update all object animations
        this.objects.forEach(obj => {
            if (obj.updateAnimation) {
                obj.updateAnimation(deltaTime);
            }
        });
        
        this.time += deltaTime;
    }
    
    onKeyPress(key) {
        switch (key.toLowerCase()) {
            case ' ':
                // Pause/Resume
                this.engine.animationSystem.isPaused = !this.engine.animationSystem.isPaused;
                console.log('Animations:', this.engine.animationSystem.isPaused ? 'PAUSED' : 'RESUMED');
                break;
            case 'arrowup':
                // Speed up
                this.engine.animationSystem.globalTimeScale = Math.min(3, this.engine.animationSystem.globalTimeScale + 0.25);
                console.log('Speed:', this.engine.animationSystem.globalTimeScale + 'x');
                break;
            case 'arrowdown':
                // Slow down
                this.engine.animationSystem.globalTimeScale = Math.max(0.25, this.engine.animationSystem.globalTimeScale - 0.25);
                console.log('Speed:', this.engine.animationSystem.globalTimeScale + 'x');
                break;
            case 'm':
                this.nextType();
                break;
            case 'r':
                this.setType(this.currentType);
                break;
            case 'h':
                this.showHelp();
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                this.setType(parseInt(key));
                break;
        }
    }
    
    onClick(event) {
        // Select objects on click (simple implementation)
        if (this.selectedObject) {
            const renderable = this.selectedObject.getComponent('RenderableComponent');
            renderable.material.emissive.setHex(0x000000);
        }
        
        // Simple selection - just cycle through objects
        const currentIndex = this.objects.indexOf(this.selectedObject);
        this.selectedObject = this.objects[(currentIndex + 1) % this.objects.length];
        
        if (this.selectedObject) {
            const renderable = this.selectedObject.getComponent('RenderableComponent');
            renderable.material.emissive.setHex(0x444400); // Yellow highlight
        }
        
        console.log('Selected object:', this.objects.indexOf(this.selectedObject) + 1);
    }
    
    nextType() {
        this.currentType = (this.currentType % 5) + 1;
        this.setType(this.currentType);
    }
    
    showHelp() {
        console.log(`
🎬 ANIMATION DEMO CONTROLS:
- Space: Pause/Resume all animations
- ↑/↓: Speed up/down animation playback
- Click: Select objects (highlights in yellow)
- M: Next demo type
- R: Restart current demo
- H: Show this help
- 1-5: Switch to specific type

Current Type: ${this.currentType} - ${this.types[this.currentType]}

Available Types:
1. Basic Tweens - Position, rotation, scale, opacity, color animations
2. Animation States - State machines with transitions (Idle→Walk→Run)
3. Complex Sequences - Chained animations with delays
4. Physics Animation - Gravity simulation using easing
5. UI Animations - Button hovers, panel slides, progress bars
        `);
        this.helpShown = true;
    }
}

// Make globally available
window.AnimationDemo = AnimationDemo;