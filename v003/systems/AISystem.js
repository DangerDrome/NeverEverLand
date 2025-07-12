import { System } from '../core/System.js';

export class AISystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['AIComponent', 'TransformComponent'];
        this.priority = 35;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const ai = entity.getComponent('AIComponent');
        const transform = entity.getComponent('TransformComponent');
        
        if (!ai.active) return;
        
        // Update behavior based on current state
        switch (ai.currentBehavior) {
            case 'idle':
                this.updateIdle(entity, ai, transform, deltaTime);
                break;
            case 'patrol':
                this.updatePatrol(entity, ai, transform, deltaTime);
                break;
            case 'chase':
                this.updateChase(entity, ai, transform, deltaTime);
                break;
            case 'flee':
                this.updateFlee(entity, ai, transform, deltaTime);
                break;
            case 'attack':
                this.updateAttack(entity, ai, transform, deltaTime);
                break;
        }
        
        // Update perception
        this.updatePerception(entity, ai, transform);
    }
    
    updateIdle(entity, ai, transform, deltaTime) {
        ai.behaviorTimer += deltaTime;
        
        // Randomly switch to patrol after some time
        if (ai.behaviorTimer > 3 + Math.random() * 5) {
            ai.currentBehavior = 'patrol';
            ai.behaviorTimer = 0;
            this.generatePatrolPath(ai, transform);
        }
    }
    
    updatePatrol(entity, ai, transform, deltaTime) {
        if (ai.currentPath.length === 0) {
            ai.currentBehavior = 'idle';
            return;
        }
        
        const target = ai.currentPath[0];
        const dx = target.x - transform.position.x;
        const dz = target.z - transform.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 0.5) {
            // Reached waypoint
            ai.currentPath.shift();
            if (ai.currentPath.length === 0) {
                ai.currentBehavior = 'idle';
            }
        } else {
            // Move towards waypoint
            const speed = ai.stats.moveSpeed * deltaTime;
            transform.position.x += (dx / distance) * speed;
            transform.position.z += (dz / distance) * speed;
            
            // Face direction of movement
            transform.rotation.y = Math.atan2(dx, dz);
        }
    }
    
    updateChase(entity, ai, transform, deltaTime) {
        if (!ai.targetEntity) {
            ai.currentBehavior = 'idle';
            return;
        }
        
        const target = this.world.getEntityById(ai.targetEntity);
        if (!target) {
            ai.targetEntity = null;
            ai.currentBehavior = 'idle';
            return;
        }
        
        const targetTransform = target.getComponent('TransformComponent');
        if (!targetTransform) return;
        
        const dx = targetTransform.position.x - transform.position.x;
        const dz = targetTransform.position.z - transform.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance > ai.detectionRange * 1.5) {
            // Lost target
            ai.targetEntity = null;
            ai.currentBehavior = 'idle';
        } else if (distance < ai.attackRange) {
            // In attack range
            ai.currentBehavior = 'attack';
        } else {
            // Chase target
            const speed = ai.stats.moveSpeed * 1.5 * deltaTime;
            transform.position.x += (dx / distance) * speed;
            transform.position.z += (dz / distance) * speed;
            
            // Face target
            transform.rotation.y = Math.atan2(dx, dz);
        }
    }
    
    updateFlee(entity, ai, transform, deltaTime) {
        if (!ai.targetEntity) {
            ai.currentBehavior = 'idle';
            return;
        }
        
        const threat = this.world.getEntityById(ai.targetEntity);
        if (!threat) {
            ai.targetEntity = null;
            ai.currentBehavior = 'idle';
            return;
        }
        
        const threatTransform = threat.getComponent('TransformComponent');
        if (!threatTransform) return;
        
        const dx = transform.position.x - threatTransform.position.x;
        const dz = transform.position.z - threatTransform.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance > ai.detectionRange * 2) {
            // Safe distance
            ai.targetEntity = null;
            ai.currentBehavior = 'idle';
        } else {
            // Flee from threat
            const speed = ai.stats.moveSpeed * 2 * deltaTime;
            transform.position.x += (dx / distance) * speed;
            transform.position.z += (dz / distance) * speed;
            
            // Face away from threat
            transform.rotation.y = Math.atan2(dx, dz);
        }
    }
    
    updateAttack(entity, ai, transform, deltaTime) {
        if (!ai.targetEntity) {
            ai.currentBehavior = 'idle';
            return;
        }
        
        const target = this.world.getEntityById(ai.targetEntity);
        if (!target) {
            ai.targetEntity = null;
            ai.currentBehavior = 'idle';
            return;
        }
        
        const targetTransform = target.getComponent('TransformComponent');
        if (!targetTransform) return;
        
        const distance = Math.sqrt(
            Math.pow(targetTransform.position.x - transform.position.x, 2) +
            Math.pow(targetTransform.position.z - transform.position.z, 2)
        );
        
        if (distance > ai.attackRange) {
            // Out of range, chase again
            ai.currentBehavior = 'chase';
        } else {
            // Attack (placeholder - would trigger combat system)
            ai.stats.attackCooldown -= deltaTime;
            if (ai.stats.attackCooldown <= 0) {
                console.log(`${entity.getComponent('NameComponent')?.name || 'Entity'} attacks!`);
                ai.stats.attackCooldown = 1.0 / ai.stats.attackSpeed;
            }
        }
    }
    
    updatePerception(entity, ai, transform) {
        const enemies = this.world.query(['TagComponent', 'TransformComponent']);
        
        enemies.forEach(enemy => {
            if (enemy === entity) return;
            
            const tags = enemy.getComponent('TagComponent');
            if (!tags.hasTag('player')) return; // Only detect players for now
            
            const enemyTransform = enemy.getComponent('TransformComponent');
            const distance = Math.sqrt(
                Math.pow(enemyTransform.position.x - transform.position.x, 2) +
                Math.pow(enemyTransform.position.z - transform.position.z, 2)
            );
            
            if (distance <= ai.detectionRange) {
                if (ai.aggression > 50) {
                    ai.targetEntity = enemy.id;
                    ai.currentBehavior = 'chase';
                } else if (ai.aggression < 20) {
                    ai.targetEntity = enemy.id;
                    ai.currentBehavior = 'flee';
                }
            }
        });
    }
    
    generatePatrolPath(ai, transform) {
        ai.currentPath = [];
        const numWaypoints = 3 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < numWaypoints; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 5 + Math.random() * 10;
            
            ai.currentPath.push({
                x: transform.position.x + Math.cos(angle) * distance,
                z: transform.position.z + Math.sin(angle) * distance
            });
        }
    }
}