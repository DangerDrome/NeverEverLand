
import * as THREE from 'three';

export class Minimap {
  constructor(size = 200) {
    this.size = size;
    this.scale = 5; // Pixels per world unit
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

  render(playerPos, entities, mapBounds, tiles = null) {
    // Clear canvas
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.size, this.size);
    
    // Draw tiles first (background layer)
    if (tiles && tiles.size > 0) {
      this.drawTiles(playerPos, tiles);
    }
    
    // Draw map features
    this.drawMapFeatures(mapBounds);
    
    // Draw entities
    const playerX = playerPos.x || 0;
    const playerZ = playerPos.z || 0;
    entities.forEach(entity => {
      const relativePos = {
        x: (entity.position.x - playerX) * this.scale + this.size / 2,
        z: (entity.position.z - playerZ) * this.scale + this.size / 2
      };
      
      if (this.isInBounds(relativePos)) {
        this.drawEntity(relativePos, entity.type);
      }
    });
    
    // Draw player (always center)
    this.drawPlayer();
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

  drawTiles(playerPos, tiles) {
    // Define tile colors for minimap
    const tileColors = {
      grass: '#4CAF50',
      stone: '#757575',
      water: '#2196F3',
      wall: '#8D6E63',
      tree: '#2E7D32',
      foundation: '#9E9E9E'
    };
    
    // Debug: log tiles count occasionally
    if (Math.random() < 0.01) {
      // console.log('Minimap tiles count:', tiles.size);
      // if (tiles.size > 0) {
      //   const firstTile = tiles.entries().next().value;
      //   console.log('First tile:', firstTile);
      //   console.log('Player pos:', playerPos);
      // }
    }
    
    // Iterate through tiles
    tiles.forEach((tileData, key) => {
      const [gridX, gridZ] = key.split(',').map(Number);
      
      // Convert grid coordinates to world position (center of tile)
      const worldX = gridX + 0.5;
      const worldZ = gridZ + 0.5;
      
      // Calculate relative position to player
      const playerX = playerPos.x || 0;
      const playerZ = playerPos.z || 0;
      const relativePos = {
        x: (worldX - playerX) * this.scale + this.size / 2,
        z: (worldZ - playerZ) * this.scale + this.size / 2
      };
      
      // Only draw if in bounds
      if (this.isInBounds(relativePos)) {
        const color = tileColors[tileData.type] || '#666666';
        this.ctx.fillStyle = color;
        
        // Draw tile as a square that matches the scale
        const tileSize = this.scale; // Each tile is 1x1 world units
        this.ctx.fillRect(
          relativePos.x - tileSize / 2,
          relativePos.z - tileSize / 2,
          tileSize,
          tileSize
        );
        
        // Always draw border for visibility
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(
          relativePos.x - tileSize / 2,
          relativePos.z - tileSize / 2,
          tileSize,
          tileSize
        );
      }
    });
  }

  drawMapFeatures(mapBounds) {
    // Draw a grid for debugging
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;
    
    // Draw grid lines
    const gridSize = 20;
    for (let i = 0; i <= this.size; i += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, 0);
      this.ctx.lineTo(i, this.size);
      this.ctx.stroke();
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, i);
      this.ctx.lineTo(this.size, i);
      this.ctx.stroke();
    }
  }

  isInBounds(pos) {
      return pos.x >= 0 && pos.x <= this.size && pos.z >= 0 && pos.z <= this.size;
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
