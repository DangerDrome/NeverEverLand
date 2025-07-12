import { Component } from '../core/Component.js';

/**
 * Combat Component - Combat mechanics and state
 * Manages combat attributes, damage calculation, and status effects
 */
export class CombatComponent extends Component {
    constructor() {
        super();
        
        // Combat stats
        this.attackPower = 10;
        this.attackSpeed = 1.0;     // Attacks per second
        this.attackRange = 2.0;
        this.accuracy = 0.95;       // Hit chance
        this.criticalChance = 0.1;
        this.criticalMultiplier = 2.0;
        
        // Defense stats
        this.armor = 0;
        this.evasion = 0.05;        // Dodge chance
        this.resistance = 0;        // Magic resistance
        
        // Combat state
        this.isInCombat = false;
        this.combatTarget = null;   // Entity ID
        this.lastAttackTime = 0;
        this.comboCount = 0;
        this.comboWindow = 2.0;     // Seconds to maintain combo
        
        // Status effects
        this.statusEffects = [];    // Array of { type, duration, strength, startTime }
        
        // Damage modifiers
        this.damageModifiers = {
            physical: 1.0,
            magical: 1.0,
            elemental: 1.0
        };
        
        // Combat abilities
        this.abilities = [];        // Array of ability IDs
        this.cooldowns = new Map(); // Ability ID -> cooldown remaining
        
        this.active = true;
    }
    
    canAttack(currentTime) {
        const timeSinceLastAttack = currentTime - this.lastAttackTime;
        const attackInterval = 1.0 / this.attackSpeed;
        return timeSinceLastAttack >= attackInterval;
    }
    
    performAttack(currentTime) {
        this.lastAttackTime = currentTime;
        
        // Check for combo
        if (currentTime - this.lastAttackTime <= this.comboWindow) {
            this.comboCount++;
        } else {
            this.comboCount = 0;
        }
        
        return this.calculateDamage();
    }
    
    calculateDamage() {
        let damage = this.attackPower;
        
        // Apply combo bonus
        damage *= (1 + this.comboCount * 0.1);
        
        // Check for critical hit
        const isCritical = Math.random() < this.criticalChance;
        if (isCritical) {
            damage *= this.criticalMultiplier;
        }
        
        // Check for miss
        const isHit = Math.random() < this.accuracy;
        if (!isHit) {
            damage = 0;
        }
        
        return {
            damage: Math.floor(damage),
            isCritical,
            isHit,
            combo: this.comboCount
        };
    }
    
    takeDamage(incomingDamage, damageType = 'physical') {
        // Check evasion
        if (Math.random() < this.evasion) {
            return {
                damage: 0,
                evaded: true
            };
        }
        
        // Apply armor/resistance
        let reduction = 0;
        if (damageType === 'physical') {
            reduction = this.armor / (this.armor + 100); // Diminishing returns
        } else if (damageType === 'magical') {
            reduction = this.resistance / (this.resistance + 100);
        }
        
        const modifier = this.damageModifiers[damageType] || 1.0;
        const finalDamage = Math.floor(incomingDamage * (1 - reduction) * modifier);
        
        return {
            damage: finalDamage,
            evaded: false,
            reduced: incomingDamage - finalDamage
        };
    }
    
    addStatusEffect(type, duration, strength = 1.0) {
        const now = performance.now() / 1000;
        this.statusEffects.push({
            type,
            duration,
            strength,
            startTime: now
        });
    }
    
    removeExpiredStatusEffects(currentTime) {
        this.statusEffects = this.statusEffects.filter(effect => {
            const elapsed = currentTime - effect.startTime;
            return elapsed < effect.duration;
        });
    }
    
    hasStatusEffect(type) {
        return this.statusEffects.some(effect => effect.type === type);
    }
    
    getStatusEffectStrength(type) {
        const effect = this.statusEffects.find(e => e.type === type);
        return effect ? effect.strength : 0;
    }
    
    enterCombat(targetId) {
        this.isInCombat = true;
        this.combatTarget = targetId;
        this.comboCount = 0;
    }
    
    exitCombat() {
        this.isInCombat = false;
        this.combatTarget = null;
        this.comboCount = 0;
    }
    
    serialize() {
        return {
            attackPower: this.attackPower,
            attackSpeed: this.attackSpeed,
            attackRange: this.attackRange,
            accuracy: this.accuracy,
            criticalChance: this.criticalChance,
            criticalMultiplier: this.criticalMultiplier,
            armor: this.armor,
            evasion: this.evasion,
            resistance: this.resistance,
            isInCombat: this.isInCombat,
            combatTarget: this.combatTarget,
            damageModifiers: { ...this.damageModifiers },
            abilities: [...this.abilities],
            active: this.active
        };
    }
    
    deserialize(data) {
        this.attackPower = data.attackPower || 10;
        this.attackSpeed = data.attackSpeed || 1.0;
        this.attackRange = data.attackRange || 2.0;
        this.accuracy = data.accuracy || 0.95;
        this.criticalChance = data.criticalChance || 0.1;
        this.criticalMultiplier = data.criticalMultiplier || 2.0;
        this.armor = data.armor || 0;
        this.evasion = data.evasion || 0.05;
        this.resistance = data.resistance || 0;
        this.isInCombat = data.isInCombat || false;
        this.combatTarget = data.combatTarget || null;
        this.damageModifiers = data.damageModifiers || { physical: 1.0, magical: 1.0, elemental: 1.0 };
        this.abilities = data.abilities || [];
        this.active = data.active !== false;
    }
}