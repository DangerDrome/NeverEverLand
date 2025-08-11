import * as THREE from 'three';
import { VoxelEngine } from '../engine/VoxelEngine';
import { VoxelType } from '../types';
import { TransformGizmo } from './TransformGizmo';

export interface SelectionBox {
    min: THREE.Vector3;
    max: THREE.Vector3;
}

export interface SelectedVoxel {
    x: number;
    y: number;
    z: number;
    type: VoxelType;
}

export class BoxSelectionTool {
    private scene: THREE.Scene;
    private voxelEngine: VoxelEngine;
    private camera: THREE.OrthographicCamera;
    
    // Selection state
    private isSelecting: boolean = false;
    private selectionStart: THREE.Vector3 | null = null;
    private selectionEnd: THREE.Vector3 | null = null;
    private selectedVoxels: SelectedVoxel[] = [];
    
    // Visual elements
    private selectionBox: THREE.Box3Helper | null = null;
    private selectionOutline: THREE.LineSegments | null = null;
    private selectedVoxelsMesh: THREE.InstancedMesh | null = null;
    private transformControls: THREE.Group | null = null;
    private ghostVoxels: THREE.InstancedMesh | null = null;
    private transformGizmo: TransformGizmo;
    
    // Transformation state
    private transformMode: 'move' | 'rotate' | null = null;
    private transformOffset: THREE.Vector3 = new THREE.Vector3();
    private transformRotation: THREE.Euler = new THREE.Euler();
    
    // Click detection for single/double click
    private lastClickTime: number = 0;
    private lastClickedVoxel: { x: number; y: number; z: number } | null = null;
    private doubleClickThreshold: number = 300; // milliseconds
    
    // Store original voxel positions for real-time transformation
    private originalVoxels: SelectedVoxel[] = [];
    
    // Duplication state
    private isDuplicating: boolean = false;
    
    // Adding to selection state
    private isAddingToSelection: boolean = false;
    
    constructor(scene: THREE.Scene, voxelEngine: VoxelEngine, camera: THREE.OrthographicCamera) {
        this.scene = scene;
        this.voxelEngine = voxelEngine;
        this.camera = camera;
        this.transformGizmo = new TransformGizmo(scene, camera);
    }
    
    /**
     * Handle click for single voxel or contiguous selection
     */
    handleClick(voxelPos: { x: number; y: number; z: number } | null, shiftKey: boolean = false): boolean {
        if (!voxelPos) {
            return false;
        }
        
        const currentTime = Date.now();
        
        // Use the voxel position directly
        const clickedVoxel = {
            x: voxelPos.x,
            y: voxelPos.y,
            z: voxelPos.z
        };
        
        // Check if voxel exists at clicked position
        const voxelType = this.voxelEngine.getVoxel(clickedVoxel.x, clickedVoxel.y, clickedVoxel.z);
        if (voxelType === VoxelType.AIR) {
            // No voxel here, start box selection
            return false;
        }
        
        // Check for double click on selected voxel
        const isDoubleClick = (currentTime - this.lastClickTime) < this.doubleClickThreshold;
        const isSameVoxel = this.lastClickedVoxel && 
            this.lastClickedVoxel.x === clickedVoxel.x &&
            this.lastClickedVoxel.y === clickedVoxel.y &&
            this.lastClickedVoxel.z === clickedVoxel.z;
        
        // Check if clicking on already selected voxel
        const isVoxelSelected = this.selectedVoxels.some(v => 
            v.x === clickedVoxel.x && v.y === clickedVoxel.y && v.z === clickedVoxel.z
        );
        
        if (isDoubleClick && isSameVoxel && isVoxelSelected) {
            // Double click on selected voxel - select contiguous voxels
            this.selectContiguousVoxels(clickedVoxel.x, clickedVoxel.y, clickedVoxel.z, voxelType, shiftKey);
        } else if (shiftKey) {
            // Shift+click - add to selection
            this.addToSelection(clickedVoxel.x, clickedVoxel.y, clickedVoxel.z, voxelType);
        } else {
            // Single click - select single voxel
            this.selectSingleVoxel(clickedVoxel.x, clickedVoxel.y, clickedVoxel.z, voxelType);
        }
        
        // Update click tracking
        this.lastClickTime = currentTime;
        this.lastClickedVoxel = clickedVoxel;
        
        return true; // Handled the click
    }
    
    /**
     * Select a single voxel
     */
    private selectSingleVoxel(x: number, y: number, z: number, type: VoxelType): void {
        // Clear previous selection
        this.clearSelection();
        
        // Add single voxel to selection
        this.selectedVoxels = [{ x, y, z, type }];
        
        // Update visuals
        this.updateSelectionOutline();
        this.showSelectedVoxels();
        
        // Show gizmo at voxel position
        const voxelSize = this.voxelEngine.getVoxelSize();
        const center = new THREE.Vector3(
            x * voxelSize + voxelSize * 0.5,
            y * voxelSize + voxelSize * 0.5,
            z * voxelSize + voxelSize * 0.5
        );
        this.transformGizmo.show(center);
        
        console.log(`Selected single voxel at (${x}, ${y}, ${z})`);
    }
    
    /**
     * Add a single voxel to the current selection
     */
    private addToSelection(x: number, y: number, z: number, type: VoxelType): void {
        // Check if voxel is already selected
        const isAlreadySelected = this.selectedVoxels.some(v => 
            v.x === x && v.y === y && v.z === z
        );
        
        if (!isAlreadySelected) {
            // Add to selection
            this.selectedVoxels.push({ x, y, z, type });
            
            // Update visuals
            this.updateSelectionOutline();
            this.showSelectedVoxels();
            
            // Update gizmo position to new center
            if (this.selectedVoxels.length > 0) {
                const center = this.getSelectionCenter();
                this.transformGizmo.show(center);
            }
            
            console.log(`Added voxel at (${x}, ${y}, ${z}) to selection. Total: ${this.selectedVoxels.length} voxels`);
        }
    }
    
