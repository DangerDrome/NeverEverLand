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
    private previousSelection: SelectedVoxel[] = [];
    
    // Screen space selection
    private isScreenSpaceSelecting: boolean = false;
    private screenSelectionStart: { x: number; y: number } | null = null;
    private screenSelectionEnd: { x: number; y: number } | null = null;
    private screenSelectionBox: HTMLDivElement | null = null;
    
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
    
    // Animation state for rotation
    private animationStartTime: number = 0;
    private animationDuration: number = 300; // milliseconds - slower for smoother feel
    private animatingRotation: boolean = false;
    private previousSnappedRotation: THREE.Euler = new THREE.Euler();
    private targetSnappedRotation: THREE.Euler = new THREE.Euler();
    
    // Pivot voxel for rotation (the one that stays fixed)
    private pivotVoxel: { x: number; y: number; z: number } | null = null;
    
    // Click detection for single/double click
    private lastClickTime: number = 0;
    private lastClickedVoxel: { x: number; y: number; z: number } | null = null;
    private doubleClickThreshold: number = 300; // milliseconds
    
    // Store original voxel positions for real-time transformation
    private originalVoxels: SelectedVoxel[] = [];
    
    // Duplication state
    private isDuplicating: boolean = false;
    
    // Continuous voxel creation during shift-drag
    private lastCreatedPosition: { x: number; y: number; z: number } | null = null;
    
    // Adding to selection state
    private isAddingToSelection: boolean = false;
    
    // Clipboard for copy/paste
    private clipboard: Array<{ relX: number; relY: number; relZ: number; type: VoxelType }> | null = null;
    private clipboardCenter: { x: number; y: number; z: number } | null = null;
    
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
        // Store previous selection for undo
        const prevSelection = [...this.previousSelection];
        
        // Clear previous selection visually
        this.clearSelectionVisuals();
        
        // Add single voxel to selection
        this.selectedVoxels = [{ x, y, z, type }];
        
        // Record selection change
        this.voxelEngine.recordSelectionChange(prevSelection, this.selectedVoxels);
        this.previousSelection = [...this.selectedVoxels];
        
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
        this.transformGizmo.show(center, false); // No rotation for single voxel
        
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
            // Store previous selection for undo
            const prevSelection = [...this.previousSelection];
            
            // Add to selection
            this.selectedVoxels.push({ x, y, z, type });
            
            // Update visuals
            this.updateSelectionOutline();
            this.showSelectedVoxels();
            
            // Update gizmo position to new center
            if (this.selectedVoxels.length > 0) {
                const center = this.getSelectionCenter();
                this.transformGizmo.show(center, this.selectedVoxels.length > 1);
                
                // Record selection change
                this.voxelEngine.recordSelectionChange(prevSelection, this.selectedVoxels);
                this.previousSelection = [...this.selectedVoxels];
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
            this.clearSelection(false); // Don't record undo, we'll record the whole operation
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
            this.transformGizmo.show(center, this.selectedVoxels.length > 1);
            
            // Record selection change
            const prevSelection = addToExisting ? [...existingSelection].map(key => {
                const [x, y, z] = key.split(',').map(Number);
                return { x, y, z, type: this.voxelEngine.getVoxel(x, y, z) };
            }) : [];
            this.voxelEngine.recordSelectionChange(prevSelection, this.selectedVoxels);
            this.previousSelection = [...this.selectedVoxels];
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
            this.clearSelection(false); // Don't record undo here
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
            this.transformGizmo.show(center, this.selectedVoxels.length > 1);
            
            // Record selection change
            const prevSelection = this.isAddingToSelection ? [...this.previousSelection] : [];
            this.voxelEngine.recordSelectionChange(prevSelection, this.selectedVoxels);
            this.previousSelection = [...this.selectedVoxels];
        }
        
        console.log(`Selected ${this.selectedVoxels.length} voxels`);
    }
    
    /**
     * Get the center of selected voxels - snapped to nearest voxel position
     */
    private getSelectionCenter(): THREE.Vector3 {
        if (this.selectedVoxels.length === 0) {
            return new THREE.Vector3();
        }
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        
        // Calculate the average center in voxel coordinates
        let avgX = 0, avgY = 0, avgZ = 0;
        for (const voxel of this.selectedVoxels) {
            avgX += voxel.x;
            avgY += voxel.y;
            avgZ += voxel.z;
        }
        avgX /= this.selectedVoxels.length;
        avgY /= this.selectedVoxels.length;
        avgZ /= this.selectedVoxels.length;
        
        // Find the voxel closest to this average center
        let closestVoxel = this.selectedVoxels[0];
        let minDistance = Infinity;
        
        for (const voxel of this.selectedVoxels) {
            const dx = voxel.x - avgX;
            const dy = voxel.y - avgY;
            const dz = voxel.z - avgZ;
            const distance = dx * dx + dy * dy + dz * dz;
            
            if (distance < minDistance) {
                minDistance = distance;
                closestVoxel = voxel;
            }
        }
        
        // Return the world position of the closest voxel's center
        return new THREE.Vector3(
            closestVoxel.x * voxelSize + voxelSize * 0.5,
            closestVoxel.y * voxelSize + voxelSize * 0.5,
            closestVoxel.z * voxelSize + voxelSize * 0.5
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
                color: 'rgb(255, 255, 100)',  // Yellow
                transparent: true,
                opacity: 0.5,
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
            color: 'rgb(255, 255, 100)',  // Yellow
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
            color: 'rgb(255, 255, 100)',  // Yellow outline for selected voxels
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
            
            // Reset animation state
            this.animatingRotation = false;
            this.previousSnappedRotation.set(0, 0, 0);
            this.targetSnappedRotation.set(0, 0, 0);
            
            // Store original voxel positions for transformation
            this.originalVoxels = [...this.selectedVoxels];
            
            // Store if this is a duplication (shift+drag)
            this.isDuplicating = shiftKey;
            
            // Reset continuous creation tracking
            this.lastCreatedPosition = null;
            
            // Set the pivot voxel for rotation
            if (hit.operation === 'rotate') {
                // Calculate the average center in voxel coordinates
                let avgX = 0, avgY = 0, avgZ = 0;
                for (const voxel of this.selectedVoxels) {
                    avgX += voxel.x;
                    avgY += voxel.y;
                    avgZ += voxel.z;
                }
                avgX /= this.selectedVoxels.length;
                avgY /= this.selectedVoxels.length;
                avgZ /= this.selectedVoxels.length;
                
                // Find the voxel closest to this average center
                let closestVoxel = this.selectedVoxels[0];
                let minDistance = Infinity;
                
                for (const voxel of this.selectedVoxels) {
                    const dx = voxel.x - avgX;
                    const dy = voxel.y - avgY;
                    const dz = voxel.z - avgZ;
                    const distance = dx * dx + dy * dy + dz * dz;
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestVoxel = voxel;
                    }
                }
                
                // Set the pivot voxel
                this.pivotVoxel = { x: closestVoxel.x, y: closestVoxel.y, z: closestVoxel.z };
                console.log(`Pivot voxel set to: (${this.pivotVoxel.x}, ${this.pivotVoxel.y}, ${this.pivotVoxel.z})`);
            }
            
            // Hide original voxels while moving (unless duplicating)
            // For continuous creation with shift-drag, keep the original voxels visible
            if (!this.isDuplicating) {
                for (const voxel of this.selectedVoxels) {
                    // Don't trigger snapshot for temporary removal
                    this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR, false);
                }
                this.voxelEngine.updateInstances();
            }
            
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
            
            // If shift is held (duplicating), create voxels along the path
            if (this.isDuplicating) {
                // Calculate current snapped position
                const offsetVoxels = {
                    x: Math.round(this.transformOffset.x / voxelSize),
                    y: Math.round(this.transformOffset.y / voxelSize),
                    z: Math.round(this.transformOffset.z / voxelSize)
                };
                
                // Check if we've moved to a new grid position (use first voxel as reference)
                if (this.originalVoxels.length > 0) {
                    const firstVoxelPos = {
                        x: this.originalVoxels[0].x + offsetVoxels.x,
                        y: this.originalVoxels[0].y + offsetVoxels.y,
                        z: this.originalVoxels[0].z + offsetVoxels.z
                    };
                    
                    if (!this.lastCreatedPosition || 
                        firstVoxelPos.x !== this.lastCreatedPosition.x ||
                        firstVoxelPos.y !== this.lastCreatedPosition.y ||
                        firstVoxelPos.z !== this.lastCreatedPosition.z) {
                        
                        // Create voxels for ALL selected voxels at their new positions
                        for (let i = 0; i < this.originalVoxels.length; i++) {
                            const voxel = this.originalVoxels[i];
                            const currentPos = {
                                x: voxel.x + offsetVoxels.x,
                                y: voxel.y + offsetVoxels.y,
                                z: voxel.z + offsetVoxels.z
                            };
                            
                            // Create voxel at the new position with its original type
                            this.voxelEngine.setVoxel(currentPos.x, currentPos.y, currentPos.z, voxel.type, true);
                        }
                        
                        // Update the last created position reference
                        this.lastCreatedPosition = { ...firstVoxelPos };
                        
                        // Update instances immediately for visual feedback
                        this.voxelEngine.updateInstances();
                    }
                }
            }
            
            // Apply transformation in real-time
            // This will update the gizmo position via updateSelectionPreview
            this.applyTransformRealtime();
        } else if (operation === 'rotate') {
            // Debug: log raw delta
            console.log(`Rotation delta: x=${delta.x.toFixed(4)}, y=${delta.y.toFixed(4)}, z=${delta.z.toFixed(4)}`);
            
            // Update rotation incrementally with clamping to ±360 degrees
            const maxRotation = 2 * Math.PI; // 360 degrees
            
            // Apply delta only if it doesn't exceed the limit
            const clampRotation = (current: number, delta: number): number => {
                const newValue = current + delta;
                return Math.max(-maxRotation, Math.min(maxRotation, newValue));
            };
            
            // Apply rotation with resistance near snap points
            const snapAngleInterval = Math.PI / 2; // 90 degrees
            const resistanceRange = Math.PI / 36; // 5 degrees
            const resistanceStrength = 0.3; // How much to slow down near snap points
            
            // Calculate resistance factor for each axis
            const getResistance = (currentAngle: number): number => {
                const nearestSnap = Math.round(currentAngle / snapAngleInterval) * snapAngleInterval;
                const distance = Math.abs(currentAngle - nearestSnap);
                
                if (distance < resistanceRange) {
                    // Apply resistance (slow down movement near snap points)
                    return 1.0 - (resistanceStrength * (1.0 - distance / resistanceRange));
                }
                return 1.0;
            };
            
            // Apply rotation with resistance
            this.transformRotation.x = clampRotation(this.transformRotation.x, delta.x * getResistance(this.transformRotation.x));
            this.transformRotation.y = clampRotation(this.transformRotation.y, delta.y * getResistance(this.transformRotation.y));
            this.transformRotation.z = clampRotation(this.transformRotation.z, delta.z * getResistance(this.transformRotation.z));
            
            console.log(`Raw rotation: X=${(this.transformRotation.x * 180 / Math.PI).toFixed(1)}°, Y=${(this.transformRotation.y * 180 / Math.PI).toFixed(1)}°, Z=${(this.transformRotation.z * 180 / Math.PI).toFixed(1)}°`);
            
            // Calculate snapped positions for tracking
            const snapAngle = Math.PI / 2; // 90 degrees
            const snappedX = Math.round(this.transformRotation.x / snapAngle) * snapAngle;
            const snappedY = Math.round(this.transformRotation.y / snapAngle) * snapAngle;
            const snappedZ = Math.round(this.transformRotation.z / snapAngle) * snapAngle;
            
            // Show preview with CURRENT rotation for smooth animation
            // But we'll show the positions where they'll snap to
            const currentRotation = new THREE.Euler(
                this.transformRotation.x,
                this.transformRotation.y,
                this.transformRotation.z
            );
            
            // Apply the current rotation for smooth animation
            this.applyTransformRealtimeWithRotation(currentRotation);
            
            // Always update the target snap position for when we release
            this.targetSnappedRotation.set(snappedX, snappedY, snappedZ);
            
            // Log when we cross snap boundaries
            const prevSnappedX = Math.round(prevRotation.x / snapAngle) * snapAngle;
            const prevSnappedY = Math.round(prevRotation.y / snapAngle) * snapAngle;
            const prevSnappedZ = Math.round(prevRotation.z / snapAngle) * snapAngle;
            
            if (snappedX !== prevSnappedX || snappedY !== prevSnappedY || snappedZ !== prevSnappedZ) {
                console.log(`Will snap to: X=${(snappedX * 180 / Math.PI).toFixed(0)}°, Y=${(snappedY * 180 / Math.PI).toFixed(0)}°, Z=${(snappedZ * 180 / Math.PI).toFixed(0)}°`);
            }
        }
    }
    
    /**
     * Animate rotation transition to snap point
     */
    private animateRotation(): void {
        if (!this.animatingRotation) return;
        
        const currentTime = Date.now();
        const elapsed = currentTime - this.animationStartTime;
        const progress = Math.min(elapsed / this.animationDuration, 1);
        
        // Use easing function for smooth animation
        const easeProgress = this.easeInOutCubic(progress);
        
        // Interpolate between previous and target rotation
        const animatedRotation = new THREE.Euler(
            this.previousSnappedRotation.x + (this.targetSnappedRotation.x - this.previousSnappedRotation.x) * easeProgress,
            this.previousSnappedRotation.y + (this.targetSnappedRotation.y - this.previousSnappedRotation.y) * easeProgress,
            this.previousSnappedRotation.z + (this.targetSnappedRotation.z - this.previousSnappedRotation.z) * easeProgress
        );
        
        // Apply the animated rotation
        this.applyTransformRealtimeWithRotation(animatedRotation);
        
        // Don't update the rotation indicator during animation
        // The pie is already being updated by the dragging system in TransformGizmo
        // which uses the raw angle. Updating it here with the snapped angle
        // causes flicker between raw and snapped positions.
        
        if (progress < 1) {
            // Continue animation
            requestAnimationFrame(() => this.animateRotation());
        } else {
            // Animation complete - apply final transformation with grid snapping
            this.animatingRotation = false;
            
            // Set the final rotation to the snapped target
            this.transformRotation.copy(this.targetSnappedRotation);
            
            // Apply the final transformation which will snap to grid
            this.applyTransformOnRelease();
            
            // Now reset everything after transformation is complete
            this.transformMode = null;
            this.transformOffset.set(0, 0, 0);
            this.transformRotation.set(0, 0, 0);
            this.originalVoxels = [];
            this.isDuplicating = false;
            this.lastCreatedPosition = null;
            this.previousSnappedRotation.set(0, 0, 0);
            this.targetSnappedRotation.set(0, 0, 0);
            this.pivotVoxel = null;
        }
    }
    
    /**
     * Easing function for smooth animation
     */
    private easeInOutCubic(t: number): number {
        // Smoother ease-in-out quartic function
        return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    }
    
    /**
     * End gizmo dragging
     */
    handleGizmoMouseUp(): void {
        if (this.transformGizmo.isDraggingGizmo()) {
            const operation = this.transformGizmo.getCurrentOperation();
            this.transformGizmo.endDrag();
            
            // For rotation, animate to snap position on release
            if (operation === 'rotate' && (Math.abs(this.transformRotation.x) > 0.01 || 
                Math.abs(this.transformRotation.y) > 0.01 || 
                Math.abs(this.transformRotation.z) > 0.01)) {
                
                // Start animation from current rotation to snapped target
                this.previousSnappedRotation.copy(this.transformRotation);
                this.animationStartTime = Date.now();
                this.animatingRotation = true;
                
                // Start animation loop to snap position
                this.animateRotation();
            } else {
                // For move operations or no significant transformation
                if (this.transformMode && (this.transformOffset.length() > 0.01 || 
                    Math.abs(this.transformRotation.x) > 0.01 || 
                    Math.abs(this.transformRotation.y) > 0.01 || 
                    Math.abs(this.transformRotation.z) > 0.01)) {
                    this.applyTransformOnRelease();
                } else {
                    // No significant transformation, restore original voxels
                    if (!this.isDuplicating && this.originalVoxels.length > 0) {
                        for (const voxel of this.originalVoxels) {
                            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, voxel.type, false);
                        }
                        this.voxelEngine.updateInstances();
                    }
                }
            }
            
            // Only reset if we're not animating
            if (!this.animatingRotation) {
                // Reset for next transformation
                this.transformMode = null;
                this.transformOffset.set(0, 0, 0);
                this.transformRotation.set(0, 0, 0);
                this.originalVoxels = [];
                this.isDuplicating = false;
                this.lastCreatedPosition = null;
                this.previousSnappedRotation.set(0, 0, 0);
                this.targetSnappedRotation.set(0, 0, 0);
                this.pivotVoxel = null;
            }
            
            // Keep the same transparency as during selection (no need to change)
            if (this.selectedVoxelsMesh) {
                const material = this.selectedVoxelsMesh.material as THREE.MeshBasicMaterial;
                material.transparent = true;
                material.opacity = 0.5;
                material.depthWrite = false;
            }
        }
    }
    
    /**
     * Apply transformation in real-time with specific rotation (for animation)
     */
    private applyTransformRealtimeWithRotation(rotation: THREE.Euler): void {
        if (!this.transformMode || this.originalVoxels.length === 0) return;
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        
        // Use pivot voxel coordinates as rotation center
        let centerX = 0, centerY = 0, centerZ = 0;
        if (this.transformMode === 'rotate' && this.pivotVoxel) {
            centerX = this.pivotVoxel.x;
            centerY = this.pivotVoxel.y;
            centerZ = this.pivotVoxel.z;
        }
        
        // Calculate new positions for PREVIEW only (don't modify actual voxels)
        const previewVoxels: SelectedVoxel[] = [];
        for (const voxel of this.originalVoxels) {
            let newX = voxel.x;
            let newY = voxel.y;
            let newZ = voxel.z;
            
            if (this.transformMode === 'rotate') {
                // Check if this is the pivot voxel - if so, don't rotate it
                if (this.pivotVoxel && 
                    voxel.x === this.pivotVoxel.x && 
                    voxel.y === this.pivotVoxel.y && 
                    voxel.z === this.pivotVoxel.z) {
                    // Keep pivot voxel at its original position
                    newX = voxel.x;
                    newY = voxel.y;
                    newZ = voxel.z;
                } else {
                    // Apply rotation around pivot for other voxels
                    const pos = new THREE.Vector3(
                        voxel.x - centerX,
                        voxel.y - centerY,
                        voxel.z - centerZ
                    );
                    pos.applyEuler(rotation);
                    // Don't round during rotation - keep smooth animation
                    newX = pos.x + centerX;
                    newY = pos.y + centerY;
                    newZ = pos.z + centerZ;
                }
            }
            
            previewVoxels.push({ x: newX, y: newY, z: newZ, type: voxel.type });
        }
        
        // Update ONLY the selection visual highlight to show new positions
        // Don't touch actual voxels
        this.updateSelectionPreviewAnimated(previewVoxels, rotation);
    }
    
    /**
     * Apply transformation in real-time during dragging (visual only)
     */
    private applyTransformRealtime(): void {
        if (!this.transformMode || this.originalVoxels.length === 0) return;
        
        const voxelSize = this.voxelEngine.getVoxelSize();
        
        // Use pivot voxel coordinates as rotation center
        let centerX = 0, centerY = 0, centerZ = 0;
        if (this.transformMode === 'rotate' && this.pivotVoxel) {
            centerX = this.pivotVoxel.x;
            centerY = this.pivotVoxel.y;
            centerZ = this.pivotVoxel.z;
        }
        
        // Calculate new positions for PREVIEW only (don't modify actual voxels)
        const previewVoxels: SelectedVoxel[] = [];
        for (const voxel of this.originalVoxels) {
            let newX = voxel.x;
            let newY = voxel.y;
            let newZ = voxel.z;
            
            if (this.transformMode === 'rotate') {
                // Apply rotation around center using snapped values (same math as final placement)
                const snapAngle = Math.PI / 2; // 90 degrees
                const snappedRotation = new THREE.Euler(
                    Math.round(this.transformRotation.x / snapAngle) * snapAngle,
                    Math.round(this.transformRotation.y / snapAngle) * snapAngle,
                    Math.round(this.transformRotation.z / snapAngle) * snapAngle
                );
                
                const pos = new THREE.Vector3(
                    voxel.x - centerX,
                    voxel.y - centerY,
                    voxel.z - centerZ
                );
                pos.applyEuler(snappedRotation);
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
     * Update the visual preview with animated rotation
     */
    private updateSelectionPreviewAnimated(previewVoxels: SelectedVoxel[], animatedRotation: THREE.Euler): void {
        if (!this.selectedVoxelsMesh) return;
        
        // Keep the same transparent overlay appearance during dragging
        const material = this.selectedVoxelsMesh.material as THREE.MeshBasicMaterial;
        material.color.set('rgb(255, 255, 100)'); // Yellow for rotation
        material.transparent = true;
        material.opacity = 0.5;
        material.depthWrite = false;
        
        // Update the positions of the selection preview mesh
        const voxelSize = this.voxelEngine.getVoxelSize();
        const matrix = new THREE.Matrix4();
        
        // Use pivot voxel as center for rotation (consistent with final placement)
        let centerX = 0, centerY = 0, centerZ = 0;
        if (this.pivotVoxel) {
            centerX = this.pivotVoxel.x;
            centerY = this.pivotVoxel.y;
            centerZ = this.pivotVoxel.z;
        } else if (this.originalVoxels.length > 0) {
            // Fallback to average if no pivot (shouldn't happen during rotation)
            for (const voxel of this.originalVoxels) {
                centerX += voxel.x;
                centerY += voxel.y;
                centerZ += voxel.z;
            }
            centerX /= this.originalVoxels.length;
            centerY /= this.originalVoxels.length;
            centerZ /= this.originalVoxels.length;
        }
        
        for (let i = 0; i < previewVoxels.length && i < this.originalVoxels.length; i++) {
            // Get original position IN VOXEL COORDINATES
            const originalVoxel = this.originalVoxels[i];
            
            let smoothX, smoothY, smoothZ;
            
            // Check if this is the pivot voxel - if so, don't rotate it
            if (this.pivotVoxel && 
                originalVoxel.x === this.pivotVoxel.x && 
                originalVoxel.y === this.pivotVoxel.y && 
                originalVoxel.z === this.pivotVoxel.z) {
                // Keep pivot voxel at its original position
                smoothX = originalVoxel.x;
                smoothY = originalVoxel.y;
                smoothZ = originalVoxel.z;
            } else {
                // Apply rotation for non-pivot voxels
                const originalPos = new THREE.Vector3(
                    originalVoxel.x - centerX,
                    originalVoxel.y - centerY,
                    originalVoxel.z - centerZ
                );
                
                // Apply animated rotation
                originalPos.applyEuler(animatedRotation);
                
                // Don't round during animation - keep smooth positions
                smoothX = originalPos.x + centerX;
                smoothY = originalPos.y + centerY;
                smoothZ = originalPos.z + centerZ;
            }
            
            // Convert to world coordinates for display (smooth, not snapped)
            const worldX = smoothX * voxelSize + voxelSize * 0.5;
            const worldY = smoothY * voxelSize + voxelSize * 0.5;
            const worldZ = smoothZ * voxelSize + voxelSize * 0.5;
            
            // Create matrix with smooth world position
            matrix.makeTranslation(worldX, worldY, worldZ);
            
            this.selectedVoxelsMesh.setMatrixAt(i, matrix);
        }
        
        this.selectedVoxelsMesh.instanceMatrix.needsUpdate = true;
        
        // Update outline to match animated positions
        this.updateSelectionOutlineAnimated(animatedRotation);
    }
    
    /**
     * Update selection outline with animated rotation
     */
    private updateSelectionOutlineAnimated(animatedRotation: THREE.Euler): void {
        if (!this.selectionOutline || !this.originalVoxels || this.originalVoxels.length === 0) return;
        
        // Remove old outline
        this.scene.remove(this.selectionOutline);
        const oldMaterial = (this.selectionOutline.material as THREE.Material);
        this.selectionOutline.geometry.dispose();
        
        // Create new outline geometry for animated positions
        const voxelSize = this.voxelEngine.getVoxelSize();
        const boxGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
        const edges = new THREE.EdgesGeometry(boxGeometry);
        
        // Use pivot voxel as center for rotation (consistent with other methods)
        let centerX = 0, centerY = 0, centerZ = 0;
        if (this.pivotVoxel) {
            centerX = this.pivotVoxel.x;
            centerY = this.pivotVoxel.y;
            centerZ = this.pivotVoxel.z;
        } else {
            // Fallback to average if no pivot
            for (const voxel of this.originalVoxels) {
                centerX += voxel.x;
                centerY += voxel.y;
                centerZ += voxel.z;
            }
            centerX /= this.originalVoxels.length;
            centerY /= this.originalVoxels.length;
            centerZ /= this.originalVoxels.length;
        }
        
        const positions: number[] = [];
        
        for (const voxel of this.originalVoxels) {
            let smoothX, smoothY, smoothZ;
            
            // Check if this is the pivot voxel - if so, don't rotate it
            if (this.pivotVoxel && 
                voxel.x === this.pivotVoxel.x && 
                voxel.y === this.pivotVoxel.y && 
                voxel.z === this.pivotVoxel.z) {
                // Keep pivot voxel at its original position
                smoothX = voxel.x;
                smoothY = voxel.y;
                smoothZ = voxel.z;
            } else {
                // Apply rotation for non-pivot voxels
                const originalPos = new THREE.Vector3(
                    voxel.x - centerX,
                    voxel.y - centerY,
                    voxel.z - centerZ
                );
                
                // Apply animated rotation
                originalPos.applyEuler(animatedRotation);
                
                // Don't round during animation - keep smooth positions
                smoothX = originalPos.x + centerX;
                smoothY = originalPos.y + centerY;
                smoothZ = originalPos.z + centerZ;
            }
            
            // Convert to world coordinates for display (smooth, not snapped)
            const worldX = smoothX * voxelSize + voxelSize * 0.5;
            const worldY = smoothY * voxelSize + voxelSize * 0.5;
            const worldZ = smoothZ * voxelSize + voxelSize * 0.5;
            
            // Add edge positions for this voxel
            const edgePositions = edges.attributes.position.array;
            for (let i = 0; i < edgePositions.length; i += 3) {
                positions.push(edgePositions[i] + worldX);
                positions.push(edgePositions[i + 1] + worldY);
                positions.push(edgePositions[i + 2] + worldZ);
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
    
    /**
     * Update the visual preview of where selected voxels will be placed
     */
    private updateSelectionPreview(previewVoxels: SelectedVoxel[]): void {
        if (!this.selectedVoxelsMesh) return;
        
        // Always show preview, even during shift-drag
        this.selectedVoxelsMesh.visible = true;
        
        // Keep the same transparent overlay appearance during dragging
        const material = this.selectedVoxelsMesh.material as THREE.MeshBasicMaterial;
        if (this.isDuplicating) {
            material.color.set('rgb(150, 255, 150)'); // Lighter green for duplication
        } else {
            material.color.set('rgb(255, 255, 100)'); // Yellow for normal move
        }
        // Keep transparent overlay appearance (don't make solid)
        material.transparent = true;
        material.opacity = 0.5;
        material.depthWrite = false;
        
        // Update the positions of the selection preview mesh
        const voxelSize = this.voxelEngine.getVoxelSize();
        const matrix = new THREE.Matrix4();
        
        for (let i = 0; i < previewVoxels.length; i++) {
            const voxel = previewVoxels[i];
            // The preview voxels already have the correct positions calculated
            // Just convert to world coordinates for display
            const worldPos = new THREE.Vector3(
                voxel.x * voxelSize + voxelSize * 0.5,
                voxel.y * voxelSize + voxelSize * 0.5,
                voxel.z * voxelSize + voxelSize * 0.5
            );
            
            matrix.makeTranslation(worldPos.x, worldPos.y, worldPos.z);
            
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
            const voxelSize = this.voxelEngine.getVoxelSize();
            let originalCenter: THREE.Vector3;
            
            // For rotation, use pivot voxel as center
            if (this.transformMode === 'rotate' && this.pivotVoxel) {
                originalCenter = new THREE.Vector3(
                    this.pivotVoxel.x * voxelSize + voxelSize * 0.5,
                    this.pivotVoxel.y * voxelSize + voxelSize * 0.5,
                    this.pivotVoxel.z * voxelSize + voxelSize * 0.5
                );
            } else {
                // For translation or if no pivot, use average center
                let sumX = 0, sumY = 0, sumZ = 0;
                for (const voxel of this.originalVoxels) {
                    sumX += voxel.x;
                    sumY += voxel.y;
                    sumZ += voxel.z;
                }
                originalCenter = new THREE.Vector3(
                    (sumX / this.originalVoxels.length) * voxelSize + voxelSize * 0.5,
                    (sumY / this.originalVoxels.length) * voxelSize + voxelSize * 0.5,
                    (sumZ / this.originalVoxels.length) * voxelSize + voxelSize * 0.5
                );
            }
            
            // Add the unsnapped transform offset for smooth movement
            const smoothCenter = originalCenter.clone().add(this.transformOffset);
            
            // Apply rotation if in rotate mode
            if (this.transformMode === 'rotate') {
                // For rotation, keep the gizmo at the original center
                // Rotation happens around this fixed point, so the gizmo shouldn't move
                this.transformGizmo.setPosition(originalCenter);
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
        
        // Snap rotation to 90 degrees for final application
        const snapAngle = Math.PI / 2; // 90 degrees
        
        // Always use the current transformRotation which should already be set to the target
        const snappedRotation = new THREE.Euler(
            Math.round(this.transformRotation.x / snapAngle) * snapAngle,
            Math.round(this.transformRotation.y / snapAngle) * snapAngle,
            Math.round(this.transformRotation.z / snapAngle) * snapAngle
        );
        
        if (this.transformMode === 'rotate') {
            console.log(`Final rotation: X=${(snappedRotation.x * 180 / Math.PI).toFixed(0)}°, Y=${(snappedRotation.y * 180 / Math.PI).toFixed(0)}°, Z=${(snappedRotation.z * 180 / Math.PI).toFixed(0)}°`);
        }
        
        // Use pivot voxel as rotation center
        let centerX = 0, centerY = 0, centerZ = 0;
        if (this.transformMode === 'rotate' && this.pivotVoxel) {
            centerX = this.pivotVoxel.x;
            centerY = this.pivotVoxel.y;
            centerZ = this.pivotVoxel.z;
        }
        
        // Calculate new positions first (without clearing anything)
        const newVoxels: SelectedVoxel[] = [];
        const positionsToCheck = new Set<string>();
        
        console.log(`Applying transform: ${this.originalVoxels.length} voxels, mode=${this.transformMode}`);
        
        for (const voxel of this.originalVoxels) {
            let newX = voxel.x;
            let newY = voxel.y;
            let newZ = voxel.z;
            
            if (this.transformMode === 'rotate') {
                // Check if this is the pivot voxel - if so, don't rotate it
                if (this.pivotVoxel && 
                    voxel.x === this.pivotVoxel.x && 
                    voxel.y === this.pivotVoxel.y && 
                    voxel.z === this.pivotVoxel.z) {
                    // Keep pivot voxel at its original position
                    newX = voxel.x;
                    newY = voxel.y;
                    newZ = voxel.z;
                    console.log(`Pivot voxel: (${voxel.x},${voxel.y},${voxel.z}) stays fixed`);
                } else {
                    // Apply rotation around pivot for other voxels
                    const pos = new THREE.Vector3(
                        voxel.x - centerX,
                        voxel.y - centerY,
                        voxel.z - centerZ
                    );
                    pos.applyEuler(snappedRotation);
                    newX = Math.round(pos.x + centerX);
                    newY = Math.round(pos.y + centerY);
                    newZ = Math.round(pos.z + centerZ);
                    
                    console.log(`Rotated voxel: (${voxel.x},${voxel.y},${voxel.z}) -> (${newX},${newY},${newZ})`);
                }
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
        
        // Simple approach: just clear old positions and place at new positions
        // The snapshot will capture the complete state change
        
        if (!this.isDuplicating) {
            // Clear original positions (they were already temporarily hidden)
            for (const voxel of this.originalVoxels) {
                // Check if this position will be occupied by a new voxel
                const willBeOccupied = newVoxels.some(nv => 
                    nv.x === voxel.x && nv.y === voxel.y && nv.z === voxel.z
                );
                
                // Keep it cleared if not occupied by new position
                if (!willBeOccupied) {
                    this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR, false);
                }
            }
        }
        
        // Place voxels at new positions
        // Skip this if we're duplicating with continuous creation (shift-drag move)
        // since we've already been creating voxels along the path
        if (!(this.isDuplicating && this.transformMode === 'move')) {
            for (const voxel of newVoxels) {
                // Place voxels - this will trigger snapshot
                this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, voxel.type, true);
            }
        }
        
        // Update the engine's visual representation
        this.voxelEngine.updateInstances();
        
        // Update selection for snapshot
        this.voxelEngine.recordSelectionChange(this.originalVoxels, newVoxels);
        
        // Force immediate snapshot for transform operation
        this.voxelEngine.finalizePendingOperations();
        
        // Update selected voxels list
        // Always keep the selection on the new voxels, even when duplicating
        this.selectedVoxels = newVoxels;
        this.previousSelection = [...newVoxels];
        
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
            color: 0x88ff88,  // Bright green
            transparent: true,
            opacity: 0.8,  // More opaque for better visibility
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide  // Render both sides
        });
        
        this.ghostVoxels = new THREE.InstancedMesh(geometry, material, this.originalVoxels.length);
        this.ghostVoxels.renderOrder = 1000;  // Higher render order to ensure it's on top
        this.ghostVoxels.frustumCulled = false;  // Always render
        
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
            // Remove old voxel with undo recording
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR, true);
            
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
            // Record undo for placing voxels
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, voxel.type, true);
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
        // Restore original voxels if we were moving (not duplicating)
        if (this.transformMode && !this.isDuplicating && this.originalVoxels.length > 0) {
            for (const voxel of this.originalVoxels) {
                this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, voxel.type, false);
            }
            this.voxelEngine.updateInstances();
        }
        
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
            this.transformGizmo.show(center, this.selectedVoxels.length > 1);
            
            // Keep consistent transparency after canceling
            if (this.selectedVoxelsMesh) {
                const material = this.selectedVoxelsMesh.material as THREE.MeshBasicMaterial;
                material.transparent = true;
                material.opacity = 0.5;
                material.depthWrite = false;
            }
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
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR, true);
        }
        
        // Update the engine's visual representation
        this.voxelEngine.updateInstances();
        
        // Force immediate snapshot
        this.voxelEngine.finalizePendingOperations();
        
        // Clear the selection after deletion
        this.clearSelection();
    }
    
    /**
     * Select all voxels in the world
     */
    selectAll(): void {
        // Record previous selection for undo
        const prevSelection = [...this.selectedVoxels];
        
        // Get all voxels from the engine
        const allVoxels = this.voxelEngine.getAllVoxels();
        
        // Convert to SelectedVoxel format
        this.selectedVoxels = allVoxels.map((voxel: { x: number; y: number; z: number; type: VoxelType }) => ({
            x: voxel.x,
            y: voxel.y,
            z: voxel.z,
            type: voxel.type
        }));
        
        // Record selection change for undo/redo
        this.voxelEngine.recordSelectionChange(prevSelection, this.selectedVoxels);
        this.previousSelection = [...this.selectedVoxels];
        
        // Update visual selection
        this.updateSelectionOutline();
        this.showSelectedVoxels();
        
        // Show gizmo at selection center if voxels were selected
        if (this.selectedVoxels.length > 0) {
            const center = this.getSelectionCenter();
            this.transformGizmo.show(center, this.selectedVoxels.length > 1);
        }
        
        console.log(`Selected all ${this.selectedVoxels.length} voxels`);
    }
    
    /**
     * Clear all selection (select none)
     */
    selectNone(): void {
        if (this.selectedVoxels.length === 0) return;
        
        // Record previous selection for undo
        const prevSelection = [...this.selectedVoxels];
        
        // Clear selection
        this.selectedVoxels = [];
        
        // Record selection change for undo/redo
        this.voxelEngine.recordSelectionChange(prevSelection, this.selectedVoxels);
        this.previousSelection = [];
        
        // Clear visuals
        this.clearSelectionVisuals();
        
        console.log('Cleared selection');
    }
    
    /**
     * Invert the current selection
     */
    invertSelection(): void {
        // Get all voxels
        const allVoxels = this.voxelEngine.getAllVoxels();
        
        // Record previous selection for undo
        const prevSelection = [...this.selectedVoxels];
        
        // Create a set of currently selected voxel keys for efficient lookup
        const selectedKeys = new Set(
            this.selectedVoxels.map(v => `${v.x},${v.y},${v.z}`)
        );
        
        // Filter to get unselected voxels
        const invertedSelection = allVoxels.filter((voxel: { x: number; y: number; z: number; type: VoxelType }) => 
            !selectedKeys.has(`${voxel.x},${voxel.y},${voxel.z}`)
        );
        
        // Update selection
        this.selectedVoxels = invertedSelection.map((voxel: { x: number; y: number; z: number; type: VoxelType }) => ({
            x: voxel.x,
            y: voxel.y,
            z: voxel.z,
            type: voxel.type
        }));
        
        // Record selection change for undo/redo
        this.voxelEngine.recordSelectionChange(prevSelection, this.selectedVoxels);
        this.previousSelection = [...this.selectedVoxels];
        
        // Update visual selection
        this.updateSelectionOutline();
        this.showSelectedVoxels();
        
        // Show gizmo at selection center if voxels were selected
        if (this.selectedVoxels.length > 0) {
            const center = this.getSelectionCenter();
            this.transformGizmo.show(center, this.selectedVoxels.length > 1);
        }
        
        console.log(`Inverted selection: ${this.selectedVoxels.length} voxels selected`);
    }
    
    /**
     * Copy selected voxels to clipboard
     */
    copySelection(): void {
        if (this.selectedVoxels.length === 0) {
            console.log('No voxels selected to copy');
            return;
        }
        
        // Calculate center of selection
        let centerX = 0, centerY = 0, centerZ = 0;
        for (const voxel of this.selectedVoxels) {
            centerX += voxel.x;
            centerY += voxel.y;
            centerZ += voxel.z;
        }
        centerX = Math.floor(centerX / this.selectedVoxels.length);
        centerY = Math.floor(centerY / this.selectedVoxels.length);
        centerZ = Math.floor(centerZ / this.selectedVoxels.length);
        
        // Store relative positions
        this.clipboard = this.selectedVoxels.map(voxel => ({
            relX: voxel.x - centerX,
            relY: voxel.y - centerY,
            relZ: voxel.z - centerZ,
            type: voxel.type
        }));
        
        this.clipboardCenter = { x: centerX, y: centerY, z: centerZ };
        
        console.log(`Copied ${this.clipboard.length} voxels to clipboard`);
    }
    
    /**
     * Paste voxels from clipboard at mouse position
     */
    pasteSelection(worldPos?: THREE.Vector3): void {
        if (!this.clipboard || this.clipboard.length === 0) {
            console.log('Nothing in clipboard to paste');
            return;
        }
        
        // Determine paste position
        let pasteX = 0, pasteY = 0, pasteZ = 0;
        const voxelSize = this.voxelEngine.getVoxelSize();
        
        if (worldPos) {
            // Use provided world position (mouse position)
            pasteX = Math.floor(worldPos.x / voxelSize);
            pasteY = Math.floor(worldPos.y / voxelSize);
            pasteZ = Math.floor(worldPos.z / voxelSize);
        } else if (this.selectedVoxels.length > 0) {
            // Paste relative to current selection center
            const center = this.getSelectionCenter();
            pasteX = Math.floor(center.x / voxelSize);
            pasteY = Math.floor(center.y / voxelSize);
            pasteZ = Math.floor(center.z / voxelSize);
        } else if (this.clipboardCenter) {
            // Paste at original position offset by 2 voxels
            pasteX = this.clipboardCenter.x + 2;
            pasteY = this.clipboardCenter.y;
            pasteZ = this.clipboardCenter.z + 2;
        }
        
        // Record previous selection for undo
        const prevSelection = [...this.selectedVoxels];
        
        // Place voxels and build new selection
        const newSelection: SelectedVoxel[] = [];
        for (const clipVoxel of this.clipboard) {
            const x = pasteX + clipVoxel.relX;
            const y = pasteY + clipVoxel.relY;
            const z = pasteZ + clipVoxel.relZ;
            
            // Place the voxel
            this.voxelEngine.setVoxel(x, y, z, clipVoxel.type, true);
            
            // Add to new selection
            newSelection.push({ x, y, z, type: clipVoxel.type });
        }
        
        // Update engine visual
        this.voxelEngine.updateInstances();
        
        // Select the pasted voxels
        this.selectedVoxels = newSelection;
        
        // Record selection change
        this.voxelEngine.recordSelectionChange(prevSelection, this.selectedVoxels);
        
        // Force immediate snapshot
        this.voxelEngine.finalizePendingOperations();
        this.previousSelection = [...this.selectedVoxels];
        
        // Update visuals
        this.updateSelectionOutline();
        this.showSelectedVoxels();
        
        // Show gizmo at paste center
        if (this.selectedVoxels.length > 0) {
            const center = this.getSelectionCenter();
            this.transformGizmo.show(center, this.selectedVoxels.length > 1);
        }
        
        console.log(`Pasted ${newSelection.length} voxels at (${pasteX}, ${pasteY}, ${pasteZ})`);
    }
    
    /**
     * Cut selected voxels (copy then delete)
     */
    cutSelection(): void {
        if (this.selectedVoxels.length === 0) {
            console.log('No voxels selected to cut');
            return;
        }
        
        // Copy to clipboard first
        this.copySelection();
        
        // Then delete the selected voxels
        this.deleteSelectedVoxels();
        
        console.log(`Cut ${this.clipboard?.length || 0} voxels`);
    }
    
    /**
     * Clear selection visuals only (without recording undo)
     */
    private clearSelectionVisuals(): void {
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
     * Clear selection (with undo recording)
     */
    clearSelection(recordUndo: boolean = true): void {
        if (this.selectedVoxels.length === 0) return;
        
        // Store previous selection for undo
        const prevSelection = [...this.previousSelection];
        
        // Clear selection
        this.selectedVoxels = [];
        
        // Only record selection change if requested
        if (recordUndo) {
            this.voxelEngine.recordSelectionChange(prevSelection, []);
        }
        this.previousSelection = [];
        
        // Clear visuals
        this.clearSelectionVisuals();
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
     * Get the current selection
     */
    getSelection(): SelectedVoxel[] {
        return [...this.selectedVoxels];
    }
    
    /**
     * Get current transform mode
     */
    getTransformMode(): 'move' | 'rotate' | null {
        return this.transformMode;
    }
    
    /**
     * Get transform gizmo instance for scale updates
     */
    getTransformGizmo(): TransformGizmo {
        return this.transformGizmo;
    }
    
    /**
     * Restore selection from saved state (used by undo/redo)
     */
    restoreSelection(selectedVoxels: Array<{ x: number; y: number; z: number; type: VoxelType }>): void {
        // Clear visuals
        this.clearSelectionVisuals();
        
        // Restore the selection without recording it
        this.selectedVoxels = selectedVoxels.map(v => ({ ...v }));
        this.previousSelection = [...this.selectedVoxels];
        
        // Reset duplication state when restoring
        this.isDuplicating = false;
        
        if (this.selectedVoxels.length > 0) {
            // Update visuals
            this.updateSelectionOutline();
            this.showSelectedVoxels();
            
            // Show gizmo at selection center
            const center = this.getSelectionCenter();
            this.transformGizmo.show(center, this.selectedVoxels.length > 1);
        }
        
        console.log(`Selection restored: ${this.selectedVoxels.length} voxels`);
    }
    
    /**
     * Get current selection state for saving
     */
    getSelectionState(): Array<{ x: number; y: number; z: number; type: VoxelType }> {
        return this.selectedVoxels.map(v => ({ ...v }));
    }
    
    /**
     * Refresh selection after undo/redo - removes voxels that no longer exist
     */
    refreshSelection(): void {
        if (this.selectedVoxels.length === 0) return;
        
        // Filter out voxels that no longer exist (were removed by undo/redo)
        const validVoxels: SelectedVoxel[] = [];
        for (const voxel of this.selectedVoxels) {
            const currentType = this.voxelEngine.getVoxel(voxel.x, voxel.y, voxel.z);
            if (currentType !== VoxelType.AIR) {
                // Update the type in case it changed
                validVoxels.push({ x: voxel.x, y: voxel.y, z: voxel.z, type: currentType });
            }
        }
        
        // Update the selection
        this.selectedVoxels = validVoxels;
        
        // If all voxels were removed, clear the selection
        if (this.selectedVoxels.length === 0) {
            this.clearSelection(false); // Don't record undo, already handled by caller
        } else {
            // Refresh the visual representation
            this.updateSelectionOutline();
            this.showSelectedVoxels();
            
            // Update gizmo position
            const center = this.getSelectionCenter();
            this.transformGizmo.show(center, this.selectedVoxels.length > 1);
        }
        
        console.log(`Selection refreshed: ${this.selectedVoxels.length} voxels remain`);
    }
    
    /**
     * Start screen space selection
     */
    startScreenSpaceSelection(screenX: number, screenY: number): void {
        this.isScreenSpaceSelecting = true;
        this.screenSelectionStart = { x: screenX, y: screenY };
        this.screenSelectionEnd = { x: screenX, y: screenY };
        
        // Create selection box div
        if (!this.screenSelectionBox) {
            this.screenSelectionBox = document.createElement('div');
            this.screenSelectionBox.style.cssText = `
                position: fixed;
                border: 2px dashed rgba(255, 255, 100, 0.8);
                background: rgba(255, 255, 100, 0.1);
                pointer-events: none;
                z-index: 1000;
            `;
            document.body.appendChild(this.screenSelectionBox);
        }
        
        this.updateScreenSelectionBox();
    }
    
    /**
     * Update screen space selection
     */
    updateScreenSpaceSelection(screenX: number, screenY: number): void {
        if (!this.isScreenSpaceSelecting || !this.screenSelectionStart) return;
        
        this.screenSelectionEnd = { x: screenX, y: screenY };
        this.updateScreenSelectionBox();
    }
    
    /**
     * End screen space selection and select voxels
     */
    endScreenSpaceSelection(shiftKey: boolean = false): void {
        if (!this.isScreenSpaceSelecting || !this.screenSelectionStart || !this.screenSelectionEnd) return;
        
        this.isScreenSpaceSelecting = false;
        
        // Remove selection box
        if (this.screenSelectionBox) {
            this.screenSelectionBox.remove();
            this.screenSelectionBox = null;
        }
        
        // Calculate selection rectangle
        const minX = Math.min(this.screenSelectionStart.x, this.screenSelectionEnd.x);
        const maxX = Math.max(this.screenSelectionStart.x, this.screenSelectionEnd.x);
        const minY = Math.min(this.screenSelectionStart.y, this.screenSelectionEnd.y);
        const maxY = Math.max(this.screenSelectionStart.y, this.screenSelectionEnd.y);
        
        // Skip tiny selections (likely accidental clicks)
        if (Math.abs(maxX - minX) < 5 && Math.abs(maxY - minY) < 5) {
            // This was just a click, not a drag
            if (!shiftKey) {
                // Clear selection when clicking on empty space (unless shift is held)
                this.clearSelection(true); // Record undo for explicit clear action
            }
            return;
        }
        
        // Project voxels to screen space and check if they're in the selection box
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const selectedVoxels: SelectedVoxel[] = [];
        
        // Get all voxels in the scene
        const allVoxels = this.voxelEngine.getAllVoxels();
        const voxelSize = this.voxelEngine.getCurrentVoxelSize();
        
        // Create a vector for projection
        const vector = new THREE.Vector3();
        
        for (const voxel of allVoxels) {
            // Get voxel center in world space
            vector.set(
                voxel.x * voxelSize + voxelSize * 0.5,
                voxel.y * voxelSize + voxelSize * 0.5,
                voxel.z * voxelSize + voxelSize * 0.5
            );
            
            // Project to normalized device coordinates
            vector.project(this.camera);
            
            // Convert to screen coordinates
            const screenX = (vector.x * 0.5 + 0.5) * canvas.clientWidth + rect.left;
            const screenY = (-vector.y * 0.5 + 0.5) * canvas.clientHeight + rect.top;
            
            // Check if voxel is in selection box and visible (z < 1 means in front of camera)
            if (screenX >= minX && screenX <= maxX && 
                screenY >= minY && screenY <= maxY &&
                vector.z < 1) {
                selectedVoxels.push({
                    x: voxel.x,
                    y: voxel.y,
                    z: voxel.z,
                    type: voxel.type
                });
            }
        }
        
        // Update selection
        if (!shiftKey) {
            // Replace selection - don't record undo for the clear, we'll record the whole operation
            this.clearSelection(false);
            this.selectedVoxels = selectedVoxels;
        } else {
            // Add to selection
            for (const voxel of selectedVoxels) {
                const exists = this.selectedVoxels.some(v => 
                    v.x === voxel.x && v.y === voxel.y && v.z === voxel.z
                );
                if (!exists) {
                    this.selectedVoxels.push(voxel);
                }
            }
        }
        
        // Update visuals
        if (this.selectedVoxels.length > 0) {
            this.updateSelectionOutline();
            this.showSelectedVoxels();
            const center = this.getSelectionCenter();
            this.transformGizmo.show(center, this.selectedVoxels.length > 1);
            
            // Record selection change
            this.voxelEngine.recordSelectionChange(this.previousSelection, this.selectedVoxels);
            this.previousSelection = [...this.selectedVoxels];
        }
        
        console.log(`Selected ${this.selectedVoxels.length} voxels with screen space selection`);
    }
    
    /**
     * Update screen selection box visual
     */
    private updateScreenSelectionBox(): void {
        if (!this.screenSelectionBox || !this.screenSelectionStart || !this.screenSelectionEnd) return;
        
        const minX = Math.min(this.screenSelectionStart.x, this.screenSelectionEnd.x);
        const maxX = Math.max(this.screenSelectionStart.x, this.screenSelectionEnd.x);
        const minY = Math.min(this.screenSelectionStart.y, this.screenSelectionEnd.y);
        const maxY = Math.max(this.screenSelectionStart.y, this.screenSelectionEnd.y);
        
        this.screenSelectionBox.style.left = `${minX}px`;
        this.screenSelectionBox.style.top = `${minY}px`;
        this.screenSelectionBox.style.width = `${maxX - minX}px`;
        this.screenSelectionBox.style.height = `${maxY - minY}px`;
    }
    
    /**
     * Check if currently doing screen space selection
     */
    isDoingScreenSpaceSelection(): boolean {
        return this.isScreenSpaceSelecting;
    }
    
    /**
     * Rotate selection by specified angle around specified axis
     * @param axis - The axis to rotate around ('x', 'y', or 'z')
     * @param angle - The angle in radians (use Math.PI/4 for 45 degrees)
     */
    rotateSelection(axis: 'x' | 'y' | 'z', angle: number): void {
        if (this.selectedVoxels.length === 0) {
            console.log('No voxels selected to rotate');
            return;
        }
        
        console.log(`Rotating selection ${angle * 180 / Math.PI}° around ${axis} axis`);
        
        // Calculate center of selection
        let centerX = 0, centerY = 0, centerZ = 0;
        for (const voxel of this.selectedVoxels) {
            centerX += voxel.x;
            centerY += voxel.y;
            centerZ += voxel.z;
        }
        centerX /= this.selectedVoxels.length;
        centerY /= this.selectedVoxels.length;
        centerZ /= this.selectedVoxels.length;
        
        // Create rotation euler
        const rotation = new THREE.Euler();
        if (axis === 'x') rotation.x = angle;
        else if (axis === 'y') rotation.y = angle;
        else if (axis === 'z') rotation.z = angle;
        
        // Calculate new positions
        const newVoxels: SelectedVoxel[] = [];
        
        // Apply rotation to calculate new positions first
        for (const voxel of this.selectedVoxels) {
            // Create position relative to center
            const pos = new THREE.Vector3(
                voxel.x - centerX,
                voxel.y - centerY,
                voxel.z - centerZ
            );
            
            // Apply rotation
            pos.applyEuler(rotation);
            
            // Calculate new voxel position
            const newX = Math.round(pos.x + centerX);
            const newY = Math.round(pos.y + centerY);
            const newZ = Math.round(pos.z + centerZ);
            
            newVoxels.push({ x: newX, y: newY, z: newZ, type: voxel.type });
        }
        
        // Clear old positions
        for (const voxel of this.selectedVoxels) {
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR, true);
        }
        
        // Place voxels at new positions
        for (const voxel of newVoxels) {
            this.voxelEngine.setVoxel(voxel.x, voxel.y, voxel.z, voxel.type, true);
        }
        
        // Update voxel engine visuals
        this.voxelEngine.updateInstances();
        
        // Record selection change
        this.voxelEngine.recordSelectionChange(this.selectedVoxels, newVoxels);
        
        // Update selection
        this.selectedVoxels = newVoxels;
        this.previousSelection = [...newVoxels];
        
        // Force immediate snapshot
        this.voxelEngine.finalizePendingOperations();
        
        // Update visuals
        this.updateSelectionOutline();
        this.showSelectedVoxels();
        
        // Update gizmo position
        const center = this.getSelectionCenter();
        this.transformGizmo.show(center, this.selectedVoxels.length > 1);
    }
    
    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.clearSelection(false); // Don't record undo on dispose
        this.transformGizmo.dispose();
        
        // Clean up screen selection box if it exists
        if (this.screenSelectionBox) {
            this.screenSelectionBox.remove();
            this.screenSelectionBox = null;
        }
    }
}