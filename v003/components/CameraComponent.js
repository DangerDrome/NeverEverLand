import { Component } from '../core/Component.js';

export class CameraComponent extends Component {
    constructor() {
        super();
        this.camera = null;
        this.type = 'perspective'; // 'perspective' or 'orthographic'
        this.fov = 75;
        this.near = 0.1;
        this.far = 1000;
        this.zoom = 1;
        this.target = null; // Entity to follow
        this.offset = { x: 0, y: 10, z: 10 };
        this.smoothing = 0.1;
        this.active = true;
    }
    
    setCamera(camera) {
        this.camera = camera;
    }
    
    setTarget(entity) {
        this.target = entity;
    }
    
    updateProjection() {
        if (!this.camera) return;
        
        if (this.camera.isPerspectiveCamera) {
            this.camera.fov = this.fov;
            this.camera.near = this.near;
            this.camera.far = this.far;
            this.camera.updateProjectionMatrix();
        } else if (this.camera.isOrthographicCamera) {
            this.camera.zoom = this.zoom;
            this.camera.near = this.near;
            this.camera.far = this.far;
            this.camera.updateProjectionMatrix();
        }
    }
    
    serialize() {
        return {
            type: this.type,
            fov: this.fov,
            near: this.near,
            far: this.far,
            zoom: this.zoom,
            offset: { ...this.offset },
            smoothing: this.smoothing,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.type = data.type || 'perspective';
        this.fov = data.fov || 75;
        this.near = data.near || 0.1;
        this.far = data.far || 1000;
        this.zoom = data.zoom || 1;
        this.offset = data.offset || { x: 0, y: 10, z: 10 };
        this.smoothing = data.smoothing || 0.1;
        this.active = data.active !== false;
    }
}