import { Component } from '../core/Component.js';

export class VelocityComponent extends Component {
    constructor() {
        super();
        this.velocity = { x: 0, y: 0, z: 0 };
        this.angularVelocity = { x: 0, y: 0, z: 0 };
        this.damping = 0.98;
        this.angularDamping = 0.98;
        this.maxSpeed = 10;
        this.active = true;
    }
    
    setVelocity(x, y, z) {
        this.velocity.x = x;
        this.velocity.y = y;
        this.velocity.z = z;
    }
    
    addVelocity(x, y, z) {
        this.velocity.x += x;
        this.velocity.y += y;
        this.velocity.z += z;
        
        // Clamp to max speed
        const speed = Math.sqrt(
            this.velocity.x * this.velocity.x +
            this.velocity.y * this.velocity.y +
            this.velocity.z * this.velocity.z
        );
        
        if (speed > this.maxSpeed) {
            const scale = this.maxSpeed / speed;
            this.velocity.x *= scale;
            this.velocity.y *= scale;
            this.velocity.z *= scale;
        }
    }
    
    applyDamping() {
        this.velocity.multiplyScalar(this.damping);
        this.angularVelocity.multiplyScalar(this.angularDamping);
    }
    
    serialize() {
        return {
            velocity: { ...this.velocity },
            angularVelocity: { ...this.angularVelocity },
            damping: this.damping,
            angularDamping: this.angularDamping,
            maxSpeed: this.maxSpeed,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.velocity = data.velocity || { x: 0, y: 0, z: 0 };
        this.angularVelocity = data.angularVelocity || { x: 0, y: 0, z: 0 };
        this.damping = data.damping || 0.98;
        this.angularDamping = data.angularDamping || 0.98;
        this.maxSpeed = data.maxSpeed || 10;
        this.active = data.active !== false;
    }
}