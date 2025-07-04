import { System } from '../core/System.js';
import { InputComponent } from '../components/InputComponent.js';

/**
 * Input System
 * Handles keyboard, mouse, and gamepad input with command pattern
 */
export class InputSystem extends System {
    constructor(world, domElement) {
        super(world);
        this.requiredComponents = ['InputComponent'];
        this.priority = 5; // High priority - input should be processed early
        
        this.domElement = domElement || document;
        this.gamepadIndex = -1;
        this.gamepadConnected = false;
        
        // Event tracking
        this.eventListeners = [];
        
        // Input state
        this.keyState = new Map();
        this.mouseState = {
            position: { x: 0, y: 0 },
            buttons: new Map(),
            wheel: { x: 0, y: 0 },
            movement: { x: 0, y: 0 }
        };
        
        // Command processing
        this.commandProcessors = new Map();
        this.globalCommands = [];
        
        // Settings
        this.mouseSensitivity = 1.0;
        this.keyRepeat = true;
        this.preventDefault = true;
        
        this.setupEventListeners();
        this.setupDefaultCommandProcessors();
    }
    
    setupEventListeners() {
        // Keyboard events
        this.addEventListener('keydown', this.onKeyDown.bind(this));
        this.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Mouse events
        this.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.addEventListener('wheel', this.onMouseWheel.bind(this));
        this.addEventListener('contextmenu', this.onContextMenu.bind(this));
        
        // Touch events for mobile support
        this.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.addEventListener('touchend', this.onTouchEnd.bind(this));
        this.addEventListener('touchmove', this.onTouchMove.bind(this));
        
        // Gamepad events
        this.addEventListener('gamepadconnected', this.onGamepadConnected.bind(this));
        this.addEventListener('gamepaddisconnected', this.onGamepadDisconnected.bind(this));
        
        // Window focus events
        this.addEventListener('blur', this.onWindowBlur.bind(this));
        this.addEventListener('focus', this.onWindowFocus.bind(this));
    }
    
    addEventListener(event, handler) {
        this.domElement.addEventListener(event, handler);
        this.eventListeners.push({ event, handler });
    }
    
    setupDefaultCommandProcessors() {
        // Movement command processor
        this.commandProcessors.set('movement', (command, entity) => {
            const transform = entity.getComponent('TransformComponent');
            if (transform) {
                const speed = 5.0; // units per second
                transform.setVelocity(
                    command.vector.x * speed,
                    0,
                    -command.vector.y * speed // Invert Y for 3D space
                );
            }
        });
        
        // Action command processor
        this.commandProcessors.set('action', (command, entity) => {
            // Dispatch action events for other systems to handle
            this.world.dispatchEvent?.({
                type: 'input_action',
                entity,
                action: command.action,
                value: command.value
            });
        });
        
        // Camera command processor
        this.commandProcessors.set('camera', (command, entity) => {
            const camera = entity.getComponent('CameraComponent');
            if (camera) {
                switch (command.action) {
                    case 'zoom':
                        camera.viewSize *= (1 + command.delta * 0.1);
                        camera.viewSize = Math.max(5, Math.min(50, camera.viewSize));
                        camera.markDirty();
                        break;
                    case 'focus':
                        // Focus camera on player or target
                        break;
                }
            }
        });
    }
    
    update(deltaTime, entities) {
        // Update gamepad state
        this.updateGamepadState();
        
        // Process input for each entity
        for (const entity of entities) {
            const input = entity.getComponent('InputComponent');
            
            if (!input.enabled) continue;
            
            // Update input state
            this.updateInputState(input);
            
            // Process commands
            this.processCommands(input, entity);
            
            // Clear frame-specific state
            input.clearFrameState();
        }
        
        // Process global commands
        this.processGlobalCommands();
        
        // Clear frame-specific global state
        this.clearFrameState();
    }
    
    updateInputState(input) {
        // Copy key state
        for (const [keyCode, state] of this.keyState) {
            if (!input.keys.has(keyCode)) {
                input.keys.set(keyCode, { pressed: false, justPressed: false, justReleased: false });
            }
            
            const inputState = input.keys.get(keyCode);
            inputState.justPressed = state.justPressed;
            inputState.justReleased = state.justReleased;
            inputState.pressed = state.pressed;
        }
        
        // Copy mouse state
        input.mouse.position = { ...this.mouseState.position };
        input.mouse.movement = { ...this.mouseState.movement };
        input.mouse.wheel = { ...this.mouseState.wheel };
        
        for (const [button, state] of this.mouseState.buttons) {
            if (!input.mouse.buttons.has(button)) {
                input.mouse.buttons.set(button, { pressed: false, justPressed: false, justReleased: false });
            }
            
            const inputState = input.mouse.buttons.get(button);
            inputState.justPressed = state.justPressed;
            inputState.justReleased = state.justReleased;
            inputState.pressed = state.pressed;
        }
        
        // Generate commands from input mappings
        this.generateCommandsFromInput(input);
    }
    
