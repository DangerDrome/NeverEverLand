/**
 * CameraControls class for handling keyboard and mouse input
 * Provides smooth pan and zoom controls for isometric camera
 */
class CameraControls {
    constructor(isometricCamera, domElement) {
        this.isometricCamera = isometricCamera;
        this.domElement = domElement;
        
        // Control settings
        this.panSpeed = 1.0;
        this.zoomSpeed = 0.1;
        this.smoothing = 0.1;
        
        // Input state
        this.keys = {
            forward: false,    // W or ArrowUp
            backward: false,   // S or ArrowDown
            left: false,       // A or ArrowLeft
            right: false       // D or ArrowRight
        };
        
        // Smooth movement
        this.velocity = { x: 0, z: 0 };
        this.targetVelocity = { x: 0, z: 0 };
        
        this.setupEventListeners();
    }
    
    /**
     * Set up keyboard and mouse event listeners
     */
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Mouse wheel for zooming
        this.domElement.addEventListener('wheel', this.onWheel.bind(this));
        
        // Prevent context menu on right click
        this.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }
    
    /**
     * Handle keydown events
     * @param {KeyboardEvent} event 
     */
    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = true;
                break;
        }
        
        this.updateTargetVelocity();
    }
    
    /**
     * Handle keyup events
     * @param {KeyboardEvent} event 
     */
    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = false;
                break;
        }
        
        this.updateTargetVelocity();
    }
    
    /**
     * Handle mouse wheel events for zooming
     * @param {WheelEvent} event 
     */
    onWheel(event) {
        event.preventDefault();
        
        const zoomFactor = event.deltaY > 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
        this.isometricCamera.zoom(zoomFactor);
    }
    
    /**
     * Update target velocity based on current key states
     */
    updateTargetVelocity() {
        this.targetVelocity.x = 0;
        this.targetVelocity.z = 0;
        
        if (this.keys.left) this.targetVelocity.x -= this.panSpeed;
        if (this.keys.right) this.targetVelocity.x += this.panSpeed;
        if (this.keys.forward) this.targetVelocity.z -= this.panSpeed;
        if (this.keys.backward) this.targetVelocity.z += this.panSpeed;
        
        // Normalize diagonal movement
        if (this.targetVelocity.x !== 0 && this.targetVelocity.z !== 0) {
            const length = Math.sqrt(this.targetVelocity.x ** 2 + this.targetVelocity.z ** 2);
            this.targetVelocity.x = this.targetVelocity.x / length * this.panSpeed;
            this.targetVelocity.z = this.targetVelocity.z / length * this.panSpeed;
        }
    }
    
    /**
     * Update controls (should be called every frame)
     * @param {number} deltaTime - Time since last frame
     */
    update(deltaTime) {
        // Smooth velocity interpolation
        this.velocity.x = this.lerp(this.velocity.x, this.targetVelocity.x, this.smoothing);
        this.velocity.z = this.lerp(this.velocity.z, this.targetVelocity.z, this.smoothing);
        
        // Apply movement if velocity is significant
        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            this.isometricCamera.pan(this.velocity.x * deltaTime, this.velocity.z * deltaTime);
        }
    }
    
    /**
     * Linear interpolation helper
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} factor - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }
    
    /**
     * Set pan speed
     * @param {number} speed - New pan speed
     */
    setPanSpeed(speed) {
        this.panSpeed = speed;
    }
    
    /**
     * Set zoom speed
     * @param {number} speed - New zoom speed
     */
    setZoomSpeed(speed) {
        this.zoomSpeed = speed;
    }
    
    /**
     * Set smoothing factor for movement
     * @param {number} smoothing - Smoothing factor (0-1)
     */
    setSmoothing(smoothing) {
        this.smoothing = Math.max(0, Math.min(1, smoothing));
    }
    
    /**
     * Enable or disable controls
     * @param {boolean} enabled - Whether controls are enabled
     */
    setEnabled(enabled) {
        if (!enabled) {
            // Reset all states when disabling
            this.keys = {
                forward: false,
                backward: false,
                left: false,
                right: false
            };
            this.velocity = { x: 0, z: 0 };
            this.targetVelocity = { x: 0, z: 0 };
        }
        
        this.enabled = enabled;
    }
    
    /**
     * Get current control state for debugging
     * @returns {Object} Current control state
     */
    getState() {
        return {
            keys: { ...this.keys },
            velocity: { ...this.velocity },
            targetVelocity: { ...this.targetVelocity },
            panSpeed: this.panSpeed,
            zoomSpeed: this.zoomSpeed,
            smoothing: this.smoothing
        };
    }
} 