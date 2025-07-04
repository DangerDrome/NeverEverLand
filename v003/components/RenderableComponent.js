import { Component } from '../core/Component.js';

/**
 * Renderable Component
 * Contains mesh, material, and rendering properties
 */
export class RenderableComponent extends Component {
    constructor(mesh = null, material = null) {
        super();
        
        this.mesh = mesh;
        this.material = material;
        this.visible = true;
        this.castShadow = true;
        this.receiveShadow = true;
        this.renderOrder = 0;
        this.opacity = 1.0;
        
        // LOD (Level of Detail) settings
        this.lodLevels = [];
        this.currentLod = 0;
        this.lodDistance = 0;
        
        // Culling
        this.frustumCulled = true;
        this.occlusionCulled = false;
        this.isVisible = true; // Computed by rendering system
        
        // Animation
        this.animationMixer = null;
        this.animations = new Map();
        this.currentAnimation = null;
        
        // Instancing
        this.instanceId = -1;
        this.instancedMesh = null;
        this.instanceMatrix = null;
        this.instanceColor = null;
    }
    
    // Mesh management
    setMesh(mesh) {
        this.mesh = mesh;
        this.markDirty();
    }
    
    setMaterial(material) {
        this.material = material;
        if (this.mesh) {
            this.mesh.material = material;
        }
        this.markDirty();
    }
    
    // Visibility
    setVisible(visible) {
        this.visible = visible;
        this.markDirty();
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
        if (this.material) {
            this.material.opacity = this.opacity;
            this.material.transparent = this.opacity < 1.0;
        }
        this.markDirty();
    }
    
    // LOD (Level of Detail)
    addLodLevel(mesh, distance) {
        this.lodLevels.push({ mesh, distance });
        this.lodLevels.sort((a, b) => a.distance - b.distance);
        this.markDirty();
    }
    
    updateLod(cameraDistance) {
        if (this.lodLevels.length === 0) return;
        
        let newLod = 0;
        for (let i = 0; i < this.lodLevels.length; i++) {
            if (cameraDistance >= this.lodLevels[i].distance) {
                newLod = i;
            }
        }
        
        if (newLod !== this.currentLod) {
            this.currentLod = newLod;
            this.mesh = this.lodLevels[newLod].mesh;
            this.markDirty();
        }
        
        this.lodDistance = cameraDistance;
    }
    
    // Animation
    setAnimation(name, action) {
        this.animations.set(name, action);
    }
    
    playAnimation(name, loop = true, fadeTime = 0.3) {
        const action = this.animations.get(name);
        if (!action) return;
        
        // Fade out current animation
        if (this.currentAnimation && this.currentAnimation !== action) {
            this.currentAnimation.fadeOut(fadeTime);
        }
        
        // Fade in new animation
        action.reset();
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
        action.fadeIn(fadeTime);
        action.play();
        
        this.currentAnimation = action;
    }
    
    stopAnimation(fadeTime = 0.3) {
        if (this.currentAnimation) {
            this.currentAnimation.fadeOut(fadeTime);
            this.currentAnimation = null;
        }
    }
    
    // Instancing
    setInstanceId(id, instancedMesh) {
        this.instanceId = id;
        this.instancedMesh = instancedMesh;
        this.markDirty();
    }
    
    updateInstanceMatrix(matrix) {
        if (this.instancedMesh && this.instanceId >= 0) {
            this.instancedMesh.setMatrixAt(this.instanceId, matrix);
            this.instancedMesh.instanceMatrix.needsUpdate = true;
        }
    }
    
    updateInstanceColor(color) {
        if (this.instancedMesh && this.instanceId >= 0) {
            this.instancedMesh.setColorAt(this.instanceId, color);
            if (this.instancedMesh.instanceColor) {
                this.instancedMesh.instanceColor.needsUpdate = true;
            }
        }
    }
    
    // Culling
    setCulling(frustum = true, occlusion = false) {
        this.frustumCulled = frustum;
        this.occlusionCulled = occlusion;
        this.markDirty();
    }
    
    // Shadows
    setShadows(cast = true, receive = true) {
        this.castShadow = cast;
        this.receiveShadow = receive;
        if (this.mesh) {
            this.mesh.castShadow = cast;
            this.mesh.receiveShadow = receive;
        }
        this.markDirty();
    }
    
