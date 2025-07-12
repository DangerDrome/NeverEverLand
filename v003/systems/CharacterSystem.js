import { System } from '../core/System.js';

export class CharacterSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['CharacterComponent'];
        this.priority = 45;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const character = entity.getComponent('CharacterComponent');
        
        if (!character.active) return;
        
        // Regenerate health and mana over time
        if (character.stats.currentHealth < character.stats.maxHealth) {
            character.stats.currentHealth += character.stats.healthRegen * deltaTime;
            character.stats.currentHealth = Math.min(character.stats.currentHealth, character.stats.maxHealth);
        }
        
        if (character.stats.currentMana < character.stats.maxMana) {
            character.stats.currentMana += character.stats.manaRegen * deltaTime;
            character.stats.currentMana = Math.min(character.stats.currentMana, character.stats.maxMana);
        }
        
        // Update buffs/debuffs
        character.statusEffects = character.statusEffects.filter(effect => {
            effect.duration -= deltaTime;
            return effect.duration > 0;
        });
        
        // Check for level up
        if (character.experience >= character.experienceToNextLevel) {
            this.levelUp(character);
        }
    }
    
    levelUp(character) {
        character.level++;
        character.experience -= character.experienceToNextLevel;
        character.experienceToNextLevel = Math.floor(character.experienceToNextLevel * 1.5);
        character.skillPoints += 3;
        
        // Increase base stats
        character.stats.maxHealth += 10;
        character.stats.maxMana += 5;
        character.stats.strength += 2;
        character.stats.intelligence += 2;
        character.stats.dexterity += 2;
        character.stats.constitution += 2;
        
        // Restore health and mana on level up
        character.stats.currentHealth = character.stats.maxHealth;
        character.stats.currentMana = character.stats.maxMana;
        
        console.log(`${character.name} leveled up to ${character.level}!`);
    }
    
    addExperience(entity, amount) {
        const character = entity.getComponent('CharacterComponent');
        if (!character) return;
        
        character.experience += amount;
    }
    
    takeDamage(entity, damage, damageType = 'physical') {
        const character = entity.getComponent('CharacterComponent');
        if (!character) return;
        
        // Calculate defense
        let finalDamage = damage;
        if (damageType === 'physical') {
            finalDamage -= character.stats.defense;
        } else if (damageType === 'magical') {
            finalDamage -= character.stats.magicResist;
        }
        
        finalDamage = Math.max(1, finalDamage);
        
        character.stats.currentHealth -= finalDamage;
        character.stats.currentHealth = Math.max(0, character.stats.currentHealth);
        
        if (character.stats.currentHealth === 0) {
            this.onCharacterDeath(entity);
        }
        
        return finalDamage;
    }
    
    heal(entity, amount) {
        const character = entity.getComponent('CharacterComponent');
        if (!character) return;
        
        character.stats.currentHealth += amount;
        character.stats.currentHealth = Math.min(character.stats.currentHealth, character.stats.maxHealth);
    }
    
    useMana(entity, amount) {
        const character = entity.getComponent('CharacterComponent');
        if (!character || character.stats.currentMana < amount) return false;
        
        character.stats.currentMana -= amount;
        return true;
    }
    
    addStatusEffect(entity, effect) {
        const character = entity.getComponent('CharacterComponent');
        if (!character) return;
        
        character.statusEffects.push({
            type: effect.type,
            value: effect.value,
            duration: effect.duration
        });
    }
    
    onCharacterDeath(entity) {
        console.log(`Character ${entity.getComponent('NameComponent')?.name || 'Unknown'} has died!`);
        // Handle death logic here
    }
}