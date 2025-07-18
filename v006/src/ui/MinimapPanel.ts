import * as THREE from 'three';
import { TileEditor } from '@core/TileEditor';
import { SimpleTileSystem } from '@core/SimpleTileSystem';
import { VoxelTypeColors, VoxelType } from '@core/VoxelTypes';
import { GridCoordinate } from '../types';

interface MinimapConfig {
  size: number;
  gridRange: number; // How many grid cells to show
}

/**
 * Minimap panel showing grid overview and voxel placement
 */
export class MinimapPanel {
  private container: HTMLElement;
  private editor: TileEditor;
  private element: HTMLElement | null = null;
  
  // Canvas for rendering
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // Configuration
  private config: MinimapConfig;
  
  // Tile system reference
  private tileSystem: SimpleTileSystem | null = null;
  
  // Performance optimization
  private updateCounter: number = 0;
  private updateFrequency: number = 30; // Update every 30 frames (~2 FPS for minimap)
  
  // Resize observer
  private resizeObserver: ResizeObserver | null = null;
  
  constructor(container: HTMLElement, editor: TileEditor) {
    this.container = container;
    this.editor = editor;
    
    this.config = {
      size: 200,
      gridRange: 50, // Show 50x50 grid cells
    };
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.size;
    this.canvas.height = this.config.size;
    this.canvas.className = 'minimap';
    this.canvas.style.width = `${this.config.size}px`;
    this.canvas.style.height = `${this.config.size}px`;
    this.canvas.style.imageRendering = 'pixelated'; // Crisp pixels
    this.canvas.style.display = 'block';
    this.canvas.style.borderRadius = 'var(--radius-md)';
    this.canvas.style.backgroundColor = '#1a1a1a';
    this.canvas.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    this.canvas.style.minHeight = '200px';
    this.canvas.style.minWidth = '200px';
    
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = context;
    
    // Set context defaults
    this.ctx.imageSmoothingEnabled = false;
    
    this.init();
  }
  