    /**
     * Select all contiguous voxels of the same type using flood fill
     */
    private selectContiguousVoxels(startX: number, startY: number, startZ: number, targetType: VoxelType, addToExisting: boolean = false): void {
        // Clear previous selection unless adding to existing
        if (!addToExisting) {
            this.clearSelection();
        }
        
        // Create set of already selected voxels to avoid duplicates
        const existingSelection = new Set<string>();
        if (addToExisting) {
            for (const voxel of this.selectedVoxels) {
                existingSelection.add(`${voxel.x},${voxel.y},${voxel.z}`);
            }
        }
        
        // Use flood fill to find all connected voxels
        const visited = new Set<string>();
        const toVisit: { x: number; y: number; z: number }[] = [{ x: startX, y: startY, z: startZ }];
        const contiguousVoxels: SelectedVoxel[] = addToExisting ? [...this.selectedVoxels] : [];
        
        while (toVisit.length > 0) {
            const current = toVisit.pop()!;
            const key = `${current.x},${current.y},${current.z}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            const voxelType = this.voxelEngine.getVoxel(current.x, current.y, current.z);
            if (voxelType !== targetType) continue;
            
            // Add to selection if not already selected
            if (!existingSelection.has(key)) {
                contiguousVoxels.push({ x: current.x, y: current.y, z: current.z, type: voxelType });
                existingSelection.add(key);
            }
            
            // Check all 6 neighbors
            const neighbors = [
                { x: current.x + 1, y: current.y, z: current.z },
                { x: current.x - 1, y: current.y, z: current.z },
                { x: current.x, y: current.y + 1, z: current.z },
                { x: current.x, y: current.y - 1, z: current.z },
                { x: current.x, y: current.y, z: current.z + 1 },
                { x: current.x, y: current.y, z: current.z - 1 }
            ];
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y},${neighbor.z}`;
                if (!visited.has(neighborKey)) {
                    toVisit.push(neighbor);
                }
            }
        }
        
        this.selectedVoxels = contiguousVoxels;
        
        // Update visuals
        this.updateSelectionOutline();
        this.showSelectedVoxels();
        
        // Show gizmo at selection center
        if (this.selectedVoxels.length > 0) {
            const center = this.getSelectionCenter();
            this.transformGizmo.show(center);
        }
        
