# StyleUI and Three.js Integration Guide for Never Everland

## Research Findings and Library Status

After extensive investigation, the specific StyleUI library at https://github.com/DangerDrome/StyleUI could not be accessed. The repository appears to be either private, removed, or under a different location. However, I've compiled comprehensive strategies for integrating modern UI libraries with Three.js games that will apply to StyleUI or any similar component-based framework.

## Core Architecture Patterns for Game UI Libraries

Modern game UI libraries typically follow a **component-based architecture** with these characteristics:
- Functional or class-based components with lifecycle management
- Props-based configuration for customization
- Event-driven communication between components
- State management through hooks or centralized stores
- CSS-in-JS or modular CSS for isolated styling

For Three.js games, the recommended approach combines HTML/CSS overlays positioned over the WebGL canvas, providing better performance and easier styling than rendering UI directly in WebGL.

## Performance Optimization for 60fps Gaming

Maintaining smooth 60fps performance requires careful frame budget allocation. Your Never Everland game should follow these guidelines:

### Frame Budget Distribution
For each 16.67ms frame:
- **GPU Rendering**: 8-12ms (Three.js scene rendering)
- **CPU Processing**: 4-6ms (game logic, physics)
- **UI Updates**: 1-2ms (StyleUI components)
- **Buffer**: 2-4ms (garbage collection, system overhead)

### Critical Performance Strategies

**Layered Canvas Architecture** provides optimal separation:
```javascript
// Never Everland UI setup
const gameContainer = document.getElementById('game-container');

// Three.js canvas (bottom layer)
const gameCanvas = document.createElement('canvas');
gameCanvas.style.position = 'absolute';
gameCanvas.style.zIndex = '1';

// UI overlay (top layer)
const uiOverlay = document.createElement('div');
uiOverlay.id = 'ui-overlay';
uiOverlay.style.position = 'absolute';
uiOverlay.style.zIndex = '10';
uiOverlay.style.pointerEvents = 'none'; // Allow clicks through empty areas

gameContainer.appendChild(gameCanvas);
gameContainer.appendChild(uiOverlay);
```

**Event-Driven UI Updates** minimize unnecessary renders:
```javascript
class NeverEverlandUIManager {
  constructor() {
    this.updateQueue = new Set();
    this.isUpdateScheduled = false;
  }

  scheduleUpdate(component) {
    this.updateQueue.add(component);
    
    if (!this.isUpdateScheduled) {
      this.isUpdateScheduled = true;
      requestAnimationFrame(() => this.processUpdates());
    }
  }

  processUpdates() {
    this.updateQueue.forEach(component => component.update());
    this.updateQueue.clear();
    this.isUpdateScheduled = false;
  }
}
```

## Game-Specific UI Component Implementation

### Health Bar System

Create a responsive health bar that smoothly animates damage and healing:

```javascript
class HealthBar {
  constructor(container) {
    this.container = container;
    this.currentHealth = 100;
    this.maxHealth = 100;
    this.animationFrame = null;
    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.element.className = 'health-bar';
    this.element.innerHTML = `
      <div class="health-background"></div>
      <div class="health-damage-preview"></div>
      <div class="health-fill"></div>
      <div class="health-text"></div>
    `;
    this.container.appendChild(this.element);
    
    this.fillElement = this.element.querySelector('.health-fill');
    this.damagePreview = this.element.querySelector('.health-damage-preview');
    this.textElement = this.element.querySelector('.health-text');
  }

  updateHealth(newHealth, showDamagePreview = true) {
    const oldHealth = this.currentHealth;
    this.currentHealth = Math.max(0, Math.min(newHealth, this.maxHealth));
    
    // Show damage preview for 500ms
    if (showDamagePreview && newHealth < oldHealth) {
      this.damagePreview.style.width = `${(oldHealth / this.maxHealth) * 100}%`;
      setTimeout(() => {
        this.damagePreview.style.width = `${(this.currentHealth / this.maxHealth) * 100}%`;
      }, 500);
    }
    
    // Animate health bar
    this.animateHealthChange();
  }

  animateHealthChange() {
    const targetWidth = (this.currentHealth / this.maxHealth) * 100;
    this.fillElement.style.width = `${targetWidth}%`;
    this.textElement.textContent = `${Math.floor(this.currentHealth)}/${this.maxHealth}`;
    
    // Add pulse effect for critical health
    if (this.currentHealth / this.maxHealth < 0.25) {
      this.element.classList.add('critical');
    } else {
      this.element.classList.remove('critical');
    }
  }
}
```

