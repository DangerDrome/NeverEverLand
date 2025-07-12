import { Component } from '../core/Component.js';

export class SphereColliderComponent extends Component {
    constructor() {
        super();
        this.radius = 0.5;
        this.offset = { x: 0, y: 0, z: 0 };
        this.isTrigger = false;
        this.collisionLayers = 0x0001; // Default layer
        this.collisionMask = 0xFFFF; // Collide with all layers
        this.active = true;
    }
    
    setRadius(radius) {
        this.radius = Math.max(0.001, radius);
    }
    
    setOffset(x, y, z) {
        this.offset.x = x;
        this.offset.y = y;
        this.offset.z = z;
    }
    
    getCenter(position) {
        return {
            x: position.x + this.offset.x,
            y: position.y + this.offset.y,
            z: position.z + this.offset.z
        };
    }
    
    getBounds(position) {
        const center = this.getCenter(position);
        return {
            min: {
                x: center.x - this.radius,
                y: center.y - this.radius,
                z: center.z - this.radius
            },
            max: {
                x: center.x + this.radius,
                y: center.y + this.radius,
                z: center.z + this.radius
            }
        };
    }
    
    serialize() {
        return {
            radius: this.radius,
            offset: { ...this.offset },
            isTrigger: this.isTrigger,
            collisionLayers: this.collisionLayers,
            collisionMask: this.collisionMask,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.radius = data.radius || 0.5;
        this.offset = data.offset || { x: 0, y: 0, z: 0 };
        this.isTrigger = data.isTrigger || false;
        this.collisionLayers = data.collisionLayers || 0x0001;
        this.collisionMask = data.collisionMask || 0xFFFF;
        this.active = data.active !== false;
    }
}