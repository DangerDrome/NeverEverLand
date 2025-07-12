// GUI Components to add to main-bundled.js
// Add this code at the end of the file after window.player = player;

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

// GUI Component
class GUIComponent extends Component {
    constructor() {
        super();
        this.guiType = 'hud';
        this.visible = true;
        this.position = { x: 0, y: 0 };
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
            this.element.style.display = 'block';
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
}

// Simple GUI System
class GUISystem extends System {
    constructor(world) {
        super(world);
        this.guiContainer = document.getElementById('gui-container');
        this.priority = 110;
    }
    
    update(deltaTime) {
        // GUI updates would go here
    }
}

// Register GUI components
window.GUIComponent = GUIComponent;

// Add GUI system
world.addSystem(new GUISystem(world));

// Test GUI
console.log('GUI addon loaded! Press I to test inventory toggle.');

// Add keyboard handler
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'i') {
        console.log('Inventory key pressed!');
        alert('GUI System is working! Full inventory UI coming soon.');
    }
});