
import * as THREE from 'three';

export class NeverEverlandEventSystem {
  constructor(renderer, uiContainer, camera, scene) {
    this.camera = camera;
    this.scene = scene;
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

  handle3DInteraction(object, interactionType) {
      console.log(`Interacted with ${object.name} via ${interactionType}`);
  }

  handleMouseMove(event) {
      if(this.isDragging) {
          // Handle drag logic
      }
  }

  handleMouseUp(event) {
      this.isDragging = false;
  }

  handleTouchStart(event) {
      // Similar to mouse down
  }

  handleTouchMove(event) {
      // Similar to mouse move
  }

  handleTouchEnd(event) {
      // Similar to mouse up
  }
}
