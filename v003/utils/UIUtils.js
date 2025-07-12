export const UIConstants = {
    itemIcons: {
        weapon: '⚔️',
        armor: '🛡️',
        consumable: '🧪',
        material: '📦',
        quest: '📜',
        gold: '🪙'
    },
    itemColors: {
        weapon: 'rgba(239, 83, 80, 0.7)',
        armor: 'rgba(66, 165, 245, 0.7)',
        consumable: 'rgba(102, 187, 106, 0.7)',
        material: 'rgba(255, 167, 38, 0.7)',
        quest: 'rgba(171, 71, 188, 0.7)',
        gold: 'rgba(255, 235, 59, 0.7)'
    },
    questColors: {
        available: '#FFEB3B',
        active: '#2196F3',
        completed: '#4CAF50',
        failed: '#F44336',
        abandoned: '#9E9E9E'
    },
    resourceIcons: {
        wood: '🪵',
        stone: '🪨',
        food: '🍞',
        gold: '🪙'
    }
};

export const UIFactory = {
    createStyledElement(tag, styles, className = '') {
        const element = document.createElement(tag);
        element.style.cssText = styles;
        if (className) element.className = className;
        return element;
    },
    
    addHoverEffect(element, hoverStyle, normalStyle) {
        element.addEventListener('mouseenter', () => {
            element.style.background = hoverStyle;
        });
        element.addEventListener('mouseleave', () => {
            element.style.background = normalStyle;
        });
    },
    
    createProgressBar(name, current, max, color, icon = '') {
        const bar = UIFactory.createStyledElement('div', `
            margin-bottom: 8px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 20px;
            padding: 4px;
            min-width: 250px;
        `);
        
        bar.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                ${icon ? `<span style="font-size: 16px;">${icon}</span>` : ''}
                <div style="flex: 1;">
                    <div style="background: #333; border-radius: 10px; overflow: hidden; height: 20px; position: relative;">
                        <div style="background: ${color}; width: ${(current / max) * 100}%; height: 100%; transition: width 0.3s;"></div>
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
                            ${current} / ${max}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return bar;
    },
    
    createItemSlot(index, item, slotSize = 64, handlers = {}) {
        const slot = UIFactory.createStyledElement('div', `
            width: ${slotSize}px;
            height: ${slotSize}px;
            border: 2px solid #444;
            background: rgba(0, 0, 0, 0.5);
            position: relative;
            cursor: pointer;
            border-radius: 4px;
        `, 'inventory-slot');
        
        slot.dataset.slotIndex = index;
        
        if (item) {
            const itemElement = UIFactory.createItemElement(item, slotSize);
            slot.appendChild(itemElement);
        }
        
        // Apply handlers
        Object.entries(handlers).forEach(([event, handler]) => {
            slot.addEventListener(event, handler);
        });
        
        return slot;
    },
    
    createItemElement(item, size = 64) {
        const itemDiv = UIFactory.createStyledElement('div', `
            width: 100%;
            height: 100%;
            background: ${UIConstants.itemColors[item.type] || 'rgba(158, 158, 158, 0.7)'};
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `, 'inventory-item');
        
        itemDiv.draggable = true;
        
        // Item icon
        const icon = UIFactory.createStyledElement('div', 'font-size: 24px;');
        icon.textContent = UIConstants.itemIcons[item.type] || '❓';
        itemDiv.appendChild(icon);
        
        // Quantity badge
        if (item.quantity > 1) {
            const quantity = UIFactory.createStyledElement('div', `
                position: absolute;
                bottom: 2px;
                right: 2px;
                background: #4CAF50;
                color: white;
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
            `, 'item-quantity');
            quantity.textContent = item.quantity;
            itemDiv.appendChild(quantity);
        }
        
        return itemDiv;
    }
};