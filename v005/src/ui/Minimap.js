
import * as THREE from 'three';

export class Minimap {
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
    this.ctx.fillStyle = 'transparent';
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

  drawMapFeatures(mapBounds) {
      // Placeholder for drawing map features
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
