(function() {
    'use strict';

    // Configuration constants
    const CONFIG = {
        TOAST_DURATION: 5000,
        MODAL_ANIMATION_DURATION: 200,
        MENU_ANIMATION_DURATION: 150,
        TOOLTIP_MARGIN: 12,
        POPOVER_MARGIN: 8,
        MOBILE_BREAKPOINT: 768,
        ACCENT_COLORS: [
            { name: 'primary', color: 'var(--primary)' },
            { name: 'success', color: 'var(--success)' },
            { name: 'warning', color: 'var(--warning)' },
            { name: 'error', color: 'var(--error)' },
            { name: 'info', color: 'var(--info)' },
            { name: 'neutral', color: 'var(--neutral)' }
        ],
        TOAST_ICONS: {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info'
        }
    };

    // --- Main UI Object Definition ---
    const UI = {
        // Initialize icons after adding elements
        icons() {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ class: 'lucide' });
                const savedStrokeWidth = localStorage.getItem('styleui-stroke-width');
                if (savedStrokeWidth) {
                    document.querySelectorAll('.lucide').forEach(icon => {
                        icon.style.strokeWidth = savedStrokeWidth;
                    });
                }
            }
        },

        // Defer icon initialization
        deferIcons() {
            setTimeout(() => this.icons(), 0);
        },

        // Build CSS class string from array
        buildClasses(...classes) {
            return classes.filter(Boolean).join(' ');
        },

        // Theme management
        theme: {
            set(theme) {
                document.body.classList.toggle('dark', theme === 'dark');
                localStorage.setItem('styleui-theme', theme);
            },
            get() {
                return document.body.classList.contains('dark') ? 'dark' : 'light';
            },
            toggle() {
                const newTheme = this.get() === 'dark' ? 'light' : 'dark';
                this.set(newTheme);
                return newTheme;
            }
        },

        language: {
            translations: {}, // Will be populated by a separate language file loader if needed
            set(lang) {
                document.documentElement.setAttribute('lang', lang);
                localStorage.setItem('styleui-lang', lang);
            },
            get() {
                return document.documentElement.getAttribute('lang') || 'en';
            },
            translate(text) {
                // In a real app, this would look up the text in the translations object.
                // For this style guide, we'll keep it simple.
                return text;
            }
        },
        
        // --- Button Factory ---
        button(config = {}) {
            // Support legacy call signature: UI.button(text, options)
            if (typeof config === 'string') {
                config = { text: config, ...arguments[1] };
            }

            const {
                text,
                icon,
                variant,
                size,
                mono,
                class: customClass,
                onclick,
                disabled,
                iconPosition = 'left'
            } = config;

            const btn = document.createElement('button');
            const isIconOnly = icon && !text;

            btn.className = UI.buildClasses(
                'btn',
                variant && `btn-${variant}`,
                size && `btn-${size}`,
                mono && 'font-mono',
                isIconOnly && 'icon-only',
                customClass
            );

            const textSpan = text ? document.createElement('span') : null;
            if (textSpan) {
                textSpan.textContent = text;
            }

            if (icon) {
                const iconEl = document.createElement('i');
                iconEl.setAttribute('data-lucide', icon);
                iconEl.className = 'lucide';

                if (iconPosition === 'right' && textSpan) {
                    btn.appendChild(textSpan);
                    btn.appendChild(iconEl);
                } else {
                    btn.appendChild(iconEl);
                    if (textSpan) {
                        btn.appendChild(textSpan);
                    }
                }
            } else if (textSpan) {
                btn.appendChild(textSpan);
            }

            if (onclick) btn.onclick = onclick;
            if (disabled) btn.disabled = true;

            if (config.attributes) {
                for (const [key, value] of Object.entries(config.attributes)) {
                    btn.setAttribute(key, value);
                }
            }

            UI.deferIcons();

            return btn;
        },

        // --- Card Factory ---
        card(config) {
            const { title, content, ...options } = config;
            const card = document.createElement('div');
            card.className = UI.buildClasses('card', options.class);

            if (title) {
                const cardHeader = document.createElement('div');
                cardHeader.className = 'card-header';

                const headerLeft = document.createElement('div');
                headerLeft.className = 'card-header-left';

                if (options.icon) {
                    const icon = document.createElement('i');
                    icon.setAttribute('data-lucide', options.icon);
                    icon.className = 'card-icon lucide';
                    headerLeft.appendChild(icon);
                }

                const cardTitle = document.createElement('h3');
                cardTitle.className = 'card-title';
                cardTitle.textContent = title;
                headerLeft.appendChild(cardTitle);

                cardHeader.appendChild(headerLeft);

                if (options.actions) {
                    const headerActions = document.createElement('div');
                    headerActions.className = 'card-header-actions';
                    options.actions.forEach(action => {
                        const btn = UI.button(action.text || '', {
                            icon: action.icon,
                            size: 'sm',
                            variant: action.variant,
                            onclick: action.onclick,
                            class: 'card-action-btn'
                        });
                        headerActions.appendChild(btn);
                    });
                    cardHeader.appendChild(headerActions);
                }
                card.appendChild(cardHeader);
            }

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';

            // If content is a string, set it as innerHTML. If it's an element, append it.
            if (typeof content === 'string') {
                cardBody.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                cardBody.appendChild(content);
            }
            
            card.appendChild(cardBody);

            if (options.description || options.footer) {
                const cardFooter = document.createElement('div');
                cardFooter.className = 'card-footer';
                if (options.description) {
                    const p = document.createElement('p');
                    p.className = 'card-description';
                    p.textContent = options.description;
                    cardFooter.appendChild(p);
                }
                if (options.footer) {
                    const footerContent = document.createElement('div');
                    if (typeof options.footer === 'string') {
                        footerContent.innerHTML = options.footer;
                    } else if (options.footer instanceof HTMLElement) {
                        footerContent.appendChild(options.footer);
                    }
                    cardFooter.appendChild(footerContent);
                }
                card.appendChild(cardFooter);
            }

            UI.deferIcons();
            return card;
        },

        // --- Modal Factory ---
        modal(config = {}) {
            const {
                content,
                title = '',
                icon,
                size,
                actions = [],
                closeOnBackdrop = true,
                onclose
            } = config;

            const modal = document.createElement('div');
            modal.className = this.buildClasses('modal', size && `modal-${size}`);

            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';

            let cardFooter = null;
            if (actions.length > 0) {
                cardFooter = document.createElement('div');
                // The card component will add its own footer class.
                actions.forEach(action => {
                    const btn = this.button(action.text, {
                        variant: action.variant,
                        size: action.size,
                        onclick: () => {
                            if (action.onclick) action.onclick();
                            if (action.closeModal !== false) closeModal();
                        }
                    });
                    cardFooter.appendChild(btn);
                });
            }

            const card = UI.card({
                title,
                content,
                icon,
                footer: cardFooter,
                actions: title ? [{
                    icon: 'x',
                    onclick: () => closeModal(),
                    ariaLabel: 'Close'
                }] : null
            });
            
            modal.appendChild(card);
            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);

            this.icons();

            requestAnimationFrame(() => {
                backdrop.classList.add('show');
                modal.classList.add('show');
            });

            const closeModal = () => {
                backdrop.classList.remove('show');
                modal.classList.remove('show');
                
                // Allow animation to complete before removing from DOM
                setTimeout(() => {
                    backdrop.remove();
                    document.removeEventListener('keydown', escapeHandler);
                }, CONFIG.MODAL_ANIMATION_DURATION); // Match this with --transition-base

                if (onclose) onclose();
            };

            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                }
            };

            backdrop.onclick = (e) => {
                if (e.target === backdrop && closeOnBackdrop) {
                    closeModal();
                }
            };
            
            document.addEventListener('keydown', escapeHandler);

            return { modal, backdrop, close: closeModal };
        },

        // --- Panel Factory ---
        panel(title, content, options = {}) {
            const panel = document.createElement('div');
            panel.className = 'panel';
            if (options.collapsible) {
                panel.classList.add('panel-collapsible');
            }
            if (options.collapsible && options.startCollapsed) {
                panel.classList.add('panel-collapsed');
            }

            // Header
            const header = document.createElement('div');
            header.className = 'panel-header';

            // Title
            const titleDiv = document.createElement('div');
            titleDiv.className = 'panel-title';

            if (options.icon) {
                const icon = document.createElement('i');
                icon.setAttribute('data-lucide', options.icon);
                icon.className = 'lucide';
                titleDiv.appendChild(icon);
            }

            const titleSpan = document.createElement('span');
            titleSpan.textContent = title;
            titleDiv.appendChild(titleSpan);

            // Actions
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'panel-actions';

            // Add custom actions first
            if (options.actions && options.actions.length > 0) {
                options.actions.forEach(action => {
                    const actionBtn = UI.button({
                        icon: action.icon,
                        text: action.text,
                        size: 'sm',
                        variant: action.variant,
                        class: 'panel-action-btn'
                    });
                    if (action.onclick) {
                        actionBtn.onclick = action.onclick;
                    }
                    actionsDiv.appendChild(actionBtn);
                });
            }

            let toggleButton;
            if (options.collapsible) {
                toggleButton = UI.button({ 
                    icon: 'chevron-down',
                    size: 'sm',
                    variant: 'ghost',
                    class: 'panel-toggle'
                });
                actionsDiv.appendChild(toggleButton);
            }
            
            // Add close button if requested
            if (options.closable) {
                const closeButton = UI.button({ 
                    icon: 'x',
                    size: 'sm',
                    variant: 'ghost',
                    class: 'panel-close'
                });
                closeButton.onclick = () => {
                    if (options.onclose) {
                        options.onclose();
                    }
                    panel.remove();
                };
                actionsDiv.appendChild(closeButton);
            }

            header.appendChild(titleDiv);
            header.appendChild(actionsDiv);

            // Body
            const body = document.createElement('div');
            body.className = 'panel-body';

            if (typeof content === 'string') {
                body.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                body.appendChild(content);
            }

            panel.appendChild(header);
            panel.appendChild(body);

            // Add collapse functionality
            if (options.collapsible && toggleButton) {
                toggleButton.onclick = () => {
                    panel.classList.toggle('panel-collapsed');
                };
            }

            // Initialize icons
            UI.deferIcons();

            return panel;
        },

        // --- Sections Management ---
        sections: {
            // This will be populated by individual section scripts, e.g., UI.sections.buttons = ...
            createAll(sectionData) {
                const container = document.getElementById('sections-container');
                if (!container) {
                    console.error('Sections container not found.');
                    return;
                }

                sectionData.forEach(group => {
                    const groupHeader = document.createElement('h1');
                    groupHeader.className = 'group-header';
                    groupHeader.textContent = group.name;
                    groupHeader.id = `group-${group.name.toLowerCase().replace(/\s+/g, '-')}`;
                    container.appendChild(groupHeader);

                    group.children.forEach(sectionName => {
                        if (UI.sections[sectionName] && typeof UI.sections[sectionName] === 'function') {
                            const sectionElement = UI.sections[sectionName]();
                            if (sectionElement) {
                                sectionElement.id = `section-${sectionName}`;
                                container.appendChild(sectionElement);
                            }
                        } else {
                            console.error(`UI.sections.${sectionName} is not defined or not a function.`);
                        }
                    });
                });
            }
        }
    };

    // Expose to window
    window.UI = UI;
    window.CONFIG = CONFIG;

    // Auto-initialize theme from localStorage
    const initTheme = () => {
        const savedTheme = localStorage.getItem('styleui-theme');
        if (savedTheme) {
            UI.theme.set(savedTheme);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            UI.theme.set(prefersDark ? 'dark' : 'light');
        }
    };
    
    // Initialize theme immediately and on DOM ready
    initTheme();
    document.addEventListener('DOMContentLoaded', initTheme);

})(); 