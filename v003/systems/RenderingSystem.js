import { System } from '../core/System.js';
import { RenderableComponent, CameraComponent, LightComponent } from '../components/RenderableComponent.js';
import { TransformComponent } from '../components/TransformComponent.js';

/**
 * Rendering System
 * Handles Three.js rendering with frustum culling, instancing, and LOD
 */
export class RenderingSystem extends System {
    constructor(world, renderer) {
        super(world);
        this.requiredComponents = ['RenderableComponent', 'TransformComponent'];
        this.priority = 90; // Low priority - renders after all other systems
        
        this.renderer = renderer;
        this.scene = new THREE.Scene();
        this.activeCamera = null;
        this.cameras = [];
        
        // Rendering optimization
        this.frustum = new THREE.Frustum();
        this.cameraMatrix = new THREE.Matrix4();
        this.instancedMeshes = new Map(); // Material signature -> InstancedMesh
        this.maxInstances = 1000;
        
        // LOD management
        this.lodEnabled = true;
        this.lodBias = 1.0;
        
        // Performance tracking
        this.renderStats = {
            drawCalls: 0,
            triangles: 0,
            entities: 0,
            culled: 0
        };
        
        // Post-processing
        this.composer = null;
        this.postProcessing = false;
        
        // Shadow settings
        this.shadowsEnabled = true;
        this.shadowType = THREE.PCFSoftShadowMap;
        
        this.setupRenderer();
    }
    
