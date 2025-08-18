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
    
    // Invisible hit zones for arrows (larger than visual)
    private moveHitZones: {
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
    
    // Invisible hit zones for rotation (larger than visual)
    private rotateHitZones: {
        x: THREE.Mesh;
        y: THREE.Mesh;
        z: THREE.Mesh;
    } | null = null;
    
    // Store original ring parameters
    private readonly ringRadius = 3.8;  // Reduced from 4.5
    private readonly ringTubeRadius = 0.06;  // Reduced from 0.08
    private readonly ringTubeRadiusHover = 0.12;   // Reduced from 0.15
    private readonly ringTubeRadiusActive = 0.06;  // Same as default when actively rotating
    private readonly ringHitZoneRadius = 0.25;  // Keep large hit zone
    
    // Arrow parameters
    private readonly arrowLength = 1.6;  // Reduced from 2
    private readonly arrowWidth = 0.06;  // Match visual ring thickness
    private readonly coneHeight = 0.32;  // Reduced from 0.4
    private readonly coneRadius = 0.2;  // Reduced from 0.25
    
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
    private displayRotation: number = 0;
    private rotationAnimationStart: number = 0;
    private rotationAnimationTarget: number = 0;
    private rotationAnimationTime: number = 0;
    
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
        
        // Create invisible hit zones (larger for easier selection)
        const hitZoneWidth = 0.3; // Much larger than visual arrow width
        const hitZoneConeRadius = 0.4; // Much larger than visual cone
        
        this.moveHitZones = {
            x: this.createArrowHitZone(this.arrowLength, hitZoneWidth, this.coneHeight, hitZoneConeRadius),
            y: this.createArrowHitZone(this.arrowLength, hitZoneWidth, this.coneHeight, hitZoneConeRadius),
            z: this.createArrowHitZone(this.arrowLength, hitZoneWidth, this.coneHeight, hitZoneConeRadius)
        };
        
        // Position and rotate arrows and hit zones
        this.moveArrows.x.rotation.z = -Math.PI / 2;
        this.moveArrows.x.userData = { axis: 'x' };
        this.moveHitZones.x.rotation.z = -Math.PI / 2;
        this.moveHitZones.x.userData = { axis: 'x' };
        
        this.moveArrows.y.userData = { axis: 'y' };
        this.moveHitZones.y.userData = { axis: 'y' };
        
        this.moveArrows.z.rotation.x = Math.PI / 2;
        this.moveArrows.z.userData = { axis: 'z' };
        this.moveHitZones.z.rotation.x = Math.PI / 2;
        this.moveHitZones.z.userData = { axis: 'z' };
    }
    
    /**
     * Create a material with depth-based fading for orthographic camera
     */
    private createDepthFadeMaterial(color: string, baseOpacity: number): THREE.ShaderMaterial {
        return new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(color) },
                baseOpacity: { value: baseOpacity }
            },
            vertexShader: `
                varying float vFade;
                void main() {
                    // Work in view space for consistent fade
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    
                    // Simple depth-based fade in view space
                    // In view space: negative z = in front, positive z = behind
                    // We want to fade out parts that are behind (positive z)
                    vFade = smoothstep(0.5, -0.5, mvPosition.z);
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float baseOpacity;
                varying float vFade;
                
                void main() {
                    gl_FragColor = vec4(color, baseOpacity * vFade);
                }
            `,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
    }
    
    /**
     * Create a single arrow mesh
     */
    private createArrow(length: number, width: number, coneHeight: number, coneRadius: number, color: string): THREE.Mesh {
        const group = new THREE.Group();
        
        // Shaft
        const shaftGeometry = new THREE.CylinderGeometry(width, width, length, 8);
        const material = this.createDepthFadeMaterial(color, 0.8);
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
     * Create an invisible hit zone for arrow (larger than visual)
     */
    private createArrowHitZone(length: number, width: number, coneHeight: number, coneRadius: number): THREE.Mesh {
        const group = new THREE.Group();
        
        // Larger shaft for easier selection
        const shaftGeometry = new THREE.CylinderGeometry(width, width, length, 8);
        const material = new THREE.MeshBasicMaterial({
            visible: false,  // Invisible
            depthTest: false,
            depthWrite: false
        });
        const shaft = new THREE.Mesh(shaftGeometry, material);
        shaft.position.y = length / 2;
        
        // Larger cone hit zone
        const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
        const cone = new THREE.Mesh(coneGeometry, material.clone());
        cone.position.y = length + coneHeight / 2;
        
        // Combine into arrow hit zone
        const arrowHitZone = new THREE.Mesh();
        arrowHitZone.add(shaft);
        arrowHitZone.add(cone);
        
        return arrowHitZone;
    }
    
    /**
     * Create rotate gizmo with circular arcs
     */
    private createRotateGizmo(): void {
        // Create visible torus for each axis
        this.rotateArcs = {
            x: this.createRotateRing(this.ringRadius, this.ringTubeRadius, this.colors.x),
            y: this.createRotateRing(this.ringRadius, this.ringTubeRadius, this.colors.y),
            z: this.createRotateRing(this.ringRadius, this.ringTubeRadius, this.colors.z)
        };
        
        // Create invisible hit zones (larger)
        this.rotateHitZones = {
            x: this.createRotateHitZone(this.ringRadius, this.ringHitZoneRadius),
            y: this.createRotateHitZone(this.ringRadius, this.ringHitZoneRadius),
            z: this.createRotateHitZone(this.ringRadius, this.ringHitZoneRadius)
        };
        
        // Rotate rings and hit zones to align with axes
        // Torus is created in XY plane by default
        
        // X ring (red) - rotates around X axis, so ring should be in YZ plane
        // Rotate 90° around Y axis to go from XY to YZ plane
        this.rotateArcs.x.rotation.y = Math.PI / 2;
        this.rotateArcs.x.userData = { axis: 'x' };
        this.rotateHitZones.x.rotation.y = Math.PI / 2;
        this.rotateHitZones.x.userData = { axis: 'x' };
        
        // Y ring (green) - rotates around Y axis, so ring should be in XZ plane
        // Rotate 90° around X axis to go from XY to XZ plane
        this.rotateArcs.y.rotation.x = Math.PI / 2;
        this.rotateArcs.y.userData = { axis: 'y' };
        this.rotateHitZones.y.rotation.x = Math.PI / 2;
        this.rotateHitZones.y.userData = { axis: 'y' };
        
        // Z ring (blue) - rotates around Z axis, so ring should be in XY plane
        // No rotation needed - torus is already in XY plane
        this.rotateArcs.z.userData = { axis: 'z' };
        this.rotateHitZones.z.userData = { axis: 'z' };
    }
    
    /**
     * Create a rotation ring (torus)
     */
    private createRotateRing(radius: number, tubeRadius: number, color: string): THREE.Mesh {
        const geometry = new THREE.TorusGeometry(radius, tubeRadius, 16, 64);  // Doubled segments for smoother appearance
        const material = this.createDepthFadeMaterial(color, 0.7);
        
        return new THREE.Mesh(geometry, material);
    }
    
    /**
     * Create an invisible hit zone for rotation
     */
    private createRotateHitZone(radius: number, tubeRadius: number): THREE.Mesh {
        const geometry = new THREE.TorusGeometry(radius, tubeRadius, 16, 64);  // Match visual ring segments
        const material = new THREE.MeshBasicMaterial({
            visible: false,  // Invisible
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
        if (this.moveArrows && this.moveHitZones) {
            this.gizmoGroup.add(this.moveArrows.x);
            this.gizmoGroup.add(this.moveArrows.y);
            this.gizmoGroup.add(this.moveArrows.z);
            
            // Add invisible hit zones
            this.gizmoGroup.add(this.moveHitZones.x);
            this.gizmoGroup.add(this.moveHitZones.y);
            this.gizmoGroup.add(this.moveHitZones.z);
        }
        
        // Store showRotation flag for later restoration
        this.gizmoGroup.userData.showRotation = showRotation;
        
        // Only add rotation handles if requested
        if (showRotation && this.rotateArcs && this.rotateHitZones) {
            // Make rotate arcs slightly larger to surround arrows
            const scale = 1.0;
            this.rotateArcs.x.scale.setScalar(scale);
            this.rotateArcs.y.scale.setScalar(scale);
            this.rotateArcs.z.scale.setScalar(scale);
            
            // Add visible rings
            this.gizmoGroup.add(this.rotateArcs.x);
            this.gizmoGroup.add(this.rotateArcs.y);
            this.gizmoGroup.add(this.rotateArcs.z);
            
            // Add invisible hit zones
            this.gizmoGroup.add(this.rotateHitZones.x);
            this.gizmoGroup.add(this.rotateHitZones.y);
            this.gizmoGroup.add(this.rotateHitZones.z);
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
        const baseSize = 0.4; // Further reduced for slightly smaller gizmo
        
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
        
        // Check move hit zones first (they're in front)
        if (this.moveHitZones) {
            const hitZoneObjects = [this.moveHitZones.x, this.moveHitZones.y, this.moveHitZones.z];
            const arrowIntersects = raycaster.intersectObjects(hitZoneObjects, true);
            
            if (arrowIntersects.length > 0) {
                let object = arrowIntersects[0].object;
                while (object && !object.userData.axis) {
                    object = object.parent!;
                }
                
                if (object && object.userData.axis) {
                    const axis = object.userData.axis as GizmoAxis;
                    this.highlightAxis(axis, 'move', false, true); // Pass true for hover
                    return { axis, operation: 'move' };
                }
            }
        }
        
        // Check rotate hit zones (not visible arcs)
        if (this.rotateHitZones) {
            const hitZoneObjects = [this.rotateHitZones.x, this.rotateHitZones.y, this.rotateHitZones.z];
            const arcIntersects = raycaster.intersectObjects(hitZoneObjects, false);
            
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
            // Hide all move arrows and hit zones when rotating
            if (this.moveArrows && this.moveHitZones) {
                this.gizmoGroup.remove(this.moveArrows.x);
                this.gizmoGroup.remove(this.moveArrows.y);
                this.gizmoGroup.remove(this.moveArrows.z);
                this.gizmoGroup.remove(this.moveHitZones.x);
                this.gizmoGroup.remove(this.moveHitZones.y);
                this.gizmoGroup.remove(this.moveHitZones.z);
            }
            
            // Hide other rotation rings and hit zones
            if (this.rotateArcs && this.rotateHitZones) {
                if (axis !== 'x') {
                    this.gizmoGroup.remove(this.rotateArcs.x);
                    this.gizmoGroup.remove(this.rotateHitZones.x);
                }
                if (axis !== 'y') {
                    this.gizmoGroup.remove(this.rotateArcs.y);
                    this.gizmoGroup.remove(this.rotateHitZones.y);
                }
                if (axis !== 'z') {
                    this.gizmoGroup.remove(this.rotateArcs.z);
                    this.gizmoGroup.remove(this.rotateHitZones.z);
                }
            }
            
            this.showRotationIndicator(axis);
        } else if (operation === 'move') {
            // Hide all rotation rings when moving
            if (this.rotateArcs) {
                this.gizmoGroup.remove(this.rotateArcs.x);
                this.gizmoGroup.remove(this.rotateArcs.y);
                this.gizmoGroup.remove(this.rotateArcs.z);
            }
            
            // Hide other move arrows and hit zones
            if (this.moveArrows && this.moveHitZones) {
                if (axis !== 'x') {
                    this.gizmoGroup.remove(this.moveArrows.x);
                    this.gizmoGroup.remove(this.moveHitZones.x);
                }
                if (axis !== 'y') {
                    this.gizmoGroup.remove(this.moveArrows.y);
                    this.gizmoGroup.remove(this.moveHitZones.y);
                }
                if (axis !== 'z') {
                    this.gizmoGroup.remove(this.moveArrows.z);
                    this.gizmoGroup.remove(this.moveHitZones.z);
                }
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
                angle = -(delta.x - delta.z) * sensitivity;  // Inverted
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
            
            // Update rotation indicator with current angle (it will snap internally)
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
                if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
                    child.material.uniforms.color.value.set(arrowColor);
                    child.material.uniforms.baseOpacity.value = 1.0;
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
            if (arc.material instanceof THREE.ShaderMaterial) {
                arc.material.uniforms.color.value.set(ringColor);
                // Increase opacity when highlighted
                arc.material.uniforms.baseOpacity.value = (selected || isHover) ? 0.9 : 0.7;
            }
            
            // Create thicker ring only on hover, not when selected (dragging)
            const shouldThicken = isHover && !selected;
            const newTubeRadius = shouldThicken ? this.ringTubeRadiusHover : this.ringTubeRadius;
            const newGeometry = new THREE.TorusGeometry(this.ringRadius, newTubeRadius, 16, 64);  // Match segment count
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
                        if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
                            child.material.uniforms.color.value.set(color);
                            child.material.uniforms.baseOpacity.value = 0.8;
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
                    if (mesh.material instanceof THREE.ShaderMaterial) {
                        mesh.material.uniforms.color.value.set(color);
                        mesh.material.uniforms.baseOpacity.value = 0.7;
                    }
                    
                    // Reset to thin ring
                    const newGeometry = new THREE.TorusGeometry(this.ringRadius, this.ringTubeRadius, 16, 64);  // Match segment count
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
        
        this.currentRotation = angle;
        
        // Just update the visual directly with the current angle
        this.updateRotationIndicatorVisual(angle);
    }
    
    
    /**
     * Update rotation indicator visual
     */
    updateRotationIndicatorVisual(displayAngle: number): void {
        if (!this.selectedAxis) return;
        
        // Skip update if angle hasn't changed significantly (increase threshold for smoother dragging)
        // Use larger threshold to prevent flicker during fast dragging
        if (this.rotationIndicator && Math.abs(displayAngle - this.displayRotation) < 0.05) {
            return;
        }
        
        this.displayRotation = displayAngle;
        
        // Remove old indicator
        if (this.rotationIndicator) {
            this.gizmoGroup.remove(this.rotationIndicator);
            this.rotationIndicator.geometry.dispose();
            (this.rotationIndicator.material as THREE.Material).dispose();
            this.rotationIndicator = null;
        }
        
        // Calculate starting angle based on camera orientation (12 o'clock)
        let startAngle = 0;
        if (this.selectedAxis === 'x') {
            // For X axis (red ring in YZ plane), 12 o'clock is +Y direction
            startAngle = Math.PI / 2;
        } else if (this.selectedAxis === 'y') {
            // For Y axis (green ring in XZ plane), 12 o'clock is -Z direction  
            startAngle = Math.PI;
        } else if (this.selectedAxis === 'z') {
            // For Z axis (blue ring in XY plane), 12 o'clock is +Y direction
            startAngle = Math.PI / 2;
        }
        
        // Create pie slice geometry
        const shape = new THREE.Shape();
        const centerRadius = this.ringRadius * 0.3;
        const outerRadius = this.ringRadius * 0.85;
        
        // Start from camera's 12 o'clock position
        const startX = Math.cos(startAngle) * centerRadius;
        const startY = Math.sin(startAngle) * centerRadius;
        shape.moveTo(startX, startY);
        
        const outerStartX = Math.cos(startAngle) * outerRadius;
        const outerStartY = Math.sin(startAngle) * outerRadius;
        shape.lineTo(outerStartX, outerStartY);
        
        // Draw arc from start angle to end angle
        const endAngle = startAngle + displayAngle;
        const segments = Math.max(16, Math.floor(Math.abs(displayAngle) / (Math.PI / 16)));
        
        for (let i = 1; i <= segments; i++) {
            const a = startAngle + (displayAngle / segments) * i;
            shape.lineTo(Math.cos(a) * outerRadius, Math.sin(a) * outerRadius);
        }
        
        // Complete the pie slice
        shape.lineTo(Math.cos(endAngle) * centerRadius, Math.sin(endAngle) * centerRadius);
        
        // Draw inner arc back to start
        for (let i = segments - 1; i >= 0; i--) {
            const a = startAngle + (displayAngle / segments) * i;
            shape.lineTo(Math.cos(a) * centerRadius, Math.sin(a) * centerRadius);
        }
        
        shape.closePath();
        
        // Create geometry from shape
        const geometry = new THREE.ShapeGeometry(shape);
        
        // Use axis color with snap indication
        const axisColor = this.colors[this.selectedAxis];
        const isSnapped = Math.abs(displayAngle % (Math.PI / 2)) < 0.01;
        const material = new THREE.MeshBasicMaterial({
            color: axisColor,
            transparent: true,
            opacity: 0.6,  // Keep constant opacity regardless of snap
            side: THREE.DoubleSide,  // Keep double-sided for rotation indicator
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
        
        // Reset animation state
        this.displayRotation = 0;
        this.rotationAnimationStart = 0;
        this.rotationAnimationTarget = 0;
    }
    
    /**
     * Get current rotation for external use
     */
    getCurrentRotation(): number {
        return this.currentRotation;
    }
    
    /**
     * Get selected axis for external use
     */
    getSelectedAxis(): GizmoAxis {
        return this.selectedAxis;
    }
    
    /**
     * Restore all gizmo elements after interaction
     */
    private restoreAllElements(): void {
        // Check if we're still in transform mode
        if (this.mode !== 'transform') return;
        
        // Restore move arrows and hit zones
        if (this.moveArrows && this.moveHitZones) {
            this.gizmoGroup.add(this.moveArrows.x);
            this.gizmoGroup.add(this.moveArrows.y);
            this.gizmoGroup.add(this.moveArrows.z);
            this.gizmoGroup.add(this.moveHitZones.x);
            this.gizmoGroup.add(this.moveHitZones.y);
            this.gizmoGroup.add(this.moveHitZones.z);
        }
        
        // Restore rotation rings if we have more than one selected voxel
        const showRotation = this.gizmoGroup.userData.showRotation ?? true;
        if (showRotation && this.rotateArcs && this.rotateHitZones) {
            this.gizmoGroup.add(this.rotateArcs.x);
            this.gizmoGroup.add(this.rotateArcs.y);
            this.gizmoGroup.add(this.rotateArcs.z);
            
            // Also restore hit zones
            this.gizmoGroup.add(this.rotateHitZones.x);
            this.gizmoGroup.add(this.rotateHitZones.y);
            this.gizmoGroup.add(this.rotateHitZones.z);
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
        
        // Dispose move hit zones
        if (this.moveHitZones) {
            Object.values(this.moveHitZones).forEach(hitZone => {
                hitZone.traverse((child) => {
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
        
        // Dispose rotate hit zones
        if (this.rotateHitZones) {
            Object.values(this.rotateHitZones).forEach(hitZone => {
                hitZone.geometry.dispose();
                (hitZone.material as THREE.Material).dispose();
            });
        }
    }
}