### Inventory Grid with Drag-and-Drop

Implement a flexible inventory system for Never Everland:

```javascript
class InventoryGrid {
  constructor(container, rows = 5, cols = 8) {
    this.container = container;
    this.rows = rows;
    this.cols = cols;
    this.slots = [];
    this.items = new Map();
    this.init();
  }

  init() {
    this.gridElement = document.createElement('div');
    this.gridElement.className = 'inventory-grid';
    this.gridElement.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    
    for (let i = 0; i < this.rows * this.cols; i++) {
      const slot = this.createSlot(i);
      this.slots.push(slot);
      this.gridElement.appendChild(slot);
    }
    
    this.container.appendChild(this.gridElement);
    this.setupDragAndDrop();
  }

  createSlot(index) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    slot.dataset.slotIndex = index;
    slot.addEventListener('dragover', this.handleDragOver.bind(this));
    slot.addEventListener('drop', this.handleDrop.bind(this));
    return slot;
  }

  addItem(item, slotIndex = null) {
    const targetSlot = slotIndex ?? this.findEmptySlot();
    if (targetSlot === -1) return false;
    
    const itemElement = document.createElement('div');
    itemElement.className = 'inventory-item';
    itemElement.draggable = true;
    itemElement.dataset.itemId = item.id;
    itemElement.innerHTML = `
      <img src="${item.icon}" alt="${item.name}">
      <span class="item-quantity">${item.quantity || ''}</span>
    `;
    
    itemElement.addEventListener('dragstart', this.handleDragStart.bind(this));
    this.slots[targetSlot].appendChild(itemElement);
    this.items.set(item.id, { ...item, slot: targetSlot });
    
    return true;
  }

  handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', e.target.dataset.itemId);
    e.dataTransfer.setData('fromSlot', e.target.parentElement.dataset.slotIndex);
  }

  handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const itemId = e.dataTransfer.getData('itemId');
    const fromSlot = parseInt(e.dataTransfer.getData('fromSlot'));
    const toSlot = parseInt(e.currentTarget.dataset.slotIndex);
    
    this.moveItem(itemId, fromSlot, toSlot);
    return false;
  }
}
```

### Dynamic Damage Numbers

Create an efficient pooled system for combat feedback:

