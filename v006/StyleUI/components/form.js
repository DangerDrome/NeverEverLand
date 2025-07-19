// StyleUI Form Components
StyleUI.FormInput = class {
    constructor(options = {}) {
        this.options = {
            type: 'text',
            placeholder: '',
            value: '',
            label: '',
            help: '',
            error: '',
            size: 'md', // sm, md, lg
            disabled: false,
            readonly: false,
            required: false,
            className: '',
            onChange: null,
            onFocus: null,
            onBlur: null,
            ...options
        };
        
        this.element = this.render();
        this.input = this.element.querySelector('input');
        this.attachEvents();
    }
    
    render() {
        const container = StyleUI.utils.createElement('div', 'form-group');
        
        // Label
        if (this.options.label) {
            const label = StyleUI.utils.createElement('label', 'form-label', {
                textContent: this.options.label
            });
            if (this.options.required) {
                label.innerHTML += ' <span style="color: var(--color-danger)">*</span>';
            }
            container.appendChild(label);
        }
        
        // Input
        const sizeClasses = {
            sm: 'form-input-sm',
            md: '',
            lg: 'form-input-lg'
        };
        
        const classes = [
            'form-input',
            sizeClasses[this.options.size],
            this.options.error ? 'form-input-error' : '',
            this.options.className
        ].filter(Boolean).join(' ');
        
        const input = StyleUI.utils.createElement('input', classes, {
            type: this.options.type,
            placeholder: this.options.placeholder,
            value: this.options.value,
            disabled: this.options.disabled,
            readonly: this.options.readonly,
            required: this.options.required
        });
        
        container.appendChild(input);
        
        // Help text
        if (this.options.help && !this.options.error) {
            const help = StyleUI.utils.createElement('div', 'form-help', {
                textContent: this.options.help
            });
            container.appendChild(help);
        }
        
        // Error text
        if (this.options.error) {
            const error = StyleUI.utils.createElement('div', 'form-error', {
                textContent: this.options.error
            });
            container.appendChild(error);
        }
        
        return container;
    }
    
    attachEvents() {
        if (this.options.onChange) {
            StyleUI.events.on(this.input, 'input', (e) => {
                this.options.onChange(e.target.value, e);
            });
        }
        
        if (this.options.onFocus) {
            StyleUI.events.on(this.input, 'focus', this.options.onFocus);
        }
        
        if (this.options.onBlur) {
            StyleUI.events.on(this.input, 'blur', this.options.onBlur);
        }
    }
    
    getValue() {
        return this.input.value;
    }
    
    setValue(value) {
        this.input.value = value;
        this.options.value = value;
    }
    
    setError(error) {
        this.options.error = error;
        
        // Update error class
        this.input.classList.toggle('form-input-error', !!error);
        
        // Update error/help text
        const helpElement = this.element.querySelector('.form-help');
        const errorElement = this.element.querySelector('.form-error');
        
        if (helpElement) helpElement.remove();
        if (errorElement) errorElement.remove();
        
        if (error) {
            const errorDiv = StyleUI.utils.createElement('div', 'form-error', {
                textContent: error
            });
            this.element.appendChild(errorDiv);
        } else if (this.options.help) {
            const helpDiv = StyleUI.utils.createElement('div', 'form-help', {
                textContent: this.options.help
            });
            this.element.appendChild(helpDiv);
        }
    }
    
    setDisabled(disabled) {
        this.options.disabled = disabled;
        this.input.disabled = disabled;
    }
    
    focus() {
        this.input.focus();
    }
    
    blur() {
        this.input.blur();
    }
    
    destroy() {
        if (this.options.onChange) {
            StyleUI.events.off(this.input, 'input');
        }
        if (this.options.onFocus) {
            StyleUI.events.off(this.input, 'focus');
        }
        if (this.options.onBlur) {
            StyleUI.events.off(this.input, 'blur');
        }
        this.element.remove();
    }
};

