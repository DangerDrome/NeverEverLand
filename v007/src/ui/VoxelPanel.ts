import { VoxelType } from '../engine/VoxelEngine';
import { DrawingSystem } from '../interaction/DrawingSystem';
import { FileManager } from '../io/FileManager';
import { StaticAssetManager } from '../assets/StaticAssetManager';
import { AssetPopover } from './AssetPopover';
import { AssetInfo } from '../assets/types';
import { ModalDialog } from './ModalDialog';
import { ColorPickerPopover, ColorInfo } from './ColorPickerPopover';
import { ColorRegistry } from '../engine/ColorRegistry';
import { settings } from '../main';
import { ToolsPanel } from './ToolsPanel';

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
    // Tool buttons moved to ToolsPanel
    // private toolButtons: Map<string, HTMLElement> = new Map();
    private selectedType: VoxelType = VoxelType.GRASS;
    private selectedColor: ColorInfo | null = null;
    private selectedTool: string = 'brush';
    private assetManager: StaticAssetManager;
    private assetPopover: AssetPopover;
    private colorPickerPopover: ColorPickerPopover;
    private voxelTypes: VoxelButtonInfo[] = [];
    private toolsPanel: ToolsPanel | null = null;  // Reference to ToolsPanel for clearing selections
    
    constructor(drawingSystem: DrawingSystem, colorPalette?: ColorInfo[]) {
        this.drawingSystem = drawingSystem;
        this.assetManager = new StaticAssetManager();
        this.assetPopover = new AssetPopover(this.assetManager);
        this.colorPickerPopover = new ColorPickerPopover(settings.colorPalettes);
        
        // Register this panel with the drawing system
        this.drawingSystem.setVoxelPanel(this);
        
        this.createPanel();
    }
    
    private createPanel(): void {
        // Create main panel container
        this.element = document.createElement('div');
        this.element.className = 'voxel-panel';
        this.element.style.cssText = `
            position: fixed;
            bottom: 40px;
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
        this.voxelTypes = [
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
        this.voxelTypes.forEach((voxelInfo, index) => {
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
        
        // Tools section removed - moved to ToolsPanel on the left
        
        // Add separator
        const separator2 = document.createElement('div');
        separator2.style.cssText = `
            width: 1px;
            height: 30px;
            background: rgba(255, 255, 255, 0.2);
            margin: 0 8px;
        `;
        this.element.appendChild(separator2);
        
        // Add title
        const brushTitle = document.createElement('div');
        brushTitle.textContent = 'Brush:';
        brushTitle.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            margin-right: 8px;
            font-weight: 500;
        `;
        this.element.appendChild(brushTitle);
        
        // Add brush size toggle button
        const brushButton = document.createElement('button');
        brushButton.id = 'brush-size-toggle';
        brushButton.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid transparent;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.1);
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 20px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            color: rgba(255, 255, 255, 0.8);
        `;
        brushButton.title = 'Brush Size (Click to cycle or use [ ])';
        brushButton.innerHTML = '<span id="brush-size-value">1</span>';
        this.element.appendChild(brushButton);
        
        // Voxels are fixed at 0.1m size, no controls needed
        
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
        
        // Initialize with the first voxel type and update header color
        if (this.voxelTypes.length > 0) {
            this.selectVoxelType(this.voxelTypes[0].type);
        }
        
        // Initialize Lucide icons
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
        
        // Don't select any voxel type initially - voxel brush button is selected by default
        
        // Listen for keyboard shortcuts
        window.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
    
    private createVoxelButton(info: VoxelButtonInfo, number: number): HTMLElement {
        const button = document.createElement('button');
        button.className = 'voxel-button';
        button.title = `${info.name} (${number}) - Click for assets, Shift+Click for single voxel`;
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
        
        // Simple click handler - shows asset popover unless Shift is held
        button.addEventListener('click', async (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Always highlight the button first
            this.selectVoxelType(info.type);
            
            // If Shift is held, stay in single voxel painting mode
            if (e.shiftKey) {
                // Clear any asset selection
                if (this.drawingSystem.selectedAsset) {
                    this.drawingSystem.setSelectedAsset(null);
                }
                console.log(`Selected ${info.name} for voxel painting (Shift+Click)`);
                return;
            }
            
            // Otherwise show asset popover
            try {
                await this.assetPopover.show(
                    button, 
                    info.type, 
                    (asset) => {
                        // When an asset is selected
                        this.onAssetSelected(asset);
                    },
                    (asset) => {
                        // When an asset is edited
                        this.onAssetEdit(asset);
                    },
                    (asset) => {
                        // When an asset is deleted
                        this.onAssetDelete(asset);
                    }
                );
            } catch (error) {
                // If no assets available or popover cancelled, stay in single voxel mode
                // Clear any asset selection to ensure we're in voxel painting mode
                if (this.drawingSystem.selectedAsset) {
                    this.drawingSystem.setSelectedAsset(null);
                }
                console.log(`No assets for ${info.name}, using single voxel painting:`, (error as Error).message);
            }
        });
        
        // Right-click also shows popover (alternative method)
        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Trigger same as left click
            button.click();
        });
        
        return button;
    }
    
    private createVoxelBrushButton(): HTMLElement {
        const button = document.createElement('button');
        button.id = 'voxel-brush-button';
        button.className = 'voxel-brush-button'; // Not selected by default
        button.title = 'Single Voxel Brush (V)';
        
        button.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid transparent;
            border-radius: 6px;
            background: transparent;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            margin-right: 4px;
        `;
        
        // Add Lucide cube icon
        const iconSpan = document.createElement('span');
        // Get the first color from the color picker (Pure White)
        const firstColor = this.colorPickerPopover.getSelectedColor();
        iconSpan.style.cssText = `
            color: ${firstColor ? firstColor.hex : '#FFFFFF'};
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s ease;
        `;
        iconSpan.innerHTML = `<i data-lucide="box" style="width: 20px; height: 20px; stroke-width: 2;"></i>`;
        button.appendChild(iconSpan);
        
        // Initialize selected color to first color
        if (firstColor) {
            this.selectedColor = firstColor;
        }
        
        // Hover effect
        button.addEventListener('mouseenter', () => {
            if (!button.classList.contains('selected')) {
                button.style.background = 'rgba(255, 255, 255, 0.1)';
                button.style.transform = 'scale(1.05)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!button.classList.contains('selected')) {
                button.style.background = 'transparent';
                button.style.transform = 'scale(1)';
            }
        });
        
        // Click handler - show color picker popover
        button.addEventListener('click', async () => {
            // If already selected, show color picker
            if (button.classList.contains('selected')) {
                await this.colorPickerPopover.show(button, (color) => {
                    this.selectedColor = color;
                    this.updateVoxelBrushButtonWithColor(color);
                    this.updateHeaderIconColor();
                    
                    // Get or create a VoxelType for this color
                    const colorRegistry = ColorRegistry.getInstance();
                    const voxelType = colorRegistry.getOrCreateVoxelType(color.hex);
                    
                    if (voxelType) {
                        // Store the voxelType in the color object for later use
                        color.voxelType = voxelType;
                        console.log(`Selected color: ${color.name} (${color.hex}) -> VoxelType ${voxelType}`);
                    } else {
                        console.error('Failed to get VoxelType for color');
                    }
                });
                return;
            }
            
            // Clear any asset selection and ensure we're in brush mode
            this.drawingSystem.setSelectedAsset(null);
            this.drawingSystem.setToolMode('brush');
            
            // Tool selection handled by ToolsPanel now
            
            // Remove selected class from all voxel type buttons and restore their original colors
            this.voxelButtons.forEach((btn, type) => {
                btn.classList.remove('selected');
                btn.style.borderColor = 'transparent';
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = 'none';
                // Restore original background color
                btn.style.background = btn.dataset.bgColor || 'rgba(255, 255, 255, 0.1)';
            });
            
            // Mark this button as selected
            button.classList.add('selected');
            button.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            button.style.background = 'rgba(255, 255, 255, 0.1)';
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = 'none';
            
            // Visual feedback
            button.style.animation = 'pulse 0.3s ease-out';
            
            // Set the voxel type to the custom color's type
            if (this.selectedColor && this.selectedColor.voxelType !== undefined) {
                this.drawingSystem.setVoxelType(this.selectedColor.voxelType);
            }
            
            console.log('Single voxel brush mode activated');
            
            // Show color picker automatically on first click
            await this.colorPickerPopover.show(button, (color) => {
                this.selectedColor = color;
                this.updateVoxelBrushButtonWithColor(color);
                this.updateHeaderIconColor();
                
                // Get or create a VoxelType for this color
                const colorRegistry = ColorRegistry.getInstance();
                const voxelType = colorRegistry.getOrCreateVoxelType(color.hex);
                
                if (voxelType) {
                    // Store the voxelType in the color object
                    color.voxelType = voxelType;
                    // Update the drawing system
                    this.drawingSystem.setVoxelType(voxelType);
                    console.log(`Selected color: ${color.name} (${color.hex}) -> VoxelType ${voxelType}`);
                } else {
                    console.error('Failed to get VoxelType for color');
                }
            });
        });
        
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1.1); }
                50% { transform: scale(1.15); }
                100% { transform: scale(1.1); }
            }
        `;
        document.head.appendChild(style);
        
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
        edgeIcon.innerHTML = `<i data-lucide="box" style="width: 20px; height: 20px; stroke-width: 2;"></i>`;
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
        
        // Tilt-shift toggle button
        const tiltShiftButton = document.createElement('button');
        tiltShiftButton.id = 'tiltshift-toggle-button';
        tiltShiftButton.title = 'Toggle Tilt-Shift (T)';
        tiltShiftButton.style.cssText = `
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
            margin-left: 5px;
        `;
        
        const tiltShiftIcon = document.createElement('span');
        tiltShiftIcon.style.cssText = `
            color: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        tiltShiftIcon.innerHTML = `<i data-lucide="aperture" style="width: 20px; height: 20px; stroke-width: 2;"></i>`;
        tiltShiftButton.appendChild(tiltShiftIcon);
        
        tiltShiftButton.addEventListener('click', () => {
            // Dispatch custom event to toggle tilt-shift
            window.dispatchEvent(new CustomEvent('toggle-tiltshift'));
        });
        
        tiltShiftButton.addEventListener('mouseenter', () => {
            const isActive = (window as any).app?.tiltShiftPass?.enabled;
            if (!isActive) {
                tiltShiftButton.style.background = 'rgba(100, 100, 100, 0.3)';
                tiltShiftButton.style.transform = 'scale(1.05)';
            }
        });
        
        tiltShiftButton.addEventListener('mouseleave', () => {
            const isActive = (window as any).app?.tiltShiftPass?.enabled;
            if (!isActive) {
                tiltShiftButton.style.background = 'rgba(100, 100, 100, 0.2)';
                tiltShiftButton.style.transform = 'scale(1)';
            }
        });
        
        this.element!.appendChild(tiltShiftButton);
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
    
    /* Tool buttons moved to ToolsPanel
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
    
    */
    
    /* Tool selection moved to ToolsPanel
    private selectTool(toolId: string, fromKeyboard: boolean = false): void {
        this.selectedTool = toolId;
        
        // Only dispatch keyboard event if NOT called from keyboard (to avoid infinite loop)
        if (!fromKeyboard) {
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
    */
    
    private selectVoxelType(type: VoxelType): void {
        this.selectedType = type;
        this.drawingSystem.setVoxelType(type);
        
        // Update voxel brush button color
        this.updateVoxelBrushButtonColor();
        
        // Deselect voxel brush button when selecting a voxel type
        const voxelBrushButton = document.getElementById('voxel-brush-button');
        if (voxelBrushButton) {
            voxelBrushButton.classList.remove('selected');
            voxelBrushButton.style.borderColor = 'transparent';
            voxelBrushButton.style.background = 'transparent';
            voxelBrushButton.style.transform = 'scale(1)';
            voxelBrushButton.style.boxShadow = 'none';
        }
        
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
        // V key for voxel brush mode
        if (event.key === 'v' || event.key === 'V') {
            const voxelBrushButton = document.getElementById('voxel-brush-button');
            if (voxelBrushButton) {
                voxelBrushButton.click();
            }
            return;
        }
        
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
            // Show just the number
            element.textContent = size.toString();
        }
        
        // Update toggle button hover effect and active state
        const toggleBtn = document.getElementById('brush-size-toggle') as HTMLButtonElement;
        if (toggleBtn) {
            // Update title to show full size info
            toggleBtn.title = `Brush Size: ${size}×${size}×${size} (Click to cycle or use [ ])`;
            
            // Add hover listener if not already added
            if (!toggleBtn.dataset.listenerAdded) {
                toggleBtn.addEventListener('mouseenter', () => {
                    if (!toggleBtn.classList.contains('active')) {
                        toggleBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                        toggleBtn.style.transform = 'scale(1.05)';
                    }
                });
                
                toggleBtn.addEventListener('mouseleave', () => {
                    if (!toggleBtn.classList.contains('active')) {
                        toggleBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                        toggleBtn.style.transform = 'scale(1)';
                    }
                });
                
                toggleBtn.addEventListener('mousedown', () => {
                    toggleBtn.style.transform = 'scale(0.95)';
                });
                
                toggleBtn.addEventListener('mouseup', () => {
                    toggleBtn.style.transform = 'scale(1.05)';
                });
                
                toggleBtn.dataset.listenerAdded = 'true';
            }
        }
    }
    
    public updateToolMode(mode: string): void {
        // Tool mode updates now handled by ToolsPanel
    }
    
    public setFileManager(fileManager: FileManager): void {
        this.fileManager = fileManager;
    }
    
    public setVoxelEngine(voxelEngine: any): void {
        this.voxelEngine = voxelEngine;
    }
    
    public setToolsPanel(toolsPanel: ToolsPanel): void {
        this.toolsPanel = toolsPanel;
    }
    
    private onAssetSelected(asset: AssetInfo): void {
        // Clear any active tool selection in ToolsPanel when an asset is selected
        if (this.toolsPanel) {
            this.toolsPanel.clearActiveSelection();
        }
        
        // Set the drawing system to asset mode
        this.drawingSystem.setSelectedAsset(asset);
        
        // Visual feedback - highlight the panel
        if (this.element) {
            this.element.style.borderColor = 'rgba(100, 200, 100, 0.5)';
            setTimeout(() => {
                if (this.element) {
                    this.element.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }
            }, 300);
        }
        
        console.log(`Selected asset: ${asset.name} (${asset.id})`);
    }
    
    private async onAssetEdit(asset: AssetInfo): Promise<void> {
        if (!this.voxelEngine) {
            console.error('VoxelEngine not set');
            return;
        }
        
        try {
            // Load the asset data
            const assetData = await this.assetManager.loadAsset(asset.id);
            if (!assetData || !assetData.voxelData) {
                console.error('Failed to load asset data');
                return;
            }
            
            // Create a new layer for editing
            const layer = this.voxelEngine.createLayer(`Edit: ${asset.name}`);
            
            // Mark it as an asset editing layer
            layer.isEditingAsset = true;
            layer.editingAssetId = asset.id;
            layer.editingAssetType = asset.type;
            
            // Load the asset voxels into the layer
            for (const [posKey, voxelType] of assetData.voxelData) {
                layer.setVoxel(posKey, voxelType);
            }
            
            // Set the new layer as active
            this.voxelEngine.setActiveLayer(layer.id);
            
            // Update the voxel engine rendering
            this.voxelEngine.updateInstances();
            
            // Refresh the layer panel to show the new layer
            if ((window as any).app?.layerPanel) {
                (window as any).app.layerPanel.refresh();
            }
            
            console.log(`Created edit layer for asset: ${asset.name}`);
        } catch (error) {
            console.error('Failed to create edit layer for asset:', error);
        }
    }
    
    public getAssetManager(): StaticAssetManager {
        return this.assetManager;
    }
    
    public getAssetPopover(): AssetPopover {
        return this.assetPopover;
    }
    
    public getColorPickerPopover(): ColorPickerPopover {
        return this.colorPickerPopover;
    }
    
    public getSelectedColorOrType(): { type: VoxelType; isCustomColor: boolean } {
        // If in single voxel mode with a custom color selected
        if (this.isInSingleVoxelMode() && this.selectedColor) {
            // Use the VoxelType directly from the selected color
            if (this.selectedColor.voxelType !== undefined) {
                return { type: this.selectedColor.voxelType, isCustomColor: true };
            }
            // Fallback to closest type if no voxelType is set
            const closestType = this.findClosestVoxelType(this.selectedColor.hex);
            return { type: closestType, isCustomColor: true };
        }
        
        // Otherwise return the selected voxel type
        return { type: this.selectedType, isCustomColor: false };
    }
    
    private findClosestVoxelType(hexColor: string): VoxelType {
        // Convert hex to RGB
        const targetRgb = this.hexToRgb(hexColor);
        if (!targetRgb) return VoxelType.STONE; // Default fallback
        
        // Define voxel type colors (matching VoxelRenderer.ts)
        const voxelColors: { type: VoxelType; rgb: { r: number; g: number; b: number } }[] = [
            { type: VoxelType.GRASS, rgb: { r: 144, g: 238, b: 144 } },
            { type: VoxelType.DIRT, rgb: { r: 139, g: 105, b: 20 } },
            { type: VoxelType.STONE, rgb: { r: 105, g: 105, b: 105 } },
            { type: VoxelType.WOOD, rgb: { r: 222, g: 184, b: 135 } },
            { type: VoxelType.LEAVES, rgb: { r: 50, g: 205, b: 50 } },
            { type: VoxelType.WATER, rgb: { r: 135, g: 206, b: 235 } },
            { type: VoxelType.SAND, rgb: { r: 255, g: 228, b: 181 } },
            { type: VoxelType.SNOW, rgb: { r: 240, g: 248, b: 255 } },
            { type: VoxelType.ICE, rgb: { r: 135, g: 206, b: 235 } }
        ];
        
        // Find closest color using color distance
        let closestType = VoxelType.STONE;
        let minDistance = Infinity;
        
        for (const voxelColor of voxelColors) {
            const distance = Math.sqrt(
                Math.pow(targetRgb.r - voxelColor.rgb.r, 2) +
                Math.pow(targetRgb.g - voxelColor.rgb.g, 2) +
                Math.pow(targetRgb.b - voxelColor.rgb.b, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestType = voxelColor.type;
            }
        }
        
        return closestType;
    }
    
    private async onAssetDelete(asset: AssetInfo): Promise<void> {
        try {
            // Delete the asset
            await this.assetManager.deleteAsset(asset.id);
            console.log(`Deleted asset: ${asset.name} (${asset.id})`);
            
            // Clear preview cache for this asset
            this.assetPopover.clearPreviewCache(asset.id);
            
            // If the deleted asset was selected, clear selection
            if (this.drawingSystem.selectedAsset?.id === asset.id) {
                this.drawingSystem.setSelectedAsset(null);
                this.drawingSystem.setToolMode('brush');
            }
        } catch (error) {
            console.error('Failed to delete asset:', error);
            await ModalDialog.alert({
                title: 'Delete Failed',
                message: `Failed to delete asset: ${error}`,
                type: 'error'
            });
        }
    }
    
    public isInSingleVoxelMode(): boolean {
        // Check if the voxel brush button is selected
        const voxelBrushButton = document.getElementById('voxel-brush-button');
        return voxelBrushButton ? voxelBrushButton.classList.contains('selected') : false;
    }
    
    private updateVoxelBrushButtonColor(): void {
        const voxelBrushButton = document.getElementById('voxel-brush-button');
        if (voxelBrushButton) {
            const iconSpan = voxelBrushButton.querySelector('span');
            if (iconSpan) {
                // If we have a selected color, use that; otherwise use voxel type color
                if (this.selectedColor) {
                    iconSpan.style.color = this.selectedColor.hex;
                } else {
                    const typeInfo = this.voxelTypes.find(t => t.type === this.selectedType);
                    if (typeInfo) {
                        iconSpan.style.color = typeInfo.color;
                    }
                }
            }
        }
        
        // Also update the header swords icon
        this.updateHeaderIconColor();
    }
    
    private updateHeaderIconColor(): void {
        const menuLogo = document.querySelector('.menu-logo svg') as SVGElement;
        if (menuLogo) {
            // If we have a selected color, use that; otherwise use voxel type color
            if (this.selectedColor) {
                menuLogo.style.color = this.selectedColor.hex;
            } else {
                const typeInfo = this.voxelTypes.find(t => t.type === this.selectedType);
                if (typeInfo) {
                    menuLogo.style.color = typeInfo.color;
                }
            }
        }
    }
    
    private updateVoxelBrushButtonWithColor(color: ColorInfo): void {
        const voxelBrushButton = document.getElementById('voxel-brush-button');
        if (voxelBrushButton) {
            const iconSpan = voxelBrushButton.querySelector('span');
            if (iconSpan) {
                iconSpan.style.color = color.hex;
            }
            
            // Update the button background to match the selected color slightly
            const rgb = this.hexToRgb(color.hex);
            if (rgb) {
                voxelBrushButton.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
                voxelBrushButton.style.borderColor = color.hex;
            }
        }
    }
    
    private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    public dispose(): void {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Dispose asset-related objects
        this.assetPopover.dispose();
        
        window.removeEventListener('keydown', (e) => this.handleKeyPress(e));
    }
}