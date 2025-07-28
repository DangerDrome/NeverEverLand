import * as THREE from 'three';
import { VoxelType } from '../engine/VoxelEngine';

export class DrawingSystem {
    constructor(voxelEngine) {
        this.voxelEngine = voxelEngine;
        
        // Drawing state
        this.isDrawing = false;
        this.drawMode = 'add'; // 'add' or 'remove'
        this.currentVoxelType = VoxelType.GRASS;
        this.brushSize = 1;
        this.toolMode = 'brush'; // 'brush', 'box', 'line', 'fill'
        
        // Tool state
        this.boxStart = null;
        this.lineStart = null;
        
        // Preview
        this.previewMesh = null;
        this.previewMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            opacity: 0.5,
            transparent: true,
            wireframe: true
        });
        
        // Multiple preview meshes for box/line tools
        this.toolPreviewMeshes = [];
        
        // Batch operations
        this.pendingOperations = [];
        this.operationTimer = null;
        
        this.createPreviewMesh();
    }
    
    createPreviewMesh() {
        const geometry = new THREE.BoxGeometry(
            this.voxelEngine.voxelSize,
            this.voxelEngine.voxelSize,
            this.voxelEngine.voxelSize
        );
        this.previewMesh = new THREE.Mesh(geometry, this.previewMaterial);
        this.previewMesh.visible = false;
        this.voxelEngine.scene.add(this.previewMesh);
    }
    
    updatePreview(hit) {
        if (!hit) {
            this.previewMesh.visible = false;
            this.clearToolPreviews();
            return;
        }
        
        const pos = this.drawMode === 'add' ? hit.adjacentPos : hit.voxelPos;
        
        // Update tool previews
        this.updateToolPreview(hit);
        
        // For brush and fill tools, show single preview
        if (this.toolMode === 'brush' || this.toolMode === 'fill') {
            // Update preview mesh position - offset by half voxel size to center in grid cells
            this.previewMesh.position.set(
                pos.x * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5,
                pos.y * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5,
                pos.z * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5
            );
            
            // Scale preview based on brush size
            this.previewMesh.scale.setScalar(this.brushSize);
            
            // Update preview color based on mode
            if (this.drawMode === 'add') {
                this.previewMaterial.color.setHex(0x00ff00);
            } else {
                this.previewMaterial.color.setHex(0xff0000);
            }
            
            this.previewMesh.visible = true;
        } else {
            this.previewMesh.visible = false;
        }
    }
    
    startDrawing(hit, mode) {
        if (!hit) return;
        
        this.isDrawing = true;
        this.drawMode = mode;
        
        const pos = mode === 'add' ? hit.adjacentPos : hit.voxelPos;
        
        switch (this.toolMode) {
            case 'brush':
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
    
    stopDrawing() {
        this.isDrawing = false;
        this.previewMesh.visible = true;
        
        // Process any pending operations
        this.processPendingOperations();
    }
    
    applyBrush(centerX, centerY, centerZ) {
        const operations = [];
        const radius = Math.floor(this.brushSize / 2);
        
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
                    
                    operations.push({ x: vx, y: vy, z: vz });
                }
            }
        }
        
        // Add operations to pending list
        this.pendingOperations.push(...operations);
        
        // Batch update
        if (this.operationTimer) {
            clearTimeout(this.operationTimer);
        }
        
        this.operationTimer = setTimeout(() => {
            this.processPendingOperations();
        }, 16); // Update once per frame
    }
    
    processPendingOperations() {
        if (this.pendingOperations.length === 0) return;
        
        // Remove duplicates
        const uniqueOps = new Map();
        for (const op of this.pendingOperations) {
            const key = `${op.x},${op.y},${op.z}`;
            uniqueOps.set(key, op);
        }
        
        // Apply operations
        let changed = false;
        for (const op of uniqueOps.values()) {
            if (this.drawMode === 'add') {
                if (this.voxelEngine.setVoxel(op.x, op.y, op.z, this.currentVoxelType)) {
                    changed = true;
                }
            } else {
                if (this.voxelEngine.setVoxel(op.x, op.y, op.z, VoxelType.AIR)) {
                    changed = true;
                }
            }
        }
        
        // Update instances if anything changed
        if (changed) {
            this.voxelEngine.updateInstances();
        }
        
        // Clear pending operations
        this.pendingOperations = [];
        this.operationTimer = null;
    }
    
    setBrushSize(size) {
        this.brushSize = Math.max(1, Math.min(10, size));
    }
    
    setVoxelType(type) {
        if (type in VoxelType && type !== VoxelType.AIR) {
            this.currentVoxelType = type;
        }
    }
    
    nextVoxelType() {
        const types = Object.values(VoxelType).filter(t => t !== VoxelType.AIR);
        const currentIndex = types.indexOf(this.currentVoxelType);
        this.currentVoxelType = types[(currentIndex + 1) % types.length];
    }
    
    previousVoxelType() {
        const types = Object.values(VoxelType).filter(t => t !== VoxelType.AIR);
        const currentIndex = types.indexOf(this.currentVoxelType);
        this.currentVoxelType = types[(currentIndex - 1 + types.length) % types.length];
    }
    
    getCurrentVoxelTypeName() {
        const typeNames = Object.entries(VoxelType);
        const entry = typeNames.find(([name, value]) => value === this.currentVoxelType);
        return entry ? entry[0] : 'Unknown';
    }
    
    // Tool mode setters
    setToolMode(mode) {
        this.toolMode = mode;
        this.clearToolPreviews();
        this.boxStart = null;
        this.lineStart = null;
    }
    
    // Clear tool preview meshes
    clearToolPreviews() {
        for (const mesh of this.toolPreviewMeshes) {
            this.voxelEngine.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this.toolPreviewMeshes = [];
    }
    
    // Box tool implementation
    applyBoxTool(start, end) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        const minZ = Math.min(start.z, end.z);
        const maxZ = Math.max(start.z, end.z);
        
        const operations = [];
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    operations.push({ x, y, z });
                }
            }
        }
        
        this.pendingOperations = operations;
        this.processPendingOperations();
    }
    
    // Line tool implementation
    applyLineTool(start, end) {
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const dz = Math.abs(end.z - start.z);
        
        const steps = Math.max(dx, dy, dz);
        const operations = [];
        
        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            const x = Math.round(start.x + (end.x - start.x) * t);
            const y = Math.round(start.y + (end.y - start.y) * t);
            const z = Math.round(start.z + (end.z - start.z) * t);
            operations.push({ x, y, z });
        }
        
        this.pendingOperations = operations;
        this.processPendingOperations();
    }
    
    // Fill tool implementation (flood fill)
    applyFillTool(startPos) {
        const targetType = this.voxelEngine.getVoxel(startPos.x, startPos.y, startPos.z);
        if (targetType === this.currentVoxelType) return;
        
        const visited = new Set();
        const queue = [startPos];
        const operations = [];
        const maxFill = 1000; // Limit fill size for performance
        
        while (queue.length > 0 && operations.length < maxFill) {
            const pos = queue.shift();
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
        
        this.pendingOperations = operations;
        this.processPendingOperations();
    }
    
    // Update preview for tools
    updateToolPreview(hit) {
        this.clearToolPreviews();
        
        if (!hit) return;
        
        const pos = this.drawMode === 'add' ? hit.adjacentPos : hit.voxelPos;
        
        if (this.toolMode === 'box' && this.boxStart) {
            this.previewBoxTool(this.boxStart, pos);
        } else if (this.toolMode === 'line' && this.lineStart) {
            this.previewLineTool(this.lineStart, pos);
        }
    }
    
    // Preview box tool
    previewBoxTool(start, end) {
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
        const mesh = new THREE.Mesh(geometry, this.previewMaterial);
        
        mesh.position.set(
            (minX + maxX) * this.voxelEngine.voxelSize / 2 + this.voxelEngine.voxelSize * 0.5,
            (minY + maxY) * this.voxelEngine.voxelSize / 2 + this.voxelEngine.voxelSize * 0.5,
            (minZ + maxZ) * this.voxelEngine.voxelSize / 2 + this.voxelEngine.voxelSize * 0.5
        );
        
        this.voxelEngine.scene.add(mesh);
        this.toolPreviewMeshes.push(mesh);
    }
    
    // Preview line tool
    previewLineTool(start, end) {
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
            const mesh = new THREE.Mesh(geometry, this.previewMaterial);
            
            mesh.position.set(
                x * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5,
                y * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5,
                z * this.voxelEngine.voxelSize + this.voxelEngine.voxelSize * 0.5
            );
            
            this.voxelEngine.scene.add(mesh);
            this.toolPreviewMeshes.push(mesh);
        }
    }
}