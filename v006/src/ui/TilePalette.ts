import { TileEditor } from '@core/TileEditor';
import { VoxelType, VOXEL_PROPERTIES, VoxelTypeColors } from '@core/VoxelTypes';
import { EditorMode } from '../types';
import { isMobile } from '../utils/mobile';

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
  private currentTileSize: number = 0.1; // Current tile scale factor
  
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
    
    if (isMobile()) {
      // Mobile: two rows layout
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.gap = 'var(--space-2)';
      content.style.padding = '0';
    } else {
      // Desktop: horizontal layout
      content.style.display = 'flex';
      content.style.gap = 'var(--space-4)';
      content.style.alignItems = 'center';
      content.style.padding = '0';
      content.style.flexWrap = 'nowrap';
    }
    
    if (isMobile()) {
      // Mobile: Create horizontal layout with tools on left
      const mobileLayout = document.createElement('div');
      mobileLayout.style.display = 'flex';
      mobileLayout.style.gap = 'var(--space-3)';
      mobileLayout.style.height = '100%';
      mobileLayout.style.width = '100%';
      mobileLayout.style.padding = '0';
      mobileLayout.style.margin = '0';
      
      // Left column: Tools (vertical)
      const toolsColumn = document.createElement('div');
      toolsColumn.style.display = 'flex';
      toolsColumn.style.flexDirection = 'column';
      toolsColumn.style.gap = 'var(--space-2)';
      toolsColumn.style.alignItems = 'center';
      toolsColumn.style.justifyContent = 'center';
      toolsColumn.style.paddingRight = 'var(--space-2)';
      toolsColumn.style.borderRight = '1px solid var(--border-color)';
      
      const toolsSection = this.createToolsSection();
      toolsColumn.appendChild(toolsSection);
      
      // Add stack button to tools column on mobile
      const layerSection = this.createLayerSection();
      const stackButton = layerSection.querySelector('button');
      if (stackButton) {
        toolsColumn.appendChild(stackButton);
      }
      
      mobileLayout.appendChild(toolsColumn);
      
      // Middle section: Voxels
      const middleSection = document.createElement('div');
      middleSection.style.display = 'flex';
      middleSection.style.flex = '1';
      middleSection.style.justifyContent = 'center';
      middleSection.style.alignItems = 'center';
      
      const voxelsSection = this.createVoxelsSection();
      middleSection.appendChild(voxelsSection);
      mobileLayout.appendChild(middleSection);
      
      // Right column: Controls (vertical)
      const controlsColumn = document.createElement('div');
      controlsColumn.style.display = 'flex';
      controlsColumn.style.flexDirection = 'column';
      controlsColumn.style.gap = 'var(--space-2)';
      controlsColumn.style.alignItems = 'center';
      controlsColumn.style.justifyContent = 'center';
      controlsColumn.style.borderLeft = '1px solid var(--border-color)';
      controlsColumn.style.paddingRight = '0';
      controlsColumn.style.paddingLeft = 'var(--space-2)';
      controlsColumn.style.marginRight = '0';
      controlsColumn.style.width = 'auto';
      controlsColumn.style.flexShrink = '0';
      
      mobileLayout.appendChild(controlsColumn);
      content.appendChild(mobileLayout);
      
      // Store reference for later use
      content.dataset.mobileLayout = 'true';
      (content as any).mobileControlsColumn = controlsColumn;
      (content as any).mobileLayerSectionCreated = true;
    } else {
      // Desktop: Single row with separators
      // Create tools section
      const toolsSection = this.createToolsSection();
      content.appendChild(toolsSection);
      
      // Add separator
      const separator = document.createElement('div');
      separator.style.width = '1px';
      separator.style.height = '40px';
      separator.style.backgroundColor = 'var(--border-color)';
      separator.style.flexShrink = '0';
      content.appendChild(separator);
      
      // Create voxels section
      const voxelsSection = this.createVoxelsSection();
      content.appendChild(voxelsSection);
    }
    
    // Add extra sections
    if (isMobile() && (content as any).mobileControlsColumn) {
      // Mobile: Add controls to the right column
      const controlsColumn = (content as any).mobileControlsColumn;
      
      // Add each control button to the vertical column
      // (Stack button is already in the left column)
      
      const skySection = this.createSkySection();
      // Sky section has two buttons, get both
      const skyButtons = skySection.querySelectorAll('button');
      skyButtons.forEach(btn => controlsColumn.appendChild(btn));
      
      const testSection = this.createTestSection();
      const testButton = testSection.querySelector('button');
      if (testButton) controlsColumn.appendChild(testButton);
      
      const clearSection = this.createClearSection();
      const clearButton = clearSection.querySelector('button');
      if (clearButton) controlsColumn.appendChild(clearButton);
    } else if (!isMobile()) {
      // Desktop: Add sections with separators
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
    }
    
    // Create the panel
    this.element = window.UI.panel('Voxels', content, {
      collapsible: false,
      closable: false,
      draggable: true,
      resizable: false, // Disable resizing completely
      startCollapsed: false,
      // Don't specify position - let CSS handle centering
      onCollapse: isMobile() ? (collapsed: boolean) => this.handleMobileCollapse(collapsed) : undefined
    });
    
    if (this.element) {
      this.element.className += ' tile-palette';
      
      // Add palette icon to the title
      const titleElement = this.element.querySelector('.panel-title');
      if (titleElement) {
        const iconHTML = '<i data-lucide="boxes" style="width: 20px; height: 20px; margin-right: 8px; stroke-width: 1px;"></i>';
        titleElement.innerHTML = iconHTML + titleElement.textContent;
        // Remove bold font weight from panel title and make text dim
        (titleElement as HTMLElement).style.fontWeight = 'normal';
        (titleElement as HTMLElement).style.color = 'var(--text-secondary)';
      }
      
      // Override positioning based on device
      this.element.style.position = 'fixed';
      
      if (isMobile()) {
        // Mobile: horizontal scrollable panel at bottom with slide animation
        this.element.style.left = '10px';
        this.element.style.right = '10px';
        this.element.style.bottom = '10px';
        this.element.style.top = 'auto';
        this.element.style.transform = 'translateY(0)';
        this.element.style.width = 'auto';
        this.element.style.maxWidth = 'calc(100vw - 20px)';
        // Make the panel appropriate height for new layout
        this.element.style.minHeight = '180px';
        // Add transition for smooth sliding
        this.element.style.transition = 'transform 0.3s ease-in-out';
        
        // Also adjust the panel body height
        const panelBody = this.element.querySelector('.panel-body');
        if (panelBody) {
          (panelBody as HTMLElement).style.minHeight = '140px';
          (panelBody as HTMLElement).style.display = 'flex !important'; // Override collapsed state
          (panelBody as HTMLElement).style.alignItems = 'stretch';
          // Padding is now handled by CSS rule
        }
        
        // Add custom CSS to override panel-collapsed behavior on mobile
        const style = document.createElement('style');
        style.textContent = `
          /* Custom padding for tile palette */
          .tile-palette .panel-body {
            padding: var(--space-8) !important;
            padding-top: var(--space-2) !important;
          }
          
          @media (max-width: 768px) {
            .tile-palette.panel-collapsed .panel-body {
              display: flex !important;
              visibility: visible !important;
              height: auto !important;
              opacity: 1 !important;
            }
            .tile-palette .panel-body {
              padding: var(--space-8) !important;
              padding-top: var(--space-2) !important;
            }
            .tile-palette .panel-body > div {
              padding-right: 0 !important;
              margin-right: 0 !important;
            }
            .tile-palette .panel-body > div > div:last-child {
              padding-right: 0 !important;
              margin-right: 0 !important;
            }
            .tile-palette button {
              margin-right: 0 !important;
            }
          }
        `;
        document.head.appendChild(style);
      } else {
        // Desktop: horizontal panel at bottom center
        this.element.style.bottom = '80px';
        
        // Set initial position immediately to avoid drag conflicts
        this.element.style.left = '50%';
        this.element.style.transform = 'translateX(-50%)';
        
        // After StyleUI initializes, replace transform with calculated position
        requestAnimationFrame(() => {
          if (this.element) {
            const rect = this.element.getBoundingClientRect();
            const leftPos = rect.left;
            this.element.style.transform = 'none';
            this.element.style.left = `${leftPos}px`;
          }
        });
        // Padding is now handled by CSS rule
        this.element.style.top = 'auto';
        this.element.style.right = 'auto';
      }
      
      // Panel body already has proper padding from CSS
      
      this.container.appendChild(this.element);
      
      // Set initial tile size on editor
      this.editor.setTileSize(this.currentTileSize);
      
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
    section.style.flexDirection = 'column';
    section.style.gap = 'var(--space-2)';
    section.style.alignItems = 'flex-start';
    section.style.flexShrink = '0';
    
    if (!isMobile()) {
      // Add label above buttons
      const label = document.createElement('div');
      label.style.fontSize = 'var(--font-size-xs)';
      label.style.color = 'var(--text-secondary)';
      label.style.fontWeight = '600';
      label.style.textAlign = 'left';
      label.textContent = 'Tools';
      section.appendChild(label);
    }
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = 'var(--space-2)';
    buttonsContainer.style.alignItems = 'center';
    buttonsContainer.style.alignSelf = 'center';
    
    // Mobile: vertical layout for buttons
    if (isMobile()) {
      buttonsContainer.style.flexDirection = 'column';
    }
    
    // Tool definitions
    const tools: Array<{mode: EditorMode, icon: string, tooltip: string}> = [
      { mode: EditorMode.Place, icon: 'plus-square', tooltip: 'Place (1)' },
      { mode: EditorMode.Select, icon: 'mouse-pointer', tooltip: 'Select (2)' },
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
      
      // Ensure button doesn't shrink
      button.style.flexShrink = '0';
      
      this.toolButtons.set(tool.mode, button);
      buttonsContainer.appendChild(button);
      
      // Store tooltip info to create later
      this.tooltipsToCreate.push({ element: button, content: tool.tooltip });
    });
    
    section.appendChild(buttonsContainer);
    
    // Initialize lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    return section;
  }
  
  private createVoxelsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.gap = 'var(--space-2)';
    section.style.alignItems = 'flex-start';
    section.style.flexShrink = '0';
    
    if (!isMobile()) {
      // Add label above buttons
      const label = document.createElement('div');
      label.style.fontSize = 'var(--font-size-xs)';
      label.style.color = 'var(--text-secondary)';
      label.style.fontWeight = '600';
      label.style.textAlign = 'left';
      label.textContent = 'Voxels';
      section.appendChild(label);
    }
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    
    if (isMobile()) {
      // Mobile: 2-row grid layout
      buttonsContainer.style.display = 'grid';
      buttonsContainer.style.gridTemplateRows = 'repeat(2, 1fr)';
      buttonsContainer.style.gridAutoFlow = 'column';
      buttonsContainer.style.gap = 'var(--space-2)';
      buttonsContainer.style.justifyContent = 'center';
      buttonsContainer.style.alignItems = 'center';
      buttonsContainer.style.padding = '0 var(--space-2)';
      buttonsContainer.style.alignSelf = 'center';
    } else {
      // Desktop: horizontal flex layout, no wrapping
      buttonsContainer.style.display = 'flex';
      buttonsContainer.style.gap = 'var(--space-2)';
      buttonsContainer.style.alignItems = 'center';
      buttonsContainer.style.flexWrap = 'nowrap'; // Prevent vertical stacking
      buttonsContainer.style.alignSelf = 'center';
    }
    
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
      
      // Ensure button doesn't shrink
      button.style.flexShrink = '0';
      
      this.voxelButtons.set(type, button);
      buttonsContainer.appendChild(button);
      
      // Store tooltip info to create later
      this.tooltipsToCreate.push({ element: button, content: `${props.name} (${index + 4})` });
    });
    
    section.appendChild(buttonsContainer);
    
    return section;
  }
  
  /**
   * Create layer controls section
   */
  private createLayerSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.alignItems = 'flex-start';
    section.style.gap = 'var(--space-2)';
    
    if (!isMobile()) {
      // Add label above buttons
      const label = document.createElement('div');
      label.style.fontSize = 'var(--font-size-xs)';
      label.style.color = 'var(--text-secondary)';
      label.style.fontWeight = '600';
      label.style.textAlign = 'left';
      label.textContent = 'Modes';
      section.appendChild(label);
    }
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.alignItems = 'center';
    buttonsContainer.style.gap = 'var(--space-2)';
    buttonsContainer.style.alignSelf = 'center';
    
    // Track stack mode state
    let stackEnabled = false; // Start disabled by default
    
    // Stack mode toggle button
    const stackButton = window.UI.button({
      variant: 'ghost', // Start disabled
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
    buttonsContainer.appendChild(stackButton.element);
    
    // Set initial stack mode in editor
    this.editor.setStackMode(stackEnabled);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: stackButton.element, content: 'Stack Mode' });

    // Track replace mode state
    let replaceEnabled = true; // Start enabled by default
    
    // Replace mode toggle button
    const replaceButton = window.UI.button({
      variant: 'primary', // Start enabled
      size: 'sm',
      icon: 'refresh-cw',
      className: 'tool-button',
      onClick: () => {
        replaceEnabled = !replaceEnabled;
        this.editor.setReplaceMode(replaceEnabled);
        // Update button appearance
        if (replaceEnabled) {
          replaceButton.element.classList.add('btn-primary');
          replaceButton.element.classList.remove('btn-ghost');
        } else {
          replaceButton.element.classList.remove('btn-primary');
          replaceButton.element.classList.add('btn-ghost');
        }
      }
    });
    buttonsContainer.appendChild(replaceButton.element);
    
    // Set initial replace mode in editor
    this.editor.setReplaceMode(replaceEnabled);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: replaceButton.element, content: 'Replace Mode' });
    
    // Tile size toggle button
    const sizeButton = window.UI.button({
      variant: 'secondary',
      size: 'sm',
      text: '0.1',
      className: 'tool-button',
      onClick: () => this.cycleTileSize()
    });
    
    // Style the button text with monospace font and dark background
    sizeButton.element.style.fontFamily = 'var(--font-mono)';
    sizeButton.element.style.fontSize = 'var(--font-size-xs)';
    sizeButton.element.style.fontWeight = '600';
    sizeButton.element.style.backgroundColor = 'var(--bg-layer-4)';
    sizeButton.element.style.color = 'var(--text-primary)';
    
    buttonsContainer.appendChild(sizeButton.element);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: sizeButton.element, content: 'Tile Size: 0.1x0.1' });
    
    // Store reference for updating tooltip
    (sizeButton.element as any).sizeTooltip = 'Tile Size: 0.1x0.1';
    (this as any).sizeButton = sizeButton.element;
    
    section.appendChild(buttonsContainer);
    
    return section;
  }
  
  /**
   * Cycle through tile sizes: 0.1 -> 0.25 -> 0.5 -> 1.0 -> 0.1
   */
  private cycleTileSize(): void {
    if (this.currentTileSize === 0.1) {
      this.currentTileSize = 0.25;
    } else if (this.currentTileSize === 0.25) {
      this.currentTileSize = 0.5;
    } else if (this.currentTileSize === 0.5) {
      this.currentTileSize = 1.0;
    } else {
      this.currentTileSize = 0.1;
    }
    
    // Update button text based on size
    const sizeButton = (this as any).sizeButton;
    if (sizeButton) {
      // Update button text to show current size
      sizeButton.textContent = this.currentTileSize.toFixed(1);
      
      // Ensure button maintains proper styling and background
      sizeButton.classList.remove('btn-ghost');
      sizeButton.classList.add('btn-secondary');
      
      // Reapply custom text styling and dark background
      sizeButton.style.fontFamily = 'var(--font-mono)';
      sizeButton.style.fontSize = 'var(--font-size-xs)';
      sizeButton.style.fontWeight = '600';
      sizeButton.style.backgroundColor = 'var(--bg-layer-4)';
      sizeButton.style.color = 'var(--text-primary)';
      
      // Update tooltip
      const tooltipContent = `Tile Size: ${this.currentTileSize.toFixed(1)}x${this.currentTileSize.toFixed(1)}`;
      (sizeButton as any).sizeTooltip = tooltipContent;
      
      // Update existing tooltip if it exists
      const tooltip = document.querySelector(`[data-tooltip-target="${sizeButton.id}"]`);
      if (tooltip) {
        tooltip.textContent = tooltipContent;
      }
    }
    
    // Notify editor of size change
    this.editor.setTileSize(this.currentTileSize);
    
    console.log(`Tile size: ${this.currentTileSize.toFixed(1)}x${this.currentTileSize.toFixed(1)}`);
  }
  
  /**
   * Create clear section
   */
  private createClearSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.alignItems = 'flex-start';
    section.style.gap = 'var(--space-2)';
    
    if (!isMobile()) {
      // Add label above buttons
      const label = document.createElement('div');
      label.style.fontSize = 'var(--font-size-xs)';
      label.style.color = 'var(--text-secondary)';
      label.style.fontWeight = '600';
      label.style.textAlign = 'left';
      label.textContent = 'Actions';
      section.appendChild(label);
    }
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.alignItems = 'center';
    buttonsContainer.style.gap = 'var(--space-2)';
    buttonsContainer.style.alignSelf = 'center';
    
    // Undo button
    const undoBtn = window.UI.button({
      variant: 'ghost',
      size: 'sm',
      icon: 'undo-2',
      className: 'tool-button',
      onClick: () => {
        this.editor.undo();
      }
    });
    buttonsContainer.appendChild(undoBtn.element);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: undoBtn.element, content: 'Undo (Ctrl+Z)' });
    
    // Redo button
    const redoBtn = window.UI.button({
      variant: 'ghost',
      size: 'sm',
      icon: 'redo-2',
      className: 'tool-button',
      onClick: () => {
        this.editor.redo();
      }
    });
    buttonsContainer.appendChild(redoBtn.element);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: redoBtn.element, content: 'Redo (Ctrl+Y)' });
    
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
    buttonsContainer.appendChild(clearBtn.element);
    
    section.appendChild(buttonsContainer);
    
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
    section.style.flexDirection = 'column';
    section.style.alignItems = 'flex-start';
    section.style.gap = 'var(--space-2)';
    
    if (!isMobile()) {
      // Add label above buttons
      const label = document.createElement('div');
      label.style.fontSize = 'var(--font-size-xs)';
      label.style.color = 'var(--text-secondary)';
      label.style.fontWeight = '600';
      label.style.textAlign = 'left';
      label.textContent = 'Sky';
      section.appendChild(label);
    }
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.alignItems = 'center';
    buttonsContainer.style.gap = 'var(--space-2)';
    buttonsContainer.style.alignSelf = 'center';
    
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
    buttonsContainer.appendChild(skyButton.element);
    
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
    buttonsContainer.appendChild(aoButton.element);
    
    // Store tooltip info to create later
    this.tooltipsToCreate.push({ element: aoButton.element, content: 'Ambient Occlusion' });
    
    section.appendChild(buttonsContainer);
    
    // Initialize lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    return section;
  }
  
  private createTestSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.alignItems = 'flex-start';
    section.style.gap = 'var(--space-2)';
    
    if (!isMobile()) {
      // Add label above button
      const label = document.createElement('div');
      label.style.fontSize = 'var(--font-size-xs)';
      label.style.color = 'var(--text-secondary)';
      label.style.fontWeight = '600';
      label.style.textAlign = 'left';
      label.textContent = 'Test';
      section.appendChild(label);
    }
    
    // Stress test button - icon only
    const stressButton = window.UI.button({
      variant: 'ghost',
      size: 'sm',
      icon: 'zap',
      className: 'tool-button',
      onClick: () => this.runStressTest()
    });
    stressButton.element.style.alignSelf = 'center';
    
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
   * Handle mobile collapse/expand with slide animation
   */
  private handleMobileCollapse(collapsed: boolean): void {
    if (!this.element) return;
    
    if (collapsed) {
      // Slide down off canvas, keeping just the header visible
      const panelHeight = this.element.offsetHeight;
      const headerHeight = this.element.querySelector('.panel-header')?.clientHeight || 40;
      const slideDistance = panelHeight - headerHeight - 10; // Keep header + 10px visible
      this.element.style.transform = `translateY(${slideDistance}px)`;
    } else {
      // Slide back up to original position
      this.element.style.transform = 'translateY(0)';
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