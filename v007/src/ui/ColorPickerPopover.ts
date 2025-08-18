import { VoxelType } from '../types';
import { CustomColorPicker } from './CustomColorPicker';

export interface ColorInfo {
    name: string;
    hex: string;
    voxelType?: VoxelType;
}

export interface ColorPalette {
    name: string;
    colors: ColorInfo[];
}

export class ColorPickerPopover {
    private element: HTMLElement | null = null;
    private onSelectCallback: ((color: ColorInfo) => void) | null = null;
    private selectedColor: ColorInfo | null = null;
    private palettes: Map<string, ColorPalette> = new Map();
    private currentPalette: string = 'default';
    private tabContainer: HTMLElement | null = null;
    private colorContainer: HTMLElement | null = null;
    private isEditingColor: boolean = false;
    
    constructor(colorPalettes?: any) {
        // Initialize with provided palettes or default
        if (colorPalettes) {
            // Convert palettes object to Map and assign VoxelTypes
            Object.entries(colorPalettes).forEach(([key, palette]: [string, any]) => {
                this.palettes.set(key, {
                    name: palette.name,
                    colors: palette.colors.map((color: any) => ({
                        ...color
                        // VoxelTypes will be assigned dynamically by ColorRegistry
                    }))
                });
            });
        } else {
            // Default palette
            this.palettes.set('default', {
                name: 'Default',
                colors: [
                    // Row 1 - Grayscale
                    { name: 'Pure White', hex: '#FFFFFF' },
                    { name: 'Light Gray', hex: '#E0E0E0' },
                    { name: 'Medium Gray', hex: '#9E9E9E' },
                    { name: 'Dark Gray', hex: '#424242' },
                    
                    // Row 2 - Reds
                    { name: 'Light Red', hex: '#FFCDD2' },
                    { name: 'Soft Red', hex: '#EF9A9A' },
                    { name: 'Pure Red', hex: '#F44336' },
                    { name: 'Dark Red', hex: '#C62828' },
                    
                    // Row 3 - Greens
                    { name: 'Light Green', hex: '#C8E6C9' },
                    { name: 'Soft Green', hex: '#A5D6A7' },
                    { name: 'Pure Green', hex: '#4CAF50' },
                    { name: 'Dark Green', hex: '#2E7D32' },
                    
                    // Row 4 - Blues
                    { name: 'Light Blue', hex: '#BBDEFB' },
                    { name: 'Soft Blue', hex: '#90CAF9' },
                    { name: 'Pure Blue', hex: '#2196F3' },
                    { name: 'Dark Blue', hex: '#1565C0' }
                ]
            });
        }
        
        // Load saved user palette
        this.loadUserPalette();
        
        // Initialize with Soft Green color from default palette
        const defaultPalette = this.palettes.get(this.currentPalette);
        if (defaultPalette && defaultPalette.colors.length > 0) {
            // Find Soft Green (index 5) or fall back to first color
            const softGreenIndex = defaultPalette.colors.findIndex(c => c.name === 'Soft Green');
            this.selectedColor = defaultPalette.colors[softGreenIndex >= 0 ? softGreenIndex : 0];
        }
    }
    