        console.log(`Selected ${this.selectedVoxels.length} contiguous voxels of type ${VoxelType[targetType]}`);
    }
    
    /**
     * Start box selection at the given world position
     */
    startSelection(worldPos: THREE.Vector3, addToExisting: boolean = false): void {
        this.isSelecting = true;
        this.selectionStart = worldPos.clone();
        this.selectionEnd = worldPos.clone();
        
        // Store if we're adding to selection
        this.isAddingToSelection = addToExisting;
        
        // Clear previous selection only if not adding
        if (!addToExisting) {
            this.clearSelection();
        }
        
        // Create initial selection box visual
        this.updateSelectionVisual();
    }
    
    /**
     * Update selection box as mouse moves
     */
    updateSelection(worldPos: THREE.Vector3): void {
        if (!this.isSelecting || !this.selectionStart) return;
        
        this.selectionEnd = worldPos.clone();
        this.updateSelectionVisual();
        
        // Preview which voxels will be selected
        this.previewSelectionVoxels();
    }
    
    /**
     * Finish selection and select voxels within the box
     */
    endSelection(): void {
        if (!this.isSelecting || !this.selectionStart || !this.selectionEnd) return;
        
        this.isSelecting = false;
        
        // Remove the selection box visual
        if (this.selectionBox) {
            this.scene.remove(this.selectionBox);
            this.selectionBox.geometry.dispose();
            (this.selectionBox.material as THREE.Material).dispose();
            this.selectionBox = null;
        }
        
        // Calculate selection bounds
        const min = new THREE.Vector3(
            Math.min(this.selectionStart.x, this.selectionEnd.x),
            Math.min(this.selectionStart.y, this.selectionEnd.y),
            Math.min(this.selectionStart.z, this.selectionEnd.z)
        );
        
        const max = new THREE.Vector3(
            Math.max(this.selectionStart.x, this.selectionEnd.x),
            Math.max(this.selectionStart.y, this.selectionEnd.y),
            Math.max(this.selectionStart.z, this.selectionEnd.z)
        );
        
        // Convert to voxel coordinates
        const voxelSize = this.voxelEngine.getVoxelSize();
        const minVoxel = {
            x: Math.floor(min.x / voxelSize),
            y: Math.floor(min.y / voxelSize),
            z: Math.floor(min.z / voxelSize)
        };
        
        const maxVoxel = {
            x: Math.ceil(max.x / voxelSize),
            y: Math.ceil(max.y / voxelSize),
            z: Math.ceil(max.z / voxelSize)
        };
        
        // Create a set of existing selections if adding
        const existingSelection = new Set<string>();
        if (this.isAddingToSelection) {
            for (const voxel of this.selectedVoxels) {
                existingSelection.add(`${voxel.x},${voxel.y},${voxel.z}`);
            }
        } else {
            // Clear selection if not adding
            this.selectedVoxels = [];
        }
        
        // Select voxels within bounds
        for (let x = minVoxel.x; x <= maxVoxel.x; x++) {
            for (let y = minVoxel.y; y <= maxVoxel.y; y++) {
                for (let z = minVoxel.z; z <= maxVoxel.z; z++) {
                    const voxelType = this.voxelEngine.getVoxel(x, y, z);
                    if (voxelType !== VoxelType.AIR) {
                        const key = `${x},${y},${z}`;
                        // Only add if not already selected (when adding to selection)
                        if (!existingSelection.has(key)) {
                            this.selectedVoxels.push({ x, y, z, type: voxelType });
                        }
                    }
                }
            }
        }
        
        // Reset the adding flag
        this.isAddingToSelection = false;
        
        // Update visual to show selected voxels
        this.updateSelectionOutline();
        this.showSelectedVoxels();
        
        // Show unified transform gizmo at selection center if voxels were selected
        if (this.selectedVoxels.length > 0) {
            const center = this.getSelectionCenter();
            this.transformGizmo.show(center);
        }
        
        console.log(`Selected ${this.selectedVoxels.length} voxels`);
    }
    
    /**
     * Get the center of selected voxels
     */
    private getSelectionCenter(): THREE.Vector3 {
        if (this.selectedVoxels.length === 0) {
            return new THREE.Vector3();
        }
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        let sumX = 0, sumY = 0, sumZ = 0;
        
        for (const voxel of this.selectedVoxels) {
            sumX += voxel.x;
            sumY += voxel.y;
            sumZ += voxel.z;
        }
        
        return new THREE.Vector3(
            (sumX / this.selectedVoxels.length) * voxelSize + voxelSize * 0.5,
            (sumY / this.selectedVoxels.length) * voxelSize + voxelSize * 0.5,
            (sumZ / this.selectedVoxels.length) * voxelSize + voxelSize * 0.5
        );
    }
    
    /**
     * Preview voxels that will be selected
     */
    private previewSelectionVoxels(): void {
        if (!this.selectionStart || !this.selectionEnd) return;
        
        // Clear previous preview
        if (this.selectedVoxelsMesh) {
            this.scene.remove(this.selectedVoxelsMesh);
            this.selectedVoxelsMesh.geometry.dispose();
            (this.selectedVoxelsMesh.material as THREE.Material).dispose();
            this.selectedVoxelsMesh = null;
        }
        
        // Calculate selection bounds
        const min = new THREE.Vector3(
            Math.min(this.selectionStart.x, this.selectionEnd.x),
            Math.min(this.selectionStart.y, this.selectionEnd.y),
            Math.min(this.selectionStart.z, this.selectionEnd.z)
        );
        
        const max = new THREE.Vector3(
            Math.max(this.selectionStart.x, this.selectionEnd.x),
            Math.max(this.selectionStart.y, this.selectionEnd.y),
            Math.max(this.selectionStart.z, this.selectionEnd.z)
        );
        
        // Convert to voxel coordinates
        const voxelSize = this.voxelEngine.getVoxelSize();
        const minVoxel = {
            x: Math.floor(min.x / voxelSize),
            y: Math.floor(min.y / voxelSize),
            z: Math.floor(min.z / voxelSize)
        };
        
        const maxVoxel = {
            x: Math.ceil(max.x / voxelSize),
            y: Math.ceil(max.y / voxelSize),
            z: Math.ceil(max.z / voxelSize)
        };
        
        // Find voxels within bounds
        const previewVoxels: { x: number; y: number; z: number }[] = [];
        for (let x = minVoxel.x; x <= maxVoxel.x; x++) {
            for (let y = minVoxel.y; y <= maxVoxel.y; y++) {
                for (let z = minVoxel.z; z <= maxVoxel.z; z++) {
                    const voxelType = this.voxelEngine.getVoxel(x, y, z);
                    if (voxelType !== VoxelType.AIR) {
                        previewVoxels.push({ x, y, z });
                    }
                }
            }
        }
        
        // Show preview highlight
        if (previewVoxels.length > 0) {
            const geometry = new THREE.BoxGeometry(voxelSize * 1.02, voxelSize * 1.02, voxelSize * 1.02);
            const material = new THREE.MeshBasicMaterial({
                color: 'rgb(100, 150, 255)',  // Light blue
                transparent: true,
                opacity: 0.3,
                depthWrite: false
            });
            
            this.selectedVoxelsMesh = new THREE.InstancedMesh(geometry, material, previewVoxels.length);
            this.selectedVoxelsMesh.renderOrder = 997;
            
            const matrix = new THREE.Matrix4();
            for (let i = 0; i < previewVoxels.length; i++) {
                const voxel = previewVoxels[i];
                matrix.makeTranslation(
                    voxel.x * voxelSize + voxelSize * 0.5,
                    voxel.y * voxelSize + voxelSize * 0.5,
                    voxel.z * voxelSize + voxelSize * 0.5
                );
                this.selectedVoxelsMesh.setMatrixAt(i, matrix);
            }
            
            this.selectedVoxelsMesh.instanceMatrix.needsUpdate = true;
            this.scene.add(this.selectedVoxelsMesh);
        }
    }
    
    /**
     * Update the visual representation of the selection box
     */
    private updateSelectionVisual(): void {
        if (!this.selectionStart || !this.selectionEnd) return;
        
        // Remove old box
        if (this.selectionBox) {
            this.scene.remove(this.selectionBox);
            this.selectionBox.geometry.dispose();
            (this.selectionBox.material as THREE.Material).dispose();
        }
        
        // Create box3 from selection bounds
        const box = new THREE.Box3(
            new THREE.Vector3(
                Math.min(this.selectionStart.x, this.selectionEnd.x),
                Math.min(this.selectionStart.y, this.selectionEnd.y),
                Math.min(this.selectionStart.z, this.selectionEnd.z)
            ),
            new THREE.Vector3(
                Math.max(this.selectionStart.x, this.selectionEnd.x),
                Math.max(this.selectionStart.y, this.selectionEnd.y),
                Math.max(this.selectionStart.z, this.selectionEnd.z)
            )
        );
        
        // Create box helper with cyan color
        this.selectionBox = new THREE.Box3Helper(box, new THREE.Color('rgb(0, 255, 255)'));
        this.selectionBox.renderOrder = 1000; // Render on top
        this.scene.add(this.selectionBox);
    }
    
    /**
     * Show selected voxels with blue highlight
     */
    private showSelectedVoxels(): void {
        // Remove old selection mesh
        if (this.selectedVoxelsMesh) {
            this.scene.remove(this.selectedVoxelsMesh);
            this.selectedVoxelsMesh.geometry.dispose();
            (this.selectedVoxelsMesh.material as THREE.Material).dispose();
            this.selectedVoxelsMesh = null;
        }
        
        if (this.selectedVoxels.length === 0) return;
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        const geometry = new THREE.BoxGeometry(voxelSize * 1.02, voxelSize * 1.02, voxelSize * 1.02); // Slightly larger
        const material = new THREE.MeshBasicMaterial({
            color: 'rgb(100, 150, 255)',  // Light blue
            transparent: true,
            opacity: 0.5,  // More visible during transformation
            depthWrite: false
        });
        
        this.selectedVoxelsMesh = new THREE.InstancedMesh(geometry, material, this.selectedVoxels.length);
        this.selectedVoxelsMesh.renderOrder = 997;
        
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < this.selectedVoxels.length; i++) {
            const voxel = this.selectedVoxels[i];
            matrix.makeTranslation(
                voxel.x * voxelSize + voxelSize * 0.5,
                voxel.y * voxelSize + voxelSize * 0.5,
                voxel.z * voxelSize + voxelSize * 0.5
            );
            this.selectedVoxelsMesh.setMatrixAt(i, matrix);
        }
        
        this.selectedVoxelsMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.selectedVoxelsMesh);
    }
    
    /**
     * Create outline around selected voxels
     */
    private updateSelectionOutline(): void {
        // Remove old outline
        if (this.selectionOutline) {
            this.scene.remove(this.selectionOutline);
            this.selectionOutline.geometry.dispose();
            (this.selectionOutline.material as THREE.Material).dispose();
        }
        
        if (this.selectedVoxels.length === 0) return;
        
        // Create edges geometry for selected voxels
        const voxelSize = this.voxelEngine.getVoxelSize();
        const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
        const edges = new THREE.EdgesGeometry(geometry);
        
        // Create instanced line segments for all selected voxels
        const positions: number[] = [];
        
        for (const voxel of this.selectedVoxels) {
            const x = voxel.x * voxelSize + voxelSize * 0.5;
            const y = voxel.y * voxelSize + voxelSize * 0.5;
            const z = voxel.z * voxelSize + voxelSize * 0.5;
            
            // Add edge positions for this voxel
            const edgePositions = edges.attributes.position.array;
            for (let i = 0; i < edgePositions.length; i += 3) {
                positions.push(edgePositions[i] + x);
                positions.push(edgePositions[i + 1] + y);
                positions.push(edgePositions[i + 2] + z);
            }
        }
        
        // Create line segments
        const outlineGeometry = new THREE.BufferGeometry();
        outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const outlineMaterial = new THREE.LineBasicMaterial({
            color: 'rgb(255, 255, 0)',  // Yellow outline for selected voxels
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });
        
        this.selectionOutline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
        this.selectionOutline.renderOrder = 999;
        this.scene.add(this.selectionOutline);
        
        geometry.dispose();
        edges.dispose();
    }
    
    /**
     * Handle gizmo interaction on mouse down
     */
    handleGizmoMouseDown(raycaster: THREE.Raycaster, shiftKey: boolean = false): boolean {
        const hit = this.transformGizmo.onMouseHover(raycaster);
        if (hit) {
            this.transformGizmo.startDrag(hit.axis, hit.operation, raycaster);
            this.transformMode = hit.operation === 'move' ? 'move' : 'rotate';
            this.transformOffset.set(0, 0, 0);
            this.transformRotation.set(0, 0, 0);
            
            // Store original voxel positions for transformation
            this.originalVoxels = [...this.selectedVoxels];
            
            // Store if this is a duplication (shift+drag)
            this.isDuplicating = shiftKey;
            
            console.log(`Started ${hit.operation} on ${hit.axis} axis${shiftKey ? ' (duplicating)' : ''}`);
            return true;
        }
        return false;
    }
    
    /**
     * Handle gizmo dragging
     */
    handleGizmoDrag(raycaster: THREE.Raycaster): void {
        if (!this.transformGizmo.isDraggingGizmo()) return;
        
        const delta = this.transformGizmo.updateDrag(raycaster);
        if (!delta) return;
        
        const operation = this.transformGizmo.getCurrentOperation();
        const voxelSize = this.voxelEngine.getVoxelSize();
        
        // Store previous values to check if we need to update
        const prevOffset = this.transformOffset.clone();
        const prevRotation = { x: this.transformRotation.x, y: this.transformRotation.y, z: this.transformRotation.z };
        
        if (operation === 'move') {
            console.log(`Move operation: delta=(${delta.x.toFixed(3)}, ${delta.y.toFixed(3)}, ${delta.z.toFixed(3)})`);
            
            // Scale up the delta to make movement more responsive
            const scaledDelta = delta.clone().multiplyScalar(1); // Increase sensitivity
            
            // Update position
            this.transformOffset.add(scaledDelta);
            
            console.log(`Offset before snap: (${this.transformOffset.x.toFixed(3)}, ${this.transformOffset.y.toFixed(3)}, ${this.transformOffset.z.toFixed(3)})`);
            
            // Always apply the transformation to update the gizmo position smoothly
            // The preview will snap to grid but the gizmo can move smoothly
            console.log(`Applying move transformation with smooth gizmo`);
            
            // Apply transformation in real-time
            // This will update the gizmo position via updateSelectionPreview
            this.applyTransformRealtime();
        } else if (operation === 'rotate') {
            // Debug: log raw delta
            console.log(`Rotation delta: x=${delta.x.toFixed(4)}, y=${delta.y.toFixed(4)}, z=${delta.z.toFixed(4)}`);
            
            // Update rotation incrementally
            this.transformRotation.x += delta.x;
            this.transformRotation.y += delta.y;
            this.transformRotation.z += delta.z;
            
            console.log(`Raw rotation: X=${(this.transformRotation.x * 180 / Math.PI).toFixed(1)}°, Y=${(this.transformRotation.y * 180 / Math.PI).toFixed(1)}°, Z=${(this.transformRotation.z * 180 / Math.PI).toFixed(1)}°`);
            
            // For now, disable snapping for smoother rotation
            // Can re-enable with smaller snap angle if needed
            const useSnapping = false;
            let newRotX, newRotY, newRotZ;
            
            if (useSnapping) {
                const snapAngle = Math.PI / 36; // 5 degrees (was 15)
                newRotX = Math.round(this.transformRotation.x / snapAngle) * snapAngle;
                newRotY = Math.round(this.transformRotation.y / snapAngle) * snapAngle;
                newRotZ = Math.round(this.transformRotation.z / snapAngle) * snapAngle;
            } else {
                // No snapping - use raw values
                newRotX = this.transformRotation.x;
                newRotY = this.transformRotation.y;
                newRotZ = this.transformRotation.z;
            }
            
            // Only update if rotation actually changed
            if (newRotX !== prevRotation.x || newRotY !== prevRotation.y || newRotZ !== prevRotation.z) {
                this.transformRotation.x = newRotX;
                this.transformRotation.y = newRotY;
                this.transformRotation.z = newRotZ;
                
                console.log(`Snapped rotation: X=${(newRotX * 180 / Math.PI).toFixed(1)}°, Y=${(newRotY * 180 / Math.PI).toFixed(1)}°, Z=${(newRotZ * 180 / Math.PI).toFixed(1)}°`);
                
                // Apply transformation in real-time
                this.applyTransformRealtime();
            }
        }
    }
    
    /**
     * End gizmo dragging
     */
    handleGizmoMouseUp(): void {
        if (this.transformGizmo.isDraggingGizmo()) {
            this.transformGizmo.endDrag();
            
            // Apply the actual transformation when releasing
            if (this.transformMode && (this.transformOffset.length() > 0.01 || 
                Math.abs(this.transformRotation.x) > 0.01 || 
                Math.abs(this.transformRotation.y) > 0.01 || 
                Math.abs(this.transformRotation.z) > 0.01)) {
                this.applyTransformOnRelease();
            }
            
            // Reset for next transformation
            this.transformMode = null;
            this.transformOffset.set(0, 0, 0);
            this.transformRotation.set(0, 0, 0);
            this.originalVoxels = [];
            this.isDuplicating = false;
        }
    }
    
    /**
     * Apply transformation in real-time during dragging (visual only)
     */
    private applyTransformRealtime(): void {
        if (!this.transformMode || this.originalVoxels.length === 0) return;
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        
        // Calculate center for rotation
        let centerX = 0, centerY = 0, centerZ = 0;
        if (this.transformMode === 'rotate') {
            for (const voxel of this.originalVoxels) {
                centerX += voxel.x;
                centerY += voxel.y;
                centerZ += voxel.z;
            }
            centerX /= this.originalVoxels.length;
            centerY /= this.originalVoxels.length;
            centerZ /= this.originalVoxels.length;
        }
        
        // Calculate new positions for PREVIEW only (don't modify actual voxels)
        const previewVoxels: SelectedVoxel[] = [];
        for (const voxel of this.originalVoxels) {
            let newX = voxel.x;
            let newY = voxel.y;
            let newZ = voxel.z;
            
            if (this.transformMode === 'rotate') {
                // Apply rotation around center
                const pos = new THREE.Vector3(
                    voxel.x - centerX,
                    voxel.y - centerY,
                    voxel.z - centerZ
                );
                pos.applyEuler(this.transformRotation);
                newX = Math.round(pos.x + centerX);
                newY = Math.round(pos.y + centerY);
                newZ = Math.round(pos.z + centerZ);
            }
            
            if (this.transformMode === 'move') {
                // Apply translation
                const offsetVoxels = {
                    x: Math.round(this.transformOffset.x / voxelSize),
                    y: Math.round(this.transformOffset.y / voxelSize),
                    z: Math.round(this.transformOffset.z / voxelSize)
                };
                
                newX += offsetVoxels.x;
                newY += offsetVoxels.y;
                newZ += offsetVoxels.z;
            }
            
            previewVoxels.push({ x: newX, y: newY, z: newZ, type: voxel.type });
        }
        
        // Update ONLY the selection visual highlight to show new positions
        // Don't touch actual voxels
        this.updateSelectionPreview(previewVoxels);
    }
    
    /**
     * Update the visual preview of where selected voxels will be placed
     */
    private updateSelectionPreview(previewVoxels: SelectedVoxel[]): void {
        if (!this.selectedVoxelsMesh) return;
        
        // Update color if duplicating
        if (this.isDuplicating) {
            const material = this.selectedVoxelsMesh.material as THREE.MeshBasicMaterial;
            material.color.set('rgb(100, 255, 100)'); // Green for duplication
            material.opacity = 0.6;
        } else {
            const material = this.selectedVoxelsMesh.material as THREE.MeshBasicMaterial;
            material.color.set('rgb(100, 150, 255)'); // Blue for normal move
            material.opacity = 0.5;
        }
        
        // Update the positions of the selection preview mesh
        const voxelSize = this.voxelEngine.getVoxelSize();
        const matrix = new THREE.Matrix4();
        
        for (let i = 0; i < previewVoxels.length; i++) {
            const voxel = previewVoxels[i];
            matrix.makeTranslation(
                voxel.x * voxelSize + voxelSize * 0.5,  // Add center offset like in showSelectedVoxels
                voxel.y * voxelSize + voxelSize * 0.5,
                voxel.z * voxelSize + voxelSize * 0.5
            );
            this.selectedVoxelsMesh.setMatrixAt(i, matrix);
        }
        
        this.selectedVoxelsMesh.instanceMatrix.needsUpdate = true;
        
        // Update the outline by recreating it with new positions
        if (previewVoxels.length > 0 && this.selectionOutline) {
            // Remove old outline
            this.scene.remove(this.selectionOutline);
            const oldMaterial = (this.selectionOutline.material as THREE.Material);
            this.selectionOutline.geometry.dispose();
            
            // Create new outline geometry for preview positions
            const voxelSize = this.voxelEngine.getVoxelSize();
            const boxGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
            const edges = new THREE.EdgesGeometry(boxGeometry);
            
            const positions: number[] = [];
            
            for (const voxel of previewVoxels) {
                const x = voxel.x * voxelSize + voxelSize * 0.5;
                const y = voxel.y * voxelSize + voxelSize * 0.5;
                const z = voxel.z * voxelSize + voxelSize * 0.5;
                
                // Add edge positions for this voxel
                const edgePositions = edges.attributes.position.array;
                for (let i = 0; i < edgePositions.length; i += 3) {
                    positions.push(edgePositions[i] + x);
                    positions.push(edgePositions[i + 1] + y);
                    positions.push(edgePositions[i + 2] + z);
                }
            }
            
            // Create new line segments with updated positions
            const outlineGeometry = new THREE.BufferGeometry();
            outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            
            this.selectionOutline = new THREE.LineSegments(outlineGeometry, oldMaterial);
            this.selectionOutline.renderOrder = 999;
            this.scene.add(this.selectionOutline);
            
            // Clean up temporary geometry
            boxGeometry.dispose();
            edges.dispose();
        }
        
        // Update gizmo position smoothly (not snapped)
        if (this.originalVoxels && this.originalVoxels.length > 0) {
            // Calculate the original center
            let sumX = 0, sumY = 0, sumZ = 0;
            for (const voxel of this.originalVoxels) {
                sumX += voxel.x;
                sumY += voxel.y;
                sumZ += voxel.z;
            }
            
            const voxelSize = this.voxelEngine.getVoxelSize();
            const originalCenter = new THREE.Vector3(
                (sumX / this.originalVoxels.length) * voxelSize + voxelSize * 0.5,
                (sumY / this.originalVoxels.length) * voxelSize + voxelSize * 0.5,
                (sumZ / this.originalVoxels.length) * voxelSize + voxelSize * 0.5
            );
            
            // Add the unsnapped transform offset for smooth movement
            const smoothCenter = originalCenter.clone().add(this.transformOffset);
            
            // Apply rotation if in rotate mode
            if (this.transformMode === 'rotate') {
                // For rotation, use the preview center since rotation doesn't translate
                let rotSumX = 0, rotSumY = 0, rotSumZ = 0;
                for (const voxel of previewVoxels) {
                    rotSumX += voxel.x;
                    rotSumY += voxel.y;
                    rotSumZ += voxel.z;
                }
                const rotatedCenter = new THREE.Vector3(
                    (rotSumX / previewVoxels.length) * voxelSize + voxelSize * 0.5,
                    (rotSumY / previewVoxels.length) * voxelSize + voxelSize * 0.5,
                    (rotSumZ / previewVoxels.length) * voxelSize + voxelSize * 0.5
                );
                this.transformGizmo.setPosition(rotatedCenter);
            } else {
                // For translation, use smooth unsnapped position
                this.transformGizmo.setPosition(smoothCenter);
            }
        }
    }
    
    /**
     * Apply transformation on mouse release - this is when we actually modify voxels
     */
    private applyTransformOnRelease(): void {
        if (!this.transformMode || this.originalVoxels.length === 0) return;
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        
        // Calculate center for rotation
        let centerX = 0, centerY = 0, centerZ = 0;
        if (this.transformMode === 'rotate') {
            for (const voxel of this.originalVoxels) {
                centerX += voxel.x;
                centerY += voxel.y;
                centerZ += voxel.z;
            }
            centerX /= this.originalVoxels.length;
            centerY /= this.originalVoxels.length;
            centerZ /= this.originalVoxels.length;
        }
        
        // Calculate new positions first (without clearing anything)
        const newVoxels: SelectedVoxel[] = [];
        const positionsToCheck = new Set<string>();
        
        for (const voxel of this.originalVoxels) {
            let newX = voxel.x;
            let newY = voxel.y;
            let newZ = voxel.z;
            
            if (this.transformMode === 'rotate') {
                // Apply rotation around center
                const pos = new THREE.Vector3(
                    voxel.x - centerX,
                    voxel.y - centerY,
                    voxel.z - centerZ
                );
                pos.applyEuler(this.transformRotation);
                newX = Math.round(pos.x + centerX);
                newY = Math.round(pos.y + centerY);
                newZ = Math.round(pos.z + centerZ);
            }
            
            if (this.transformMode === 'move') {
                // Apply translation
                const offsetVoxels = {
                    x: Math.round(this.transformOffset.x / voxelSize),
                    y: Math.round(this.transformOffset.y / voxelSize),
                    z: Math.round(this.transformOffset.z / voxelSize)
                };
                
                newX += offsetVoxels.x;
                newY += offsetVoxels.y;
                newZ += offsetVoxels.z;
            }
            
            newVoxels.push({ x: newX, y: newY, z: newZ, type: voxel.type });
            positionsToCheck.add(`${newX},${newY},${newZ}`);
        }
        
        // Store any existing voxels that will be overwritten (but not our own)
        const overwrittenVoxels: { x: number; y: number; z: number; type: VoxelType }[] = [];
        for (const voxel of newVoxels) {
            const existingType = this.voxelEngine.getVoxel(voxel.x, voxel.y, voxel.z);
            // Check if there's a voxel here that's not one of our selected voxels
            const isOurVoxel = this.selectedVoxels.some(sv => 
                sv.x === voxel.x && sv.y === voxel.y && sv.z === voxel.z
            );
            
            if (existingType !== VoxelType.AIR && !isOurVoxel) {
                overwrittenVoxels.push({ x: voxel.x, y: voxel.y, z: voxel.z, type: existingType });
            }
        }
        
        // If duplicating (shift+drag), don't clear original voxels
        if (!this.isDuplicating) {
            // Clear only our original voxel positions
            for (const voxel of this.originalVoxels) {
                this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR);
            }
        }
        
        // Place voxels at new positions
        for (const voxel of newVoxels) {
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, voxel.type);
        }
        
        // Update the engine's visual representation
        this.voxelEngine.updateInstances();
        
        // Update selected voxels list
        this.selectedVoxels = newVoxels;
        
        // Update selection visuals
        this.updateSelectionOutline();
        this.showSelectedVoxels();
        
        // Update gizmo position to new center
        const center = this.getSelectionCenter();
        this.transformGizmo.setPosition(center);
        
        console.log(`Transform applied. ${overwrittenVoxels.length > 0 ? `Overwrote ${overwrittenVoxels.length} existing voxels.` : ''}`);
    }
    
    /**
     * Create ghost voxels for transformation preview
     */
    private createGhostVoxels(): void {
        if (this.ghostVoxels) {
            this.scene.remove(this.ghostVoxels);
            this.ghostVoxels.geometry.dispose();
            (this.ghostVoxels.material as THREE.Material).dispose();
        }
        
        if (this.originalVoxels.length === 0) return;
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        const geometry = new THREE.BoxGeometry(voxelSize * 0.98, voxelSize * 0.98, voxelSize * 0.98); // Slightly smaller to see gaps
        const material = new THREE.MeshBasicMaterial({
            color: 'rgb(150, 200, 255)',
            transparent: true,
            opacity: 0.6,  // More visible
            depthWrite: false,
            depthTest: true
        });
        
        this.ghostVoxels = new THREE.InstancedMesh(geometry, material, this.originalVoxels.length);
        this.ghostVoxels.renderOrder = 998;
        
        // Set initial positions
        this.updateGhostVoxels();
        
        this.scene.add(this.ghostVoxels);
    }
    
    /**
     * Update ghost voxel positions based on transformation
     */
    private updateGhostVoxels(): void {
        if (!this.ghostVoxels || !this.originalVoxels || this.originalVoxels.length === 0) return;
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        const matrix = new THREE.Matrix4();
        
        // Calculate center of selection for rotation (use original positions)
        let centerX = 0, centerY = 0, centerZ = 0;
        for (const voxel of this.originalVoxels) {
            centerX += voxel.x;
            centerY += voxel.y;
            centerZ += voxel.z;
        }
        centerX = (centerX / this.originalVoxels.length) * voxelSize + voxelSize * 0.5;
        centerY = (centerY / this.originalVoxels.length) * voxelSize + voxelSize * 0.5;
        centerZ = (centerZ / this.originalVoxels.length) * voxelSize + voxelSize * 0.5;
        
        // Update each ghost voxel (transform from original positions)
        for (let i = 0; i < this.originalVoxels.length; i++) {
            const voxel = this.originalVoxels[i];
            
            // Base position
            let x = voxel.x * voxelSize + voxelSize * 0.5;
            let y = voxel.y * voxelSize + voxelSize * 0.5;
            let z = voxel.z * voxelSize + voxelSize * 0.5;
            
            if (this.transformMode === 'rotate') {
                // Apply rotation around center
                const pos = new THREE.Vector3(x - centerX, y - centerY, z - centerZ);
                pos.applyEuler(this.transformRotation);
                x = pos.x + centerX;
                y = pos.y + centerY;
                z = pos.z + centerZ;
            }
            
            // Apply translation
            x += this.transformOffset.x;
            y += this.transformOffset.y;
            z += this.transformOffset.z;
            
            matrix.makeTranslation(x, y, z);
            this.ghostVoxels.setMatrixAt(i, matrix);
        }
        
        this.ghostVoxels.instanceMatrix.needsUpdate = true;
    }
    
    /**
     * Update transformation based on input
     */
    updateTransform(delta: THREE.Vector3, isRotation: boolean = false): void {
        if (!this.transformMode) return;
        
        if (isRotation && this.transformMode === 'rotate') {
            // Update rotation (snap to 90 degree increments)
            this.transformRotation.y += delta.y * 0.01;
            this.transformRotation.y = Math.round(this.transformRotation.y / (Math.PI / 2)) * (Math.PI / 2);
        } else if (!isRotation && this.transformMode === 'move') {
            // Update position (snap to voxel grid)
            const voxelSize = this.voxelEngine.getVoxelSize();
            this.transformOffset.add(delta);
            this.transformOffset.x = Math.round(this.transformOffset.x / voxelSize) * voxelSize;
            this.transformOffset.y = Math.round(this.transformOffset.y / voxelSize) * voxelSize;
            this.transformOffset.z = Math.round(this.transformOffset.z / voxelSize) * voxelSize;
            
            // Update gizmo position
            const center = this.getSelectionCenter();
            const newPos = center.clone().add(this.transformOffset);
            this.transformGizmo.setPosition(newPos);
        }
        
        this.updateGhostVoxels();
    }
    
    /**
     * Apply the current transformation
     */
    applyTransform(): void {
        if (!this.transformMode || this.selectedVoxels.length === 0) return;
        
        console.log(`Applying ${this.transformMode} transform. Rotation: ${this.transformRotation.x}, ${this.transformRotation.y}, ${this.transformRotation.z}`);
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        
        // Calculate new positions
        const newVoxels: SelectedVoxel[] = [];
        
        // Calculate center for rotation
        let centerX = 0, centerY = 0, centerZ = 0;
        if (this.transformMode === 'rotate') {
            for (const voxel of this.selectedVoxels) {
                centerX += voxel.x;
                centerY += voxel.y;
                centerZ += voxel.z;
            }
            centerX /= this.selectedVoxels.length;
            centerY /= this.selectedVoxels.length;
            centerZ /= this.selectedVoxels.length;
        }
        
        // Remove old voxels and calculate new positions
        for (const voxel of this.selectedVoxels) {
            // Remove old voxel
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR);
            
            // Calculate new position
            let newX = voxel.x;
            let newY = voxel.y;
            let newZ = voxel.z;
            
            if (this.transformMode === 'rotate') {
                // Apply rotation
                const pos = new THREE.Vector3(
                    voxel.x - centerX,
                    voxel.y - centerY,
                    voxel.z - centerZ
                );
                pos.applyEuler(this.transformRotation);
                newX = Math.round(pos.x + centerX);
                newY = Math.round(pos.y + centerY);
                newZ = Math.round(pos.z + centerZ);
            }
            
            if (this.transformMode === 'move') {
                // Apply translation
                const offsetVoxels = {
                    x: Math.round(this.transformOffset.x / voxelSize),
                    y: Math.round(this.transformOffset.y / voxelSize),
                    z: Math.round(this.transformOffset.z / voxelSize)
                };
                
                newX += offsetVoxels.x;
                newY += offsetVoxels.y;
                newZ += offsetVoxels.z;
            }
            
            newVoxels.push({ x: newX, y: newY, z: newZ, type: voxel.type });
        }
        
        // Place voxels at new positions
        for (const voxel of newVoxels) {
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, voxel.type);
        }
        
        // Update voxel engine
        this.voxelEngine.updateInstances();
        
        // Update selection to new positions
        this.selectedVoxels = newVoxels;
        this.updateSelectionOutline();
        
        // Clear transformation
        this.cancelTransform();
    }
    
    /**
     * Cancel current transformation
     */
    cancelTransform(): void {
        this.transformMode = null;
        this.transformOffset.set(0, 0, 0);
        this.transformRotation.set(0, 0, 0);
        
        if (this.ghostVoxels) {
            this.scene.remove(this.ghostVoxels);
            this.ghostVoxels.geometry.dispose();
            (this.ghostVoxels.material as THREE.Material).dispose();
            this.ghostVoxels = null;
        }
        
        // Show unified gizmo if still have selection
        if (this.selectedVoxels.length > 0) {
            const center = this.getSelectionCenter();
            this.transformGizmo.show(center);
        } else {
            this.transformGizmo.hide();
        }
    }
    
    /**
     * Delete all selected voxels
     */
    deleteSelectedVoxels(): void {
        if (this.selectedVoxels.length === 0) return;
        
        console.log(`Deleting ${this.selectedVoxels.length} selected voxels`);
        
        // Delete each selected voxel
        for (const voxel of this.selectedVoxels) {
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR);
        }
        
        // Update the engine's visual representation
        this.voxelEngine.updateInstances();
        
        // Clear the selection after deletion
        this.clearSelection();
    }
    
    /**
     * Clear selection
     */
    clearSelection(): void {
        this.selectedVoxels = [];
        
        if (this.selectionBox) {
            this.scene.remove(this.selectionBox);
            this.selectionBox.geometry.dispose();
            (this.selectionBox.material as THREE.Material).dispose();
            this.selectionBox = null;
        }
        
        if (this.selectionOutline) {
            this.scene.remove(this.selectionOutline);
            this.selectionOutline.geometry.dispose();
            (this.selectionOutline.material as THREE.Material).dispose();
            this.selectionOutline = null;
        }
        
        if (this.selectedVoxelsMesh) {
            this.scene.remove(this.selectedVoxelsMesh);
            this.selectedVoxelsMesh.geometry.dispose();
            (this.selectedVoxelsMesh.material as THREE.Material).dispose();
            this.selectedVoxelsMesh = null;
        }
        
        this.cancelTransform();
        this.transformGizmo.hide();
    }
    
    /**
     * Check if currently selecting
     */
    isInSelectionMode(): boolean {
        return this.isSelecting;
    }
    
    /**
     * Check if there are selected voxels
     */
    hasSelection(): boolean {
        return this.selectedVoxels.length > 0;
    }
    
    /**
     * Get current transform mode
     */
    getTransformMode(): 'move' | 'rotate' | null {
        return this.transformMode;
    }
    
    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.clearSelection();
        this.transformGizmo.dispose();
    }
}