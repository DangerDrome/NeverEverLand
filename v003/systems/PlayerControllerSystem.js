import { System } from '../core/System.js';

export class PlayerControllerSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['PlayerControllerComponent', 'InputComponent', 'TransformComponent'];
        this.priority = 10;
        this.gravity = -20;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const controller = entity.getComponent('PlayerControllerComponent');
        const input = entity.getComponent('InputComponent');
        const transform = entity.getComponent('TransformComponent');
        
        if (!controller.active || !input.active) return;
        
        // Movement
        const moveX = (input.keys['KeyA'] || input.keys['ArrowLeft'] ? -1 : 0) + 
                     (input.keys['KeyD'] || input.keys['ArrowRight'] ? 1 : 0);
        const moveZ = (input.keys['KeyW'] || input.keys['ArrowUp'] ? -1 : 0) + 
                     (input.keys['KeyS'] || input.keys['ArrowDown'] ? 1 : 0);
        
        // Normalize diagonal movement
        let moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (moveLength > 0) {
            const normalizedX = moveX / moveLength;
            const normalizedZ = moveZ / moveLength;
            
            transform.position.x += normalizedX * controller.moveSpeed * deltaTime;
            transform.position.z += normalizedZ * controller.moveSpeed * deltaTime;
        }
        
        // Jump handling
        if (input.keys['Space'] && controller.isGrounded && !controller.isJumping) {
            controller.jump();
        }
        
        // Apply jump physics
        if (controller.isJumping || !controller.isGrounded) {
            // Apply gravity to jump velocity
            controller.jumpVelocity += this.gravity * deltaTime;
            
            // Apply jump velocity to position
            transform.position.y += controller.jumpVelocity * deltaTime;
            
            // Ground check
            if (transform.position.y <= 1) { // Assuming ground at y=1
                transform.position.y = 1;
                controller.land();
            }
        }
        
        // Interact
        if (input.keys['KeyE']) {
            this.handleInteraction(entity);
        }
    }
    
    handleInteraction(playerEntity) {
        const playerTransform = playerEntity.getComponent('TransformComponent');
        const interactionRange = 3.0;
        
        // Find nearby interactable entities
        const entities = this.world.query(['TagComponent', 'TransformComponent']);
        
        entities.forEach(entity => {
            if (entity === playerEntity) return;
            
            const tags = entity.getComponent('TagComponent');
            if (!tags.hasTag('interactable')) return;
            
            const transform = entity.getComponent('TransformComponent');
            const distance = Math.sqrt(
                Math.pow(transform.position.x - playerTransform.position.x, 2) +
                Math.pow(transform.position.y - playerTransform.position.y, 2) +
                Math.pow(transform.position.z - playerTransform.position.z, 2)
            );
            
            if (distance <= interactionRange) {
                console.log(`Interacting with ${entity.getComponent('NameComponent')?.name || 'Entity'}`);
            }
        });
    }
}