    // Utility methods
    getBounds() {
        if (!this.mesh || !this.mesh.geometry) return null;
        
        if (!this.mesh.geometry.boundingBox) {
            this.mesh.geometry.computeBoundingBox();
        }
        
        return this.mesh.geometry.boundingBox;
    }
    
    getScreenSize(camera, renderer) {
        const bounds = this.getBounds();
        if (!bounds) return 0;
        
        // Calculate approximate screen size for LOD
        const distance = camera.position.distanceTo(this.mesh.position);
        const size = bounds.getSize();
        const maxSize = Math.max(size.x, size.y, size.z);
        
        // Rough screen size calculation
        const fov = camera.fov * Math.PI / 180;
        const screenHeight = renderer.getSize().height;
        const screenSize = (maxSize / distance) * (screenHeight / (2 * Math.tan(fov / 2)));
        
        return screenSize;
    }
    
    // Reset for object pooling
    reset() {
        this.mesh = null;
        this.material = null;
        this.visible = true;
        this.castShadow = true;
        this.receiveShadow = true;
        this.renderOrder = 0;
        this.opacity = 1.0;
        
        this.lodLevels = [];
        this.currentLod = 0;
        this.lodDistance = 0;
        
        this.frustumCulled = true;
        this.occlusionCulled = false;
        this.isVisible = true;
        
        this.animationMixer = null;
        this.animations.clear();
        this.currentAnimation = null;
        
        this.instanceId = -1;
        this.instancedMesh = null;
        this.instanceMatrix = null;
        this.instanceColor = null;
    }
    
    // Serialization
    serialize() {
        return {
            visible: this.visible,
            castShadow: this.castShadow,
            receiveShadow: this.receiveShadow,
            renderOrder: this.renderOrder,
            opacity: this.opacity,
            frustumCulled: this.frustumCulled,
            occlusionCulled: this.occlusionCulled,
            currentLod: this.currentLod
        };
    }
    
    deserialize(data) {
        this.visible = data.visible ?? true;
        this.castShadow = data.castShadow ?? true;
        this.receiveShadow = data.receiveShadow ?? true;
        this.renderOrder = data.renderOrder ?? 0;
        this.opacity = data.opacity ?? 1.0;
        this.frustumCulled = data.frustumCulled ?? true;
        this.occlusionCulled = data.occlusionCulled ?? false;
        this.currentLod = data.currentLod ?? 0;
        
        this.markDirty();
    }
}

/**
 * Camera Component
 * Handles camera properties and projection
 */
export class CameraComponent extends Component {
    constructor(fov = 75, aspect = 1, near = 0.1, far = 1000) {
        super();
        
        this.camera = null;
        this.fov = fov;
        this.aspect = aspect;
        this.near = near;
        this.far = far;
        
        // Isometric/Orthographic settings
        this.isOrthographic = false;
        this.viewSize = 20;
        this.left = -10;
        this.right = 10;
        this.top = 10;
        this.bottom = -10;
        
        // Camera movement
        this.target = { x: 0, y: 0, z: 0 };
        this.smoothing = 0.1;
        this.followTarget = null;
        this.followOffset = { x: 0, y: 10, z: 10 };
        
        // Viewport
        this.viewport = { x: 0, y: 0, width: 1, height: 1 };
        
        // Post-processing
        this.renderTarget = null;
        this.postProcessing = false;
    }
    
    createCamera() {
        if (this.isOrthographic) {
            this.camera = new THREE.OrthographicCamera(
                this.left, this.right, this.top, this.bottom, this.near, this.far
            );
        } else {
            this.camera = new THREE.PerspectiveCamera(this.fov, this.aspect, this.near, this.far);
        }
        
        this.markDirty();
        return this.camera;
    }
    
    updateProjection() {
        if (!this.camera) return;
        
        if (this.isOrthographic) {
            this.camera.left = this.left;
            this.camera.right = this.right;
            this.camera.top = this.top;
            this.camera.bottom = this.bottom;
        } else {
            this.camera.fov = this.fov;
            this.camera.aspect = this.aspect;
        }
        
        this.camera.near = this.near;
        this.camera.far = this.far;
        this.camera.updateProjectionMatrix();
        
        this.markDirty();
    }
    
