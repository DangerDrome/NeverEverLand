import * as THREE from 'three';

export type GizmoMode = 'transform' | null;
export type GizmoAxis = 'x' | 'y' | 'z' | null;
export type GizmoOperation = 'move' | 'rotate' | null;

export class TransformGizmo {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private gizmoGroup: THREE.Group;
    
    // Move gizmo arrows
    private moveArrows: {
        x: THREE.Mesh;
        y: THREE.Mesh;
        z: THREE.Mesh;
    } | null = null;
    
    // Rotate gizmo arcs
    private rotateArcs: {
        x: THREE.Mesh;
        y: THREE.Mesh;
        z: THREE.Mesh;
    } | null = null;
    
    // Store original ring parameters
    private readonly ringRadius = 4.5;
    private readonly ringTubeRadius = 0.06;  // Slightly thicker for better hit detection
    private readonly ringTubeRadiusHover = 0.15;
    private readonly ringTubeRadiusActive = 0.06;  // Same as default when actively rotating
    
    // Arrow parameters
    private readonly arrowLength = 2;
    private readonly arrowWidth = 0.06;  // Match ring thickness exactly
    private readonly coneHeight = 0.4;
    private readonly coneRadius = 0.25;
    
    // Gizmo state
    private mode: GizmoMode = null;
    private position: THREE.Vector3 = new THREE.Vector3();
    private scale: number = 1;
    private selectedAxis: GizmoAxis = null;
    private selectedOperation: GizmoOperation = null;
    private isDragging: boolean = false;
    private dragStart: THREE.Vector3 = new THREE.Vector3();
    private dragPlane: THREE.Plane = new THREE.Plane();
    
    // Rotation indicator
    private rotationIndicator: THREE.Mesh | null = null;
    private currentRotation: number = 0;
    
    // Colors for axes
    private readonly colors = {
        x: 'rgb(255, 100, 100)',  // Red
        y: 'rgb(100, 255, 100)',  // Green
        z: 'rgb(100, 100, 255)',  // Blue
        hover: 'rgb(255, 255, 100)',  // Yellow
        selected: 'rgb(255, 255, 255)'  // White
    };
    
    constructor(scene: THREE.Scene, camera: THREE.OrthographicCamera) {
        this.scene = scene;
        this.camera = camera;
        this.gizmoGroup = new THREE.Group();
        this.gizmoGroup.renderOrder = 1001; // Render on top of everything
        
        this.createMoveGizmo();
        this.createRotateGizmo();
    }
    
    /**
     * Create move gizmo with arrows
     */
    private createMoveGizmo(): void {
        // Create arrow for each axis
        this.moveArrows = {
            x: this.createArrow(this.arrowLength, this.arrowWidth, this.coneHeight, this.coneRadius, this.colors.x),
            y: this.createArrow(this.arrowLength, this.arrowWidth, this.coneHeight, this.coneRadius, this.colors.y),
            z: this.createArrow(this.arrowLength, this.arrowWidth, this.coneHeight, this.coneRadius, this.colors.z)
        };
        
        // Position and rotate arrows
        this.moveArrows.x.rotation.z = -Math.PI / 2;
        this.moveArrows.x.userData = { axis: 'x' };
        
        this.moveArrows.y.userData = { axis: 'y' };
        
        this.moveArrows.z.rotation.x = Math.PI / 2;
        this.moveArrows.z.userData = { axis: 'z' };
    }
    
    /**
     * Create a single arrow mesh
     */
    private createArrow(length: number, width: number, coneHeight: number, coneRadius: number, color: string): THREE.Mesh {
        const group = new THREE.Group();
        
        // Shaft
        const shaftGeometry = new THREE.CylinderGeometry(width, width, length, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            depthTest: false,
            depthWrite: false
        });
        const shaft = new THREE.Mesh(shaftGeometry, material);
        shaft.position.y = length / 2;
        
        // Cone (arrowhead)
        const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
        const cone = new THREE.Mesh(coneGeometry, material.clone());
        cone.position.y = length + coneHeight / 2;
        
