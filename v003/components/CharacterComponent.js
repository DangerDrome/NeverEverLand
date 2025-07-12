import { Component } from '../core/Component.js';

/**
 * Character Component - RPG character stats and attributes
 * Manages character progression, health, abilities, and equipment
 */
export class CharacterComponent extends Component {
    constructor() {
        super();
        this.name = 'Unnamed Hero';
        this.level = 1;
        this.experience = 0;
        this.experienceToNext = 100;
        
        // Base stats
        this.baseStats = {
            strength: 10,
            agility: 10,
            intelligence: 10,
            vitality: 10,
            wisdom: 10,
            luck: 10
        };
        
        // Current stats (base + modifiers)
        this.stats = { ...this.baseStats };
        
        // Derived stats
        this.maxHealth = 100;
        this.currentHealth = 100;
        this.maxMana = 50;
        this.currentMana = 50;
        this.attackPower = 15;
        this.defense = 10;
        this.critChance = 0.05;
        this.critMultiplier = 2.0;
        
        // Character state
        this.isDead = false;
        this.statusEffects = [];
        
        // Equipment slots
        this.equipment = {
            weapon: null,
            armor: null,
            accessory: null
        };
        
        this.active = true;
    }
    
    levelUp() {
        this.level++;
        this.experience = 0;
        this.experienceToNext = Math.floor(this.experienceToNext * 1.5);
        
        // Increase base stats
        Object.keys(this.baseStats).forEach(stat => {
            this.baseStats[stat] += Math.floor(Math.random() * 3) + 1;
        });
        
        this.recalculateStats();
        
        // Full heal on level up
        this.currentHealth = this.maxHealth;
        this.currentMana = this.maxMana;
        
        return true;
    }
    
    addExperience(amount) {
        this.experience += amount;
        if (this.experience >= this.experienceToNext) {
            this.levelUp();
            return true;
        }
        return false;
    }
    
    recalculateStats() {
        // Copy base stats
        this.stats = { ...this.baseStats };
        
        // Apply equipment modifiers
        Object.values(this.equipment).forEach(item => {
            if (item && item.statModifiers) {
                Object.keys(item.statModifiers).forEach(stat => {
                    if (this.stats[stat] !== undefined) {
                        this.stats[stat] += item.statModifiers[stat];
                    }
                });
            }
        });
        
        // Recalculate derived stats
        this.maxHealth = 50 + (this.stats.vitality * 10) + (this.level * 20);
        this.maxMana = 20 + (this.stats.intelligence * 5) + (this.stats.wisdom * 3);
        this.attackPower = 5 + this.stats.strength + Math.floor(this.stats.agility / 2);
        this.defense = 5 + Math.floor(this.stats.vitality / 2) + Math.floor(this.stats.agility / 3);
        this.critChance = 0.01 + (this.stats.luck / 100) + (this.stats.agility / 200);
        
        // Ensure current values don't exceed max
        this.currentHealth = Math.min(this.currentHealth, this.maxHealth);
        this.currentMana = Math.min(this.currentMana, this.maxMana);
    }
    
    takeDamage(amount) {
        const actualDamage = Math.max(1, amount - this.defense);
        this.currentHealth = Math.max(0, this.currentHealth - actualDamage);
        
        if (this.currentHealth <= 0) {
            this.isDead = true;
        }
        
        return actualDamage;
    }
    
    heal(amount) {
        if (this.isDead) return 0;
        
        const previousHealth = this.currentHealth;
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
        return this.currentHealth - previousHealth;
    }
    
    useMana(amount) {
        if (this.currentMana >= amount) {
            this.currentMana -= amount;
            return true;
        }
        return false;
    }
    
    restoreMana(amount) {
        const previousMana = this.currentMana;
        this.currentMana = Math.min(this.maxMana, this.currentMana + amount);
        return this.currentMana - previousMana;
    }
    
    equip(item, slot) {
        if (this.equipment[slot] !== undefined) {
            this.equipment[slot] = item;
            this.recalculateStats();
            return true;
        }
        return false;
    }
    
    unequip(slot) {
        if (this.equipment[slot]) {
            const item = this.equipment[slot];
            this.equipment[slot] = null;
            this.recalculateStats();
            return item;
        }
        return null;
    }
    
    serialize() {
        return {
            name: this.name,
            level: this.level,
            experience: this.experience,
            experienceToNext: this.experienceToNext,
            baseStats: { ...this.baseStats },
            currentHealth: this.currentHealth,
            currentMana: this.currentMana,
            isDead: this.isDead,
            equipment: { ...this.equipment },
            active: this.active
        };
    }
    
    deserialize(data) {
        this.name = data.name || 'Unnamed Hero';
        this.level = data.level || 1;
        this.experience = data.experience || 0;
        this.experienceToNext = data.experienceToNext || 100;
        this.baseStats = data.baseStats || { ...this.baseStats };
        this.currentHealth = data.currentHealth || this.maxHealth;
        this.currentMana = data.currentMana || this.maxMana;
        this.isDead = data.isDead || false;
        this.equipment = data.equipment || { weapon: null, armor: null, accessory: null };
        this.active = data.active !== false;
        
        this.recalculateStats();
    }
}