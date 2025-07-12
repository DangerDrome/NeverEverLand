import * as THREE from 'three';
import { PanelDragManager } from './PanelDragManager.js';

export class DebugPanel {
  constructor(container, gameEngine) {
    this.container = container;
    this.gameEngine = gameEngine;
    this.stats = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
    };
    
    this.history = {
      fps: new Array(60).fill(0),
      frameTime: new Array(60).fill(0),
      drawCalls: new Array(60).fill(0)
    };
    
    this.lastTime = performance.now();
    this.frames = 0;
    this.element = null;
    this.axesRenderer = null;
    this.axesScene = null;
    this.axesCamera = null;
    
    this.init();
  }
  
  init() {
    const content = document.createElement('div');
    content.style.fontSize = 'var(--font-size-xs)';
    content.style.fontFamily = 'var(--font-mono)';
    
    // Create sections for different stats
    this.createControlsSection(content); // 3D Orientation first
    this.createStatsSection(content); // Combined Performance & Renderer stats
    
    // Create the panel with custom actions
    this.element = window.UI.panel('Control Panel', content, {
      icon: 'settings',
      collapsible: true,
      closable: true,
      startCollapsed: false,
      actions: [
        {
          icon: document.body.classList.contains('dark') ? 'moon' : 'sun',
          variant: 'ghost',
          onclick: () => {
            const newTheme = window.UI.theme.toggle();
            // Find and update the theme icon - it's the first panel-action-btn
            const themeBtn = this.element.querySelector('.panel-header .panel-action-btn');
            if (themeBtn) {
              const icon = themeBtn.querySelector('.lucide');
              if (icon) {
                icon.setAttribute('data-lucide', newTheme === 'dark' ? 'moon' : 'sun');
                window.UI.icons();
              }
            }
          }
        }
      ]
    });
    
    this.element.className += ' debug-panel control-panel';
    this.element.style.position = 'absolute';
    this.element.style.width = '300px';
    this.element.style.top = 'var(--space-4)';
    this.element.style.right = 'var(--space-4)';
    
    this.container.appendChild(this.element);
    
    // Make panel draggable
    PanelDragManager.makePanelDraggable(this.element, 'control-panel');
  }
  
  createStatsSection(parent) {
    const section = document.createElement('div');
    section.className = 'debug-section';
    section.style.marginBottom = 'var(--space-3)';
    
    const title = document.createElement('h4');
    title.textContent = 'Stats';
    title.style.margin = '0 0 var(--space-2) 0';
    title.style.color = 'var(--text-secondary)';
    section.appendChild(title);
    
    // Create table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'separate';
    table.style.borderSpacing = '0';
    table.style.fontSize = 'var(--font-size-xs)';
    table.style.backgroundColor = 'var(--bg-layer-3)';
    table.style.borderRadius = 'var(--radius-md)';
    table.style.overflow = 'hidden';
    table.style.border = 'none';
    
    const tbody = document.createElement('tbody');
    
    // Performance stats
    const fpsRow = this.createTableRow('FPS', '0', 'Frame', '0ms');
    tbody.appendChild(fpsRow);
    this.fpsDisplay = fpsRow.cells[1];
    this.frameTimeDisplay = fpsRow.cells[3];
    
    // Renderer stats
    const drawRow = this.createTableRow('Draws', '0', 'Tris', '0');
    tbody.appendChild(drawRow);
    this.drawCallsDisplay = drawRow.cells[1];
    this.trianglesDisplay = drawRow.cells[3];
    
    const geoRow = this.createTableRow('Geom', '0', 'Tex', '0');
    tbody.appendChild(geoRow);
    this.geometriesDisplay = geoRow.cells[1];
    this.texturesDisplay = geoRow.cells[3];
    
    const progRow = this.createTableRow('Prog', '0', '', '');
    tbody.appendChild(progRow);
    this.programsDisplay = progRow.cells[1];
    
    table.appendChild(tbody);
    section.appendChild(table);
    parent.appendChild(section);
  }
  
  createTableRow(label1, value1, label2, value2) {
    const row = document.createElement('tr');
    
    const labelCell1 = document.createElement('td');
    labelCell1.textContent = label1 + ':';
    labelCell1.style.color = 'var(--text-secondary)';
    labelCell1.style.padding = 'var(--space-1) var(--space-2)';
    labelCell1.style.width = 'auto';
    
    const valueCell1 = document.createElement('td');
    valueCell1.textContent = value1;
    valueCell1.style.color = 'var(--text-primary)';
    valueCell1.style.fontWeight = 'var(--font-bold)';
    valueCell1.style.padding = 'var(--space-1) var(--space-3) var(--space-1) var(--space-1)';
    valueCell1.style.width = 'auto';
    
    const labelCell2 = document.createElement('td');
    labelCell2.textContent = label2 ? label2 + ':' : '';
    labelCell2.style.color = 'var(--text-secondary)';
    labelCell2.style.padding = 'var(--space-1) var(--space-2)';
    labelCell2.style.width = 'auto';
    
    const valueCell2 = document.createElement('td');
    valueCell2.textContent = value2;
    valueCell2.style.color = 'var(--text-primary)';
    valueCell2.style.fontWeight = 'var(--font-bold)';
    valueCell2.style.padding = 'var(--space-1) var(--space-2)';
    valueCell2.style.width = 'auto';
    
    row.appendChild(labelCell1);
    row.appendChild(valueCell1);
    row.appendChild(labelCell2);
    row.appendChild(valueCell2);
    
    return row;
  }
  
  
  createControlsSection(parent) {
    const section = document.createElement('div');
    section.className = 'debug-section';
    section.style.marginBottom = 'var(--space-3)';
    
    const title = document.createElement('h4');
    title.textContent = '3d Info';
    title.style.margin = '0 0 var(--space-2) 0';
    title.style.color = 'var(--text-secondary)';
    section.appendChild(title);
    
    // Create container for axes and graphs side by side
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = 'var(--space-3)';
    container.style.alignItems = 'flex-start';
    
    // Left side: 3D axes viewer
    const axesWrapper = document.createElement('div');
    axesWrapper.style.flex = '0 0 150px';
    
    const axesCanvas = document.createElement('canvas');
    axesCanvas.width = 150;
    axesCanvas.height = 150;
    axesCanvas.style.width = '150px';
    axesCanvas.style.height = '150px';
    axesCanvas.style.background = 'var(--bg-layer-4)';
    axesCanvas.style.borderRadius = 'var(--radius-sm)';
    
    this.axesCanvas = axesCanvas;
    this.setupAxesViewer();
    axesWrapper.appendChild(axesCanvas);
    
    // Right side: Performance graphs
    const graphsWrapper = document.createElement('div');
    graphsWrapper.style.flex = '1';
    graphsWrapper.style.display = 'flex';
    graphsWrapper.style.flexDirection = 'column';
    graphsWrapper.style.gap = 'var(--space-2)';
    
    // Create mini graphs here
    this.createMiniGraphs(graphsWrapper);
    
    container.appendChild(axesWrapper);
    container.appendChild(graphsWrapper);
    section.appendChild(container);
    parent.appendChild(section);
  }
  
  createMiniGraphs(parent) {
    // Mini FPS Graph
    this.fpsCanvas = this.createMiniGraph('FPS', 'success');
    parent.appendChild(this.fpsCanvas);
    
    // Mini Frame Time Graph
    this.frameTimeCanvas = this.createMiniGraph('Frame Time', 'warning');
    parent.appendChild(this.frameTimeCanvas);
    
    // Mini Draw Calls Graph
    this.drawCallsCanvas = this.createMiniGraph('Draw Calls', 'info');
    parent.appendChild(this.drawCallsCanvas);
  }
  
  createMiniGraph(title, colorClass) {
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '100%';
    
    // Canvas for graph
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 44;
    canvas.style.width = '100%';
    canvas.style.height = '44px';
    canvas.style.background = 'var(--bg-layer-4)';
    canvas.style.borderRadius = 'var(--radius-sm)';
    container.appendChild(canvas);
    
    // Label as a tag inside the graph
    const label = document.createElement('span');
    label.className = `tag tag-${colorClass}`;
    label.textContent = title;
    label.style.fontSize = 'var(--font-size-3xs)';
    label.style.padding = 'var(--space-0-5) var(--space-1)';
    label.style.position = 'absolute';
    label.style.top = 'var(--space-1)';
    label.style.left = 'var(--space-1)';
    container.appendChild(label);
    
    return container;
  }
  
  createGraphsSection(parent) {
    // This section can be removed or repurposed since graphs are now in the controls section
  }
  
  
  createGraph(title) {
    const container = document.createElement('div');
    container.style.marginBottom = 'var(--space-3)';
    
    const label = document.createElement('div');
    label.textContent = title;
    label.style.fontSize = 'var(--font-size-2xs)';
    label.style.color = 'var(--text-secondary)';
    label.style.marginBottom = 'var(--space-1)';
    container.appendChild(label);
    
    const canvas = document.createElement('canvas');
    canvas.width = 250;
    canvas.height = 50;
    canvas.style.width = '100%';
    canvas.style.height = '50px';
    canvas.style.background = 'var(--bg-layer-4)'; // Dark background
    canvas.style.borderRadius = 'var(--radius-sm)';
    container.appendChild(canvas);
    
    return container;
  }
  
  update() {
    const now = performance.now();
    
    // Calculate instantaneous FPS from frame-to-frame time
    if (this.lastFrameTime) {
      const frameDelta = now - this.lastFrameTime;
      const instantFPS = 1000 / frameDelta;
      
      // Add to rolling average
      if (!this.fpsBuffer) {
        this.fpsBuffer = [];
      }
      this.fpsBuffer.push(instantFPS);
      if (this.fpsBuffer.length > 10) {
        this.fpsBuffer.shift();
      }
      
      // Calculate average FPS
      const avgFPS = this.fpsBuffer.reduce((a, b) => a + b, 0) / this.fpsBuffer.length;
      this.stats.fps = Math.round(avgFPS);
      this.stats.frameTime = 1000 / avgFPS;
      
      // Update history every few frames
      if (!this.historyCounter) this.historyCounter = 0;
      this.historyCounter++;
      
      if (this.historyCounter >= 6) { // Update history ~10 times per second at 60fps
        this.history.fps.shift();
        this.history.fps.push(this.stats.fps);
        
        this.history.frameTime.shift();
        this.history.frameTime.push(this.stats.frameTime);
        
        this.historyCounter = 0;
      }
    }
    
    this.lastFrameTime = now;
    
    // Get renderer info
    if (this.gameEngine.renderer) {
      const info = this.gameEngine.renderer.info;
      this.stats.drawCalls = info.render.calls;
      this.stats.triangles = info.render.triangles;
      this.stats.geometries = info.memory.geometries;
      this.stats.textures = info.memory.textures;
      this.stats.programs = info.programs ? info.programs.length : 0;
      
      // Update draw calls history
      if (this.history.drawCalls[this.history.drawCalls.length - 1] !== info.render.calls) {
        this.history.drawCalls.shift();
        this.history.drawCalls.push(info.render.calls);
      }
    }
    
    this.updateDisplay();
    this.updateGraphs();
    this.updateAxesViewer();
  }
  
  updateDisplay() {
    this.fpsDisplay.textContent = `${this.stats.fps}`;
    this.frameTimeDisplay.textContent = `${this.stats.frameTime.toFixed(2)}ms`;
    this.drawCallsDisplay.textContent = `${this.stats.drawCalls}`;
    this.trianglesDisplay.textContent = `${this.formatNumber(this.stats.triangles)}`;
    this.geometriesDisplay.textContent = `${this.stats.geometries}`;
    this.texturesDisplay.textContent = `${this.stats.textures}`;
    this.programsDisplay.textContent = `${this.stats.programs}`;
  }
  
  updateGraphs() {
    if (this.fpsCanvas) {
      this.drawMiniGraph(this.fpsCanvas.querySelector('canvas'), this.history.fps, 120, 'var(--success)');
    }
    if (this.frameTimeCanvas) {
      this.drawMiniGraph(this.frameTimeCanvas.querySelector('canvas'), this.history.frameTime, 33.33, 'var(--warning)');
    }
    if (this.drawCallsCanvas) {
      this.drawMiniGraph(this.drawCallsCanvas.querySelector('canvas'), this.history.drawCalls, Math.max(...this.history.drawCalls) || 100, 'var(--info)');
    }
  }
  
  drawMiniGraph(canvas, data, maxValue, color) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // No grid lines for mini graphs - keep them clean
    
    // Draw data
    const computedStyle = getComputedStyle(document.documentElement);
    ctx.strokeStyle = computedStyle.getPropertyValue(color.replace('var(', '').replace(')', ''));
    ctx.lineWidth = 1.5;
    
    // Show more data points with larger canvas
    const recentData = data.slice(-40);
    
    ctx.beginPath();
    recentData.forEach((value, index) => {
      const x = (index / (recentData.length - 1)) * width;
      const y = height - (value / maxValue) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }
  
  drawGraph(canvas, data, maxValue, color) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; // Light grid lines on dark background
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
    
    // Draw data
    const computedStyle = getComputedStyle(document.documentElement);
    ctx.strokeStyle = computedStyle.getPropertyValue(color.replace('var(', '').replace(')', ''));
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - (value / maxValue) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }
  
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
  
  setupAxesViewer() {
    if (!this.axesCanvas) return;
    
    // Create mini renderer for axes
    this.axesRenderer = new THREE.WebGLRenderer({ 
      canvas: this.axesCanvas, 
      alpha: true,
      antialias: true 
    });
    this.axesRenderer.setSize(150, 150);
    this.axesRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Create mini scene
    this.axesScene = new THREE.Scene();
    
    // Create mini camera - zoomed out even more for padding
    this.axesCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
    this.axesCamera.position.set(4, 4, 4);
    this.axesCamera.lookAt(0, 0.2, 0); // Look slightly above center to pan down
    
    // Create axes helper with semantic colors
    const axesHelper = new THREE.AxesHelper(1);
    // X = error (red), Y = success (green), Z = info (blue)
    axesHelper.setColors(
      new THREE.Color('var(--error)'.replace('var(--error)', '#ef4444')), // red
      new THREE.Color('var(--success)'.replace('var(--success)', '#10b981')), // green
      new THREE.Color('var(--info)'.replace('var(--info)', '#3b82f6')) // blue
    );
    this.axesScene.add(axesHelper);
    
    // Add labels using sprites with circular tag appearance
    const createLabel = (text, colorClass, bgColor, position) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 128;
      canvas.height = 128;
      
      // Draw circular tag background
      context.fillStyle = bgColor;
      context.beginPath();
      context.arc(64, 64, 48, 0, Math.PI * 2);
      context.fill();
      
      // Draw text - much bigger
      context.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Dark text
      context.font = 'bold 56px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 64, 64);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position);
      sprite.scale.set(0.6, 0.6, 1); // Square aspect ratio for circle
      
      return sprite;
    };
    
    // Add axis labels with semantic colors - positioned to prevent clipping
    this.axesScene.add(createLabel('X', 'error', '#ef4444', new THREE.Vector3(1.2, 0, 0)));
    this.axesScene.add(createLabel('Y', 'success', '#10b981', new THREE.Vector3(0, 1.2, 0)));
    this.axesScene.add(createLabel('Z', 'info', '#3b82f6', new THREE.Vector3(0, 0, 1.2)));
  }
  
  updateAxesViewer() {
    if (!this.axesRenderer || !this.axesScene || !this.axesCamera) return;
    
    // Sync axes viewer camera with main camera orientation
    const mainCamera = this.gameEngine.camera;
    if (mainCamera) {
      // Get the camera's rotation
      const quaternion = mainCamera.quaternion.clone();
      
      // Apply inverse rotation to axes camera - keep same distance as initial setup
      const distance = 5.7; // Match the increased distance for more padding
      const cameraPosition = new THREE.Vector3(0, 0, distance);
      cameraPosition.applyQuaternion(quaternion);
      
      this.axesCamera.position.copy(cameraPosition);
      this.axesCamera.lookAt(0, 0.2, 0); // Keep the same slight pan down
      
      // Render the axes
      this.axesRenderer.render(this.axesScene, this.axesCamera);
    }
  }
  
  
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    if (this.axesRenderer) {
      this.axesRenderer.dispose();
    }
  }
}