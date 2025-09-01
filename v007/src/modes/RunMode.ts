import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelPanel } from '../ui/VoxelPanel';
import { LayerPanel } from '../ui/LayerPanel';
import { ToolsPanel } from '../ui/ToolsPanel';
import { Player } from '../player/Player';
import { VoxelEngine } from '../engine/VoxelEngine';
import { DrawingSystem } from '../interaction/DrawingSystem';
import * as THREE from 'three';
import { ActionLogger } from '../ui/ActionLogger';
import { DebugPathfinder } from '../pathfinding/DebugPathfinder';

export class RunMode {
    private isRunMode: boolean = false;
    private runModeButton: HTMLElement | null;
    private voxelPanel: VoxelPanel | null = null;
    private layerPanel: LayerPanel | null = null;
    private toolsPanel: ToolsPanel | null = null;
    private player: Player | null = null;
    private controls: OrbitControls | null = null;
    private camera: THREE.OrthographicCamera | null = null;
    private scene: THREE.Scene | null = null;
    private voxelEngine: VoxelEngine | null = null;
    private drawingSystem: DrawingSystem | null = null;
    private pathfinder: DebugPathfinder | null = null;
    private debugPathGroup: THREE.Group | null = null;
    private targetPreview: THREE.Mesh | null = null;
    private mouseHandler: ((event: MouseEvent) => void) | null = null;
    
    // Store original camera state for restoration
    private originalCameraState = {
        position: new THREE.Vector3(),
        target: new THREE.Vector3()
    };
    
    constructor() {
        this.runModeButton = document.getElementById('run-mode-toggle');
        this.setupButtonListener();
    }
    
    setDependencies(
        voxelPanel: VoxelPanel,
        layerPanel: LayerPanel,
        toolsPanel: ToolsPanel,
        controls: OrbitControls,
        camera: THREE.OrthographicCamera,
        scene: THREE.Scene,
        voxelEngine: VoxelEngine,
        drawingSystem: DrawingSystem
    ) {
        this.voxelPanel = voxelPanel;
        this.layerPanel = layerPanel;
        this.toolsPanel = toolsPanel;
        this.controls = controls;
        this.camera = camera;
        this.scene = scene;
        this.voxelEngine = voxelEngine;
        this.drawingSystem = drawingSystem;
    }
    
    private setupButtonListener() {
        if (this.runModeButton) {
            this.runModeButton.addEventListener('click', () => {
                this.toggle();
            });
        }
    }
    
    toggle() {
        if (this.isRunMode) {
            this.exitRunMode();
        } else {
            this.enterRunMode();
        }
    }
    
