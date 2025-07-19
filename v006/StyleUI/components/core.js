// StyleUI Core Component System
window.StyleUI = window.StyleUI || {};

// Utility functions
StyleUI.utils = {
    generateId: () => `sui-${Math.random().toString(36).substr(2, 9)}`,
    
    createElement: (tag, className, attributes = {}) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else {
                element[key] = value;
            }
        });
        return element;
    },
    
    createIcon: (iconName, size = 16) => {
        const span = document.createElement('span');
        span.className = 'icon';
        span.innerHTML = `<i data-lucide="${iconName}" width="${size}" height="${size}"></i>`;
        // Initialize lucide icon
        if (window.lucide) {
            window.lucide.createIcons();
        }
        return span;
    },
    
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    throttle: (func, limit) => {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Event system
StyleUI.events = {
    listeners: new Map(),
    
    on: (element, event, handler) => {
        if (!StyleUI.events.listeners.has(element)) {
            StyleUI.events.listeners.set(element, new Map());
        }
        const elementListeners = StyleUI.events.listeners.get(element);
        if (!elementListeners.has(event)) {
            elementListeners.set(event, new Set());
        }
        elementListeners.get(event).add(handler);
        element.addEventListener(event, handler);
    },
    
    off: (element, event, handler) => {
        const elementListeners = StyleUI.events.listeners.get(element);
        if (elementListeners && elementListeners.has(event)) {
            elementListeners.get(event).delete(handler);
            element.removeEventListener(event, handler);
        }
    },
    
    emit: (element, eventName, detail = {}) => {
        const event = new CustomEvent(eventName, { detail, bubbles: true });
        element.dispatchEvent(event);
    }
};

// Theme system
StyleUI.theme = {
    init: () => {
        // Check for saved theme preference or default to 'dark'
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.body.classList.toggle('dark', savedTheme === 'dark');
    },
    
    toggle: () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        StyleUI.events.emit(document.body, 'themechange', { theme: isDark ? 'dark' : 'light' });
    },
    
    set: (theme) => {
        document.body.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
        StyleUI.events.emit(document.body, 'themechange', { theme });
    },
    
    get: () => {
        return document.body.classList.contains('dark') ? 'dark' : 'light';
    }
};

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
    StyleUI.theme.init();
});