    generateCommandsFromInput(input) {
        const keyMappings = input.keyMappings.get(input.activeContext);
        const mouseMappings = input.mouseMappings.get(input.activeContext);
        
        // Process key mappings
        if (keyMappings) {
            for (const [keyCode, action] of keyMappings) {
                if (input.isKeyJustPressed(keyCode)) {
                    input.addCommand({
                        type: 'action',
                        action,
                        pressed: true
                    });
                } else if (input.isKeyJustReleased(keyCode)) {
                    input.addCommand({
                        type: 'action',
                        action,
                        pressed: false
                    });
                }
            }
        }
        
        // Process mouse mappings
        if (mouseMappings) {
            for (const [button, action] of mouseMappings) {
                if (input.isMouseButtonJustPressed(button)) {
                    input.addCommand({
                        type: 'action',
                        action,
                        pressed: true,
                        mousePosition: { ...input.mouse.position },
                        worldPosition: { ...input.mouse.worldPosition }
                    });
                }
            }
        }
        
        // Generate movement commands
        const movementVector = input.getMovementVector();
        if (movementVector.x !== 0 || movementVector.y !== 0) {
            input.addCommand({
                type: 'movement',
                vector: movementVector
            });
        }
        
        // Generate mouse wheel commands
        if (input.mouse.wheel.y !== 0) {
            input.addCommand({
                type: 'camera',
                action: 'zoom',
                delta: input.mouse.wheel.y
            });
        }
    }
    
    processCommands(input, entity) {
        const commands = input.getCommands();
        
        for (const command of commands) {
            const processor = this.commandProcessors.get(command.type);
            if (processor) {
                processor(command, entity);
            }
            
            // Add to input buffer for complex input sequences
            input.addToBuffer(command.action || command.type);
        }
    }
    
    processGlobalCommands() {
        for (const command of this.globalCommands) {
            // Process commands that affect the whole game
            switch (command.type) {
                case 'toggle_debug':
                    this.world.debugMode = !this.world.debugMode;
                    break;
                case 'toggle_pause':
                    this.world.paused = !this.world.paused;
                    break;
            }
        }
        this.globalCommands = [];
    }
    
    updateGamepadState() {
        if (!this.gamepadConnected) return;
        
        const gamepad = navigator.getGamepads()[this.gamepadIndex];
        if (!gamepad) return;
        
        // Update gamepad state for all input components
        const entities = this.world.query(['InputComponent']);
        for (const entity of entities) {
            const input = entity.getComponent('InputComponent');
            if (input.enabled) {
                input.updateGamepad(gamepad);
            }
        }
    }
    
    // Event handlers
    onKeyDown(event) {
        if (this.preventDefault) {
            // Prevent default for game keys, but allow browser shortcuts
            if (!event.ctrlKey && !event.metaKey) {
                event.preventDefault();
            }
        }
        
        const keyCode = event.code;
        const state = this.getKeyState(keyCode);
        
        // Only trigger justPressed if key wasn't already pressed (prevents key repeat)
        if (!state.pressed || this.keyRepeat) {
            state.justPressed = true;
        }
        state.pressed = true;
        
        // Update modifier keys
        this.updateModifiers(event);
        
        // Add to buffer for complex sequences
        this.addGlobalCommand({ type: 'key', key: keyCode, pressed: true });
    }
    
    onKeyUp(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }
        
        const keyCode = event.code;
        const state = this.getKeyState(keyCode);
        
        state.justReleased = true;
        state.pressed = false;
        
