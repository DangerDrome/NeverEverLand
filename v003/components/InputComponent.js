import { Component } from '../core/Component.js';

export class InputComponent extends Component {
    constructor() {
        super();
        this.keys = {};
        this.mouse = { x: 0, y: 0, buttons: {} };
        this.active = true;
        
        // Set up input listeners
        this.setupListeners();
    }
    
    setupListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') {
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        document.addEventListener('mousedown', (e) => {
            this.mouse.buttons[e.button] = true;
        });
        
        document.addEventListener('mouseup', (e) => {
            this.mouse.buttons[e.button] = false;
        });
    }
    
    isKeyPressed(keyCode) {
        return this.keys[keyCode] || false;
    }
    
    isMouseButtonPressed(button) {
        return this.mouse.buttons[button] || false;
    }
    
    serialize() {
        return {
            active: this.active
        };
    }
    
    deserialize(data) {
        this.active = data.active !== false;
    }
}