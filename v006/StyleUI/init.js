// Initialize StyleUI and expose API
window.UI = {
    // Panel creation helper
    panel: function(title, content, options = {}) {
        const panelOptions = {
            title: title,
            content: content,
            position: options.position || 'top-right',
            size: options.size || 'md',
            closable: options.closable !== false,
            collapsible: options.collapsible || false,
            draggable: options.draggable || false,
            resizable: options.resizable || false,
            className: options.className || '',
            onClose: options.onClose,
            onCollapse: options.onCollapse
        };
        
        const panel = new StyleUI.Panel(panelOptions);
        
        // Add icon to title if provided
        if (options.icon) {
            const titleElement = panel.element.querySelector('.panel-title');
            if (titleElement) {
                const iconSpan = StyleUI.utils.createIcon(options.icon, 16);
                iconSpan.style.marginRight = 'var(--space-2)';
                titleElement.prepend(iconSpan);
            }
        }
        
        // Handle collapsed state
        if (options.startCollapsed) {
            panel.toggle();
        }
        
        return panel.element;
    },
    
    // Toast notifications
    toast: StyleUI.toast,
    
    // Modal dialogs
    modal: function(options) {
        return new StyleUI.Modal(options);
    },
    
    // Confirm dialog
    confirm: StyleUI.confirm,
    
    // Button creation
    button: function(options) {
        return new StyleUI.Button(options);
    },
    
    // Form controls
    input: function(options) {
        return new StyleUI.FormInput(options);
    },
    
    select: function(options) {
        return new StyleUI.FormSelect(options);
    },
    
    checkbox: function(options) {
        return new StyleUI.FormCheckbox(options);
    },
    
    // Menu creation
    menu: function(options) {
        return new StyleUI.Menu(options);
    },
    
    contextMenu: function(options) {
        return new StyleUI.ContextMenu(options);
    },
    
    dropdown: function(options) {
        return new StyleUI.Dropdown(options);
    },
    
    // Card creation
    card: function(options) {
        return new StyleUI.Card(options);
    },
    
    // Tooltip
    tooltip: function(options) {
        return new StyleUI.Tooltip(options);
    },
    
    // Theme management
    theme: StyleUI.theme,
    
    // Utilities
    utils: StyleUI.utils,
    
    // Initialize tooltips
    initTooltips: StyleUI.initTooltips
};

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    // Initialize tooltips
    UI.initTooltips();
});