    setupRenderer() {
        if (!this.renderer) return;
        
        // Configure renderer
        this.renderer.shadowMap.enabled = this.shadowsEnabled;
        this.renderer.shadowMap.type = this.shadowType;
        this.renderer.setClearColor(0x87CEEB, 1); // Sky blue
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Setup scene
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 100);
    }
    
    update(deltaTime, entities) {
        // Update camera matrices and frustum
        this.updateCameras();
        
        // Update renderable entities
        this.updateRenderables(entities, deltaTime);
        
        // Update lights
        this.updateLights();
        
        // Perform culling
        this.performCulling(entities);
        
        // Update LOD
        if (this.lodEnabled) {
            this.updateLOD(entities);
        }
        
        // Update instanced meshes
        this.updateInstancedMeshes();
        
        // Render the scene
        this.renderScene();
        
        // Update stats
        this.updateRenderStats();
    }
    
    updateCameras() {
        // Find active camera
        const cameraEntities = this.world.query(['CameraComponent', 'TransformComponent']);
        
        for (const entity of cameraEntities) {
            const cameraComp = entity.getComponent('CameraComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!cameraComp.camera) {
                cameraComp.createCamera();
                this.cameras.push(cameraComp);
            }
            
            // Update camera transform
            if (transform.isDirty || cameraComp.isDirty) {
                this.updateCameraTransform(cameraComp, transform);
            }
            
            // Set as active camera (for now, just use the first one)
            if (!this.activeCamera) {
                this.activeCamera = cameraComp;
            }
            
            // Update follow target
            if (cameraComp.followTarget) {
                this.updateCameraFollow(cameraComp, transform, deltaTime);
            }
        }
        
        // Update frustum for culling
        if (this.activeCamera && this.activeCamera.camera) {
            this.cameraMatrix.multiplyMatrices(
                this.activeCamera.camera.projectionMatrix,
                this.activeCamera.camera.matrixWorldInverse
            );
            this.frustum.setFromProjectionMatrix(this.cameraMatrix);
        }
    }
    
    updateCameraTransform(cameraComp, transform) {
        if (!cameraComp.camera) return;
        
        // Update camera position and rotation from transform
        cameraComp.camera.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z
        );
        
        cameraComp.camera.rotation.set(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z
        );
        
        // Look at target if specified
        if (cameraComp.target) {
            cameraComp.camera.lookAt(
                cameraComp.target.x,
                cameraComp.target.y,
                cameraComp.target.z
            );
        }
        
        cameraComp.camera.updateMatrixWorld();
        cameraComp.markClean();
    }
    
    updateCameraFollow(cameraComp, transform, deltaTime) {
        const target = cameraComp.followTarget;
        if (!target) return;
        
        // Calculate desired position
        const desiredX = target.position.x + cameraComp.followOffset.x;
        const desiredY = target.position.y + cameraComp.followOffset.y;
        const desiredZ = target.position.z + cameraComp.followOffset.z;
        
        // Smooth interpolation
        const smoothing = cameraComp.smoothing * deltaTime * 60; // 60fps normalized
        
        transform.position.x += (desiredX - transform.position.x) * smoothing;
        transform.position.y += (desiredY - transform.position.y) * smoothing;
        transform.position.z += (desiredZ - transform.position.z) * smoothing;
        
        transform.markDirty();
    }
    
    updateRenderables(entities, deltaTime) {
        for (const entity of entities) {
            const renderable = entity.getComponent('RenderableComponent');
            const transform = entity.getComponent('TransformComponent');
            
            // Create mesh if needed
            if (!renderable.mesh && this.shouldCreateMesh(renderable)) {
                this.createMeshForRenderable(renderable);
            }
            
            // Update mesh transform
            if (renderable.mesh && (transform.isDirty || renderable.isDirty)) {
                this.updateMeshTransform(renderable, transform);
            }
            
            // Update animations
            if (renderable.animationMixer) {
                renderable.animationMixer.update(deltaTime);
            }
            
            // Update instanced rendering
            if (renderable.instancedMesh && renderable.instanceId >= 0) {
                this.updateInstancedRenderable(renderable, transform);
            }
            
            renderable.markClean();
        }
    }
    
    updateMeshTransform(renderable, transform) {
        if (!renderable.mesh || !transform.worldMatrix) return;
        
        // Convert our matrix format to Three.js matrix
        const matrix = new THREE.Matrix4();
        matrix.fromArray(transform.worldMatrix);
        
        renderable.mesh.matrix.copy(matrix);
        renderable.mesh.matrixAutoUpdate = false;
        renderable.mesh.matrixWorldNeedsUpdate = true;
        
        // Update visibility and other properties
        renderable.mesh.visible = renderable.visible;
        renderable.mesh.renderOrder = renderable.renderOrder;
        renderable.mesh.castShadow = renderable.castShadow;
        renderable.mesh.receiveShadow = renderable.receiveShadow;
        
        // Update opacity
        if (renderable.mesh.material && renderable.opacity !== 1.0) {
            renderable.mesh.material.opacity = renderable.opacity;
            renderable.mesh.material.transparent = true;
        }
    }
    
    updateInstancedRenderable(renderable, transform) {
        if (!transform.worldMatrix) return;
        
        const matrix = new THREE.Matrix4();
        matrix.fromArray(transform.worldMatrix);
        
        renderable.updateInstanceMatrix(matrix);
        
        // Update instance color if needed
        if (renderable.instanceColor) {
            renderable.updateInstanceColor(renderable.instanceColor);
        }
    }
    
    updateLights() {
        const lightEntities = this.world.query(['LightComponent', 'TransformComponent']);
        
        for (const entity of lightEntities) {
            const lightComp = entity.getComponent('LightComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!lightComp.light) {
                lightComp.createLight();
                this.scene.add(lightComp.light);
            }
            
            if (lightComp.isDirty) {
                lightComp.updateProperties();
            }
            
            // Update light position (except ambient lights)
            if (lightComp.type !== 'ambient' && transform.isDirty) {
                lightComp.light.position.set(
                    transform.position.x,
                    transform.position.y,
                    transform.position.z
                );
                
                // Update light rotation for directional and spot lights
                if (lightComp.type === 'directional' || lightComp.type === 'spot') {
                    lightComp.light.rotation.set(
                        transform.rotation.x,
                        transform.rotation.y,
                        transform.rotation.z
                    );
                }
            }
            
            lightComp.markClean();
        }
    }
    
    performCulling(entities) {
        if (!this.activeCamera) return;
        
        let culledCount = 0;
        
        for (const entity of entities) {
            const renderable = entity.getComponent('RenderableComponent');
            const transform = entity.getComponent('TransformComponent');
            
            renderable.isVisible = true;
            
            // Frustum culling
            if (renderable.frustumCulled && renderable.mesh) {
                const bounds = renderable.getBounds();
                if (bounds) {
                    // Transform bounds to world space
                    const worldBounds = bounds.clone();
                    worldBounds.applyMatrix4(renderable.mesh.matrixWorld);
                    
                    if (!this.frustum.intersectsBox(worldBounds)) {
                        renderable.isVisible = false;
                        culledCount++;
                    }
                }
            }
            
            // Distance culling (simple)
            if (renderable.isVisible && this.activeCamera.camera) {
                const distance = this.activeCamera.camera.position.distanceTo(
                    new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z)
                );
                
                if (distance > this.activeCamera.far * 0.9) {
                    renderable.isVisible = false;
                    culledCount++;
                }
            }
            
            // Update mesh visibility
            if (renderable.mesh) {
                renderable.mesh.visible = renderable.visible && renderable.isVisible;
            }
        }
        
        this.renderStats.culled = culledCount;
    }
    
    updateLOD(entities) {
        if (!this.activeCamera) return;
        
        for (const entity of entities) {
            const renderable = entity.getComponent('RenderableComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (renderable.lodLevels.length > 0) {
                const distance = this.activeCamera.camera.position.distanceTo(
                    new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z)
                );
                
                renderable.updateLod(distance * this.lodBias);
            }
        }
    }
    
    updateInstancedMeshes() {
        // Update all instanced meshes
        for (const instancedMesh of this.instancedMeshes.values()) {
            if (instancedMesh.instanceMatrix) {
                instancedMesh.instanceMatrix.needsUpdate = true;
            }
            if (instancedMesh.instanceColor) {
                instancedMesh.instanceColor.needsUpdate = true;
            }
        }
    }
    
    renderScene() {
        if (!this.activeCamera || !this.activeCamera.camera) return;
        
        // Clear previous frame
        this.renderer.clear();
        
        // Set viewport if specified
        if (this.activeCamera.viewport) {
            const vp = this.activeCamera.viewport;
            const size = this.renderer.getSize(new THREE.Vector2());
            this.renderer.setViewport(
                vp.x * size.x,
                vp.y * size.y,
                vp.width * size.x,
                vp.height * size.y
            );
        }
        
        // Render scene
        if (this.postProcessing && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.activeCamera.camera);
        }
    }
    
    updateRenderStats() {
        this.renderStats.drawCalls = this.renderer.info.render.calls;
        this.renderStats.triangles = this.renderer.info.render.triangles;
        this.renderStats.entities = this.scene.children.length;
    }
    
    // Utility methods
    shouldCreateMesh(renderable) {
        // Override in subclasses to implement custom mesh creation logic
        return false;
    }
    
    createMeshForRenderable(renderable) {
        // Override in subclasses to implement custom mesh creation
    }
    
    // Instanced mesh management
    createInstancedMesh(geometry, material, count) {
        const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        
        // Add to scene
        this.scene.add(instancedMesh);
        
        return instancedMesh;
    }
    
    getInstancedMesh(materialSignature) {
        return this.instancedMeshes.get(materialSignature);
    }
    
    registerInstancedMesh(materialSignature, instancedMesh) {
        this.instancedMeshes.set(materialSignature, instancedMesh);
    }
    
    // Camera management
    setActiveCamera(cameraComponent) {
        this.activeCamera = cameraComponent;
    }
    
    getActiveCamera() {
        return this.activeCamera;
    }
    
    // Scene management
    addToScene(object) {
        this.scene.add(object);
    }
    
    removeFromScene(object) {
        this.scene.remove(object);
    }
    
    getScene() {
        return this.scene;
    }
    
    // Post-processing
    enablePostProcessing(composer) {
        this.composer = composer;
        this.postProcessing = true;
    }
    
    disablePostProcessing() {
        this.postProcessing = false;
    }
    
    // Performance
    getRenderStats() {
        return { ...this.renderStats };
    }
    
    // Window resize handling
    onWindowResize(width, height) {
        this.renderer.setSize(width, height);
        
        // Update camera aspect ratios
        for (const cameraComp of this.cameras) {
            if (cameraComp.camera && !cameraComp.isOrthographic) {
                cameraComp.aspect = width / height;
                cameraComp.updateProjection();
            }
        }
    }
}