import { TileEditor } from '@core/TileEditor';
import { VoxelType, VOXEL_PROPERTIES, VoxelTypeColors } from '@core/VoxelTypes';
import { EditorMode } from '../types';

/**
 * Tile palette panel for voxel/tile creation and tools
 */
export class TilePalette {
  private container: HTMLElement;
  private editor: TileEditor;
  private element: HTMLElement | null = null;
  
  // Selected states
  private selectedTool: EditorMode = EditorMode.Place;
  private selectedVoxelType: VoxelType = VoxelType.Grass;
  
  // UI elements
  private toolButtons: Map<EditorMode, HTMLElement> = new Map();
  private voxelButtons: Map<VoxelType, HTMLElement> = new Map();
  
  constructor(container: HTMLElement, editor: TileEditor) {
    this.container = container;
    this.editor = editor;
    this.init();
  }
  
  private tooltipsToCreate: Array<{element: HTMLElement, content: string}> = [];
  
  private init(): void {
    // Create main palette container
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.gap = 'var(--space-4)';
    content.style.alignItems = 'center';
    content.style.padding = '0';
    
    // Create tools section
    const toolsSection = this.createToolsSection();
    content.appendChild(toolsSection);
    
    // Add separator
    const separator = document.createElement('div');
    separator.style.width = '1px';
    separator.style.height = '40px';
    separator.style.backgroundColor = 'var(--border-color)';
    content.appendChild(separator);
    
    // Create voxels section
    const voxelsSection = this.createVoxelsSection();
    content.appendChild(voxelsSection);
    
    // Add another separator
    const separator2 = document.createElement('div');
    separator2.style.width = '1px';
    separator2.style.height = '40px';
    separator2.style.backgroundColor = 'var(--border-color)';
    content.appendChild(separator2);
    
    // Create layer controls section
    const layerSection = this.createLayerSection();
    content.appendChild(layerSection);
    
    // Add another separator
    const separator3 = document.createElement('div');
    separator3.style.width = '1px';
    separator3.style.height = '40px';
    separator3.style.backgroundColor = 'var(--border-color)';
    content.appendChild(separator3);
    
    // Create sky controls section
    const skySection = this.createSkySection();
    content.appendChild(skySection);
    
    // Add another separator
    const separator4 = document.createElement('div');
    separator4.style.width = '1px';
    separator4.style.height = '40px';
    separator4.style.backgroundColor = 'var(--border-color)';
    content.appendChild(separator4);
    
    // Create test section
    const testSection = this.createTestSection();
    content.appendChild(testSection);
    
    // Add another separator
    const separator5 = document.createElement('div');
    separator5.style.width = '1px';
    separator5.style.height = '40px';
    separator5.style.backgroundColor = 'var(--border-color)';
    content.appendChild(separator5);
    
    // Create clear section
    const clearSection = this.createClearSection();
    content.appendChild(clearSection);
    
    // Create the panel
    this.element = window.UI.panel('Tile Palette', content, {
      collapsible: true,
      closable: false,
      draggable: true,
      resizable: true,
      startCollapsed: false,
      // Don't specify position - let CSS handle centering
    });
    
    if (this.element) {
      this.element.className += ' tile-palette';
      
      // Add palette icon to the title
      const titleElement = this.element.querySelector('.panel-title');
      if (titleElement) {
        const iconHTML = '<i data-lucide="palette" style="width: 16px; height: 16px; margin-right: 8px;"></i>';
        titleElement.innerHTML = iconHTML + titleElement.textContent;
      }
      
      // Override any default positioning to ensure centering works
      this.element.style.position = 'fixed';
      this.element.style.left = '50%';
      this.element.style.transform = 'translateX(-50%)';
      this.element.style.bottom = '80px';
      this.element.style.top = 'auto';
      this.element.style.right = 'auto';
      
      // Panel body already has proper padding from CSS
      
      this.container.appendChild(this.element);
      
      // Initialize lucide icons
      if (window.lucide) {
        window.lucide.createIcons();
      }
      
      // Force reflow before creating tooltips
      this.element.offsetHeight;
      
      // Create all tooltips after everything is rendered
      setTimeout(() => {
        this.tooltipsToCreate.forEach(({ element, content }) => {
          window.UI.tooltip({
            target: element,
            content: content,
            position: 'top',
            size: 'sm',
            delay: 100
          });
        });
        this.tooltipsToCreate = [];
      }, 100);
    }
    
    // Set initial tool
    this.selectTool(EditorMode.Place);
    this.selectVoxelType(VoxelType.Grass);
  }
  
