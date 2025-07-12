import { Component } from '../core/Component.js';

/**
 * Inventory Component - Item storage and management
 * Handles inventory slots, item stacking, weight limits, and currency
 */
export class InventoryComponent extends Component {
    constructor() {
        super();
        
        // Inventory configuration
        this.maxSlots = 20;
        this.slots = new Array(this.maxSlots).fill(null); // null or { item, quantity }
        this.maxWeight = 100.0;
        this.currentWeight = 0.0;
        
        // Currency
        this.currency = 0; // Gold/coins
        
        // Special storage
        this.keyItems = [];      // Quest items that don't take slots
        this.equipment = {       // Currently equipped items (references)
            weapon: null,
            armor: null,
            accessory: null
        };
        
        // Inventory state
        this.isLocked = false;   // Prevent modifications
        this.sortOrder = 'none'; // 'none', 'name', 'type', 'value', 'weight'
        
        this.active = true;
    }
    
    addItem(item, preferredSlot = null) {
        if (this.isLocked) return false;
        
        // Check if item is stackable and already exists
        if (item.stackable) {
            const existingSlot = this.slots.findIndex(slot => 
                slot && slot.item.id === item.id && slot.quantity < slot.item.maxStack
            );
            
            if (existingSlot !== -1) {
                const spaceInStack = this.slots[existingSlot].item.maxStack - this.slots[existingSlot].quantity;
                const quantityToAdd = Math.min(item.quantity || 1, spaceInStack);
                
                // Check weight
                if (this.currentWeight + (item.weight * quantityToAdd) > this.maxWeight) {
                    return false;
                }
                
                this.slots[existingSlot].quantity += quantityToAdd;
                this.currentWeight += item.weight * quantityToAdd;
                
                // If we couldn't add all items, try to add remainder
                if (quantityToAdd < (item.quantity || 1)) {
                    item.quantity -= quantityToAdd;
                    return this.addItem(item);
                }
                
                return true;
            }
        }
        
        // Find empty slot
        let targetSlot = preferredSlot;
        if (targetSlot === null || targetSlot < 0 || targetSlot >= this.maxSlots || this.slots[targetSlot] !== null) {
            targetSlot = this.slots.findIndex(slot => slot === null);
        }
        
        if (targetSlot === -1) return false; // No space
        
        // Check weight
        const itemWeight = item.weight * (item.quantity || 1);
        if (this.currentWeight + itemWeight > this.maxWeight) {
            return false;
        }
        
        // Add item
        this.slots[targetSlot] = {
            item: { ...item }, // Clone to prevent external modifications
            quantity: item.quantity || 1
        };
        this.currentWeight += itemWeight;
        
        return true;
    }
    
    removeItem(slot, quantity = null) {
        if (this.isLocked || slot < 0 || slot >= this.maxSlots || !this.slots[slot]) {
            return null;
        }
        
        const slotData = this.slots[slot];
        const removeQuantity = quantity || slotData.quantity;
        
        if (removeQuantity >= slotData.quantity) {
            // Remove entire stack
            this.slots[slot] = null;
            this.currentWeight -= slotData.item.weight * slotData.quantity;
            return {
                item: slotData.item,
                quantity: slotData.quantity
            };
        } else {
            // Remove partial stack
            slotData.quantity -= removeQuantity;
            this.currentWeight -= slotData.item.weight * removeQuantity;
            return {
                item: { ...slotData.item },
                quantity: removeQuantity
            };
        }
    }
    
    moveItem(fromSlot, toSlot) {
        if (this.isLocked || 
            fromSlot < 0 || fromSlot >= this.maxSlots ||
            toSlot < 0 || toSlot >= this.maxSlots ||
            !this.slots[fromSlot]) {
            return false;
        }
        
        // Swap items
        const temp = this.slots[toSlot];
        this.slots[toSlot] = this.slots[fromSlot];
        this.slots[fromSlot] = temp;
        
        return true;
    }
    
    getItemCount(itemId) {
        let count = 0;
        this.slots.forEach(slot => {
            if (slot && slot.item.id === itemId) {
                count += slot.quantity;
            }
        });
        return count;
    }
    
    hasItem(itemId, quantity = 1) {
        return this.getItemCount(itemId) >= quantity;
    }
    
    addCurrency(amount) {
        this.currency = Math.max(0, this.currency + amount);
        return this.currency;
    }
    
    removeCurrency(amount) {
        if (this.currency >= amount) {
            this.currency -= amount;
            return true;
        }
        return false;
    }
    
    getEmptySlotCount() {
        return this.slots.filter(slot => slot === null).length;
    }
    
    getUsedSlotCount() {
        return this.slots.filter(slot => slot !== null).length;
    }
    
    sortInventory(order = 'type') {
        if (this.isLocked) return;
        
        const items = this.slots.filter(slot => slot !== null);
        
        // Sort based on order
        switch (order) {
            case 'name':
                items.sort((a, b) => a.item.name.localeCompare(b.item.name));
                break;
            case 'type':
                items.sort((a, b) => a.item.type.localeCompare(b.item.type));
                break;
            case 'value':
                items.sort((a, b) => (b.item.value || 0) - (a.item.value || 0));
                break;
            case 'weight':
                items.sort((a, b) => (b.item.weight || 0) - (a.item.weight || 0));
                break;
        }
        
        // Clear and refill slots
        this.slots.fill(null);
        items.forEach((item, index) => {
            if (index < this.maxSlots) {
                this.slots[index] = item;
            }
        });
        
        this.sortOrder = order;
    }
    
    serialize() {
        return {
            maxSlots: this.maxSlots,
            slots: this.slots.map(slot => slot ? {
                item: { ...slot.item },
                quantity: slot.quantity
            } : null),
            currentWeight: this.currentWeight,
            currency: this.currency,
            keyItems: [...this.keyItems],
            sortOrder: this.sortOrder,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.maxSlots = data.maxSlots || 20;
        this.slots = new Array(this.maxSlots).fill(null);
        
        if (data.slots) {
            data.slots.forEach((slot, index) => {
                if (slot && index < this.maxSlots) {
                    this.slots[index] = {
                        item: { ...slot.item },
                        quantity: slot.quantity
                    };
                }
            });
        }
        
        this.currentWeight = data.currentWeight || 0;
        this.currency = data.currency || 0;
        this.keyItems = data.keyItems || [];
        this.sortOrder = data.sortOrder || 'none';
        this.active = data.active !== false;
    }
}