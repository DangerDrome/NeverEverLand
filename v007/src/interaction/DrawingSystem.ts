import * as THREE from 'three';
import { VoxelType } from '../engine/VoxelEngine';

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
    toolPreviewMeshes: (THREE.Group | THREE.Mesh)[];
    pendingOperations: any[];
    operationTimer: number | null;
    
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
            opacity: 0.8,
            transparent: true
        });
        
        // Multiple preview meshes for box/line tools
        this.toolPreviewMeshes = [];
        
        // Batch operations
        this.pendingOperations = [];
        this.operationTimer = null;
        
        this.createPreviewMesh();
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
        
        this.previewGroup.visible = false;
        this.voxelEngine.scene.add(this.previewGroup);
    }
    
    updatePreview(hit: any): void {
        if (!hit) {
            this.previewGroup.visible = false;
            this.clearToolPreviews();
            return;
        }
        
        // For eraser tool, always use voxel position (removal mode)
        // For other tools, use the appropriate position based on draw mode
        const pos = (this.toolMode === 'eraser' || this.drawMode === 'remove') 
            ? hit.voxelPos 
            : hit.adjacentPos;
        
        // Update tool previews
        this.updateToolPreview(hit);
        
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
            
            // Position the preview to show the exact area that will be painted
            this.previewGroup.position.set(
                (pos.x - offsetXZ + this.brushSize / 2) * voxelSize,
                (pos.y - offsetY + this.brushSize / 2) * voxelSize,
                (pos.z - offsetXZ + this.brushSize / 2) * voxelSize
            );
            
            // Scale preview to exact brush size
            // This makes the preview box exactly cover NxNxN voxels
            this.previewGroup.scale.setScalar(this.brushSize);
            
            // Update preview color based on tool
            if (this.toolMode === 'eraser') {
                // Red preview for eraser
                this.previewMaterial.color.setHex(0xff0000);
                this.edgeMaterial.color.setHex(0xff0000);
                this.previewMaterial.opacity = 0.3; // Make it more transparent
            } else if (this.drawMode === 'add') {
                // Green preview for add
                this.previewMaterial.color.setHex(0x00ff00);
                this.edgeMaterial.color.setHex(0x00ff00);
                this.previewMaterial.opacity = 0.5;
            } else {
                // Red preview for remove
                this.previewMaterial.color.setHex(0xff0000);
                this.edgeMaterial.color.setHex(0xff0000);
                this.previewMaterial.opacity = 0.3;
            }
            
            this.previewGroup.visible = true;
        } else {
            this.previewGroup.visible = false;
        }
    }
    
    startDrawing(hit: any, mode: string): void {
        if (!hit) return;
        
        this.isDrawing = true;
        // If using eraser tool, always remove voxels
        this.drawMode = this.toolMode === 'eraser' ? 'remove' : mode;
        
        // Start batch mode for continuous drawing
        this.voxelEngine.startBatch();
        
        // Store the surface normal to constrain drawing to this plane
        // For both brush and eraser tools to prevent unwanted voxel modifications
        if (hit.normal && (this.toolMode === 'brush' || this.toolMode === 'eraser')) {
            this.drawingSurface = {
                normal: hit.normal.clone(),
                basePos: mode === 'add' ? { ...hit.adjacentPos } : { ...hit.voxelPos }, // Store appropriate position
                hitPos: { ...hit.voxelPos } // Store the hit voxel position
            };
        } else {
            this.drawingSurface = null;
        }
        
        const pos = this.drawMode === 'add' ? hit.adjacentPos : hit.voxelPos;
        
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
        this.previewGroup.visible = true;
        this.drawingSurface = null;
        
        // End batch mode and apply all changes
        this.voxelEngine.endBatch();
        
        // Force edge update after drawing completes
        this.voxelEngine.forceUpdateEdges();
        
        // Process any pending operations (legacy compatibility)
        this.processPendingOperations();
        
        // Finalize undo/redo group
        this.voxelEngine.finalizePendingOperations();
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
                        this.voxelEngine.setVoxel(vx, vy, vz, this.currentVoxelType);
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
}