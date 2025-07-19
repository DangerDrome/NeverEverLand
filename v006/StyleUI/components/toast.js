// StyleUI Toast Component
StyleUI.Toast = class {
    constructor(options = {}) {
        this.options = {
            title: '',
            message: '',
            type: 'default', // default, success, warning, danger, info
            duration: 5000, // 0 for persistent
            position: 'top-right', // top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
            closable: true,
            icon: null,
            progress: true,
            className: '',
            onClose: null,
            ...options
        };
        
        this.element = null;
        this.progressBar = null;
        this.autoCloseTimeout = null;
        
        this.render();
        this.show();
    }
    
    render() {
        const typeClasses = {
            default: '',
            success: 'toast--success',
            warning: 'toast--warning',
            danger: 'toast--danger',
            info: 'toast--info'
        };
        
        const classes = [
            'toast',
            typeClasses[this.options.type],
            this.options.className
        ].filter(Boolean).join(' ');
        
        this.element = StyleUI.utils.createElement('div', classes);
        
        // Icon
        if (this.options.icon || this.options.type !== 'default') {
            const iconWrapper = StyleUI.utils.createElement('div', 'toast-icon');
            const iconName = this.options.icon || this.getDefaultIcon();
            if (iconName) {
                iconWrapper.appendChild(StyleUI.utils.createIcon(iconName, 20));
                this.element.appendChild(iconWrapper);
            }
        }
        
        // Content
        const content = StyleUI.utils.createElement('div', 'toast-content');
        
        if (this.options.title) {
            const title = StyleUI.utils.createElement('div', 'toast-title', {
                textContent: this.options.title
            });
            content.appendChild(title);
        }
        
        if (this.options.message) {
            const message = StyleUI.utils.createElement('div', 'toast-message', {
                textContent: this.options.message
            });
            content.appendChild(message);
        }
        
        this.element.appendChild(content);
        
        // Close button
        if (this.options.closable) {
            const closeBtn = StyleUI.utils.createElement('button', 'toast-close');
            closeBtn.appendChild(StyleUI.utils.createIcon('x', 16));
            this.element.appendChild(closeBtn);
            
            StyleUI.events.on(closeBtn, 'click', () => this.close());
        }
        
        // Progress bar
        if (this.options.progress && this.options.duration > 0) {
            this.progressBar = StyleUI.utils.createElement('div', 'toast-progress');
            this.progressBar.style.animationDuration = `${this.options.duration}ms`;
            this.element.appendChild(this.progressBar);
        }
    }
    
    getDefaultIcon() {
        const icons = {
            success: 'check-circle',
            warning: 'alert-triangle',
            danger: 'x-circle',
            info: 'info'
        };
        return icons[this.options.type];
    }
    
    show() {
        // Get or create container
        const container = this.getContainer();
        container.appendChild(this.element);
        
        // Trigger reflow for animation
        this.element.offsetHeight;
        
        // Auto close
        if (this.options.duration > 0) {
            this.autoCloseTimeout = setTimeout(() => this.close(), this.options.duration);
        }
        
        StyleUI.events.emit(this.element, 'toast-show');
    }
    
    getContainer() {
        const containerId = `toast-container-${this.options.position}`;
        let container = document.getElementById(containerId);
        
        if (!container) {
            container = StyleUI.utils.createElement('div', `toast-container toast-container--${this.options.position}`, {
                id: containerId
            });
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    close() {
        clearTimeout(this.autoCloseTimeout);
        
        this.element.classList.add('toast-exit');
        
        setTimeout(() => {
            if (this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            
            // Remove container if empty
            const container = this.element.parentNode;
            if (container && container.children.length === 0) {
                container.remove();
            }
            
            if (this.options.onClose) {
                this.options.onClose();
            }
            
            StyleUI.events.emit(this.element, 'toast-close');
        }, 300);
    }
    
    destroy() {
        this.close();
    }
};

// Toast Manager
StyleUI.ToastManager = {
    toasts: [],
    
    show(options) {
        const toast = new StyleUI.Toast(options);
        this.toasts.push(toast);
        return toast;
    },
    
    success(message, options = {}) {
        return this.show({
            message,
            type: 'success',
            ...options
        });
    },
    
    warning(message, options = {}) {
        return this.show({
            message,
            type: 'warning',
            ...options
        });
    },
    
    error(message, options = {}) {
        return this.show({
            message,
            type: 'danger',
            ...options
        });
    },
    
    info(message, options = {}) {
        return this.show({
            message,
            type: 'info',
            ...options
        });
    },
    
    clear() {
        this.toasts.forEach(toast => toast.close());
        this.toasts = [];
    }
};

// Convenience methods
StyleUI.toast = function(options) {
    if (typeof options === 'string') {
        options = { message: options };
    }
    return StyleUI.ToastManager.show(options);
};

StyleUI.toast.success = function(message, options) {
    return StyleUI.ToastManager.success(message, options);
};

StyleUI.toast.warning = function(message, options) {
    return StyleUI.ToastManager.warning(message, options);
};

StyleUI.toast.error = function(message, options) {
    return StyleUI.ToastManager.error(message, options);
};

StyleUI.toast.info = function(message, options) {
    return StyleUI.ToastManager.info(message, options);
};

StyleUI.toast.clear = function() {
    return StyleUI.ToastManager.clear();
};