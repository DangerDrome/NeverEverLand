
export class Hotbar {
  constructor(container, slots = 10) {
    this.container = container;
    this.slots = slots;
    this.items = new Array(slots).fill(null);
    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.element.className = 'grid';
    
    for (let i = 0; i < this.slots; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.dataset.slotIndex = i;
      this.element.appendChild(slot);
    }
    
    this.container.appendChild(this.element);
  }

  updateItem(slotIndex, item) {
    if (slotIndex < 0 || slotIndex >= this.slots) return;
    this.items[slotIndex] = item;
    
    const slotElement = this.element.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (slotElement) {
      slotElement.innerHTML = ''; // Clear existing content
      if (item) {
        const itemElement = document.createElement('div');
        itemElement.className = 'hotbar-item';
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
        slotElement.appendChild(itemElement);
        
        // Initialize Lucide icons if using icon names
        if (item.iconName && window.UI && window.UI.icons) {
          window.UI.icons();
        }
      }
    }
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
