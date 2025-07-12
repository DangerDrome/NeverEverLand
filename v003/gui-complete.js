// Complete GUI System Implementation

// UI Constants
const UIConstants = {
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
    }
};

// UI Factory
const UIFactory = {
    createStyledElement(tag, styles, className = '') {
        const element = document.createElement(tag);
        element.style.cssText = styles;
        if (className) element.className = className;
        return element;
    },
    
    createWindow(title, width = 400, height = 300) {
        const window = UIFactory.createStyledElement('div', `
            position: absolute;
            width: ${width}px;
            height: ${height}px;
            background: rgba(20, 20, 20, 0.95);
            border: 2px solid #333;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
            display: none;
            flex-direction: column;
            pointer-events: all;
        `);
        
        // Header
        const header = UIFactory.createStyledElement('div', `
            background: rgba(40, 40, 40, 0.95);
            padding: 10px;
            border-bottom: 1px solid #444;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 6px 6px 0 0;
        `);
        
        const titleElement = UIFactory.createStyledElement('h3', `
            margin: 0;
            font-size: 16px;
            color: #fff;
        `);
        titleElement.textContent = title;
        
        const closeBtn = UIFactory.createStyledElement('button', `
            background: #ff4444;
            border: none;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `);
        closeBtn.textContent = '✕';
        
        header.appendChild(titleElement);
        header.appendChild(closeBtn);
        
        // Content
        const content = UIFactory.createStyledElement('div', `
            flex: 1;
            padding: 10px;
            overflow-y: auto;
            color: #ccc;
        `);
        
        window.appendChild(header);
        window.appendChild(content);
        
        return { window, header, content, closeBtn };
    },
    
    createItemSlot(index, item, size = 50) {
        const slot = UIFactory.createStyledElement('div', `
            width: ${size}px;
            height: ${size}px;
            border: 2px solid #444;
            background: rgba(0, 0, 0, 0.5);
            position: relative;
            cursor: pointer;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        `, 'inventory-slot');
        
        slot.dataset.slotIndex = index;
        
        if (item) {
            slot.style.background = UIConstants.itemColors[item.type] || 'rgba(158, 158, 158, 0.7)';
            slot.textContent = UIConstants.itemIcons[item.type] || '❓';
            slot.title = `${item.name} (${item.quantity || 1})`;
        }
        
        return slot;
    }
};

// Base GUI Component
class GUIComponent extends Component {
    constructor() {
        super();
        this.guiType = 'window';
        this.visible = true;
        this.position = { x: 100, y: 100 };
        this.size = { width: 400, height: 300 };
        this.zIndex = 1000;
        this.isOpen = false;
        this.isDraggable = true;
        this.element = null;
        this.content = null;
        this.data = {};
        this.active = true;
    }
    
    open() {
        this.isOpen = true;
        if (this.element) {
            this.element.style.display = 'flex';
        }
    }
    
    close() {
        this.isOpen = false;
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    setPosition(x, y) {
        this.position.x = x;
        this.position.y = y;
        if (this.element) {
            this.element.style.left = x + 'px';
            this.element.style.top = y + 'px';
        }
    }
}

// Inventory GUI
class InventoryGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'inventory';
        this.size = { width: 350, height: 400 };
    }
    
    createUI() {
        const { window, header, content, closeBtn } = UIFactory.createWindow('Inventory', this.size.width, this.size.height);
        this.element = window;
        this.content = content;
        
        closeBtn.onclick = () => this.close();
        
        // Create inventory grid
        const grid = UIFactory.createStyledElement('div', `
            display: grid;
            grid-template-columns: repeat(5, 50px);
            gap: 5px;
            margin-bottom: 20px;
        `);
        
        // Create slots
        for (let i = 0; i < 20; i++) {
            const slot = UIFactory.createItemSlot(i, null);
            grid.appendChild(slot);
        }
        
        content.appendChild(grid);
        
        // Info section
        const info = UIFactory.createStyledElement('div', `
            border-top: 1px solid #444;
            padding-top: 10px;
            font-size: 14px;
        `);
        info.innerHTML = `
            <div>Weight: <span id="inv-weight">0</span> / 100 kg</div>
            <div>Gold: <span id="inv-gold">0</span> 🪙</div>
        `;
        content.appendChild(info);
        
        this.setPosition(window.innerWidth - 400, 100);
        
        return this.element;
    }
    
    updateInventory(inventoryComponent) {
        if (!this.content) return;
        
        const grid = this.content.querySelector('div');
        const slots = grid.querySelectorAll('.inventory-slot');
        
        slots.forEach((slot, i) => {
            slot.innerHTML = '';
            const item = inventoryComponent.items[i];
            if (item) {
                slot.style.background = UIConstants.itemColors[item.type] || 'rgba(158, 158, 158, 0.7)';
                slot.textContent = UIConstants.itemIcons[item.type] || '❓';
                slot.title = `${item.name} (${item.quantity || 1})`;
            } else {
                slot.style.background = 'rgba(0, 0, 0, 0.5)';
                slot.title = 'Empty';
            }
        });
        
        // Update info
        const weightSpan = this.content.querySelector('#inv-weight');
        const goldSpan = this.content.querySelector('#inv-gold');
        if (weightSpan) weightSpan.textContent = inventoryComponent.currentWeight || 0;
        if (goldSpan) goldSpan.textContent = inventoryComponent.gold || 0;
    }
}