    async show(anchorElement: HTMLElement, onSelect: (color: ColorInfo) => void, preferredDirection: 'left' | 'right' | 'auto' = 'auto'): Promise<void> {
        this.onSelectCallback = onSelect;
        
        // Remove any existing click listener first
        document.removeEventListener('click', this.handleClickOutside);
        
        // Create popover if it doesn't exist
        if (!this.element) {
            this.createElement();
        }
        
        // Check if element is in DOM
        if (!document.body.contains(this.element!)) {
            console.error('ColorPickerPopover element not in DOM!');
            document.body.appendChild(this.element!);
        }
        
        // Clear existing content
        this.element!.innerHTML = '';
        
        // Create tabs container
        this.tabContainer = document.createElement('div');
        this.tabContainer.style.cssText = `
            display: flex;
            gap: 6px;
            margin-bottom: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 10px;
            flex-wrap: wrap;
            justify-content: center;
        `;
        
        // Create tabs
        for (const [key, palette] of this.palettes) {
            const tab = document.createElement('button');
            tab.style.cssText = `
                padding: 5px 12px;
                background: ${key === this.currentPalette ? 'rgba(76, 175, 80, 0.2)' : 'transparent'};
                border: 1px solid ${key === this.currentPalette ? 'rgba(76, 175, 80, 0.5)' : 'transparent'};
                border-radius: 4px;
                color: ${key === this.currentPalette ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)'};
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            `;
            tab.textContent = palette.name;
            
            tab.addEventListener('mouseenter', () => {
                if (key !== this.currentPalette) {
                    tab.style.background = 'rgba(255, 255, 255, 0.1)';
                }
            });
            
            tab.addEventListener('mouseleave', () => {
                if (key !== this.currentPalette) {
                    tab.style.background = 'transparent';
                }
            });
            
            tab.addEventListener('click', () => {
                this.switchPalette(key);
            });
            
            this.tabContainer.appendChild(tab);
        }
        
        this.element!.appendChild(this.tabContainer);
        
        // Create color container
        this.colorContainer = document.createElement('div');
        this.element!.appendChild(this.colorContainer);
        
        // Display current palette
        this.displayPalette();
        
        // Create arrow
        const arrow = document.createElement('div');
        arrow.id = 'color-popover-arrow';
        arrow.style.cssText = `
            position: absolute;
            bottom: -10px;
            width: 0;
            height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 10px solid rgba(30, 30, 30, 0.95);
            z-index: 1001;
        `;
        this.element!.appendChild(arrow);
        
        // Add arrow border
        const arrowBorder = document.createElement('div');
        arrowBorder.id = 'color-popover-arrow-border';
        arrowBorder.style.cssText = `
            position: absolute;
            bottom: -11px;
            width: 0;
            height: 0;
            border-left: 11px solid transparent;
            border-right: 11px solid transparent;
            border-top: 11px solid rgba(255, 255, 255, 0.15);
            z-index: 1000;
        `;
        this.element!.appendChild(arrowBorder);
        
        // Position popover
        this.element!.style.display = 'block';
        this.element!.style.visibility = 'hidden';
        this.element!.style.left = '-9999px';
        
        
        const popoverHeight = this.element!.offsetHeight;
        const popoverWidth = 260; // Reduced width for 4 tabs
        
        const rect = anchorElement.getBoundingClientRect();
        let left: number;
        let top: number;
        
        // Center vertically with button
        top = rect.top + rect.height / 2 - popoverHeight / 2;
        
        // Determine horizontal position based on preferred direction
        if (preferredDirection === 'right' || (preferredDirection === 'auto' && rect.left < window.innerWidth / 2)) {
            // Position to the right of the button with larger gap
            left = rect.right + 40; // Increased to 40px gap
            
            // If it goes off screen, try left side
            if (left + popoverWidth > window.innerWidth - 10) {
                left = rect.left - popoverWidth - 40; // Increased to 40px gap
            }
        } else if (preferredDirection === 'left' || (preferredDirection === 'auto' && rect.left >= window.innerWidth / 2)) {
            // Position to the left of the button
            left = rect.left - popoverWidth - 40; // Increased to 40px gap
            
            // If it goes off screen, try right side
            if (left < 10) {
                left = rect.right + 40; // Increased to 40px gap
            }
        } else {
            // Default center positioning (original behavior)
            const buttonCenterX = rect.left + rect.width / 2;
            left = buttonCenterX - popoverWidth / 2;
        }
        
        // Keep within viewport bounds
        if (left < 10) left = 10;
        if (left + popoverWidth > window.innerWidth - 10) {
            left = window.innerWidth - popoverWidth - 10;
        }
        
        // Vertical positioning - if centered position goes off screen, position above or below
        if (top < 10) {
            top = rect.bottom + 10;
        } else if (top + popoverHeight > window.innerHeight - 10) {
            top = rect.top - popoverHeight - 10;
        }
        
        this.element!.style.left = `${left}px`;
        this.element!.style.top = `${top}px`;
        this.element!.style.width = `${popoverWidth}px`;
        this.element!.style.visibility = 'visible';
        
        
        // Position arrow for side positioning
        const arrowElement = document.getElementById('color-popover-arrow');
        const arrowBorderElement = document.getElementById('color-popover-arrow-border');
        
        if (arrowElement && arrowBorderElement) {
            const isRightPositioned = left > rect.right;
            const isLeftPositioned = left + popoverWidth < rect.left;
            
            if (isRightPositioned || isLeftPositioned) {
                // Show arrows for side positioning
                arrowElement.style.display = 'block';
                arrowBorderElement.style.display = 'block';
                
                // Reset styles first
                arrowElement.style.removeProperty('bottom');
                arrowElement.style.removeProperty('top');
                arrowElement.style.removeProperty('left');
                arrowElement.style.removeProperty('right');
                arrowElement.style.removeProperty('transform');
                arrowBorderElement.style.removeProperty('bottom');
                arrowBorderElement.style.removeProperty('top');
                arrowBorderElement.style.removeProperty('left');
                arrowBorderElement.style.removeProperty('right');
                arrowBorderElement.style.removeProperty('transform');
                
                // Calculate vertical position to align with button center
                const buttonCenterY = rect.top + rect.height / 2;
                const arrowY = buttonCenterY - top;
                
                if (isRightPositioned) {
                    // Arrow on left side of popover pointing left
                    arrowElement.style.cssText = `
                        position: absolute;
                        left: -10px;
                        top: ${arrowY}px;
                        transform: translateY(-50%);
                        width: 0;
                        height: 0;
                        border-top: 10px solid transparent;
                        border-bottom: 10px solid transparent;
                        border-right: 10px solid rgba(30, 30, 30, 0.95);
                        z-index: 1001;
                    `;
                    arrowBorderElement.style.cssText = `
                        position: absolute;
                        left: -11px;
                        top: ${arrowY}px;
                        transform: translateY(-50%);
                        width: 0;
                        height: 0;
                        border-top: 11px solid transparent;
                        border-bottom: 11px solid transparent;
                        border-right: 11px solid rgba(255, 255, 255, 0.15);
                        z-index: 1000;
                    `;
                } else {
                    // Arrow on right side of popover pointing right
                    arrowElement.style.cssText = `
                        position: absolute;
                        right: -10px;
                        top: ${arrowY}px;
                        transform: translateY(-50%);
                        width: 0;
                        height: 0;
                        border-top: 10px solid transparent;
                        border-bottom: 10px solid transparent;
                        border-left: 10px solid rgba(30, 30, 30, 0.95);
                        z-index: 1001;
                    `;
                    arrowBorderElement.style.cssText = `
                        position: absolute;
                        right: -11px;
                        top: ${arrowY}px;
                        transform: translateY(-50%);
                        width: 0;
                        height: 0;
                        border-top: 11px solid transparent;
                        border-bottom: 11px solid transparent;
                        border-left: 11px solid rgba(255, 255, 255, 0.15);
                        z-index: 1000;
                    `;
                }
            } else {
                // Show arrows for top/bottom positioning
                arrowElement.style.display = 'block';
                arrowBorderElement.style.display = 'block';
                
                // Reset to default bottom arrow styles
                arrowElement.style.cssText = `
                    position: absolute;
                    bottom: -10px;
                    width: 0;
                    height: 0;
                    border-left: 10px solid transparent;
                    border-right: 10px solid transparent;
                    border-top: 10px solid rgba(30, 30, 30, 0.95);
                    z-index: 1001;
                `;
                arrowBorderElement.style.cssText = `
                    position: absolute;
                    bottom: -11px;
                    width: 0;
                    height: 0;
                    border-left: 11px solid transparent;
                    border-right: 11px solid transparent;
                    border-top: 11px solid rgba(255, 255, 255, 0.15);
                    z-index: 1000;
                `;
                
                const buttonCenterX = rect.left + rect.width / 2;
                const arrowX = buttonCenterX - left;
                arrowElement.style.left = `${arrowX}px`;
                arrowElement.style.transform = 'translateX(-50%)';
                arrowBorderElement.style.left = `${arrowX}px`;
                arrowBorderElement.style.transform = 'translateX(-50%)';
            }
        }
        
        // Ensure popover is visible
        this.element!.style.display = 'block';
        this.element!.style.opacity = '1';
        
        // Add click outside listener
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
        
    }
    
