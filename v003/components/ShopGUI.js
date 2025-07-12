import GUIComponent from './GUIComponent.js';
import { UIConstants, UIFactory } from '../utils/UIUtils.js';

export default class ShopGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'shop';
        this.size = { width: 600, height: 500 };
        
        // Shop-specific settings
        this.shopName = 'General Store';
        this.shopkeeper = 'Merchant Bob';
        this.inventory = [];
        this.playerGold = 0;
        this.selectedItem = null;
        this.buybackList = [];
        this.priceMultiplier = 1.0; // For discounts/markups
    }
    
    createShopInterface() {
        // Main method called by GUISystem
        const container = document.createElement('div');
        container.className = 'shop-interface';
        container.style.cssText = `
            display: flex;
            height: 100%;
            gap: 20px;
        `;
        
        // Shop inventory side
        const shopSide = document.createElement('div');
        shopSide.style.cssText = 'flex: 1; padding: 10px;';
        shopSide.innerHTML = `
            <h3 style="color: #4CAF50; margin-bottom: 10px;">${this.shopName}</h3>
            <div style="color: #aaa; font-size: 12px; margin-bottom: 10px;">Shopkeeper: ${this.shopkeeper}</div>
        `;
        
        const shopGrid = this.createShopGrid();
        shopSide.appendChild(shopGrid);
        
        // Player inventory side
        const playerSide = document.createElement('div');
        playerSide.style.cssText = 'flex: 1; padding: 10px; border-left: 1px solid #444;';
        playerSide.innerHTML = `
            <h3 style="color: #2196F3; margin-bottom: 10px;">Your Inventory</h3>
            <div style="color: #FFC107; font-size: 14px; margin-bottom: 10px;">Gold: ${this.playerGold} 🪙</div>
        `;
        
        const playerGrid = this.createPlayerInventoryGrid();
        playerSide.appendChild(playerGrid);
        
        container.appendChild(shopSide);
        container.appendChild(playerSide);
        
        // Add transaction buttons
        const buttons = this.createTransactionButtons();
        container.appendChild(buttons);
        
        return container;
    }
    
    createShopGrid() {
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 80px);
            gap: 5px;
            max-height: 300px;
            overflow-y: auto;
        `;
        
        // Sample shop items
        const shopItems = [
            { name: 'Iron Sword', type: 'weapon', price: 100, stock: 3 },
            { name: 'Steel Shield', type: 'armor', price: 150, stock: 2 },
            { name: 'Health Potion', type: 'consumable', price: 50, stock: 10 },
            { name: 'Mana Potion', type: 'consumable', price: 75, stock: 8 },
            { name: 'Teleport Scroll', type: 'consumable', price: 200, stock: 1 }
        ];
        
        shopItems.forEach((item, index) => {
            const slot = this.createShopItemSlot(item, index);
            grid.appendChild(slot);
        });
        
        return grid;
    }
    
    createShopItemSlot(item, index) {
        const slot = document.createElement('div');
        slot.style.cssText = `
            width: 80px;
            height: 80px;
            border: 2px solid #666;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 5px;
            cursor: pointer;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 5px;
        `;
        
        const icon = document.createElement('div');
        icon.textContent = this.getItemIcon(item.type);
        icon.style.fontSize = '24px';
        slot.appendChild(icon);
        
        const name = document.createElement('div');
        name.textContent = item.name;
        name.style.cssText = 'font-size: 8px; color: #fff; text-align: center;';
        slot.appendChild(name);
        
        const price = document.createElement('div');
        price.textContent = `${item.price}🪙`;
        price.style.cssText = 'font-size: 10px; color: #FFC107; position: absolute; bottom: 2px;';
        slot.appendChild(price);
        
        if (item.stock > 0) {
            const stock = document.createElement('div');
            stock.textContent = item.stock;
            stock.style.cssText = `
                position: absolute;
                top: 2px;
                right: 2px;
                background: #4CAF50;
                color: white;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            slot.appendChild(stock);
        }
        
        slot.onclick = () => this.selectShopItem(item, index);
        
        return slot;
    }
    
    createPlayerInventoryGrid() {
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 80px);
            gap: 5px;
            max-height: 300px;
            overflow-y: auto;
        `;
        
        // This would be populated with actual player inventory
        grid.innerHTML = '<div style="color: #666; grid-column: 1/5; text-align: center; padding: 20px;">Select items to sell</div>';
        
        return grid;
    }
    
    createTransactionButtons() {
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
        `;
        
        const buyButton = document.createElement('button');
        buyButton.textContent = 'Buy';
        buyButton.style.cssText = `
            padding: 10px 30px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        `;
        buyButton.onclick = () => this.buyItem();
        
        const sellButton = document.createElement('button');
        sellButton.textContent = 'Sell';
        sellButton.style.cssText = `
            padding: 10px 30px;
            background: #F44336;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        `;
        sellButton.onclick = () => this.sellItem();
        
        container.appendChild(buyButton);
        container.appendChild(sellButton);
        
        return container;
    }
    
    getItemIcon(type) {
        return UIConstants.itemIcons[type] || '❓';
    }
    
    selectShopItem(item, index) {
        this.selectedItem = { item, index };
        console.log(`Selected shop item: ${item.name} for ${item.price} gold`);
    }
    
    buyItem() {
        if (!this.selectedItem) {
            console.log('No item selected to buy');
            return;
        }
        
        const { item } = this.selectedItem;
        if (this.playerGold >= item.price && item.stock > 0) {
            console.log(`Buying ${item.name} for ${item.price} gold`);
            // Implement actual purchase logic
        } else {
            console.log('Not enough gold or item out of stock');
        }
    }
    
    sellItem() {
        console.log('Selling item functionality');
        // Implement selling logic
    }
}