// Character Sheet GUI
class CharacterSheetGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'character';
        this.size = { width: 350, height: 450 };
    }
    
    createUI() {
        const { window, header, content, closeBtn } = UIFactory.createWindow('Character Sheet', this.size.width, this.size.height);
        this.element = window;
        this.content = content;
        
        closeBtn.onclick = () => this.close();
        
        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 id="char-name" style="margin: 0; color: #fff;">Hero</h2>
                <div style="color: #888;">Level <span id="char-level">1</span> Adventurer</div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Health</span>
                        <span id="char-health">100/100</span>
                    </div>
                    <div style="background: #333; height: 20px; border-radius: 10px; overflow: hidden;">
                        <div id="char-health-bar" style="background: #4CAF50; width: 100%; height: 100%; transition: width 0.3s;"></div>
                    </div>
                </div>
                
                <div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Mana</span>
                        <span id="char-mana">50/50</span>
                    </div>
                    <div style="background: #333; height: 20px; border-radius: 10px; overflow: hidden;">
                        <div id="char-mana-bar" style="background: #2196F3; width: 100%; height: 100%; transition: width 0.3s;"></div>
                    </div>
                </div>
            </div>
            
            <div style="border-top: 1px solid #444; padding-top: 10px;">
                <h4 style="margin: 10px 0;">Stats</h4>
                <div id="char-stats" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; font-size: 14px;">
                    <div>STR: <span id="stat-str">10</span></div>
                    <div>INT: <span id="stat-int">10</span></div>
                    <div>DEX: <span id="stat-dex">10</span></div>
                    <div>CON: <span id="stat-con">10</span></div>
                    <div>DEF: <span id="stat-def">5</span></div>
                    <div>RES: <span id="stat-res">3</span></div>
                </div>
            </div>
            
            <div style="border-top: 1px solid #444; margin-top: 10px; padding-top: 10px;">
                <h4 style="margin: 10px 0;">Experience</h4>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Progress</span>
                    <span id="char-exp">0/100</span>
                </div>
                <div style="background: #333; height: 10px; border-radius: 5px; overflow: hidden;">
                    <div id="char-exp-bar" style="background: #FFC107; width: 0%; height: 100%; transition: width 0.3s;"></div>
                </div>
            </div>
        `;
        
        this.setPosition(100, 100);
        
        return this.element;
    }
    
    updateCharacter(characterComponent) {
        if (!this.content) return;
        
        const stats = characterComponent.stats;
        
        // Update name and level
        const nameEl = this.content.querySelector('#char-name');
        const levelEl = this.content.querySelector('#char-level');
        if (nameEl) nameEl.textContent = characterComponent.name;
        if (levelEl) levelEl.textContent = characterComponent.level;
        
        // Update health
        const healthText = this.content.querySelector('#char-health');
        const healthBar = this.content.querySelector('#char-health-bar');
        if (healthText) healthText.textContent = `${stats.currentHealth}/${stats.maxHealth}`;
        if (healthBar) healthBar.style.width = `${(stats.currentHealth / stats.maxHealth) * 100}%`;
        
        // Update mana
        const manaText = this.content.querySelector('#char-mana');
        const manaBar = this.content.querySelector('#char-mana-bar');
        if (manaText) manaText.textContent = `${stats.currentMana}/${stats.maxMana}`;
        if (manaBar) manaBar.style.width = `${(stats.currentMana / stats.maxMana) * 100}%`;
        
        // Update stats
        const strEl = this.content.querySelector('#stat-str');
        const intEl = this.content.querySelector('#stat-int');
        const dexEl = this.content.querySelector('#stat-dex');
        const conEl = this.content.querySelector('#stat-con');
        const defEl = this.content.querySelector('#stat-def');
        const resEl = this.content.querySelector('#stat-res');
        
        if (strEl) strEl.textContent = stats.strength;
        if (intEl) intEl.textContent = stats.intelligence;
        if (dexEl) dexEl.textContent = stats.dexterity;
        if (conEl) conEl.textContent = stats.constitution;
        if (defEl) defEl.textContent = stats.defense;
        if (resEl) resEl.textContent = stats.magicResist;
        
        // Update experience
        const expText = this.content.querySelector('#char-exp');
        const expBar = this.content.querySelector('#char-exp-bar');
        const expToNext = characterComponent.experienceToNextLevel || 100;
        if (expText) expText.textContent = `${characterComponent.experience}/${expToNext}`;
        if (expBar) expBar.style.width = `${(characterComponent.experience / expToNext) * 100}%`;
    }
}

// Quest Journal GUI
class QuestJournalGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'journal';
        this.size = { width: 400, height: 500 };
    }
    
    createUI() {
        const { window, header, content, closeBtn } = UIFactory.createWindow('Quest Journal', this.size.width, this.size.height);
        this.element = window;
        this.content = content;
        
        closeBtn.onclick = () => this.close();
        
        content.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #666;">
                <h3>No Active Quests</h3>
                <p>Explore the world to find new adventures!</p>
            </div>
        `;
        
        this.setPosition(250, 150);
        
        return this.element;
    }
}

