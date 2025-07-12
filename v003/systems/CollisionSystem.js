import { System } from '../core/System.js';

export class CollisionSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['TransformComponent'];
        this.priority = 30;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        // Get all entities with colliders
        const entities = this.world.query(['TransformComponent']);
        const colliderEntities = entities.filter(entity => 
            entity.hasComponent('BoxColliderComponent') || 
            entity.hasComponent('SphereColliderComponent')
        );
        
        // Check collisions between all pairs
        for (let i = 0; i < colliderEntities.length; i++) {
            for (let j = i + 1; j < colliderEntities.length; j++) {
                this.checkCollision(colliderEntities[i], colliderEntities[j]);
            }
        }
    }
    
    checkCollision(entityA, entityB) {
        const transformA = entityA.getComponent('TransformComponent');
        const transformB = entityB.getComponent('TransformComponent');
        
        // Skip if either entity has a kinematic rigidbody
        const rigidbodyA = entityA.getComponent('RigidbodyComponent');
        const rigidbodyB = entityB.getComponent('RigidbodyComponent');
        
        if (rigidbodyA && rigidbodyB && rigidbodyA.isKinematic && rigidbodyB.isKinematic) {
            return;
        }
        
        // Get colliders
        const boxA = entityA.getComponent('BoxColliderComponent');
        const sphereA = entityA.getComponent('SphereColliderComponent');
        const boxB = entityB.getComponent('BoxColliderComponent');
        const sphereB = entityB.getComponent('SphereColliderComponent');
        
        let collision = null;
        
        // Check different collision types
        if (sphereA && sphereB) {
            collision = this.sphereSphereCollision(
                transformA.position, sphereA,
                transformB.position, sphereB
            );
        } else if (boxA && boxB) {
            collision = this.boxBoxCollision(
                transformA.position, boxA,
                transformB.position, boxB
            );
        } else if (sphereA && boxB) {
            collision = this.sphereBoxCollision(
                transformA.position, sphereA,
                transformB.position, boxB
            );
        } else if (boxA && sphereB) {
            collision = this.sphereBoxCollision(
                transformB.position, sphereB,
                transformA.position, boxA
            );
            if (collision) {
                collision.normal.x *= -1;
                collision.normal.y *= -1;
                collision.normal.z *= -1;
            }
        }
        
        // Handle collision
        if (collision) {
            this.resolveCollision(entityA, entityB, collision);
        }
    }
    
    sphereSphereCollision(posA, sphereA, posB, sphereB) {
        if (!sphereA.active || !sphereB.active) return null;
        
        const centerA = sphereA.getCenter(posA);
        const centerB = sphereB.getCenter(posB);
        
        const dx = centerB.x - centerA.x;
        const dy = centerB.y - centerA.y;
        const dz = centerB.z - centerA.z;
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDistance = sphereA.radius + sphereB.radius;
        
        if (distance < minDistance) {
            const normal = {
                x: dx / distance,
                y: dy / distance,
                z: dz / distance
            };
            
            return {
                normal: normal,
                depth: minDistance - distance,
                point: {
                    x: centerA.x + normal.x * sphereA.radius,
                    y: centerA.y + normal.y * sphereA.radius,
                    z: centerA.z + normal.z * sphereA.radius
                }
            };
        }
        
        return null;
    }
    
    boxBoxCollision(posA, boxA, posB, boxB) {
        if (!boxA.active || !boxB.active) return null;
        
        const boundsA = boxA.getBounds(posA);
        const boundsB = boxB.getBounds(posB);
        
        const overlapX = Math.min(boundsA.max.x, boundsB.max.x) - Math.max(boundsA.min.x, boundsB.min.x);
        const overlapY = Math.min(boundsA.max.y, boundsB.max.y) - Math.max(boundsA.min.y, boundsB.min.y);
        const overlapZ = Math.min(boundsA.max.z, boundsB.max.z) - Math.max(boundsA.min.z, boundsB.min.z);
        
        if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
            // Find smallest overlap axis
            let normal = { x: 0, y: 0, z: 0 };
            let depth = Infinity;
            
            if (overlapX < overlapY && overlapX < overlapZ) {
                depth = overlapX;
                normal.x = posA.x < posB.x ? -1 : 1;
            } else if (overlapY < overlapZ) {
                depth = overlapY;
                normal.y = posA.y < posB.y ? -1 : 1;
            } else {
                depth = overlapZ;
                normal.z = posA.z < posB.z ? -1 : 1;
            }
            
            return {
                normal: normal,
                depth: depth,
                point: {
                    x: (boundsA.min.x + boundsA.max.x + boundsB.min.x + boundsB.max.x) / 4,
                    y: (boundsA.min.y + boundsA.max.y + boundsB.min.y + boundsB.max.y) / 4,
                    z: (boundsA.min.z + boundsA.max.z + boundsB.min.z + boundsB.max.z) / 4
                }
            };
        }
        
        return null;
    }
    
    sphereBoxCollision(spherePos, sphere, boxPos, box) {
        if (!sphere.active || !box.active) return null;
        
        const center = sphere.getCenter(spherePos);
        const bounds = box.getBounds(boxPos);
        
        // Find closest point on box to sphere center
        const closest = {
            x: Math.max(bounds.min.x, Math.min(center.x, bounds.max.x)),
            y: Math.max(bounds.min.y, Math.min(center.y, bounds.max.y)),
            z: Math.max(bounds.min.z, Math.min(center.z, bounds.max.z))
        };
        
        const dx = center.x - closest.x;
        const dy = center.y - closest.y;
        const dz = center.z - closest.z;
        
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        
        if (distanceSquared < sphere.radius * sphere.radius) {
            const distance = Math.sqrt(distanceSquared);
            const normal = distance > 0 ? {
                x: dx / distance,
                y: dy / distance,
                z: dz / distance
            } : { x: 0, y: 1, z: 0 };
            
            return {
                normal: normal,
                depth: sphere.radius - distance,
                point: closest
            };
        }
        
        return null;
    }
    
    resolveCollision(entityA, entityB, collision) {
        const transformA = entityA.getComponent('TransformComponent');
        const transformB = entityB.getComponent('TransformComponent');
        const rigidbodyA = entityA.getComponent('RigidbodyComponent');
        const rigidbodyB = entityB.getComponent('RigidbodyComponent');
        
        // Skip if no rigidbodies
        if (!rigidbodyA && !rigidbodyB) return;
        
        // Calculate separation
        const separation = collision.depth / 2;
        
        if (rigidbodyA && !rigidbodyA.isKinematic) {
            transformA.position.x -= collision.normal.x * separation;
            transformA.position.y -= collision.normal.y * separation;
            transformA.position.z -= collision.normal.z * separation;
        }
        
        if (rigidbodyB && !rigidbodyB.isKinematic) {
            transformB.position.x += collision.normal.x * separation;
            transformB.position.y += collision.normal.y * separation;
            transformB.position.z += collision.normal.z * separation;
        }
        
        // Apply impulse if entities have velocity
        const velocityA = entityA.getComponent('VelocityComponent');
        const velocityB = entityB.getComponent('VelocityComponent');
        
        if (velocityA && velocityB) {
            const relativeVelocity = {
                x: velocityB.velocity.x - velocityA.velocity.x,
                y: velocityB.velocity.y - velocityA.velocity.y,
                z: velocityB.velocity.z - velocityA.velocity.z
            };
            
            const velocityAlongNormal = 
                relativeVelocity.x * collision.normal.x +
                relativeVelocity.y * collision.normal.y +
                relativeVelocity.z * collision.normal.z;
            
            if (velocityAlongNormal > 0) return;
            
            const restitution = 0.5;
            const impulse = -(1 + restitution) * velocityAlongNormal;
            
            const massA = rigidbodyA ? rigidbodyA.mass : 1;
            const massB = rigidbodyB ? rigidbodyB.mass : 1;
            const totalMass = massA + massB;
            
            if (rigidbodyA && !rigidbodyA.isKinematic) {
                const impulseA = impulse * massB / totalMass;
                velocityA.velocity.x -= impulseA * collision.normal.x;
                velocityA.velocity.y -= impulseA * collision.normal.y;
                velocityA.velocity.z -= impulseA * collision.normal.z;
            }
            
            if (rigidbodyB && !rigidbodyB.isKinematic) {
                const impulseB = impulse * massA / totalMass;
                velocityB.velocity.x += impulseB * collision.normal.x;
                velocityB.velocity.y += impulseB * collision.normal.y;
                velocityB.velocity.z += impulseB * collision.normal.z;
            }
        }
    }
}