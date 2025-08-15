import { DrawingSystem } from '../interaction/DrawingSystem';
import { VoxelEngine } from '../engine/VoxelEngine';
import { ActionLogger } from './ActionLogger';
import { ColorPickerPopover, ColorInfo } from './ColorPickerPopover';
import { ColorRegistry } from '../engine/ColorRegistry';

/**
 * Tools panel - Photoshop-style vertical tool palette on the left side
 */
export class ToolsPanel {
    private element: HTMLElement | null = null;
    private toolsContainer: HTMLElement | null = null;
    private drawingSystem: DrawingSystem | null = null;
    private voxelEngine: VoxelEngine | null = null;
    private activeToolButton: HTMLElement | null = null;
    private colorPickerPopover: ColorPickerPopover;
    private selectedColor: ColorInfo | null = null;
    
    constructor() {
        this.colorPickerPopover = new ColorPickerPopover();
        this.create();
    }
    
    setDrawingSystem(drawingSystem: DrawingSystem): void {
        this.drawingSystem = drawingSystem;
    }
    
    setVoxelEngine(voxelEngine: VoxelEngine): void {
        this.voxelEngine = voxelEngine;
    }
    
    private create(): void {
        // Create panel container
        this.element = document.createElement('div');
        this.element.className = 'tools-panel';
        this.element.style.cssText = `
            position: absolute;
            left: 30px;
            top: 60px;
            width: 84px;
            background: rgba(40, 40, 40, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
            user-select: none;
            z-index: 100;
            overflow: hidden;
        `;
        
        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 12px 16px;
            background: rgba(30, 30, 30, 0.8);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.5px;
            user-select: none;
        `;
        
        // Add icon to header
        const headerIcon = document.createElement('span');
        headerIcon.setAttribute('data-lucide', 'wrench');
        headerIcon.style.cssText = `
            width: 16px;
            height: 16px;
            color: rgba(255, 255, 255, 0.6);
            flex-shrink: 0;
        `;
        header.appendChild(headerIcon);
        
        // Add text to header
        const headerText = document.createElement('span');
        headerText.textContent = 'Tools';
        header.appendChild(headerText);
        
        this.element.appendChild(header);
        
        // Make header draggable
        let isDragging = false;
        let currentX: number;
        let currentY: number;
        let initialX: number;
        let initialY: number;
        
        header.style.cursor = 'grab';
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            initialX = e.clientX - this.element!.offsetLeft;
            initialY = e.clientY - this.element!.offsetTop;
            header.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            this.element!.style.left = currentX + 'px';
            this.element!.style.top = currentY + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'grab';
        });
        
        // Create tools container for buttons
        const toolsContainer = document.createElement('div');
        toolsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
        `;
        this.element.appendChild(toolsContainer);
        
        // Store reference to container for adding buttons
        this.toolsContainer = toolsContainer;
        
        // Create tool buttons first
        this.createToolButton('brush', 'Brush Tool (B)', 'B');
        this.createToolButton('eraser', 'Eraser Tool (E)', 'E');
        this.createToolButton('box', 'Box Tool (X)', 'X');
        this.createToolButton('line', 'Line Tool (L)', 'L');
        this.createToolButton('fill', 'Fill Tool (P)', 'P');
        this.createToolButton('selection', 'Selection Tool (S)', 'S');
        
        // Add separator before voxel brush section
        const voxelSeparator = document.createElement('div');
        voxelSeparator.style.cssText = `
            height: 1px;
            background: rgba(255, 255, 255, 0.1);
            margin: 6px 0;
            width: 80%;
        `;
        this.toolsContainer.appendChild(voxelSeparator);
        
        // Add voxel brush button at the bottom
        this.createVoxelBrushButton();
        
        // Add brush size button
        this.createBrushSizeButton();
        
        // Add footer for padding
        const footer = document.createElement('div');
        footer.style.cssText = `
            height: 8px;
            background: transparent;
        `;
        this.element.appendChild(footer);
        
        // Append to container
        const container = document.getElementById('container');
        if (container) {
            container.appendChild(this.element);
        }
        
        // Initialize lucide icons
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
    }
    