        // Update modifier keys
        this.updateModifiers(event);
    }
    
    onMouseDown(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }
        
        const button = event.button;
        const state = this.getMouseButtonState(button);
        
        state.justPressed = true;
        state.pressed = true;
        
        this.updateMousePosition(event);
    }
    
    onMouseUp(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }
        
        const button = event.button;
        const state = this.getMouseButtonState(button);
        
        state.justReleased = true;
        state.pressed = false;
        
        this.updateMousePosition(event);
    }
    
    onMouseMove(event) {
        const oldX = this.mouseState.position.x;
        const oldY = this.mouseState.position.y;
        
        this.updateMousePosition(event);
        
        this.mouseState.movement.x = this.mouseState.position.x - oldX;
        this.mouseState.movement.y = this.mouseState.position.y - oldY;
        
        // Apply sensitivity
        this.mouseState.movement.x *= this.mouseSensitivity;
        this.mouseState.movement.y *= this.mouseSensitivity;
    }
    
    onMouseWheel(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }
        
        this.mouseState.wheel.x = event.deltaX;
        this.mouseState.wheel.y = event.deltaY;
    }
    
    onContextMenu(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }
    }
    
    // Touch event handlers for mobile support
    onTouchStart(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.mouseState.position.x = touch.clientX;
            this.mouseState.position.y = touch.clientY;
            
            // Simulate left mouse button
            const state = this.getMouseButtonState(0);
            state.justPressed = true;
            state.pressed = true;
        }
    }
    
    onTouchEnd(event) {
        if (event.changedTouches.length === 1) {
            // Simulate left mouse button release
            const state = this.getMouseButtonState(0);
            state.justReleased = true;
            state.pressed = false;
        }
    }
    
    onTouchMove(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const oldX = this.mouseState.position.x;
            const oldY = this.mouseState.position.y;
            
            this.mouseState.position.x = touch.clientX;
            this.mouseState.position.y = touch.clientY;
            
            this.mouseState.movement.x = this.mouseState.position.x - oldX;
            this.mouseState.movement.y = this.mouseState.position.y - oldY;
        }
    }
    
    // Gamepad event handlers
    onGamepadConnected(event) {
        console.log('Gamepad connected:', event.gamepad);
        this.gamepadIndex = event.gamepad.index;
        this.gamepadConnected = true;
    }
    
    onGamepadDisconnected(event) {
        console.log('Gamepad disconnected:', event.gamepad);
        if (event.gamepad.index === this.gamepadIndex) {
            this.gamepadConnected = false;
            this.gamepadIndex = -1;
        }
    }
    
    onWindowBlur() {
        // Clear all input state when window loses focus
        this.keyState.clear();
        this.mouseState.buttons.clear();
    }
    
    onWindowFocus() {
        // Reset input state when window gains focus
        this.clearFrameState();
    }
    
    // Utility methods
    getKeyState(keyCode) {
        if (!this.keyState.has(keyCode)) {
            this.keyState.set(keyCode, {
                pressed: false,
                justPressed: false,
                justReleased: false
            });
        }
        return this.keyState.get(keyCode);
    }
    
    getMouseButtonState(button) {
        if (!this.mouseState.buttons.has(button)) {
            this.mouseState.buttons.set(button, {
                pressed: false,
                justPressed: false,
                justReleased: false
            });
        }
        return this.mouseState.buttons.get(button);
    }
    
    updateMousePosition(event) {
        this.mouseState.position.x = event.clientX;
        this.mouseState.position.y = event.clientY;
    }
    
    updateModifiers(event) {
        // Update modifier key state (available globally)
        const entities = this.world.query(['InputComponent']);
        for (const entity of entities) {
            const input = entity.getComponent('InputComponent');
            input.modifiers.shift = event.shiftKey;
            input.modifiers.ctrl = event.ctrlKey;
            input.modifiers.alt = event.altKey;
            input.modifiers.meta = event.metaKey;
        }
    }
    
    addGlobalCommand(command) {
        this.globalCommands.push(command);
    }
    
    clearFrameState() {
        // Clear just pressed/released states
        for (const state of this.keyState.values()) {
            state.justPressed = false;
            state.justReleased = false;
        }
        
        for (const state of this.mouseState.buttons.values()) {
            state.justPressed = false;
            state.justReleased = false;
        }
        
        // Clear mouse movement and wheel
        this.mouseState.movement.x = 0;
        this.mouseState.movement.y = 0;
        this.mouseState.wheel.x = 0;
        this.mouseState.wheel.y = 0;
    }
    
    // Command processor management
    addCommandProcessor(type, processor) {
        this.commandProcessors.set(type, processor);
    }
    
    removeCommandProcessor(type) {
        this.commandProcessors.delete(type);
    }
    
    // Settings
    setMouseSensitivity(sensitivity) {
        this.mouseSensitivity = sensitivity;
    }
    
    setKeyRepeat(enabled) {
        this.keyRepeat = enabled;
    }
    
    setPreventDefault(enabled) {
        this.preventDefault = enabled;
    }
    
    // Cleanup
    onRemoved() {
        // Remove all event listeners
        for (const { event, handler } of this.eventListeners) {
            this.domElement.removeEventListener(event, handler);
        }
        this.eventListeners = [];
    }
}