// Convert existing UI and Inspector to GUI components
class UIWindowGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'ui-panel';
        this.size = { width: 250, height: 300 };
        this.isDraggable = true;
    }
    
    createUI() {
        // Move existing UI panel into a GUI window
        const existingUI = document.getElementById('ui');
        const { window, header, content, closeBtn } = UIFactory.createWindow('Controls', this.size.width, this.size.height);
        
        this.element = window;
        this.content = content;
        
        // Hide close button for main UI
        closeBtn.style.display = 'none';
        
        // Move existing content
        while (existingUI.firstChild) {
            content.appendChild(existingUI.firstChild);
        }
        
        existingUI.style.display = 'none';
        
        this.setPosition(10, 10);
        this.element.style.display = 'flex';
        
        return this.element;
    }
}

class InspectorGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'inspector';
        this.size = { width: 300, height: 400 };
        this.isDraggable = true;
    }
    
    createUI() {
        // Move existing inspector into a GUI window
        const existingInspector = document.getElementById('inspector');
        const { window, header, content, closeBtn } = UIFactory.createWindow('Entity Inspector', this.size.width, this.size.height);
        
        this.element = window;
        this.content = content;
        
        // Hide close button for inspector
        closeBtn.style.display = 'none';
        
        // Create inspector content if it doesn't exist
        let inspectorContent = document.getElementById('inspector-content');
        if (!inspectorContent) {
            inspectorContent = document.createElement('div');
            inspectorContent.id = 'inspector-content';
            inspectorContent.innerHTML = `
                <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                    <button id="createBtn" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-family: monospace;">
                        + Create Entity
                    </button>
                    <button id="clearBtn" style="padding: 8px 12px; background: #F44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-family: monospace;">
                        Clear All
                    </button>
                </div>
                <div id="entityList" style="max-height: 320px; overflow-y: auto;"></div>
            `;
        }
        
        content.appendChild(inspectorContent);
        
        if (existingInspector) {
            existingInspector.style.display = 'none';
        }
        
        this.setPosition(window.innerWidth - 320, 10);
        this.element.style.display = 'flex';
        
        return this.element;
    }
}

// GUI System
class GUISystem extends System {
    constructor(world) {
        super(world);
        this.priority = 110;
        this.windows = new Map();
        this.draggedWindow = null;
        this.dragOffset = { x: 0, y: 0 };
        
        // Create GUI container if it doesn't exist
        this.guiContainer = document.getElementById('gui-container');
        if (!this.guiContainer) {
            this.guiContainer = document.createElement('div');
            this.guiContainer.id = 'gui-container';
            this.guiContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000;';
            document.body.appendChild(this.guiContainer);
        }
        
        this.setupDragAndDrop();
    }
    