```javascript
class DamageNumberSystem {
  constructor(container, camera, renderer) {
    this.container = container;
    this.camera = camera;
    this.renderer = renderer;
    this.pool = [];
    this.active = [];
    this.poolSize = 50;
    
    this.initPool();
  }

  initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      const element = document.createElement('div');
      element.className = 'damage-number';
      element.style.position = 'absolute';
      element.style.display = 'none';
      this.container.appendChild(element);
      this.pool.push(element);
    }
  }

  spawn(damage, worldPosition, type = 'damage') {
    const element = this.pool.pop() || this.createNew();
    const screenPos = this.worldToScreen(worldPosition);
    
    element.textContent = Math.abs(damage);
    element.className = `damage-number ${type}`;
    element.style.left = `${screenPos.x}px`;
    element.style.top = `${screenPos.y}px`;
    element.style.display = 'block';
    
    // Critical hit effect
    if (damage > 100) {
      element.classList.add('critical');
    }
    
    const animation = element.animate([
      { 
        transform: 'translateY(0) scale(1)', 
        opacity: 1 
      },
      { 
        transform: 'translateY(-80px) scale(0.8)', 
        opacity: 0 
      }
    ], {
      duration: 1500,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });
    
    animation.onfinish = () => this.release(element);
    this.active.push({ element, animation, worldPosition });
  }

  worldToScreen(worldPos) {
    const vector = worldPos.clone();
    vector.project(this.camera);
    
    const canvas = this.renderer.domElement;
    const x = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
    const y = (-vector.y * 0.5 + 0.5) * canvas.clientHeight;
    
    return { x, y };
  }

  update() {
    // Update positions for moving targets
    this.active.forEach(({ element, worldPosition }) => {
      const screenPos = this.worldToScreen(worldPosition);
      element.style.left = `${screenPos.x}px`;
      element.style.top = `${screenPos.y}px`;
    });
  }

  release(element) {
    element.style.display = 'none';
    element.className = 'damage-number';
    this.pool.push(element);
    this.active = this.active.filter(item => item.element !== element);
  }
}
```

### Minimap Implementation

Create a performant minimap for spatial awareness:

```javascript
class Minimap {
  constructor(size = 200) {
    this.size = size;
    this.scale = 0.1;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.className = 'minimap';
    this.ctx = this.canvas.getContext('2d');
    
    this.icons = {
      player: { color: '#00ff00', size: 6 },
      enemy: { color: '#ff0000', size: 4 },
      npc: { color: '#ffff00', size: 4 },
      objective: { color: '#00ffff', size: 8 }
    };
  }

  render(playerPos, entities, mapBounds) {
    // Clear canvas
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.size, this.size);
    
    // Draw map features
    this.drawMapFeatures(mapBounds);
    
    // Draw entities
    entities.forEach(entity => {
      const relativePos = {
        x: (entity.position.x - playerPos.x) * this.scale + this.size / 2,
        z: (entity.position.z - playerPos.z) * this.scale + this.size / 2
      };
      
      if (this.isInBounds(relativePos)) {
        this.drawEntity(relativePos, entity.type);
      }
    });
    
    // Draw player (always center)
    this.drawPlayer();
    
    // Draw direction indicator
    this.drawDirectionIndicator(playerPos.rotation);
  }

  drawEntity(pos, type) {
    const icon = this.icons[type] || { color: '#ffffff', size: 3 };
    this.ctx.fillStyle = icon.color;
    this.ctx.fillRect(
      pos.x - icon.size / 2,
      pos.z - icon.size / 2,
      icon.size,
      icon.size
    );
  }

  drawPlayer() {
    this.ctx.fillStyle = this.icons.player.color;
    this.ctx.beginPath();
    this.ctx.arc(this.size / 2, this.size / 2, this.icons.player.size, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
```

## Three.js Integration Architecture

### Event Handling System

Implement a robust event system that prevents UI/3D conflicts:

```javascript
class NeverEverlandEventSystem {
  constructor(renderer, uiContainer) {
    this.renderer = renderer;
    this.uiContainer = uiContainer;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    const canvas = this.renderer.domElement;
    
    // Unified mouse handling
    canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    
    // Touch support
    canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  }

  handleMouseDown(event) {
    // Check if clicking on UI first
    const uiElement = document.elementFromPoint(event.clientX, event.clientY);
    if (uiElement && uiElement.closest('#ui-overlay')) {
      return; // UI handles this
    }
    
    this.isDragging = true;
    this.updateMousePosition(event);
    
    // Perform 3D raycasting
    this.performRaycast((intersects) => {
      if (intersects.length > 0) {
        const object = intersects[0].object;
        this.handle3DInteraction(object, 'click');
      }
    });
  }

  updateMousePosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  performRaycast(callback) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    callback(intersects);
  }
}
```

### State Synchronization

Create a centralized state manager for UI and game logic:

