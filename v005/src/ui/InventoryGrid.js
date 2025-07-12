
export class InventoryGrid {
  constructor(container, uiManager, rows = 5, cols = 8) {
    this.container = container;
    this.uiManager = uiManager;
    this.rows = rows;
    this.cols = cols;
    this.slots = [];
    this.items = new Map();
    this.init();
  }

  init() {
    this.gridElement = document.createElement('div');
    this.gridElement.className = 'grid';
    this.gridElement.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    
    for (let i = 0; i < this.rows * this.cols; i++) {
      const slot = this.createSlot(i);
      this.slots.push(slot);
      this.gridElement.appendChild(slot);
    }
    
    this.container.appendChild(this.gridElement);
    this.setupDragAndDrop();
  }

  createSlot(index) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    slot.dataset.slotIndex = index;
    slot.addEventListener('dragover', this.handleDragOver.bind(this));
    slot.addEventListener('drop', this.handleDrop.bind(this));
    slot.addEventListener('click', () => this.handleSlotClick(index));
    return slot;
  }

  addItem(item, slotIndex = null) {
    const targetSlot = slotIndex ?? this.findEmptySlot();
    if (targetSlot === -1) return false;
    
    const itemElement = document.createElement('div');
    itemElement.className = 'inventory-item';
    itemElement.draggable = true;
    itemElement.dataset.itemId = item.id;
    // Use Lucide icon if item has iconName, otherwise fall back to image
    if (item.iconName) {
      itemElement.innerHTML = `
        <i data-lucide="${item.iconName}" class="lucide"></i>
        ${item.quantity ? `<span class="item-quantity">${item.quantity}</span>` : ''}
      `;
    } else {
      itemElement.innerHTML = `
        <img src="${item.icon}" alt="${item.name}">
        ${item.quantity ? `<span class="item-quantity">${item.quantity}</span>` : ''}
      `;
    }
    
    itemElement.addEventListener('dragstart', this.handleDragStart.bind(this));
    this.slots[targetSlot].appendChild(itemElement);
    this.items.set(item.id, { ...item, slot: targetSlot });
    
    // Initialize Lucide icons if using icon names
    if (item.iconName && window.UI && window.UI.icons) {
      window.UI.icons();
    }
    
    return true;
  }

  handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', e.target.dataset.itemId);
    e.dataTransfer.setData('fromSlot', e.target.parentElement.dataset.slotIndex);
  }

  handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const itemId = e.dataTransfer.getData('itemId');
    const fromSlot = parseInt(e.dataTransfer.getData('fromSlot'));
    const toSlot = parseInt(e.currentTarget.dataset.slotIndex);
    
    this.moveItem(itemId, fromSlot, toSlot);
    return false;
  }

  handleSlotClick(index) {
    const item = this.items.get(this.slots[index].querySelector('.inventory-item')?.dataset.itemId);
    if (item) {
      this.uiManager.components.get('itemDetailModal').show(item);
    }
  }

  findEmptySlot() {
      for(let i=0; i<this.slots.length; i++) {
          if(this.slots[i].children.length === 0) {
              return i;
          }
      }
      return -1;
  }

  moveItem(itemId, fromSlot, toSlot) {
      const fromSlotElement = this.slots[fromSlot];
      const toSlotElement = this.slots[toSlot];
      const itemElement = fromSlotElement.firstChild;

      if(toSlotElement.firstChild) {
          // Swap items
          const toItemElement = toSlotElement.firstChild;
          fromSlotElement.appendChild(toItemElement);
          toSlotElement.appendChild(itemElement);
      } else {
          // Move to empty slot
          toSlotElement.appendChild(itemElement);
      }
  }

  setupDragAndDrop() {
    // No global drag/drop listeners needed for this simple example,
    // as listeners are added to individual slots.
    // This method is a placeholder for more complex global drag/drop logic if needed.
  }

  destroy() {
    if (this.gridElement && this.gridElement.parentNode) {
      this.gridElement.parentNode.removeChild(this.gridElement);
    }
  }
}
