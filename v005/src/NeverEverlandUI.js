
import { HealthBar } from './ui/HealthBar.js';
import { ManaBar } from './ui/ManaBar.js';
import { Hotbar } from './ui/Hotbar.js';
import { InventoryGrid } from './ui/InventoryGrid.js';
import { DamageNumberSystem } from './ui/DamageNumberSystem.js';
import { Minimap } from './ui/Minimap.js';
import { NeverEverlandGameState } from './NeverEverlandGameState.js';
import { NeverEverlandEventSystem } from './NeverEverlandEventSystem.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import { ResponsiveUIManager } from './ResponsiveUIManager.js';
import { PauseMenu } from './ui/PauseMenu.js';
import { ItemDetailModal } from './ui/ItemDetailModal.js';
import { DebugPanel } from './ui/DebugPanel.js';
import { TilePalette } from './ui/TilePalette.js';
import { PanelDragManager } from './ui/PanelDragManager.js';
import { RenderingPanel } from './ui/RenderingPanel.js';
import './core.js'; // Import core.js to make UI global available

export class NeverEverlandUI {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
    this.components = new Map();
    
    this.init();
  }

  init() {
    // Create UI container
    this.container = document.createElement('div');
    this.container.id = 'nevereverland-ui';
    this.container.className = 'game-ui-overlay';
    document.getElementById('game-container').appendChild(this.container);
    
    // Initialize subsystems
    this.eventSystem = new NeverEverlandEventSystem(
      this.gameEngine.renderer,
      this.container,
      this.gameEngine.camera,
      this.gameEngine.scene
    );
    
    this.stateManager = new NeverEverlandGameState();
    this.performanceMonitor = new PerformanceMonitor();
    this.responsiveManager = new ResponsiveUIManager();
    
    // Create UI components
    this.createComponents();

    // Pause Menu
    this.components.set('pauseMenu', new PauseMenu(this.container));

    // Item Detail Modal
    this.components.set('itemDetailModal', new ItemDetailModal(this.container));
    
    // Debug Panel
    this.components.set('debugPanel', new DebugPanel(this.container, this.gameEngine));

    // Event listeners
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.components.get('pauseMenu').toggle();
      }
      // Toggle debug panel with F3
      if (event.key === 'F3') {
        event.preventDefault();
        const debugPanel = this.components.get('debugPanel');
        if (debugPanel.element) {
          debugPanel.element.style.display = 
            debugPanel.element.style.display === 'none' ? 'block' : 'none';
        }
      }
      // Toggle tile palette with F4
      if (event.key === 'F4') {
        event.preventDefault();
        const tilePalette = this.components.get('tilePalette');
        if (tilePalette) {
          tilePalette.toggleVisibility();
        }
      }
    });
    
    // Set up state bindings
    this.bindStateToUI();
  }

  createComponents() {
    // Health/Mana bars
    const statusBarsContent = document.createElement('div');
    statusBarsContent.style.display = 'flex';
    statusBarsContent.style.flexDirection = 'column';
    statusBarsContent.style.gap = 'var(--space-2)';
    
    const statusBarsPanel = window.UI.panel('Status', statusBarsContent, {
      icon: 'activity',
      collapsible: true,
      startCollapsed: false
    });
    statusBarsPanel.className += ' status-bars-panel';
    statusBarsPanel.style.position = 'absolute';
    statusBarsPanel.style.top = 'var(--space-4)';
    statusBarsPanel.style.left = 'var(--space-4)';
    this.container.appendChild(statusBarsPanel);
    
    // Make status bars panel draggable
    PanelDragManager.makePanelDraggable(statusBarsPanel, 'status-bars');
    
    this.components.set('healthBar', new HealthBar(statusBarsContent));
    this.components.set('manaBar', new ManaBar(statusBarsContent));
    
    // Hotbar
    const hotbarContent = document.createElement('div');
    this.components.set('hotbar', new Hotbar(hotbarContent));
    
    const hotbarPanel = window.UI.panel('Hotbar', hotbarContent, {
      icon: 'package-2',
      collapsible: true,
      startCollapsed: false
    });
    hotbarPanel.className += ' hotbar-panel';
    hotbarPanel.style.position = 'absolute';
    hotbarPanel.style.bottom = 'var(--space-4)';
    hotbarPanel.style.left = '50%';
    hotbarPanel.style.transform = 'translateX(-50%)';
    this.container.appendChild(hotbarPanel);
    
    // Make hotbar panel draggable
    PanelDragManager.makePanelDraggable(hotbarPanel, 'hotbar');
    
    // Inventory
    const inventoryContent = document.createElement('div');
    this.components.set('inventory', new InventoryGrid(inventoryContent, this));
    
    const inventoryPanel = window.UI.panel('Inventory', inventoryContent, {
      icon: 'backpack',
      collapsible: true,
      startCollapsed: false
    });
    inventoryPanel.className += ' inventory-panel';
    inventoryPanel.style.position = 'absolute';
    inventoryPanel.style.bottom = 'var(--space-4)';
    inventoryPanel.style.right = 'var(--space-4)';
    this.container.appendChild(inventoryPanel);
    
    // Make inventory panel draggable
    PanelDragManager.makePanelDraggable(inventoryPanel, 'inventory');
    
    // Minimap
    this.components.set('minimap', new Minimap(200));
    const minimapCanvas = this.components.get('minimap').canvas;
    minimapCanvas.style.display = 'block';
    minimapCanvas.style.border = '2px solid var(--border-color)';
    minimapCanvas.style.borderRadius = 'var(--radius-sm)';
    
    const minimapPanel = window.UI.panel('Map', minimapCanvas, {
      icon: 'map',
      collapsible: true,
      startCollapsed: false
    });
    minimapPanel.className += ' minimap-panel';
    minimapPanel.style.position = 'absolute';
    minimapPanel.style.bottom = 'var(--space-4)';
    minimapPanel.style.left = 'var(--space-4)';
    this.container.appendChild(minimapPanel);
    
    // Make minimap panel draggable
    PanelDragManager.makePanelDraggable(minimapPanel, 'minimap');
    
    // Damage numbers
    const damageContainer = document.createElement('div');
    damageContainer.className = 'damage-numbers';
    this.container.appendChild(damageContainer);
    
    this.components.set('damageNumbers', new DamageNumberSystem(
      damageContainer,
      this.gameEngine.camera,
      this.gameEngine.renderer
    ));

    // Tile Palette (only if tile system is available)
    if (this.gameEngine.tileMapSystem) {
      this.components.set('tilePalette', new TilePalette(this.container, this.gameEngine.tileMapSystem));
    }
    
    // Rendering Panel (only if post-processing is available)
    if (this.gameEngine.postProcessingManager) {
      this.components.set('renderingPanel', new RenderingPanel(this.container, this.gameEngine));
    }

    // Initialize StyleUI icons
    window.UI.icons();
  }

  bindStateToUI() {
    // Health updates
    this.stateManager.subscribe('player.health', (health) => {
        const healthBar = this.components.get('healthBar');
        if (healthBar) {
            healthBar.updateHealth(health);
        }
    });
    
    // Mana updates
    this.stateManager.subscribe('player.mana', (mana) => {
      const manaBar = this.components.get('manaBar');
      if (manaBar) {
        manaBar.updateMana(mana);
      }
    });
  }

  update(deltaTime) {
    this.performanceMonitor.startFrame();
    
    // Update components that need per-frame updates
    this.performanceMonitor.measureUIUpdate(() => {
      // Update minimap
      const minimap = this.components.get('minimap');
      
      // Get tiles from tileMapSystem if available
      let tiles = null;
      if (this.gameEngine.tileMapSystem) {
        tiles = this.gameEngine.tileMapSystem.tiles;
      }
      
      minimap.render(
        this.gameEngine.player.position,
        this.gameEngine.getVisibleEntities(),
        this.gameEngine.mapBounds,
        tiles
      );
      
      // Update damage numbers positions
      this.components.get('damageNumbers').update();
      
      // Update debug panel
      const debugPanel = this.components.get('debugPanel');
      if (debugPanel && debugPanel.element.style.display !== 'none') {
        debugPanel.update();
      }
    });
    
    this.performanceMonitor.endFrame();
  }

  showDamage(amount, position, type = 'damage') {
    this.components.get('damageNumbers').spawn(amount, position, type);
  }

  destroy() {
    // Clean up all components
    this.components.forEach(component => {
      if (component.destroy) {
        component.destroy();
      }
    });
    
    // Remove container
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
