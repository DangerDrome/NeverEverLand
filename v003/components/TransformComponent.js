import { Component } from '../core/Component.js';

export class TransformComponent extends Component {
    constructor(x = 0, y = 0, z = 0) {
        super();
        this.position = new THREE.Vector3(x, y, z);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.scale = new THREE.Vector3(1, 1, 1);
        this.active = true;
    }
    
    setPosition(x, y, z) {
        this.position.set(x, y, z);
    }
    
    setRotation(x, y, z) {
        this.rotation.set(x, y, z);
    }
    
    setScale(x, y, z) {
        this.scale.set(x, y, z);
    }
    
    lookAt(target) {
        const direction = new THREE.Vector3().subVectors(target, this.position).normalize();
        this.rotation.y = Math.atan2(direction.x, direction.z);
    }
    
    serialize() {
        return {
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            rotation: { x: this.rotation.x, y: this.rotation.y, z: this.rotation.z },
            scale: { x: this.scale.x, y: this.scale.y, z: this.scale.z },
            active: this.active
        };
    }
    
    deserialize(data) {
        if (data.position) {
            this.position.set(data.position.x, data.position.y, data.position.z);
        }
        if (data.rotation) {
            this.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
        }
        if (data.scale) {
            this.scale.set(data.scale.x, data.scale.y, data.scale.z);
        }
        this.active = data.active !== false;
    }
}