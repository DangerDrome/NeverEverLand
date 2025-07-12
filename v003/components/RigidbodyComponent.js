import { Component } from '../core/Component.js';

export class RigidbodyComponent extends Component {
    constructor() {
        super();
        this.mass = 1.0;
        this.drag = 0.01;
        this.angularDrag = 0.05;
        this.useGravity = true;
        this.isKinematic = false;
        this.constraints = {
            freezePositionX: false,
            freezePositionY: false,
            freezePositionZ: false,
            freezeRotationX: false,
            freezeRotationY: false,
            freezeRotationZ: false
        };
        this.active = true;
    }
    
    setMass(mass) {
        this.mass = Math.max(0.001, mass);
    }
    
    setKinematic(isKinematic) {
        this.isKinematic = isKinematic;
    }
    
    freezePosition(x = true, y = true, z = true) {
        this.constraints.freezePositionX = x;
        this.constraints.freezePositionY = y;
        this.constraints.freezePositionZ = z;
    }
    
    freezeRotation(x = true, y = true, z = true) {
        this.constraints.freezeRotationX = x;
        this.constraints.freezeRotationY = y;
        this.constraints.freezeRotationZ = z;
    }
    
    serialize() {
        return {
            mass: this.mass,
            drag: this.drag,
            angularDrag: this.angularDrag,
            useGravity: this.useGravity,
            isKinematic: this.isKinematic,
            constraints: { ...this.constraints },
            active: this.active
        };
    }
    
    deserialize(data) {
        this.mass = data.mass || 1.0;
        this.drag = data.drag || 0.01;
        this.angularDrag = data.angularDrag || 0.05;
        this.useGravity = data.useGravity !== false;
        this.isKinematic = data.isKinematic || false;
        this.constraints = data.constraints || {
            freezePositionX: false,
            freezePositionY: false,
            freezePositionZ: false,
            freezeRotationX: false,
            freezeRotationY: false,
            freezeRotationZ: false
        };
        this.active = data.active !== false;
    }
}