    setOrthographic(size, aspect) {
        this.isOrthographic = true;
        this.viewSize = size;
        
        const halfWidth = size * aspect * 0.5;
        const halfHeight = size * 0.5;
        
        this.left = -halfWidth;
        this.right = halfWidth;
        this.top = halfHeight;
        this.bottom = -halfHeight;
        
        this.updateProjection();
    }
    
    setPerspective(fov, aspect) {
        this.isOrthographic = false;
        this.fov = fov;
        this.aspect = aspect;
        this.updateProjection();
    }
    
    setTarget(x, y, z) {
        this.target.x = x;
        this.target.y = y;
        this.target.z = z;
        this.markDirty();
    }
    
    setFollowTarget(transform, offset = null) {
        this.followTarget = transform;
        if (offset) {
            this.followOffset = { ...offset };
        }
        this.markDirty();
    }
    
    setViewport(x, y, width, height) {
        this.viewport = { x, y, width, height };
        this.markDirty();
    }
    
    // Reset for object pooling
    reset() {
        this.camera = null;
        this.fov = 75;
        this.aspect = 1;
        this.near = 0.1;
        this.far = 1000;
        this.isOrthographic = false;
        this.viewSize = 20;
        this.target = { x: 0, y: 0, z: 0 };
        this.smoothing = 0.1;
        this.followTarget = null;
        this.followOffset = { x: 0, y: 10, z: 10 };
        this.viewport = { x: 0, y: 0, width: 1, height: 1 };
        this.renderTarget = null;
        this.postProcessing = false;
    }
}

/**
 * Light Component
 * Handles various light types and properties
 */
export class LightComponent extends Component {
    constructor(type = 'directional', color = 0xffffff, intensity = 1) {
        super();
        
        this.light = null;
        this.type = type; // 'directional', 'point', 'spot', 'ambient'
        this.color = color;
        this.intensity = intensity;
        
        // Shadow settings
        this.castShadow = false;
        this.shadowMapSize = 1024;
        this.shadowCamera = {
            near: 0.5,
            far: 50,
            left: -10,
            right: 10,
            top: 10,
            bottom: -10
        };
        
        // Spot light specific
        this.angle = Math.PI / 6;
        this.penumbra = 0;
        this.decay = 1;
        this.distance = 0;
        
        // Point light specific
        this.range = 0;
    }
    
    createLight() {
        switch (this.type) {
            case 'directional':
                this.light = new THREE.DirectionalLight(this.color, this.intensity);
                break;
            case 'point':
                this.light = new THREE.PointLight(this.color, this.intensity, this.range, this.decay);
                break;
            case 'spot':
                this.light = new THREE.SpotLight(this.color, this.intensity, this.distance, this.angle, this.penumbra, this.decay);
                break;
            case 'ambient':
                this.light = new THREE.AmbientLight(this.color, this.intensity);
                break;
        }
        
        if (this.light && this.castShadow && this.type !== 'ambient') {
            this.light.castShadow = true;
            this.light.shadow.mapSize.width = this.shadowMapSize;
            this.light.shadow.mapSize.height = this.shadowMapSize;
            
            if (this.light.shadow.camera) {
                Object.assign(this.light.shadow.camera, this.shadowCamera);
            }
        }
        
        this.markDirty();
        return this.light;
    }
    
    updateProperties() {
        if (!this.light) return;
        
        this.light.color.setHex(this.color);
        this.light.intensity = this.intensity;
        
        if (this.type === 'spot') {
            this.light.angle = this.angle;
            this.light.penumbra = this.penumbra;
            this.light.decay = this.decay;
            this.light.distance = this.distance;
        } else if (this.type === 'point') {
            this.light.decay = this.decay;
            this.light.distance = this.range;
        }
        
        this.markDirty();
    }
    
    // Reset for object pooling
    reset() {
        this.light = null;
        this.type = 'directional';
        this.color = 0xffffff;
        this.intensity = 1;
        this.castShadow = false;
        this.shadowMapSize = 1024;
    }
}