```javascript
class NeverEverlandGameState {
  constructor() {
    this.state = {
      player: {
        health: 100,
        maxHealth: 100,
        mana: 50,
        maxMana: 50,
        level: 1,
        experience: 0,
        position: new THREE.Vector3(),
        inventory: []
      },
      world: {
        timeOfDay: 12,
        weather: 'clear',
        activeQuests: [],
        npcs: new Map(),
        enemies: new Map()
      },
      ui: {
        activeMenu: null,
        selectedTarget: null,
        chatMessages: [],
        notifications: []
      }
    };
    
    this.subscribers = new Map();
  }

  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    this.subscribers.get(path).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(path).delete(callback);
    };
  }

  update(path, value) {
    // Update state
    const keys = path.split('.');
    let current = this.state;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    const oldValue = current[keys[keys.length - 1]];
    current[keys[keys.length - 1]] = value;
    
    // Notify subscribers
    this.notifySubscribers(path, value, oldValue);
  }

  notifySubscribers(path, newValue, oldValue) {
    // Notify exact path subscribers
    if (this.subscribers.has(path)) {
      this.subscribers.get(path).forEach(callback => {
        callback(newValue, oldValue);
      });
    }
    
    // Notify parent path subscribers
    const parentPath = path.substring(0, path.lastIndexOf('.'));
    if (parentPath && this.subscribers.has(parentPath)) {
      this.subscribers.get(parentPath).forEach(callback => {
        callback(this.getState(parentPath));
      });
    }
  }
}
```

## Best Practices for Never Everland Integration

### 1. Component Lifecycle Management

Ensure proper cleanup to prevent memory leaks:

```javascript
class UIComponent {
  constructor() {
    this.subscriptions = [];
    this.eventListeners = [];
    this.animationFrames = [];
  }

  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  subscribe(observable, callback) {
    const unsubscribe = observable.subscribe(callback);
    this.subscriptions.push(unsubscribe);
  }

  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    
    // Cancel subscriptions
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    
    // Cancel animation frames
    this.animationFrames.forEach(id => cancelAnimationFrame(id));
    
    // Remove DOM elements
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
```

### 2. Responsive Scaling System

Implement adaptive UI scaling for different devices:

```javascript
class ResponsiveUIManager {
  constructor() {
    this.baseWidth = 1920;
    this.baseHeight = 1080;
    this.scaleFactor = 1;
    
    this.updateScale();
    window.addEventListener('resize', () => this.updateScale());
  }

  updateScale() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Calculate scale factor
    const scaleX = width / this.baseWidth;
    const scaleY = height / this.baseHeight;
    this.scaleFactor = Math.min(scaleX, scaleY);
    
    // Apply to UI root
    document.documentElement.style.setProperty('--ui-scale', this.scaleFactor);
    
    // Adjust for mobile
    if (width < 768) {
      document.body.classList.add('mobile-ui');
      this.adjustMobileLayout();
    } else {
      document.body.classList.remove('mobile-ui');
    }
  }

  adjustMobileLayout() {
    // Move UI elements for mobile
    const hotbar = document.querySelector('.hotbar');
    if (hotbar) {
      hotbar.style.bottom = '80px'; // Higher for thumb reach
    }
  }
}
```

### 3. Performance Monitoring

Track UI performance impact:

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 60,
      frameTime: 0,
      uiUpdateTime: 0,
      drawCalls: 0
    };
    
    this.lastFrame = performance.now();
  }

  startFrame() {
    this.frameStart = performance.now();
  }

  measureUIUpdate(callback) {
    const start = performance.now();
    callback();
    this.metrics.uiUpdateTime = performance.now() - start;
  }

  endFrame() {
    const now = performance.now();
    this.metrics.frameTime = now - this.frameStart;
    this.metrics.fps = 1000 / (now - this.lastFrame);
    this.lastFrame = now;
    
    // Warn if frame budget exceeded
    if (this.metrics.frameTime > 16.67) {
      console.warn(`Frame budget exceeded: ${this.metrics.frameTime.toFixed(2)}ms`);
    }
  }
}
```

## Complete Integration Example

Here's how to initialize the complete UI system for Never Everland:

```javascript
class NeverEverlandUI {
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
    document.body.appendChild(this.container);
    
