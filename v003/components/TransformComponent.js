import { Component } from '../core/Component.js';

/**
 * Transform Component
 * Handles position, rotation, and scale with matrix caching
 */
export class TransformComponent extends Component {
    constructor(x = 0, y = 0, z = 0) {
        super();
        
        // Position
        this.position = { x, y, z };
        this.previousPosition = { x, y, z };
        
        // Rotation (in radians)
        this.rotation = { x: 0, y: 0, z: 0 };
        this.previousRotation = { x: 0, y: 0, z: 0 };
        
        // Scale
        this.scale = { x: 1, y: 1, z: 1 };
        this.previousScale = { x: 1, y: 1, z: 1 };
        
        // Cached matrices (will be computed by TransformSystem)
        this.matrix = null;
        this.worldMatrix = null;
        
        // Hierarchy
        this.parent = null;
        this.children = new Set();
        
        // Movement interpolation
        this.velocity = { x: 0, y: 0, z: 0 };
        this.angularVelocity = { x: 0, y: 0, z: 0 };
        
        // Spatial indexing data
        this.spatialIndex = null;
        this.bounds = null;
    }
    
    // Position methods
    setPosition(x, y, z) {
        this.previousPosition.x = this.position.x;
        this.previousPosition.y = this.position.y;
        this.previousPosition.z = this.position.z;
        
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
        
        this.markDirty();
        this.markChildrenDirty();
    }
    
    translate(dx, dy, dz) {
        this.setPosition(
            this.position.x + dx,
            this.position.y + dy,
            this.position.z + dz
        );
    }
    
    // Rotation methods
    setRotation(x, y, z) {
        this.previousRotation.x = this.rotation.x;
        this.previousRotation.y = this.rotation.y;
        this.previousRotation.z = this.rotation.z;
        
        this.rotation.x = x;
        this.rotation.y = y;
        this.rotation.z = z;
        
        this.markDirty();
        this.markChildrenDirty();
    }
    
    rotate(dx, dy, dz) {
        this.setRotation(
            this.rotation.x + dx,
            this.rotation.y + dy,
            this.rotation.z + dz
        );
    }
    
    // Scale methods
    setScale(x, y, z) {
        this.previousScale.x = this.scale.x;
        this.previousScale.y = this.scale.y;
        this.previousScale.z = this.scale.z;
        
        this.scale.x = x;
        this.scale.y = y ?? x; // Default to uniform scale
        this.scale.z = z ?? x;
        
        this.markDirty();
        this.markChildrenDirty();
    }
    
    setUniformScale(scale) {
        this.setScale(scale, scale, scale);
    }
    
    // Hierarchy methods
    setParent(parentTransform) {
        // Remove from old parent
        if (this.parent) {
            this.parent.children.delete(this);
        }
        
        // Set new parent
        this.parent = parentTransform;
        if (parentTransform) {
            parentTransform.children.add(this);
        }
        
        this.markDirty();
    }
    
    addChild(childTransform) {
        childTransform.setParent(this);
    }
    
    removeChild(childTransform) {
        if (this.children.has(childTransform)) {
            childTransform.setParent(null);
        }
    }
    
    markChildrenDirty() {
        for (const child of this.children) {
            child.markDirty();
            child.markChildrenDirty();
        }
    }
    
    // Utility methods
    getDistance(otherTransform) {
        const dx = this.position.x - otherTransform.position.x;
        const dy = this.position.y - otherTransform.position.y;
        const dz = this.position.z - otherTransform.position.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    getDistance2D(otherTransform) {
        const dx = this.position.x - otherTransform.position.x;
        const dz = this.position.z - otherTransform.position.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
    
    lookAt(target) {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const dz = target.z - this.position.z;
        
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        this.setRotation(
            -Math.atan2(dy, distance),
            Math.atan2(dx, dz),
            0
        );
    }
    
    // Movement interpolation
    setVelocity(x, y, z) {
        this.velocity.x = x;
        this.velocity.y = y;
        this.velocity.z = z;
    }
    
    applyVelocity(deltaTime) {
        if (this.velocity.x !== 0 || this.velocity.y !== 0 || this.velocity.z !== 0) {
            this.translate(
                this.velocity.x * deltaTime,
                this.velocity.y * deltaTime,
                this.velocity.z * deltaTime
            );
        }
        
        if (this.angularVelocity.x !== 0 || this.angularVelocity.y !== 0 || this.angularVelocity.z !== 0) {
            this.rotate(
                this.angularVelocity.x * deltaTime,
                this.angularVelocity.y * deltaTime,
                this.angularVelocity.z * deltaTime
            );
        }
    }
    
    // Interpolation for smooth movement
    getInterpolatedPosition(alpha) {
        return {
            x: this.previousPosition.x + (this.position.x - this.previousPosition.x) * alpha,
            y: this.previousPosition.y + (this.position.y - this.previousPosition.y) * alpha,
            z: this.previousPosition.z + (this.position.z - this.previousPosition.z) * alpha
        };
    }
    
    getInterpolatedRotation(alpha) {
        return {
            x: this.previousRotation.x + (this.rotation.x - this.previousRotation.x) * alpha,
            y: this.previousRotation.y + (this.rotation.y - this.previousRotation.y) * alpha,
            z: this.previousRotation.z + (this.rotation.z - this.previousRotation.z) * alpha
        };
    }
    
    // Reset method for object pooling
    reset() {
        this.setPosition(0, 0, 0);
        this.setRotation(0, 0, 0);
        this.setScale(1, 1, 1);
        this.setVelocity(0, 0, 0);
        this.angularVelocity = { x: 0, y: 0, z: 0 };
        
        this.setParent(null);
        
        // Clear children
        for (const child of this.children) {
            child.setParent(null);
        }
        
        this.matrix = null;
        this.worldMatrix = null;
        this.spatialIndex = null;
        this.bounds = null;
    }
    
    // Serialization
    serialize() {
        return {
            position: { ...this.position },
            rotation: { ...this.rotation },
            scale: { ...this.scale },
            velocity: { ...this.velocity },
            angularVelocity: { ...this.angularVelocity }
        };
    }
    
    deserialize(data) {
        this.setPosition(data.position.x, data.position.y, data.position.z);
        this.setRotation(data.rotation.x, data.rotation.y, data.rotation.z);
        this.setScale(data.scale.x, data.scale.y, data.scale.z);
        
        if (data.velocity) {
            this.setVelocity(data.velocity.x, data.velocity.y, data.velocity.z);
        }
        
        if (data.angularVelocity) {
            this.angularVelocity = { ...data.angularVelocity };
        }
    }
}