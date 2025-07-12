// Base GUI Component class
export default class GUIComponent {
    constructor() {
        this.guiType = 'hud'; // hud, inventory, character, quest, dialogue, shop, menu
        this.visible = true;
        this.position = { x: 0, y: 0 };
        this.size = { width: 400, height: 300 };
        this.zIndex = 1000;
        
        // GUI state
        this.isOpen = false;
        this.isDraggable = true;
        this.isResizable = true;
        this.isMinimized = false;
        
        // GUI elements
        this.element = null; // DOM element reference
        this.content = null; // Content container
        this.data = {}; // GUI-specific data
        
        // Style settings
        this.theme = 'default'; // default, dark, light, fantasy
        this.opacity = 0.95;
        
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
    
    setPosition(x, y) {
        this.position.x = x;
        this.position.y = y;
        if (this.element) {
            this.element.style.left = x + 'px';
            this.element.style.top = y + 'px';
        }
    }
}