import { Component } from '../core/Component.js';

/**
 * Rigidbody Component
 * Handles physics properties like mass, velocity, and forces
 */
export class RigidbodyComponent extends Component {
    constructor() {
        super();
        
        // Mass and density
        this.mass = 1.0;
        this.density = 1.0;
        this.inverseMass = 1.0; // Cached for performance
        
        // Linear motion
        this.velocity = { x: 0, y: 0, z: 0 };
        this.acceleration = { x: 0, y: 0, z: 0 };
        this.force = { x: 0, y: 0, z: 0 };
        
        // Angular motion
        this.angularVelocity = { x: 0, y: 0, z: 0 };
        this.angularAcceleration = { x: 0, y: 0, z: 0 };
        this.torque = { x: 0, y: 0, z: 0 };
        
        // Physics properties
        this.drag = 0.01; // Linear drag coefficient
        this.angularDrag = 0.01; // Angular drag coefficient
        this.restitution = 0.5; // Bounciness (0 = no bounce, 1 = perfect bounce)
        this.friction = 0.5; // Friction coefficient
        
        // Physics constraints
        this.isKinematic = false; // If true, not affected by forces but can move
        this.isStatic = false; // If true, never moves
        this.useGravity = true; // If true, affected by global gravity
        this.freezePosition = { x: false, y: false, z: false }; // Freeze axes
        this.freezeRotation = { x: false, y: false, z: false }; // Freeze rotation axes
        
        // Collision detection
        this.isTrigger = false; // If true, doesn't resolve collisions but fires events
        this.detectCollisions = true; // If false, no collision detection
        
        // Physics material reference
        this.material = null;
        
        // State tracking
        this.isAwake = true; // Physics objects can "sleep" for performance
        this.sleepThreshold = 0.1; // Velocity below which object sleeps
        this.sleepTimer = 0; // Time object has been below sleep threshold
        
        this.updateInverseMass();
    }
    
    setMass(mass) {
        this.mass = Math.max(0.001, mass); // Prevent division by zero
        this.updateInverseMass();
        this.markDirty();
    }
    
    updateInverseMass() {
        this.inverseMass = this.isStatic || this.mass === 0 ? 0 : 1.0 / this.mass;
    }
    
    addForce(x, y, z) {
        if (this.isStatic || this.isKinematic) return;
        
        this.force.x += x;
        this.force.y += y;
        this.force.z += z;
        this.wake();
    }
    
    addImpulse(x, y, z) {
        if (this.isStatic || this.isKinematic) return;
        
        this.velocity.x += x * this.inverseMass;
        this.velocity.y += y * this.inverseMass;
        this.velocity.z += z * this.inverseMass;
        this.wake();
    }
    
    addTorque(x, y, z) {
        if (this.isStatic || this.isKinematic) return;
        
        this.torque.x += x;
        this.torque.y += y;
        this.torque.z += z;
        this.wake();
    }
    
    wake() {
        this.isAwake = true;
        this.sleepTimer = 0;
    }
    
    sleep() {
        this.isAwake = false;
        this.velocity.x = this.velocity.y = this.velocity.z = 0;
        this.angularVelocity.x = this.angularVelocity.y = this.angularVelocity.z = 0;
    }
    
    clearForces() {
        this.force.x = this.force.y = this.force.z = 0;
        this.torque.x = this.torque.y = this.torque.z = 0;
    }
    
    getKineticEnergy() {
        const linear = 0.5 * this.mass * (
            this.velocity.x * this.velocity.x +
            this.velocity.y * this.velocity.y +
            this.velocity.z * this.velocity.z
        );
        
        // Simplified angular kinetic energy (assumes sphere)
        const angular = 0.5 * this.mass * 0.4 * (
            this.angularVelocity.x * this.angularVelocity.x +
            this.angularVelocity.y * this.angularVelocity.y +
            this.angularVelocity.z * this.angularVelocity.z
        );
        
        return linear + angular;
    }
}

/**
 * Base Collider Component
 * Base class for all collision shapes
 */
export class ColliderComponent extends Component {
    constructor(type = 'box') {
        super();
        
        this.type = type; // 'box', 'sphere', 'plane', 'capsule', etc.
        this.isTrigger = false; // If true, no collision resolution but events fire
        this.enabled = true;
        
        // Collision layers (bitfield)
        this.layer = 1; // Which layer this collider is on
        this.mask = -1; // Which layers this collider can collide with (-1 = all)
        
        // Physics material
        this.material = null;
        
        // Offset from transform center
        this.offset = { x: 0, y: 0, z: 0 };
        
        // Bounds (calculated by collision system)
        this.bounds = {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 0, y: 0, z: 0 }
        };
        
