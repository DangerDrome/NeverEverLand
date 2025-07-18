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
    
    // Create test section
    const testSection = this.createTestSection();
    content.appendChild(testSection);
    
    // Create the panel
    this.element = window.UI.panel('Tile Palette', content, {
      icon: 'palette',
      collapsible: true,
      closable: false,
      draggable: true,
      resizable: true,
      startCollapsed: false,
    });
    
    if (this.element) {
      this.element.className += ' tile-palette';
      this.element.style.position = 'fixed';
      this.element.style.left = '20px';
      this.element.style.bottom = '20px';
      this.element.style.width = 'auto';
      this.element.style.maxWidth = '90vw';
      this.element.style.zIndex = '998';
      
      // Make panel body horizontal
      const panelBody = this.element.querySelector('.panel-body');
      if (panelBody) {
        (panelBody as HTMLElement).style.padding = 'var(--space-3)';
      }
      
      this.container.appendChild(this.element);
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
    
    // Create tool buttons
    tools.forEach(tool => {
      const button = document.createElement('button');
      button.className = 'btn btn-default btn-sm';
      button.style.width = '40px';
      button.style.height = '40px';
      button.style.padding = '0';
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      
      // Add icon
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', tool.icon);
      icon.style.width = '20px';
      icon.style.height = '20px';
      button.appendChild(icon);
      
      // Add click handler
      button.onclick = () => this.selectTool(tool.mode);
      
      // Add StyleUI tooltip
      window.UI.tooltip(button, tool.tooltip, 'top');
      
      this.toolButtons.set(tool.mode, button);
      section.appendChild(button);
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
    
    // Voxel types to show (skip Air)
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
    
    // Create voxel buttons
    voxelTypes.forEach((type, index) => {
      const props = VOXEL_PROPERTIES[type];
      const color = VoxelTypeColors[type];
      
      const button = document.createElement('button');
      button.className = 'btn btn-default btn-sm';
      button.style.width = '40px';
      button.style.height = '40px';
      button.style.padding = '0';
      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      
      // Color fill
      const colorFill = document.createElement('div');
      colorFill.style.position = 'absolute';
      colorFill.style.inset = '4px';
      colorFill.style.backgroundColor = color;
      colorFill.style.borderRadius = 'var(--radius-sm)';
      colorFill.style.border = '1px solid rgba(0,0,0,0.2)';
      
      // Add transparency pattern for transparent voxels
      if (props.transparent) {
        colorFill.style.backgroundImage = `
          linear-gradient(45deg, #666 25%, transparent 25%),
          linear-gradient(-45deg, #666 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #666 75%),
          linear-gradient(-45deg, transparent 75%, #666 75%)
        `;
        colorFill.style.backgroundSize = '8px 8px';
        colorFill.style.backgroundPosition = '0 0, 0 4px, 4px -4px, -4px 0px';
      }
      
      button.appendChild(colorFill);
      
      // Add click handler
      button.onclick = () => {
        this.selectVoxelType(type);
        // Auto-switch to place mode when selecting a voxel
        if (this.selectedTool !== EditorMode.Place) {
          this.selectTool(EditorMode.Place);
        }
      };
      
      // Add StyleUI tooltip
      window.UI.tooltip(button, `${props.name} (${index + 4})`, 'top');
      
      this.voxelButtons.set(type, button);
      section.appendChild(button);
    });
    
    return section;
  }
  
  private createTestSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.gap = 'var(--space-2)';
    section.style.alignItems = 'center';
    
    // Add label
    const label = document.createElement('div');
    label.style.fontSize = 'var(--font-size-xs)';
    label.style.color = 'var(--text-secondary)';
    label.style.marginRight = 'var(--space-2)';
    label.textContent = 'Test:';
    section.appendChild(label);
    
    // Stress test button
    const stressButton = document.createElement('button');
    stressButton.className = 'btn btn-warning btn-sm';
    stressButton.style.display = 'flex';
    stressButton.style.alignItems = 'center';
    stressButton.style.gap = 'var(--space-1)';
    
    // Add icon
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'zap');
    icon.style.width = '16px';
    icon.style.height = '16px';
    stressButton.appendChild(icon);
    
    // Add text
    const text = document.createElement('span');
    text.textContent = 'Stress Test';
    text.style.fontSize = 'var(--font-size-xs)';
    stressButton.appendChild(text);
    
    // Add click handler
    stressButton.onclick = () => this.runStressTest();
    
    // Add StyleUI tooltip
    window.UI.tooltip(stressButton, 'Add 900 tiles to stress test performance', 'top');
    
    section.appendChild(stressButton);
    
    // Initialize lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
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