  private createToolsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.gap = 'var(--space-2)';
    
    // Add label
    const label = document.createElement('div');
    label.style.fontSize = 'var(--font-size-xs)';
    label.style.color = 'var(--text-secondary)';
    label.style.marginRight = 'var(--space-2)';
    label.textContent = 'Tools:';
    section.appendChild(label);
    
    // Tool definitions
    const tools: Array<{mode: EditorMode, icon: string, tooltip: string}> = [
      { mode: EditorMode.Select, icon: 'mouse-pointer', tooltip: 'Select (1)' },
      { mode: EditorMode.Place, icon: 'plus-square', tooltip: 'Place (2)' },
      { mode: EditorMode.Erase, icon: 'eraser', tooltip: 'Erase (3)' },
    ];
    
    // Create tool buttons using StyleUI button component
    tools.forEach(tool => {
      const buttonConfig = {
        variant: 'ghost',
        size: 'sm',
        icon: tool.icon,
        className: 'tool-button',
        onClick: () => this.selectTool(tool.mode)
      };
      
      const buttonComponent = window.UI.button(buttonConfig);
      const button = buttonComponent.element;
      
      this.toolButtons.set(tool.mode, button);
      section.appendChild(button);
      
      // Store tooltip info to create later
      this.tooltipsToCreate.push({ element: button, content: tool.tooltip });
    });
    
