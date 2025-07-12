
import * as THREE from 'three';

export class DamageNumberSystem {
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

  createNew() {
      const element = document.createElement('div');
      element.className = 'damage-number';
      element.style.position = 'absolute';
      element.style.display = 'none';
      this.container.appendChild(element);
      return element;
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