    hide(): void {
        if (this.element) {
            this.element.style.display = 'none';
        }
        document.removeEventListener('click', this.handleClickOutside);
    }
    
    private createElement(): void {
        this.element = document.createElement('div');
        this.element.className = 'color-picker-popover';
        this.element.style.cssText = `
            position: fixed;
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            display: none;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        document.body.appendChild(this.element);
    }
    
    private createColorSwatch(color: ColorInfo, isEditable: boolean = false): HTMLElement {
        const swatch = document.createElement('div');
        swatch.style.cssText = `
            width: 42px;
            height: 42px;
            border-radius: 50%;
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
            border: 2px solid transparent;
            box-sizing: border-box;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        `;
        
        // Add class for styling if editable
        if (isEditable) {
            swatch.classList.add('user-color-swatch');
        }
        
        // Inner color div
        const colorDiv = document.createElement('div');
        colorDiv.style.cssText = `
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: ${color.hex};
        `;
        swatch.appendChild(colorDiv);
        
        // Selected indicator
        if (this.selectedColor?.hex === color.hex) {
            swatch.style.borderColor = 'rgba(255, 255, 255, 0.8)';
            swatch.style.transform = 'scale(1.1)';
            
            // Add X icon
            const iconContainer = document.createElement('div');
            iconContainer.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: ${this.isLightColor(color.hex) ? '#000' : '#FFF'};
                filter: drop-shadow(0 0 2px ${this.isLightColor(color.hex) ? '#FFF' : '#000'});
                pointer-events: none;
            `;
            
            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'x');
            icon.style.cssText = `
                width: 16px;
                height: 16px;
                stroke-width: 3;
                display: block;
            `;
            iconContainer.appendChild(icon);
            swatch.appendChild(iconContainer);
        }
        
        // Hover effect
        swatch.addEventListener('mouseenter', () => {
            if (this.selectedColor?.hex !== color.hex) {
                swatch.style.transform = 'scale(1.1)';
                swatch.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            }
        });
        
        swatch.addEventListener('mouseleave', () => {
            if (this.selectedColor?.hex !== color.hex) {
                swatch.style.transform = 'scale(1)';
                swatch.style.borderColor = 'transparent';
            }
        });
        
        // Click handler
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isEditable && e.shiftKey) {
                // Shift+click to delete color
                this.deleteColor(color);
            } else {
                this.selectedColor = color;
                if (this.onSelectCallback) {
                    this.onSelectCallback(color);
                }
                this.hide();
            }
        });
        
        // Right-click handler for editing (User palette only)
        if (isEditable) {
            swatch.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editColor(color, e);
            });
        }
        
        // Tooltip
        swatch.title = isEditable ? `${color.name}\nRight-click to edit\nShift+click to delete` : color.name;
        
        return swatch;
    }
    
    private isLightColor(hex: string): boolean {
        const rgb = parseInt(hex.slice(1), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        return luma > 186;
    }
    
    private handleClickOutside = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        const isColorPaletteButton = target.closest('#color-palette-button');
        const isCustomColorPicker = target.closest('.custom-color-picker');
        
        if (this.element && !this.element.contains(target) && !isColorPaletteButton && !isCustomColorPicker && !this.isEditingColor) {
            this.hide();
        }
    };
    
    getSelectedColor(): ColorInfo | null {
        return this.selectedColor;
    }
    
    setSelectedColor(color: ColorInfo): void {
        this.selectedColor = color;
    }
    
    private displayPalette(): void {
        if (!this.colorContainer) return;
        
        // Clear existing colors
        this.colorContainer.innerHTML = '';
        
        // Create color grid
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 42px);
            gap: 24px;
            padding: 0;
            justify-content: center;
        `;
        
        // Get current palette
        const currentPalette = this.palettes.get(this.currentPalette);
        if (!currentPalette) return;
        
        // Add color swatches
        for (const color of currentPalette.colors) {
            const swatch = this.createColorSwatch(color, this.currentPalette === 'user');
            grid.appendChild(swatch);
        }
        
        // Add + button for user palette
        if (this.currentPalette === 'user' && currentPalette.colors.length < 16) {
            const addButton = this.createAddButton();
            grid.appendChild(addButton);
        }
        
        this.colorContainer.appendChild(grid);
        
        // Initialize lucide icons for the X indicators
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
    }
    
    private switchPalette(paletteKey: string): void {
        if (this.currentPalette === paletteKey) return;
        
        this.currentPalette = paletteKey;
        
        // Update tab styles
        if (this.tabContainer) {
            const tabs = this.tabContainer.querySelectorAll('button');
            tabs.forEach((tab, index) => {
                const key = Array.from(this.palettes.keys())[index];
                if (key === paletteKey) {
                    tab.style.background = 'rgba(76, 175, 80, 0.2)';
                    tab.style.border = '1px solid rgba(76, 175, 80, 0.5)';
                    tab.style.color = 'rgba(255, 255, 255, 0.9)';
                } else {
                    tab.style.background = 'transparent';
                    tab.style.border = '1px solid transparent';
                    tab.style.color = 'rgba(255, 255, 255, 0.6)';
                }
            });
        }
        
        // Update displayed colors
        this.displayPalette();
        
        // DON'T update VoxelRenderer or AssetPreviewScene colors
        // This ensures existing voxels keep their original colors
    }
    
    private createAddButton(): HTMLElement {
        const addButton = document.createElement('div');
        addButton.style.cssText = `
            width: 42px;
            height: 42px;
            border-radius: 50%;
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
            border: 2px dashed rgba(255, 255, 255, 0.3);
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.6);
            font-size: 24px;
            font-weight: 300;
        `;
        
        addButton.innerHTML = '+';
        addButton.title = 'Add new color';
        
        // Hover effect
        addButton.addEventListener('mouseenter', () => {
            addButton.style.borderColor = 'rgba(255, 255, 255, 0.6)';
            addButton.style.color = 'rgba(255, 255, 255, 0.9)';
            addButton.style.transform = 'scale(1.1)';
        });
        
        addButton.addEventListener('mouseleave', () => {
            addButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            addButton.style.color = 'rgba(255, 255, 255, 0.6)';
            addButton.style.transform = 'scale(1)';
        });
        
        // Click handler
        addButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addNewColor();
        });
        
        return addButton;
    }
    
    private addNewColor(): void {
        const userPalette = this.palettes.get('user');
        if (!userPalette) return;
        
        // Generate a random color
        const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        const newColor: ColorInfo = {
            name: `Custom ${userPalette.colors.length + 1}`,
            hex: randomColor
        };
        
        // Get VoxelType for this new color
        const colorRegistry = (window as any).ColorRegistry?.getInstance();
        if (colorRegistry) {
            const voxelType = colorRegistry.getOrCreateVoxelType(randomColor);
            if (voxelType) {
                newColor.voxelType = voxelType;
            }
        }
        
        // Add to palette
        userPalette.colors.push(newColor);
        
        // Refresh display
        this.displayPalette();
        
        // Save to localStorage
        this.saveUserPalette();
    }
    
    private editColor(color: ColorInfo, event?: MouseEvent): void {
        if (!event || !(event.target instanceof HTMLElement)) return;
        
        this.isEditingColor = true;
        const picker = new CustomColorPicker(color.hex);
        
        picker.show(event.target, (newColor) => {
            // Store the old VoxelType before changing the color
            const oldVoxelType = color.voxelType;
            color.hex = newColor;
            
            // Keep the same VoxelType when editing
            if (oldVoxelType !== undefined) {
                color.voxelType = oldVoxelType;
                
                // Update the ColorRegistry with the new color for this VoxelType
                const colorRegistry = (window as any).ColorRegistry?.getInstance();
                if (colorRegistry) {
                    colorRegistry.updateVoxelTypeColor(oldVoxelType, newColor);
                    
                    // Trigger voxel engine update to re-render with new colors
                    const app = (window as any).app;
                    if (app && app.getVoxelEngine()) {
                        app.getVoxelEngine().updateInstances();
                    }
                }
            }
            
            // If this is the currently selected color, update it and notify
            if (this.selectedColor === color && this.onSelectCallback) {
                this.onSelectCallback(color);
            }
            
            // Refresh display
            this.displayPalette();
            
            // Save to localStorage
            this.saveUserPalette();
        });
        
        // Add a listener to know when the picker is closed
        const checkPickerClosed = setInterval(() => {
            const pickerElement = document.querySelector('.custom-color-picker');
            if (!pickerElement) {
                this.isEditingColor = false;
                clearInterval(checkPickerClosed);
            }
        }, 100);
    }
    
    private deleteColor(color: ColorInfo): void {
        const userPalette = this.palettes.get('user');
        if (!userPalette) return;
        
        // Don't allow deleting the last color
        if (userPalette.colors.length <= 1) {
            alert('Cannot delete the last color. The User palette must have at least one color.');
            return;
        }
        
        // Check if we're deleting the currently selected color
        const isDeletingSelected = this.selectedColor === color;
        
        // Find and remove the color
        const index = userPalette.colors.findIndex(c => c === color);
        if (index !== -1) {
            userPalette.colors.splice(index, 1);
            
            // Rename remaining colors to maintain sequential numbering
            userPalette.colors.forEach((c, i) => {
                if (c.name.startsWith('Custom ')) {
                    c.name = `Custom ${i + 1}`;
                }
            });
            
            // If we deleted the selected color, select the first available color
            if (isDeletingSelected && userPalette.colors.length > 0) {
                this.selectedColor = userPalette.colors[0];
                if (this.onSelectCallback) {
                    this.onSelectCallback(this.selectedColor);
                }
            }
            
            // Refresh display
            this.displayPalette();
            
            // Save to localStorage
            this.saveUserPalette();
        }
    }
    
    private saveUserPalette(): void {
        const userPalette = this.palettes.get('user');
        if (userPalette) {
            // Save colors with their VoxelTypes
            const colorsToSave = userPalette.colors.map(color => ({
                name: color.name,
                hex: color.hex,
                voxelType: color.voxelType
            }));
            localStorage.setItem('userColorPalette', JSON.stringify(colorsToSave));
        }
    }
    
    private loadUserPalette(): void {
        const saved = localStorage.getItem('userColorPalette');
        if (saved) {
            try {
                const colors = JSON.parse(saved);
                const userPalette = this.palettes.get('user');
                if (userPalette) {
                    // Load colors and re-establish VoxelTypes
                    userPalette.colors = colors.map((color: any) => {
                        const colorInfo: ColorInfo = {
                            name: color.name,
                            hex: color.hex
                        };
                        
                        // If the color had a VoxelType saved, try to get or recreate it
                        if (color.voxelType !== undefined) {
                            const colorRegistry = (window as any).ColorRegistry?.getInstance();
                            if (colorRegistry) {
                                // Try to get existing VoxelType for this color
                                let voxelType = colorRegistry.getVoxelType(color.hex);
                                if (!voxelType) {
                                    // If not found, create a new one
                                    voxelType = colorRegistry.getOrCreateVoxelType(color.hex);
                                }
                                if (voxelType) {
                                    colorInfo.voxelType = voxelType;
                                }
                            }
                        }
                        
                        return colorInfo;
                    });
                }
            } catch (e) {
                console.error('Failed to load user palette:', e);
            }
        }
    }
}