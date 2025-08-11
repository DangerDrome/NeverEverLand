import { VoxelType } from '../engine/VoxelEngine';
import { DrawingSystem } from '../interaction/DrawingSystem';
import { FileManager } from '../io/FileManager';

interface VoxelButtonInfo {
    type: VoxelType;
    name: string;
    icon: string;
    color: string;
}

export class VoxelPanel {
    private drawingSystem: DrawingSystem;
    private fileManager: FileManager | null = null;
    private voxelEngine: any | null = null;  // Reference to voxel engine for edge toggle
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
        
        // Add file operations section
        const separator3 = document.createElement('div');
        separator3.style.cssText = `
            width: 1px;
            height: 30px;
            background: rgba(255, 255, 255, 0.2);
            margin: 0 8px;
        `;
        this.element.appendChild(separator3);
        
        // Add file buttons
        this.createFileButtons();
        
        // Add another separator
        const separator4 = document.createElement('div');
        separator4.style.cssText = `
            width: 1px;
            height: 30px;
            background: rgba(255, 255, 255, 0.2);
            margin: 0 8px;
        `;
        this.element.appendChild(separator4);
        
        // Add view options buttons
        this.createViewButtons();
        
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
    
    private createViewButtons(): void {
        // Edge/Wireframe toggle button
        const edgeButton = document.createElement('button');
        edgeButton.id = 'edge-toggle-button';
        edgeButton.title = 'Toggle Wireframe (W)';
        edgeButton.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid transparent;
            border-radius: 6px;
            background: rgba(100, 100, 100, 0.2);
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `;
        
        const edgeIcon = document.createElement('span');
        edgeIcon.style.cssText = `
            color: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        edgeIcon.innerHTML = `<i data-lucide="grid-3x3" style="width: 20px; height: 20px; stroke-width: 2;"></i>`;
        edgeButton.appendChild(edgeIcon);
        
        edgeButton.addEventListener('click', () => {
            if (this.voxelEngine) {
                this.voxelEngine.toggleEdges();
                const isActive = this.voxelEngine.getShowEdges();
                
                if (isActive) {
                    edgeButton.style.background = 'rgba(100, 200, 100, 0.3)';
                    edgeButton.style.borderColor = 'rgba(100, 200, 100, 0.8)';
                    edgeIcon.style.color = 'rgba(100, 255, 100, 1)';
                } else {
                    edgeButton.style.background = 'rgba(100, 100, 100, 0.2)';
                    edgeButton.style.borderColor = 'transparent';
                    edgeIcon.style.color = 'rgba(255, 255, 255, 0.8)';
                }
                
                // Re-initialize Lucide icons
                if ((window as any).lucide) {
                    (window as any).lucide.createIcons();
                }
            }
        });
        
        edgeButton.addEventListener('mouseenter', () => {
            if (!this.voxelEngine?.getShowEdges()) {
                edgeButton.style.background = 'rgba(100, 100, 100, 0.3)';
                edgeButton.style.transform = 'scale(1.05)';
            }
        });
        
        edgeButton.addEventListener('mouseleave', () => {
            if (!this.voxelEngine?.getShowEdges()) {
                edgeButton.style.background = 'rgba(100, 100, 100, 0.2)';
                edgeButton.style.transform = 'scale(1)';
            }
        });
        
        this.element!.appendChild(edgeButton);
    }
    
