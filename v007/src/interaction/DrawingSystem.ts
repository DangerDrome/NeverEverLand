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
        const geometry = new THREE.BoxGeometry(
            this.voxelEngine.voxelSize,
            this.voxelEngine.voxelSize,
            this.voxelEngine.voxelSize
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
        
        // For brush, eraser, and fill tools, show single preview
        if (this.toolMode === 'brush' || this.toolMode === 'eraser' || this.toolMode === 'fill') {
            // Update preview group position - offset by half voxel size to center in grid cells
            this.previewGroup.position.set(
                pos.x * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5,
                pos.y * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5,
                pos.z * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5
            );
            
            // Scale preview based on brush size
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
        
        // Store the surface normal to constrain drawing to this plane
        if (mode === 'add' && hit.normal && this.toolMode !== 'eraser') {
            this.drawingSurface = {
                normal: hit.normal.clone(),
                basePos: { ...hit.adjacentPos }, // Store the base position for all axes
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
        
        // Process any pending operations
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
    
    applyBrush(centerX: number, centerY: number, centerZ: number): void {
        const radius = Math.floor(this.brushSize / 2);
        let changed = false;
        
        // Apply brush in a cubic pattern
        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    // Optional: make it spherical
                    if (this.brushSize > 1 && x*x + y*y + z*z > radius*radius) {
                        continue;
                    }
                    
                    const vx = centerX + x;
                    const vy = centerY + y;
                    const vz = centerZ + z;
                    
                    // Apply voxel change immediately
                    if (this.drawMode === 'add') {
                        // When adding, replace any existing voxel with the new type
                        if (this.voxelEngine.setVoxel(vx, vy, vz, this.currentVoxelType)) {
                            changed = true;
                        }
                    } else {
                        // When removing (eraser mode or right-click), set to AIR
                        if (this.voxelEngine.setVoxel(vx, vy, vz, VoxelType.AIR)) {
                            changed = true;
                        }
                    }
                }
            }
        }
        
        // Update instances immediately if anything changed
        if (changed) {
            this.voxelEngine.updateInstances();
        }
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
        
        let changed = false;
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.drawMode === 'add') {
                        if (this.voxelEngine.setVoxel(x, y, z, this.currentVoxelType)) {
                            changed = true;
                        }
                    } else {
                        if (this.voxelEngine.setVoxel(x, y, z, VoxelType.AIR)) {
                            changed = true;
                        }
                    }
                }
            }
        }
        
        // Update instances immediately
        if (changed) {
            this.voxelEngine.updateInstances();
        }
    }
    
    // Line tool implementation
    applyLineTool(start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }): void {
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const dz = Math.abs(end.z - start.z);
        
        const steps = Math.max(dx, dy, dz);
        let changed = false;
        
        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            const x = Math.round(start.x + (end.x - start.x) * t);
            const y = Math.round(start.y + (end.y - start.y) * t);
            const z = Math.round(start.z + (end.z - start.z) * t);
            
            if (this.drawMode === 'add') {
                if (this.voxelEngine.setVoxel(x, y, z, this.currentVoxelType)) {
                    changed = true;
                }
            } else {
                if (this.voxelEngine.setVoxel(x, y, z, VoxelType.AIR)) {
                    changed = true;
                }
            }
        }
        
        // Update instances immediately
        if (changed) {
            this.voxelEngine.updateInstances();
        }
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
        
        // Apply fill immediately
        let changed = false;
        for (const pos of operations) {
            if (pos && this.voxelEngine.setVoxel(pos.x, pos.y, pos.z, this.currentVoxelType)) {
                changed = true;
            }
        }
        
        // Update instances immediately
        if (changed) {
            this.voxelEngine.updateInstances();
        }
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
        const width = (maxX - minX + 1) * this.voxelEngine.voxelSize;
        const height = (maxY - minY + 1) * this.voxelEngine.voxelSize;
        const depth = (maxZ - minZ + 1) * this.voxelEngine.voxelSize;
        
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
            (minX + maxX) * this.voxelEngine.voxelSize / 2 + this.voxelEngine.voxelSize * 0.5,
            (minY + maxY) * this.voxelEngine.voxelSize / 2 + this.voxelEngine.voxelSize * 0.5,
            (minZ + maxZ) * this.voxelEngine.voxelSize / 2 + this.voxelEngine.voxelSize * 0.5
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
            
            const geometry = new THREE.BoxGeometry(
                this.voxelEngine.voxelSize,
                this.voxelEngine.voxelSize,
                this.voxelEngine.voxelSize
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
                x * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5,
                y * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5,
                z * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5
            );
            
            this.voxelEngine.scene.add(group);
            this.toolPreviewMeshes.push(group);
        }
    }
}