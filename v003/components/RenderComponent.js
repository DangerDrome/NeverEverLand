import { Component } from '../core/Component.js';

export class RenderComponent extends Component {
    constructor() {
        super();
        this.mesh = null;
        this.material = null;
        this.geometry = null;
        this.visible = true;
        this.castShadow = true;
        this.receiveShadow = true;
        this.renderOrder = 0;
        this.active = true;
    }
    
    setMesh(mesh) {
        this.mesh = mesh;
        if (mesh) {
            this.geometry = mesh.geometry;
            this.material = mesh.material;
        }
    }
    
    setVisible(visible) {
        this.visible = visible;
        if (this.mesh) {
            this.mesh.visible = visible;
        }
    }
    
    serialize() {
        return {
            visible: this.visible,
            castShadow: this.castShadow,
            receiveShadow: this.receiveShadow,
            renderOrder: this.renderOrder,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.visible = data.visible !== false;
        this.castShadow = data.castShadow !== false;
        this.receiveShadow = data.receiveShadow !== false;
        this.renderOrder = data.renderOrder || 0;
        this.active = data.active !== false;
    }
}