    // Initialize subsystems
    this.eventSystem = new NeverEverlandEventSystem(
      this.gameEngine.renderer,
      this.container
    );
    
    this.stateManager = new NeverEverlandGameState();
    this.performanceMonitor = new PerformanceMonitor();
    this.responsiveManager = new ResponsiveUIManager();
    
    // Create UI components
    this.createComponents();
    
    // Set up state bindings
    this.bindStateToUI();
  }

  createComponents() {
    // Health/Mana bars
    const statusBars = document.createElement('div');
    statusBars.className = 'status-bars';
    this.container.appendChild(statusBars);
    
    this.components.set('healthBar', new HealthBar(statusBars));
    this.components.set('manaBar', new ManaBar(statusBars));
    
    // Inventory
    const inventoryContainer = document.createElement('div');
    inventoryContainer.className = 'inventory-container';
    this.container.appendChild(inventoryContainer);
    
    this.components.set('inventory', new InventoryGrid(inventoryContainer));
    
    // Hotbar
    const hotbarContainer = document.createElement('div');
    hotbarContainer.className = 'hotbar-container';
    this.container.appendChild(hotbarContainer);
    
    this.components.set('hotbar', new Hotbar(hotbarContainer));
    
    // Minimap
    const minimapContainer = document.createElement('div');
    minimapContainer.className = 'minimap-container';
    this.container.appendChild(minimapContainer);
    
    this.components.set('minimap', new Minimap(200));
    minimapContainer.appendChild(this.components.get('minimap').canvas);
    
    // Damage numbers
    const damageContainer = document.createElement('div');
    damageContainer.className = 'damage-numbers';
    this.container.appendChild(damageContainer);
    
    this.components.set('damageNumbers', new DamageNumberSystem(
      damageContainer,
      this.gameEngine.camera,
      this.gameEngine.renderer
    ));
  }

  bindStateToUI() {
    // Health updates
    this.stateManager.subscribe('player.health', (health) => {
      this.components.get('healthBar').updateHealth(health);
    });
    
    // Mana updates
    this.stateManager.subscribe('player.mana', (mana) => {
      this.components.get('manaBar').updateMana(mana);
    });
    
    // Inventory updates
    this.stateManager.subscribe('player.inventory', (inventory) => {
      this.components.get('inventory').updateItems(inventory);
    });
  }

  update(deltaTime) {
    this.performanceMonitor.startFrame();
    
    // Update components that need per-frame updates
    this.performanceMonitor.measureUIUpdate(() => {
      // Update minimap
      const minimap = this.components.get('minimap');
      minimap.render(
        this.gameEngine.player.position,
        this.gameEngine.getVisibleEntities(),
        this.gameEngine.mapBounds
      );
      
      // Update damage numbers positions
      this.components.get('damageNumbers').update();
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
    this.container.remove();
  }
}

// Initialize with game engine
const ui = new NeverEverlandUI(gameEngine);
```

## Conclusion

While the specific DangerDrome/StyleUI library could not be accessed, this comprehensive guide provides battle-tested strategies for integrating any modern UI library with Three.js games. The architecture patterns, performance optimizations, and component implementations are designed specifically for the needs of Never Everland and similar 3D web games.

The key to success lies in maintaining clear separation between UI and 3D rendering layers, implementing efficient update patterns, and using event-driven architecture for loose coupling between systems. By following these patterns and leveraging the provided code examples, you can create a responsive, performant UI system that enhances the gameplay experience while maintaining smooth 60fps performance across all devices.