    // Initialize lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    return section;
  }
  
  private createVoxelsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.gap = 'var(--space-2)';
    section.style.flexWrap = 'wrap';
    section.style.maxWidth = '600px';
    
    // Add label
    const label = document.createElement('div');
    label.style.fontSize = 'var(--font-size-xs)';
    label.style.color = 'var(--text-secondary)';
    label.style.marginRight = 'var(--space-2)';
    label.textContent = 'Voxels:';
    section.appendChild(label);
    
    // Voxel types to show (skip Air) with icons
    const voxelTypes = [
      { type: VoxelType.Grass, icon: 'trees' },
      { type: VoxelType.Dirt, icon: 'mountain' },
      { type: VoxelType.Stone, icon: 'gem' },
      { type: VoxelType.Wood, icon: 'tree-pine' },
      { type: VoxelType.Sand, icon: 'waves' },
      { type: VoxelType.Water, icon: 'droplets' },
      { type: VoxelType.Glass, icon: 'square' },
      { type: VoxelType.Metal, icon: 'zap' },
      { type: VoxelType.Brick, icon: 'box' },
    ];
    
    // Create voxel buttons using StyleUI
    voxelTypes.forEach((voxelInfo, index) => {
      const { type, icon } = voxelInfo;
      const props = VOXEL_PROPERTIES[type];
      const color = VoxelTypeColors[type];
      
      const buttonConfig = {
        variant: 'ghost',
        size: 'sm',
        icon: icon,
        className: `voxel-button voxel-${type}`,
        onClick: () => {
          this.selectVoxelType(type);
          // Auto-switch to place mode when selecting a voxel
          if (this.selectedTool !== EditorMode.Place) {
            this.selectTool(EditorMode.Place);
          }
        }
      };
      
      const buttonComponent = window.UI.button(buttonConfig);
      const button = buttonComponent.element;
      
      // Add custom voxel styling via CSS custom properties
      button.style.setProperty('--voxel-color', color);
      button.style.setProperty('--voxel-transparent', props.transparent ? '1' : '0');
      
      this.voxelButtons.set(type, button);
      section.appendChild(button);
      
      // Store tooltip info to create later
      this.tooltipsToCreate.push({ element: button, content: `${props.name} (${index + 4})` });
    });
    
    return section;
  }
  
  /**
   * Create layer controls section
   */
  private createLayerSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.alignItems = 'center';
    section.style.gap = 'var(--space-2)';
    
    // Track stack mode state
    let stackEnabled = true;
    
    // Stack mode toggle button
    const stackButton = window.UI.button({
      variant: 'primary', // Start enabled
      size: 'sm',
      icon: 'layers',
      className: 'tool-button',
      onClick: () => {
        stackEnabled = !stackEnabled;
        this.editor.setStackMode(stackEnabled);
        // Update button appearance
        if (stackEnabled) {
          stackButton.element.classList.add('btn-primary');
          stackButton.element.classList.remove('btn-ghost');
        } else {
          stackButton.element.classList.remove('btn-primary');
          stackButton.element.classList.add('btn-ghost');
        }
      }
    });
    section.appendChild(stackButton.element);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: stackButton.element, content: 'Stack Mode' });
    
    return section;
  }
  
  /**
   * Create clear section
   */
  private createClearSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.alignItems = 'center';
    
    // Clear all button
    const clearBtn = window.UI.button({
      variant: 'ghost',
      size: 'sm',
      icon: 'trash-2',
      className: 'tool-button',
      onClick: () => {
        if (window.UI.confirm) {
          window.UI.confirm({
            title: 'Clear All Blocks',
            message: 'Are you sure you want to clear all blocks?',
            type: 'danger',
            onConfirm: () => {
              this.editor.clearAllTiles();
            }
          });
        }
      }
    });
    // Add danger color on hover
    clearBtn.element.addEventListener('mouseenter', () => {
      clearBtn.element.classList.add('btn-danger');
      clearBtn.element.classList.remove('btn-ghost');
    });
    clearBtn.element.addEventListener('mouseleave', () => {
      clearBtn.element.classList.remove('btn-danger');
      clearBtn.element.classList.add('btn-ghost');
    });
    section.appendChild(clearBtn.element);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: clearBtn.element, content: 'Clear All Blocks' });
    
    return section;
  }
  
  /**
   * Create sky controls section
   */
  private createSkySection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.alignItems = 'center';
    section.style.gap = 'var(--space-2)';
    
    // Track toggle states
    let skyEnabled = false;
    let aoEnabled = false;
    
    // Sky toggle button
    const skyButton = window.UI.button({
      variant: 'ghost',
      size: 'sm',
      icon: 'sun',
      className: 'tool-button',
      onClick: () => {
        skyEnabled = !skyEnabled;
        this.editor.toggleSky(skyEnabled);
        // Update button appearance
        if (skyEnabled) {
          skyButton.element.classList.add('btn-primary');
          skyButton.element.classList.remove('btn-ghost');
        } else {
          skyButton.element.classList.remove('btn-primary');
          skyButton.element.classList.add('btn-ghost');
        }
      }
    });
    section.appendChild(skyButton.element);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: skyButton.element, content: 'Toggle Sky' });
    
    // AO toggle button
    const aoButton = window.UI.button({
      variant: 'ghost',
      size: 'sm',
      icon: 'aperture',
      className: 'tool-button',
      onClick: () => {
        aoEnabled = !aoEnabled;
        this.editor.setAmbientOcclusion(aoEnabled);
        // Update button appearance
        if (aoEnabled) {
          aoButton.element.classList.add('btn-warning');
          aoButton.element.classList.remove('btn-ghost');
        } else {
          aoButton.element.classList.remove('btn-warning');
          aoButton.element.classList.add('btn-ghost');
        }
      }
    });
    section.appendChild(aoButton.element);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: aoButton.element, content: 'Ambient Occlusion' });
    
    // Initialize lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    return section;
  }
  
  private createTestSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.alignItems = 'center';
    
    // Stress test button - icon only
    const stressButton = window.UI.button({
      variant: 'ghost',
      size: 'sm',
      icon: 'zap',
      className: 'tool-button',
      onClick: () => this.runStressTest()
    });
    
    // Add warning color on hover
    stressButton.element.addEventListener('mouseenter', () => {
      stressButton.element.classList.add('btn-warning');
      stressButton.element.classList.remove('btn-ghost');
    });
    stressButton.element.addEventListener('mouseleave', () => {
      stressButton.element.classList.remove('btn-warning');
      stressButton.element.classList.add('btn-ghost');
    });
    
    section.appendChild(stressButton.element);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: stressButton.element, content: 'Stress Test (900 tiles)' });
    
    return section;
  }
  
  private stressTestBatch: number = 0;
  
  private runStressTest(): void {
    const startTime = performance.now();
    const size = 30; // 30x30 grid per batch
    const halfSize = Math.floor(size / 2);
    
    // Get available voxel types (excluding Air)
    const voxelTypes = [
      VoxelType.Grass,
      VoxelType.Dirt,
      VoxelType.Stone,
      VoxelType.Wood,
      VoxelType.Sand,
      VoxelType.Water,
      VoxelType.Glass,
      VoxelType.Metal,
      VoxelType.Brick,
    ];
    
    let tilesAdded = 0;
    
    // Offset each batch to spread them out or stack them
    const offsetX = (this.stressTestBatch % 3) * 30 - 30;
    const offsetZ = Math.floor(this.stressTestBatch / 3) * 30 - 30;
    
    // Add tiles to scene (don't check if tile exists - we want to stress test!)
    for (let x = -halfSize; x < halfSize; x++) {
      for (let z = -halfSize; z < halfSize; z++) {
        const randomType = voxelTypes[Math.floor(Math.random() * voxelTypes.length)];
        if (randomType !== undefined) {
          // Force place tile even if one exists (this will replace it, adding to draw calls)
          const coord = { x: x + offsetX, z: z + offsetZ };
          this.editor.getTileSystem().placeTile(coord, randomType);
          tilesAdded++;
        }
      }
    }
    
    // Get total tiles in scene
    const totalTiles = this.editor.getTileSystem().getAllTiles().size;
    
    // Get renderer info
    const renderer = this.editor.getRenderer();
    const renderInfo = renderer.info;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.stressTestBatch++;
    
    console.log(`Stress test batch ${this.stressTestBatch}:`);
    console.log(`- Added ${tilesAdded} new tiles`);
    console.log(`- Total tiles in scene: ${totalTiles}`);
    console.log(`- Draw calls: ${renderInfo.render.calls}`);
    console.log(`- Triangles: ${renderInfo.render.triangles}`);
    console.log(`- Geometries: ${renderInfo.memory.geometries}`);
    console.log(`- Time: ${duration.toFixed(2)}ms`);
    
    // Show toast with stats
    const message = `Batch ${this.stressTestBatch}: Added ${tilesAdded} tiles • Total: ${totalTiles} • Draw calls: ${renderInfo.render.calls} • Triangles: ${renderInfo.render.triangles.toLocaleString()}`;
    const type = totalTiles > 5000 ? 'warning' : 'success';
    window.UI.toast(message, type, { duration: 5000 });
  }
  
  private selectTool(mode: EditorMode): void {
    this.selectedTool = mode;
    
    // Update button states
    this.toolButtons.forEach((button, buttonMode) => {
      if (buttonMode === mode) {
        button.classList.add('btn-primary');
        button.classList.remove('btn-default');
      } else {
        button.classList.remove('btn-primary');
        button.classList.add('btn-default');
      }
    });
    
    // Update editor
    this.editor.setMode(mode);
  }
  
  private selectVoxelType(type: VoxelType): void {
    this.selectedVoxelType = type;
    
    // Update button states
    this.voxelButtons.forEach((button, buttonType) => {
      if (buttonType === type) {
        button.classList.add('btn-primary');
        button.classList.remove('btn-default');
      } else {
        button.classList.remove('btn-primary');
        button.classList.add('btn-default');
      }
    });
    
    // Update editor
    this.editor.setSelectedVoxelType(type);
  }
  
  /**
   * Get currently selected voxel type
   */
  public getSelectedVoxelType(): VoxelType {
    return this.selectedVoxelType;
  }
  
  /**
   * Set palette visibility
   */
  public setVisible(visible: boolean): void {
    if (this.element) {
      this.element.style.display = visible ? 'block' : 'none';
    }
  }
  
  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}