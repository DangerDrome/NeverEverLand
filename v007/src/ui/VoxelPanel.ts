import { VoxelType } from '../engine/VoxelEngine';
import { DrawingSystem } from '../interaction/DrawingSystem';

interface VoxelButtonInfo {
    type: VoxelType;
    name: string;
    icon: string;
    color: string;
}

export class VoxelPanel {
    private drawingSystem: DrawingSystem;
    private element: HTMLElement | null = null;
    private voxelButtons: Map<VoxelType, HTMLElement> = new Map();
    private toolButtons: Map<string, HTMLElement> = new Map();
    private selectedType: VoxelType = VoxelType.GRASS;
    private selectedTool: string = 'brush';
    
    constructor(drawingSystem: DrawingSystem) {
        this.drawingSystem = drawingSystem;
        this.createPanel();
    }
    
    private createPanel(): void {
        // Create main panel container
        this.element = document.createElement('div');
        this.element.className = 'voxel-panel';
        this.element.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            padding: 12px;
            backdrop-filter: blur(10px);
            z-index: 100;
            display: flex;
            gap: 8px;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        // Add title
        const title = document.createElement('div');
        title.textContent = 'Voxels:';
        title.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            margin-right: 8px;
            font-weight: 500;
        `;
        this.element.appendChild(title);
        
        // Define voxel types with Lucide icons and colors
        const voxelTypes: VoxelButtonInfo[] = [
            { type: VoxelType.GRASS, name: 'Grass', icon: 'trees', color: '#90EE90' },
            { type: VoxelType.DIRT, name: 'Dirt', icon: 'mountain', color: '#8B6914' },
            { type: VoxelType.STONE, name: 'Stone', icon: 'gem', color: '#696969' },
            { type: VoxelType.WOOD, name: 'Wood', icon: 'tree-pine', color: '#DEB887' },
            { type: VoxelType.LEAVES, name: 'Leaves', icon: 'leaf', color: '#32CD32' },
            { type: VoxelType.WATER, name: 'Water', icon: 'droplets', color: '#00CED1' },
            { type: VoxelType.SAND, name: 'Sand', icon: 'waves', color: '#FFE4B5' },
            { type: VoxelType.SNOW, name: 'Snow', icon: 'snowflake', color: '#F0F8FF' },
            { type: VoxelType.ICE, name: 'Ice', icon: 'square', color: '#87CEEB' }
        ];
        
        // Create buttons for each voxel type
        voxelTypes.forEach((voxelInfo, index) => {
            const button = this.createVoxelButton(voxelInfo, index + 1);
            this.voxelButtons.set(voxelInfo.type, button);
            this.element!.appendChild(button);
        });
        
        // Add separator
        const separator = document.createElement('div');
        separator.style.cssText = `
            width: 1px;
            height: 30px;
            background: rgba(255, 255, 255, 0.2);
            margin: 0 8px;
        `;
        this.element.appendChild(separator);
        
        // Add title for tools
        const toolsTitle = document.createElement('div');
        toolsTitle.textContent = 'Tools:';
        toolsTitle.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            margin-right: 8px;
            font-weight: 500;
        `;
        this.element.appendChild(toolsTitle);
        
        // Add tool buttons
        this.createToolButtons();
        
        // Add another separator
        const separator2 = document.createElement('div');
        separator2.style.cssText = `
            width: 1px;
            height: 30px;
            background: rgba(255, 255, 255, 0.2);
            margin: 0 8px;
        `;
        this.element.appendChild(separator2);
        
        // Add brush size indicator
        const brushInfo = document.createElement('div');
        brushInfo.id = 'brush-info';
        brushInfo.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        brushInfo.innerHTML = `
            <span>Size:</span>
            <span id="brush-size-value" style="font-weight: bold; color: #fff;">1</span>
        `;
        this.element.appendChild(brushInfo);
        
        // Add to page
        document.body.appendChild(this.element);
        
        // Initialize Lucide icons
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
        
        // Select initial voxel type
        this.selectVoxelType(VoxelType.GRASS);
        
        // Listen for keyboard shortcuts
        window.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
    
    private createVoxelButton(info: VoxelButtonInfo, number: number): HTMLElement {
        const button = document.createElement('button');
        button.className = 'voxel-button';
        button.title = `${info.name} (${number})`;
        // Convert hex color to RGB for background with opacity
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        
        const rgb = hexToRgb(info.color);
        const bgColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)` : 'rgba(255, 255, 255, 0.1)';
        
        button.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid transparent;
            border-radius: 6px;
            background: ${bgColor};
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        `;
        
        // Add Lucide icon with matching color
        const iconSpan = document.createElement('span');
        iconSpan.style.cssText = `
            color: ${info.color};
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        iconSpan.innerHTML = `<i data-lucide="${info.icon}" style="width: 20px; height: 20px; stroke-width: 2;"></i>`;
        button.appendChild(iconSpan);
        
        // Add colored bottom indicator bar
        const colorIndicator = document.createElement('div');
        colorIndicator.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: ${info.color};
            opacity: 1;
        `;
        button.appendChild(colorIndicator);
        
        // Add number indicator
        const numberIndicator = document.createElement('div');
        numberIndicator.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            font-weight: bold;
        `;
        numberIndicator.textContent = number.toString();
        button.appendChild(numberIndicator);
        
        // Store original background color
        button.dataset.bgColor = bgColor;
        button.dataset.color = info.color;
        
        // Hover effect
        button.addEventListener('mouseenter', () => {
            if (!button.classList.contains('selected')) {
                // Make background slightly more opaque on hover
                const rgb = hexToRgb(info.color);
                if (rgb) {
                    button.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
                }
                button.style.transform = 'scale(1.05)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!button.classList.contains('selected')) {
                button.style.background = bgColor;
                button.style.transform = 'scale(1)';
            }
        });
        
        // Click handler
        button.addEventListener('click', () => {
            this.selectVoxelType(info.type);
        });
        
        return button;
    }
    
    private createToolButtons(): void {
        const tools = [
            { id: 'brush', name: 'Brush', icon: 'brush', key: 'B' },
            { id: 'box', name: 'Box', icon: 'square', key: 'X' },
            { id: 'line', name: 'Line', icon: 'minus', key: 'L' },
            { id: 'fill', name: 'Fill', icon: 'paint-bucket', key: 'P' }
        ];
        
        tools.forEach(tool => {
            const button = this.createToolButton(tool);
            this.toolButtons.set(tool.id, button);
            this.element!.appendChild(button);
        });
        
        // Select initial tool
        this.selectTool('brush');
    }
    
    private createToolButton(tool: { id: string; name: string; icon: string; key: string }): HTMLElement {
        const button = document.createElement('button');
        button.className = 'tool-button';
        button.title = `${tool.name} (${tool.key})`;
        
        button.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid transparent;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.1);
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        `;
        
        // Add Lucide icon
        const iconSpan = document.createElement('span');
        iconSpan.style.cssText = `
            color: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        iconSpan.innerHTML = `<i data-lucide="${tool.icon}" style="width: 20px; height: 20px; stroke-width: 2;"></i>`;
        button.appendChild(iconSpan);
        
        // Add keyboard shortcut indicator
        const keyIndicator = document.createElement('div');
        keyIndicator.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            font-weight: bold;
        `;
        keyIndicator.textContent = tool.key;
        button.appendChild(keyIndicator);
        
        // Hover effect
        button.addEventListener('mouseenter', () => {
            if (!button.classList.contains('selected')) {
                button.style.background = 'rgba(255, 255, 255, 0.15)';
                button.style.transform = 'scale(1.05)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!button.classList.contains('selected')) {
                button.style.background = 'rgba(255, 255, 255, 0.1)';
                button.style.transform = 'scale(1)';
            }
        });
        
        // Click handler
        button.addEventListener('click', () => {
            this.selectTool(tool.id);
        });
        
        return button;
    }
    
