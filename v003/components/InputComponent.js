import { Component } from '../core/Component.js';

/**
 * Input Component
 * Handles input mapping and command processing
 */
export class InputComponent extends Component {
    constructor() {
        super();
        
        this.enabled = true;
        this.priority = 0; // Higher priority processes input first
        
        // Input mappings
        this.keyMappings = new Map();
        this.mouseMappings = new Map();
        this.gamepadMappings = new Map();
        
        // Input state
        this.keys = new Map(); // Key -> { pressed, justPressed, justReleased }
        this.mouse = {
            position: { x: 0, y: 0 },
            worldPosition: { x: 0, y: 0, z: 0 },
            buttons: new Map(),
            wheel: { x: 0, y: 0 },
            movement: { x: 0, y: 0 }
        };
        
        // Command queue
        this.commands = [];
        this.commandHistory = [];
        this.maxHistorySize = 100;
        
        // Input buffering for fighting game style inputs
        this.inputBuffer = [];
        this.bufferSize = 10;
        this.bufferTimeWindow = 200; // ms
        
        // Context system for different input modes
        this.contexts = new Map();
        this.activeContext = 'default';
        
        // Modifier keys
        this.modifiers = {
            shift: false,
            ctrl: false,
            alt: false,
            meta: false
        };
        
        this.setupDefaultMappings();
    }
    
    setupDefaultMappings() {
        // Default movement mappings
        this.mapKey('KeyW', 'move_up');
        this.mapKey('KeyS', 'move_down');
        this.mapKey('KeyA', 'move_left');
        this.mapKey('KeyD', 'move_right');
        this.mapKey('ArrowUp', 'move_up');
        this.mapKey('ArrowDown', 'move_down');
        this.mapKey('ArrowLeft', 'move_left');
        this.mapKey('ArrowRight', 'move_right');
        
        // Action mappings
        this.mapKey('Space', 'action');
        this.mapKey('KeyE', 'interact');
        this.mapKey('KeyQ', 'secondary_action');
        this.mapKey('Escape', 'menu');
        this.mapKey('Tab', 'inventory');
        
        // Mouse mappings
        this.mapMouse(0, 'primary_click');
        this.mapMouse(1, 'secondary_click');
        this.mapMouse(2, 'middle_click');
        
        // Camera controls
        this.mapKey('KeyF', 'focus_camera');
        this.mapKey('KeyR', 'reset_camera');
        
        // Debug mappings
        this.mapKey('F1', 'toggle_debug');
        this.mapKey('F2', 'toggle_wireframe');
        this.mapKey('F3', 'toggle_stats');
    }
    
    // Input mapping methods
    mapKey(keyCode, action, context = 'default') {
        if (!this.keyMappings.has(context)) {
            this.keyMappings.set(context, new Map());
        }
        this.keyMappings.get(context).set(keyCode, action);
    }
    
    mapMouse(button, action, context = 'default') {
        if (!this.mouseMappings.has(context)) {
            this.mouseMappings.set(context, new Map());
        }
        this.mouseMappings.get(context).set(button, action);
    }
    
    mapGamepad(button, action, context = 'default') {
        if (!this.gamepadMappings.has(context)) {
            this.gamepadMappings.set(context, new Map());
        }
        this.gamepadMappings.get(context).set(button, action);
    }
    
    // Context management
    addContext(name, mappings = {}) {
        this.contexts.set(name, mappings);
        
        // Set up key mappings for this context
        if (mappings.keys) {
            for (const [key, action] of Object.entries(mappings.keys)) {
                this.mapKey(key, action, name);
            }
        }
        
        // Set up mouse mappings for this context
        if (mappings.mouse) {
            for (const [button, action] of Object.entries(mappings.mouse)) {
                this.mapMouse(parseInt(button), action, name);
            }
        }
    }
    
    setActiveContext(context) {
        this.activeContext = context;
        this.markDirty();
    }
    
    // Input state methods
    isKeyPressed(keyCode) {
        const state = this.keys.get(keyCode);
        return state ? state.pressed : false;
    }
    
    isKeyJustPressed(keyCode) {
        const state = this.keys.get(keyCode);
        return state ? state.justPressed : false;
    }
    
    isKeyJustReleased(keyCode) {
        const state = this.keys.get(keyCode);
        return state ? state.justReleased : false;
    }
    
    isActionPressed(action) {
        const mappings = this.keyMappings.get(this.activeContext);
        if (!mappings) return false;
        
        for (const [keyCode, mappedAction] of mappings) {
            if (mappedAction === action && this.isKeyPressed(keyCode)) {
                return true;
            }
        }
        return false;
    }
    
    isActionJustPressed(action) {
        const mappings = this.keyMappings.get(this.activeContext);
        if (!mappings) return false;
        
        for (const [keyCode, mappedAction] of mappings) {
            if (mappedAction === action && this.isKeyJustPressed(keyCode)) {
                return true;
            }
        }
        return false;
    }
    
    isMouseButtonPressed(button) {
        const state = this.mouse.buttons.get(button);
        return state ? state.pressed : false;
    }
    
    isMouseButtonJustPressed(button) {
        const state = this.mouse.buttons.get(button);
        return state ? state.justPressed : false;
    }
    
