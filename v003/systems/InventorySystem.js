import { System } from '../core/System.js';

export class InventorySystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['InventoryComponent'];
        this.priority = 55;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const inventory = entity.getComponent('InventoryComponent');
        
        if (!inventory.active) return;
        
        // Update weight
        this.updateWeight(inventory);
        
        // Check for overweight status
        if (inventory.currentWeight > inventory.maxWeight) {
            // Apply movement penalty
            const controller = entity.getComponent('PlayerControllerComponent');
            if (controller) {
                controller.moveSpeed = controller.moveSpeed * 0.5;
            }
        }
    }
    
    updateWeight(inventory) {
        let totalWeight = 0;
        inventory.items.forEach(item => {
            if (item) {
                totalWeight += item.weight * item.quantity;
            }
        });
        inventory.currentWeight = totalWeight;
    }
    
    addItem(entity, item) {
        const inventory = entity.getComponent('InventoryComponent');
        if (!inventory) return false;
        
        // Check if item is stackable and already exists
        if (item.stackable) {
            const existingIndex = inventory.items.findIndex(i => 
                i && i.id === item.id
            );
            
            if (existingIndex !== -1) {
                inventory.items[existingIndex].quantity += item.quantity;
                this.updateWeight(inventory);
                return true;
            }
        }
        
        // Find empty slot
        const emptyIndex = inventory.items.findIndex(i => i === null);
        if (emptyIndex === -1) {
            console.log('Inventory full!');
            return false;
        }
        
        // Check weight limit
        const newWeight = inventory.currentWeight + (item.weight * item.quantity);
        if (newWeight > inventory.maxWeight) {
            console.log('Too heavy!');
            return false;
        }
        
        // Add item
        inventory.items[emptyIndex] = {
            ...item,
            slot: emptyIndex
        };
        
        this.updateWeight(inventory);
        return true;
    }
    
    removeItem(entity, slot, quantity = 1) {
        const inventory = entity.getComponent('InventoryComponent');
        if (!inventory || !inventory.items[slot]) return null;
        
        const item = inventory.items[slot];
        
        if (item.quantity > quantity) {
            item.quantity -= quantity;
            this.updateWeight(inventory);
            return { ...item, quantity };
        } else {
            inventory.items[slot] = null;
            this.updateWeight(inventory);
            return item;
        }
    }
    
    moveItem(entity, fromSlot, toSlot) {
        const inventory = entity.getComponent('InventoryComponent');
        if (!inventory) return false;
        
        const fromItem = inventory.items[fromSlot];
        const toItem = inventory.items[toSlot];
        
        // Swap items
        inventory.items[fromSlot] = toItem;
        inventory.items[toSlot] = fromItem;
        
        // Update slot references
        if (fromItem) fromItem.slot = toSlot;
        if (toItem) toItem.slot = fromSlot;
        
        return true;
    }
    
    useItem(entity, slot) {
        const inventory = entity.getComponent('InventoryComponent');
        if (!inventory || !inventory.items[slot]) return false;
        
        const item = inventory.items[slot];
        
        // Handle different item types
        switch (item.type) {
            case 'consumable':
                this.useConsumable(entity, item);
                this.removeItem(entity, slot, 1);
                break;
            case 'equipment':
                this.equipItem(entity, slot);
                break;
            default:
                console.log(`Cannot use ${item.name}`);
                return false;
        }
        
        return true;
    }
    
    useConsumable(entity, item) {
        const character = entity.getComponent('CharacterComponent');
        if (!character) return;
        
        // Apply item effects
        if (item.effects) {
            if (item.effects.heal) {
                character.stats.currentHealth += item.effects.heal;
                character.stats.currentHealth = Math.min(
                    character.stats.currentHealth, 
                    character.stats.maxHealth
                );
            }
            
            if (item.effects.mana) {
                character.stats.currentMana += item.effects.mana;
                character.stats.currentMana = Math.min(
                    character.stats.currentMana, 
                    character.stats.maxMana
                );
            }
            
            if (item.effects.buff) {
                // Add status effect
                const characterSystem = this.world.systems.find(s => s.constructor.name === 'CharacterSystem');
                if (characterSystem) {
                    characterSystem.addStatusEffect(entity, item.effects.buff);
                }
            }
        }
        
        console.log(`Used ${item.name}`);
    }
    
    equipItem(entity, slot) {
        const inventory = entity.getComponent('InventoryComponent');
        const item = inventory.items[slot];
        
        if (!item || item.type !== 'equipment') return false;
        
        // Check if equipment slot is available
        const equipSlot = inventory.equipment[item.equipSlot];
        
        if (equipSlot) {
            // Swap with currently equipped item
            inventory.items[slot] = equipSlot;
            inventory.equipment[item.equipSlot] = item;
        } else {
            // Equip item
            inventory.equipment[item.equipSlot] = item;
            inventory.items[slot] = null;
        }
        
        // Apply equipment stats
        this.updateEquipmentStats(entity);
        
        return true;
    }
    
    unequipItem(entity, equipSlot) {
        const inventory = entity.getComponent('InventoryComponent');
        const item = inventory.equipment[equipSlot];
        
        if (!item) return false;
        
        // Find empty inventory slot
        const emptySlot = inventory.items.findIndex(i => i === null);
        if (emptySlot === -1) {
            console.log('Inventory full!');
            return false;
        }
        
        // Move to inventory
        inventory.items[emptySlot] = item;
        inventory.equipment[equipSlot] = null;
        
        // Update equipment stats
        this.updateEquipmentStats(entity);
        
        return true;
    }
    
    updateEquipmentStats(entity) {
        const inventory = entity.getComponent('InventoryComponent');
        const character = entity.getComponent('CharacterComponent');
        
        if (!character) return;
        
        // Reset to base stats (would need to store base stats separately)
        // Then add equipment bonuses
        Object.values(inventory.equipment).forEach(item => {
            if (item && item.stats) {
                Object.entries(item.stats).forEach(([stat, value]) => {
                    if (character.stats[stat] !== undefined) {
                        character.stats[stat] += value;
                    }
                });
            }
        });
    }
    
    dropItem(entity, slot) {
        const inventory = entity.getComponent('InventoryComponent');
        const transform = entity.getComponent('TransformComponent');
        
        if (!inventory || !transform || !inventory.items[slot]) return false;
        
        const item = this.removeItem(entity, slot);
        if (!item) return false;
        
        // Create dropped item entity
        const droppedItem = this.world.createEntity();
        droppedItem.addComponent(new NameComponent(item.name));
        droppedItem.addComponent(new TransformComponent(
            transform.position.x + Math.random() * 2 - 1,
            0.5,
            transform.position.z + Math.random() * 2 - 1
        ));
        droppedItem.addComponent(new TagComponent(['item', 'interactable']));
        
        // Store item data
        droppedItem.itemData = item;
        
        console.log(`Dropped ${item.name}`);
        return true;
    }
}