    private createToolButton(toolId: string, title: string, shortcut: string, active: boolean = false): void {
        const button = document.createElement('button');
        button.id = `tool-${toolId}`;
        button.title = title;
        button.className = 'tool-button';
        button.style.cssText = `
            width: 44px;
            height: 44px;
            border: 2px solid transparent;
            background: rgba(100, 100, 100, 0.2);
            color: rgba(255, 255, 255, 0.8);
            border-radius: 8px;
            cursor: pointer;
            font-size: 20px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `;
        
        // Create icon based on tool
        const iconMap: Record<string, string> = {
            brush: 'pencil',
            eraser: 'eraser',
            box: 'box',
            line: 'git-commit',
            fill: 'paint-bucket',
            selection: 'square-dashed'
        };
        
        const icon = document.createElement('span');
        icon.setAttribute('data-lucide', iconMap[toolId] || 'tool');
        icon.style.width = '20px';
        icon.style.height = '20px';
        button.appendChild(icon);
        
        // Set initial active state
        if (active) {
            this.setActiveToolButton(button);
        }
        
        // Add click handler
        button.addEventListener('click', () => {
            if (this.drawingSystem) {
                // Set the active button first
                this.setActiveToolButton(button);
                
                // Handle selection tool separately
                if (toolId === 'selection') {
                    // Set tool mode to selection
                    this.drawingSystem.setToolMode('selection');
                    // Emit event to enable selection mode
                    window.dispatchEvent(new CustomEvent('enable-selection-mode'));
                } else {
                    // For other tools, disable selection mode if active
                    window.dispatchEvent(new CustomEvent('disable-selection-mode'));
                    this.drawingSystem.setToolMode(toolId);
                }
                ActionLogger.getInstance().log(ActionLogger.actions.selectTool(toolId));
            }
        });
        
        // Add hover effects
        button.addEventListener('mouseenter', () => {
            if (button !== this.activeToolButton) {
                button.style.background = 'rgba(100, 100, 100, 0.3)';
                button.style.transform = 'scale(1.05)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (button !== this.activeToolButton) {
                button.style.background = 'rgba(100, 100, 100, 0.2)';
                button.style.transform = 'scale(1)';
            }
        });
        
        this.toolsContainer!.appendChild(button);
    }
    