        // Combine into arrow
        const arrowMesh = new THREE.Mesh();
        arrowMesh.add(shaft);
        arrowMesh.add(cone);
        
        return arrowMesh;
    }
    
    /**
     * Create rotate gizmo with circular arcs
     */
    private createRotateGizmo(): void {
        // Create torus for each axis
        this.rotateArcs = {
            x: this.createRotateRing(this.ringRadius, this.ringTubeRadius, this.colors.x),
            y: this.createRotateRing(this.ringRadius, this.ringTubeRadius, this.colors.y),
            z: this.createRotateRing(this.ringRadius, this.ringTubeRadius, this.colors.z)
        };
        
        // Rotate rings to align with axes
        // X ring (red) - rotates around X axis, so ring is in YZ plane
        this.rotateArcs.x.rotation.y = Math.PI / 2;
        this.rotateArcs.x.userData = { axis: 'x' };
        
        // Y ring (green) - rotates around Y axis, so ring is in XZ plane (default orientation)
        this.rotateArcs.y.rotation.x = Math.PI / 2;
        this.rotateArcs.y.userData = { axis: 'y' };
        
        // Z ring (blue) - rotates around Z axis, so ring is in XY plane
        // No rotation needed as torus default is in XY plane
        this.rotateArcs.z.userData = { axis: 'z' };
    }
    
    /**
     * Create a rotation ring (torus)
     */
    private createRotateRing(radius: number, tubeRadius: number, color: string): THREE.Mesh {
        const geometry = new THREE.TorusGeometry(radius, tubeRadius, 8, 32);  // More segments for smoother appearance
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        return new THREE.Mesh(geometry, material);
    }
    
    /**
     * Show unified transform gizmo at position
     */
    show(position: THREE.Vector3, showRotation: boolean = true): void {
        this.hide();
        
        this.mode = 'transform';
        this.position.copy(position);
        this.gizmoGroup.position.copy(position);
        
        // Always add move controls
        if (this.moveArrows) {
            this.gizmoGroup.add(this.moveArrows.x);
            this.gizmoGroup.add(this.moveArrows.y);
            this.gizmoGroup.add(this.moveArrows.z);
        }
        
        // Store showRotation flag for later restoration
        this.gizmoGroup.userData.showRotation = showRotation;
        
        // Only add rotation handles if requested
        if (showRotation && this.rotateArcs) {
            // Make rotate arcs slightly larger to surround arrows
            const scale = 1.0;
            this.rotateArcs.x.scale.setScalar(scale);
            this.rotateArcs.y.scale.setScalar(scale);
            this.rotateArcs.z.scale.setScalar(scale);
            
            this.gizmoGroup.add(this.rotateArcs.x);
            this.gizmoGroup.add(this.rotateArcs.y);
            this.gizmoGroup.add(this.rotateArcs.z);
        }
        
        this.scene.add(this.gizmoGroup);
        this.updateScale();
    }
    
    /**
     * Hide gizmo
     */
    hide(): void {
        this.scene.remove(this.gizmoGroup);
        this.gizmoGroup.clear();
        this.mode = null;
        this.selectedAxis = null;
    }
    
    /**
     * Update gizmo position
     */
    setPosition(position: THREE.Vector3): void {
        this.position.copy(position);
        this.gizmoGroup.position.copy(position);
    }
    
    /**
     * Update scale based on camera zoom to maintain constant screen size
     */
    updateScale(): void {
        if (!this.camera) return;
        
        // For orthographic camera with OrbitControls, the effective view size is:
        // actual_view = initial_view / camera.zoom
        // To maintain constant screen size, we need to scale inversely with zoom
        
        // Base size for the gizmo (when zoom = 1)
        const baseSize = 0.5; // Reduced from 2.0 to 0.5 (4x smaller)
        
        // Scale inversely with camera zoom to maintain constant screen size
        // When zoom increases (zooming in), gizmo gets smaller in world space
        // but stays same size on screen
        this.scale = baseSize / this.camera.zoom;
        
        this.gizmoGroup.scale.setScalar(this.scale);
    }
    
    /**
     * Handle mouse hover on gizmo and detect which control is hovered
     */
    onMouseHover(raycaster: THREE.Raycaster): { axis: GizmoAxis; operation: GizmoOperation } | null {
        if (!this.mode || this.isDragging) return null;
        
        // Reset all colors and thicknesses first
        this.resetColors();
        
        // Check move arrows first (they're in front)
        if (this.moveArrows) {
            const arrowObjects = [this.moveArrows.x, this.moveArrows.y, this.moveArrows.z];
            const arrowIntersects = raycaster.intersectObjects(arrowObjects, true);
            
            if (arrowIntersects.length > 0) {
                let object = arrowIntersects[0].object;
                while (object && !object.userData.axis) {
                    object = object.parent!;
                }
                
                if (object && object.userData.axis) {
                    const axis = object.userData.axis as GizmoAxis;
                    this.highlightAxis(axis, 'move');
                    return { axis, operation: 'move' };
                }
            }
        }
        
        // Check rotate arcs
        if (this.rotateArcs) {
            const arcObjects = [this.rotateArcs.x, this.rotateArcs.y, this.rotateArcs.z];
            const arcIntersects = raycaster.intersectObjects(arcObjects, false);
            
            if (arcIntersects.length > 0) {
                const object = arcIntersects[0].object;
                if (object.userData.axis) {
                    const axis = object.userData.axis as GizmoAxis;
                    this.highlightAxis(axis, 'rotate', false, true); // Pass true for hover
                    return { axis, operation: 'rotate' };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Start dragging on a specific axis and operation
     */
    startDrag(axis: GizmoAxis, operation: GizmoOperation, raycaster: THREE.Raycaster): void {
        if (!axis || !operation) return;
        
        this.isDragging = true;
        this.selectedAxis = axis;
        this.selectedOperation = operation;
        
        // Setup drag plane based on axis
        const normal = new THREE.Vector3();
        if (axis === 'x') {
            normal.set(0, 0, 1); // XY plane for X axis
        } else if (axis === 'y') {
            normal.set(1, 0, 0); // YZ plane for Y axis
        } else {
            normal.set(0, 1, 0); // XZ plane for Z axis
        }
        
        this.dragPlane.setFromNormalAndCoplanarPoint(normal, this.position);
        
        // Get initial intersection point
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(this.dragPlane, intersection);
        this.dragStart.copy(intersection);
        
        this.highlightAxis(axis, operation, true, false);
        
        // Hide non-active elements during interaction
        if (operation === 'rotate') {
            // Hide all move arrows when rotating
            if (this.moveArrows) {
                this.gizmoGroup.remove(this.moveArrows.x);
                this.gizmoGroup.remove(this.moveArrows.y);
                this.gizmoGroup.remove(this.moveArrows.z);
            }
            
            // Hide other rotation rings
            if (this.rotateArcs) {
                if (axis !== 'x') this.gizmoGroup.remove(this.rotateArcs.x);
                if (axis !== 'y') this.gizmoGroup.remove(this.rotateArcs.y);
                if (axis !== 'z') this.gizmoGroup.remove(this.rotateArcs.z);
            }
            
            this.showRotationIndicator(axis);
        } else if (operation === 'move') {
            // Hide all rotation rings when moving
            if (this.rotateArcs) {
                this.gizmoGroup.remove(this.rotateArcs.x);
                this.gizmoGroup.remove(this.rotateArcs.y);
                this.gizmoGroup.remove(this.rotateArcs.z);
            }
            
            // Hide other move arrows
            if (this.moveArrows) {
                if (axis !== 'x') this.gizmoGroup.remove(this.moveArrows.x);
                if (axis !== 'y') this.gizmoGroup.remove(this.moveArrows.y);
                if (axis !== 'z') this.gizmoGroup.remove(this.moveArrows.z);
            }
        }
    }
    
    /**
     * Update drag based on mouse movement
     */
    updateDrag(raycaster: THREE.Raycaster): THREE.Vector3 | null {
        if (!this.isDragging || !this.selectedAxis || !this.selectedOperation) return null;
        
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(this.dragPlane, intersection);
        
        const delta = intersection.clone().sub(this.dragStart);
        
        // Update drag start for next frame (for incremental updates)
        this.dragStart.copy(intersection);
        
        // Constrain movement to selected axis
        if (this.selectedOperation === 'move') {
            const constrainedDelta = new THREE.Vector3();
            if (this.selectedAxis === 'x') {
                constrainedDelta.x = delta.x;
            } else if (this.selectedAxis === 'y') {
                constrainedDelta.y = delta.y;
            } else {
                constrainedDelta.z = delta.z;
            }
            
            console.log(`TransformGizmo move: axis=${this.selectedAxis}, delta=(${constrainedDelta.x.toFixed(3)}, ${constrainedDelta.y.toFixed(3)}, ${constrainedDelta.z.toFixed(3)})`);
            
            return constrainedDelta;
        } else if (this.selectedOperation === 'rotate') {
            // Calculate rotation angle based on mouse movement
            const rotationDelta = new THREE.Vector3();
            const sensitivity = 5.0; // Much higher rotation sensitivity for easier rotation
            
            // Calculate rotation based on drag distance and axis
            // The drag plane determines which components of delta to use
            let angle = 0;
            if (this.selectedAxis === 'x') {
                // X-axis rotation (red ring) - rotates in YZ plane
                // Use the component perpendicular to the axis
                angle = -(delta.y + delta.z) * sensitivity; // Inverted for X-axis
                rotationDelta.x = angle;
            } else if (this.selectedAxis === 'y') {
                // Y-axis rotation (green ring) - rotates in XZ plane
                // Use the component perpendicular to the axis
                angle = (delta.x - delta.z) * sensitivity;
                rotationDelta.y = angle;
            } else if (this.selectedAxis === 'z') {
                // Z-axis rotation (blue ring) - rotates in XY plane
                // Use the component perpendicular to the axis
                angle = -(delta.x + delta.y) * sensitivity; // Inverted for Z-axis
                rotationDelta.z = angle;
            }
            
            // Update the rotation indicator with clamping to ±360 degrees
            const newRotation = this.currentRotation + angle;
            
            // Clamp to ±360 degrees (±2π radians)
            const maxRotation = 2 * Math.PI;
            this.currentRotation = Math.max(-maxRotation, Math.min(maxRotation, newRotation));
            
            // If we've hit the limit, zero out the delta
            if (newRotation !== this.currentRotation) {
                rotationDelta.x = 0;
                rotationDelta.y = 0;
                rotationDelta.z = 0;
            }
            
            this.updateRotationIndicator(this.currentRotation);
            
            console.log(`TransformGizmo rotation: axis=${this.selectedAxis}, delta=${rotationDelta.x.toFixed(4)}, ${rotationDelta.y.toFixed(4)}, ${rotationDelta.z.toFixed(4)}`);
            
            return rotationDelta;
        }
        
        return null;
    }
    
    /**
     * End dragging
     */
    endDrag(): void {
        this.isDragging = false;
        this.selectedAxis = null;
        this.selectedOperation = null;
        this.resetColors();
        this.hideRotationIndicator();
        this.currentRotation = 0;
        
        // Restore all gizmo elements after dragging
        this.restoreAllElements();
    }
    
    /**
     * Highlight an axis
     */
    private highlightAxis(axis: GizmoAxis, operation?: GizmoOperation, selected: boolean = false, isHover: boolean = false): void {
        if (!axis) return;
        
        if (operation === 'move' && this.moveArrows) {
            const arrow = this.moveArrows[axis];
            // Use axis color when selected (dragging), yellow when hovering, otherwise normal axis color
            let arrowColor;
            if (selected) {
                arrowColor = this.colors[axis]; // Keep axis color when dragging
            } else if (isHover) {
                arrowColor = this.colors.hover; // Yellow when hovering
            } else {
                arrowColor = this.colors[axis]; // Normal axis color
            }
            
            arrow.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    (child.material as THREE.MeshBasicMaterial).color.set(arrowColor);
                    (child.material as THREE.MeshBasicMaterial).opacity = 1.0;
                }
            });
        } else if (operation === 'rotate' && this.rotateArcs) {
            const arc = this.rotateArcs[axis];
            // Use axis color when selected (dragging), yellow when hovering, otherwise normal axis color
            let ringColor;
            if (selected) {
                ringColor = this.colors[axis]; // Keep axis color when dragging
            } else if (isHover) {
                ringColor = this.colors.hover; // Yellow when hovering
            } else {
                ringColor = this.colors[axis]; // Normal axis color
            }
            (arc.material as THREE.MeshBasicMaterial).color.set(ringColor);
            // Increase opacity slightly when highlighted
            (arc.material as THREE.MeshBasicMaterial).opacity = (selected || isHover) ? 0.8 : 0.5;
            
            // Create thicker ring only on hover, not when selected (dragging)
            const shouldThicken = isHover && !selected;
            const newTubeRadius = shouldThicken ? this.ringTubeRadiusHover : this.ringTubeRadius;
            const newGeometry = new THREE.TorusGeometry(this.ringRadius, newTubeRadius, 8, 32);
            arc.geometry.dispose();
            arc.geometry = newGeometry;
        }
    }
    
    /**
     * Reset all axes to default colors
     */
    private resetColors(): void {
        // Since we're using unified 'transform' mode, reset both arrows and arcs
        if (this.mode === 'transform') {
            if (this.moveArrows) {
                const arrows = [
                    { mesh: this.moveArrows.x, color: this.colors.x },
                    { mesh: this.moveArrows.y, color: this.colors.y },
                    { mesh: this.moveArrows.z, color: this.colors.z }
                ];
                
                arrows.forEach(({ mesh, color }) => {
                    mesh.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            (child.material as THREE.MeshBasicMaterial).color.set(color);
                            (child.material as THREE.MeshBasicMaterial).opacity = 0.8;
                        }
                    });
                });
            }
            
            if (this.rotateArcs) {
                const arcs = [
                    { mesh: this.rotateArcs.x, color: this.colors.x },
                    { mesh: this.rotateArcs.y, color: this.colors.y },
                    { mesh: this.rotateArcs.z, color: this.colors.z }
                ];
                
                arcs.forEach(({ mesh, color }) => {
                    (mesh.material as THREE.MeshBasicMaterial).color.set(color);
                    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.5;
                    
                    // Reset to thin ring
                    const newGeometry = new THREE.TorusGeometry(this.ringRadius, this.ringTubeRadius, 8, 32);
                    mesh.geometry.dispose();
                    mesh.geometry = newGeometry;
                });
            }
        }
    }
    
    /**
     * Check if currently dragging
     */
    isDraggingGizmo(): boolean {
        return this.isDragging;
    }
    
    /**
     * Get current operation
     */
    getCurrentOperation(): GizmoOperation {
        return this.selectedOperation;
    }
    
    /**
     * Show rotation indicator
     */
    private showRotationIndicator(axis: GizmoAxis): void {
        if (!axis) return;
        
        // Initialize the rotation indicator at 0 degrees
        this.currentRotation = 0;
        this.updateRotationIndicator(0);
    }
    
    /**
     * Update rotation indicator
     */
    updateRotationIndicator(angle: number): void {
        if (!this.selectedAxis) return;
        
        // Remove old indicator
        if (this.rotationIndicator) {
            this.gizmoGroup.remove(this.rotationIndicator);
            this.rotationIndicator.geometry.dispose();
            (this.rotationIndicator.material as THREE.Material).dispose();
            this.rotationIndicator = null;
        }
        
        // Snap to 90-degree intervals
        const snapAngle = Math.PI / 2; // 90 degrees
        const snappedAngle = Math.round(angle / snapAngle) * snapAngle;
        
        // Create pie slice geometry - use snapped angle for the indicator
        const shape = new THREE.Shape();
        const centerRadius = this.ringRadius * 0.3;
        const outerRadius = this.ringRadius * 0.85;
        
        // Start from 0 degrees
        shape.moveTo(centerRadius, 0);
        shape.lineTo(outerRadius, 0);
        
        // Draw arc
        const segments = Math.max(16, Math.floor(Math.abs(snappedAngle) / (Math.PI / 8)));
        for (let i = 1; i <= segments; i++) {
            const a = (snappedAngle / segments) * i;
            shape.lineTo(Math.cos(a) * outerRadius, Math.sin(a) * outerRadius);
        }
        
        // Complete the pie slice
        shape.lineTo(Math.cos(snappedAngle) * centerRadius, Math.sin(snappedAngle) * centerRadius);
        
        // Draw inner arc back to start
        for (let i = segments - 1; i >= 0; i--) {
            const a = (snappedAngle / segments) * i;
            shape.lineTo(Math.cos(a) * centerRadius, Math.sin(a) * centerRadius);
        }
        
        shape.closePath();
        
        // Create geometry from shape
        const geometry = new THREE.ShapeGeometry(shape);
        
        // Use axis color instead of generic colors
        const axisColor = this.colors[this.selectedAxis];
        const material = new THREE.MeshBasicMaterial({
            color: axisColor,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });
        
        this.rotationIndicator = new THREE.Mesh(geometry, material);
        this.rotationIndicator.renderOrder = 1001;
        
        // Position and orient based on axis
        if (this.selectedAxis === 'x') {
            this.rotationIndicator.rotation.y = Math.PI / 2;
        } else if (this.selectedAxis === 'y') {
            this.rotationIndicator.rotation.x = -Math.PI / 2;
        }
        // Z axis needs no rotation
        
        this.gizmoGroup.add(this.rotationIndicator);
        this.currentRotation = angle;
    }
    
    /**
     * Hide rotation indicator
     */
    private hideRotationIndicator(): void {
        if (this.rotationIndicator) {
            this.gizmoGroup.remove(this.rotationIndicator);
            this.rotationIndicator.geometry.dispose();
            (this.rotationIndicator.material as THREE.Material).dispose();
            this.rotationIndicator = null;
        }
    }
    
    /**
     * Get current rotation for external use
     */
    getCurrentRotation(): number {
        return this.currentRotation;
    }
    
    /**
     * Restore all gizmo elements after interaction
     */
    private restoreAllElements(): void {
        // Check if we're still in transform mode
        if (this.mode !== 'transform') return;
        
        // Restore move arrows
        if (this.moveArrows) {
            this.gizmoGroup.add(this.moveArrows.x);
            this.gizmoGroup.add(this.moveArrows.y);
            this.gizmoGroup.add(this.moveArrows.z);
        }
        
        // Restore rotation rings if we have more than one selected voxel
        const showRotation = this.gizmoGroup.userData.showRotation ?? true;
        if (showRotation && this.rotateArcs) {
            this.gizmoGroup.add(this.rotateArcs.x);
            this.gizmoGroup.add(this.rotateArcs.y);
            this.gizmoGroup.add(this.rotateArcs.z);
        }
    }
    
    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.hide();
        this.hideRotationIndicator();
        
        // Dispose move arrows
        if (this.moveArrows) {
            Object.values(this.moveArrows).forEach(arrow => {
                arrow.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        (child.material as THREE.Material).dispose();
                    }
                });
            });
        }
        
        // Dispose rotate arcs
        if (this.rotateArcs) {
            Object.values(this.rotateArcs).forEach(arc => {
                arc.geometry.dispose();
                (arc.material as THREE.Material).dispose();
            });
        }
    }
}