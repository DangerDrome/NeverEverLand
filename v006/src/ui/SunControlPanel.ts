import * as THREE from 'three';
import { TileEditor } from '@core/TileEditor';
import { calculateDimetricPosition } from '@core/constants';

/**
 * Sun control panel with interactive 3D sun position control
 */
export class SunControlPanel {
  private container: HTMLElement;
  private editor: TileEditor;
  private element: HTMLElement | null = null;
  
  // Mini scene components
  private miniCanvas!: HTMLCanvasElement;
  private miniRenderer: THREE.WebGLRenderer | null = null;
  private miniScene: THREE.Scene | null = null;
  private miniCamera: THREE.OrthographicCamera | null = null;
  
  // Sun control
  private sunSphere: THREE.Mesh | null = null;
  private sunVector: THREE.Line | null = null;
  private sunAxes: THREE.AxesHelper | null = null;
  private sunAngle: number = 45; // degrees
  private sunElevation: number = 60; // degrees
  private isDragging: boolean = false;
  
  // Display elements
  private angleDisplay!: HTMLElement;
  private elevationDisplay!: HTMLElement;
  
  constructor(container: HTMLElement, editor: TileEditor) {
    this.container = container;
    this.editor = editor;
    this.init();
  }
  
  private init(): void {
    const content = document.createElement('div');
    content.style.fontSize = 'var(--font-size-xs)';
    
    // Create mini scene container
    const sceneContainer = document.createElement('div');
    sceneContainer.style.marginBottom = 'var(--space-2)';
    
    // Create canvas for mini scene
    this.miniCanvas = document.createElement('canvas');
    this.miniCanvas.width = 180;
    this.miniCanvas.height = 180;
    this.miniCanvas.style.width = '180px';
    this.miniCanvas.style.height = '180px';
    this.miniCanvas.style.borderRadius = 'var(--radius-sm)';
    this.miniCanvas.style.cursor = 'grab';
    this.miniCanvas.style.backgroundColor = '#161614'; // Dark theme color
    
    sceneContainer.appendChild(this.miniCanvas);
    content.appendChild(sceneContainer);
    
    // Create controls section
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.gap = 'var(--space-1)';
    
    // Angle display
    const angleRow = document.createElement('div');
    angleRow.style.display = 'flex';
    angleRow.style.justifyContent = 'space-between';
    angleRow.style.alignItems = 'center';
    
    const angleLabel = document.createElement('span');
    angleLabel.textContent = 'Angle:';
    angleLabel.style.color = 'var(--text-secondary)';
    angleRow.appendChild(angleLabel);
    
    this.angleDisplay = document.createElement('span');
    this.angleDisplay.className = 'tag tag-light-primary';
    this.angleDisplay.style.fontSize = '10px';
    this.angleDisplay.textContent = `${this.sunAngle}°`;
    angleRow.appendChild(this.angleDisplay);
    
    controls.appendChild(angleRow);
    
    // Elevation display
    const elevationRow = document.createElement('div');
    elevationRow.style.display = 'flex';
    elevationRow.style.justifyContent = 'space-between';
    elevationRow.style.alignItems = 'center';
    
    const elevationLabel = document.createElement('span');
    elevationLabel.textContent = 'Elevation:';
    elevationLabel.style.color = 'var(--text-secondary)';
    elevationRow.appendChild(elevationLabel);
    
    this.elevationDisplay = document.createElement('span');
    this.elevationDisplay.className = 'tag tag-light-warning';
    this.elevationDisplay.style.fontSize = '10px';
    this.elevationDisplay.textContent = `${this.sunElevation}°`;
    elevationRow.appendChild(this.elevationDisplay);
    
    controls.appendChild(elevationRow);
    
    content.appendChild(controls);
    
    // Create the panel
    this.element = window.UI.panel('Sun Control', content, {
      collapsible: true,
      closable: true,
      draggable: true,
      resizable: true,
      startCollapsed: false,
      position: 'bottom-right',
    });
    
    if (this.element) {
      this.element.className += ' sun-control-panel';
      
      // Add sun icon to the title
      const titleElement = this.element.querySelector('.panel-title');
      if (titleElement) {
        const iconHTML = '<i data-lucide="sun" style="width: 16px; height: 16px; margin-right: 8px;"></i>';
        titleElement.innerHTML = iconHTML + titleElement.textContent;
      }
      
      // Don't set inline styles - let CSS handle positioning
      
      this.container.appendChild(this.element);
      
      // Initialize lucide icons for the panel header
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
    
    // Initialize mini scene
    this.setupMiniScene();
    this.attachEvents();
  }
  
  private setupMiniScene(): void {
    if (!this.miniCanvas) return;
    
    // Create mini renderer
    this.miniRenderer = new THREE.WebGLRenderer({ 
      canvas: this.miniCanvas, 
      alpha: true,
      antialias: true 
    });
    this.miniRenderer.setSize(180, 180);
    this.miniRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Create mini scene
    this.miniScene = new THREE.Scene();
    
    // Create mini orthographic camera with dimetric projection
    const frustumSize = 8;
    this.miniCamera = new THREE.OrthographicCamera(
      -frustumSize / 2,
      frustumSize / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    
    // Set up dimetric angle (same as main camera)
    const distance = 20;
    const position = calculateDimetricPosition(distance);
    
    this.miniCamera.position.set(position.x, position.y, position.z);
    this.miniCamera.lookAt(0, 0, 0);
    this.miniCamera.updateMatrixWorld(true);
    
    // Add grid
    const gridHelper = new THREE.GridHelper(4, 8, 0x444444, 0x222222);
    this.miniScene.add(gridHelper);
    
    // Add axes
    const axesHelper = new THREE.AxesHelper(2);
    this.miniScene.add(axesHelper);
    
    // Create sun sphere
    const sunGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFD700,
      emissive: 0xFFD700,
    });
    this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    this.miniScene.add(this.sunSphere);
    
    // Create sun vector line
    const vectorGeometry = new THREE.BufferGeometry();
    const vectorMaterial = new THREE.LineBasicMaterial({
      color: 0xFFD700,
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });
    this.sunVector = new THREE.Line(vectorGeometry, vectorMaterial);
    this.miniScene.add(this.sunVector);
    
    // Create small axes at sun position
    this.sunAxes = new THREE.AxesHelper(0.8);
    this.miniScene.add(this.sunAxes);
    
    // Update positions
    this.updateSunPosition();
    
    // Add sun path circle
    const curve = new THREE.EllipseCurve(
      0, 0,             // center
      3, 3,             // radius
      0, 2 * Math.PI,   // angles
      false,            // clockwise
      0                 // rotation
    );
    
    const points = curve.getPoints(64);
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const pathMaterial = new THREE.LineBasicMaterial({ 
      color: 0xFFD700, 
      transparent: true, 
      opacity: 0.3 
    });
    const pathLine = new THREE.Line(pathGeometry, pathMaterial);
    pathLine.rotation.x = Math.PI / 2;
    this.miniScene.add(pathLine);
    
    // Add light from sun
    const light = new THREE.DirectionalLight(0xFFFFFF, 0.5);
    light.position.copy(this.sunSphere.position);
    this.miniScene.add(light);
    
    // Add ambient light
    const ambient = new THREE.AmbientLight(0xFFFFFF, 0.3);
    this.miniScene.add(ambient);
  }
  
