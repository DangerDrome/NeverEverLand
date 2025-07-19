// StyleUI Panel Component
StyleUI.Panel = class {
    constructor(options = {}) {
        this.options = {
            title: '',
            content: '',
            position: 'top-right', // top-left, top-right, bottom-left, bottom-right
            size: 'md', // sm, md, lg
            closable: true,
            collapsible: false,
            draggable: false,
            resizable: false,
            className: '',
            onClose: null,
            onCollapse: null,
            ...options
        };
        
        this.isCollapsed = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        this.element = this.render();
        this.attachEvents();
    }
    
    render() {
        const sizeClasses = {
            sm: 'panel-sm',
            md: 'panel-md',
            lg: 'panel-lg'
        };
        
        const classes = [
            'panel',
            `panel-${this.options.position}`,
            sizeClasses[this.options.size],
            this.options.draggable ? 'panel-draggable' : '',
            this.options.resizable ? 'panel-resizable' : '',
            this.options.className
        ].filter(Boolean).join(' ');
        
        const panel = StyleUI.utils.createElement('div', classes);
        
        // Header
        const header = StyleUI.utils.createElement('div', 'panel-header');
        
        const title = StyleUI.utils.createElement('h4', 'panel-title', {
            textContent: this.options.title
        });
        header.appendChild(title);
        
        // Controls
        const controls = StyleUI.utils.createElement('div', 'panel-controls');
        
        if (this.options.collapsible) {
            const collapseBtn = StyleUI.utils.createElement('button', 'icon-button icon-button-sm');
            const collapseIcon = StyleUI.utils.createIcon('chevron-down');
            collapseIcon.classList.add('panel-collapse-icon');
            collapseBtn.appendChild(collapseIcon);
            controls.appendChild(collapseBtn);
            
            StyleUI.events.on(collapseBtn, 'click', () => this.toggle());
        }
        
        if (this.options.closable) {
            const closeBtn = StyleUI.utils.createElement('button', 'panel-close');
            closeBtn.appendChild(StyleUI.utils.createIcon('x'));
            controls.appendChild(closeBtn);
            
            StyleUI.events.on(closeBtn, 'click', () => this.close());
        }
        
        header.appendChild(controls);
        panel.appendChild(header);
        
        // Body
        const body = StyleUI.utils.createElement('div', 'panel-body');
        if (typeof this.options.content === 'string') {
            body.innerHTML = this.options.content;
        } else if (this.options.content instanceof HTMLElement) {
            body.appendChild(this.options.content);
        }
        panel.appendChild(body);
        
        // Resize handle
        if (this.options.resizable) {
            const resizeHandle = StyleUI.utils.createElement('div', 'panel-resize-handle');
            panel.appendChild(resizeHandle);
            
            // Add resize functionality
            this.attachResizeEvents(resizeHandle);
        }
        
        return panel;
    }
    
    attachEvents() {
        if (this.options.draggable) {
            const header = this.element.querySelector('.panel-header');
            
            StyleUI.events.on(header, 'mousedown', (e) => {
                if (e.target.closest('.panel-controls')) return;
                this.startDrag(e);
            });
            
            StyleUI.events.on(document, 'mousemove', (e) => {
                if (this.isDragging) this.drag(e);
            });
            
            StyleUI.events.on(document, 'mouseup', () => {
                this.endDrag();
            });
        }
    }
    
    startDrag(e) {
        this.isDragging = true;
        this.element.classList.add('panel-dragging');
        
        const rect = this.element.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        e.preventDefault();
    }
    
    drag(e) {
        if (!this.isDragging) return;
        
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        
        this.element.style.position = 'fixed';
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.right = 'auto';
        this.element.style.bottom = 'auto';
    }
    
    endDrag() {
        this.isDragging = false;
        this.element.classList.remove('panel-dragging');
    }
    
    attachResizeEvents(handle) {
        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        
        const startResize = (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = this.element.offsetWidth;
            startHeight = this.element.offsetHeight;
            
            this.element.style.transition = 'none';
            e.preventDefault();
        };
        
        const doResize = (e) => {
            if (!isResizing) return;
            
            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);
            
            // Set minimum sizes
            if (newWidth > 150) {
                this.element.style.width = newWidth + 'px';
            }
            if (newHeight > 100) {
                this.element.style.height = newHeight + 'px';
            }
        };
        
        const stopResize = () => {
            isResizing = false;
            this.element.style.transition = '';
        };
        
        StyleUI.events.on(handle, 'mousedown', startResize);
        StyleUI.events.on(document, 'mousemove', doResize);
        StyleUI.events.on(document, 'mouseup', stopResize);
    }
    
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        this.element.classList.toggle('panel-collapsed', this.isCollapsed);
        
        if (this.options.onCollapse) {
            this.options.onCollapse(this.isCollapsed);
        }
        
        StyleUI.events.emit(this.element, 'panel-toggle', { collapsed: this.isCollapsed });
    }
    
    close() {
        if (this.options.onClose) {
            this.options.onClose();
        }
        
        StyleUI.events.emit(this.element, 'panel-close');
        this.destroy();
    }
    
    setTitle(title) {
        this.options.title = title;
        const titleElement = this.element.querySelector('.panel-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }
    
    setContent(content) {
        this.options.content = content;
        const body = this.element.querySelector('.panel-body');
        if (body) {
            if (typeof content === 'string') {
                body.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                body.innerHTML = '';
                body.appendChild(content);
            }
        }
    }
    
    show() {
        this.element.style.display = 'flex';
    }
    
    hide() {
        this.element.style.display = 'none';
    }
    
    destroy() {
        // Remove event listeners
        if (this.options.draggable) {
            const header = this.element.querySelector('.panel-header');
            StyleUI.events.off(header, 'mousedown');
            StyleUI.events.off(document, 'mousemove');
            StyleUI.events.off(document, 'mouseup');
        }
        
        this.element.remove();
    }
};