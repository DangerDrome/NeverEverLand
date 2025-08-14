import { VoxelType } from '../types';

export interface ColorInfo {
    name: string;
    hex: string;
    voxelType?: VoxelType;
}

export class ColorPickerPopover {
    private element: HTMLElement | null = null;
    private onSelectCallback: ((color: ColorInfo) => void) | null = null;
    private selectedColor: ColorInfo | null = null;
    private colors: ColorInfo[] = [];
    
    constructor(colorPalette?: ColorInfo[]) {
        // Use provided color palette or default pastel colors
        // Map each color to a custom VoxelType
        if (colorPalette) {
            this.colors = colorPalette.map((color, index) => ({
                ...color,
                voxelType: (VoxelType.CUSTOM_1 + index) as VoxelType
            }));
        } else {
            // Default colors with VoxelType assignments
            this.colors = [
                // Row 1 - Neutrals
                { name: 'Pure White', hex: '#FFFFFF', voxelType: VoxelType.CUSTOM_1 },
                { name: 'Silver', hex: '#D4D4D4', voxelType: VoxelType.CUSTOM_2 },
                { name: 'Stone Gray', hex: '#9B9B9B', voxelType: VoxelType.CUSTOM_3 },
                { name: 'Charcoal', hex: '#4A4A4A', voxelType: VoxelType.CUSTOM_4 },
                
                // Row 2 - Warm colors
                { name: 'Rose Pink', hex: '#FF99CC', voxelType: VoxelType.CUSTOM_5 },
                { name: 'Peach', hex: '#FFAB91', voxelType: VoxelType.CUSTOM_6 },
                { name: 'Tangerine', hex: '#FFB366', voxelType: VoxelType.CUSTOM_7 },
                { name: 'Butter', hex: '#FFE082', voxelType: VoxelType.CUSTOM_8 },
                
                // Row 3 - Cool colors
                { name: 'Sky Blue', hex: '#90CAF9', voxelType: VoxelType.CUSTOM_9 },
                { name: 'Mint', hex: '#80CBC4', voxelType: VoxelType.CUSTOM_10 },
                { name: 'Lavender', hex: '#B39DDB', voxelType: VoxelType.CUSTOM_11 },
                { name: 'Aqua', hex: '#80DEEA', voxelType: VoxelType.CUSTOM_12 },
                
                // Row 4 - Nature colors
                { name: 'Sage', hex: '#A5D6A7', voxelType: VoxelType.CUSTOM_13 },
                { name: 'Sand', hex: '#BCAAA4', voxelType: VoxelType.CUSTOM_14 },
                { name: 'Terracotta', hex: '#CE9686', voxelType: VoxelType.CUSTOM_15 },
                { name: 'Ocean', hex: '#7986CB', voxelType: VoxelType.CUSTOM_16 }
            ];
        }
        
        // Initialize with first color as default
        this.selectedColor = this.colors[0];
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
        
        // Add title
        const title = document.createElement('div');
        title.style.cssText = `
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 12px;
            text-align: center;
        `;
        title.textContent = 'Voxel Colors';
        this.element!.appendChild(title);
        
        // Create color grid
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            padding: 0;
        `;
        
        // Add color swatches
        for (const color of this.colors) {
            const swatch = this.createColorSwatch(color);
            grid.appendChild(swatch);
        }
        
        this.element!.appendChild(grid);
        
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
}