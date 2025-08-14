import * as THREE from 'three';
import { VoxelType } from '../engine/VoxelEngine';
import { AssetInfo, AssetData } from '../assets/types';
import { StaticAssetManager } from '../assets/StaticAssetManager';
import { ColorRegistry } from '../engine/ColorRegistry';

export class DrawingSystem {
    // Properties
    voxelEngine: any;
    isDrawing: boolean;
    drawMode: string;
    currentVoxelType: VoxelType;
    brushSize: number;
    toolMode: string;
    boxStart: { x: number; y: number; z: number } | null;
    lineStart: { x: number; y: number; z: number } | null;
    drawingSurface: {
        normal: THREE.Vector3;
        basePos: { x: number; y: number; z: number };
        hitPos: { x: number; y: number; z: number };
    } | null;
    previewMesh: THREE.Mesh | null;
    previewGroup: THREE.Group = new THREE.Group();
    previewEdges: THREE.LineSegments | null = null;
    previewMaterial: THREE.MeshBasicMaterial;
    edgeMaterial: THREE.LineBasicMaterial;
    eraserGlowMesh: THREE.Mesh | null = null;
    eraserGlowMaterial: THREE.MeshBasicMaterial;
    toolPreviewMeshes: (THREE.Group | THREE.Mesh | THREE.LineSegments)[];
    pendingOperations: any[];
    operationTimer: number | null;
    lastBrushPosition: { x: number; y: number; z: number } | null;
    processedPositions: Set<string>;  // Track all positions processed in current drag
    constraintPlane: THREE.Mesh | null;  // Visual representation of constraint plane
    gridShowTimer: number | null;  // Timer for showing grid after hold
    gridShown: boolean;  // Track if grid is currently shown
    selectedAsset: AssetInfo | null;  // Currently selected asset
    assetData: AssetData | null;  // Loaded asset data
    assetManager: StaticAssetManager | null;  // Reference to asset manager
    assetRotation: number;  // Rotation angle in 90-degree increments (0, 1, 2, 3)
    previewTargetPosition: THREE.Vector3;  // Target position for smooth preview movement
    previewLerpFactor: number;  // How fast the preview moves (0-1)
    lastUpdateHit: any | null;  // Store last hit for preview updates
    voxelPanel: any | null;  // Reference to VoxelPanel for color selection
    
