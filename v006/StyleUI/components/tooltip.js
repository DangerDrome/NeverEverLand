// StyleUI Tooltip Component
StyleUI.Tooltip = class {
    constructor(options = {}) {
        this.options = {
            target: null, // Element or selector
            content: '',
            position: 'top', // top, bottom, left, right
            trigger: 'hover', // hover, click, focus, manual
            delay: 200,
            variant: 'default', // default, dark
            size: 'md', // sm, md, lg
            multiline: false,
            className: '',
            ...options
        };
        
        this.target = this.getTarget();
        this.tooltip = null;
        this.isVisible = false;
        this.showTimeout = null;
        this.hideTimeout = null;
        
        if (this.target) {
            this.init();
        }
    }
    
    getTarget() {
        if (typeof this.options.target === 'string') {
            return document.querySelector(this.options.target);
        }
        return this.options.target;
    }
    
    init() {
        // Set data attribute for CSS tooltips
        if (this.options.content) {
            this.target.dataset.tooltip = this.options.content;
            this.target.dataset.tooltipPosition = this.options.position;
        }
        
        this.createTooltip();
        this.attachEvents();
    }
    
    createTooltip() {
        const sizeClasses = {
            sm: 'tooltip--sm',
            md: '',
            lg: 'tooltip--lg'
        };
        
        const classes = [
            'tooltip',
            `tooltip--${this.options.position}`,
            this.options.variant === 'dark' ? 'tooltip--dark' : '',
            sizeClasses[this.options.size],
            this.options.multiline ? 'tooltip--multiline' : '',
            this.options.className
        ].filter(Boolean).join(' ');
        
        this.tooltip = StyleUI.utils.createElement('div', classes, {
            textContent: this.options.content
        });
        
        document.body.appendChild(this.tooltip);
    }
    
    attachEvents() {
        switch (this.options.trigger) {
            case 'hover':
                StyleUI.events.on(this.target, 'mouseenter', () => this.show());
                StyleUI.events.on(this.target, 'mouseleave', () => this.hide());
                break;
                
            case 'click':
                StyleUI.events.on(this.target, 'click', () => this.toggle());
                // Close on outside click
                StyleUI.events.on(document, 'click', (e) => {
                    if (!this.target.contains(e.target) && this.isVisible) {
                        this.hide();
                    }
                });
                break;
                
            case 'focus':
                StyleUI.events.on(this.target, 'focus', () => this.show());
                StyleUI.events.on(this.target, 'blur', () => this.hide());
                break;
        }
    }
    
    show() {
        if (this.isVisible) return;
        
        clearTimeout(this.hideTimeout);
        
        this.showTimeout = setTimeout(() => {
            this.position();
            this.tooltip.classList.add('show');
            this.isVisible = true;
            
            StyleUI.events.emit(this.target, 'tooltip-show');
        }, this.options.delay);
    }
    
    hide() {
        clearTimeout(this.showTimeout);
        
        this.hideTimeout = setTimeout(() => {
            this.tooltip.classList.remove('show');
            this.isVisible = false;
            
            StyleUI.events.emit(this.target, 'tooltip-hide');
        }, 100);
    }
    
    toggle() {
        this.isVisible ? this.hide() : this.show();
    }
    
    position() {
        const targetRect = this.target.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        let top, left;
        
        switch (this.options.position) {
            case 'top':
                top = targetRect.top - tooltipRect.height - 8;
                left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
                break;
                
            case 'bottom':
                top = targetRect.bottom + 8;
                left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
                break;
                
            case 'left':
                top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
                left = targetRect.left - tooltipRect.width - 8;
                break;
                
            case 'right':
                top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
                left = targetRect.right + 8;
                break;
        }
        
        // Adjust for viewport boundaries
        const margin = 10;
        
        if (left < margin) {
            left = margin;
        } else if (left + tooltipRect.width > window.innerWidth - margin) {
            left = window.innerWidth - tooltipRect.width - margin;
        }
        
        if (top < margin) {
            top = margin;
        } else if (top + tooltipRect.height > window.innerHeight - margin) {
            top = window.innerHeight - tooltipRect.height - margin;
        }
        
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    }
    
    setContent(content) {
        this.options.content = content;
        this.tooltip.textContent = content;
        if (this.target) {
            this.target.dataset.tooltip = content;
        }
    }
    
    destroy() {
        clearTimeout(this.showTimeout);
        clearTimeout(this.hideTimeout);
        
        // Remove events based on trigger
        switch (this.options.trigger) {
            case 'hover':
                StyleUI.events.off(this.target, 'mouseenter');
                StyleUI.events.off(this.target, 'mouseleave');
                break;
            case 'click':
                StyleUI.events.off(this.target, 'click');
                StyleUI.events.off(document, 'click');
                break;
            case 'focus':
                StyleUI.events.off(this.target, 'focus');
                StyleUI.events.off(this.target, 'blur');
                break;
        }
        
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }
        
        if (this.target) {
            delete this.target.dataset.tooltip;
            delete this.target.dataset.tooltipPosition;
        }
    }
};

// Initialize tooltips on elements with data-tooltip attribute
StyleUI.initTooltips = function() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        if (!element._tooltip) {
            element._tooltip = new StyleUI.Tooltip({
                target: element,
                content: element.dataset.tooltip,
                position: element.dataset.tooltipPosition || 'top'
            });
        }
    });
};

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    StyleUI.initTooltips();
});