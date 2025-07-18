import * as THREE from 'three';
import { TileEditor } from '@core/TileEditor';
import { DIMETRIC_ELEVATION, DIMETRIC_AZIMUTH, calculateDimetricPosition } from '@core/constants';

interface Stats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

interface History {
  fps: number[];
  frameTime: number[];
  drawCalls: number[];
}

/**
 * Info panel with performance stats and 3D orientation viewer
 */
export class InfoPanel {
  private container: HTMLElement;
  private editor: TileEditor;
  private element: HTMLElement | null = null;
  
  // Stats tracking
  private stats: Stats = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    programs: 0,
  };
  
  private history: History = {
    fps: new Array(60).fill(0),
    frameTime: new Array(60).fill(0),
    drawCalls: new Array(60).fill(0),
  };
  
  private lastFrameTime: number = performance.now();
  private historyCounter: number = 0;
  private fpsBuffer: number[] = [];
  
  // Display elements
  private fpsDisplay!: HTMLElement;
  private frameTimeDisplay!: HTMLElement;
  private drawCallsDisplay!: HTMLElement;
  private trianglesDisplay!: HTMLElement;
  private geometriesDisplay!: HTMLElement;
  private texturesDisplay!: HTMLElement;
  private programsDisplay!: HTMLElement;
  
  // Axes viewer
  private axesCanvas!: HTMLCanvasElement;
  private axesRenderer: THREE.WebGLRenderer | null = null;
  private axesScene: THREE.Scene | null = null;
  private axesCamera: THREE.OrthographicCamera | null = null;
  
  // Graph canvases
  private fpsCanvas!: HTMLDivElement;
  private frameTimeCanvas!: HTMLDivElement;
  private drawCallsCanvas!: HTMLDivElement;
  
  constructor(container: HTMLElement, editor: TileEditor) {
    this.container = container;
    this.editor = editor;
    this.init();
  }
  
  private init(): void {
    const content = document.createElement('div');
    content.style.fontSize = 'var(--font-size-xs)';
    content.style.fontFamily = 'var(--font-mono)';
    
    // Create sections
    this.createControlsSection(content);
    this.createStatsSection(content);
    
    // Create the panel
    this.element = window.UI.panel('Info Panel', content, {
      icon: 'activity',
      collapsible: true,
      closable: true,
      startCollapsed: false,
    });
    
    if (this.element) {
      this.element.className += ' info-panel';
      this.element.style.position = 'fixed';
      this.element.style.width = '320px';
      this.element.style.height = 'auto';
      this.element.style.top = '20px';
      this.element.style.right = '20px';
      this.element.style.zIndex = '1000';
      
      this.container.appendChild(this.element);
    }
  }
  
  private createControlsSection(parent: HTMLElement): void {
    const section = document.createElement('div');
    section.className = 'debug-section';
    section.style.marginBottom = 'var(--space-3)';
    
    const title = document.createElement('h4');
    title.textContent = '3D Info';
    title.style.margin = '0 0 var(--space-2) 0';
    title.style.color = 'var(--text-secondary)';
    section.appendChild(title);
    
    // Create container for axes and graphs
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = 'var(--space-3)';
    container.style.alignItems = 'flex-start';
    
    // Left side: 3D axes viewer
    const axesWrapper = document.createElement('div');
    axesWrapper.style.flex = '0 0 180px';
    
    const axesCanvas = document.createElement('canvas');
    axesCanvas.width = 180;
    axesCanvas.height = 180;
    axesCanvas.style.width = '180px';
    axesCanvas.style.height = '180px';
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
    
    this.createMiniGraphs(graphsWrapper);
    
    container.appendChild(axesWrapper);
    container.appendChild(graphsWrapper);
    section.appendChild(container);
    parent.appendChild(section);
  }
  
  private createMiniGraphs(parent: HTMLElement): void {
    // FPS Graph
    this.fpsCanvas = this.createMiniGraph('FPS', 'success');
    parent.appendChild(this.fpsCanvas);
    
    // Frame Time Graph
    this.frameTimeCanvas = this.createMiniGraph('Frame Time', 'warning');
    parent.appendChild(this.frameTimeCanvas);
    
    // Draw Calls Graph
    this.drawCallsCanvas = this.createMiniGraph('Draw Calls', 'info');
    parent.appendChild(this.drawCallsCanvas);
  }
  
  private createMiniGraph(title: string, colorClass: string): HTMLDivElement {
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '100%';
    
    // Canvas for graph
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 44;
    canvas.style.width = '100%';
    canvas.style.height = '44px';
    canvas.style.background = 'var(--bg-layer-2)';
    canvas.style.borderRadius = 'var(--radius-sm)';
    container.appendChild(canvas);
    
    // Label tag
    const label = document.createElement('span');
    label.className = `tag tag-${colorClass}`;
    label.textContent = title;
    label.style.fontSize = 'var(--font-size-3xs)';
    label.style.padding = 'var(--space-0-5) var(--space-1)';
    label.style.position = 'absolute';
    label.style.top = 'var(--space-1)';
    label.style.left = 'var(--space-1)';
    label.style.fontWeight = 'var(--font-semibold)';
    label.style.opacity = '0.9';
    container.appendChild(label);
    
    return container;
  }
  
  private createStatsSection(parent: HTMLElement): void {
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
    
    const tbody = document.createElement('tbody');
    
    // Performance stats
    const fpsRow = this.createTableRow('FPS', '0', 'Frame', '0ms');
    tbody.appendChild(fpsRow);
    this.fpsDisplay = fpsRow.cells[1] as HTMLElement;
    this.frameTimeDisplay = fpsRow.cells[3] as HTMLElement;
    
    // Renderer stats
    const drawRow = this.createTableRow('Draws', '0', 'Tris', '0');
    tbody.appendChild(drawRow);
    this.drawCallsDisplay = drawRow.cells[1] as HTMLElement;
    this.trianglesDisplay = drawRow.cells[3] as HTMLElement;
    
    const geoRow = this.createTableRow('Geom', '0', 'Tex', '0');
    tbody.appendChild(geoRow);
    this.geometriesDisplay = geoRow.cells[1] as HTMLElement;
    this.texturesDisplay = geoRow.cells[3] as HTMLElement;
    
    const progRow = this.createTableRow('Prog', '0', '', '');
    tbody.appendChild(progRow);
    this.programsDisplay = progRow.cells[1] as HTMLElement;
    
    table.appendChild(tbody);
    section.appendChild(table);
    parent.appendChild(section);
  }
  
  private createTableRow(label1: string, value1: string, label2: string, value2: string): HTMLTableRowElement {
    const row = document.createElement('tr');
    
    const labelCell1 = document.createElement('td');
    labelCell1.textContent = label1 + ':';
    labelCell1.style.color = 'var(--text-secondary)';
    labelCell1.style.padding = 'var(--space-1) var(--space-2)';
    
    const valueCell1 = document.createElement('td');
    valueCell1.textContent = value1;
    valueCell1.style.color = 'var(--text-primary)';
    valueCell1.style.fontWeight = 'var(--font-bold)';
    valueCell1.style.padding = 'var(--space-1) var(--space-3) var(--space-1) var(--space-1)';
    
    const labelCell2 = document.createElement('td');
    labelCell2.textContent = label2 ? label2 + ':' : '';
    labelCell2.style.color = 'var(--text-secondary)';
    labelCell2.style.padding = 'var(--space-1) var(--space-2)';
    
    const valueCell2 = document.createElement('td');
    valueCell2.textContent = value2;
    valueCell2.style.color = 'var(--text-primary)';
    valueCell2.style.fontWeight = 'var(--font-bold)';
    valueCell2.style.padding = 'var(--space-1) var(--space-2)';
    
    row.appendChild(labelCell1);
    row.appendChild(valueCell1);
    row.appendChild(labelCell2);
    row.appendChild(valueCell2);
    
    return row;
  }
  
  private setupAxesViewer(): void {
    if (!this.axesCanvas) return;
    
    // Create mini renderer
    this.axesRenderer = new THREE.WebGLRenderer({ 
      canvas: this.axesCanvas, 
      alpha: true,
      antialias: true 
    });
    this.axesRenderer.setSize(180, 180);
    this.axesRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Create mini scene
    this.axesScene = new THREE.Scene();
    
    // Always use a dark background for the axes viewer for better contrast
    // This ensures the colored axes are visible in both light and dark themes
    this.axesScene.background = new THREE.Color(0x1a1a1a);
    
    // Create mini orthographic camera with dimetric projection
    const frustumSize = 3;
    this.axesCamera = new THREE.OrthographicCamera(
      -frustumSize / 2,
      frustumSize / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    
    // Set up dimetric angle (same as main camera)
    const distance = 10;
    const position = calculateDimetricPosition(distance);
    
    this.axesCamera.position.set(position.x, position.y, position.z);
    this.axesCamera.lookAt(0, 0, 0);
    this.axesCamera.updateMatrixWorld(true);
    
    // Add grid helper that matches the orthographic scale
    // Use StyleUI grey colors
    const grey500 = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grey-500').trim().replace('#', ''), 16);
    const grey700 = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grey-700').trim().replace('#', ''), 16);
    const gridHelper = new THREE.GridHelper(2, 4, grey500, grey700);
    gridHelper.position.y = -0.01; // Slightly below axes
    this.axesScene.add(gridHelper);
    
    // Create axes helper
    const axesHelper = new THREE.AxesHelper(1);
    this.axesScene.add(axesHelper);
    
    // Add axis labels
    this.addAxisLabels();
  }
  
  private addAxisLabels(): void {
    if (!this.axesScene) return;
    
    const createLabel = (text: string, color: string, position: THREE.Vector3): THREE.Sprite => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 128;
      canvas.height = 128;
      
      // Draw circular background
      context.fillStyle = color;
      context.beginPath();
      context.arc(64, 64, 48, 0, Math.PI * 2);
      context.fill();
      
      // Draw text with dark color for better readability
      context.fillStyle = 'rgba(0, 0, 0, 0.85)';
      // Use Inter font from StyleUI
      context.font = 'bold 56px Inter, system-ui, -apple-system, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 64, 64);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position);
      sprite.scale.set(0.4, 0.4, 1);
      
      return sprite;
    };
    
    // Add X, Y, Z labels positioned for orthographic view
    // Get colors from computed styles
    const computedStyle = getComputedStyle(document.documentElement);
    const errorColor = computedStyle.getPropertyValue('--error-dark').trim();
    const successColor = computedStyle.getPropertyValue('--success-dark').trim();
    const infoColor = computedStyle.getPropertyValue('--info-dark').trim();
    
    this.axesScene.add(createLabel('X', errorColor, new THREE.Vector3(1.3, 0, 0)));
    this.axesScene.add(createLabel('Y', successColor, new THREE.Vector3(0, 1.3, 0)));
    this.axesScene.add(createLabel('Z', infoColor, new THREE.Vector3(0, 0, 1.3)));
  }
  
  public update(): void {
    const now = performance.now();
    
    // Calculate FPS
    if (this.lastFrameTime) {
      const frameDelta = now - this.lastFrameTime;
      const instantFPS = 1000 / frameDelta;
      
      this.fpsBuffer.push(instantFPS);
      if (this.fpsBuffer.length > 10) {
        this.fpsBuffer.shift();
      }
      
      const avgFPS = this.fpsBuffer.reduce((a, b) => a + b, 0) / this.fpsBuffer.length;
      this.stats.fps = Math.round(avgFPS);
      this.stats.frameTime = 1000 / avgFPS;
      
      // Update history
      this.historyCounter++;
      if (this.historyCounter >= 6) {
        this.history.fps.shift();
        this.history.fps.push(this.stats.fps);
        
        this.history.frameTime.shift();
        this.history.frameTime.push(this.stats.frameTime);
        
        this.historyCounter = 0;
      }
    }
    
    this.lastFrameTime = now;
    
    // Get renderer info
    const renderer = this.editor.getRenderer();
    if (renderer) {
      const info = renderer.info;
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
  
  private updateDisplay(): void {
    this.fpsDisplay.textContent = `${this.stats.fps}`;
    this.frameTimeDisplay.textContent = `${this.stats.frameTime.toFixed(2)}ms`;
    this.drawCallsDisplay.textContent = `${this.stats.drawCalls}`;
    this.trianglesDisplay.textContent = `${this.formatNumber(this.stats.triangles)}`;
    this.geometriesDisplay.textContent = `${this.stats.geometries}`;
    this.texturesDisplay.textContent = `${this.stats.textures}`;
    this.programsDisplay.textContent = `${this.stats.programs}`;
  }
  
  private updateGraphs(): void {
    if (this.fpsCanvas) {
      const canvas = this.fpsCanvas.querySelector('canvas')!;
      const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success-dark').trim();
      this.drawMiniGraph(canvas, this.history.fps, 120, successColor);
    }
    if (this.frameTimeCanvas) {
      const canvas = this.frameTimeCanvas.querySelector('canvas')!;
      const warningColor = getComputedStyle(document.documentElement).getPropertyValue('--warning-dark').trim();
      this.drawMiniGraph(canvas, this.history.frameTime, 33.33, warningColor);
    }
    if (this.drawCallsCanvas) {
      const canvas = this.drawCallsCanvas.querySelector('canvas')!;
      const infoColor = getComputedStyle(document.documentElement).getPropertyValue('--info-dark').trim();
      this.drawMiniGraph(canvas, this.history.drawCalls, Math.max(...this.history.drawCalls) || 100, infoColor);
    }
  }
  
  private drawMiniGraph(canvas: HTMLCanvasElement, data: number[], maxValue: number, color: string): void {
    const ctx = canvas.getContext('2d')!;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw data
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    
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
  
  private updateAxesViewer(): void {
    if (!this.axesRenderer || !this.axesScene || !this.axesCamera) return;
    
    // Just render - the camera is fixed in dimetric position
    this.axesRenderer.render(this.axesScene, this.axesCamera);
  }
  
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
  
  public setVisible(visible: boolean): void {
    if (this.element) {
      this.element.style.display = visible ? 'block' : 'none';
    }
  }
  
  public dispose(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    if (this.axesRenderer) {
      this.axesRenderer.dispose();
    }
  }
}