    constructor(voxelEngine: any) {
        this.voxelEngine = voxelEngine;
        
        // Drawing state
        this.isDrawing = false;
        this.drawMode = 'add'; // 'add' or 'remove'
        this.currentVoxelType = VoxelType.GRASS;
        this.brushSize = 1;
        this.toolMode = 'brush'; // 'brush', 'eraser', 'box', 'line', 'fill'
        
        // Tool state
        this.boxStart = null;
        this.lineStart = null;
        this.drawingSurface = null; // Store the surface we're drawing on
        this.lastBrushPosition = null; // Track last brush position to avoid duplicates
        this.processedPositions = new Set(); // Track all processed positions in current drag
        this.constraintPlane = null; // Visual plane indicator
        this.gridShowTimer = null; // Timer for delayed grid display
        this.gridShown = false; // Track grid visibility
        
        // Asset state
        this.selectedAsset = null;
        this.assetData = null;
        this.assetManager = null;
        this.assetRotation = 0;
        this.voxelPanel = null;
        
        // Smooth preview animation
        this.previewTargetPosition = new THREE.Vector3();
        this.previewLerpFactor = 0.75; // Subtle smoothing
        this.lastUpdateHit = null;
        
        // Preview
        this.previewMesh = null;
        this.previewMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            opacity: 0.5,
            transparent: true,
            wireframe: false
        });
        
        // Edge material for cube outlines
        this.edgeMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            opacity: 0.4,  // Subtle edges
            transparent: true
        });
        
        // Eraser glow material
        this.eraserGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            opacity: 0.6,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        // Multiple preview meshes for box/line tools
        this.toolPreviewMeshes = [];
        
        // Batch operations
        this.pendingOperations = [];
        this.operationTimer = null;
        
        this.createPreviewMesh();
    }
    
    createConstraintPlane(position: THREE.Vector3, normal: THREE.Vector3, clickPos: { x: number; y: number; z: number }, size: number = 2): void {
        // Remove existing plane if any
        this.hideConstraintPlane();
        
        // Create a group to hold the grid
        const gridGroup = new THREE.Group();
        
        const voxelSize = this.voxelEngine.getCurrentVoxelSize();
        
        // Use axis colors based on the plane orientation
        // X axis = Red (0xff0000), Y axis = Green (0x00ff00), Z axis = Blue (0x0000ff)
        let gridColor: number;
        if (Math.abs(normal.y) > 0.5) {
            // Horizontal plane (perpendicular to Y) - use green
            gridColor = 0x00ff00;
        } else if (Math.abs(normal.x) > 0.5) {
            // Vertical plane perpendicular to X - use blue
            gridColor = 0x0000ff;
        } else {
            // Vertical plane perpendicular to Z - use red
            gridColor = 0xff0000;
        }
        
        const lineOpacity = 0.3;
        
        // Create grid lines
        const gridMaterial = new THREE.LineBasicMaterial({
            color: gridColor,
            opacity: lineOpacity,
            transparent: true,
            depthTest: true,
            depthWrite: false
        });
        
        // Calculate grid extent - round to complete grid squares
        const gridStep = voxelSize; // Grid spacing matches voxel size
        const gridCount = Math.ceil(size / gridStep); // Number of grid cells per side
        const actualSize = gridCount * gridStep; // Actual size to show complete grid squares
        const halfSize = actualSize / 2;
        
        // Offset grid lines by half voxel size to align with voxel edges
        // The grid should show the edges between voxels, not their centers
        const edgeOffset = voxelSize / 2;
        
        // Create grid lines based on plane orientation
        const gridGeometry = new THREE.BufferGeometry();
        const positions: number[] = [];
        
        // Define the grid boundaries - these are the exact border positions
        const gridMin = -halfSize + edgeOffset;
        const gridMax = halfSize + edgeOffset;
        
        if (Math.abs(normal.y) > 0.5) {
            // Horizontal plane (XZ grid)
            // Lines parallel to X axis - only draw lines within the grid area
            for (let i = -gridCount + 1; i < gridCount; i++) {
                const z = i * gridStep + edgeOffset;
                // Only add line if it's within the grid boundaries
                if (z > gridMin && z < gridMax) {
                    positions.push(gridMin, 0, z);
                    positions.push(gridMax, 0, z);
                }
            }
            // Lines parallel to Z axis - only draw lines within the grid area
            for (let i = -gridCount + 1; i < gridCount; i++) {
                const x = i * gridStep + edgeOffset;
                // Only add line if it's within the grid boundaries
                if (x > gridMin && x < gridMax) {
                    positions.push(x, 0, gridMin);
                    positions.push(x, 0, gridMax);
                }
            }
        } else if (Math.abs(normal.x) > 0.5) {
            // Vertical plane facing X (YZ grid)
            // Lines parallel to Y axis - only draw lines within the grid area
            for (let i = -gridCount + 1; i < gridCount; i++) {
                const z = i * gridStep + edgeOffset;
                // Only add line if it's within the grid boundaries
                if (z > gridMin && z < gridMax) {
                    positions.push(0, gridMin, z);
                    positions.push(0, gridMax, z);
                }
            }
            // Lines parallel to Z axis - only draw lines within the grid area
            for (let i = -gridCount + 1; i < gridCount; i++) {
                const y = i * gridStep + edgeOffset;
                // Only add line if it's within the grid boundaries
                if (y > gridMin && y < gridMax) {
                    positions.push(0, y, gridMin);
                    positions.push(0, y, gridMax);
                }
            }
        } else {
            // Vertical plane facing Z (XY grid)
            // Lines parallel to X axis - only draw lines within the grid area
            for (let i = -gridCount + 1; i < gridCount; i++) {
                const y = i * gridStep + edgeOffset;
                // Only add line if it's within the grid boundaries
                if (y > gridMin && y < gridMax) {
                    positions.push(gridMin, y, 0);
                    positions.push(gridMax, y, 0);
                }
            }
            // Lines parallel to Y axis - only draw lines within the grid area
            for (let i = -gridCount + 1; i < gridCount; i++) {
                const x = i * gridStep + edgeOffset;
                // Only add line if it's within the grid boundaries
                if (x > gridMin && x < gridMax) {
                    positions.push(x, gridMin, 0);
                    positions.push(x, gridMax, 0);
                }
            }
        }
        
        gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
        gridGroup.add(gridLines);
        
        // Add border around the grid
        const borderMaterial = new THREE.LineBasicMaterial({
            color: gridColor,
            opacity: lineOpacity * 2, // Make border slightly more visible
            transparent: true,
            depthTest: true,
            depthWrite: false,
            linewidth: 2
        });
        
        const borderGeometry = new THREE.BufferGeometry();
        const borderPositions: number[] = [];
        
        // Create border based on plane orientation - align with grid boundaries
        if (Math.abs(normal.y) > 0.5) {
            // Horizontal plane border (rectangle in XZ)
            borderPositions.push(
                gridMin, 0, gridMin,
                gridMax, 0, gridMin,
                
                gridMax, 0, gridMin,
                gridMax, 0, gridMax,
                
                gridMax, 0, gridMax,
                gridMin, 0, gridMax,
                
                gridMin, 0, gridMax,
                gridMin, 0, gridMin
            );
        } else if (Math.abs(normal.x) > 0.5) {
            // Vertical X plane border (rectangle in YZ)
            borderPositions.push(
                0, gridMin, gridMin,
                0, gridMax, gridMin,
                
                0, gridMax, gridMin,
                0, gridMax, gridMax,
                
                0, gridMax, gridMax,
                0, gridMin, gridMax,
                
                0, gridMin, gridMax,
                0, gridMin, gridMin
            );
        } else {
            // Vertical Z plane border (rectangle in XY)
            borderPositions.push(
                gridMin, gridMin, 0,
                gridMax, gridMin, 0,
                
                gridMax, gridMin, 0,
                gridMax, gridMax, 0,
                
                gridMax, gridMax, 0,
                gridMin, gridMax, 0,
                
                gridMin, gridMax, 0,
                gridMin, gridMin, 0
            );
        }
        
        borderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
        const borderLines = new THREE.LineSegments(borderGeometry, borderMaterial);
        gridGroup.add(borderLines);
        
        // Add a subtle plane behind the grid for better visibility
        // The plane should match the exact border size
        const planeSize = (gridMax - gridMin); // Exact size between grid boundaries
        const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: gridColor,
            opacity: 0.05,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        
        // Position the plane to align with the grid center (accounting for the offset)
        const planeOffset = edgeOffset;
        
        // Orient and position the plane based on normal
        if (Math.abs(normal.y) > 0.5) {
            // Horizontal plane - rotate to lay flat
            planeMesh.rotation.x = -Math.PI / 2;
            planeMesh.position.set(planeOffset, 0, planeOffset);
        } else if (Math.abs(normal.x) > 0.5) {
            // Vertical plane facing X
            planeMesh.rotation.y = Math.PI / 2;
            planeMesh.position.set(0, planeOffset, planeOffset);
        } else {
            // Vertical plane facing Z - no rotation needed
            planeMesh.position.set(planeOffset, planeOffset, 0);
        }
        
        gridGroup.add(planeMesh);
        
        // Position the entire grid group at the plane position
        gridGroup.position.copy(position);
        
        // Store as constraint plane for cleanup
        this.constraintPlane = gridGroup as any;
        
        // Set render order
        gridGroup.renderOrder = -1;
        
        // Add to scene
        this.voxelEngine.scene.add(gridGroup);
    }
    
    hideConstraintPlane(): void {
        if (this.constraintPlane) {
            this.voxelEngine.scene.remove(this.constraintPlane);
            
            // Dispose of all children in the group
            if (this.constraintPlane.traverse) {
                this.constraintPlane.traverse((child: any) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach((m: THREE.Material) => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
            
            this.constraintPlane = null;
        }
    }
    
    createPreviewMesh(): void {
        const voxelSize = this.voxelEngine.getCurrentVoxelSize();
        const geometry = new THREE.BoxGeometry(
            voxelSize,
            voxelSize,
            voxelSize
        );
        
        // Create a group to hold both the mesh and edges
        this.previewGroup = new THREE.Group();
        
        // Create the solid mesh
        this.previewMesh = new THREE.Mesh(geometry, this.previewMaterial);
        this.previewGroup.add(this.previewMesh);
        
        // Create edge geometry for the outline
        const edges = new THREE.EdgesGeometry(geometry);
        this.previewEdges = new THREE.LineSegments(edges, this.edgeMaterial);
        this.previewGroup.add(this.previewEdges);
        
        // Create eraser glow mesh (slightly larger cube)
        const glowGeometry = new THREE.BoxGeometry(
            voxelSize * 1.2,
            voxelSize * 1.2,
            voxelSize * 1.2
        );
        this.eraserGlowMesh = new THREE.Mesh(glowGeometry, this.eraserGlowMaterial);
        this.eraserGlowMesh.visible = false;
        this.previewGroup.add(this.eraserGlowMesh);
        
        this.previewGroup.visible = false;
        this.voxelEngine.scene.add(this.previewGroup);
    }
    
    updatePreview(hit: any, constrainedPos?: { x: number; y: number; z: number }): void {
        // Store last hit for forced updates
        if (hit) {
            this.lastUpdateHit = hit;
        }
        
        // If we have a constrained position (during drawing), use that
        // Otherwise use the hit position or hide preview
        if (!hit && !constrainedPos) {
            this.previewGroup.visible = false;
            this.clearToolPreviews();
            return;
        }
        
        let pos;
        if (constrainedPos) {
            // Use the constrained position during drawing
            // This allows preview to overlay existing voxels
            pos = constrainedPos;
        } else if (hit) {
            // Normal preview behavior when not drawing
            pos = (this.toolMode === 'eraser' || this.drawMode === 'remove') 
                ? hit.voxelPos 
                : hit.adjacentPos;
        } else {
            this.previewGroup.visible = false;
            this.clearToolPreviews();
            return;
        }
        
        // Update tool previews
        if (hit) {
            this.updateToolPreview(hit);
        }
        
        // Handle asset preview
        if (this.toolMode === 'asset' && this.assetData) {
            // Hide the single voxel preview
            this.previewGroup.visible = false;
            this.updateAssetPreview(pos);
            return;
        }
        
        // For brush, eraser, and fill tools, show preview
        if (this.toolMode === 'brush' || this.toolMode === 'eraser' || this.toolMode === 'fill') {
            const voxelSize = this.voxelEngine.getCurrentVoxelSize();
            
            // Calculate the center position for the brush preview
            // We need to offset based on brush size to align with actual painting
            const offsetXZ = Math.floor(this.brushSize / 2);
            
            // Special handling for Y axis - match the placement logic
            let offsetY = Math.floor(this.brushSize / 2);
            if (pos.y === 0 && (this.toolMode !== 'eraser' && this.drawMode === 'add')) {
                // When placing on ground plane, preview builds UP
                offsetY = 0;
            }
            
            // Set target position for smooth animation
            const targetX = (pos.x - offsetXZ + this.brushSize / 2) * voxelSize;
            const targetY = (pos.y - offsetY + this.brushSize / 2) * voxelSize;
            const targetZ = (pos.z - offsetXZ + this.brushSize / 2) * voxelSize;
            
            this.previewTargetPosition.set(targetX, targetY, targetZ);
            
            // If preview was just made visible, instantly set position to avoid animation from (0,0,0)
            if (!this.previewGroup.visible) {
                this.previewGroup.position.set(targetX, targetY, targetZ);
            }
            
            // Scale preview to exact brush size
            // This makes the preview box exactly cover NxNxN voxels
            this.previewGroup.scale.setScalar(this.brushSize);
            
            // Update preview color based on tool and voxel type
            if (this.toolMode === 'eraser') {
                // Red glowing preview for eraser
                this.previewMaterial.color.setHex(0xff0000);
                this.edgeMaterial.color.setHex(0xffaaaa); // Brighter red edges
                this.previewMaterial.opacity = 0.5; // More visible
                this.edgeMaterial.opacity = 0.8; // Bright edges
                
                // Show and scale glow effect
                if (this.eraserGlowMesh) {
                    this.eraserGlowMesh.visible = true;
                    this.eraserGlowMesh.scale.setScalar(this.brushSize);
                    this.eraserGlowMaterial.opacity = 0.3;
                }
            } else if (this.drawMode === 'add') {
                // Check if we're using a custom color in single voxel mode
                let previewColor: THREE.Color;
                if (this.voxelPanel && this.brushSize === 1) {
                    const colorPickerPopover = (this.voxelPanel as any).getColorPickerPopover?.();
                    const colorInfo = colorPickerPopover?.getSelectedColor();
                    if (colorInfo && (this.voxelPanel as any).isInSingleVoxelMode()) {
                        // Use the actual selected color for preview
                        previewColor = new THREE.Color(colorInfo.hex);
                    } else {
                        // Use the voxel type color
                        previewColor = this.getVoxelColor(this.currentVoxelType);
                    }
                } else {
                    // Use the voxel type color for larger brushes
                    previewColor = this.getVoxelColor(this.currentVoxelType);
                }
                
                this.previewMaterial.color.set(previewColor);
                
                // For edges, use a slightly brighter version of the color
                const brightness = previewColor.r * 0.299 + previewColor.g * 0.587 + previewColor.b * 0.114;
                if (brightness < 0.3) {
                    // For very dark colors, lighten them up a bit
                    const lightEdgeColor = previewColor.clone();
                    lightEdgeColor.r = Math.min(1, lightEdgeColor.r + 0.3);
                    lightEdgeColor.g = Math.min(1, lightEdgeColor.g + 0.3);
                    lightEdgeColor.b = Math.min(1, lightEdgeColor.b + 0.3);
                    this.edgeMaterial.color.set(lightEdgeColor);
                } else {
                    // For other colors, use the preview color directly
                    this.edgeMaterial.color.set(previewColor);
                }
                
                this.previewMaterial.opacity = 0.5;
                this.edgeMaterial.opacity = 0.4; // Reset to default
                
                // Hide eraser glow
                if (this.eraserGlowMesh) {
                    this.eraserGlowMesh.visible = false;
                }
            } else {
                // Red preview for remove
                this.previewMaterial.color.setHex(0xff0000);
                this.edgeMaterial.color.setHex(0xff0000);
                this.previewMaterial.opacity = 0.3;
                this.edgeMaterial.opacity = 0.4; // Reset to default
                
                // Hide eraser glow
                if (this.eraserGlowMesh) {
                    this.eraserGlowMesh.visible = false;
                }
            }
            
            this.previewGroup.visible = true;
        } else {
            this.previewGroup.visible = false;
        }
    }
    
    startDrawing(hit: any, mode: string): void {
        if (!hit) return;
        
        // Handle asset placement
        if (this.toolMode === 'asset') {
            const pos = mode === 'add' ? hit.adjacentPos : hit.voxelPos;
            this.placeAsset(pos);
            return;
        }
        
        this.isDrawing = true;
        // If using eraser tool, always remove voxels
        this.drawMode = this.toolMode === 'eraser' ? 'remove' : mode;
        
        // Clear processed positions for new drag operation
        this.processedPositions.clear();
        
        // Start batch mode for continuous drawing
        this.voxelEngine.startBatch();
        
        // Store the surface normal to constrain drawing to this plane
        // For both brush and eraser tools to prevent unwanted voxel modifications
        if (hit.normal && (this.toolMode === 'brush' || this.toolMode === 'eraser' || mode === 'remove')) {
            // Standard voxel editor approach: 
            // - For adding: constrain to the adjacent position (where new voxels go)
            // - For removing: constrain to the voxel layer we're removing from
            let constraintPos;
            
            if (mode === 'remove') {
                // For remove mode, we need to establish the working plane
                // at the clicked face, similar to add mode but on the voxel side
                // This keeps the plane stable even after voxels are removed
                
                // Use the voxel position for now (we'll adjust plane in main.ts)
                constraintPos = { ...hit.voxelPos };
            } else {
                // For add mode, use adjacent position (standard behavior)
                constraintPos = { ...hit.adjacentPos };
            }
            
            this.drawingSurface = {
                normal: hit.normal.clone(),
                basePos: constraintPos,
                hitPos: { ...hit.voxelPos } // Store the hit voxel position
            };
            
            // Set up timer to show grid after 1 second hold
            // Don't show immediately
            const voxelSize = this.voxelEngine.getCurrentVoxelSize();
            
            // Store grid parameters for delayed display
            // Set up timer to show grid after 300ms
            this.gridShowTimer = window.setTimeout(() => {
                if (this.isDrawing && this.drawingSurface) {
                    let planePos: THREE.Vector3;
                    const absX = Math.abs(hit.normal.x);
                    const absY = Math.abs(hit.normal.y);
                    const absZ = Math.abs(hit.normal.z);
                    
                    // Position the grid at the exact face that was clicked, aligned to voxel grid
                    // For add mode: grid is at the face of the clicked voxel (where new voxels will be placed)
                    // For remove mode: grid is at the face being removed from
                    
                    // Snap to voxel grid centers for the non-constrained axes
                    const voxelCenterX = (hit.voxelPos.x + 0.5) * voxelSize;
                    const voxelCenterY = (hit.voxelPos.y + 0.5) * voxelSize;
                    const voxelCenterZ = (hit.voxelPos.z + 0.5) * voxelSize;
                    
                    if (absY > absX && absY > absZ) {
                        // Horizontal plane - Y face
                        let planeY: number;
                        if (mode === 'remove') {
                            // For remove, place at the clicked face
                            planeY = hit.normal.y > 0 ? 
                                (hit.voxelPos.y + 1) * voxelSize : // Top face of voxel
                                hit.voxelPos.y * voxelSize;         // Bottom face of voxel
                        } else {
                            // For add, place at the adjacent face where voxels will be added
                            planeY = hit.normal.y > 0 ?
                                (hit.voxelPos.y + 1) * voxelSize : // Above the voxel
                                hit.voxelPos.y * voxelSize;         // Below the voxel
                        }
                        // Align X and Z to voxel grid centers
                        planePos = new THREE.Vector3(
                            voxelCenterX,
                            planeY, 
                            voxelCenterZ
                        );
                    } else if (absX > absY && absX > absZ) {
                        // Vertical X plane - X face
                        let planeX: number;
                        if (mode === 'remove') {
                            // For remove, place at the clicked face
                            planeX = hit.normal.x > 0 ?
                                (hit.voxelPos.x + 1) * voxelSize : // Right face of voxel
                                hit.voxelPos.x * voxelSize;         // Left face of voxel
                        } else {
                            // For add, place at the adjacent face where voxels will be added
                            planeX = hit.normal.x > 0 ?
                                (hit.voxelPos.x + 1) * voxelSize : // Right of the voxel
                                hit.voxelPos.x * voxelSize;         // Left of the voxel
                        }
                        // Align Y and Z to voxel grid centers
                        planePos = new THREE.Vector3(
                            planeX,
                            voxelCenterY,
                            voxelCenterZ
                        );
                    } else {
                        // Vertical Z plane - Z face
                        let planeZ: number;
                        if (mode === 'remove') {
                            // For remove, place at the clicked face
                            planeZ = hit.normal.z > 0 ?
                                (hit.voxelPos.z + 1) * voxelSize : // Front face of voxel
                                hit.voxelPos.z * voxelSize;         // Back face of voxel
                        } else {
                            // For add, place at the adjacent face where voxels will be added
                            planeZ = hit.normal.z > 0 ?
                                (hit.voxelPos.z + 1) * voxelSize : // Front of the voxel
                                hit.voxelPos.z * voxelSize;         // Behind the voxel
                        }
                        // Align X and Y to voxel grid centers
                        planePos = new THREE.Vector3(
                            voxelCenterX,
                            voxelCenterY,
                            planeZ
                        );
                    }
                    
                    this.createConstraintPlane(planePos!, hit.normal, hit.voxelPos);
                    this.gridShown = true;
                }
            }, 300); // time to show grid after hold
        } else {
            this.drawingSurface = null;
        }
        
        const pos = this.drawMode === 'add' ? hit.adjacentPos : hit.voxelPos;
        
        // If we're in remove mode (right-click), always apply brush regardless of tool
        // This allows right-click drag to work with any tool selected
        if (this.drawMode === 'remove') {
            this.applyBrush(pos.x, pos.y, pos.z);
            // For single click (not drag), update immediately
            if (!this.voxelEngine.isBatchMode()) {
                this.voxelEngine.updateInstances();
            }
            return;  // Don't process tool-specific logic for remove mode
        }
        
        // Handle tool-specific logic for add mode
        switch (this.toolMode) {
            case 'brush':
            case 'eraser':
                this.applyBrush(pos.x, pos.y, pos.z);
                // For single click (not drag), update immediately
                if (!this.voxelEngine.isBatchMode()) {
                    this.voxelEngine.updateInstances();
                }
                break;
            case 'box':
                if (!this.boxStart) {
                    this.boxStart = pos;
                } else {
                    this.applyBoxTool(this.boxStart, pos);
                    this.boxStart = null;
                    this.clearToolPreviews();
                }
                break;
            case 'line':
                if (!this.lineStart) {
                    this.lineStart = pos;
                } else {
                    this.applyLineTool(this.lineStart, pos);
                    this.lineStart = null;
                    this.clearToolPreviews();
                }
                break;
            case 'fill':
                this.applyFillTool(pos);
                break;
        }
    }
    
    stopDrawing(): void {
        this.isDrawing = false;
        // Only show preview for non-asset tools
        if (this.toolMode !== 'asset') {
            this.previewGroup.visible = true;
        }
        this.drawingSurface = null;
        
        // Clear grid timer and hide the constraint plane
        if (this.gridShowTimer) {
            clearTimeout(this.gridShowTimer);
            this.gridShowTimer = null;
        }
        this.hideConstraintPlane();
        this.gridShown = false;
        
        // Get operation count before ending batch
        const operationCount = this.voxelEngine.getBatchOperationCount ? 
            this.voxelEngine.getBatchOperationCount() : 0;
        
        // End batch mode and apply all changes
        this.voxelEngine.endBatch();
        
        // Force edge update after drawing completes
        this.voxelEngine.forceUpdateEdges();
        
        // Process any pending operations (legacy compatibility)
        this.processPendingOperations();
        
        // Finalize undo/redo group
        this.voxelEngine.finalizePendingOperations();
        
        // Log the operation
        if (operationCount > 0) {
            import('../ui/ActionLogger').then(({ ActionLogger }) => {
                const logger = ActionLogger.getInstance();
                if (this.drawMode === 'add') {
                    logger.log(ActionLogger.actions.placeVoxel(operationCount));
                } else {
                    logger.log(ActionLogger.actions.removeVoxel(operationCount));
                }
            });
        }
    }
    
    /**
     * Hide the preview (e.g., when switching to selection mode)
     */
    hidePreview(): void {
        this.previewGroup.visible = false;
        this.clearToolPreviews();
    }
    
    /**
     * Show the preview (e.g., when returning to drawing mode)
     */
    showPreview(): void {
        this.previewGroup.visible = true;
    }
    
    /**
     * Update method for smooth preview animation (called from main animate loop)
     */
    update(): void {
        // Smoothly interpolate preview position
        if (this.previewGroup.visible) {
            this.previewGroup.position.lerp(this.previewTargetPosition, this.previewLerpFactor);
        }
    }
    
    // Voxel size is now fixed at 0.1m, no need for this method
    
    applyBrush(centerX: number, centerY: number, centerZ: number): void {
        // Calculate the offset to center the brush
        // For even sizes, we offset by half to center on the clicked voxel
        // For odd sizes, the center is naturally at the clicked position
        const offsetXZ = Math.floor(this.brushSize / 2);
        
        // Special handling for Y axis - never go below ground (y=0)
        // When placing on ground, always build UP
        let offsetY = Math.floor(this.brushSize / 2);
        if (centerY === 0 && this.drawMode === 'add') {
            // When placing on ground plane, don't offset Y downward
            offsetY = 0;
        }
        
        // Get the voxel type to use (may be mapped from custom color)
        let voxelTypeToUse = this.currentVoxelType;
        
        // Check if we're in single voxel mode with a custom color
        if (this.voxelPanel && this.brushSize === 1 && this.drawMode === 'add') {
            const colorOrType = this.voxelPanel.getSelectedColorOrType();
            if (colorOrType.isCustomColor) {
                voxelTypeToUse = colorOrType.type;
            }
        }
        
        // Apply brush in an exact NxNxN cubic pattern
        for (let x = 0; x < this.brushSize; x++) {
            for (let y = 0; y < this.brushSize; y++) {
                for (let z = 0; z < this.brushSize; z++) {
                    // Calculate actual voxel position
                    const vx = centerX + x - offsetXZ;
                    const vy = centerY + y - offsetY;
                    const vz = centerZ + z - offsetXZ;
                    
                    // Skip voxels below ground when adding
                    if (vy < 0 && this.drawMode === 'add') {
                        continue;
                    }
                    
                    // Apply voxel change (batched internally)
                    if (this.drawMode === 'add') {
                        // When adding, replace any existing voxel with the new type
                        this.voxelEngine.setVoxel(vx, vy, vz, voxelTypeToUse);
                    } else {
                        // When removing (eraser mode or right-click), set to AIR
                        this.voxelEngine.setVoxel(vx, vy, vz, VoxelType.AIR);
                    }
                }
            }
        }
        
        // DON'T update instances here - let batch mode handle it!
        // The update will happen when stopDrawing() calls endBatch()
    }
    
    // Legacy method - no longer used but kept for compatibility
    processPendingOperations(): void {
        // This method is no longer used as we apply operations immediately
        // Kept for compatibility in case it's called from elsewhere
        this.pendingOperations = [];
        this.operationTimer = null;
    }
    
    setBrushSize(size: number): void {
        this.brushSize = Math.max(1, Math.min(10, size));
    }
    
    setVoxelType(type: VoxelType): void {
        if (type in VoxelType && type !== VoxelType.AIR) {
            this.currentVoxelType = type;
        }
    }
    
    nextVoxelType(): void {
        const types = Object.values(VoxelType).filter(t => typeof t === 'number' && t !== VoxelType.AIR) as VoxelType[];
        const currentIndex = types.indexOf(this.currentVoxelType);
        this.currentVoxelType = types[(currentIndex + 1) % types.length];
    }
    
    previousVoxelType(): void {
        const types = Object.values(VoxelType).filter(t => typeof t === 'number' && t !== VoxelType.AIR) as VoxelType[];
        const currentIndex = types.indexOf(this.currentVoxelType);
        this.currentVoxelType = types[(currentIndex - 1 + types.length) % types.length];
    }
    
    getCurrentVoxelTypeName(): string {
        const typeNames = Object.entries(VoxelType);
        const entry = typeNames.find(([_name, value]) => value === this.currentVoxelType);
        return entry ? entry[0] : 'Unknown';
    }
    
    // Tool mode setters
    setToolMode(mode: string): void {
        this.toolMode = mode;
        this.clearToolPreviews();
        this.boxStart = null;
        this.lineStart = null;
        
        // Update current tool display in info bar
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            const toolNames: { [key: string]: string } = {
                'brush': 'Brush',
                'eraser': 'Eraser',
                'box': 'Box',
                'line': 'Line',
                'fill': 'Fill',
                'asset': 'Asset'
            };
            toolElement.textContent = toolNames[mode] || mode;
        }
        
        // Log tool change
        import('../ui/ActionLogger').then(({ ActionLogger }) => {
            const logger = ActionLogger.getInstance();
            logger.log(ActionLogger.actions.selectTool(mode));
        });
        
        // Clear asset selection when switching tools
        if (mode !== 'asset') {
            this.selectedAsset = null;
            this.assetData = null;
            // Show single voxel preview for brush/eraser/fill modes
            if (mode === 'brush' || mode === 'eraser' || mode === 'fill') {
                this.previewGroup.visible = true;
            }
        } else {
            // Hide single voxel preview when switching to asset mode
            this.previewGroup.visible = false;
        }
        
        // Force preview update with current mouse position
        // This ensures preview colors/styles update immediately
        this.lastUpdateHit = null; // Force a fresh update
    }
    
    setAssetManager(assetManager: StaticAssetManager): void {
        this.assetManager = assetManager;
    }
    
    setVoxelPanel(voxelPanel: any): void {
        this.voxelPanel = voxelPanel;
    }
    
    async setSelectedAsset(asset: AssetInfo | null): Promise<void> {
        this.selectedAsset = asset;
        this.assetRotation = 0; // Reset rotation
        
        if (asset && this.assetManager) {
            try {
                // Load asset data
                this.assetData = await this.assetManager.loadAsset(asset.id);
                // Switch to asset placement mode
                this.toolMode = 'asset';
                // Hide single voxel preview
                this.previewGroup.visible = false;
                console.log(`Loaded asset: ${asset.name} with ${this.assetData.voxelData.size} voxels`);
            } catch (error) {
                console.error(`Failed to load asset ${asset.id}:`, error);
                this.selectedAsset = null;
                this.assetData = null;
                // Fall back to brush mode
                this.toolMode = 'brush';
            }
        } else {
            this.assetData = null;
            // No asset selected, default to brush mode
            this.toolMode = 'brush';
        }
        
        this.clearToolPreviews();
    }
    
    rotateAsset(): void {
        this.assetRotation = (this.assetRotation + 1) % 4;
        console.log(`Asset rotation: ${this.assetRotation * 90}°`);
        // Update preview will be called by the regular update cycle
    }
    
    // Clear tool preview meshes
    clearToolPreviews(): void {
        for (const item of this.toolPreviewMeshes) {
            this.voxelEngine.scene.remove(item);
            
            // If it's a group, traverse and dispose all children
            if (item.type === 'Group') {
                item.traverse((child: any) => {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        child.material.dispose();
                    }
                });
            } else if ('geometry' in item && item.geometry) {
                // If it's a mesh, dispose its geometry
                item.geometry.dispose();
            }
        }
        this.toolPreviewMeshes = [];
    }
    
    // Box tool implementation
    applyBoxTool(start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }): void {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        const minZ = Math.min(start.z, end.z);
        const maxZ = Math.max(start.z, end.z);
        
        // Start batch for box operation
        this.voxelEngine.startBatch();
        
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.drawMode === 'add') {
                        this.voxelEngine.setVoxel(x, y, z, this.currentVoxelType);
                    } else {
                        this.voxelEngine.setVoxel(x, y, z, VoxelType.AIR);
                    }
                }
            }
        }
        
        // End batch and update
        this.voxelEngine.endBatch();
    }
    
    // Line tool implementation
    applyLineTool(start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }): void {
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const dz = Math.abs(end.z - start.z);
        
        const steps = Math.max(dx, dy, dz);
        
        // Start batch for line operation
        this.voxelEngine.startBatch();
        
        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            const x = Math.round(start.x + (end.x - start.x) * t);
            const y = Math.round(start.y + (end.y - start.y) * t);
            const z = Math.round(start.z + (end.z - start.z) * t);
            
            if (this.drawMode === 'add') {
                this.voxelEngine.setVoxel(x, y, z, this.currentVoxelType);
            } else {
                this.voxelEngine.setVoxel(x, y, z, VoxelType.AIR);
            }
        }
        
        // End batch and update
        this.voxelEngine.endBatch();
    }
    
    // Fill tool implementation (flood fill)
    applyFillTool(startPos: { x: number; y: number; z: number }): void {
        const targetType = this.voxelEngine.getVoxel(startPos.x, startPos.y, startPos.z);
        if (targetType === this.currentVoxelType) return;
        
        const visited = new Set();
        const queue = [startPos];
        const operations = [];
        const maxFill = 1000; // Limit fill size for performance
        
        while (queue.length > 0 && operations.length < maxFill) {
            const pos = queue.shift();
            if (!pos) continue;
            
            const key = `${pos.x},${pos.y},${pos.z}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            const currentType = this.voxelEngine.getVoxel(pos.x, pos.y, pos.z);
            if (currentType !== targetType) continue;
            
            operations.push(pos);
            
            // Add adjacent positions
            const adjacent = [
                { x: pos.x + 1, y: pos.y, z: pos.z },
                { x: pos.x - 1, y: pos.y, z: pos.z },
                { x: pos.x, y: pos.y + 1, z: pos.z },
                { x: pos.x, y: pos.y - 1, z: pos.z },
                { x: pos.x, y: pos.y, z: pos.z + 1 },
                { x: pos.x, y: pos.y, z: pos.z - 1 }
            ];
            
            for (const adj of adjacent) {
                const adjKey = `${adj.x},${adj.y},${adj.z}`;
                if (!visited.has(adjKey)) {
                    queue.push(adj);
                }
            }
        }
        
        // Start batch for fill operation
        this.voxelEngine.startBatch();
        
        // Apply all fill operations
        for (const pos of operations) {
            if (pos) {
                this.voxelEngine.setVoxel(pos.x, pos.y, pos.z, this.currentVoxelType);
            }
        }
        
        // End batch and update
        this.voxelEngine.endBatch();
    }
    
    // Update preview for tools
    updateToolPreview(hit: any): void {
        this.clearToolPreviews();
        
        if (!hit) return;
        
        // For eraser tool, always use voxel position
        const pos = (this.toolMode === 'eraser' || this.drawMode === 'remove') 
            ? hit.voxelPos 
            : hit.adjacentPos;
        
        if (this.toolMode === 'box' && this.boxStart) {
            this.previewBoxTool(this.boxStart, pos);
        } else if (this.toolMode === 'line' && this.lineStart) {
            this.previewLineTool(this.lineStart, pos);
        }
    }
    
    // Preview box tool
    previewBoxTool(start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }): void {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        const minZ = Math.min(start.z, end.z);
        const maxZ = Math.max(start.z, end.z);
        
        // Create a single mesh for the box outline
        const voxelSize = this.voxelEngine.getCurrentVoxelSize();
        const width = (maxX - minX + 1) * voxelSize;
        const height = (maxY - minY + 1) * voxelSize;
        const depth = (maxZ - minZ + 1) * voxelSize;
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        
        // Create a group for mesh and edges
        const group = new THREE.Group();
        
        // Add solid mesh
        const mesh = new THREE.Mesh(geometry, this.previewMaterial);
        group.add(mesh);
        
        // Add edge outline
        const edges = new THREE.EdgesGeometry(geometry);
        const edgeLines = new THREE.LineSegments(edges, this.edgeMaterial);
        group.add(edgeLines);
        
        group.position.set(
            (minX + maxX) * voxelSize / 2 + voxelSize * 0.5,
            (minY + maxY) * voxelSize / 2 + voxelSize * 0.5,
            (minZ + maxZ) * voxelSize / 2 + voxelSize * 0.5
        );
        
        this.voxelEngine.scene.add(group);
        this.toolPreviewMeshes.push(group);
    }
    
    // Preview line tool
    previewLineTool(start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }): void {
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const dz = Math.abs(end.z - start.z);
        
        const steps = Math.max(dx, dy, dz);
        
        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            const x = Math.round(start.x + (end.x - start.x) * t);
            const y = Math.round(start.y + (end.y - start.y) * t);
            const z = Math.round(start.z + (end.z - start.z) * t);
            
            const voxelSize = this.voxelEngine.getCurrentVoxelSize();
            const geometry = new THREE.BoxGeometry(
                voxelSize,
                voxelSize,
                voxelSize
            );
            
            // Create a group for mesh and edges
            const group = new THREE.Group();
            
            // Add solid mesh
            const mesh = new THREE.Mesh(geometry, this.previewMaterial);
            group.add(mesh);
            
            // Add edge outline
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeLines = new THREE.LineSegments(edges, this.edgeMaterial);
            group.add(edgeLines);
            
            group.position.set(
                x * voxelSize + voxelSize * 0.5,
                y * voxelSize + voxelSize * 0.5,
                z * voxelSize + voxelSize * 0.5
            );
            
            this.voxelEngine.scene.add(group);
            this.toolPreviewMeshes.push(group);
        }
    }
    
    // Update preview for asset placement
    updateAssetPreview(pos: { x: number; y: number; z: number }): void {
        this.clearToolPreviews();
        
        if (!this.assetData || !this.selectedAsset) return;
        
        const voxelSize = this.voxelEngine.getCurrentVoxelSize();
        
        // Get asset bounds to calculate center offset
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        for (const [posKey, _] of this.assetData.voxelData) {
            const [x, y, z] = posKey.split(',').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
        }
        
        // Calculate center offset
        const centerX = (minX + maxX) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        // Create a group for the entire asset preview
        const assetGroup = new THREE.Group();
        
        // Create preview for each voxel in the asset
        for (const [posKey, voxelType] of this.assetData.voxelData) {
            const [vx, vy, vz] = posKey.split(',').map(Number);
            
            // Apply rotation
            let rotatedX = vx - centerX;
            let rotatedZ = vz - centerZ;
            
            for (let r = 0; r < this.assetRotation; r++) {
                const temp = rotatedX;
                rotatedX = -rotatedZ;
                rotatedZ = temp;
            }
            
            // Final position
            const finalX = pos.x + Math.round(rotatedX + centerX);
            const finalY = pos.y + vy;
            const finalZ = pos.z + Math.round(rotatedZ + centerZ);
            
            // Create preview mesh with ghost effect
            const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
            const voxelColor = this.getVoxelColor(voxelType);
            const material = new THREE.MeshBasicMaterial({
                color: voxelColor,
                opacity: 0.25,  // More transparent for ghost effect
                transparent: true,
                depthWrite: false  // Prevent depth issues
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (finalX + 0.5) * voxelSize,
                (finalY + 0.5) * voxelSize,
                (finalZ + 0.5) * voxelSize
            );
            
            // Add edge geometry with bright edges for visibility
            const edges = new THREE.EdgesGeometry(geometry);
            
            // Create a subtle edge material for this specific voxel
            const brightness = voxelColor.r * 0.299 + voxelColor.g * 0.587 + voxelColor.b * 0.114;
            let edgeColor = voxelColor;
            if (brightness < 0.3) {
                // For very dark colors, lighten them slightly
                edgeColor = voxelColor.clone();
                edgeColor.r = Math.min(1, edgeColor.r + 0.3);
                edgeColor.g = Math.min(1, edgeColor.g + 0.3);
                edgeColor.b = Math.min(1, edgeColor.b + 0.3);
            }
            
            const edgeMat = new THREE.LineBasicMaterial({
                color: edgeColor,
                opacity: 0.6,  // Slightly more visible edges
                transparent: true,
                depthWrite: false
            });
            
            const edgeMesh = new THREE.LineSegments(edges, edgeMat);
            edgeMesh.position.copy(mesh.position);
            
            assetGroup.add(mesh);
            assetGroup.add(edgeMesh);
        }
        
        // Add subtle overall glow to the entire asset
        const boundingBox = new THREE.Box3().setFromObject(assetGroup);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        // Create a slightly larger box for glow effect
        const glowGeometry = new THREE.BoxGeometry(
            size.x + voxelSize * 0.2,
            size.y + voxelSize * 0.2,
            size.z + voxelSize * 0.2
        );
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            opacity: 0.1,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.position.copy(center);
        assetGroup.add(glowMesh);
        
        this.voxelEngine.scene.add(assetGroup);
        this.toolPreviewMeshes.push(assetGroup);
    }
    
    // Get voxel color based on type
    private getVoxelColor(type: VoxelType): THREE.Color {
        // Try to get color from ColorRegistry first (for custom colors)
        const colorRegistry = ColorRegistry.getInstance();
        const registeredColor = colorRegistry.getColor(type);
        if (registeredColor) {
            return new THREE.Color(registeredColor);
        }
        
        // Fallback to predefined colors for standard types
        const colors: Record<VoxelType, string> = {
            [VoxelType.AIR]: 'rgb(0, 0, 0)',
            [VoxelType.GRASS]: 'rgb(144, 238, 144)',      // Light pastel green
            [VoxelType.DIRT]: 'rgb(139, 105, 20)',        // Dark goldenrod (brownish)
            [VoxelType.STONE]: 'rgb(105, 105, 105)',      // Dim gray
            [VoxelType.WOOD]: 'rgb(222, 184, 135)',       // Burlywood (light brown)
            [VoxelType.LEAVES]: 'rgb(50, 205, 50)',       // Lime green
            [VoxelType.WATER]: 'rgb(135, 206, 235)',      // Sky blue
            [VoxelType.SAND]: 'rgb(255, 228, 181)',       // Moccasin (sandy color)
            [VoxelType.SNOW]: 'rgb(240, 248, 255)',       // Alice blue
            [VoxelType.ICE]: 'rgb(135, 206, 235)'         // Sky blue
        };
        
        const colorStr = colors[type] || 'rgb(255, 255, 255)';
        return new THREE.Color(colorStr);
    }
    
    // Place asset at position
    placeAsset(pos: { x: number; y: number; z: number }): void {
        if (!this.assetData || !this.selectedAsset) return;
        
        console.log(`Placing asset: ${this.selectedAsset.name} at ${pos.x}, ${pos.y}, ${pos.z}`);
        
        // Get asset bounds to calculate center offset
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        for (const [posKey, _] of this.assetData.voxelData) {
            const [x, y, z] = posKey.split(',').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
        }
        
        // Calculate center offset
        const centerX = (minX + maxX) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        // Place each voxel in the asset
        for (const [posKey, voxelType] of this.assetData.voxelData) {
            const [vx, vy, vz] = posKey.split(',').map(Number);
            
            // Apply rotation
            let rotatedX = vx - centerX;
            let rotatedZ = vz - centerZ;
            
            for (let r = 0; r < this.assetRotation; r++) {
                const temp = rotatedX;
                rotatedX = -rotatedZ;
                rotatedZ = temp;
            }
            
            // Final position
            const finalX = pos.x + Math.round(rotatedX + centerX);
            const finalY = pos.y + vy;
            const finalZ = pos.z + Math.round(rotatedZ + centerZ);
            
            // Place voxel
            this.voxelEngine.setVoxel(finalX, finalY, finalZ, voxelType);
        }
        
        // Update instances
        this.voxelEngine.updateInstances();
    }
}