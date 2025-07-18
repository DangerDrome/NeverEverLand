import * as THREE from 'three';
import { WorldPosition, ScreenPosition } from '../types';
import { 
  DIMETRIC_ELEVATION, 
  DIMETRIC_AZIMUTH, 
  DEFAULT_FRUSTUM_SIZE,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_SPEED,
  PAN_SPEED,
  calculateDimetricPosition 
} from './constants';

/**
 * Dimetric camera controller for isometric tile editor
 * Fixed at proper dimetric angle with pan and zoom controls
 */
export class DimetricCamera {
  private camera: THREE.OrthographicCamera;
  private frustumSize: number;
  private aspectRatio: number;
  private minZoom: number = MIN_ZOOM;
  private maxZoom: number = MAX_ZOOM;
  private zoomSpeed: number = ZOOM_SPEED;
  private panSpeed: number = PAN_SPEED;
  
  // Camera state
  private target: THREE.Vector3;
  private isPanning: boolean = false;
  private panStart: THREE.Vector2;
  
  constructor(aspectRatio: number, frustumSize: number = DEFAULT_FRUSTUM_SIZE) {
    this.frustumSize = frustumSize;
    this.aspectRatio = aspectRatio;
    this.target = new THREE.Vector3(0, 0, 0);
    this.panStart = new THREE.Vector2();
    
    // Create orthographic camera
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspectRatio / 2,
      frustumSize * aspectRatio / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    
    // Set up dimetric projection
    this.setupDimetricView();
  }

