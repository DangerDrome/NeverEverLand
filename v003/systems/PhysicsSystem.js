import { System } from '../core/System.js';
import { VelocityComponent } from '../components/VelocityComponent.js';

export class PhysicsSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['RigidbodyComponent', 'TransformComponent'];
        this.priority = 25;
        this.gravity = new THREE.Vector3(0, -20, 0);
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const rigidbody = entity.getComponent('RigidbodyComponent');
        const transform = entity.getComponent('TransformComponent');
        
        if (!rigidbody.active || rigidbody.isKinematic) return;
        
        // Get or create velocity component
        let velocity = entity.getComponent('VelocityComponent');
        if (!velocity) {
            entity.addComponent(new VelocityComponent());
            velocity = entity.getComponent('VelocityComponent');
        }
        
        // Apply gravity
        if (rigidbody.useGravity) {
            velocity.velocity.add(this.gravity.clone().multiplyScalar(deltaTime));
        }
        
        // Apply drag
        velocity.velocity.multiplyScalar(Math.pow(1 - rigidbody.drag, deltaTime));
        velocity.angularVelocity.multiplyScalar(Math.pow(1 - rigidbody.angularDrag || 0.05, deltaTime));
        
        // Ground check for player controller
        const controller = entity.getComponent('PlayerControllerComponent');
        if (controller) {
            // Simple ground check at y = 1
            if (transform.position.y <= 1 && velocity.velocity.y <= 0) {
                transform.position.y = 1;
                velocity.velocity.y = 0;
                controller.isGrounded = true;
                controller.isJumping = false;
            } else {
                controller.isGrounded = false;
            }
        }
    }
    
    applyForce(entity, force) {
        const rigidbody = entity.getComponent('RigidbodyComponent');
        const velocity = entity.getComponent('VelocityComponent');
        
        if (!rigidbody || !velocity || rigidbody.isKinematic) return;
        
        const acceleration = force.clone().divideScalar(rigidbody.mass);
        velocity.velocity.add(acceleration);
    }
    
    applyImpulse(entity, impulse) {
        const rigidbody = entity.getComponent('RigidbodyComponent');
        const velocity = entity.getComponent('VelocityComponent');
        
        if (!rigidbody || !velocity || rigidbody.isKinematic) return;
        
        velocity.velocity.add(impulse.clone().divideScalar(rigidbody.mass));
    }
    
    setVelocity(entity, newVelocity) {
        const velocity = entity.getComponent('VelocityComponent');
        if (!velocity) return;
        
        velocity.velocity.copy(newVelocity);
    }
}