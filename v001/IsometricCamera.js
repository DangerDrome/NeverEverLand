/**
 * IsometricCamera class for setting up and managing an orthographic camera
 * positioned for classic isometric view (45-degree angle)
 */
class IsometricCamera {
    constructor(aspectRatio, viewSize = 20) {
        this.viewSize = viewSize;
        this.aspectRatio = aspectRatio;
        
        // Create orthographic camera for isometric view
        // Parameters: left, right, top, bottom, near, far
        this.camera = new THREE.OrthographicCamera(
            -this.viewSize * this.aspectRatio / 2,  // left
            this.viewSize * this.aspectRatio / 2,   // right
            this.viewSize / 2,                      // top
            -this.viewSize / 2,                     // bottom
            0.1,                                    // near
            1000                                    // far
        );
        
        this.setupIsometricPosition();
    }
    
    /**
     * Position the camera for classic isometric view
     * Standard isometric angles: 30° elevation, 45° azimuth
     */
    setupIsometricPosition() {
        // Standard isometric position
        // Distance from origin to maintain good view of the grid
        const distance = 30;
        
        // Calculate isometric position
        // 30-degree elevation, 45-degree azimuth rotation
        const elevation = Math.PI / 6; // 30 degrees
        const azimuth = Math.PI / 4;   // 45 degrees
        
        this.camera.position.set(
            distance * Math.cos(elevation) * Math.cos(azimuth),  // x
            distance * Math.sin(elevation),                      // y (height)
            distance * Math.cos(elevation) * Math.sin(azimuth)   // z
        );
        
        // Look at the center of the grid
        this.camera.lookAt(0, 0, 0);
        
        // Ensure up vector is correct for isometric view
        this.camera.up.set(0, 1, 0);
    }
    
    /**
     * Adjust the isometric angle
     * @param {number} elevationDegrees - Elevation angle in degrees (default: 30)
     * @param {number} azimuthDegrees - Azimuth angle in degrees (default: 45)
     */
    setIsometricAngle(elevationDegrees = 30, azimuthDegrees = 45) {
        const distance = 30;
        const elevation = elevationDegrees * Math.PI / 180;
        const azimuth = azimuthDegrees * Math.PI / 180;
        
        this.camera.position.set(
            distance * Math.cos(elevation) * Math.cos(azimuth),
            distance * Math.sin(elevation),
            distance * Math.cos(elevation) * Math.sin(azimuth)
        );
        
        this.camera.lookAt(0, 0, 0);
    }
    
    /**
     * Zoom the camera by adjusting the orthographic view size
     * @param {number} zoomFactor - Factor to zoom (> 1 = zoom out, < 1 = zoom in)
     */
    zoom(zoomFactor) {
        this.viewSize *= zoomFactor;
        
        // Clamp zoom to reasonable limits
        this.viewSize = Math.max(5, Math.min(50, this.viewSize));
        
        // Update camera projection
        this.updateProjection();
    }
    
    /**
     * Pan the camera (move the target position)
     * @param {number} deltaX - Horizontal movement
     * @param {number} deltaZ - Vertical movement (in world coordinates)
     */
    pan(deltaX, deltaZ) {
        const panSpeed = 0.5;
        
        // Calculate pan direction based on camera orientation
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        
        this.camera.getWorldDirection(forward);
        right.crossVectors(forward, this.camera.up).normalize();
        
        // Move camera position
        const panVector = new THREE.Vector3();
        panVector.addScaledVector(right, deltaX * panSpeed);
        panVector.addScaledVector(new THREE.Vector3(0, 0, 1), deltaZ * panSpeed);
        
        this.camera.position.add(panVector);
    }
    
    /**
     * Update camera projection matrix when aspect ratio or view size changes
     */
    updateProjection() {
        this.camera.left = -this.viewSize * this.aspectRatio / 2;
        this.camera.right = this.viewSize * this.aspectRatio / 2;
        this.camera.top = this.viewSize / 2;
        this.camera.bottom = -this.viewSize / 2;
        
        this.camera.updateProjectionMatrix();
    }
    
    /**
     * Handle window resize
     * @param {number} newAspectRatio - New aspect ratio
     */
    onWindowResize(newAspectRatio) {
        this.aspectRatio = newAspectRatio;
        this.updateProjection();
    }
    
    /**
     * Get the camera instance
     * @returns {THREE.OrthographicCamera}
     */
    getCamera() {
        return this.camera;
    }
} 