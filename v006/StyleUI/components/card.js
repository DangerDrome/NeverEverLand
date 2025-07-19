// StyleUI Card Component
StyleUI.Card = class {
    constructor(options = {}) {
        this.options = {
            title: '',
            content: '',
            footer: null,
            variant: 'default', // default, elevated, flat, outlined
            interactive: false,
            className: '',
            onClick: null,
            ...options
        };
        
        this.element = this.render();
        this.attachEvents();
    }
    
    render() {
        const variantClasses = {
            default: '',
            elevated: 'card-elevated',
            flat: 'card-flat',
            outlined: 'card-outlined'
        };
        
        const classes = [
            'card',
            variantClasses[this.options.variant],
            this.options.interactive ? 'card-interactive' : '',
            this.options.className
        ].filter(Boolean).join(' ');
        
        const card = StyleUI.utils.createElement('div', classes);
        
        // Header
        if (this.options.title) {
            const header = StyleUI.utils.createElement('div', 'card-header');
            const title = StyleUI.utils.createElement('h4', '', {
                textContent: this.options.title
            });
            header.appendChild(title);
            card.appendChild(header);
        }
        
        // Body
        const body = StyleUI.utils.createElement('div', 'card-body');
        if (typeof this.options.content === 'string') {
            body.innerHTML = this.options.content;
        } else if (this.options.content instanceof HTMLElement) {
            body.appendChild(this.options.content);
        }
        card.appendChild(body);
        
        // Footer
        if (this.options.footer) {
            const footer = StyleUI.utils.createElement('div', 'card-footer');
            if (typeof this.options.footer === 'string') {
                footer.innerHTML = this.options.footer;
            } else if (this.options.footer instanceof HTMLElement) {
                footer.appendChild(this.options.footer);
            }
            card.appendChild(footer);
        }
        
        return card;
    }
    
    attachEvents() {
        if (this.options.interactive && this.options.onClick) {
            StyleUI.events.on(this.element, 'click', this.options.onClick);
        }
    }
    
    setTitle(title) {
        this.options.title = title;
        const titleElement = this.element.querySelector('.card-header h4');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }
    
    setContent(content) {
        this.options.content = content;
        const body = this.element.querySelector('.card-body');
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
        if (this.options.interactive && this.options.onClick) {
            StyleUI.events.off(this.element, 'click', this.options.onClick);
        }
        this.element.remove();
    }
};

// Card Grid Component
StyleUI.CardGrid = class {
    constructor(options = {}) {
        this.options = {
            cards: [],
            columns: 'auto', // auto, 1, 2, 3, 4, etc.
            gap: 'md', // sm, md, lg
            className: '',
            ...options
        };
        
        this.element = this.render();
        this.cards = [];
        this.initCards();
    }
    
    render() {
        const classes = ['card-grid', this.options.className].filter(Boolean).join(' ');
        const grid = StyleUI.utils.createElement('div', classes);
        
        // Set custom grid properties if specified
        if (this.options.columns !== 'auto') {
            grid.style.gridTemplateColumns = `repeat(${this.options.columns}, 1fr)`;
        }
        
        const gapSizes = {
            sm: 'var(--space-3)',
            md: 'var(--space-5)',
            lg: 'var(--space-8)'
        };
        
        if (this.options.gap) {
            grid.style.gap = gapSizes[this.options.gap] || this.options.gap;
        }
        
        return grid;
    }
    
    initCards() {
        this.options.cards.forEach(cardOptions => {
            this.addCard(cardOptions);
        });
    }
    
    addCard(cardOptions) {
        const card = new StyleUI.Card(cardOptions);
        this.cards.push(card);
        this.element.appendChild(card.element);
        return card;
    }
    
    removeCard(index) {
        if (this.cards[index]) {
            this.cards[index].destroy();
            this.cards.splice(index, 1);
        }
    }
    
    clear() {
        this.cards.forEach(card => card.destroy());
        this.cards = [];
    }
    
    destroy() {
        this.clear();
        this.element.remove();
    }
};