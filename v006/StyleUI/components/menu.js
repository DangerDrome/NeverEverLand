// StyleUI Menu Component
StyleUI.Menu = class {
    constructor(options = {}) {
        this.options = {
            items: [], // Array of menu items
            className: '',
            onSelect: null,
            ...options
        };
        
        this.element = this.render();
        this.attachEvents();
    }
    
    render() {
        const classes = ['menu', this.options.className].filter(Boolean).join(' ');
        const menu = StyleUI.utils.createElement('div', classes);
        
        this.options.items.forEach(item => {
            if (item.type === 'divider') {
                menu.appendChild(StyleUI.utils.createElement('div', 'menu-divider'));
            } else if (item.type === 'section') {
                const section = StyleUI.utils.createElement('div', 'menu-section', {
                    textContent: item.label
                });
                menu.appendChild(section);
            } else {
                const menuItem = this.renderMenuItem(item);
                menu.appendChild(menuItem);
            }
        });
        
        return menu;
    }
    
    renderMenuItem(item) {
        const classes = [
            'menu-item',
            item.disabled ? 'menu-item-disabled' : '',
            item.submenu ? 'menu-item-submenu' : ''
        ].filter(Boolean).join(' ');
        
        const menuItem = StyleUI.utils.createElement('div', classes);
        
        // Icon
        if (item.icon) {
            const iconWrapper = StyleUI.utils.createElement('span', 'menu-item-icon');
            iconWrapper.appendChild(StyleUI.utils.createIcon(item.icon, 16));
            menuItem.appendChild(iconWrapper);
        }
        
        // Label
        const label = StyleUI.utils.createElement('span', 'menu-item-label', {
            textContent: item.label
        });
        menuItem.appendChild(label);
        
        // Shortcut
        if (item.shortcut) {
            const shortcut = StyleUI.utils.createElement('span', 'menu-item-shortcut', {
                textContent: item.shortcut
            });
            menuItem.appendChild(shortcut);
        }
        
        // Submenu
        if (item.submenu) {
            const submenu = new StyleUI.Menu({
                items: item.submenu,
                className: 'submenu'
            });
            menuItem.appendChild(submenu.element);
        }
        
        // Store item data
        menuItem.dataset.value = item.value || item.label;
        
        return menuItem;
    }
    
    attachEvents() {
        StyleUI.events.on(this.element, 'click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (!menuItem || menuItem.classList.contains('menu-item-disabled')) return;
            
            const value = menuItem.dataset.value;
            
            if (this.options.onSelect) {
                this.options.onSelect(value, menuItem);
            }
            
            StyleUI.events.emit(this.element, 'menu-select', { value, item: menuItem });
        });
    }
    
    show() {
        this.element.style.display = 'block';
    }
    
    hide() {
        this.element.style.display = 'none';
    }
    
    destroy() {
        StyleUI.events.off(this.element, 'click');
        this.element.remove();
    }
};

// Context Menu Component
StyleUI.ContextMenu = class extends StyleUI.Menu {
    constructor(options = {}) {
        super(options);
        this.element.classList.add('context-menu');
        this.attachContextEvents();
    }
    
    attachContextEvents() {
        // Close on outside click
        StyleUI.events.on(document, 'click', (e) => {
            if (!this.element.contains(e.target)) {
                this.hide();
            }
        });
        
        // Close on escape
        StyleUI.events.on(document, 'keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });
    }
    
    show(x, y) {
        this.element.classList.add('show');
        
        // Position the menu
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        
        // Adjust position if menu goes off-screen
        requestAnimationFrame(() => {
            const rect = this.element.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            if (rect.right > windowWidth) {
                this.element.style.left = `${x - rect.width}px`;
            }
            
            if (rect.bottom > windowHeight) {
                this.element.style.top = `${y - rect.height}px`;
            }
        });
    }
    
    hide() {
        this.element.classList.remove('show');
    }
};

// Dropdown Component
StyleUI.Dropdown = class {
    constructor(options = {}) {
        this.options = {
            trigger: null, // Element or selector
            menu: null, // Menu options
            position: 'bottom-left', // bottom-left, bottom-right, top-left, top-right
            className: '',
            ...options
        };
        
        this.element = this.render();
        this.trigger = this.getTrigger();
        this.menu = null;
        this.isOpen = false;
        
        this.init();
        this.attachEvents();
    }
    
    render() {
        const div = StyleUI.utils.createElement('div', 'dropdown');
        if (this.options.trigger instanceof HTMLElement) {
            div.appendChild(this.options.trigger);
        }
        return div;
    }
    
    getTrigger() {
        if (typeof this.options.trigger === 'string') {
            return document.querySelector(this.options.trigger);
        }
        return this.options.trigger;
    }
    
    init() {
        if (this.options.menu) {
            this.menu = new StyleUI.Menu({
                ...this.options.menu,
                className: `dropdown-menu ${this.options.position === 'bottom-right' ? 'dropdown-menu-right' : ''}`
            });
            this.element.appendChild(this.menu.element);
        }
    }
    
    attachEvents() {
        if (this.trigger) {
            StyleUI.events.on(this.trigger, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
            });
        }
        
        // Close on outside click
        StyleUI.events.on(document, 'click', (e) => {
            if (!this.element.contains(e.target) && this.isOpen) {
                this.close();
            }
        });
    }
    
    toggle() {
        this.isOpen ? this.close() : this.open();
    }
    
    open() {
        this.isOpen = true;
        this.element.classList.add('open');
        StyleUI.events.emit(this.element, 'dropdown-open');
    }
    
    close() {
        this.isOpen = false;
        this.element.classList.remove('open');
        StyleUI.events.emit(this.element, 'dropdown-close');
    }
    
    destroy() {
        if (this.trigger) {
            StyleUI.events.off(this.trigger, 'click');
        }
        StyleUI.events.off(document, 'click');
        if (this.menu) {
            this.menu.destroy();
        }
        this.element.remove();
    }
};