    private createFileButtons(): void {
        // Import button
        const importButton = document.createElement('button');
        importButton.title = 'Import VOX/JSON';
        importButton.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid transparent;
            border-radius: 6px;
            background: rgba(50, 150, 50, 0.2);
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `;
        
        const importIcon = document.createElement('span');
        importIcon.style.cssText = `
            color: rgba(100, 255, 100, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        importIcon.innerHTML = `<i data-lucide="upload" style="width: 20px; height: 20px; stroke-width: 2;"></i>`;
        importButton.appendChild(importIcon);
        
        // Hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.vox,.json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', async (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0] && this.fileManager) {
                try {
                    await this.fileManager.importFile(target.files[0]);
                    console.log('File imported successfully');
                } catch (error) {
                    console.error('Import failed:', error);
                    alert(`Failed to import file: ${error}`);
                }
                target.value = ''; // Reset input
            }
        });
        document.body.appendChild(fileInput);
        
        importButton.addEventListener('click', () => {
            fileInput.click();
        });
        
        importButton.addEventListener('mouseenter', () => {
            importButton.style.background = 'rgba(50, 150, 50, 0.3)';
            importButton.style.transform = 'scale(1.05)';
        });
        
        importButton.addEventListener('mouseleave', () => {
            importButton.style.background = 'rgba(50, 150, 50, 0.2)';
            importButton.style.transform = 'scale(1)';
        });
        
        this.element!.appendChild(importButton);
        
        // Export VOX button
        const exportVoxButton = document.createElement('button');
        exportVoxButton.title = 'Export as VOX';
        exportVoxButton.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid transparent;
            border-radius: 6px;
            background: rgba(150, 50, 150, 0.2);
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `;
        
        const exportVoxIcon = document.createElement('span');
        exportVoxIcon.style.cssText = `
            color: rgba(255, 100, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        exportVoxIcon.innerHTML = `<i data-lucide="download" style="width: 20px; height: 20px; stroke-width: 2;"></i>`;
        exportVoxButton.appendChild(exportVoxIcon);
        
        exportVoxButton.addEventListener('click', async () => {
            if (this.fileManager) {
                try {
                    await this.fileManager.exportFile('vox');
                    console.log('VOX file exported successfully');
                } catch (error) {
                    console.error('Export failed:', error);
                    alert(`Failed to export VOX file: ${error}`);
                }
            }
        });
        
        exportVoxButton.addEventListener('mouseenter', () => {
            exportVoxButton.style.background = 'rgba(150, 50, 150, 0.3)';
            exportVoxButton.style.transform = 'scale(1.05)';
        });
        
        exportVoxButton.addEventListener('mouseleave', () => {
            exportVoxButton.style.background = 'rgba(150, 50, 150, 0.2)';
            exportVoxButton.style.transform = 'scale(1)';
        });
        
        this.element!.appendChild(exportVoxButton);
        
        // Export JSON button
        const exportJsonButton = document.createElement('button');
        exportJsonButton.title = 'Export as JSON';
        exportJsonButton.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid transparent;
            border-radius: 6px;
            background: rgba(50, 100, 150, 0.2);
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `;
        
        const exportJsonIcon = document.createElement('span');
        exportJsonIcon.style.cssText = `
            color: rgba(100, 200, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        exportJsonIcon.innerHTML = `<i data-lucide="file-json" style="width: 20px; height: 20px; stroke-width: 2;"></i>`;
        exportJsonButton.appendChild(exportJsonIcon);
        
        exportJsonButton.addEventListener('click', async () => {
            if (this.fileManager) {
                try {
                    await this.fileManager.exportFile('json');
                    console.log('JSON file exported successfully');
                } catch (error) {
                    console.error('Export failed:', error);
                    alert(`Failed to export JSON file: ${error}`);
                }
            }
        });
        
        exportJsonButton.addEventListener('mouseenter', () => {
            exportJsonButton.style.background = 'rgba(50, 100, 150, 0.3)';
            exportJsonButton.style.transform = 'scale(1.05)';
        });
        
        exportJsonButton.addEventListener('mouseleave', () => {
            exportJsonButton.style.background = 'rgba(50, 100, 150, 0.2)';
            exportJsonButton.style.transform = 'scale(1)';
        });
        
        this.element!.appendChild(exportJsonButton);
    }
    
    private createToolButtons(): void {
        const tools = [
            { id: 'brush', name: 'Brush', icon: 'brush', key: 'B' },
            { id: 'eraser', name: 'Eraser', icon: 'eraser', key: 'E' },
            { id: 'box', name: 'Box', icon: 'square', key: 'X' },
            { id: 'line', name: 'Line', icon: 'minus', key: 'L' },
            { id: 'fill', name: 'Fill', icon: 'paint-bucket', key: 'P' },
            { id: 'selection', name: 'Selection', icon: 'box-select', key: 'S' }
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
        
        // Map tool IDs to keyboard shortcuts
        const toolKeys: { [key: string]: string } = {
            'brush': 'b',
            'eraser': 'e', 
            'box': 'x',
            'line': 'l',
            'fill': 'p',
            'selection': 's'
        };
        
        // Dispatch the appropriate keyboard event
        // This ensures selection mode is properly exited when switching tools
        if (toolKeys[toolId]) {
            const event = new KeyboardEvent('keydown', { key: toolKeys[toolId] });
            window.dispatchEvent(event);
        }
        
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
    
    public setFileManager(fileManager: FileManager): void {
        this.fileManager = fileManager;
    }
    
    public setVoxelEngine(voxelEngine: any): void {
        this.voxelEngine = voxelEngine;
    }
    
    public dispose(): void {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        window.removeEventListener('keydown', (e) => this.handleKeyPress(e));
    }
}