// CameraControls.js - v002
// Handles keyboard and mouse input for camera movement and zoom

class CameraControls {
    /**
     * @param {IsometricCamera} isometricCamera - The camera controller
     * @param {HTMLElement} domElement - The DOM element to attach events to
     */
    constructor(isometricCamera, domElement) {
        this.isometricCamera = isometricCamera;
        this.domElement = domElement;
        this.panSpeed = 1.0;
        this.zoomSpeed = 0.1;
        this.smoothing = 0.1;
        this.keys = { up: false, down: false, left: false, right: false };
        this.velocity = { x: 0, z: 0 };
        this.targetVelocity = { x: 0, z: 0 };
        this.pixelSnap = false;
        this.isMiddleMouseDown = false;
        this.lastPan = { x: 0, y: 0 };
        this._setupEventListeners();
    }

    _setupEventListeners() {
        document.addEventListener('keydown', (e) => this._onKeyDown(e));
        document.addEventListener('keyup', (e) => this._onKeyUp(e));
        this.domElement.addEventListener('wheel', (e) => this._onWheel(e));
        this.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                this.isMiddleMouseDown = true;
                this.lastPan.x = e.clientX;
                this.lastPan.y = e.clientY;
                e.preventDefault();
            }
        });
        this.domElement.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                this.isMiddleMouseDown = false;
                e.preventDefault();
            }
        });
        this.domElement.addEventListener('mouseleave', () => {
            this.isMiddleMouseDown = false;
        });
        this.domElement.addEventListener('mousemove', (e) => {
            if (this.isMiddleMouseDown) {
                const dx = e.clientX - this.lastPan.x;
                const dy = e.clientY - this.lastPan.y;
                this.lastPan.x = e.clientX;
                this.lastPan.y = e.clientY;
                // Inverted screen-space (2D) pan: dragging right moves view left, dragging down moves view up
                const cam = this.isometricCamera.camera;
                const width = cam.right - cam.left;
                const height = cam.top - cam.bottom;
                const ndc_dx = dx / this.domElement.clientWidth;
                const ndc_dy = dy / this.domElement.clientHeight;
                const world_dx = ndc_dx * width;
                const world_dz = ndc_dy * height;
                // Invert pan direction
                const right = new THREE.Vector3();
                cam.getWorldDirection(right); // forward
                right.cross(cam.up).setY(0).normalize(); // right in XZ
                const down = new THREE.Vector3().crossVectors(right, cam.up).setY(0).normalize(); // down in XZ
                cam.position.addScaledVector(right, -world_dx);
                cam.position.addScaledVector(down, -world_dz);
                if (this._updateCamera) this._updateCamera();
            }
        });
    }

    _onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.keys.up = true; break;
            case 'KeyS': case 'ArrowDown': this.keys.down = true; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
        }
        this._updateTargetVelocity();
    }

    _onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.keys.up = false; break;
            case 'KeyS': case 'ArrowDown': this.keys.down = false; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
        }
        this._updateTargetVelocity();
    }

    _onWheel(event) {
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
        this.isometricCamera.zoom(zoomFactor);
    }

    _updateTargetVelocity() {
        let x = 0, z = 0;
        if (this.keys.left) x -= this.panSpeed;
        if (this.keys.right) x += this.panSpeed;
        if (this.keys.up) z -= this.panSpeed;
        if (this.keys.down) z += this.panSpeed;
        // Normalize diagonal
        if (x !== 0 && z !== 0) {
            const length = Math.sqrt(x * x + z * z);
            x = x / length * this.panSpeed;
            z = z / length * this.panSpeed;
        }
        this.targetVelocity.x = x;
        this.targetVelocity.z = z;
    }

    /**
     * Call every frame with deltaTime
     */
    update(deltaTime) {
        // Only handle keyboard movement here
        this.velocity.x += (this.targetVelocity.x - this.velocity.x) * this.smoothing;
        this.velocity.z += (this.targetVelocity.z - this.velocity.z) * this.smoothing;
        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            this.isometricCamera.pan(this.velocity.x * deltaTime, this.velocity.z * deltaTime);
            if (this.pixelSnap) {
                this.isometricCamera.snapToPixelGrid();
            }
        }
    }

    setPanSpeed(speed) { this.panSpeed = speed; }
    setZoomSpeed(speed) { this.zoomSpeed = speed; }
    setSmoothing(smoothing) { this.smoothing = Math.max(0, Math.min(1, smoothing)); }
    setPixelSnap(enabled) { this.pixelSnap = enabled; }
}
window.CameraControls = CameraControls; 