  private init(): void {
    // Ensure dark theme is applied
    if (!document.body.classList.contains('dark')) {
      document.body.classList.add('dark');
    }
    
    const content = document.createElement('div');
    content.style.padding = '0';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.alignItems = 'center';
    content.style.gap = 'var(--space-2)';
    
    // Add canvas directly to content
    content.appendChild(this.canvas);
    
    // Create controls section
    const controls = document.createElement('div');
    controls.style.marginTop = 'var(--space-2)';
    controls.style.fontSize = 'var(--font-size-xs)';
    controls.style.color = 'var(--text-secondary)';
    controls.style.textAlign = 'center';
    
    const rangeLabel = document.createElement('div');
    rangeLabel.textContent = `${this.config.gridRange}×${this.config.gridRange} Grid View`;
    controls.appendChild(rangeLabel);
    
    content.appendChild(controls);
    
    // Create the panel
    this.element = window.UI.panel('Minimap', content, {
      icon: 'map',
      collapsible: true,
      closable: true,
      draggable: true,
      resizable: true,
      startCollapsed: false,
    });
    
    if (this.element) {
      this.element.className += ' minimap-panel';
      // Don't override position - let CSS handle it
      this.container.appendChild(this.element);
      
      // Initialize lucide icons
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
    
    // Set up resize observer
    this.setupResizeObserver();
    
    // Initial draw
    this.clearMinimap();
    this.drawGrid();
    this.drawCamera();
    
    // Set up resize after a delay to ensure DOM is ready
    setTimeout(() => {
      const panelBody = this.element?.querySelector('.panel-body');
      if (panelBody) {
        const width = Math.min(panelBody.clientWidth || 200, 400);
        this.updateCanvasSize(width);
      }
    }, 100);
  }
  
  private setupResizeObserver(): void {
    if (!this.element) return;
    
    // Find the panel body
    const panelBody = this.element.querySelector('.panel-body');
    if (!panelBody) return;
    
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Update canvas size to match panel width, with max size limit
        const canvasSize = Math.min(Math.floor(width), 400);
        if (canvasSize > 50) {
          this.updateCanvasSize(canvasSize);
        }
      }
    });
    
    this.resizeObserver.observe(panelBody);
  }
  
  private updateCanvasSize(size: number): void {
    // Clamp size
    size = Math.max(200, Math.min(size, 400));
    
    // Update canvas resolution and CSS size
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    
    // Update config
    this.config.size = size;
    const scaleFactor = size / 200;
    this.config.gridRange = Math.floor(50 * scaleFactor);
    
    // Update range label
    const rangeLabel = this.element?.querySelector('.panel-body div:last-child div');
    if (rangeLabel) {
      rangeLabel.textContent = `${this.config.gridRange}×${this.config.gridRange} Grid View`;
    }
    
    // Get new context after resize
    const context = this.canvas.getContext('2d', { alpha: false });
    if (context) {
      this.ctx = context;
      this.ctx.imageSmoothingEnabled = false;
    }
    
    // Force immediate redraw
    this.clearMinimap();
    this.drawGrid();
    this.drawVoxels();
    this.drawCamera();
  }
  
  /**
   * Set voxel world reference
   */
  public setTileSystem(tileSystem: SimpleTileSystem): void {
    this.tileSystem = tileSystem;
  }
  
  /**
   * Update minimap display
   */
  public update(force: boolean = false): void {
    // Only update at reduced frequency for performance
    if (!force) {
      this.updateCounter++;
      if (this.updateCounter < this.updateFrequency) {
        return;
      }
      this.updateCounter = 0;
    }
    
    this.clearMinimap();
    this.drawGrid();
    this.drawVoxels();
    this.drawCamera();
  }
  
  /**
   * Clear minimap with background
   */
  private clearMinimap(): void {
    // Dark background matching theme
    this.ctx.fillStyle = '#1a1a1a'; // Slightly lighter to see it render
    this.ctx.fillRect(0, 0, this.config.size, this.config.size);
  }
  
  /**
   * Draw grid lines
   */
  private drawGrid(): void {
    const cellSize = this.config.size / this.config.gridRange;
    
    // Draw grid lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 0.5;
    
    // Draw every 5th line stronger
    for (let i = 0; i <= this.config.gridRange; i++) {
      const pos = i * cellSize;
      
      if (i % 5 === 0) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      } else {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      }
      
      // Vertical line
      this.ctx.beginPath();
      this.ctx.moveTo(pos, 0);
      this.ctx.lineTo(pos, this.config.size);
      this.ctx.stroke();
      
      // Horizontal line
      this.ctx.beginPath();
      this.ctx.moveTo(0, pos);
      this.ctx.lineTo(this.config.size, pos);
      this.ctx.stroke();
    }
  }
  
  /**
   * Draw voxels on minimap
   */
  private drawVoxels(): void {
    if (!this.tileSystem) return;
    
    const cellSize = this.config.size / this.config.gridRange;
    const halfRange = Math.floor(this.config.gridRange / 2);
    
    // Get all tiles
    const tiles = this.tileSystem.getAllTiles();
    
    // Draw each tile
    tiles.forEach((tileData: { coord: GridCoordinate; type: VoxelType }) => {
      const { coord, type } = tileData;
      
      // Check if within minimap range
      if (Math.abs(coord.x) <= halfRange && Math.abs(coord.z) <= halfRange) {
        // Convert to minimap coordinates
        const mapX = (coord.x + halfRange) * cellSize;
        const mapZ = (coord.z + halfRange) * cellSize;
        
        // Get voxel color
        const color = VoxelTypeColors[type as VoxelType] || '#666666';
        this.ctx.fillStyle = color;
        
        // Draw filled cell
        this.ctx.fillRect(mapX, mapZ, cellSize, cellSize);
        
        // Draw border for clarity
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(mapX, mapZ, cellSize, cellSize);
      }
    });
  }
  
  /**
   * Draw camera position and view frustum
   */
  private drawCamera(): void {
    const camera = this.editor.getCamera();
    const cam = camera.getCamera();
    
    // Get camera position in world space
    const camPos = cam.position;
    
    // Calculate grid position
    const gridX = Math.floor(camPos.x);
    const gridZ = Math.floor(camPos.z);
    
    const cellSize = this.config.size / this.config.gridRange;
    const halfRange = Math.floor(this.config.gridRange / 2);
    
    // Check if camera is within minimap range
    if (Math.abs(gridX) <= halfRange && Math.abs(gridZ) <= halfRange) {
      // Convert to minimap coordinates
      const mapX = (camPos.x + halfRange) * cellSize;
      const mapZ = (camPos.z + halfRange) * cellSize;
      
      // Draw camera view cone
      this.ctx.save();
      this.ctx.translate(mapX, mapZ);
      
      // Calculate view direction (camera looks towards origin in dimetric view)
      const lookDir = new THREE.Vector3(0, 0, 0).sub(camPos).normalize();
      const angle = Math.atan2(lookDir.z, lookDir.x);
      
      this.ctx.rotate(angle);
      
      // Draw view cone
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(20, -15);
      this.ctx.lineTo(20, 15);
      this.ctx.closePath();
      this.ctx.stroke();
      
      this.ctx.restore();
      
      // Draw camera position
      this.ctx.fillStyle = '#ffff00';
      this.ctx.beginPath();
      this.ctx.arc(mapX, mapZ, 3, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw camera border
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
    
    // Draw origin marker
    const originX = halfRange * cellSize;
    const originZ = halfRange * cellSize;
    
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(originX - 3, originZ);
    this.ctx.lineTo(originX + 3, originZ);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(originX, originZ - 3);
    this.ctx.lineTo(originX, originZ + 3);
    this.ctx.stroke();
  }
  
  /**
   * Set minimap visibility
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}