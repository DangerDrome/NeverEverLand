import { System } from '../core/System.js';
import { CameraComponent } from '../components/RenderableComponent.js';
import { TransformComponent } from '../components/TransformComponent.js';

/**
 * Camera System
 * Handles camera movement, focusing, and isometric projection
 */
export class CameraSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['CameraComponent', 'TransformComponent'];
        this.priority = 20; // Medium priority - after input but before rendering
        
        // Camera types
        this.CAMERA_TYPES = {
            ISOMETRIC: 'isometric',
            PERSPECTIVE: 'perspective',
            ORTHOGRAPHIC: 'orthographic'
        };
        
        // Isometric settings (from v002 design doc)
        this.isometricAngle = {
            elevation: Math.atan(0.5), // ≈ 26.57° for dimetric projection
            azimuth: Math.PI / 4       // 45°
        };
        
        // Camera bounds and constraints
        this.bounds = {
            min: { x: -100, z: -100 },
            max: { x: 100, z: 100 },
            minHeight: 5,
            maxHeight: 50
        };
        
        // Smooth following
        this.followSmoothness = 0.1;
        this.zoomSmoothness = 0.15;
        this.rotationSmoothness = 0.1;
        
        // Shake effects
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeFrequency = 30;
        this.shakeOffset = { x: 0, y: 0, z: 0 };
        
        // Grid focus settings
        this.gridSize = 2; // Size of grid cells for snapping
        this.snapToGrid = false;
    }
    
    update(deltaTime, entities) {
        for (const entity of entities) {
            const camera = entity.getComponent('CameraComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!camera.camera) {
                this.initializeCamera(camera, transform);
            }
            
            // Update camera following
            if (camera.followTarget) {
                this.updateCameraFollow(camera, transform, deltaTime);
            }
            
            // Update camera shake
            if (this.shakeDuration > 0) {
                this.updateCameraShake(transform, deltaTime);
            }
            
            // Apply constraints
            this.applyCameraBounds(transform);
            
            // Update projection if needed
            if (camera.isDirty) {
                this.updateCameraProjection(camera);
            }
            
            // Update Three.js camera transform
            this.updateThreeJSCamera(camera, transform);
            
            camera.markClean();
        }
    }
    
    initializeCamera(camera, transform) {
        // Set up isometric camera by default
        this.setupIsometricCamera(camera, transform);
        
        // Create the Three.js camera
        camera.createCamera();
        
        console.log('Camera initialized:', camera.camera);
    }
    
    setupIsometricCamera(camera, transform) {
        // Configure for isometric projection
        camera.isOrthographic = true;
        camera.viewSize = 20;
        
        // Set isometric position and rotation
        const distance = 20;
        const elevation = this.isometricAngle.elevation;
        const azimuth = this.isometricAngle.azimuth;
        
        transform.setPosition(
            Math.cos(azimuth) * Math.cos(elevation) * distance,
            Math.sin(elevation) * distance,
            Math.sin(azimuth) * Math.cos(elevation) * distance
        );
        
        // Look at origin
        transform.lookAt({ x: 0, y: 0, z: 0 });
        
        camera.markDirty();
    }
    
    setupPerspectiveCamera(camera, transform, fov = 75) {
        camera.isOrthographic = false;
        camera.fov = fov;
        camera.aspect = window.innerWidth / window.innerHeight;
        
        camera.markDirty();
    }
    
    updateCameraFollow(camera, transform, deltaTime) {
        const target = camera.followTarget;
        if (!target) return;
        
        // Calculate desired position based on offset
        const desiredPosition = {
            x: target.position.x + camera.followOffset.x,
            y: target.position.y + camera.followOffset.y,
            z: target.position.z + camera.followOffset.z
        };
        
        // Smooth interpolation to desired position
        const smoothing = this.followSmoothness * deltaTime * 60; // 60fps normalized
        
        const newX = transform.position.x + (desiredPosition.x - transform.position.x) * smoothing;
        const newY = transform.position.y + (desiredPosition.y - transform.position.y) * smoothing;
        const newZ = transform.position.z + (desiredPosition.z - transform.position.z) * smoothing;
        
        transform.setPosition(newX, newY, newZ);
        
        // Update look-at target if specified
        if (camera.target) {
            transform.lookAt(camera.target);
        }
    }
    
    updateCameraShake(transform, deltaTime) {
        this.shakeDuration -= deltaTime;
        
        if (this.shakeDuration <= 0) {
            this.shakeIntensity = 0;
            this.shakeOffset = { x: 0, y: 0, z: 0 };
            return;
        }
        
        // Generate shake offset
        const time = performance.now() * 0.001;
        const frequency = this.shakeFrequency;
        
        this.shakeOffset.x = Math.sin(time * frequency) * this.shakeIntensity;
        this.shakeOffset.y = Math.cos(time * frequency * 1.1) * this.shakeIntensity;
        this.shakeOffset.z = Math.sin(time * frequency * 0.9) * this.shakeIntensity;
        
        // Apply shake to transform
        transform.translate(
            this.shakeOffset.x * deltaTime,
            this.shakeOffset.y * deltaTime,
            this.shakeOffset.z * deltaTime
        );
    }
    
    applyCameraBounds(transform) {
        // Clamp camera position to bounds
        const pos = transform.position;
        
        if (pos.x < this.bounds.min.x) transform.position.x = this.bounds.min.x;
        if (pos.x > this.bounds.max.x) transform.position.x = this.bounds.max.x;
        if (pos.z < this.bounds.min.z) transform.position.z = this.bounds.min.z;
        if (pos.z > this.bounds.max.z) transform.position.z = this.bounds.max.z;
        if (pos.y < this.bounds.minHeight) transform.position.y = this.bounds.minHeight;
        if (pos.y > this.bounds.maxHeight) transform.position.y = this.bounds.maxHeight;
        
        // Grid snapping
        if (this.snapToGrid) {
            transform.position.x = Math.round(transform.position.x / this.gridSize) * this.gridSize;
            transform.position.z = Math.round(transform.position.z / this.gridSize) * this.gridSize;
        }
    }
    
    updateCameraProjection(camera) {
        if (!camera.camera) return;
        
        if (camera.isOrthographic) {
            // Update orthographic projection
            const aspect = camera.aspect || (window.innerWidth / window.innerHeight);
            const halfWidth = camera.viewSize * aspect * 0.5;
            const halfHeight = camera.viewSize * 0.5;
            
            camera.left = -halfWidth;
            camera.right = halfWidth;
            camera.top = halfHeight;
            camera.bottom = -halfHeight;
            
            camera.camera.left = camera.left;
            camera.camera.right = camera.right;
            camera.camera.top = camera.top;
            camera.camera.bottom = camera.bottom;
        } else {
            // Update perspective projection
            camera.camera.fov = camera.fov;
            camera.camera.aspect = camera.aspect;
        }
        
        camera.camera.near = camera.near;
        camera.camera.far = camera.far;
        camera.camera.updateProjectionMatrix();
    }
    
    updateThreeJSCamera(camera, transform) {
        if (!camera.camera) return;
        
        // Update camera position
        camera.camera.position.set(
            transform.position.x + this.shakeOffset.x,
            transform.position.y + this.shakeOffset.y,
            transform.position.z + this.shakeOffset.z
        );
        
        // Update camera rotation
        camera.camera.rotation.set(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z
        );
        
        // Look at target if specified
        if (camera.target) {
            camera.camera.lookAt(
                camera.target.x,
                camera.target.y,
                camera.target.z
            );
        }
        
        camera.camera.updateMatrixWorld();
    }
    
    // Camera control methods
    focusOnPosition(cameraEntity, position, smooth = true) {
        const camera = cameraEntity.getComponent('CameraComponent');
        const transform = cameraEntity.getComponent('TransformComponent');
        
        if (smooth) {
            // Set up smooth transition
            camera.target = { ...position };
            camera.markDirty();
        } else {
            // Immediate focus
            transform.lookAt(position);
        }
    }
    
    focusOnEntity(cameraEntity, targetEntity, offset = null) {
        const camera = cameraEntity.getComponent('CameraComponent');
        const targetTransform = targetEntity.getComponent('TransformComponent');
        
        if (!targetTransform) return;
        
        camera.followTarget = targetTransform;
        
        if (offset) {
            camera.followOffset = { ...offset };
        }
        
        camera.markDirty();
    }
    
    stopFollowing(cameraEntity) {
        const camera = cameraEntity.getComponent('CameraComponent');
        camera.followTarget = null;
        camera.markDirty();
    }
    
    // Zoom controls
    zoomIn(cameraEntity, amount = 0.1) {
        const camera = cameraEntity.getComponent('CameraComponent');
        
        if (camera.isOrthographic) {
            camera.viewSize *= (1 - amount);
            camera.viewSize = Math.max(5, camera.viewSize);
        } else {
            camera.fov *= (1 - amount);
            camera.fov = Math.max(10, Math.min(120, camera.fov));
        }
        
        camera.markDirty();
    }
    
    zoomOut(cameraEntity, amount = 0.1) {
        const camera = cameraEntity.getComponent('CameraComponent');
        
        if (camera.isOrthographic) {
            camera.viewSize *= (1 + amount);
            camera.viewSize = Math.min(50, camera.viewSize);
        } else {
            camera.fov *= (1 + amount);
            camera.fov = Math.max(10, Math.min(120, camera.fov));
        }
        
        camera.markDirty();
    }
    
    setZoom(cameraEntity, zoom) {
        const camera = cameraEntity.getComponent('CameraComponent');
        
        if (camera.isOrthographic) {
            camera.viewSize = Math.max(5, Math.min(50, zoom));
        } else {
            camera.fov = Math.max(10, Math.min(120, zoom));
        }
        
        camera.markDirty();
    }
    
    // Camera shake
    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }
    
    // Camera movement
    panCamera(cameraEntity, deltaX, deltaZ) {
        const transform = cameraEntity.getComponent('TransformComponent');
        const camera = cameraEntity.getComponent('CameraComponent');
        
        // Stop following if we manually pan
        if (camera.followTarget) {
            camera.followTarget = null;
        }
        
        transform.translate(deltaX, 0, deltaZ);
    }
    
    // Camera types
    setIsometricView(cameraEntity, angle = null) {
        const camera = cameraEntity.getComponent('CameraComponent');
        const transform = cameraEntity.getComponent('TransformComponent');
        
        if (angle) {
            this.isometricAngle = { ...angle };
        }
        
        this.setupIsometricCamera(camera, transform);
        camera.createCamera();
    }
    
    setPerspectiveView(cameraEntity, fov = 75) {
        const camera = cameraEntity.getComponent('CameraComponent');
        const transform = cameraEntity.getComponent('TransformComponent');
        
        this.setupPerspectiveCamera(camera, transform, fov);
        camera.createCamera();
    }
    
    // Grid and world conversion (for isometric cameras)
    screenToWorld(cameraEntity, screenX, screenY, renderer) {
        const camera = cameraEntity.getComponent('CameraComponent');
        if (!camera.camera || !renderer) return null;
        
        // Convert screen coordinates to normalized device coordinates
        const mouse = new THREE.Vector2();
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;
        
        // Raycast to find world position
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera.camera);
        
        // Intersect with ground plane (y = 0)
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        
        if (raycaster.ray.intersectPlane(plane, intersection)) {
            return {
                x: intersection.x,
                y: intersection.y,
                z: intersection.z
            };
        }
        
        return null;
    }
    
    worldToScreen(cameraEntity, worldX, worldY, worldZ, renderer) {
        const camera = cameraEntity.getComponent('CameraComponent');
        if (!camera.camera || !renderer) return null;
        
        const worldPos = new THREE.Vector3(worldX, worldY, worldZ);
        const screenPos = worldPos.project(camera.camera);
        
        const size = renderer.getSize(new THREE.Vector2());
        
        return {
            x: (screenPos.x + 1) * size.x * 0.5,
            y: (-screenPos.y + 1) * size.y * 0.5
        };
    }
    
    // Grid conversion for tile-based games
    worldToGrid(worldX, worldZ) {
        return {
            x: Math.floor(worldX / this.gridSize),
            z: Math.floor(worldZ / this.gridSize)
        };
    }
    
    gridToWorld(gridX, gridZ) {
        return {
            x: gridX * this.gridSize + this.gridSize * 0.5,
            z: gridZ * this.gridSize + this.gridSize * 0.5
        };
    }
    
    // Settings
    setBounds(min, max) {
        this.bounds.min = { ...min };
        this.bounds.max = { ...max };
    }
    
    setHeightBounds(minHeight, maxHeight) {
        this.bounds.minHeight = minHeight;
        this.bounds.maxHeight = maxHeight;
    }
    
    setFollowSmoothness(smoothness) {
        this.followSmoothness = Math.max(0, Math.min(1, smoothness));
    }
    
    setGridSize(size) {
        this.gridSize = size;
    }
    
    setSnapToGrid(enabled) {
        this.snapToGrid = enabled;
    }
    
    // Window resize handling
    onWindowResize(width, height) {
        const entities = this.world.query(['CameraComponent']);
        
        for (const entity of entities) {
            const camera = entity.getComponent('CameraComponent');
            
            if (!camera.isOrthographic) {
                camera.aspect = width / height;
                camera.markDirty();
            }
        }
    }
    
    // Get the main camera (first one found)
    getMainCamera() {
        const entities = this.world.query(['CameraComponent']);
        return entities.length > 0 ? entities[0] : null;
    }
}