        this.boundsNeedUpdate = true;
    }
    
    setOffset(x, y, z) {
        this.offset.x = x;
        this.offset.y = y;
        this.offset.z = z;
        this.boundsNeedUpdate = true;
        this.markDirty();
    }
    
    setLayer(layer) {
        this.layer = 1 << Math.max(0, Math.min(31, layer)); // Ensure valid bit
        this.markDirty();
    }
    
    setMask(mask) {
        this.mask = mask;
        this.markDirty();
    }
    
    canCollideWith(otherCollider) {
        return (this.mask & otherCollider.layer) !== 0 && 
               (otherCollider.mask & this.layer) !== 0;
    }
}

/**
 * Box Collider Component
 * Axis-aligned bounding box collision shape
 */
export class BoxColliderComponent extends ColliderComponent {
    constructor(width = 1, height = 1, depth = 1) {
        super('box');
        
        this.size = { x: width, y: height, z: depth };
        this.halfSize = { 
            x: width * 0.5, 
            y: height * 0.5, 
            z: depth * 0.5 
        };
    }
    
    setSize(width, height, depth) {
        this.size.x = width;
        this.size.y = height;
        this.size.z = depth;
        
        this.halfSize.x = width * 0.5;
        this.halfSize.y = height * 0.5;
        this.halfSize.z = depth * 0.5;
        
        this.boundsNeedUpdate = true;
        this.markDirty();
    }
}

/**
 * Sphere Collider Component
 * Spherical collision shape
 */
export class SphereColliderComponent extends ColliderComponent {
    constructor(radius = 0.5) {
        super('sphere');
        
        this.radius = radius;
    }
    
    setRadius(radius) {
        this.radius = Math.max(0.001, radius);
        this.boundsNeedUpdate = true;
        this.markDirty();
    }
}

/**
 * Plane Collider Component
 * Infinite plane collision shape
 */
export class PlaneColliderComponent extends ColliderComponent {
    constructor(normal = { x: 0, y: 1, z: 0 }, distance = 0) {
        super('plane');
        
        // Plane equation: normal.x * x + normal.y * y + normal.z * z = distance
        this.normal = { ...normal };
        this.distance = distance;
        
        this.normalizeNormal();
    }
    
    setNormal(x, y, z) {
        this.normal.x = x;
        this.normal.y = y;
        this.normal.z = z;
        this.normalizeNormal();
        this.markDirty();
    }
    
    setDistance(distance) {
        this.distance = distance;
        this.markDirty();
    }
    
    normalizeNormal() {
        const length = Math.sqrt(
            this.normal.x * this.normal.x +
            this.normal.y * this.normal.y +
            this.normal.z * this.normal.z
        );
        
        if (length > 0.001) {
            this.normal.x /= length;
            this.normal.y /= length;
            this.normal.z /= length;
        } else {
            // Default to up vector if invalid normal
            this.normal.x = 0;
            this.normal.y = 1;
            this.normal.z = 0;
        }
    }
}

/**
 * Physics Material Component
 * Defines surface properties for physics interactions
 */
export class PhysicsMaterialComponent extends Component {
    constructor() {
        super();
        
        this.friction = 0.5; // Static friction coefficient
        this.dynamicFriction = 0.4; // Kinetic friction coefficient
        this.restitution = 0.3; // Bounciness (0 = no bounce, 1 = perfect bounce)
        this.density = 1.0; // Material density
        
        // Advanced properties
        this.frictionCombine = 'average'; // 'average', 'multiply', 'minimum', 'maximum'
        this.bounceCombine = 'average'; // How to combine restitution values
    }
    
    static combineValues(value1, value2, combineMode) {
        switch (combineMode) {
            case 'multiply':
                return value1 * value2;
            case 'minimum':
                return Math.min(value1, value2);
            case 'maximum':
                return Math.max(value1, value2);
            case 'average':
            default:
                return (value1 + value2) * 0.5;
        }
    }
    
    static combineFriction(material1, material2) {
        return PhysicsMaterialComponent.combineValues(
            material1.friction,
            material2.friction,
            material1.frictionCombine
        );
    }
    
    static combineRestitution(material1, material2) {
        return PhysicsMaterialComponent.combineValues(
            material1.restitution,
            material2.restitution,
            material1.bounceCombine
        );
    }
}