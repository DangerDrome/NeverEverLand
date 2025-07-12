import { Component } from '../core/Component.js';

export class BoxColliderComponent extends Component {
    constructor() {
        super();
        this.size = { x: 1, y: 1, z: 1 };
        this.offset = { x: 0, y: 0, z: 0 };
        this.isTrigger = false;
        this.collisionLayers = 0x0001; // Default layer
        this.collisionMask = 0xFFFF; // Collide with all layers
        this.active = true;
    }
    
    setSize(x, y, z) {
        this.size.x = x;
        this.size.y = y;
        this.size.z = z;
    }
    
    setOffset(x, y, z) {
        this.offset.x = x;
        this.offset.y = y;
        this.offset.z = z;
    }
    
    getBounds(position) {
        return {
            min: {
                x: position.x + this.offset.x - this.size.x / 2,
                y: position.y + this.offset.y - this.size.y / 2,
                z: position.z + this.offset.z - this.size.z / 2
            },
            max: {
                x: position.x + this.offset.x + this.size.x / 2,
                y: position.y + this.offset.y + this.size.y / 2,
                z: position.z + this.offset.z + this.size.z / 2
            }
        };
    }
    
    serialize() {
        return {
            size: { ...this.size },
            offset: { ...this.offset },
            isTrigger: this.isTrigger,
            collisionLayers: this.collisionLayers,
            collisionMask: this.collisionMask,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.size = data.size || { x: 1, y: 1, z: 1 };
        this.offset = data.offset || { x: 0, y: 0, z: 0 };
        this.isTrigger = data.isTrigger || false;
        this.collisionLayers = data.collisionLayers || 0x0001;
        this.collisionMask = data.collisionMask || 0xFFFF;
        this.active = data.active !== false;
    }
}