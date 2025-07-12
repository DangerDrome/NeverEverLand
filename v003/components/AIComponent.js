import { Component } from '../core/Component.js';

/**
 * AI Component - Artificial Intelligence behaviors
 * Manages NPC behavior patterns, decision making, and pathfinding
 */
export class AIComponent extends Component {
    constructor() {
        super();
        this.behaviorType = 'idle'; // 'idle', 'follow', 'patrol', 'guard', 'aggressive', 'flee'
        this.target = null;         // Entity ID or position to target
        this.detectionRange = 10.0; // How far the AI can detect targets
        this.attackRange = 2.0;     // How close to attack
        this.moveSpeed = 3.0;       // Movement speed multiplier
        
        // State management
        this.currentState = 'idle';
        this.previousState = 'idle';
        this.stateTimer = 0;
        
        // Pathfinding
        this.path = [];
        this.currentPathIndex = 0;
        this.lastKnownTargetPosition = null;
        
        // Behavior-specific data
        this.patrolPoints = [];     // For patrol behavior
        this.currentPatrolIndex = 0;
        this.guardPosition = null;  // For guard behavior
        this.guardRadius = 5.0;
        
        // Decision making
        this.decisionCooldown = 0.5; // Time between decisions
        this.lastDecisionTime = 0;
        this.aggressionLevel = 0.5; // 0-1, affects behavior choices
        
        this.active = true;
    }
    
    setState(newState) {
        if (this.currentState !== newState) {
            this.previousState = this.currentState;
            this.currentState = newState;
            this.stateTimer = 0;
        }
    }
    
    addPatrolPoint(position) {
        this.patrolPoints.push({ x: position.x, y: position.y, z: position.z });
    }
    
    clearPatrolPoints() {
        this.patrolPoints = [];
        this.currentPatrolIndex = 0;
    }
    
    setGuardPosition(position) {
        this.guardPosition = { x: position.x, y: position.y, z: position.z };
    }
    
    canSeeTarget(myPosition, targetPosition) {
        const dx = targetPosition.x - myPosition.x;
        const dz = targetPosition.z - myPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return distance <= this.detectionRange;
    }
    
    isInAttackRange(myPosition, targetPosition) {
        const dx = targetPosition.x - myPosition.x;
        const dz = targetPosition.z - myPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return distance <= this.attackRange;
    }
    
    calculatePath(from, to) {
        // Simple straight-line path for now
        // In a real implementation, this would use A* or similar
        this.path = [{ x: to.x, y: to.y, z: to.z }];
        this.currentPathIndex = 0;
    }
    
    getNextPathPoint() {
        if (this.currentPathIndex < this.path.length) {
            return this.path[this.currentPathIndex];
        }
        return null;
    }
    
    advancePath() {
        this.currentPathIndex++;
        if (this.currentPathIndex >= this.path.length) {
            this.path = [];
            this.currentPathIndex = 0;
            return false; // Path completed
        }
        return true; // More points remain
    }
    
    serialize() {
        return {
            behaviorType: this.behaviorType,
            target: this.target,
            detectionRange: this.detectionRange,
            attackRange: this.attackRange,
            moveSpeed: this.moveSpeed,
            currentState: this.currentState,
            patrolPoints: [...this.patrolPoints],
            currentPatrolIndex: this.currentPatrolIndex,
            guardPosition: this.guardPosition ? { ...this.guardPosition } : null,
            guardRadius: this.guardRadius,
            aggressionLevel: this.aggressionLevel,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.behaviorType = data.behaviorType || 'idle';
        this.target = data.target || null;
        this.detectionRange = data.detectionRange || 10.0;
        this.attackRange = data.attackRange || 2.0;
        this.moveSpeed = data.moveSpeed || 3.0;
        this.currentState = data.currentState || 'idle';
        this.patrolPoints = data.patrolPoints || [];
        this.currentPatrolIndex = data.currentPatrolIndex || 0;
        this.guardPosition = data.guardPosition || null;
        this.guardRadius = data.guardRadius || 5.0;
        this.aggressionLevel = data.aggressionLevel || 0.5;
        this.active = data.active !== false;
    }
}