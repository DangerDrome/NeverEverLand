import GUIComponent from './GUIComponent.js';
import { UIConstants, UIFactory } from '../utils/UIUtils.js';

export default class InventoryGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'inventory';
        this.size = { width: 480, height: 400 };
        
        // Inventory-specific settings
        this.slotsPerRow = 5;
        this.slotSize = 64;
        this.selectedSlot = null;
        this.draggedItem = null;
        
        // Filter and sorting
        this.filter = 'all'; // all, weapons, armor, consumables, quest
        this.sortBy = 'name'; // name, value, weight, quantity
        
        // Display settings
        this.showTooltips = true;
        this.showQuantity = true;
        this.showDurability = true;
    }
    
    createInventoryGrid(inventory) {
        const grid = UIFactory.createStyledElement('div', `
            display: grid;
            grid-template-columns: repeat(${this.slotsPerRow}, ${this.slotSize}px);
            gap: 4px;
            padding: 10px;
        `, 'inventory-grid');
        
        // Create slots
        for (let i = 0; i < inventory.slots.length; i++) {
            const handlers = {
                'dragstart': (e) => this.onDragStart(e, i, inventory.slots[i]),
                'dragover': (e) => this.onDragOver(e),
                'drop': (e) => this.onDrop(e, i),
                'click': (e) => this.onSlotClick(e, i, inventory.slots[i])
            };
            const slot = UIFactory.createItemSlot(i, inventory.slots[i], this.slotSize, handlers);
            grid.appendChild(slot);
        }
        
        return grid;
    }
    
    onDragStart(e, slotIndex, item) {
        if (!item) return;
        this.draggedItem = { item, fromSlot: slotIndex };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedItem));
    }
    
    onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    
    onDrop(e, toSlot) {
        e.preventDefault();
        if (!this.draggedItem) return;
        
        // Emit inventory swap event
        const event = new CustomEvent('inventorySwap', {
            detail: {
                fromSlot: this.draggedItem.fromSlot,
                toSlot: toSlot
            }
        });
        document.dispatchEvent(event);
        
        this.draggedItem = null;
    }
    
    onSlotClick(e, slotIndex, item) {
        if (!item) return;
        
        // Show item tooltip or context menu
        const event = new CustomEvent('inventoryItemClick', {
            detail: { slot: slotIndex, item: item }
        });
        document.dispatchEvent(event);
    }
}