    update(deltaTime) {
        // Update GUI windows
        const guiEntities = this.world.query(['GUIComponent']);
        
        guiEntities.forEach(entity => {
            const gui = entity.getComponent('GUIComponent');
            
            if (!gui.element && gui.guiType !== 'hud') {
                // Create UI element
                let element = null;
                
                if (entity.hasComponent('InventoryGUI')) {
                    const invGUI = entity.getComponent('InventoryGUI');
                    element = invGUI.createUI();
                    
                    // Update with player inventory
                    const playerInv = window.player.getComponent('InventoryComponent');
                    if (playerInv) {
                        invGUI.updateInventory(playerInv);
                    }
                } else if (entity.hasComponent('CharacterSheetGUI')) {
                    const charGUI = entity.getComponent('CharacterSheetGUI');
                    element = charGUI.createUI();
                    
                    // Update with player stats
                    const playerChar = window.player.getComponent('CharacterComponent');
                    if (playerChar) {
                        charGUI.updateCharacter(playerChar);
                    }
                } else if (entity.hasComponent('QuestJournalGUI')) {
                    const questGUI = entity.getComponent('QuestJournalGUI');
                    element = questGUI.createUI();
                }
                
                if (element) {
                    this.guiContainer.appendChild(element);
                    this.makeWindowDraggable(element);
                    this.windows.set(entity.id, element);
                }
            }
        });
    }
    
