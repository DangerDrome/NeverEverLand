import { Component } from '../core/Component.js';

export class NameComponent extends Component {
    constructor(name = 'Entity') {
        super();
        this.name = name;
        this.displayName = name;
        this.active = true;
    }
    
    setName(name) {
        this.name = name;
        this.displayName = name;
    }
    
    serialize() {
        return {
            name: this.name,
            displayName: this.displayName,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.name = data.name || 'Entity';
        this.displayName = data.displayName || this.name;
        this.active = data.active !== false;
    }
}