  /**
   * Set up proper dimetric projection angle
   * Dimetric uses ~26.57° elevation (atan(0.5))
   */
  private setupDimetricView(): void {
    // Calculate dimetric camera position
    const distance = 100; // Far enough to avoid clipping
    const position = calculateDimetricPosition(distance);
    
    // Set camera position
    this.camera.position.set(position.x, position.y, position.z);
    
    // Look at target
    this.camera.lookAt(this.target);
    
    // Force update matrices
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Get the Three.js camera object
   */
  public getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  /**
   * Update camera aspect ratio (call on window resize)
   */
  public updateAspectRatio(aspectRatio: number): void {
    this.aspectRatio = aspectRatio;
    this.camera.left = -this.frustumSize * aspectRatio / 2;
    this.camera.right = this.frustumSize * aspectRatio / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Zoom camera in/out towards mouse position
   * @param delta Mouse wheel deltaY value
   * @param worldPoint Optional world position to zoom towards
   */
  public zoom(delta: number, worldPoint?: THREE.Vector3): void {
    // Store old frustum size
    const oldFrustumSize = this.frustumSize;
    
    // Normalize delta and apply zoom speed
    const normalizedDelta = THREE.MathUtils.clamp(delta, -100, 100) / 100;
    const zoomFactor = 1 + normalizedDelta * this.zoomSpeed * 50;
    
    this.frustumSize = THREE.MathUtils.clamp(
      this.frustumSize * zoomFactor,
      this.minZoom,
      this.maxZoom
    );
    
    // If world point provided, zoom towards that point
    if (worldPoint) {
      // Calculate how much to adjust the target to keep the world point under the mouse
      const scaleFactor = this.frustumSize / oldFrustumSize;
      const offsetX = worldPoint.x - this.target.x;
      const offsetZ = worldPoint.z - this.target.z;
      
      // Adjust target so the world point stays in the same screen position
      this.target.x = worldPoint.x - offsetX * scaleFactor;
      this.target.z = worldPoint.z - offsetZ * scaleFactor;
      
      // Update camera position relative to new target
      const position = calculateDimetricPosition(100);
      this.camera.position.set(
        this.target.x + position.x,
        this.target.y + position.y,
        this.target.z + position.z
      );
      this.camera.lookAt(this.target);
    }
    
    // Update camera bounds with the stored aspect ratio
    this.camera.left = -this.frustumSize * this.aspectRatio / 2;
    this.camera.right = this.frustumSize * this.aspectRatio / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Start panning
   */
  public startPan(screenX: number, screenY: number): void {
    this.isPanning = true;
    this.panStart.set(screenX, screenY);
  }

  /**
   * Update pan based on mouse movement
   */
  public updatePan(screenX: number, screenY: number): void {
    if (!this.isPanning) return;
    
    const deltaX = screenX - this.panStart.x;
    const deltaY = screenY - this.panStart.y;
    
    // Convert screen movement to world movement
    const panScale = this.frustumSize * 0.001 * this.panSpeed;
    
    // Calculate camera's right and up vectors in world space
    // For dimetric view at 45° azimuth:
    // Camera right vector projects to world (-0.707, 0, 0.707)
    // Camera up vector projects to world (-0.5, 0, -0.5) approximately
    const rightX = -Math.cos(DIMETRIC_AZIMUTH);
    const rightZ = Math.sin(DIMETRIC_AZIMUTH);
    const upX = -Math.sin(DIMETRIC_AZIMUTH) * Math.cos(DIMETRIC_ELEVATION);
    const upZ = -Math.cos(DIMETRIC_AZIMUTH) * Math.cos(DIMETRIC_ELEVATION);
    
    // Apply screen delta to world movement
    const worldDX = (deltaX * rightX + deltaY * upX) * panScale;
    const worldDZ = (deltaX * rightZ + deltaY * upZ) * panScale;
    
    // Update target (inverted for natural panning)
    this.target.x += worldDX;
    this.target.z += worldDZ;
    
    // Update camera position to maintain fixed angle
    this.updateCameraPosition();
    
    // Update pan start for next frame
    this.panStart.set(screenX, screenY);
  }

  /**
   * End panning
   */
  public endPan(): void {
    this.isPanning = false;
  }

  /**
   * Set camera target position
   */
  public setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.updateCameraPosition();
  }

  /**
   * Get camera target position
   */
  public getTarget(): THREE.Vector3 {
    return this.target.clone();
  }

  /**
   * Update camera position based on target
   */
  private updateCameraPosition(): void {
    // Maintain fixed dimetric angle relative to target
    const distance = 100;
    const elevation = DIMETRIC_ELEVATION;
    const azimuth = DIMETRIC_AZIMUTH;
    
    const height = distance * Math.sin(elevation);
    const groundDistance = distance * Math.cos(elevation);
    const offsetX = groundDistance * Math.cos(azimuth);
    const offsetZ = groundDistance * Math.sin(azimuth);
    
    this.camera.position.set(
      this.target.x + offsetX,
      this.target.y + height,
      this.target.z + offsetZ
    );
    
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld(true);
  }

  /**
   * Get current zoom level
   */
  public getZoomLevel(): number {
    return this.frustumSize;
  }

  /**
   * Convert screen coordinates to ray for picking
   */
  public getPickingRay(screenX: number, screenY: number, viewport: { width: number; height: number }): THREE.Raycaster {
    const ndcX = (screenX / viewport.width) * 2 - 1;
    const ndcY = -(screenY / viewport.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    
    return raycaster;
  }

  /**
   * Project world position to screen coordinates
   */
  public worldToScreen(worldPos: WorldPosition, viewport: { width: number; height: number }): ScreenPosition {
    const vector = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    vector.project(this.camera);
    
    return {
      x: (vector.x + 1) * viewport.width / 2,
      y: (-vector.y + 1) * viewport.height / 2,
    };
  }

  /**
   * Fit camera to bounds
   */
  public fitToBounds(min: WorldPosition, max: WorldPosition, padding: number = 1.2): void {
    const center = {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2,
    };
    
    const size = {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z,
    };
    
    // Set target to center
    this.setTarget(center.x, center.y, center.z);
    
    // Adjust zoom to fit
    const maxDimension = Math.max(size.x, size.z);
    this.frustumSize = maxDimension * padding;
    
    // Update camera bounds with the stored aspect ratio
    this.camera.left = -this.frustumSize * this.aspectRatio / 2;
    this.camera.right = this.frustumSize * this.aspectRatio / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }
}