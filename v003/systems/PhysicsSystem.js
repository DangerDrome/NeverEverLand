import { System } from '../core/System.js';
import { 
    RigidbodyComponent, 
    ColliderComponent, 
    BoxColliderComponent, 
    SphereColliderComponent, 
    PlaneColliderComponent,
    PhysicsMaterialComponent 
} from '../components/PhysicsComponent.js';
import { TransformComponent } from '../components/TransformComponent.js';

/**
 * Physics System
 * Handles physics simulation, collision detection, and resolution
 */
export class PhysicsSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['TransformComponent'];
        this.priority = 15; // Run after input but before rendering
        
        // Physics world settings
        this.gravity = { x: 0, y: -9.81, z: 0 };
        this.timeStep = 1/60; // Fixed timestep for physics
        this.maxSubSteps = 3; // Maximum physics substeps per frame
        this.accumulator = 0; // Time accumulator for fixed timestep
        
        // Collision settings
        this.enableContinuousCollision = false;
        this.collisionIterations = 4; // Collision resolution iterations
        this.separationIterations = 2; // Position correction iterations
        
        // Performance settings
        this.sleepThreshold = 0.1; // Velocity below which objects sleep
        this.sleepTime = 1.0; // Time below threshold before sleeping
        this.broadPhaseGrid = new Map(); // Spatial grid for broad phase collision
        this.gridSize = 10; // Grid cell size for broad phase
        
        // Collision pairs (for optimization)
        this.collisionPairs = new Set();
        this.triggerPairs = new Set();
        
        // Statistics
        this.stats = {
            activeRigidbodies: 0,
            sleepingRigidbodies: 0,
            collisionPairs: 0,
            collisionChecks: 0,
            broadPhaseChecks: 0
        };
        
        console.log('PhysicsSystem initialized');
    }
    
    update(deltaTime, entities) {
        this.resetStats();
        
        // Fixed timestep physics simulation
        this.accumulator += deltaTime;
        
        let substeps = 0;
        while (this.accumulator >= this.timeStep && substeps < this.maxSubSteps) {
            this.physicsStep(this.timeStep, entities);
            this.accumulator -= this.timeStep;
            substeps++;
        }
        
        // Interpolate remaining time for smooth rendering
        const alpha = this.accumulator / this.timeStep;
        this.interpolateTransforms(alpha, entities);
    }
    
    physicsStep(deltaTime, entities) {
        // Get all physics entities
        const rigidbodies = this.getRigidbodies(entities);
        const colliders = this.getColliders(entities);
        
        // Update physics bodies
        this.updateRigidbodies(deltaTime, rigidbodies);
        
        // Collision detection
        this.collisionPairs.clear();
        this.triggerPairs.clear();
        this.broadPhaseCollision(colliders);
        this.narrowPhaseCollision();
        
        // Collision resolution
        this.resolveCollisions(deltaTime);
        
        // Update transforms
        this.updateTransforms(rigidbodies);
        
        // Update collision bounds
        this.updateColliderBounds(colliders);
    }
    
    getRigidbodies(entities) {
        return entities.filter(entity => 
            entity.hasComponent('RigidbodyComponent') && 
            entity.hasComponent('TransformComponent')
        );
    }
    
    getColliders(entities) {
        return entities.filter(entity => 
            entity.hasComponent('ColliderComponent') && 
            entity.hasComponent('TransformComponent')
        );
    }
    
    updateRigidbodies(deltaTime, rigidbodies) {
        for (const entity of rigidbodies) {
            const rigidbody = entity.getComponent('RigidbodyComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (rigidbody.isStatic || !rigidbody.isAwake) {
                this.stats.sleepingRigidbodies++;
                continue;
            }
            
            this.stats.activeRigidbodies++;
            
            // Apply gravity
            if (rigidbody.useGravity && !rigidbody.isKinematic) {
                rigidbody.addForce(
                    this.gravity.x * rigidbody.mass,
                    this.gravity.y * rigidbody.mass,
                    this.gravity.z * rigidbody.mass
                );
            }
            
            // Calculate acceleration from forces
            if (!rigidbody.isKinematic) {
                rigidbody.acceleration.x = rigidbody.force.x * rigidbody.inverseMass;
                rigidbody.acceleration.y = rigidbody.force.y * rigidbody.inverseMass;
                rigidbody.acceleration.z = rigidbody.force.z * rigidbody.inverseMass;
                
                // Apply drag
                const dragFactor = 1.0 - rigidbody.drag * deltaTime;
                rigidbody.velocity.x *= dragFactor;
                rigidbody.velocity.y *= dragFactor;
                rigidbody.velocity.z *= dragFactor;
                
                // Apply angular drag
                const angularDragFactor = 1.0 - rigidbody.angularDrag * deltaTime;
                rigidbody.angularVelocity.x *= angularDragFactor;
                rigidbody.angularVelocity.y *= angularDragFactor;
                rigidbody.angularVelocity.z *= angularDragFactor;
                
                // Integrate velocity
                rigidbody.velocity.x += rigidbody.acceleration.x * deltaTime;
                rigidbody.velocity.y += rigidbody.acceleration.y * deltaTime;
                rigidbody.velocity.z += rigidbody.acceleration.z * deltaTime;
                
                // Check for sleep
                this.checkSleep(rigidbody, deltaTime);
            }
            
            // Clear forces for next frame
            rigidbody.clearForces();
        }
    }
    
    checkSleep(rigidbody, deltaTime) {
        const velocityMagnitude = Math.sqrt(
            rigidbody.velocity.x * rigidbody.velocity.x +
            rigidbody.velocity.y * rigidbody.velocity.y +
            rigidbody.velocity.z * rigidbody.velocity.z
        );
        
        if (velocityMagnitude < this.sleepThreshold) {
            rigidbody.sleepTimer += deltaTime;
            if (rigidbody.sleepTimer > this.sleepTime) {
                rigidbody.sleep();
            }
        } else {
            rigidbody.sleepTimer = 0;
        }
    }
    
    broadPhaseCollision(colliders) {
        // Simple spatial grid broad phase
        this.broadPhaseGrid.clear();
        
        // Assign colliders to grid cells
        for (const entity of colliders) {
            const collider = entity.getComponent('ColliderComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!collider.enabled) continue;
            
            // Calculate grid coordinates
            const gridX = Math.floor(transform.position.x / this.gridSize);
            const gridZ = Math.floor(transform.position.z / this.gridSize);
            const key = `${gridX},${gridZ}`;
            
            if (!this.broadPhaseGrid.has(key)) {
                this.broadPhaseGrid.set(key, []);
            }
            this.broadPhaseGrid.get(key).push(entity);
        }
        
        // Check collisions within each grid cell and neighbors
        for (const [key, entities] of this.broadPhaseGrid) {
            this.checkCollisionsInCell(entities);
            this.stats.broadPhaseChecks += entities.length * (entities.length - 1) / 2;
        }
    }
    
    checkCollisionsInCell(entities) {
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const entityA = entities[i];
                const entityB = entities[j];
                
                const colliderA = entityA.getComponent('ColliderComponent');
                const colliderB = entityB.getComponent('ColliderComponent');
                
                // Check if they can collide
                if (!colliderA.canCollideWith(colliderB)) continue;
                
                // Add to potential collision pairs
                const pairKey = `${Math.min(entityA.id, entityB.id)}-${Math.max(entityA.id, entityB.id)}`;
                
                if (colliderA.isTrigger || colliderB.isTrigger) {
                    this.triggerPairs.add({ entityA, entityB, key: pairKey });
                } else {
                    this.collisionPairs.add({ entityA, entityB, key: pairKey });
                }
            }
        }
    }
    
    narrowPhaseCollision() {
        // Check actual collisions for potential pairs
        for (const pair of this.collisionPairs) {
            this.stats.collisionChecks++;
            
            const collision = this.detectCollision(pair.entityA, pair.entityB);
            if (collision) {
                pair.collision = collision;
                this.stats.collisionPairs++;
            }
        }
        
        // Check triggers
        for (const pair of this.triggerPairs) {
            const collision = this.detectCollision(pair.entityA, pair.entityB);
            if (collision) {
                this.fireTriggerEvent(pair.entityA, pair.entityB, collision);
            }
        }
    }
    
    detectCollision(entityA, entityB) {
        const colliderA = entityA.getComponent('ColliderComponent');
        const colliderB = entityB.getComponent('ColliderComponent');
        const transformA = entityA.getComponent('TransformComponent');
        const transformB = entityB.getComponent('TransformComponent');
        
        // Dispatch to appropriate collision detection function
        const typeKey = `${colliderA.type}-${colliderB.type}`;
        
        switch (typeKey) {
            case 'box-box':
                return this.boxBoxCollision(colliderA, transformA, colliderB, transformB);
            case 'sphere-sphere':
                return this.sphereSphereCollision(colliderA, transformA, colliderB, transformB);
            case 'box-sphere':
            case 'sphere-box':
                return this.boxSphereCollision(
                    colliderA.type === 'box' ? colliderA : colliderB,
                    colliderA.type === 'box' ? transformA : transformB,
                    colliderA.type === 'sphere' ? colliderA : colliderB,
                    colliderA.type === 'sphere' ? transformA : transformB
                );
            case 'plane-box':
            case 'box-plane':
                return this.planeBoxCollision(
                    colliderA.type === 'plane' ? colliderA : colliderB,
                    colliderA.type === 'plane' ? transformA : transformB,
                    colliderA.type === 'box' ? colliderA : colliderB,
                    colliderA.type === 'box' ? transformA : transformB
                );
            case 'plane-sphere':
            case 'sphere-plane':
                return this.planeSphereCollision(
                    colliderA.type === 'plane' ? colliderA : colliderB,
                    colliderA.type === 'plane' ? transformA : transformB,
                    colliderA.type === 'sphere' ? colliderA : colliderB,
                    colliderA.type === 'sphere' ? transformA : transformB
                );
            default:
                return null; // Unsupported collision type
        }
    }
    
    // Collision detection implementations
    boxBoxCollision(colliderA, transformA, colliderB, transformB) {
        // AABB vs AABB collision detection
        const minA = {
            x: transformA.position.x + colliderA.offset.x - colliderA.halfSize.x,
            y: transformA.position.y + colliderA.offset.y - colliderA.halfSize.y,
            z: transformA.position.z + colliderA.offset.z - colliderA.halfSize.z
        };
        const maxA = {
            x: transformA.position.x + colliderA.offset.x + colliderA.halfSize.x,
            y: transformA.position.y + colliderA.offset.y + colliderA.halfSize.y,
            z: transformA.position.z + colliderA.offset.z + colliderA.halfSize.z
        };
        
        const minB = {
            x: transformB.position.x + colliderB.offset.x - colliderB.halfSize.x,
            y: transformB.position.y + colliderB.offset.y - colliderB.halfSize.y,
            z: transformB.position.z + colliderB.offset.z - colliderB.halfSize.z
        };
        const maxB = {
            x: transformB.position.x + colliderB.offset.x + colliderB.halfSize.x,
            y: transformB.position.y + colliderB.offset.y + colliderB.halfSize.y,
            z: transformB.position.z + colliderB.offset.z + colliderB.halfSize.z
        };
        
        // Check for overlap
        if (maxA.x < minB.x || minA.x > maxB.x ||
            maxA.y < minB.y || minA.y > maxB.y ||
            maxA.z < minB.z || minA.z > maxB.z) {
            return null; // No collision
        }
        
        // Calculate overlap distances
        const overlapX = Math.min(maxA.x - minB.x, maxB.x - minA.x);
        const overlapY = Math.min(maxA.y - minB.y, maxB.y - minA.y);
        const overlapZ = Math.min(maxA.z - minB.z, maxB.z - minA.z);
        
        // Find the axis with minimum overlap (separation axis)
        let normal, penetration;
        if (overlapX <= overlapY && overlapX <= overlapZ) {
            normal = { x: transformA.position.x > transformB.position.x ? 1 : -1, y: 0, z: 0 };
            penetration = overlapX;
        } else if (overlapY <= overlapZ) {
            normal = { x: 0, y: transformA.position.y > transformB.position.y ? 1 : -1, z: 0 };
            penetration = overlapY;
        } else {
            normal = { x: 0, y: 0, z: transformA.position.z > transformB.position.z ? 1 : -1 };
            penetration = overlapZ;
        }
        
        // Contact point (simplified - center of overlap)
        const contactPoint = {
            x: (Math.max(minA.x, minB.x) + Math.min(maxA.x, maxB.x)) * 0.5,
            y: (Math.max(minA.y, minB.y) + Math.min(maxA.y, maxB.y)) * 0.5,
            z: (Math.max(minA.z, minB.z) + Math.min(maxA.z, maxB.z)) * 0.5
        };
        
        return {
            normal,
            penetration,
            contactPoint,
            entityA: colliderA,
            entityB: colliderB
        };
    }
    
    sphereSphereCollision(colliderA, transformA, colliderB, transformB) {
        // Calculate distance between sphere centers
        const dx = (transformB.position.x + colliderB.offset.x) - (transformA.position.x + colliderA.offset.x);
        const dy = (transformB.position.y + colliderB.offset.y) - (transformA.position.y + colliderA.offset.y);
        const dz = (transformB.position.z + colliderB.offset.z) - (transformA.position.z + colliderA.offset.z);
        
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        const radiusSum = colliderA.radius + colliderB.radius;
        
        if (distanceSquared >= radiusSum * radiusSum) {
            return null; // No collision
        }
        
        const distance = Math.sqrt(distanceSquared);
        const penetration = radiusSum - distance;
        
        // Normal points from A to B
        let normal;
        if (distance > 0.001) {
            normal = { x: dx / distance, y: dy / distance, z: dz / distance };
        } else {
            // Spheres are at same position, use arbitrary normal
            normal = { x: 1, y: 0, z: 0 };
        }
        
        // Contact point is between the two spheres
        const contactPoint = {
            x: transformA.position.x + colliderA.offset.x + normal.x * colliderA.radius,
            y: transformA.position.y + colliderA.offset.y + normal.y * colliderA.radius,
            z: transformA.position.z + colliderA.offset.z + normal.z * colliderA.radius
        };
        
        return {
            normal,
            penetration,
            contactPoint,
            entityA: colliderA,
            entityB: colliderB
        };
    }
    
    boxSphereCollision(boxCollider, boxTransform, sphereCollider, sphereTransform) {
        // Find closest point on box to sphere center
        const sphereCenter = {
            x: sphereTransform.position.x + sphereCollider.offset.x,
            y: sphereTransform.position.y + sphereCollider.offset.y,
            z: sphereTransform.position.z + sphereCollider.offset.z
        };
        
        const boxMin = {
            x: boxTransform.position.x + boxCollider.offset.x - boxCollider.halfSize.x,
            y: boxTransform.position.y + boxCollider.offset.y - boxCollider.halfSize.y,
            z: boxTransform.position.z + boxCollider.offset.z - boxCollider.halfSize.z
        };
        const boxMax = {
            x: boxTransform.position.x + boxCollider.offset.x + boxCollider.halfSize.x,
            y: boxTransform.position.y + boxCollider.offset.y + boxCollider.halfSize.y,
            z: boxTransform.position.z + boxCollider.offset.z + boxCollider.halfSize.z
        };
        
        const closestPoint = {
            x: Math.max(boxMin.x, Math.min(sphereCenter.x, boxMax.x)),
            y: Math.max(boxMin.y, Math.min(sphereCenter.y, boxMax.y)),
            z: Math.max(boxMin.z, Math.min(sphereCenter.z, boxMax.z))
        };
        
        const dx = sphereCenter.x - closestPoint.x;
        const dy = sphereCenter.y - closestPoint.y;
        const dz = sphereCenter.z - closestPoint.z;
        
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        
        if (distanceSquared >= sphereCollider.radius * sphereCollider.radius) {
            return null; // No collision
        }
        
        const distance = Math.sqrt(distanceSquared);
        const penetration = sphereCollider.radius - distance;
        
        let normal;
        if (distance > 0.001) {
            normal = { x: dx / distance, y: dy / distance, z: dz / distance };
        } else {
            // Sphere center is inside box, use closest box face normal
            const centerToBox = {
                x: sphereCenter.x - (boxTransform.position.x + boxCollider.offset.x),
                y: sphereCenter.y - (boxTransform.position.y + boxCollider.offset.y),
                z: sphereCenter.z - (boxTransform.position.z + boxCollider.offset.z)
            };
            
            // Find the axis with the smallest penetration
            const distToFaceX = boxCollider.halfSize.x - Math.abs(centerToBox.x);
            const distToFaceY = boxCollider.halfSize.y - Math.abs(centerToBox.y);
            const distToFaceZ = boxCollider.halfSize.z - Math.abs(centerToBox.z);
            
            if (distToFaceX <= distToFaceY && distToFaceX <= distToFaceZ) {
                normal = { x: centerToBox.x > 0 ? 1 : -1, y: 0, z: 0 };
            } else if (distToFaceY <= distToFaceZ) {
                normal = { x: 0, y: centerToBox.y > 0 ? 1 : -1, z: 0 };
            } else {
                normal = { x: 0, y: 0, z: centerToBox.z > 0 ? 1 : -1 };
            }
        }
        
        return {
            normal,
            penetration,
            contactPoint: closestPoint,
            entityA: boxCollider,
            entityB: sphereCollider
        };
    }
    
    planeSphereCollision(planeCollider, planeTransform, sphereCollider, sphereTransform) {
        const sphereCenter = {
            x: sphereTransform.position.x + sphereCollider.offset.x,
            y: sphereTransform.position.y + sphereCollider.offset.y,
            z: sphereTransform.position.z + sphereCollider.offset.z
        };
        
        // Calculate distance from sphere center to plane
        const distance = 
            planeCollider.normal.x * sphereCenter.x +
            planeCollider.normal.y * sphereCenter.y +
            planeCollider.normal.z * sphereCenter.z -
            planeCollider.distance;
        
        if (Math.abs(distance) >= sphereCollider.radius) {
            return null; // No collision
        }
        
        const penetration = sphereCollider.radius - Math.abs(distance);
        const normal = distance < 0 ? 
            { x: -planeCollider.normal.x, y: -planeCollider.normal.y, z: -planeCollider.normal.z } :
            { x: planeCollider.normal.x, y: planeCollider.normal.y, z: planeCollider.normal.z };
        
        const contactPoint = {
            x: sphereCenter.x - normal.x * sphereCollider.radius,
            y: sphereCenter.y - normal.y * sphereCollider.radius,
            z: sphereCenter.z - normal.z * sphereCollider.radius
        };
        
        return {
            normal,
            penetration,
            contactPoint,
            entityA: planeCollider,
            entityB: sphereCollider
        };
    }
    
    planeBoxCollision(planeCollider, planeTransform, boxCollider, boxTransform) {
        // This is simplified - only checks if box center is behind plane
        const boxCenter = {
            x: boxTransform.position.x + boxCollider.offset.x,
            y: boxTransform.position.y + boxCollider.offset.y,
            z: boxTransform.position.z + boxCollider.offset.z
        };
        
        const distance = 
            planeCollider.normal.x * boxCenter.x +
            planeCollider.normal.y * boxCenter.y +
            planeCollider.normal.z * boxCenter.z -
            planeCollider.distance;
        
        // Approximate box radius (could be more accurate)
        const boxRadius = Math.sqrt(
            boxCollider.halfSize.x * boxCollider.halfSize.x +
            boxCollider.halfSize.y * boxCollider.halfSize.y +
            boxCollider.halfSize.z * boxCollider.halfSize.z
        );
        
        if (Math.abs(distance) >= boxRadius) {
            return null; // No collision
        }
        
        const penetration = boxRadius - Math.abs(distance);
        const normal = distance < 0 ? 
            { x: -planeCollider.normal.x, y: -planeCollider.normal.y, z: -planeCollider.normal.z } :
            { x: planeCollider.normal.x, y: planeCollider.normal.y, z: planeCollider.normal.z };
        
        const contactPoint = {
            x: boxCenter.x - normal.x * (boxRadius - penetration * 0.5),
            y: boxCenter.y - normal.y * (boxRadius - penetration * 0.5),
            z: boxCenter.z - normal.z * (boxRadius - penetration * 0.5)
        };
        
        return {
            normal,
            penetration,
            contactPoint,
            entityA: planeCollider,
            entityB: boxCollider
        };
    }
    
    resolveCollisions(deltaTime) {
        // Simple impulse-based collision resolution
        for (const pair of this.collisionPairs) {
            if (!pair.collision) continue;
            
            const entityA = pair.entityA;
            const entityB = pair.entityB;
            const collision = pair.collision;
            
            const rigidbodyA = entityA.getComponent('RigidbodyComponent');
            const rigidbodyB = entityB.getComponent('RigidbodyComponent');
            const transformA = entityA.getComponent('TransformComponent');
            const transformB = entityB.getComponent('TransformComponent');
            
            if (!rigidbodyA && !rigidbodyB) continue;
            
            // Calculate relative velocity
            const relativeVelocity = {
                x: (rigidbodyB?.velocity.x || 0) - (rigidbodyA?.velocity.x || 0),
                y: (rigidbodyB?.velocity.y || 0) - (rigidbodyA?.velocity.y || 0),
                z: (rigidbodyB?.velocity.z || 0) - (rigidbodyA?.velocity.z || 0)
            };
            
            // Calculate relative velocity in collision normal direction
            const velocityAlongNormal = 
                relativeVelocity.x * collision.normal.x +
                relativeVelocity.y * collision.normal.y +
                relativeVelocity.z * collision.normal.z;
            
            // Don't resolve if velocities are separating
            if (velocityAlongNormal > 0) continue;
            
            // Calculate restitution
            const restitution = Math.min(
                rigidbodyA?.restitution || 0,
                rigidbodyB?.restitution || 0
            );
            
            // Calculate impulse scalar
            let impulseScalar = -(1 + restitution) * velocityAlongNormal;
            impulseScalar /= (rigidbodyA?.inverseMass || 0) + (rigidbodyB?.inverseMass || 0);
            
            // Apply impulse
            const impulse = {
                x: impulseScalar * collision.normal.x,
                y: impulseScalar * collision.normal.y,
                z: impulseScalar * collision.normal.z
            };
            
            if (rigidbodyA && !rigidbodyA.isStatic && !rigidbodyA.isKinematic) {
                rigidbodyA.velocity.x -= impulse.x * rigidbodyA.inverseMass;
                rigidbodyA.velocity.y -= impulse.y * rigidbodyA.inverseMass;
                rigidbodyA.velocity.z -= impulse.z * rigidbodyA.inverseMass;
                rigidbodyA.wake();
            }
            
            if (rigidbodyB && !rigidbodyB.isStatic && !rigidbodyB.isKinematic) {
                rigidbodyB.velocity.x += impulse.x * rigidbodyB.inverseMass;
                rigidbodyB.velocity.y += impulse.y * rigidbodyB.inverseMass;
                rigidbodyB.velocity.z += impulse.z * rigidbodyB.inverseMass;
                rigidbodyB.wake();
            }
            
            // Position correction to prevent sinking
            const correctionPercent = 0.2; // Usually 20-80%
            const correctionSlop = 0.01; // Usually 0.01 to 0.1
            const correction = Math.max(collision.penetration - correctionSlop, 0) * correctionPercent / 
                              ((rigidbodyA?.inverseMass || 0) + (rigidbodyB?.inverseMass || 0));
            
            const correctionVector = {
                x: correction * collision.normal.x,
                y: correction * collision.normal.y,
                z: correction * collision.normal.z
            };
            
            if (rigidbodyA && !rigidbodyA.isStatic) {
                transformA.position.x -= correctionVector.x * rigidbodyA.inverseMass;
                transformA.position.y -= correctionVector.y * rigidbodyA.inverseMass;
                transformA.position.z -= correctionVector.z * rigidbodyA.inverseMass;
                transformA.markDirty();
            }
            
            if (rigidbodyB && !rigidbodyB.isStatic) {
                transformB.position.x += correctionVector.x * rigidbodyB.inverseMass;
                transformB.position.y += correctionVector.y * rigidbodyB.inverseMass;
                transformB.position.z += correctionVector.z * rigidbodyB.inverseMass;
                transformB.markDirty();
            }
        }
    }
    
    updateTransforms(rigidbodies) {
        for (const entity of rigidbodies) {
            const rigidbody = entity.getComponent('RigidbodyComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (rigidbody.isStatic || !rigidbody.isAwake) continue;
            
            // Store previous position for interpolation
            transform.previousPosition.x = transform.position.x;
            transform.previousPosition.y = transform.position.y;
            transform.previousPosition.z = transform.position.z;
            
            // Integrate position
            if (!rigidbody.freezePosition.x) {
                transform.position.x += rigidbody.velocity.x * this.timeStep;
            }
            if (!rigidbody.freezePosition.y) {
                transform.position.y += rigidbody.velocity.y * this.timeStep;
            }
            if (!rigidbody.freezePosition.z) {
                transform.position.z += rigidbody.velocity.z * this.timeStep;
            }
            
            // Integrate rotation (simplified)
            if (!rigidbody.freezeRotation.x) {
                transform.rotation.x += rigidbody.angularVelocity.x * this.timeStep;
            }
            if (!rigidbody.freezeRotation.y) {
                transform.rotation.y += rigidbody.angularVelocity.y * this.timeStep;
            }
            if (!rigidbody.freezeRotation.z) {
                transform.rotation.z += rigidbody.angularVelocity.z * this.timeStep;
            }
            
            transform.markDirty();
        }
    }
    
    updateColliderBounds(colliders) {
        for (const entity of colliders) {
            const collider = entity.getComponent('ColliderComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!collider.boundsNeedUpdate) continue;
            
            switch (collider.type) {
                case 'box':
                    this.updateBoxBounds(collider, transform);
                    break;
                case 'sphere':
                    this.updateSphereBounds(collider, transform);
                    break;
                case 'plane':
                    // Planes have infinite bounds
                    break;
            }
            
            collider.boundsNeedUpdate = false;
        }
    }
    
    updateBoxBounds(collider, transform) {
        collider.bounds.min.x = transform.position.x + collider.offset.x - collider.halfSize.x;
        collider.bounds.min.y = transform.position.y + collider.offset.y - collider.halfSize.y;
        collider.bounds.min.z = transform.position.z + collider.offset.z - collider.halfSize.z;
        
        collider.bounds.max.x = transform.position.x + collider.offset.x + collider.halfSize.x;
        collider.bounds.max.y = transform.position.y + collider.offset.y + collider.halfSize.y;
        collider.bounds.max.z = transform.position.z + collider.offset.z + collider.halfSize.z;
    }
    
    updateSphereBounds(collider, transform) {
        collider.bounds.min.x = transform.position.x + collider.offset.x - collider.radius;
        collider.bounds.min.y = transform.position.y + collider.offset.y - collider.radius;
        collider.bounds.min.z = transform.position.z + collider.offset.z - collider.radius;
        
        collider.bounds.max.x = transform.position.x + collider.offset.x + collider.radius;
        collider.bounds.max.y = transform.position.y + collider.offset.y + collider.radius;
        collider.bounds.max.z = transform.position.z + collider.offset.z + collider.radius;
    }
    
    interpolateTransforms(alpha, entities) {
        // Interpolate positions for smooth rendering between physics steps
        for (const entity of entities) {
            const rigidbody = entity.getComponent('RigidbodyComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!rigidbody || rigidbody.isStatic || !rigidbody.isAwake) continue;
            
            // This would typically update a separate rendering transform
            // For now, we'll skip interpolation to keep it simple
        }
    }
    
    fireTriggerEvent(entityA, entityB, collision) {
        // Fire trigger events - could be handled by event system
        console.log(`Trigger event: ${entityA.id} triggered ${entityB.id}`);
    }
    
    resetStats() {
        this.stats.activeRigidbodies = 0;
        this.stats.sleepingRigidbodies = 0;
        this.stats.collisionPairs = 0;
        this.stats.collisionChecks = 0;
        this.stats.broadPhaseChecks = 0;
    }
    
    // Public API methods
    setGravity(x, y, z) {
        this.gravity.x = x;
        this.gravity.y = y;
        this.gravity.z = z;
    }
    
    addForceAtPosition(entity, force, position) {
        const rigidbody = entity.getComponent('RigidbodyComponent');
        const transform = entity.getComponent('TransformComponent');
        
        if (!rigidbody || !transform) return;
        
        // Add force
        rigidbody.addForce(force.x, force.y, force.z);
        
        // Calculate torque from force at position
        const r = {
            x: position.x - transform.position.x,
            y: position.y - transform.position.y,
            z: position.z - transform.position.z
        };
        
        // Cross product: r × force
        const torque = {
            x: r.y * force.z - r.z * force.y,
            y: r.z * force.x - r.x * force.z,
            z: r.x * force.y - r.y * force.x
        };
        
        rigidbody.addTorque(torque.x, torque.y, torque.z);
    }
    
    raycast(origin, direction, maxDistance = 100, layerMask = -1) {
        // Simple raycast implementation
        // This is a basic version - a full implementation would be more optimized
        const entities = this.world.query(['ColliderComponent', 'TransformComponent']);
        const hits = [];
        
        for (const entity of entities) {
            const collider = entity.getComponent('ColliderComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!collider.enabled || (collider.layer & layerMask) === 0) continue;
            
            const hit = this.raycastCollider(origin, direction, maxDistance, collider, transform);
            if (hit) {
                hits.push({ entity, hit });
            }
        }
        
        // Sort by distance
        hits.sort((a, b) => a.hit.distance - b.hit.distance);
        
        return hits.length > 0 ? hits[0] : null;
    }
    
    raycastCollider(origin, direction, maxDistance, collider, transform) {
        // Simple raycast for sphere colliders only (for now)
        if (collider.type !== 'sphere') return null;
        
        const sphereCenter = {
            x: transform.position.x + collider.offset.x,
            y: transform.position.y + collider.offset.y,
            z: transform.position.z + collider.offset.z
        };
        
        // Vector from ray origin to sphere center
        const oc = {
            x: origin.x - sphereCenter.x,
            y: origin.y - sphereCenter.y,
            z: origin.z - sphereCenter.z
        };
        
        const a = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
        const b = 2 * (oc.x * direction.x + oc.y * direction.y + oc.z * direction.z);
        const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - collider.radius * collider.radius;
        
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) return null; // No intersection
        
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        
        if (t < 0 || t > maxDistance) return null; // Behind ray or too far
        
        const hitPoint = {
            x: origin.x + direction.x * t,
            y: origin.y + direction.y * t,
            z: origin.z + direction.z * t
        };
        
        const normal = {
            x: (hitPoint.x - sphereCenter.x) / collider.radius,
            y: (hitPoint.y - sphereCenter.y) / collider.radius,
            z: (hitPoint.z - sphereCenter.z) / collider.radius
        };
        
        return {
            point: hitPoint,
            normal,
            distance: t
        };
    }
    
    getStats() {
        return { ...this.stats };
    }
}