/**
 * VoxelEditingSystem.js - 3D Voxel Placement and Removal Tools
 * 
 * Provides tools for editing voxels in 3D space with raycasting,
 * brush modes, and undo/redo functionality.
 */

import * as THREE from 'three';

export class VoxelEditingSystem {
    constructor(voxelWorld, camera, renderer) {
        this.voxelWorld = voxelWorld;
        this.camera = camera;
        this.renderer = renderer;
        
        // Raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Editing state
        this.isEditing = false;
        this.editMode = 'place'; // 'place' or 'remove'
        this.selectedVoxelType = 1;
        this.brushSize = 1;
        this.brushShape = 'cube'; // 'cube', 'sphere'
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Visual feedback
        this.previewMesh = null;
        this.highlightMesh = null;
        this.previewMaterial = null;
        
        // Input state
        this.isMouseDown = false;
        this.lastEditPosition = null;
        
        this.init();
    }
    
    init() {
        this.createPreviewMesh();
        this.createHighlightMesh();
        this.setupEventListeners();
    }
    
    /**
     * Create preview mesh for voxel placement
     */
    createPreviewMesh() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        this.previewMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            wireframe: true
        });
        
        this.previewMesh = new THREE.Mesh(geometry, this.previewMaterial);
        this.previewMesh.visible = false;
        
        // Add to scene if available
        if (this.voxelWorld.scene) {
            this.voxelWorld.scene.add(this.previewMesh);
        }
    }
    
    /**
     * Create highlight mesh for voxel selection
     */
    createHighlightMesh() {
        const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });
        
        this.highlightMesh = new THREE.Mesh(geometry, material);
        this.highlightMesh.visible = false;
        
        if (this.voxelWorld.scene) {
            this.voxelWorld.scene.add(this.highlightMesh);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }
    
    /**
     * Handle mouse movement
     */
    onMouseMove(event) {
        if (!this.isEditing) return;
        
        this.updateMousePosition(event);
        this.updatePreview();
        
        // Continuous editing while mouse is down
        if (this.isMouseDown) {
            this.performEdit();
        }
    }
    
    /**
     * Handle mouse down
     */
    onMouseDown(event) {
        if (!this.isEditing) return;
        
        this.isMouseDown = true;
        this.updateMousePosition(event);
        
        // Start new history entry
        this.startHistoryEntry();
        
        this.performEdit();
    }
    
    /**
     * Handle mouse up
     */
    onMouseUp(event) {
        if (!this.isEditing) return;
        
        this.isMouseDown = false;
        this.lastEditPosition = null;
        
        // Finalize history entry
        this.finalizeHistoryEntry();
    }
    
    /**
     * Handle keyboard input
     */
    onKeyDown(event) {
        if (!this.isEditing) return;
        
        switch (event.code) {
            case 'KeyZ':
                if (event.ctrlKey && event.shiftKey) {
                    this.redo();
                } else if (event.ctrlKey) {
                    this.undo();
                }
                break;
                
            case 'KeyX':
                this.toggleEditMode();
                break;
                
            case 'BracketLeft':
                this.decreaseBrushSize();
                break;
                
            case 'BracketRight':
                this.increaseBrushSize();
                break;
                
            case 'KeyB':
                this.cycleBrushShape();
                break;
        }
    }
    
    /**
     * Update mouse position for raycasting
     */
    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    /**
     * Update preview mesh position
     */
    updatePreview() {
        const intersection = this.getVoxelIntersection();
        
        if (intersection) {
            const pos = this.editMode === 'place' 
                ? intersection.placePosition 
                : intersection.removePosition;
                
            this.previewMesh.position.copy(pos);
            this.previewMesh.visible = true;
            
            // Update preview color based on mode
            this.previewMaterial.color.setHex(
                this.editMode === 'place' ? 0x00ff00 : 0xff0000
            );
            
            // Show highlight on existing voxel
            if (intersection.existingVoxel) {
                this.highlightMesh.position.copy(intersection.removePosition);
                this.highlightMesh.visible = true;
            } else {
                this.highlightMesh.visible = false;
            }
        } else {
            this.previewMesh.visible = false;
            this.highlightMesh.visible = false;
        }
    }
    
    /**
     * Get voxel intersection from raycast
     */
    getVoxelIntersection() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Raycast against all chunk meshes
        const intersects = [];
        this.voxelWorld.chunks.forEach(chunk => {
            if (chunk.mesh && chunk.mesh.visible) {
                const chunkIntersects = this.raycaster.intersectObject(chunk.mesh);
                intersects.push(...chunkIntersects);
            }
        });
        
        if (intersects.length === 0) return null;
        
        // Find closest intersection
        intersects.sort((a, b) => a.distance - b.distance);
        const hit = intersects[0];
        
        // Calculate voxel position
        const point = hit.point;
        const normal = hit.face.normal;
        
        // Get the exact voxel hit
        const removePosition = new THREE.Vector3(
            Math.floor(point.x + normal.x * -0.5),
            Math.floor(point.y + normal.y * -0.5),
            Math.floor(point.z + normal.z * -0.5)
        );
        
        // Calculate place position (adjacent to hit voxel)
        const placePosition = new THREE.Vector3(
            Math.floor(point.x + normal.x * 0.5),
            Math.floor(point.y + normal.y * 0.5),
            Math.floor(point.z + normal.z * 0.5)
        );
        
        return {
            removePosition,
            placePosition,
            existingVoxel: true,
            normal: normal.clone()
        };
    }
    
    /**
     * Perform voxel edit operation
     */
    performEdit() {
        const intersection = this.getVoxelIntersection();
        if (!intersection) return;
        
        const position = this.editMode === 'place' 
            ? intersection.placePosition 
            : intersection.removePosition;
            
        // Check if we're editing the same position
        if (this.lastEditPosition && this.lastEditPosition.equals(position)) {
            return;
        }
        
        this.lastEditPosition = position.clone();
        
        // Apply brush
        this.applyBrush(position);
    }
    
    /**
     * Apply brush effect at position
     */
    applyBrush(centerPos) {
        const positions = this.getBrushPositions(centerPos);
        
        for (const pos of positions) {
            const voxelType = this.editMode === 'place' ? this.selectedVoxelType : 0;
            this.voxelWorld.setVoxel(pos.x, pos.y, pos.z, voxelType);
            
            // Record change for history
            if (this.currentHistoryEntry) {
                this.currentHistoryEntry.changes.push({
                    position: pos.clone(),
                    oldValue: this.voxelWorld.getVoxel(pos.x, pos.y, pos.z),
                    newValue: voxelType
                });
            }
        }
    }
    
    /**
     * Get positions affected by brush
     */
    getBrushPositions(centerPos) {
        const positions = [];
        const size = this.brushSize;
        const radius = (size - 1) / 2;
        
        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    const pos = new THREE.Vector3(
                        centerPos.x + x,
                        centerPos.y + y,
                        centerPos.z + z
                    );
                    
                    if (this.brushShape === 'sphere') {
                        const distance = Math.sqrt(x * x + y * y + z * z);
                        if (distance <= radius) {
                            positions.push(pos);
                        }
                    } else {
                        positions.push(pos);
                    }
                }
            }
        }
        
        return positions;
    }
    
    /**
     * Start new history entry
     */
    startHistoryEntry() {
        this.currentHistoryEntry = {
            changes: [],
            timestamp: Date.now()
        };
    }
    
    /**
     * Finalize current history entry
     */
    finalizeHistoryEntry() {
        if (!this.currentHistoryEntry || this.currentHistoryEntry.changes.length === 0) {
            return;
        }
        
        // Remove any history entries after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add new entry
        this.history.push(this.currentHistoryEntry);
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.currentHistoryEntry = null;
    }
    
    /**
     * Undo last operation
     */
    undo() {
        if (this.historyIndex < 0) return;
        
        const entry = this.history[this.historyIndex];
        
        // Reverse all changes
        for (const change of entry.changes) {
            this.voxelWorld.setVoxel(
                change.position.x,
                change.position.y,
                change.position.z,
                change.oldValue
            );
        }
        
        this.historyIndex--;
    }
    
    /**
     * Redo next operation
     */
    redo() {
        if (this.historyIndex >= this.history.length - 1) return;
        
        this.historyIndex++;
        const entry = this.history[this.historyIndex];
        
        // Reapply all changes
        for (const change of entry.changes) {
            this.voxelWorld.setVoxel(
                change.position.x,
                change.position.y,
                change.position.z,
                change.newValue
            );
        }
    }
    
    /**
     * Toggle between place and remove modes
     */
    toggleEditMode() {
        this.editMode = this.editMode === 'place' ? 'remove' : 'place';
    }
    
    /**
     * Increase brush size
     */
    increaseBrushSize() {
        this.brushSize = Math.min(this.brushSize + 1, 10);
    }
    
    /**
     * Decrease brush size
     */
    decreaseBrushSize() {
        this.brushSize = Math.max(this.brushSize - 1, 1);
    }
    
    /**
     * Cycle brush shape
     */
    cycleBrushShape() {
        this.brushShape = this.brushShape === 'cube' ? 'sphere' : 'cube';
    }
    
    /**
     * Set editing enabled/disabled
     */
    setEditing(enabled) {
        this.isEditing = enabled;
        this.previewMesh.visible = enabled;
        this.highlightMesh.visible = false;
        
        if (!enabled) {
            this.isMouseDown = false;
            this.lastEditPosition = null;
        }
    }
    
    /**
     * Set selected voxel type
     */
    setVoxelType(voxelType) {
        this.selectedVoxelType = voxelType;
    }
    
    /**
     * Set brush size
     */
    setBrushSize(size) {
        this.brushSize = Math.max(1, Math.min(size, 10));
    }
    
    /**
     * Set brush shape
     */
    setBrushShape(shape) {
        if (['cube', 'sphere'].includes(shape)) {
            this.brushShape = shape;
        }
    }
    
    /**
     * Get current editing state
     */
    getState() {
        return {
            isEditing: this.isEditing,
            editMode: this.editMode,
            selectedVoxelType: this.selectedVoxelType,
            brushSize: this.brushSize,
            brushShape: this.brushShape,
            canUndo: this.historyIndex >= 0,
            canRedo: this.historyIndex < this.history.length - 1
        };
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        if (this.previewMesh) {
            if (this.previewMesh.parent) {
                this.previewMesh.parent.remove(this.previewMesh);
            }
            this.previewMesh.geometry.dispose();
            this.previewMaterial.dispose();
        }
        
        if (this.highlightMesh) {
            if (this.highlightMesh.parent) {
                this.highlightMesh.parent.remove(this.highlightMesh);
            }
            this.highlightMesh.geometry.dispose();
            this.highlightMesh.material.dispose();
        }
    }
}