// StyleUI Modal Component
StyleUI.Modal = class {
    constructor(options = {}) {
        this.options = {
            title: '',
            content: '',
            footer: null,
            size: 'md', // sm, md, lg, xl, fullscreen
            closable: true,
            closeOnBackdrop: true,
            closeOnEscape: true,
            className: '',
            onOpen: null,
            onClose: null,
            ...options
        };
        
        this.isOpen = false;
        this.element = null;
        this.backdrop = null;
        
        this.render();
        this.attachEvents();
    }
    
    render() {
        // Create backdrop
        this.backdrop = StyleUI.utils.createElement('div', 'modal-backdrop');
        
        // Create modal
        const sizeClasses = {
            sm: 'modal-sm',
            md: 'modal-md',
            lg: 'modal-lg',
            xl: 'modal-xl',
            fullscreen: 'modal-fullscreen'
        };
        
        const classes = [
            'modal',
            sizeClasses[this.options.size],
            this.options.className
        ].filter(Boolean).join(' ');
        
        this.element = StyleUI.utils.createElement('div', classes);
        
        // Header
        if (this.options.title || this.options.closable) {
            const header = StyleUI.utils.createElement('div', 'modal-header');
            
            if (this.options.title) {
                const title = StyleUI.utils.createElement('h3', 'modal-title', {
                    textContent: this.options.title
                });
                header.appendChild(title);
            }
            
            if (this.options.closable) {
                const closeBtn = StyleUI.utils.createElement('button', 'modal-close');
                closeBtn.appendChild(StyleUI.utils.createIcon('x', 20));
                header.appendChild(closeBtn);
                
                StyleUI.events.on(closeBtn, 'click', () => this.close());
            }
            
            this.element.appendChild(header);
        }
        
        // Body
        const body = StyleUI.utils.createElement('div', 'modal-body');
        if (typeof this.options.content === 'string') {
            body.innerHTML = this.options.content;
        } else if (this.options.content instanceof HTMLElement) {
            body.appendChild(this.options.content);
        }
        this.element.appendChild(body);
        
        // Footer
        if (this.options.footer) {
            const footer = StyleUI.utils.createElement('div', 'modal-footer');
            if (typeof this.options.footer === 'string') {
                footer.innerHTML = this.options.footer;
            } else if (this.options.footer instanceof HTMLElement) {
                footer.appendChild(this.options.footer);
            } else if (Array.isArray(this.options.footer)) {
                // Array of button configs
                this.options.footer.forEach(btnConfig => {
                    const btn = new StyleUI.Button(btnConfig);
                    footer.appendChild(btn.element);
                });
            }
            this.element.appendChild(footer);
        }
        
        this.backdrop.appendChild(this.element);
    }
    
    attachEvents() {
        // Close on backdrop click
        if (this.options.closeOnBackdrop) {
            StyleUI.events.on(this.backdrop, 'click', (e) => {
                if (e.target === this.backdrop) {
                    this.close();
                }
            });
        }
        
        // Close on escape
        if (this.options.closeOnEscape) {
            this.escapeHandler = (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            };
        }
    }
    
    open() {
        if (this.isOpen) return;
        
        document.body.appendChild(this.backdrop);
        
        // Add escape handler
        if (this.escapeHandler) {
            document.addEventListener('keydown', this.escapeHandler);
        }
        
        // Trigger reflow for animation
        this.backdrop.offsetHeight;
        
        this.backdrop.classList.add('modal-open');
        this.isOpen = true;
        
        if (this.options.onOpen) {
            this.options.onOpen();
        }
        
        StyleUI.events.emit(this.element, 'modal-open');
    }
    
    close() {
        if (!this.isOpen) return;
        
        this.backdrop.classList.remove('modal-open');
        
        // Remove escape handler
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
        
        // Wait for animation
        setTimeout(() => {
            if (this.backdrop.parentNode) {
                this.backdrop.parentNode.removeChild(this.backdrop);
            }
        }, 250);
        
        this.isOpen = false;
        
        if (this.options.onClose) {
            this.options.onClose();
        }
        
        StyleUI.events.emit(this.element, 'modal-close');
    }
    
    setTitle(title) {
        this.options.title = title;
        const titleElement = this.element.querySelector('.modal-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }
    
    setContent(content) {
        this.options.content = content;
        const body = this.element.querySelector('.modal-body');
        if (body) {
            if (typeof content === 'string') {
                body.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                body.innerHTML = '';
                body.appendChild(content);
            }
        }
    }
    
    destroy() {
        this.close();
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
    }
};

// Confirm Dialog
StyleUI.confirm = function(options = {}) {
    const defaults = {
        title: 'Confirm',
        message: 'Are you sure?',
        type: 'warning', // warning, danger, success
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: null,
        onCancel: null
    };
    
    const config = { ...defaults, ...options };
    
    // Create content
    const content = document.createElement('div');
    content.className = 'modal-confirm';
    
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    // Icon
    const iconWrapper = document.createElement('div');
    iconWrapper.className = `modal-icon modal-icon-${config.type}`;
    
    const iconNames = {
        warning: 'alert-triangle',
        danger: 'x-circle',
        success: 'check-circle'
    };
    
    iconWrapper.appendChild(StyleUI.utils.createIcon(iconNames[config.type], 64));
    body.appendChild(iconWrapper);
    
    // Message
    const message = document.createElement('div');
    message.className = 'modal-message';
    message.textContent = config.message;
    body.appendChild(message);
    
    content.appendChild(body);
    
    // Create modal
    const modal = new StyleUI.Modal({
        title: config.title,
        content: content,
        size: 'sm',
        footer: [
            {
                text: config.cancelText,
                variant: 'secondary',
                onClick: () => {
                    modal.close();
                    if (config.onCancel) config.onCancel();
                }
            },
            {
                text: config.confirmText,
                variant: config.type === 'danger' ? 'danger' : 'primary',
                onClick: () => {
                    modal.close();
                    if (config.onConfirm) config.onConfirm();
                }
            }
        ]
    });
    
    modal.open();
    
    return modal;
};