  private attachEvents(): void {
    if (!this.miniCanvas) return;
    
    this.miniCanvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }
  
  private onMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.miniCanvas.style.cursor = 'grabbing';
  }
  
  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.miniCanvas) return;
    
    const rect = this.miniCanvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Convert to angles
    this.sunAngle = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (this.sunAngle < 0) this.sunAngle += 360;
    
    // Calculate elevation based on distance from center
    const distance = Math.sqrt(x * x + y * y);
    this.sunElevation = Math.max(10, Math.min(90, (1 - distance) * 90));
    
    this.updateSunPosition();
    this.updateDisplays();
    this.updateMainSceneSun();
  }
  
  private onMouseUp(): void {
    this.isDragging = false;
    if (this.miniCanvas) {
      this.miniCanvas.style.cursor = 'grab';
    }
  }
  
  private updateSunPosition(): void {
    if (!this.sunSphere || !this.sunVector || !this.sunAxes) return;
    
    const angleRad = this.sunAngle * Math.PI / 180;
    const elevationRad = this.sunElevation * Math.PI / 180;
    
    const radius = 3;
    const x = radius * Math.sin(angleRad) * Math.cos(elevationRad);
    const y = radius * Math.sin(elevationRad);
    const z = radius * Math.cos(angleRad) * Math.cos(elevationRad);
    
    this.sunSphere.position.set(x, y, z);
    
    // Update axes position to match sun
    this.sunAxes.position.set(x, y, z);
    
    // Update vector line from origin to sun
    const points = [
      new THREE.Vector3(0, 0, 0),  // Origin
      new THREE.Vector3(x, y, z)   // Sun position
    ];
    this.sunVector.geometry.setFromPoints(points);
    this.sunVector.geometry.attributes.position.needsUpdate = true;
  }
  
  private updateDisplays(): void {
    this.angleDisplay.textContent = `${Math.round(this.sunAngle)}°`;
    this.elevationDisplay.textContent = `${Math.round(this.sunElevation)}°`;
  }
  
  private updateMainSceneSun(): void {
    // Convert mini scene position to main scene position
    const distance = 50; // Distance from origin in main scene
    const angleRad = this.sunAngle * Math.PI / 180;
    const elevationRad = this.sunElevation * Math.PI / 180;
    
    const x = distance * Math.sin(angleRad) * Math.cos(elevationRad);
    const y = distance * Math.sin(elevationRad);
    const z = distance * Math.cos(angleRad) * Math.cos(elevationRad);
    
    this.editor.updateSunPosition(x, y, z);
  }
  
  public update(): void {
    if (this.miniRenderer && this.miniScene && this.miniCamera) {
      // Just render without rotating
      this.miniRenderer.render(this.miniScene, this.miniCamera);
    }
  }
  
  public setVisible(visible: boolean): void {
    if (this.element) {
      this.element.style.display = visible ? 'block' : 'none';
    }
  }
  
  public dispose(): void {
    if (this.miniRenderer) {
      this.miniRenderer.dispose();
    }
    
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}