    // Command system
    addCommand(command) {
        this.commands.push(command);
        
        // Add to history
        this.commandHistory.push({
            command,
            timestamp: performance.now()
        });
        
        // Limit history size
        if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory.shift();
        }
        
        this.markDirty();
    }
    
    getCommands() {
        const commands = [...this.commands];
        this.commands = [];
        return commands;
    }
    
    // Input buffering for complex inputs
    addToBuffer(input) {
        this.inputBuffer.push({
            input,
            timestamp: performance.now()
        });
        
        // Remove old inputs
        const now = performance.now();
        this.inputBuffer = this.inputBuffer.filter(
            item => now - item.timestamp < this.bufferTimeWindow
        );
        
        // Limit buffer size
        if (this.inputBuffer.length > this.bufferSize) {
            this.inputBuffer.shift();
        }
    }
    
    checkInputSequence(sequence) {
        if (this.inputBuffer.length < sequence.length) return false;
        
        const recent = this.inputBuffer.slice(-sequence.length);
        return sequence.every((input, index) => recent[index].input === input);
    }
    
    // Movement vector calculation
    getMovementVector() {
        const vector = { x: 0, y: 0 };
        
        if (this.isActionPressed('move_up')) vector.y += 1;
        if (this.isActionPressed('move_down')) vector.y -= 1;
        if (this.isActionPressed('move_left')) vector.x -= 1;
        if (this.isActionPressed('move_right')) vector.x += 1;
        
        // Normalize diagonal movement
        if (vector.x !== 0 && vector.y !== 0) {
            const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
            vector.x /= length;
            vector.y /= length;
        }
        
        return vector;
    }
    
    // Mouse world position calculation (needs camera)
    updateMouseWorldPosition(camera, renderer) {
        if (!camera) return;
        
        const mouse = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        
        // Convert screen position to normalized device coordinates
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((this.mouse.position.x - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((this.mouse.position.y - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        // Intersect with ground plane (y = 0)
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        
        if (raycaster.ray.intersectPlane(plane, intersection)) {
            this.mouse.worldPosition = {
                x: intersection.x,
                y: intersection.y,
                z: intersection.z
            };
        }
    }
    
    // Gamepad support
    updateGamepad(gamepad) {
        if (!gamepad) return;
        
        // Check buttons
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const button = gamepad.buttons[i];
            const mappings = this.gamepadMappings.get(this.activeContext);
            
            if (mappings && mappings.has(i)) {
                const action = mappings.get(i);
                if (button.pressed) {
                    this.addCommand({ type: 'action', action, value: button.value });
                }
            }
        }
        
        // Check axes (analog sticks)
        if (gamepad.axes.length >= 2) {
            const leftStick = {
                x: Math.abs(gamepad.axes[0]) > 0.1 ? gamepad.axes[0] : 0,
                y: Math.abs(gamepad.axes[1]) > 0.1 ? gamepad.axes[1] : 0
            };
            
            if (leftStick.x !== 0 || leftStick.y !== 0) {
                this.addCommand({
                    type: 'movement',
                    vector: leftStick
                });
            }
        }
    }
    
    // Clear frame-specific state
    clearFrameState() {
        // Clear just pressed/released states
        for (const state of this.keys.values()) {
            state.justPressed = false;
            state.justReleased = false;
        }
        
        for (const state of this.mouse.buttons.values()) {
            state.justPressed = false;
            state.justReleased = false;
        }
        
        // Clear mouse movement
        this.mouse.movement.x = 0;
        this.mouse.movement.y = 0;
        this.mouse.wheel.x = 0;
        this.mouse.wheel.y = 0;
    }
    
    // Enable/disable input
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.commands = [];
        }
        this.markDirty();
    }
    
    // Reset method for object pooling
    reset() {
        this.enabled = true;
        this.priority = 0;
        this.keys.clear();
        this.mouse.buttons.clear();
        this.commands = [];
        this.commandHistory = [];
        this.inputBuffer = [];
        this.activeContext = 'default';
        this.modifiers = {
            shift: false,
            ctrl: false,
            alt: false,
            meta: false
        };
    }
    
    // Serialization
    serialize() {
        return {
            enabled: this.enabled,
            priority: this.priority,
            activeContext: this.activeContext,
            // Note: We don't serialize input state, only configuration
            keyMappings: Object.fromEntries(this.keyMappings),
            mouseMappings: Object.fromEntries(this.mouseMappings),
            gamepadMappings: Object.fromEntries(this.gamepadMappings)
        };
    }
    
    deserialize(data) {
        this.enabled = data.enabled ?? true;
        this.priority = data.priority ?? 0;
        this.activeContext = data.activeContext ?? 'default';
        
        // Restore mappings
        if (data.keyMappings) {
            this.keyMappings = new Map(Object.entries(data.keyMappings));
        }
        if (data.mouseMappings) {
            this.mouseMappings = new Map(Object.entries(data.mouseMappings));
        }
        if (data.gamepadMappings) {
            this.gamepadMappings = new Map(Object.entries(data.gamepadMappings));
        }
        
        this.markDirty();
    }
}