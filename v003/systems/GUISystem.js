// GUI System for managing all GUI elements
export default class GUISystem {
    constructor() {
        this.world = null; // Will be set when added to world
        this.requiredComponents = ['GUIComponent'];
        this.priority = 22; // Run after all other systems
        
        // GUI management
        this.guiElements = new Map(); // entityId -> GUI element
        this.openWindows = new Set(); // Track open windows
        this.activeWindow = null; // Currently focused window
        this.hudEntity = null; // HUD entity reference
        
        // GUI container
        this.guiContainer = null;
        this.modalOverlay = null;
        
        // Keyboard shortcuts
        this.shortcuts = new Map([
            ['i', 'inventory'],
            ['c', 'character'],
            ['j', 'quest'],
            ['m', 'map'],
            ['Escape', 'closeAll']
        ]);
        
        // Window z-index management
        this.baseZIndex = 1000;
        this.currentZIndex = this.baseZIndex;
        
        console.log('✨ GUISystem initialized');
    }
    
    init() {
        // Create main GUI container
        this.guiContainer = document.createElement('div');
        this.guiContainer.id = 'gui-container';
        this.guiContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.guiContainer);
        
        // Create modal overlay
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.id = 'modal-overlay';
        this.modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            z-index: 999;
        `;
        document.body.appendChild(this.modalOverlay);
        
        // Setup keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Setup GUI event listeners
        document.addEventListener('inventorySwap', (e) => this.handleInventorySwap(e));
        document.addEventListener('inventoryItemClick', (e) => this.handleItemClick(e));
        document.addEventListener('dialogueChoice', (e) => this.handleDialogueChoice(e));
        
        console.log('GUI System initialized');
    }
    
    update(entities, deltaTime) {
        // Process GUI entities
        for (const entity of entities) {
            const guiComponent = entity.getComponent('GUIComponent');
            if (!guiComponent || !guiComponent.active) continue;
            
            // Create GUI element if not exists
            if (!this.guiElements.has(entity.id)) {
                this.createGUIElement(entity, guiComponent);
            }
            
            // Update GUI element
            this.updateGUIElement(entity, guiComponent);
        }
        
        // Remove GUI elements for destroyed entities
        for (const [entityId, element] of this.guiElements) {
            const entityExists = entities.some(e => e.id === entityId);
            if (!entityExists) {
                element.remove();
                this.guiElements.delete(entityId);
            }
        }
    }
    
    createGUIElement(entity, guiComponent) {
        let element = null;
        
        switch (guiComponent.guiType) {
            case 'hud':
                element = this.createHUD(entity, guiComponent);
                this.hudEntity = entity;
                break;
            case 'inventory':
                element = this.createInventoryWindow(entity, guiComponent);
                break;
            case 'character':
                element = this.createCharacterWindow(entity, guiComponent);
                break;
            case 'quest':
                element = this.createQuestWindow(entity, guiComponent);
                break;
            case 'dialogue':
                element = this.createDialogueWindow(entity, guiComponent);
                break;
            case 'shop':
                element = this.createShopWindow(entity, guiComponent);
                break;
            case 'menu':
                element = this.createMenuWindow(entity, guiComponent);
                break;
        }
        
        if (element) {
            guiComponent.element = element;
            this.guiElements.set(entity.id, element);
            this.guiContainer.appendChild(element);
            
            // Set initial visibility
            if (guiComponent.isOpen) {
                this.openWindow(entity, guiComponent);
            }
        }
    }
    
    createHUD(entity, guiComponent) {
        const hudElement = document.createElement('div');
        hudElement.id = 'hud';
        hudElement.className = 'gui-hud';
        hudElement.style.cssText = `
            position: fixed;
            width: 100%;
            height: 100%;
            pointer-events: none;
        `;
        
        // HUD is always visible
        guiComponent.isOpen = true;
        guiComponent.visible = true;
        
        // Initialize HUD content
        const hudInstance = entity.getComponent('HUD');
        if (hudInstance) {
            const container = hudInstance.createHUDContainer();
            hudElement.appendChild(container);
        }
        
        return hudElement;
    }
    
    createInventoryWindow(entity, guiComponent) {
        return this.createWindow(entity, guiComponent, 'Inventory', (content) => {
            const inventoryGUI = entity.getComponent('InventoryGUI');
            const inventoryComp = this.findInventoryComponent();
            
            if (inventoryGUI && inventoryComp) {
                const grid = inventoryGUI.createInventoryGrid(inventoryComp);
                content.appendChild(grid);
                
                // Add inventory info
                const info = document.createElement('div');
                info.style.cssText = 'padding: 10px; color: #aaa; font-size: 12px;';
                info.innerHTML = `
                    <div>Weight: ${inventoryComp.currentWeight}/${inventoryComp.maxWeight} kg</div>
                    <div>Gold: ${inventoryComp.gold} 🪙</div>
                `;
                content.appendChild(info);
            }
        });
    }
    
    createCharacterWindow(entity, guiComponent) {
        return this.createWindow(entity, guiComponent, 'Character', (content) => {
            const charGUI = entity.getComponent('CharacterSheetGUI');
            const charComp = this.findCharacterComponent();
            
            if (charGUI && charComp) {
                const display = charGUI.createCharacterDisplay(charComp);
                content.appendChild(display);
            }
        });
    }
    
    createQuestWindow(entity, guiComponent) {
        return this.createWindow(entity, guiComponent, 'Quest Journal', (content) => {
            const questGUI = entity.getComponent('QuestJournalGUI');
            const quests = this.findAllQuests();
            
            if (questGUI) {
                const journal = questGUI.createQuestJournal(quests);
                content.appendChild(journal);
            }
        });
    }
    
    createDialogueWindow(entity, guiComponent) {
        const window = this.createWindow(entity, guiComponent, 'Dialogue', (content) => {
            const dialogueGUI = entity.getComponent('DialogueGUI');
            
            if (dialogueGUI) {
                const container = dialogueGUI.createDialogueContainer();
                content.appendChild(container);
            }
        });
        
        // Dialogue windows are modal
        window.style.pointerEvents = 'auto';
        return window;
    }
    
    createShopWindow(entity, guiComponent) {
        return this.createWindow(entity, guiComponent, 'Shop', (content) => {
            const shopGUI = entity.getComponent('ShopGUI');
            
            if (shopGUI) {
                const shop = shopGUI.createShopInterface();
                content.appendChild(shop);
            }
        });
    }
    
    createMenuWindow(entity, guiComponent) {
        return this.createWindow(entity, guiComponent, 'Menu', (content) => {
            // Create main menu buttons
            const buttons = [
                { text: 'Resume', action: () => this.closeAllWindows() },
                { text: 'Settings', action: () => console.log('Settings') },
                { text: 'Save Game', action: () => this.saveGame() },
                { text: 'Load Game', action: () => this.loadGame() },
                { text: 'Exit to Main Menu', action: () => this.exitToMainMenu() }
            ];
            
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.text;
                button.style.cssText = `
                    display: block;
                    width: 200px;
                    margin: 10px auto;
                    padding: 10px;
                    background: #2196F3;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                `;
                button.onclick = btn.action;
                content.appendChild(button);
            });
        });
    }
    
    createWindow(entity, guiComponent, title, contentBuilder) {
        const window = document.createElement('div');
        window.className = `gui-window gui-${guiComponent.guiType}`;
        window.style.cssText = `
            position: absolute;
            left: ${guiComponent.position.x}px;
            top: ${guiComponent.position.y}px;
            width: ${guiComponent.size.width}px;
            height: ${guiComponent.size.height}px;
            background: rgba(20, 20, 20, ${guiComponent.opacity});
            border: 2px solid #444;
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
            display: none;
            pointer-events: auto;
            z-index: ${guiComponent.zIndex};
        `;
        
        // Window header
        const header = document.createElement('div');
        header.className = 'gui-window-header';
        header.style.cssText = `
            background: rgba(30, 30, 30, 0.9);
            padding: 10px;
            border-radius: 8px 8px 0 0;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const titleElement = document.createElement('span');
        titleElement.textContent = title;
        titleElement.style.cssText = 'color: #fff; font-weight: bold;';
        header.appendChild(titleElement);
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            background: none;
            border: none;
            color: #fff;
            font-size: 20px;
            cursor: pointer;
            padding: 0 5px;
        `;
        closeButton.onclick = () => this.closeWindow(entity, guiComponent);
        header.appendChild(closeButton);
        
        window.appendChild(header);
        
        // Window content
        const content = document.createElement('div');
        content.className = 'gui-window-content';
        content.style.cssText = `
            padding: 20px;
            height: calc(100% - 50px);
            overflow-y: auto;
            color: #fff;
        `;
        
        guiComponent.content = content;
        contentBuilder(content);
        window.appendChild(content);
        
        // Make window draggable
        if (guiComponent.isDraggable) {
            this.makeWindowDraggable(window, header, guiComponent);
        }
        
        // Window focus handling
        window.addEventListener('mousedown', () => {
            this.focusWindow(entity, guiComponent);
        });
        
        return window;
    }
    
    makeWindowDraggable(window, header, guiComponent) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragOffset.x = e.clientX - guiComponent.position.x;
            dragOffset.y = e.clientY - guiComponent.position.y;
            header.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            guiComponent.setPosition(
                e.clientX - dragOffset.x,
                e.clientY - dragOffset.y
            );
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });
    }
    
    updateGUIElement(entity, guiComponent) {
        const element = this.guiElements.get(entity.id);
        if (!element) return;
        
        // Update visibility
        element.style.display = guiComponent.isOpen ? 'block' : 'none';
        
        // Update HUD if it's a HUD component
        if (guiComponent.guiType === 'hud' && guiComponent.isOpen) {
            this.updateHUD(entity, guiComponent);
        }
    }
    
    updateHUD(entity, guiComponent) {
        const hudInstance = entity.getComponent('HUD');
        if (!hudInstance) return;
        
        // Update health bars
        const players = this.world.query(['CharacterComponent', 'PartyComponent']);
        hudInstance.updateHealthBars(players);
        
        // Update quest tracker
        const activeQuests = this.findActiveQuests();
        hudInstance.updateQuestTracker(activeQuests);
        
        // Update resources
        const resourceEntity = this.world.query(['ResourceComponent'])[0];
        if (resourceEntity) {
            const resources = resourceEntity.getComponent('ResourceComponent');
            hudInstance.updateResources({
                wood: resources.wood,
                stone: resources.stone,
                food: resources.food,
                gold: resources.gold
            });
        }
    }
    
    openWindow(entity, guiComponent) {
        guiComponent.open();
        this.openWindows.add(entity.id);
        this.focusWindow(entity, guiComponent);
        
        // Show modal overlay for dialogue
        if (guiComponent.guiType === 'dialogue') {
            this.modalOverlay.style.display = 'block';
        }
    }
    
    closeWindow(entity, guiComponent) {
        guiComponent.close();
        this.openWindows.delete(entity.id);
        
        // Hide modal overlay if no dialogues open
        if (guiComponent.guiType === 'dialogue') {
            const hasOpenDialogue = Array.from(this.openWindows).some(id => {
                const e = this.world.entities.find(entity => entity.id === id);
                return e && e.getComponent('GUIComponent').guiType === 'dialogue';
            });
            
            if (!hasOpenDialogue) {
                this.modalOverlay.style.display = 'none';
            }
        }
        
        // Focus next window
        if (this.activeWindow === entity.id && this.openWindows.size > 0) {
            const nextId = Array.from(this.openWindows)[0];
            const nextEntity = this.world.entities.find(e => e.id === nextId);
            if (nextEntity) {
                this.focusWindow(nextEntity, nextEntity.getComponent('GUIComponent'));
            }
        }
    }
    
    focusWindow(entity, guiComponent) {
        this.activeWindow = entity.id;
        guiComponent.zIndex = ++this.currentZIndex;
        
        if (guiComponent.element) {
            guiComponent.element.style.zIndex = guiComponent.zIndex;
        }
    }
    
    closeAllWindows() {
        for (const entityId of this.openWindows) {
            const entity = this.world.entities.find(e => e.id === entityId);
            if (entity) {
                const gui = entity.getComponent('GUIComponent');
                if (gui && gui.guiType !== 'hud') {
                    this.closeWindow(entity, gui);
                }
            }
        }
    }
    
    handleKeyPress(e) {
        // Don't handle if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const action = this.shortcuts.get(e.key);
        if (!action) return;
        
        e.preventDefault();
        
        if (action === 'closeAll') {
            this.closeAllWindows();
            return;
        }
        
        // Toggle window
        const guiEntity = this.findGUIEntity(action);
        if (guiEntity) {
            const guiComponent = guiEntity.getComponent('GUIComponent');
            if (guiComponent.isOpen) {
                this.closeWindow(guiEntity, guiComponent);
            } else {
                this.openWindow(guiEntity, guiComponent);
            }
        }
    }
    
    findGUIEntity(guiType) {
        const entities = this.world.query(['GUIComponent']);
        return entities.find(e => e.getComponent('GUIComponent').guiType === guiType);
    }
    
    findInventoryComponent() {
        const playerEntity = this.world.query(['InventoryComponent', 'CharacterComponent'])[0];
        return playerEntity ? playerEntity.getComponent('InventoryComponent') : null;
    }
    
    findCharacterComponent() {
        const playerEntity = this.world.query(['CharacterComponent', 'PartyComponent'])[0];
        return playerEntity ? playerEntity.getComponent('CharacterComponent') : null;
    }
    
    findAllQuests() {
        const questEntities = this.world.query(['QuestComponent']);
        return questEntities.map(e => e.getComponent('QuestComponent'));
    }
    
    findActiveQuests() {
        return this.findAllQuests().filter(q => q.status === 'active');
    }
    
    handleInventorySwap(e) {
        const { fromSlot, toSlot } = e.detail;
        const inventory = this.findInventoryComponent();
        
        if (inventory) {
            // Swap items in the actual inventory component
            const temp = inventory.slots[fromSlot];
            inventory.slots[fromSlot] = inventory.slots[toSlot];
            inventory.slots[toSlot] = temp;
            
            // Refresh inventory display
            const invEntity = this.findGUIEntity('inventory');
            if (invEntity && invEntity.getComponent('GUIComponent').isOpen) {
                this.refreshInventoryDisplay(invEntity);
            }
        }
    }
    
    handleItemClick(e) {
        const { slot, item } = e.detail;
        console.log(`Item clicked: ${item.name} in slot ${slot}`);
        // Could show item tooltip or context menu here
    }
    
    handleDialogueChoice(e) {
        const { choiceIndex } = e.detail;
        const dialogueEntity = this.findGUIEntity('dialogue');
        
        if (dialogueEntity) {
            const dialogueGUI = dialogueEntity.getComponent('DialogueGUI');
            const dialogueComp = this.findActiveDialogue();
            
            if (dialogueGUI && dialogueComp) {
                dialogueComp.selectChoice(choiceIndex);
                dialogueGUI.updateDialogue(dialogueComp);
            }
        }
    }
    
    findActiveDialogue() {
        const dialogueEntities = this.world.query(['DialogueComponent']);
        return dialogueEntities.find(e => {
            const d = e.getComponent('DialogueComponent');
            return d.isActive;
        })?.getComponent('DialogueComponent');
    }
    
    refreshInventoryDisplay(entity) {
        const guiComponent = entity.getComponent('GUIComponent');
        const inventoryGUI = entity.getComponent('InventoryGUI');
        const inventory = this.findInventoryComponent();
        
        if (guiComponent.content && inventoryGUI && inventory) {
            guiComponent.content.innerHTML = '';
            const grid = inventoryGUI.createInventoryGrid(inventory);
            guiComponent.content.appendChild(grid);
            
            // Re-add inventory info
            const info = document.createElement('div');
            info.style.cssText = 'padding: 10px; color: #aaa; font-size: 12px;';
            info.innerHTML = `
                <div>Weight: ${inventory.currentWeight}/${inventory.maxWeight} kg</div>
                <div>Gold: ${inventory.gold} 🪙</div>
            `;
            guiComponent.content.appendChild(info);
        }
    }
    
    saveGame() {
        console.log('Saving game...');
        // Implement save functionality
    }
    
    loadGame() {
        console.log('Loading game...');
        // Implement load functionality
    }
    
    exitToMainMenu() {
        if (confirm('Are you sure you want to exit to the main menu?')) {
            console.log('Exiting to main menu...');
            // Implement exit functionality
        }
    }
}