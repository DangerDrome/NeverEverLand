import { System } from '../core/System.js';

export class CombatSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['CombatComponent'];
        this.priority = 50;
        this.activeAttacks = new Map();
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
        
        // Process active attacks
        this.processActiveAttacks(deltaTime);
    }
    
    processEntity(entity, deltaTime) {
        const combat = entity.getComponent('CombatComponent');
        
        if (!combat.active || !combat.inCombat) return;
        
        // Update ability cooldowns
        combat.abilities.forEach(ability => {
            if (ability.currentCooldown > 0) {
                ability.currentCooldown -= deltaTime;
            }
        });
        
        // Update combo timer
        if (combat.comboCount > 0) {
            combat.comboTimer -= deltaTime;
            if (combat.comboTimer <= 0) {
                combat.comboCount = 0;
            }
        }
        
        // Update dodge cooldown
        if (combat.dodgeCooldown > 0) {
            combat.dodgeCooldown -= deltaTime;
        }
    }
    
    performAttack(attackerEntity, targetEntity, abilityName = 'basic') {
        const attackerCombat = attackerEntity.getComponent('CombatComponent');
        const attackerCharacter = attackerEntity.getComponent('CharacterComponent');
        
        if (!attackerCombat || !attackerCharacter) return false;
        
        const ability = attackerCombat.abilities.find(a => a.name === abilityName);
        if (!ability || ability.currentCooldown > 0) return false;
        
        // Check mana cost
        if (ability.manaCost > 0) {
            if (!attackerCharacter.stats.currentMana >= ability.manaCost) return false;
            attackerCharacter.stats.currentMana -= ability.manaCost;
        }
        
        // Create attack
        const attack = {
            attacker: attackerEntity.id,
            target: targetEntity.id,
            ability: ability,
            damage: this.calculateDamage(attackerEntity, targetEntity, ability),
            timestamp: Date.now()
        };
        
        // Set ability on cooldown
        ability.currentCooldown = ability.cooldown;
        
        // Add to active attacks for animation/effects
        this.activeAttacks.set(attack.timestamp, attack);
        
        // Apply damage immediately for now
        this.applyDamage(targetEntity, attack.damage, ability.damageType);
        
        // Update combo
        attackerCombat.comboCount++;
        attackerCombat.comboTimer = attackerCombat.comboWindow;
        
        return true;
    }
    
    calculateDamage(attackerEntity, targetEntity, ability) {
        const attackerCharacter = attackerEntity.getComponent('CharacterComponent');
        const attackerCombat = attackerEntity.getComponent('CombatComponent');
        const targetCharacter = targetEntity.getComponent('CharacterComponent');
        const targetCombat = targetEntity.getComponent('CombatComponent');
        
        if (!attackerCharacter || !targetCharacter) return 0;
        
        // Base damage calculation
        let damage = ability.baseDamage;
        
        // Add stat scaling
        if (ability.damageType === 'physical') {
            damage += attackerCharacter.stats.strength * ability.scaling;
        } else if (ability.damageType === 'magical') {
            damage += attackerCharacter.stats.intelligence * ability.scaling;
        }
        
        // Apply combo multiplier
        if (attackerCombat.comboCount > 0) {
            damage *= 1 + (attackerCombat.comboCount * 0.1);
        }
        
        // Critical hit chance
        const critChance = attackerCharacter.stats.dexterity / 200;
        if (Math.random() < critChance) {
            damage *= attackerCombat.criticalMultiplier;
            console.log('Critical hit!');
        }
        
        // Apply target's defense
        if (ability.damageType === 'physical') {
            damage -= targetCharacter.stats.defense;
        } else if (ability.damageType === 'magical') {
            damage -= targetCharacter.stats.magicResist;
        }
        
        // Check if target is blocking
        if (targetCombat && targetCombat.isBlocking) {
            damage *= (1 - targetCombat.blockReduction);
        }
        
        return Math.max(1, Math.floor(damage));
    }
    
    applyDamage(targetEntity, damage, damageType) {
        const targetCharacter = targetEntity.getComponent('CharacterComponent');
        const targetCombat = targetEntity.getComponent('CombatComponent');
        
        if (!targetCharacter) return;
        
        // Check dodge
        if (targetCombat && targetCombat.isDodging) {
            console.log('Attack dodged!');
            return;
        }
        
        // Apply damage
        targetCharacter.stats.currentHealth -= damage;
        targetCharacter.stats.currentHealth = Math.max(0, targetCharacter.stats.currentHealth);
        
        // Enter combat
        if (targetCombat) {
            targetCombat.inCombat = true;
        }
        
        console.log(`${targetEntity.getComponent('NameComponent')?.name || 'Entity'} takes ${damage} ${damageType} damage!`);
        
        // Check for death
        if (targetCharacter.stats.currentHealth === 0) {
            this.onCombatDeath(targetEntity);
        }
    }
    
    performDodge(entity) {
        const combat = entity.getComponent('CombatComponent');
        const character = entity.getComponent('CharacterComponent');
        
        if (!combat || combat.dodgeCooldown > 0) return false;
        
        // Use stamina for dodge
        const staminaCost = 20;
        if (character && character.stats.currentStamina < staminaCost) return false;
        
        if (character) {
            character.stats.currentStamina -= staminaCost;
        }
        
        combat.isDodging = true;
        combat.dodgeCooldown = 1.0; // 1 second cooldown
        
        // End dodge after brief invulnerability
        setTimeout(() => {
            combat.isDodging = false;
        }, 300); // 300ms dodge window
        
        return true;
    }
    
    performBlock(entity, isBlocking) {
        const combat = entity.getComponent('CombatComponent');
        if (!combat) return false;
        
        combat.isBlocking = isBlocking;
        return true;
    }
    
    processActiveAttacks(deltaTime) {
        // Clean up old attacks
        const now = Date.now();
        for (const [timestamp, attack] of this.activeAttacks) {
            if (now - timestamp > 1000) { // Remove after 1 second
                this.activeAttacks.delete(timestamp);
            }
        }
    }
    
    onCombatDeath(entity) {
        const combat = entity.getComponent('CombatComponent');
        if (combat) {
            combat.inCombat = false;
        }
        
        // Award experience to attackers
        const character = entity.getComponent('CharacterComponent');
        if (character) {
            const expReward = character.level * 50;
            // Would distribute to attackers here
        }
    }
}