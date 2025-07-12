import { System } from '../core/System.js';

export class MovementSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['TransformComponent', 'VelocityComponent'];
        this.priority = 20;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const transform = entity.getComponent('TransformComponent');
        const velocity = entity.getComponent('VelocityComponent');
        
        if (!velocity.active) return;
        
        // Apply linear velocity
        if (!entity.hasComponent('RigidbodyComponent') || 
            !entity.getComponent('RigidbodyComponent').constraints.freezePositionX) {
            transform.position.x += velocity.velocity.x * deltaTime;
        }
        
        if (!entity.hasComponent('RigidbodyComponent') || 
            !entity.getComponent('RigidbodyComponent').constraints.freezePositionY) {
            transform.position.y += velocity.velocity.y * deltaTime;
        }
        
        if (!entity.hasComponent('RigidbodyComponent') || 
            !entity.getComponent('RigidbodyComponent').constraints.freezePositionZ) {
            transform.position.z += velocity.velocity.z * deltaTime;
        }
        
        // Apply angular velocity
        if (!entity.hasComponent('RigidbodyComponent') || 
            !entity.getComponent('RigidbodyComponent').constraints.freezeRotationX) {
            transform.rotation.x += velocity.angularVelocity.x * deltaTime;
        }
        
        if (!entity.hasComponent('RigidbodyComponent') || 
            !entity.getComponent('RigidbodyComponent').constraints.freezeRotationY) {
            transform.rotation.y += velocity.angularVelocity.y * deltaTime;
        }
        
        if (!entity.hasComponent('RigidbodyComponent') || 
            !entity.getComponent('RigidbodyComponent').constraints.freezeRotationZ) {
            transform.rotation.z += velocity.angularVelocity.z * deltaTime;
        }
        
        // Apply damping
        velocity.applyDamping();
    }
}