    private createToggleButton(toggleId: string, title: string, shortcut: string): void {
        const button = document.createElement('button');
        button.id = `toggle-${toggleId}`;
        button.title = title;
        button.className = 'toggle-button';
        button.style.cssText = `
            width: 44px;
            height: 44px;
            border: 2px solid transparent;
            background: rgba(100, 100, 100, 0.2);
            color: rgba(255, 255, 255, 0.8);
            border-radius: 8px;
            cursor: pointer;
            font-size: 20px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `;
        
        // Create icon based on toggle
        const iconMap: Record<string, string> = {
            wireframe: 'box',
            tiltshift: 'aperture'
        };
        
        const icon = document.createElement('span');
        icon.setAttribute('data-lucide', iconMap[toggleId] || 'toggle-left');
        icon.style.width = '20px';
        icon.style.height = '20px';
        button.appendChild(icon);
        
        // Add click handler
        button.addEventListener('click', () => {
            if (toggleId === 'wireframe' && this.voxelEngine) {
                this.voxelEngine.toggleEdges();
                const isActive = this.voxelEngine.getShowEdges();
                this.updateToggleButton(button, isActive);
                ActionLogger.getInstance().log(ActionLogger.actions.toggleWireframe(isActive));
            } else if (toggleId === 'tiltshift') {
                // Emit event for tilt-shift toggle
                window.dispatchEvent(new CustomEvent('toggle-tiltshift'));
            }
        });
        
        // Add hover effects
        button.addEventListener('mouseenter', () => {
            const isActive = button.style.borderColor !== 'transparent';
            if (!isActive) {
                button.style.background = 'rgba(100, 100, 100, 0.3)';
                button.style.transform = 'scale(1.05)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            const isActive = button.style.borderColor !== 'transparent';
            if (!isActive) {
                button.style.background = 'rgba(100, 100, 100, 0.2)';
                button.style.transform = 'scale(1)';
            }
        });
        
        this.toolsContainer!.appendChild(button);
    }
    
    private setActiveToolButton(button: HTMLElement): void {
        // Reset all tool buttons first
        const allToolButtons = this.toolsContainer?.querySelectorAll('button');
        if (allToolButtons) {
            allToolButtons.forEach((btn) => {
                if (btn instanceof HTMLElement) {
                    // Remove selected class from voxel brush button
                    btn.classList.remove('selected');
                    
                    // Reset styles for all buttons
                    if (btn.id === 'voxel-brush-button') {
                        btn.style.background = 'transparent';
                    } else {
                        btn.style.background = 'rgba(100, 100, 100, 0.2)';
                        btn.style.borderColor = 'transparent';
                    }
                    btn.style.transform = 'scale(1)';
                    
                    const span = btn.querySelector('span');
                    if (span instanceof HTMLElement) {
                        // Reset icon color for non-voxel brush buttons
                        span.style.color = 'rgba(255, 255, 255, 0.8)';
                    }
                    
                    // Reset color swatch glow effect
                    const swatch = btn.querySelector('.voxel-color-swatch');
                    if (swatch instanceof HTMLElement) {
                        swatch.style.boxShadow = '0 0 0 1px rgba(0, 0, 0, 0.2)';
                    }
                }
            });
        }
        
        // Set new active button
        this.activeToolButton = button;
        if (button.id !== 'voxel-brush-button') {
            button.style.background = 'rgba(100, 200, 100, 0.3)';
            button.style.borderColor = 'rgba(100, 200, 100, 0.8)';
        }
        
        // Special handling for voxel brush button
        if (button.id === 'voxel-brush-button') {
            button.classList.add('selected');
            // Add glow effect to color swatch when active
            const swatch = button.querySelector('.voxel-color-swatch');
            if (swatch instanceof HTMLElement) {
                swatch.style.boxShadow = '0 0 8px rgba(100, 255, 100, 0.5)';
            }
        } else {
            // For other tools, update icon color only for the selected button
            const newSpan = button.querySelector('span');
            if (newSpan instanceof HTMLElement) {
                newSpan.style.color = 'rgba(100, 255, 100, 1)';
            }
        }
        
        // Debug: Force lucide to update icons after color changes
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
    }
    
    private updateToggleButton(button: HTMLElement, isActive: boolean): void {
        const icon = button.querySelector('span');
        if (isActive) {
            button.style.background = 'rgba(100, 200, 100, 0.3)';
            button.style.borderColor = 'rgba(100, 200, 100, 0.8)';
            if (icon) icon.style.color = 'rgba(100, 255, 100, 1)';
        } else {
            button.style.background = 'rgba(100, 100, 100, 0.2)';
            button.style.borderColor = 'transparent';
            if (icon) icon.style.color = 'rgba(255, 255, 255, 0.8)';
        }
    }
    
    selectTool(toolId: string): void {
        const button = document.getElementById(`tool-${toolId}`);
        if (button) {
            this.setActiveToolButton(button);
        }
    }
    
    clearActiveSelection(): void {
        // Clear the active tool button selection
        if (this.activeToolButton) {
            // Reset all tool buttons
            const allToolButtons = this.toolsContainer?.querySelectorAll('button');
            if (allToolButtons) {
                allToolButtons.forEach((btn) => {
                    if (btn instanceof HTMLElement) {
                        // Remove selected class from voxel brush button
                        btn.classList.remove('selected');
                        
                        // Reset styles for all buttons
                        if (btn.id === 'voxel-brush-button') {
                            btn.style.background = 'transparent';
                        } else {
                            btn.style.background = 'rgba(100, 100, 100, 0.2)';
                            btn.style.borderColor = 'transparent';
                        }
                        btn.style.transform = 'scale(1)';
                        
                        const span = btn.querySelector('span');
                        if (span instanceof HTMLElement) {
                            span.style.color = 'rgba(255, 255, 255, 0.8)';
                        }
                        
                        // Reset color swatch glow effect
                        const swatch = btn.querySelector('.voxel-color-swatch');
                        if (swatch instanceof HTMLElement) {
                            swatch.style.boxShadow = '0 0 0 1px rgba(0, 0, 0, 0.2)';
                        }
                    }
                });
            }
            this.activeToolButton = null;
        }
    }
    
    private createVoxelBrushButton(): void {
        const button = document.createElement('button');
        button.id = 'voxel-brush-button';
        button.className = 'voxel-brush-button';
        button.title = 'Single Voxel Brush (V)';
        
        button.style.cssText = `
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 8px;
            background: transparent;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        `;
        
        // Add color swatch instead of icon
        const colorSwatch = document.createElement('div');
        const firstColor = this.colorPickerPopover.getSelectedColor();
        colorSwatch.className = 'voxel-color-swatch';
        colorSwatch.style.cssText = `
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${firstColor ? firstColor.hex : '#FFFFFF'};
            transition: all 0.2s ease;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
        `;
        button.appendChild(colorSwatch);
        
        // Initialize selected color
        if (firstColor) {
            this.selectedColor = firstColor;
        }
        
        // Hover effect
        button.addEventListener('mouseenter', () => {
            if (button !== this.activeToolButton) {
                button.style.transform = 'scale(1.05)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (button !== this.activeToolButton) {
                button.style.transform = 'scale(1)';
            }
        });
        
        // Click handler
        button.addEventListener('click', async () => {
            // If already selected, show color picker
            if (button === this.activeToolButton) {
                await this.colorPickerPopover.show(button, (color) => {
                    this.selectedColor = color;
                    this.updateVoxelBrushButtonWithColor(color);
                    
                    // Get or create a VoxelType for this color
                    const colorRegistry = ColorRegistry.getInstance();
                    const voxelType = colorRegistry.getOrCreateVoxelType(color.hex);
                    
                    if (voxelType && this.drawingSystem) {
                        color.voxelType = voxelType;
                        this.drawingSystem.setVoxelType(voxelType);
                        console.log(`Selected color: ${color.name} (${color.hex}) -> VoxelType ${voxelType}`);
                    }
                }, 'right');
                return;
            }
            
            // Clear any asset selection and set brush mode
            if (this.drawingSystem) {
                this.drawingSystem.setSelectedAsset(null);
                this.drawingSystem.setToolMode('brush');
            }
            
            // Mark this button as selected
            this.setActiveToolButton(button);
            
            // Set the voxel type if we have a selected color
            if (this.selectedColor && this.selectedColor.voxelType !== undefined && this.drawingSystem) {
                this.drawingSystem.setVoxelType(this.selectedColor.voxelType);
            }
            
            // Show color picker automatically
            await this.colorPickerPopover.show(button, (color) => {
                this.selectedColor = color;
                this.updateVoxelBrushButtonWithColor(color);
                
                const colorRegistry = ColorRegistry.getInstance();
                const voxelType = colorRegistry.getOrCreateVoxelType(color.hex);
                
                if (voxelType && this.drawingSystem) {
                    color.voxelType = voxelType;
                    this.drawingSystem.setVoxelType(voxelType);
                    console.log(`Selected color: ${color.name} (${color.hex}) -> VoxelType ${voxelType}`);
                }
            }, 'right');
        });
        
        // Re-initialize Lucide icons
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
        
        // Add pulse animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        this.toolsContainer!.appendChild(button);
    }
    
    private updateVoxelBrushButtonWithColor(color: ColorInfo): void {
        const voxelBrushButton = document.getElementById('voxel-brush-button');
        if (voxelBrushButton) {
            const colorSwatch = voxelBrushButton.querySelector('.voxel-color-swatch');
            if (colorSwatch instanceof HTMLElement) {
                colorSwatch.style.background = color.hex;
                
                // Just update the background color, no borders
            }
            
            // Don't update button background for voxel brush
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
    
    updateWireframeButton(isActive: boolean): void {
        const button = document.getElementById('toggle-wireframe');
        if (button) {
            this.updateToggleButton(button, isActive);
        }
    }
    
    updateTiltShiftButton(isActive: boolean): void {
        const button = document.getElementById('toggle-tiltshift');
        if (button) {
            this.updateToggleButton(button, isActive);
        }
    }
    
    private createBrushSizeButton(): void {
        const button = document.createElement('button');
        button.style.cssText = `
            width: 44px;
            height: 44px;
            border: 2px solid transparent;
            background: rgba(100, 100, 100, 0.2);
            color: rgba(255, 255, 255, 0.8);
            border-radius: 8px;
            cursor: pointer;
            font-size: 20px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `;
        
        let currentSize = 1;
        button.textContent = '1';
        button.title = 'Brush Size (Click to toggle)';
        
        button.addEventListener('click', () => {
            // Toggle between 1, 2, 4, 6, 8, 10
            const sizes = [1, 2, 4, 6, 8, 10];
            const currentIndex = sizes.indexOf(currentSize);
            const nextIndex = (currentIndex + 1) % sizes.length;
            currentSize = sizes[nextIndex];
            button.textContent = currentSize.toString();
            
            if (this.drawingSystem) {
                this.drawingSystem.setBrushSize(currentSize);
                ActionLogger.getInstance().log(`Brush size: ${currentSize}x${currentSize}`);
            }
        });
        
        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(100, 100, 100, 0.3)';
            button.style.transform = 'scale(1.05)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(100, 100, 100, 0.2)';
            button.style.transform = 'scale(1)';
        });
        
        this.toolsContainer!.appendChild(button);
    }
}