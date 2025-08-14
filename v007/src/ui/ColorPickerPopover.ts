import { VoxelType } from '../types';

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
        
        // Initialize with first color of default palette
        const defaultPalette = this.palettes.get(this.currentPalette);
        if (defaultPalette && defaultPalette.colors.length > 0) {
            this.selectedColor = defaultPalette.colors[0];
        }
    }
    
    async show(anchorElement: HTMLElement, onSelect: (color: ColorInfo) => void): Promise<void> {
        this.onSelectCallback = onSelect;
        
        // Hide any existing popover
        this.hide();
        
        // Create popover if it doesn't exist
        if (!this.element) {
            this.createElement();
        }
        
        // Clear existing content
        this.element!.innerHTML = '';
        
        // Create tabs container
        this.tabContainer = document.createElement('div');
        this.tabContainer.style.cssText = `
            display: flex;
            gap: 4px;
            margin-bottom: 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 8px;
        `;
        
        // Create tabs
        for (const [key, palette] of this.palettes) {
            const tab = document.createElement('button');
            tab.style.cssText = `
                padding: 4px 12px;
                background: ${key === this.currentPalette ? 'rgba(100, 200, 255, 0.2)' : 'transparent'};
                border: 1px solid ${key === this.currentPalette ? 'rgba(100, 200, 255, 0.5)' : 'transparent'};
                border-radius: 4px;
                color: ${key === this.currentPalette ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)'};
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
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
        const popoverWidth = 200; // Fixed width for color picker
        
        const rect = anchorElement.getBoundingClientRect();
        const buttonCenterX = rect.left + rect.width / 2;
        let left = buttonCenterX - popoverWidth / 2;
        let top = rect.top - popoverHeight - 20;
        
        // Keep within viewport
        if (left < 10) left = 10;
        if (left + popoverWidth > window.innerWidth - 10) {
            left = window.innerWidth - popoverWidth - 10;
        }
        
        if (top < 10) {
            top = rect.bottom + 10;
        }
        
        this.element!.style.left = `${left}px`;
        this.element!.style.top = `${top}px`;
        this.element!.style.width = `${popoverWidth}px`;
        this.element!.style.visibility = 'visible';
        
        // Position arrow
        const arrowX = buttonCenterX - left;
        const arrowElement = document.getElementById('color-popover-arrow');
        const arrowBorderElement = document.getElementById('color-popover-arrow-border');
        
        if (arrowElement) {
            arrowElement.style.left = `${arrowX}px`;
            arrowElement.style.transform = 'translateX(-50%)';
        }
        
        if (arrowBorderElement) {
            arrowBorderElement.style.left = `${arrowX}px`;
            arrowBorderElement.style.transform = 'translateX(-50%)';
        }
        
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
            padding: 16px;
            z-index: 1000;
            display: none;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        document.body.appendChild(this.element);
    }
    
    private createColorSwatch(color: ColorInfo): HTMLElement {
        const swatch = document.createElement('div');
        swatch.style.cssText = `
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
            border: 2px solid transparent;
            box-sizing: border-box;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        `;
        
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
            
            // Add checkmark
            const check = document.createElement('div');
            check.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: ${this.isLightColor(color.hex) ? '#000' : '#FFF'};
                font-size: 16px;
                font-weight: bold;
                text-shadow: 0 0 2px ${this.isLightColor(color.hex) ? '#FFF' : '#000'};
            `;
            check.textContent = '✓';
            swatch.appendChild(check);
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
            this.selectedColor = color;
            if (this.onSelectCallback) {
                this.onSelectCallback(color);
            }
            this.hide();
        });
        
        // Tooltip
        swatch.title = color.name;
        
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
        const isVoxelBrushButton = target.closest('#voxel-brush-button');
        
        if (this.element && !this.element.contains(target) && !isVoxelBrushButton) {
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
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            padding: 0;
        `;
        
        // Get current palette
        const currentPalette = this.palettes.get(this.currentPalette);
        if (!currentPalette) return;
        
        // Add color swatches
        for (const color of currentPalette.colors) {
            const swatch = this.createColorSwatch(color);
            grid.appendChild(swatch);
        }
        
        this.colorContainer.appendChild(grid);
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
                    tab.style.background = 'rgba(100, 200, 255, 0.2)';
                    tab.style.border = '1px solid rgba(100, 200, 255, 0.5)';
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
}