    setupDragAndDrop() {
        document.addEventListener('mousedown', (e) => {
            const header = e.target.closest('div[style*="cursor: move"]');
            if (header) {
                const window = header.parentElement;
                this.draggedWindow = window;
                
                const rect = window.getBoundingClientRect();
                this.dragOffset.x = e.clientX - rect.left;
                this.dragOffset.y = e.clientY - rect.top;
                
                // Bring to front
                const allWindows = this.guiContainer.querySelectorAll('div[style*="position: absolute"]');
                allWindows.forEach(w => w.style.zIndex = '1000');
                window.style.zIndex = '1001';
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.draggedWindow) {
                this.draggedWindow.style.left = (e.clientX - this.dragOffset.x) + 'px';
                this.draggedWindow.style.top = (e.clientY - this.dragOffset.y) + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.draggedWindow = null;
        });
    }
    
    makeWindowDraggable(window) {
        // Already handled by global drag system
    }
}

// Register GUI components
window.GUIComponent = GUIComponent;
window.InventoryGUI = InventoryGUI;
window.CharacterSheetGUI = CharacterSheetGUI;
window.QuestJournalGUI = QuestJournalGUI;
window.UIWindowGUI = UIWindowGUI;
window.InspectorGUI = InspectorGUI;

// Add GUI system
world.addSystem(new GUISystem(world));

// Initialize GUI
function initializeGUI() {
    // Create UI window
    const uiEntity = world.createEntity();
    uiEntity.addComponent(new UIWindowGUI());
    uiEntity.addComponent(new GUIComponent());
    const uiGUI = uiEntity.getComponent('UIWindowGUI');
    uiGUI.createUI();
    
    // Create inspector window
    const inspectorEntity = world.createEntity();
    inspectorEntity.addComponent(new InspectorGUI());
    inspectorEntity.addComponent(new GUIComponent());
    const inspectorGUI = inspectorEntity.getComponent('InspectorGUI');
    inspectorGUI.createUI();
    
    // Re-attach button event listeners after moving to GUI
    setTimeout(() => {
        const createBtn = document.getElementById('createBtn');
        const clearBtn = document.getElementById('clearBtn');
        
        if (createBtn) {
            createBtn.onclick = () => {
                const entity = world.createEntity();
                entity.addComponent(new NameComponent(`Entity ${world.entities.size}`));
                entity.addComponent(new TransformComponent());
                entity.addComponent(new RenderComponent());
                
                const geometry = new THREE.BoxGeometry(1, 1, 1);
                const material = new THREE.MeshStandardMaterial({ 
                    color: new THREE.Color(Math.random(), Math.random(), Math.random()) 
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                
                const render = entity.getComponent('RenderComponent');
                render.mesh = mesh;
                scene.add(mesh);
                
                const transform = entity.getComponent('TransformComponent');
                transform.position.set(
                    (Math.random() - 0.5) * 20,
                    Math.random() * 5 + 1,
                    (Math.random() - 0.5) * 20
                );
                
                updateEntityList();
            };
        }
        
        if (clearBtn) {
            clearBtn.onclick = () => {
                world.entities.forEach(entity => {
                    if (entity !== player) {
                        const render = entity.getComponent('RenderComponent');
                        if (render && render.mesh) {
                            scene.remove(render.mesh);
                        }
                        world.removeEntity(entity);
                    }
                });
                updateEntityList();
            };
        }
    }, 50);
    
    // Create inventory GUI
    const inventoryEntity = world.createEntity();
    inventoryEntity.addComponent(new InventoryGUI());
    inventoryEntity.addComponent(new GUIComponent());
    
    // Create character sheet GUI
    const characterSheetEntity = world.createEntity();
    characterSheetEntity.addComponent(new CharacterSheetGUI());
    characterSheetEntity.addComponent(new GUIComponent());
    
    // Create quest journal GUI
    const questJournalEntity = world.createEntity();
    questJournalEntity.addComponent(new QuestJournalGUI());
    questJournalEntity.addComponent(new GUIComponent());
    
    // Store GUI references
    window.playerGUI = {
        player: player,
        inventory: inventoryEntity,
        characterSheet: characterSheetEntity,
        questJournal: questJournalEntity,
        uiPanel: uiEntity,
        inspector: inspectorEntity
    };
    
    console.log('GUI initialized!');
}

// Add test data
function addTestData() {
    const playerInventory = player.getComponent('InventoryComponent');
    if (playerInventory) {
        playerInventory.items[0] = {
            id: 'sword_01',
            name: 'Iron Sword',
            type: 'weapon',
            quantity: 1,
            weight: 5,
            value: 100
        };
        
        playerInventory.items[1] = {
            id: 'potion_01',
            name: 'Health Potion',
            type: 'consumable',
            quantity: 5,
            weight: 0.5,
            value: 50
        };
        
        playerInventory.items[2] = {
            id: 'armor_01',
            name: 'Leather Armor',
            type: 'armor',
            quantity: 1,
            weight: 10,
            value: 200
        };
        
        playerInventory.currentWeight = 15.5;
        playerInventory.gold = 500;
    }
    
    const playerCharacter = player.getComponent('CharacterComponent');
    if (playerCharacter) {
        playerCharacter.name = 'Test Hero';
        playerCharacter.level = 5;
        playerCharacter.experience = 450;
        playerCharacter.experienceToNextLevel = 600;
        playerCharacter.stats.currentHealth = 80;
        playerCharacter.stats.currentMana = 45;
    }
}

// Initialize after a short delay
setTimeout(() => {
    initializeGUI();
    addTestData();
    
    // Fix the updateEntityList function to work with the new GUI
    window.updateEntityList = function() {
        const entityList = document.getElementById('entityList');
        if (!entityList) return; // Exit if element doesn't exist yet
        
        entityList.innerHTML = '';
        
        world.entities.forEach(entity => {
            const card = document.createElement('div');
            card.className = 'entity-card';
            
            const header = document.createElement('div');
            header.className = 'entity-header';
            
            const name = entity.getComponent('NameComponent');
            const title = document.createElement('strong');
            title.textContent = `${name ? name.name : 'Entity'} #${entity.id}`;
            header.appendChild(title);
            
            card.appendChild(header);
            
            // Add component badges
            const componentsDiv = document.createElement('div');
            entity.components.forEach((component, type) => {
                const badge = document.createElement('span');
                badge.className = `component ${type.toLowerCase()}`;
                badge.textContent = type.replace('Component', '');
                if (!component.active) {
                    badge.classList.add('inactive');
                }
                badge.onclick = (e) => {
                    e.stopPropagation();
                    component.active = !component.active;
                    updateEntityList();
                };
                componentsDiv.appendChild(badge);
            });
            
            card.appendChild(componentsDiv);
            entityList.appendChild(card);
        });
    };
}, 100);

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key.toLowerCase()) {
        case 'i':
            const invGUI = window.playerGUI.inventory.getComponent('InventoryGUI');
            if (invGUI) invGUI.toggle();
            break;
        case 'c':
            const charGUI = window.playerGUI.characterSheet.getComponent('CharacterSheetGUI');
            if (charGUI) charGUI.toggle();
            break;
        case 'j':
            const questGUI = window.playerGUI.questJournal.getComponent('QuestJournalGUI');
            if (questGUI) questGUI.toggle();
            break;
        case 'tab':
            e.preventDefault(); // Prevent default tab behavior
            console.log('Tab pressed, toggling inspector');
            if (window.playerGUI && window.playerGUI.inspector) {
                const guiComponent = window.playerGUI.inspector.getComponent('GUIComponent');
                console.log('Inspector GUI Component:', guiComponent);
                if (guiComponent) {
                    guiComponent.toggle();
                } else {
                    console.warn('GUI component not found on inspector');
                }
            } else {
                console.warn('PlayerGUI or inspector not initialized');
            }
            break;
        case 'escape':
            world.entities.forEach(entity => {
                const gui = entity.getComponent('GUIComponent');
                if (gui && gui.guiType !== 'ui-panel' && gui.guiType !== 'inspector') {
                    gui.close();
                }
            });
            break;
    }
});