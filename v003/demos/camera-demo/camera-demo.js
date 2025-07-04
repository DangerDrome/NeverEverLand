import { TransformComponent } from '../../components/TransformComponent.js';
import { RenderableComponent, CameraComponent } from '../../components/RenderableComponent.js';
import { InputComponent } from '../../components/InputComponent.js';

/**
 * Camera Demo
 * Demonstrates camera system capabilities: following, focusing, transitions
 */
export default class CameraDemo {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.entities = [];
        this.movingObjects = [];
        this.cameras = [];
        this.currentCameraIndex = 0;
        
        // Demo state
        this.followMode = false;
        this.autoRotate = false;
        this.cameraTransitioning = false;
        
        // Animation
        this.time = 0;
        this.rotationSpeed = 0.5;
    }
    
    async initialize() {
        console.log('Initializing Camera Demo...');
        
        // Create materials and geometries
        this.materials = this.createMaterials();
        this.geometries = this.createGeometries();
        
        // Create environment
        this.createEnvironment();
        
        // Create moving objects to follow
        this.createMovingObjects();
        
        // Create multiple cameras
        this.createCameras();
        
        // Create player for interaction
        this.createPlayer();
        
        console.log(`Camera Demo initialized with ${this.cameras.length} cameras`);
    }
    
    createMaterials() {
        return {
            ground: new THREE.MeshLambertMaterial({ color: 0x8BC34A }),
            wall: new THREE.MeshLambertMaterial({ color: 0x795548 }),
            player: new THREE.MeshLambertMaterial({ color: 0x2196F3 }),
            movingObject: new THREE.MeshLambertMaterial({ color: 0xFF5722 }),
            target: new THREE.MeshLambertMaterial({ color: 0xFFEB3B }),
            cameraIndicator: new THREE.MeshBasicMaterial({ color: 0xFF00FF, wireframe: true })
        };
    }
    
    createGeometries() {
        return {
            ground: new THREE.PlaneGeometry(100, 100),
            wall: new THREE.BoxGeometry(2, 4, 2),
            player: new THREE.BoxGeometry(1, 1.5, 1),
            movingObject: new THREE.SphereGeometry(0.8, 12, 8),
            target: new THREE.ConeGeometry(0.5, 1, 8),
            cameraIndicator: new THREE.BoxGeometry(0.5, 0.3, 0.8)
        };
    }
    
    createEnvironment() {
        // Ground
        const groundEntity = this.gameEngine.createEntity();
        const groundTransform = this.gameEngine.world.acquireComponent(TransformComponent);
        groundTransform.setPosition(0, 0, 0);
        groundTransform.setRotation(-Math.PI / 2, 0, 0);
        this.gameEngine.addComponent(groundEntity, groundTransform);
        
        const groundRenderable = this.gameEngine.world.acquireComponent(RenderableComponent);
        groundRenderable.mesh = new THREE.Mesh(this.geometries.ground, this.materials.ground);
        groundRenderable.receiveShadow = true;
        this.gameEngine.addComponent(groundEntity, groundRenderable);
        
        this.gameEngine.renderingSystem.addToScene(groundRenderable.mesh);
        this.entities.push(groundEntity);
        
        // Create some walls/obstacles for visual reference
        const wallPositions = [
            [10, 2, 10], [-10, 2, 10], [10, 2, -10], [-10, 2, -10],
            [0, 2, 15], [0, 2, -15], [15, 2, 0], [-15, 2, 0]
        ];
        
        for (const pos of wallPositions) {
            const wallEntity = this.gameEngine.createEntity();
            
            const transform = this.gameEngine.world.acquireComponent(TransformComponent);
            transform.setPosition(pos[0], pos[1], pos[2]);
            this.gameEngine.addComponent(wallEntity, transform);
            
            const renderable = this.gameEngine.world.acquireComponent(RenderableComponent);
            renderable.mesh = new THREE.Mesh(this.geometries.wall, this.materials.wall);
            renderable.castShadow = true;
            renderable.receiveShadow = true;
            this.gameEngine.addComponent(wallEntity, renderable);
            
            this.gameEngine.renderingSystem.addToScene(renderable.mesh);
            this.entities.push(wallEntity);
        }
    }
    
    createMovingObjects() {
        // Create objects that move in patterns for the camera to follow
        for (let i = 0; i < 3; i++) {
            const entity = this.gameEngine.createEntity();
            
            const transform = this.gameEngine.world.acquireComponent(TransformComponent);
            const angle = (i / 3) * Math.PI * 2;
            transform.setPosition(
                Math.cos(angle) * 8,
                1.5,
                Math.sin(angle) * 8
            );
            this.gameEngine.addComponent(entity, transform);
            
            const renderable = this.gameEngine.world.acquireComponent(RenderableComponent);
            renderable.mesh = new THREE.Mesh(this.geometries.movingObject, this.materials.movingObject);
            renderable.castShadow = true;
            this.gameEngine.addComponent(entity, renderable);
            
            this.gameEngine.renderingSystem.addToScene(renderable.mesh);
            
            this.entities.push(entity);
            this.movingObjects.push({
                entity,
                baseAngle: angle,
                radius: 8 + i * 2,
                speed: 0.3 + i * 0.2,
                height: 1.5 + i * 0.5
            });
        }
    }
    
    createCameras() {
        const cameraConfigs = [
            {
                name: 'Isometric',
                position: [15, 15, 15],
                isOrthographic: true,
                viewSize: 20,
                description: 'Classic isometric view'
            },
            {
                name: 'Top-Down',
                position: [0, 25, 0],
                lookAt: [0, 0, 0],
                isOrthographic: true,
                viewSize: 25,
                description: 'Top-down orthographic view'
            },
            {
                name: 'Perspective',
                position: [20, 10, 20],
                isOrthographic: false,
                fov: 60,
                description: 'Perspective camera with depth'
            },
            {
                name: 'Close Follow',
                position: [0, 3, 5],
                followOffset: [0, 3, 5],
                isOrthographic: false,
                fov: 75,
                description: 'Close following camera'
            },
            {
                name: 'Cinematic',
                position: [30, 8, 0],
                lookAt: [0, 0, 0],
                isOrthographic: false,
                fov: 45,
                description: 'Wide cinematic angle'
            }
        ];\n        \n        for (let i = 0; i < cameraConfigs.length; i++) {\n            const config = cameraConfigs[i];\n            const cameraEntity = this.gameEngine.createEntity();\n            \n            // Transform\n            const transform = this.gameEngine.world.acquireComponent(TransformComponent);\n            transform.setPosition(config.position[0], config.position[1], config.position[2]);\n            if (config.lookAt) {\n                transform.lookAt({ x: config.lookAt[0], y: config.lookAt[1], z: config.lookAt[2] });\n            }\n            this.gameEngine.addComponent(cameraEntity, transform);\n            \n            // Camera component\n            const cameraComp = this.gameEngine.world.acquireComponent(CameraComponent);\n            cameraComp.isOrthographic = config.isOrthographic;\n            \n            if (config.isOrthographic) {\n                cameraComp.viewSize = config.viewSize;\n            } else {\n                cameraComp.fov = config.fov;\n            }\n            \n            if (config.followOffset) {\n                cameraComp.followOffset = {\n                    x: config.followOffset[0],\n                    y: config.followOffset[1],\n                    z: config.followOffset[2]\n                };\n            }\n            \n            this.gameEngine.addComponent(cameraEntity, cameraComp);\n            \n            // Visual indicator for camera position\n            const indicatorEntity = this.gameEngine.createEntity();\n            const indicatorTransform = this.gameEngine.world.acquireComponent(TransformComponent);\n            indicatorTransform.setPosition(config.position[0], config.position[1], config.position[2]);\n            this.gameEngine.addComponent(indicatorEntity, indicatorTransform);\n            \n            const indicatorRenderable = this.gameEngine.world.acquireComponent(RenderableComponent);\n            indicatorRenderable.mesh = new THREE.Mesh(this.geometries.cameraIndicator, this.materials.cameraIndicator);\n            this.gameEngine.addComponent(indicatorEntity, indicatorRenderable);\n            \n            this.gameEngine.renderingSystem.addToScene(indicatorRenderable.mesh);\n            \n            this.cameras.push({\n                entity: cameraEntity,\n                indicator: indicatorEntity,\n                config,\n                active: i === 0\n            });\n            \n            this.entities.push(cameraEntity);\n            this.entities.push(indicatorEntity);\n        }\n        \n        // Set first camera as active\n        this.switchToCamera(0);\n    }\n    \n    createPlayer() {\n        this.player = this.gameEngine.createEntity();\n        \n        // Transform\n        const transform = this.gameEngine.world.acquireComponent(TransformComponent);\n        transform.setPosition(0, 0.75, 0);\n        this.gameEngine.addComponent(this.player, transform);\n        \n        // Renderable\n        const renderable = this.gameEngine.world.acquireComponent(RenderableComponent);\n        renderable.mesh = new THREE.Mesh(this.geometries.player, this.materials.player);\n        renderable.castShadow = true;\n        this.gameEngine.addComponent(this.player, renderable);\n        \n        // Input\n        const input = this.gameEngine.world.acquireComponent(InputComponent);\n        this.gameEngine.addComponent(this.player, input);\n        \n        this.gameEngine.renderingSystem.addToScene(renderable.mesh);\n        this.entities.push(this.player);\n    }\n    \n    update(deltaTime) {\n        this.time += deltaTime;\n        \n        // Update moving objects\n        this.updateMovingObjects();\n        \n        // Handle camera auto-rotation\n        if (this.autoRotate) {\n            this.updateAutoRotation(deltaTime);\n        }\n        \n        // Update camera indicators\n        this.updateCameraIndicators();\n    }\n    \n    updateMovingObjects() {\n        for (const obj of this.movingObjects) {\n            const transform = obj.entity.getComponent('TransformComponent');\n            if (transform) {\n                const angle = obj.baseAngle + this.time * obj.speed;\n                const x = Math.cos(angle) * obj.radius;\n                const z = Math.sin(angle) * obj.radius;\n                const y = obj.height + Math.sin(this.time * 2 + obj.baseAngle) * 0.5;\n                \n                transform.setPosition(x, y, z);\n            }\n        }\n    }\n    \n    updateAutoRotation(deltaTime) {\n        const activeCamera = this.cameras[this.currentCameraIndex];\n        if (!activeCamera) return;\n        \n        const transform = activeCamera.entity.getComponent('TransformComponent');\n        if (transform) {\n            transform.rotate(0, this.rotationSpeed * deltaTime, 0);\n        }\n    }\n    \n    updateCameraIndicators() {\n        // Update visibility of camera indicators\n        for (let i = 0; i < this.cameras.length; i++) {\n            const camera = this.cameras[i];\n            const renderable = camera.indicator.getComponent('RenderableComponent');\n            \n            // Hide indicator for active camera, show others\n            renderable.visible = i !== this.currentCameraIndex;\n            if (renderable.isDirty) {\n                renderable.markClean();\n            }\n        }\n    }\n    \n    // Camera management\n    switchToCamera(index) {\n        if (index < 0 || index >= this.cameras.length) return;\n        \n        const oldCamera = this.cameras[this.currentCameraIndex];\n        const newCamera = this.cameras[index];\n        \n        // Stop following on old camera\n        if (oldCamera) {\n            const oldCameraComp = oldCamera.entity.getComponent('CameraComponent');\n            if (oldCameraComp) {\n                oldCameraComp.followTarget = null;\n            }\n            oldCamera.active = false;\n        }\n        \n        // Activate new camera\n        this.currentCameraIndex = index;\n        newCamera.active = true;\n        \n        const cameraComp = newCamera.entity.getComponent('CameraComponent');\n        if (cameraComp) {\n            this.gameEngine.renderingSystem.setActiveCamera(cameraComp);\n            \n            // Apply follow mode if enabled\n            if (this.followMode) {\n                this.enableFollowMode();\n            }\n        }\n        \n        console.log(`Switched to camera: ${newCamera.config.name} - ${newCamera.config.description}`);\n    }\n    \n    nextCamera() {\n        const nextIndex = (this.currentCameraIndex + 1) % this.cameras.length;\n        this.switchToCamera(nextIndex);\n    }\n    \n    previousCamera() {\n        const prevIndex = (this.currentCameraIndex - 1 + this.cameras.length) % this.cameras.length;\n        this.switchToCamera(prevIndex);\n    }\n    \n    enableFollowMode() {\n        this.followMode = true;\n        const activeCamera = this.cameras[this.currentCameraIndex];\n        \n        if (activeCamera) {\n            const cameraComp = activeCamera.entity.getComponent('CameraComponent');\n            if (cameraComp) {\n                // Follow the first moving object\n                const targetTransform = this.movingObjects[0]?.entity.getComponent('TransformComponent');\n                if (targetTransform) {\n                    cameraComp.followTarget = targetTransform;\n                    console.log('Camera following enabled');\n                } else {\n                    // Follow player instead\n                    const playerTransform = this.player.getComponent('TransformComponent');\n                    if (playerTransform) {\n                        cameraComp.followTarget = playerTransform;\n                        console.log('Camera following player');\n                    }\n                }\n            }\n        }\n    }\n    \n    disableFollowMode() {\n        this.followMode = false;\n        \n        for (const camera of this.cameras) {\n            const cameraComp = camera.entity.getComponent('CameraComponent');\n            if (cameraComp) {\n                cameraComp.followTarget = null;\n            }\n        }\n        \n        console.log('Camera following disabled');\n    }\n    \n    toggleAutoRotation() {\n        this.autoRotate = !this.autoRotate;\n        console.log('Auto rotation:', this.autoRotate ? 'ON' : 'OFF');\n    }\n    \n    focusOnTarget(targetIndex) {\n        if (targetIndex < 0 || targetIndex >= this.movingObjects.length) return;\n        \n        const target = this.movingObjects[targetIndex].entity;\n        const activeCamera = this.cameras[this.currentCameraIndex];\n        \n        if (activeCamera) {\n            this.gameEngine.cameraSystem.focusOnEntity(activeCamera.entity, target);\n            console.log(`Focused on moving object ${targetIndex + 1}`);\n        }\n    }\n    \n    adjustCameraHeight(delta) {\n        const activeCamera = this.cameras[this.currentCameraIndex];\n        if (!activeCamera) return;\n        \n        const transform = activeCamera.entity.getComponent('TransformComponent');\n        if (transform) {\n            transform.translate(0, delta, 0);\n            console.log(`Camera height: ${transform.position.y.toFixed(1)}`);\n        }\n    }\n    \n    adjustCameraDistance(delta) {\n        const activeCamera = this.cameras[this.currentCameraIndex];\n        if (!activeCamera) return;\n        \n        const transform = activeCamera.entity.getComponent('TransformComponent');\n        if (transform) {\n            // Move camera towards/away from origin\n            const length = Math.sqrt(transform.position.x ** 2 + transform.position.z ** 2);\n            if (length > 0) {\n                const factor = (length + delta) / length;\n                transform.position.x *= factor;\n                transform.position.z *= factor;\n                transform.markDirty();\n                console.log(`Camera distance: ${length.toFixed(1)}`);\n            }\n        }\n    }\n    \n    shakeCamera(intensity = 2, duration = 1000) {\n        this.gameEngine.cameraSystem.shake(intensity, duration / 1000);\n        console.log(`Camera shake: intensity ${intensity}, duration ${duration}ms`);\n    }\n    \n    // Get demo statistics\n    getStats() {\n        const baseStats = this.gameEngine.getStats();\n        const activeCamera = this.cameras[this.currentCameraIndex];\n        \n        return {\n            ...baseStats,\n            demo: {\n                name: 'Camera Demo',\n                currentCamera: activeCamera?.config.name || 'None',\n                cameraDescription: activeCamera?.config.description || '',\n                totalCameras: this.cameras.length,\n                followMode: this.followMode,\n                autoRotate: this.autoRotate,\n                movingObjects: this.movingObjects.length,\n                animationTime: this.time.toFixed(2)\n            }\n        };\n    }\n    \n    // Handle input events\n    onKeyPress(key) {\n        switch (key) {\n            case 'Digit1':\n            case 'Digit2':\n            case 'Digit3':\n            case 'Digit4':\n            case 'Digit5':\n                const cameraIndex = parseInt(key.slice(-1)) - 1;\n                this.switchToCamera(cameraIndex);\n                break;\n                \n            case 'KeyN':\n                this.nextCamera();\n                break;\n                \n            case 'KeyB':\n                this.previousCamera();\n                break;\n                \n            case 'KeyF':\n                if (this.followMode) {\n                    this.disableFollowMode();\n                } else {\n                    this.enableFollowMode();\n                }\n                break;\n                \n            case 'KeyR':\n                this.toggleAutoRotation();\n                break;\n                \n            case 'KeyQ':\n                this.focusOnTarget(0);\n                break;\n                \n            case 'KeyE':\n                this.focusOnTarget(1);\n                break;\n                \n            case 'KeyT':\n                this.focusOnTarget(2);\n                break;\n                \n            case 'ArrowUp':\n                this.adjustCameraHeight(1);\n                break;\n                \n            case 'ArrowDown':\n                this.adjustCameraHeight(-1);\n                break;\n                \n            case 'BracketLeft': // [\n                this.adjustCameraDistance(-2);\n                break;\n                \n            case 'BracketRight': // ]\n                this.adjustCameraDistance(2);\n                break;\n                \n            case 'KeyX':\n                this.shakeCamera(3, 500);\n                break;\n                \n            case 'KeyH':\n                this.showHelp();\n                break;\n        }\n    }\n    \n    showHelp() {\n        console.log(`\n📷 Camera Demo Controls:\n━━━━━━━━━━━━━━━━━━━━━━━━\nCamera Switch: 1-5\nNext/Prev: N/B\nFollow Mode: F\nAuto Rotate: R\nFocus Targets: Q/E/T\nHeight: ↑/↓\nDistance: [/]\nShake: X\nHelp: H\n\nCurrent: ${this.cameras[this.currentCameraIndex]?.config.name}\n        `);\n    }\n    \n    // Cleanup\n    destroy() {\n        for (const entity of this.entities) {\n            const renderable = entity.getComponent('RenderableComponent');\n            if (renderable?.mesh) {\n                this.gameEngine.renderingSystem.removeFromScene(renderable.mesh);\n            }\n            this.gameEngine.destroyEntity(entity);\n        }\n        \n        Object.values(this.geometries).forEach(geo => geo.dispose());\n        Object.values(this.materials).forEach(mat => mat.dispose());\n        \n        console.log('Camera Demo destroyed');\n    }\n}