// StyleUI Button Component
StyleUI.Button = class {
    constructor(options = {}) {
        this.options = {
            text: '',
            variant: 'primary', // primary, secondary, success, warning, danger, ghost
            size: 'md', // xs, sm, md, lg
            icon: null,
            iconPosition: 'left', // left, right
            disabled: false,
            loading: false,
            onClick: null,
            className: '',
            ...options
        };
        
        this.element = this.render();
        this.attachEvents();
    }
    
    render() {
        const sizeClasses = {
            xs: 'btn-xs',
            sm: 'btn-sm',
            md: '',
            lg: 'btn-lg'
        };
        
        const classes = [
            'btn',
            `btn-${this.options.variant}`,
            sizeClasses[this.options.size],
            this.options.className
        ].filter(Boolean).join(' ');
        
        const button = StyleUI.utils.createElement('button', classes, {
            disabled: this.options.disabled || this.options.loading
        });
        
        // Add loading spinner if loading
        if (this.options.loading) {
            const spinner = StyleUI.utils.createElement('span', 'spinner spinner-xs');
            button.appendChild(spinner);
        }
        
        // Add icon if provided
        if (this.options.icon && !this.options.loading) {
            const icon = StyleUI.utils.createIcon(this.options.icon);
            if (this.options.iconPosition === 'left') {
                button.appendChild(icon);
            }
        }
        
        // Add text
        if (this.options.text) {
            const textSpan = StyleUI.utils.createElement('span', '', {
                textContent: this.options.text
            });
            button.appendChild(textSpan);
        }
        
        // Add icon on right if specified
        if (this.options.icon && this.options.iconPosition === 'right' && !this.options.loading) {
            const icon = StyleUI.utils.createIcon(this.options.icon);
            button.appendChild(icon);
        }
        
        return button;
    }
    
    attachEvents() {
        if (this.options.onClick) {
            StyleUI.events.on(this.element, 'click', this.options.onClick);
        }
    }
    
    setLoading(loading) {
        this.options.loading = loading;
        const newButton = this.render();
        this.element.replaceWith(newButton);
        this.element = newButton;
        this.attachEvents();
    }
    
    setDisabled(disabled) {
        this.options.disabled = disabled;
        this.element.disabled = disabled;
    }
    
    setText(text) {
        this.options.text = text;
        const textSpan = this.element.querySelector('span:not(.spinner):not(.icon)');
        if (textSpan) {
            textSpan.textContent = text;
        }
    }
    
    destroy() {
        if (this.options.onClick) {
            StyleUI.events.off(this.element, 'click', this.options.onClick);
        }
        this.element.remove();
    }
};

// Button Group Component
StyleUI.ButtonGroup = class {
    constructor(options = {}) {
        this.options = {
            buttons: [],
            className: '',
            ...options
        };
        
        this.element = this.render();
        this.buttons = [];
        this.initButtons();
    }
    
    render() {
        const classes = ['btn-group', this.options.className].filter(Boolean).join(' ');
        return StyleUI.utils.createElement('div', classes);
    }
    
    initButtons() {
        this.options.buttons.forEach(buttonOptions => {
            const button = new StyleUI.Button(buttonOptions);
            this.buttons.push(button);
            this.element.appendChild(button.element);
        });
    }
    
    addButton(buttonOptions) {
        const button = new StyleUI.Button(buttonOptions);
        this.buttons.push(button);
        this.element.appendChild(button.element);
        return button;
    }
    
    removeButton(index) {
        if (this.buttons[index]) {
            this.buttons[index].destroy();
            this.buttons.splice(index, 1);
        }
    }
    
    destroy() {
        this.buttons.forEach(button => button.destroy());
        this.element.remove();
    }
};