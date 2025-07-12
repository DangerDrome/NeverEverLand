import { Component } from '../core/Component.js';

export class ScriptComponent extends Component {
    constructor() {
        super();
        this.scripts = [];
        this.active = true;
    }
    
    addScript(script) {
        if (typeof script === 'function') {
            this.scripts.push(script);
        } else if (typeof script === 'object' && script.update) {
            this.scripts.push(script);
        }
    }
    
    removeScript(script) {
        const index = this.scripts.indexOf(script);
        if (index !== -1) {
            this.scripts.splice(index, 1);
        }
    }
    
    update(entity, deltaTime) {
        if (!this.active) return;
        
        this.scripts.forEach(script => {
            if (typeof script === 'function') {
                script(entity, deltaTime);
            } else if (script.update) {
                script.update(entity, deltaTime);
            }
        });
    }
    
    serialize() {
        return {
            active: this.active
            // Scripts are not serialized as they contain functions
        };
    }
    
    deserialize(data) {
        this.active = data.active !== false;
    }
}