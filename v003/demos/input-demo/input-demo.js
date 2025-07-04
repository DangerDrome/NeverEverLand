import { TransformComponent } from '../../components/TransformComponent.js';
import { RenderableComponent } from '../../components/RenderableComponent.js';
import { InputComponent } from '../../components/InputComponent.js';

/**
 * Input Demo
 * Demonstrates input system capabilities: keyboard, mouse, gamepad support
 */
export default class InputDemo {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.entities = [];
        this.player = null;
        this.targetCursor = null;
        
        // Input tracking
        this.inputHistory = [];
        this.commandCount = 0;
        this.mouseWorldPos = { x: 0, y: 0, z: 0 };
        
        // Movement settings
        this.moveSpeed = 8;
        this.rotationSpeed = 3;
    }
    
    async initialize() {
        console.log('Initializing Input Demo...');
        
        // Create materials and geometries
        this.materials = this.createMaterials();
        this.geometries = this.createGeometries();
        
        // Create ground
        this.createGround();
        
        // Create player
        this.createPlayer();
        
        // Create mouse cursor indicator
        this.createMouseCursor();
        
        // Focus camera on player
        this.gameEngine.focusCamera(this.player, { x: 0, y: 12, z: 12 });
        
        console.log('Input Demo initialized');
    }
    
    createMaterials() {
        return {
            ground: new THREE.MeshLambertMaterial({ color: 0x4CAF50 }),
            player: new THREE.MeshLambertMaterial({ color: 0x2196F3 }),
            cursor: new THREE.MeshBasicMaterial({ color: 0xFF5722, transparent: true, opacity: 0.7 }),
            trail: new THREE.MeshBasicMaterial({ color: 0xFFEB3B, transparent: true, opacity: 0.5 })
        };
    }
    
    createGeometries() {
        return {
            ground: new THREE.PlaneGeometry(50, 50),
            player: new THREE.BoxGeometry(1, 1.5, 1),
            cursor: new THREE.RingGeometry(0.3, 0.5, 8),
            trail: new THREE.SphereGeometry(0.1, 6, 4)
        };
    }
    
    createGround() {
        const groundEntity = this.gameEngine.createEntity();
        
        const transform = this.gameEngine.world.acquireComponent(TransformComponent);
        transform.setPosition(0, 0, 0);
        transform.setRotation(-Math.PI / 2, 0, 0);
        this.gameEngine.addComponent(groundEntity, transform);
        
        const renderable = this.gameEngine.world.acquireComponent(RenderableComponent);
        renderable.mesh = new THREE.Mesh(this.geometries.ground, this.materials.ground);
        renderable.receiveShadow = true;
        this.gameEngine.addComponent(groundEntity, renderable);
        
        this.gameEngine.renderingSystem.addToScene(renderable.mesh);
        this.entities.push(groundEntity);
    }
    
    createPlayer() {
        this.player = this.gameEngine.createEntity();
        
        // Transform
        const transform = this.gameEngine.world.acquireComponent(TransformComponent);
        transform.setPosition(0, 0.75, 0);
        this.gameEngine.addComponent(this.player, transform);
        
        // Renderable
        const renderable = this.gameEngine.world.acquireComponent(RenderableComponent);
        renderable.mesh = new THREE.Mesh(this.geometries.player, this.materials.player);
        renderable.castShadow = true;
        this.gameEngine.addComponent(this.player, renderable);
        
        // Input - with custom mappings for demo
        const input = this.gameEngine.world.acquireComponent(InputComponent);
        
        // Add custom context for advanced controls
        input.addContext('demo', {
            keys: {
                'KeyJ': 'jump',
                'KeyU': 'special_up',
                'KeyI': 'special_down',
                'KeyO': 'special_left',
                'KeyP': 'special_right',
                'Digit1': 'ability_1',
                'Digit2': 'ability_2',
                'Digit3': 'ability_3',
                'KeyX': 'mark_position'
            },
            mouse: {
                '0': 'move_to_cursor',
                '2': 'face_cursor'
            }
        });
        
        input.setActiveContext('demo');
        this.gameEngine.addComponent(this.player, input);
        
        this.gameEngine.renderingSystem.addToScene(renderable.mesh);
        this.entities.push(this.player);
    }
    
    createMouseCursor() {
        this.targetCursor = this.gameEngine.createEntity();
        
        const transform = this.gameEngine.world.acquireComponent(TransformComponent);
        transform.setPosition(0, 0.1, 0);
        transform.setRotation(-Math.PI / 2, 0, 0);
        this.gameEngine.addComponent(this.targetCursor, transform);
        
        const renderable = this.gameEngine.world.acquireComponent(RenderableComponent);
        renderable.mesh = new THREE.Mesh(this.geometries.cursor, this.materials.cursor);
        renderable.visible = false; // Initially hidden
        this.gameEngine.addComponent(this.targetCursor, renderable);
        
        this.gameEngine.renderingSystem.addToScene(renderable.mesh);
        this.entities.push(this.targetCursor);
    }
    
    update(deltaTime) {
        this.updatePlayerInput(deltaTime);
        this.updateMouseWorldPosition();
        this.trackInputHistory();
        this.updateTrailEffect(deltaTime);
    }
    
    updatePlayerInput(deltaTime) {
        const input = this.player.getComponent('InputComponent');
        const transform = this.player.getComponent('TransformComponent');
        
        if (!input || !transform) return;
        
        // Process commands from input system
        const commands = input.getCommands();
        this.commandCount += commands.length;
        
        // Handle movement
        const movementVector = input.getMovementVector();
        if (movementVector.x !== 0 || movementVector.y !== 0) {
            // Apply movement
            const worldMovement = {
                x: movementVector.x * this.moveSpeed * deltaTime,
                z: -movementVector.y * this.moveSpeed * deltaTime // Invert Y for 3D
            };
            
            transform.translate(worldMovement.x, 0, worldMovement.z);
            
            // Face movement direction
            if (movementVector.x !== 0 || movementVector.y !== 0) {
                const targetRotation = Math.atan2(worldMovement.x, worldMovement.z);
                transform.rotation.y = this.lerp(transform.rotation.y, targetRotation, this.rotationSpeed * deltaTime);
                transform.markDirty();
            }
            
            // Create movement trail
            this.createTrailPoint(transform.position);
        }
        
        // Handle custom commands
        for (const command of commands) {
            this.handleCustomCommand(command, transform, input);
        }
        
        // Keep player in bounds
        this.constrainPlayerPosition(transform);
    }
    
    handleCustomCommand(command, transform, input) {
        switch (command.action) {
            case 'jump':
                if (command.pressed) {
                    // Simple jump animation
                    transform.position.y = 2;
                    setTimeout(() => {
                        transform.position.y = 0.75;
                        transform.markDirty();
                    }, 300);
                    transform.markDirty();
                    console.log('Player jumped!');
                }
                break;
                
            case 'move_to_cursor':
                if (command.pressed && command.worldPosition) {
                    this.movePlayerToPosition(transform, command.worldPosition);
                    this.showCursorTarget(command.worldPosition);
                }
                break;
                
            case 'face_cursor':
                if (command.pressed && command.worldPosition) {
                    this.facePosition(transform, command.worldPosition);
                }
                break;
                
            case 'mark_position':
                if (command.pressed) {
                    this.markCurrentPosition(transform.position);
                }
                break;
                
            case 'ability_1':
            case 'ability_2':
            case 'ability_3':
                if (command.pressed) {
                    console.log(`Activated ${command.action}!`);
                    this.createAbilityEffect(transform.position, command.action);
                }
                break;
                
            case 'special_up':
            case 'special_down':
            case 'special_left':
            case 'special_right':
                if (command.pressed) {
                    const direction = command.action.split('_')[1];
                    this.specialMove(transform, direction);
                }
                break;
        }
    }
    
    updateMouseWorldPosition() {
        // Update mouse world position for cursor following
        const input = this.player.getComponent('InputComponent');
        if (input && input.mouse) {
            // Get camera for world position calculation
            const mainCamera = this.gameEngine.getMainCamera();
            if (mainCamera) {
                const cameraComp = mainCamera.getComponent('CameraComponent');
                if (cameraComp) {
                    input.updateMouseWorldPosition(cameraComp.camera, this.gameEngine.renderingSystem.renderer);
                    this.mouseWorldPos = { ...input.mouse.worldPosition };
                }
            }
        }
    }
    
    movePlayerToPosition(transform, targetPos) {
        // Smooth movement to target position
        const moveSpeed = 15;
        const dx = targetPos.x - transform.position.x;
        const dz = targetPos.z - transform.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance > 0.5) {
            transform.setVelocity(
                (dx / distance) * moveSpeed,
                0,
                (dz / distance) * moveSpeed
            );
            
            // Face movement direction
            this.facePosition(transform, targetPos);
            
            // Stop when close enough
            setTimeout(() => {
                if (transform.getDistance({ position: targetPos }) < 1) {
                    transform.setVelocity(0, 0, 0);
                }
            }, distance / moveSpeed * 800);
        }
    }
    
    facePosition(transform, targetPos) {
        const dx = targetPos.x - transform.position.x;
        const dz = targetPos.z - transform.position.z;
        const targetRotation = Math.atan2(dx, dz);
        transform.setRotation(0, targetRotation, 0);
    }
    
    showCursorTarget(position) {
        const cursorTransform = this.targetCursor.getComponent('TransformComponent');
        const cursorRenderable = this.targetCursor.getComponent('RenderableComponent');
        
        cursorTransform.setPosition(position.x, 0.1, position.z);
        cursorRenderable.visible = true;
        
        // Hide after 2 seconds
        setTimeout(() => {
            cursorRenderable.visible = false;
            cursorRenderable.markDirty();
        }, 2000);
    }
    
    specialMove(transform, direction) {
        const moveDistance = 3;
        let dx = 0, dz = 0;
        
        switch (direction) {
            case 'up': dz = -moveDistance; break;
            case 'down': dz = moveDistance; break;
            case 'left': dx = -moveDistance; break;
            case 'right': dx = moveDistance; break;
        }
        
        transform.translate(dx, 0, dz);
        console.log(`Special move: ${direction}`);
    }
    
    createAbilityEffect(position, ability) {
        // Create temporary visual effect
        const effectEntity = this.gameEngine.createEntity();
        
        const transform = this.gameEngine.world.acquireComponent(TransformComponent);
        transform.setPosition(position.x, position.y + 1, position.z);
        this.gameEngine.addComponent(effectEntity, transform);
        
        const renderable = this.gameEngine.world.acquireComponent(RenderableComponent);
        const color = ability === 'ability_1' ? 0xFF0000 : ability === 'ability_2' ? 0x00FF00 : 0x0000FF;
        const effectMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
        renderable.mesh = new THREE.Mesh(this.geometries.trail, effectMaterial);
        this.gameEngine.addComponent(effectEntity, renderable);
        
        this.gameEngine.renderingSystem.addToScene(renderable.mesh);
        
        // Animate and remove
        let scale = 0.1;
        const animate = () => {
            scale += 0.1;
            transform.setScale(scale, scale, scale);
            renderable.opacity *= 0.95;
            
            if (scale < 3 && renderable.opacity > 0.1) {
                requestAnimationFrame(animate);
            } else {
                this.gameEngine.renderingSystem.removeFromScene(renderable.mesh);
                this.gameEngine.destroyEntity(effectEntity);
            }
        };
        animate();
    }
    
    markCurrentPosition(position) {
        // Create permanent marker
        const markerEntity = this.gameEngine.createEntity();
        
        const transform = this.gameEngine.world.acquireComponent(TransformComponent);
        transform.setPosition(position.x, 0.05, position.z);
        transform.setScale(0.5, 0.1, 0.5);
        this.gameEngine.addComponent(markerEntity, transform);
        
        const renderable = this.gameEngine.world.acquireComponent(RenderableComponent);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        renderable.mesh = new THREE.Mesh(this.geometries.player, markerMaterial);
        this.gameEngine.addComponent(markerEntity, renderable);
        
        this.gameEngine.renderingSystem.addToScene(renderable.mesh);
        this.entities.push(markerEntity);
        
        console.log(`Position marked at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
    }
    
    createTrailPoint(position) {
        // Create trail points that fade over time
        if (Math.random() > 0.8) { // Don't create too many
            const trailEntity = this.gameEngine.createEntity();
            
            const transform = this.gameEngine.world.acquireComponent(TransformComponent);
            transform.setPosition(position.x, 0.1, position.z);
            transform.setScale(0.3, 0.3, 0.3);
            this.gameEngine.addComponent(trailEntity, transform);
            
            const renderable = this.gameEngine.world.acquireComponent(RenderableComponent);
            renderable.mesh = new THREE.Mesh(this.geometries.trail, this.materials.trail.clone());
            this.gameEngine.addComponent(trailEntity, renderable);
            
            this.gameEngine.renderingSystem.addToScene(renderable.mesh);
            
            // Fade out and remove
            setTimeout(() => {
                this.gameEngine.renderingSystem.removeFromScene(renderable.mesh);
                this.gameEngine.destroyEntity(trailEntity);
            }, 3000);
        }
    }
    
    updateTrailEffect(deltaTime) {
        // Update any existing trail effects
        // This could animate trail particles, etc.
    }
    
    trackInputHistory() {
        const input = this.player.getComponent('InputComponent');
        if (!input) return;
        
        // Track recent input for debugging
        this.inputHistory.push({
            timestamp: performance.now(),
            mousePos: { ...input.mouse.position },
            worldPos: { ...this.mouseWorldPos },
            keysPressed: Array.from(input.keys.entries())
                .filter(([key, state]) => state.pressed)
                .map(([key]) => key)
        });
        
        // Keep only recent history
        if (this.inputHistory.length > 60) {
            this.inputHistory.shift();
        }
    }
    
    constrainPlayerPosition(transform) {
        const bounds = 20;
        transform.position.x = Math.max(-bounds, Math.min(bounds, transform.position.x));
        transform.position.z = Math.max(-bounds, Math.min(bounds, transform.position.z));
        transform.position.y = Math.max(0.75, transform.position.y);
    }
    
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    // Get demo statistics
    getStats() {
        const baseStats = this.gameEngine.getStats();
        const input = this.player?.getComponent('InputComponent');
        
        return {
            ...baseStats,
            demo: {
                name: 'Input Demo',
                commandsProcessed: this.commandCount,
                inputHistory: this.inputHistory.length,
                activeContext: input?.activeContext || 'none',
                mouseWorldPos: this.mouseWorldPos,
                playerPosition: this.player?.getComponent('TransformComponent')?.position || { x: 0, y: 0, z: 0 }
            }
        };
    }
    
    // Handle input events
    onKeyPress(key) {
        switch (key) {
            case 'KeyH':
                this.showHelp();
                break;
            case 'KeyC':
                this.clearMarkers();
                break;
            case 'KeyR':
                this.resetPlayerPosition();
                break;
        }
    }
    
    showHelp() {
        console.log(`
🎮 Input Demo Controls:
━━━━━━━━━━━━━━━━━━━━
Movement: WASD / Arrow Keys
Jump: J
Special Moves: U/I/O/P
Abilities: 1/2/3
Mouse Click: Move to cursor
Right Click: Face cursor
Mark Position: X
Clear Markers: C
Reset Position: R
        `);
    }
    
    clearMarkers() {
        // Remove all marker entities (keep player, ground, cursor)
        const markersToRemove = this.entities.filter(entity => 
            entity !== this.player && 
            entity !== this.entities[0] && // ground
            entity !== this.targetCursor
        );
        
        for (const marker of markersToRemove) {
            const renderable = marker.getComponent('RenderableComponent');
            if (renderable?.mesh) {
                this.gameEngine.renderingSystem.removeFromScene(renderable.mesh);
            }
            this.gameEngine.destroyEntity(marker);
        }
        
        // Update entities array
        this.entities = this.entities.filter(entity => !markersToRemove.includes(entity));
        
        console.log('All markers cleared');
    }
    
    resetPlayerPosition() {
        const transform = this.player.getComponent('TransformComponent');
        if (transform) {
            transform.setPosition(0, 0.75, 0);
            transform.setRotation(0, 0, 0);
            transform.setVelocity(0, 0, 0);
            console.log('Player position reset');
        }
    }
    
    // Cleanup
    destroy() {
        for (const entity of this.entities) {
            const renderable = entity.getComponent('RenderableComponent');
            if (renderable?.mesh) {
                this.gameEngine.renderingSystem.removeFromScene(renderable.mesh);
            }
            this.gameEngine.destroyEntity(entity);
        }
        
        Object.values(this.geometries).forEach(geo => geo.dispose());
        Object.values(this.materials).forEach(mat => mat.dispose());
        
        console.log('Input Demo destroyed');
    }
}