    private enterRunMode() {
        if (!this.camera || !this.scene || !this.controls || !this.voxelEngine) {
            console.error('Required dependencies not set for RunMode');
            return;
        }
        
        this.isRunMode = true;
        
        // Store current camera state
        this.originalCameraState.position.copy(this.camera.position);
        this.originalCameraState.target.copy(this.controls.target);
        
        // Update button appearance
        if (this.runModeButton) {
            this.runModeButton.classList.add('active');
            const icon = this.runModeButton.querySelector('[data-lucide]');
            const text = this.runModeButton.querySelector('span');
            if (icon) {
                icon.setAttribute('data-lucide', 'square');
                // Re-initialize lucide icon
                if ((window as any).lucide) {
                    (window as any).lucide.createIcons();
                }
            }
            if (text) {
                text.textContent = 'Edit Mode';
            }
        }
        
        // Hide UI panels
        this.hidePanels();
        
        // Select the pointer tool when entering run mode
        if (this.toolsPanel) {
            this.toolsPanel.selectPointerTool();
        }
        
        // Disable OrbitControls
        if (this.controls) {
            this.controls.enabled = false;
        }
        
        // Disable drawing system
        if (this.drawingSystem) {
            this.drawingSystem.setEnabled(false);
            this.drawingSystem.hidePreview();
        }
        
        // Create player if not exists
        if (!this.player) {
            this.player = new Player(this.scene, this.voxelEngine);
        }
        
        // Create pathfinder if not exists
        if (!this.pathfinder) {
            this.pathfinder = new DebugPathfinder(this.voxelEngine);
        }
        
        // Create target preview mesh
        if (!this.targetPreview) {
            const geometry = new THREE.PlaneGeometry(0.09, 0.09);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ffff, // Cyan for preview
                opacity: 0.5,
                transparent: true,
                side: THREE.DoubleSide
            });
            this.targetPreview = new THREE.Mesh(geometry, material);
            this.targetPreview.rotation.x = -Math.PI / 2; // Make horizontal
            this.targetPreview.visible = false;
            this.scene.add(this.targetPreview);
        }
        
        // Add mouse move handler for preview
        this.mouseHandler = (event: MouseEvent) => this.updateTargetPreview(event);
        window.addEventListener('mousemove', this.mouseHandler);
        
        // Spawn player at a reasonable position (center of world, on ground)
        this.player.spawn(new THREE.Vector3(0, 1, 0));
        
        // Setup camera to follow player
        this.setupPlayerCamera();
        
        // Update info bar
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = 'Run Mode';
        }
        
        ActionLogger.getInstance().log('Entered Run Mode', 2000);
    }
    
    private exitRunMode() {
        if (!this.camera || !this.controls) {
            return;
        }
        
        this.isRunMode = false;
        
        // Update button appearance
        if (this.runModeButton) {
            this.runModeButton.classList.remove('active');
            const icon = this.runModeButton.querySelector('[data-lucide]');
            const text = this.runModeButton.querySelector('span');
            if (icon) {
                icon.setAttribute('data-lucide', 'play');
                // Re-initialize lucide icon
                if ((window as any).lucide) {
                    (window as any).lucide.createIcons();
                }
            }
            if (text) {
                text.textContent = 'Run Mode';
            }
        }
        
        // Show UI panels
        this.showPanels();
        
        // Re-enable OrbitControls
        if (this.controls) {
            this.controls.enabled = true;
        }
        
        // Re-enable drawing system
        if (this.drawingSystem) {
            this.drawingSystem.setEnabled(true);
            this.drawingSystem.showPreview();
        }
        
        // Remove player from scene
        if (this.player) {
            this.player.destroy();
        }
        
        // Clear debug path if any
        if (this.debugPathGroup && this.scene) {
            this.scene.remove(this.debugPathGroup);
            this.debugPathGroup = null;
        }
        
        // Remove target preview and mouse handler
        if (this.targetPreview && this.scene) {
            this.scene.remove(this.targetPreview);
            this.targetPreview = null;
        }
        
        if (this.mouseHandler) {
            window.removeEventListener('mousemove', this.mouseHandler);
            this.mouseHandler = null;
        }
        
        // Restore camera position
        this.camera.position.copy(this.originalCameraState.position);
        this.controls.target.copy(this.originalCameraState.target);
        this.controls.update();
        
        // Update info bar
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = 'Brush';
        }
        
        ActionLogger.getInstance().log('Exited Run Mode', 2000);
    }
    
    private hidePanels() {
        if (this.voxelPanel) {
            const voxelElement = (this.voxelPanel as any).element;
            if (voxelElement) {
                voxelElement.style.display = 'none';
            }
        }
        
        if (this.layerPanel) {
            const layerElement = (this.layerPanel as any).getElement();
            if (layerElement) {
                layerElement.style.display = 'none';
            }
        }
        
        if (this.toolsPanel) {
            const toolsElement = (this.toolsPanel as any).element;
            if (toolsElement) {
                toolsElement.style.display = 'none';
            }
        }
    }
    
    private showPanels() {
        if (this.voxelPanel) {
            const voxelElement = (this.voxelPanel as any).element;
            if (voxelElement) {
                voxelElement.style.display = 'flex';
            }
        }
        
        if (this.layerPanel) {
            const layerElement = (this.layerPanel as any).getElement();
            if (layerElement) {
                layerElement.style.display = 'flex';
            }
        }
        
        if (this.toolsPanel) {
            const toolsElement = (this.toolsPanel as any).element;
            if (toolsElement) {
                toolsElement.style.display = 'flex';
            }
        }
    }
    
    private setupPlayerCamera() {
        if (!this.camera || !this.player) return;
        
        // Set camera to isometric view following player
        const playerPos = this.player.getPosition();
        const cameraOffset = new THREE.Vector3(20, 20, 20);
        
        this.camera.position.copy(playerPos).add(cameraOffset);
        
        // Make camera look at player
        if (this.controls) {
            this.controls.target.copy(playerPos);
            this.controls.update();
        }
    }
    
    // Called from main update loop
    update(deltaTime: number) {
        if (!this.isRunMode || !this.player) return;
        
        this.player.update(deltaTime);
        
        // Update path visualization - fade out visited nodes
        if (this.debugPathGroup && this.player.hasPath()) {
            const pathIndex = this.player.getPathIndex();
            // Fade out visited nodes
            this.debugPathGroup.children.forEach((child, index) => {
                if (child.name.startsWith('PathNode_')) {
                    const nodeIndex = parseInt(child.name.split('_')[1]);
                    if (nodeIndex < pathIndex && child instanceof THREE.Mesh) {
                        // Fade out visited nodes
                        const material = child.material as THREE.MeshBasicMaterial;
                        material.opacity = Math.max(0.2, material.opacity - deltaTime * 2);
                    }
                }
            });
        }
        
        // Clear path visualization when path is complete
        if (this.debugPathGroup && !this.player.hasPath()) {
            this.scene?.remove(this.debugPathGroup);
            this.debugPathGroup = null;
        }
        
        // Update camera to follow player
        if (this.camera && this.controls) {
            const playerPos = this.player.getPosition();
            const cameraOffset = new THREE.Vector3(20, 20, 20);
            
            // Smooth camera follow
            const targetCameraPos = playerPos.clone().add(cameraOffset);
            this.camera.position.lerp(targetCameraPos, deltaTime * 3);
            
            // Update controls target
            this.controls.target.lerp(playerPos, deltaTime * 3);
            this.controls.update();
        }
    }
    
    // Handle keyboard input for player movement
    handleKeyDown(event: KeyboardEvent): boolean {
        if (!this.isRunMode || !this.player) return false;
        
        // Handle movement keys
        switch (event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.player.moveForward();
                return true;
            case 's':
            case 'arrowdown':
                this.player.moveBackward();
                return true;
            case 'a':
            case 'arrowleft':
                this.player.moveLeft();
                return true;
            case 'd':
            case 'arrowright':
                this.player.moveRight();
                return true;
        }
        
        // Handle spacebar for jump (check original key, not lowercase)
        if (event.key === ' ') {
            event.preventDefault(); // Prevent page scroll
            this.player.jump();
            return true;
        }
        
        return false;
    }
    
    handleKeyUp(event: KeyboardEvent): boolean {
        if (!this.isRunMode || !this.player) return false;
        
        // Stop movement on key release
        switch (event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
            case 's':
            case 'arrowdown':
            case 'a':
            case 'arrowleft':
            case 'd':
            case 'arrowright':
                this.player.stopMoving();
                return true;
        }
        
        return false;
    }
    
    // Handle mouse click for click-to-move
    handleMouseClick(event: MouseEvent, raycaster: THREE.Raycaster, camera: THREE.Camera): boolean {
        if (!this.isRunMode || !this.player || !this.voxelEngine || !this.pathfinder) return false;
        
        // Only handle left click
        if (event.button !== 0) return false;
        
        // Get the canvas bounding rect for accurate mouse position
        const canvas = event.target as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        
        // Calculate normalized device coordinates relative to canvas
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        raycaster.setFromCamera(mouse, camera);
        
        // First try to find intersection with voxels
        const voxelMeshes: THREE.Object3D[] = [];
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child instanceof THREE.InstancedMesh || child instanceof THREE.Mesh) {
                    // Skip player mesh, debug path, and other non-voxel objects
                    if (this.player && child !== this.player.getMesh() && 
                        !child.name.startsWith('PathNode') && 
                        child.parent?.name !== 'PathDebug') {
                        voxelMeshes.push(child);
                    }
                }
            });
        }
        
        const intersects = raycaster.intersectObjects(voxelMeshes, false);
        
        let targetPos: THREE.Vector3 | null = null;
        
        if (intersects.length > 0) {
            // Click on a voxel - we want to find the best position to stand
            const hit = intersects[0];
            
            console.log('=== CLICK DEBUG START ===');
            console.log('Hit object type:', hit.object.type);
            console.log('Hit point:', hit.point.x.toFixed(3), hit.point.y.toFixed(3), hit.point.z.toFixed(3));
            
            // Get the hit point
            const hitPoint = hit.point.clone();
            
            // SIMPLIFIED: Just use the hit point directly to find voxel
            const voxelScale = 0.1;
            
            // Offset the hit point slightly towards the ray origin to ensure we get the right voxel
            const ray = raycaster.ray;
            const adjustedHitPoint = hitPoint.clone();
            adjustedHitPoint.sub(ray.direction.clone().multiplyScalar(0.001));
            
            // Get voxel coordinates - handle negative coordinates properly
            const testX = adjustedHitPoint.x / voxelScale;
            const testY = adjustedHitPoint.y / voxelScale;
            const testZ = adjustedHitPoint.z / voxelScale;
            
            console.log('Test coords:', testX.toFixed(3), testY.toFixed(3), testZ.toFixed(3));
            
            // Get the voxel that was hit (floor works correctly for negative numbers)
            let clickedVoxelX = Math.floor(testX);
            let clickedVoxelY = Math.floor(testY);  
            let clickedVoxelZ = Math.floor(testZ);
            
            // Ensure Y is not negative
            if (clickedVoxelY < 0) clickedVoxelY = 0;
            
            // Check if this voxel actually exists
            let voxelExists = this.voxelEngine.getVoxel(clickedVoxelX, clickedVoxelY, clickedVoxelZ) !== 0;
            console.log(`Voxel at ${clickedVoxelX}, ${clickedVoxelY}, ${clickedVoxelZ} exists: ${voxelExists}`);
            
            // If we didn't hit a voxel, try to find one nearby
            if (!voxelExists) {
                console.log('No voxel at click point, searching nearby...');
                // Check surrounding voxels
                const offsets = [
                    [0, -1, 0], [0, 1, 0], // above/below
                    [1, 0, 0], [-1, 0, 0], // x axis
                    [0, 0, 1], [0, 0, -1]  // z axis
                ];
                
                for (const [dx, dy, dz] of offsets) {
                    const testVoxel = this.voxelEngine.getVoxel(
                        clickedVoxelX + dx, 
                        clickedVoxelY + dy, 
                        clickedVoxelZ + dz
                    );
                    if (testVoxel !== 0) {
                        clickedVoxelX += dx;
                        clickedVoxelY += dy;
                        clickedVoxelZ += dz;
                        voxelExists = true;
                        console.log(`Found voxel at ${clickedVoxelX}, ${clickedVoxelY}, ${clickedVoxelZ}`);
                        break;
                    }
                }
                
                if (!voxelExists) {
                    console.log('No voxel found nearby, treating as ground plane click');
                    
                    // Use the original hit point as ground position
                    const groundX = Math.floor(hitPoint.x / voxelScale);
                    const groundZ = Math.floor(hitPoint.z / voxelScale);
                    let groundY = Math.max(0, Math.floor(hitPoint.y / voxelScale));
                    
                    // Ensure the position is empty
                    while (this.voxelEngine.getVoxel(groundX, groundY, groundZ) !== 0 && groundY < 100) {
                        groundY++;
                    }
                    
                    targetPos = new THREE.Vector3(
                        groundX * voxelScale + 0.05,
                        groundY * voxelScale + 0.05,
                        groundZ * voxelScale + 0.05
                    );
                    
                    console.log(`Ground plane click target: ${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)}`);
                    console.log('=== CLICK DEBUG END ===');
                    
                    // Skip the rest of the voxel processing
                    voxelExists = true; // Set flag to skip further processing
                    clickedVoxelX = -9999; // Set to invalid value to trigger the else branch below
                }
            }
            
            // Check if we already set targetPos (from ground plane click)
            if (targetPos) {
                // Already have a target position, skip voxel processing
            } else if (Math.abs(clickedVoxelX) > 1000 || Math.abs(clickedVoxelY) > 1000 || Math.abs(clickedVoxelZ) > 1000) {
                // Validate the clicked position is reasonable
                console.error('Invalid voxel position detected:', clickedVoxelX, clickedVoxelY, clickedVoxelZ);
                return false;
            } else {
                // Find the top of the voxel structure at this X/Z position
                // Start from the clicked voxel and go up to find the top surface
                
                let targetVoxelX = clickedVoxelX;
                let targetVoxelY = clickedVoxelY;
                let targetVoxelZ = clickedVoxelZ;
                
                try {
                    // Find the highest solid voxel at this X/Z position
                    let topY = clickedVoxelY;
                    
                    // Search upward to find the top of the structure
                    while (this.voxelEngine.getVoxel(clickedVoxelX, topY + 1, clickedVoxelZ) !== 0 && topY < 255) {
                        topY++;
                    }
                    
                    console.log(`Found top of structure at Y=${topY} (clicked Y=${clickedVoxelY})`);
                    
                    // Target position is on top of the highest voxel
                    targetVoxelY = topY + 1;
                    
                    // Verify we can actually stand there (position must be empty)
                    const canStandOnTop = this.voxelEngine.getVoxel(targetVoxelX, targetVoxelY, targetVoxelZ) === 0;
                    
                    if (!canStandOnTop) {
                        console.log('Cannot stand on top, structure continues above. Trying adjacent positions...');
                        
                        // Try adjacent positions at the clicked level
                        const adjacentPositions = [
                            { x: clickedVoxelX + 1, y: clickedVoxelY, z: clickedVoxelZ },
                            { x: clickedVoxelX - 1, y: clickedVoxelY, z: clickedVoxelZ },
                            { x: clickedVoxelX, y: clickedVoxelY, z: clickedVoxelZ + 1 },
                            { x: clickedVoxelX, y: clickedVoxelY, z: clickedVoxelZ - 1 }
                        ];
                        
                        for (const pos of adjacentPositions) {
                            // Check if position is empty and has ground below
                            const isEmpty = this.voxelEngine.getVoxel(pos.x, pos.y, pos.z) === 0;
                            const hasGround = pos.y === 0 || this.voxelEngine.getVoxel(pos.x, pos.y - 1, pos.z) !== 0;
                            
                            if (isEmpty && hasGround) {
                                targetVoxelX = pos.x;
                                targetVoxelY = pos.y;
                                targetVoxelZ = pos.z;
                                console.log(`Found alternative at ${pos.x}, ${pos.y}, ${pos.z}`);
                                break;
                            }
                        }
                    }
                    
                    targetPos = new THREE.Vector3(
                        targetVoxelX * voxelScale + 0.05,
                        targetVoxelY * voxelScale + 0.05,
                        targetVoxelZ * voxelScale + 0.05
                    );
                    
                    console.log(`Target position: ${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)}`);
                    console.log('=== CLICK DEBUG END ===');
                    
                } catch (e) {
                    console.error('Error determining target position:', e);
                    console.log('=== CLICK DEBUG END (ERROR) ===');
                    return false;
                }
            }
        } else {
            // If no voxel hit, try ground plane
            console.log('No voxel hit, checking ground plane...');
            
            // Create a ground plane at Y=0
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            
            // Check if the ray intersects the ground plane
            if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
                // Snap to voxel grid
                const voxelScale = 0.1;
                const groundX = Math.floor(intersection.x / voxelScale);
                const groundZ = Math.floor(intersection.z / voxelScale);
                
                // Find the highest solid voxel at this X,Z position
                let groundY = -1; // Start below ground
                let foundGround = false;
                
                // Search from max height down to find the topmost solid voxel
                for (let y = 50; y >= 0; y--) {
                    if (this.voxelEngine.getVoxel(groundX, y, groundZ) !== 0) {
                        groundY = y;
                        foundGround = true;
                        break;
                    }
                }
                
                // If no voxel found, stand at ground level (Y=0)
                if (!foundGround) {
                    groundY = 0;
                    console.log('No voxel found at click position, using ground level');
                } else {
                    // Stand on top of the found voxel
                    groundY = groundY + 1;
                    console.log(`Found ground voxel at Y=${groundY-1}, standing at Y=${groundY}`);
                }
                
                // Make sure the target position is empty (not inside a voxel)
                let finalY = groundY;
                while (this.voxelEngine.getVoxel(groundX, finalY, groundZ) !== 0 && finalY < 100) {
                    finalY++;
                }
                
                targetPos = new THREE.Vector3(
                    groundX * voxelScale + 0.05,
                    finalY * voxelScale + 0.05,
                    groundZ * voxelScale + 0.05
                );
                
                console.log(`Ground plane click at world(${intersection.x.toFixed(2)}, ${intersection.z.toFixed(2)}) -> voxel(${groundX}, ${finalY}, ${groundZ}) -> target(${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)})`);
            } else {
                // Try a higher ground plane if the ray is pointing upward
                const higherPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -10); // 10 units up
                if (raycaster.ray.intersectPlane(higherPlane, intersection)) {
                    // Snap to voxel grid
                    const voxelScale = 0.1;
                    const groundX = Math.floor(intersection.x / voxelScale);
                    const groundZ = Math.floor(intersection.z / voxelScale);
                    
                    // Start from the click height and search down
                    let startY = Math.floor(intersection.y / voxelScale);
                    let groundY = 0;
                    let foundGround = false;
                    
                    for (let y = startY; y >= 0; y--) {
                        if (this.voxelEngine.getVoxel(groundX, y, groundZ) !== 0) {
                            groundY = y + 1; // Stand on top
                            foundGround = true;
                            break;
                        }
                    }
                    
                    if (!foundGround) {
                        groundY = 0; // Default to ground level
                    }
                    
                    targetPos = new THREE.Vector3(
                        groundX * voxelScale + 0.05,
                        groundY * voxelScale + 0.05,
                        groundZ * voxelScale + 0.05
                    );
                    
                    console.log(`Higher plane click -> target(${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)})`);
                } else {
                    console.log('No ground plane intersection at any height');
                }
            }
        }
        
        if (targetPos && !isNaN(targetPos.x) && !isNaN(targetPos.y) && !isNaN(targetPos.z)) {
            // Use pathfinder to find a path
            const playerPos = this.player.getPosition();
            
            // Validate player position too
            if (isNaN(playerPos.x) || isNaN(playerPos.y) || isNaN(playerPos.z)) {
                console.error('Invalid player position:', playerPos);
                return false;
            }
            
            try {
                console.log(`Finding path from ${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)} to ${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)}`);
                
                const path = this.pathfinder.findPath(playerPos, targetPos);
                
                if (path && path.length > 0) {
                    console.log(`Path found with ${path.length} nodes`);
                    
                    // Set the path on the player
                    this.player.setPath(path);
                    
                    // Debug visualization
                    if (this.scene) {
                        // Clear old debug path
                        if (this.debugPathGroup) {
                            this.scene.remove(this.debugPathGroup);
                            this.debugPathGroup = null;
                        }
                        
                        // Draw new debug path
                        try {
                            this.debugPathGroup = this.pathfinder.debugDrawPath(path, this.scene);
                        } catch (e) {
                            console.error('Error drawing debug path:', e);
                        }
                    }
                    
                    return true;
                } else {
                    console.log(`No path found to target`);
                    // Don't try direct movement to unreachable locations
                    return false;
                }
            } catch (error) {
                console.error('Pathfinding error:', error);
                console.error('Stack:', (error as Error).stack);
                return false;
            }
        }
        
        return false;
    }
    
    private updateTargetPreview(event: MouseEvent) {
        if (!this.isRunMode || !this.targetPreview || !this.voxelEngine || !this.camera || !this.scene) return;
        
        // Get the canvas element
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        
        // Calculate normalized device coordinates
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        // Create a raycaster
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // Use the voxelEngine's raycast method for accurate hit detection
        const hit = this.voxelEngine.raycast(raycaster);
        
        if (hit) {
            // Use the adjacent position for preview (where we would place a voxel)
            const targetPos = hit.adjacentPos;
            const voxelScale = 0.1;
            
            // Check if clicking on a voxel - find the top of the structure
            if (hit.voxelPos && this.voxelEngine.getVoxel(hit.voxelPos.x, hit.voxelPos.y, hit.voxelPos.z) !== 0) {
                // Find the highest solid voxel at this X/Z position
                let topY = hit.voxelPos.y;
                while (this.voxelEngine.getVoxel(hit.voxelPos.x, topY + 1, hit.voxelPos.z) !== 0 && topY < 255) {
                    topY++;
                }
                
                // Position preview on top of the highest voxel
                this.targetPreview.position.set(
                    hit.voxelPos.x * voxelScale + 0.05,
                    (topY + 1) * voxelScale + 0.001, // Slightly above to prevent z-fighting
                    hit.voxelPos.z * voxelScale + 0.05
                );
            } else {
                // Use the adjacent position (empty space where we'd stand)
                this.targetPreview.position.set(
                    targetPos.x * voxelScale + 0.05,
                    targetPos.y * voxelScale + 0.001, // Slightly above to prevent z-fighting
                    targetPos.z * voxelScale + 0.05
                );
            }
            
            this.targetPreview.visible = true;
        } else {
            // No hit, try ground plane
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            
            if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
                const voxelScale = 0.1;
                const groundX = Math.floor(intersection.x / voxelScale);
                const groundZ = Math.floor(intersection.z / voxelScale);
                
                // Find the highest solid voxel at this position
                let groundY = -1;
                for (let y = 50; y >= 0; y--) {
                    if (this.voxelEngine.getVoxel(groundX, y, groundZ) !== 0) {
                        groundY = y + 1; // Stand on top
                        break;
                    }
                }
                
                if (groundY === -1) {
                    groundY = 0; // Default to ground level
                }
                
                // Make sure position is empty
                while (this.voxelEngine.getVoxel(groundX, groundY, groundZ) !== 0 && groundY < 100) {
                    groundY++;
                }
                
                this.targetPreview.position.set(
                    groundX * voxelScale + 0.05,
                    groundY * voxelScale + 0.001,
                    groundZ * voxelScale + 0.05
                );
                this.targetPreview.visible = true;
            } else {
                this.targetPreview.visible = false;
            }
        }
    }
    
    isActive(): boolean {
        return this.isRunMode;
    }
}