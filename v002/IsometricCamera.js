// IsometricCamera.js - v002
// Orthographic camera with dimetric projection (2:1 pixel ratio)
// Pikuma: elevation ≈ 26.57°, azimuth 45°

class IsometricCamera {
    /**
     * @param {number} aspectRatio - width / height
     * @param {number} viewSize - initial vertical size of the camera frustum
     * @param {number} frustumScale - scale factor for the camera frustum
     */
    constructor(aspectRatio, viewSize = 16, frustumScale = 2) {
        this.viewSize = viewSize;
        this.aspectRatio = aspectRatio;
        this.frustumScale = frustumScale;
        this.camera = new THREE.OrthographicCamera(
            -this.viewSize * this.aspectRatio * this.frustumScale / 2,
            this.viewSize * this.aspectRatio * this.frustumScale / 2,
            this.viewSize * this.frustumScale / 2,
            -this.viewSize * this.frustumScale / 2,
            0.001,
            3100000000
        );
        this._setupDimetricPosition();
    }

    // Set camera to dimetric (2:1) projection
    _setupDimetricPosition() {
        const distance = 25;
        const elevation = Math.atan(0.5); // ≈ 26.57°
        const azimuth = Math.PI / 4;      // 45°
        this.camera.position.set(
            distance * Math.cos(elevation) * Math.cos(azimuth),
            distance * Math.sin(elevation),
            distance * Math.cos(elevation) * Math.sin(azimuth)
        );
        this.camera.lookAt(0, 0, 0);
        this.camera.up.set(0, 1, 0);
    }

    // Zoom by scaling the view size
    zoom(zoomFactor) {
        this.viewSize *= zoomFactor;
        this.viewSize = Math.max(4, Math.min(64, this.viewSize));
        this._updateProjection();
    }

    // Pan the camera in world space
    pan(deltaX, deltaZ) {
        const panSpeed = 0.5;
        const panVector = new THREE.Vector3(deltaX * panSpeed, 0, deltaZ * panSpeed);
        this.camera.position.add(panVector);
    }

    // Snap camera position to pixel grid (for retro effect)
    snapToPixelGrid(pixelSize = 1) {
        const snap = pixelSize;
        this.camera.position.x = Math.round(this.camera.position.x / snap) * snap;
        this.camera.position.z = Math.round(this.camera.position.z / snap) * snap;
    }

    // Update projection matrix
    _updateProjection() {
        this.camera.left = -this.viewSize * this.aspectRatio * this.frustumScale / 2;
        this.camera.right = this.viewSize * this.aspectRatio * this.frustumScale / 2;
        this.camera.top = this.viewSize * this.frustumScale / 2;
        this.camera.bottom = -this.viewSize * this.frustumScale / 2;
        this.camera.updateProjectionMatrix();
    }

    // Handle window resize
    onWindowResize(newAspectRatio) {
        this.aspectRatio = newAspectRatio;
        this._updateProjection();
    }

    // Get the underlying Three.js camera
    getCamera() {
        return this.camera;
    }
}
window.IsometricCamera = IsometricCamera; 