// Select Component
StyleUI.FormSelect = class {
    constructor(options = {}) {
        this.options = {
            options: [], // Array of {value, label} or strings
            value: '',
            label: '',
            placeholder: 'Select an option',
            help: '',
            error: '',
            size: 'md',
            disabled: false,
            required: false,
            className: '',
            onChange: null,
            ...options
        };
        
        this.element = this.render();
        this.select = this.element.querySelector('select');
        this.attachEvents();
    }
    
    render() {
        const container = StyleUI.utils.createElement('div', 'form-group');
        
        // Label
        if (this.options.label) {
            const label = StyleUI.utils.createElement('label', 'form-label', {
                textContent: this.options.label
            });
            if (this.options.required) {
                label.innerHTML += ' <span style="color: var(--color-danger)">*</span>';
            }
            container.appendChild(label);
        }
        
        // Select
        const sizeClasses = {
            sm: 'form-input-sm',
            md: '',
            lg: 'form-input-lg'
        };
        
        const classes = [
            'form-select',
            sizeClasses[this.options.size],
            this.options.error ? 'form-input-error' : '',
            this.options.className
        ].filter(Boolean).join(' ');
        
        const select = StyleUI.utils.createElement('select', classes, {
            disabled: this.options.disabled,
            required: this.options.required
        });
        
        // Placeholder option
        if (this.options.placeholder) {
            const placeholder = StyleUI.utils.createElement('option', '', {
                value: '',
                textContent: this.options.placeholder,
                disabled: true,
                selected: !this.options.value
            });
            select.appendChild(placeholder);
        }
        
        // Options
        this.options.options.forEach(opt => {
            const option = StyleUI.utils.createElement('option', '', {
                value: typeof opt === 'string' ? opt : opt.value,
                textContent: typeof opt === 'string' ? opt : opt.label,
                selected: (typeof opt === 'string' ? opt : opt.value) === this.options.value
            });
            select.appendChild(option);
        });
        
        container.appendChild(select);
        
        // Help/Error text
        if (this.options.help && !this.options.error) {
            const help = StyleUI.utils.createElement('div', 'form-help', {
                textContent: this.options.help
            });
            container.appendChild(help);
        }
        
        if (this.options.error) {
            const error = StyleUI.utils.createElement('div', 'form-error', {
                textContent: this.options.error
            });
            container.appendChild(error);
        }
        
        return container;
    }
    
    attachEvents() {
        if (this.options.onChange) {
            StyleUI.events.on(this.select, 'change', (e) => {
                this.options.onChange(e.target.value, e);
            });
        }
    }
    
    getValue() {
        return this.select.value;
    }
    
    setValue(value) {
        this.select.value = value;
        this.options.value = value;
    }
    
    destroy() {
        if (this.options.onChange) {
            StyleUI.events.off(this.select, 'change');
        }
        this.element.remove();
    }
};

// Checkbox Component
StyleUI.FormCheckbox = class {
    constructor(options = {}) {
        this.options = {
            label: '',
            checked: false,
            disabled: false,
            className: '',
            onChange: null,
            ...options
        };
        
        this.element = this.render();
        this.checkbox = this.element.querySelector('input');
        this.attachEvents();
    }
    
    render() {
        const container = StyleUI.utils.createElement('label', 'form-inline');
        
        const checkbox = StyleUI.utils.createElement('input', 'form-checkbox', {
            type: 'checkbox',
            checked: this.options.checked,
            disabled: this.options.disabled
        });
        
        container.appendChild(checkbox);
        
        if (this.options.label) {
            const label = StyleUI.utils.createElement('span', '', {
                textContent: this.options.label
            });
            container.appendChild(label);
        }
        
        return container;
    }
    
    attachEvents() {
        if (this.options.onChange) {
            StyleUI.events.on(this.checkbox, 'change', (e) => {
                this.options.onChange(e.target.checked, e);
            });
        }
    }
    
    isChecked() {
        return this.checkbox.checked;
    }
    
    setChecked(checked) {
        this.checkbox.checked = checked;
        this.options.checked = checked;
    }
    
    toggle() {
        this.setChecked(!this.checkbox.checked);
    }
    
    destroy() {
        if (this.options.onChange) {
            StyleUI.events.off(this.checkbox, 'change');
        }
        this.element.remove();
    }
};