    private selectTool(toolId: string): void {
        this.selectedTool = toolId;
        this.drawingSystem.setToolMode(toolId);
        
        // Update button states
        this.toolButtons.forEach((button, id) => {
            if (id === toolId) {
                button.classList.add('selected');
                button.style.background = 'rgba(100, 100, 255, 0.3)';
                button.style.borderColor = 'rgba(100, 100, 255, 0.8)';
                button.style.transform = 'scale(1.1)';
                button.style.boxShadow = '0 0 10px rgba(100, 100, 255, 0.3)';
                
                // Update icon color
                const icon = button.querySelector('span');
                if (icon) {
                    icon.style.color = 'rgba(150, 150, 255, 1)';
                }
            } else {
                button.classList.remove('selected');
                button.style.background = 'rgba(255, 255, 255, 0.1)';
                button.style.borderColor = 'transparent';
                button.style.transform = 'scale(1)';
                button.style.boxShadow = 'none';
                
                // Reset icon color
                const icon = button.querySelector('span');
                if (icon) {
                    icon.style.color = 'rgba(255, 255, 255, 0.8)';
                }
            }
        });
        
        // Re-initialize Lucide icons
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
    }
    
    private selectVoxelType(type: VoxelType): void {
        this.selectedType = type;
        this.drawingSystem.setVoxelType(type);
        
        // Helper to convert hex to RGB
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        
        // Update button states
        this.voxelButtons.forEach((button, buttonType) => {
            const color = button.dataset.color || '#ffffff';
            const rgb = hexToRgb(color);
            
            if (buttonType === type) {
                button.classList.add('selected');
                // Make selected button more opaque and add colored border
                if (rgb) {
                    button.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
                    button.style.borderColor = color;  // Use the solid voxel color
                }
                button.style.transform = 'scale(1.1)';
                button.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.3)';
            } else {
                button.classList.remove('selected');
                // Return to original background color
                button.style.background = button.dataset.bgColor || 'rgba(255, 255, 255, 0.1)';
                button.style.borderColor = 'transparent';
                button.style.transform = 'scale(1)';
                button.style.boxShadow = 'none';
            }
        });
    }
    
    private handleKeyPress(event: KeyboardEvent): void {
        // Number keys 1-9 for voxel selection
        const key = parseInt(event.key);
        if (!isNaN(key) && key >= 1 && key <= 9) {
            const voxelTypes = Array.from(this.voxelButtons.keys());
            if (key - 1 < voxelTypes.length) {
                this.selectVoxelType(voxelTypes[key - 1]);
            }
        }
    }
    
    public updateBrushSize(size: number): void {
        const element = document.getElementById('brush-size-value');
        if (element) {
            element.textContent = size.toString();
        }
    }
    
    public updateToolMode(mode: string): void {
        // Update the internal selection
        this.selectTool(mode);
    }
    
    public dispose(): void {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        window.removeEventListener('keydown', (e) => this.handleKeyPress(e));
    }
}