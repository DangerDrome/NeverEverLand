import * as THREE from 'three';
import { VoxelType } from '../types';

// Voxel type colors for edge tinting
const VOXEL_COLORS: Record<VoxelType, number> = {
    [VoxelType.AIR]: 0x000000,
    [VoxelType.GRASS]: 0x90EE90,
    [VoxelType.DIRT]: 0x8B6914,
    [VoxelType.STONE]: 0x696969,
    [VoxelType.WOOD]: 0xDEB887,
    [VoxelType.LEAVES]: 0x32CD32,
    [VoxelType.WATER]: 0x00CED1,
    [VoxelType.SAND]: 0xFFE4B5,
    [VoxelType.SNOW]: 0xF0F8FF,
    [VoxelType.ICE]: 0x87CEEB
};

// Transparent voxel types that should have limited edge rendering
const TRANSPARENT_TYPES = new Set([
    VoxelType.WATER,
    VoxelType.SNOW,
    VoxelType.ICE
]);

/**
 * EdgeRenderer - Renders cube edges as instanced lines on top of voxels
 * Uses 12 line segments per cube (no diagonals)
 */
export class EdgeRenderer {
    private scene: THREE.Scene;
    private edgeMeshes: THREE.InstancedMesh[] = [];
    private visible: boolean = false;
    private voxelSize: number;
    
    // Edge geometry - thin boxes to represent lines
    private edgeGeometry: THREE.BoxGeometry;
    private opaqueMaterial: THREE.MeshBasicMaterial;
    private transparentMaterial: THREE.MeshBasicMaterial;
    
    constructor(scene: THREE.Scene, voxelSize: number = 1.0) {
        this.scene = scene;
        this.voxelSize = voxelSize;
        
        // Create thin box geometry for edges (like a line but with volume for instancing)
        const edgeThickness = voxelSize * 0.02; // 2% of voxel size
        this.edgeGeometry = new THREE.BoxGeometry(edgeThickness, edgeThickness, edgeThickness);
        
        // Material for opaque voxel edges
        this.opaqueMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,  // Use per-instance colors
            depthTest: true,
            depthWrite: true,
            transparent: true,
            opacity: 0.25
        });
        
        // Material for transparent voxel edges - much more subtle
        this.transparentMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,  // Use per-instance colors
            depthTest: true,
            depthWrite: false,  // Don't write to depth buffer
            transparent: true,
            opacity: 0.08  // Much more transparent for transparent voxels
        });
    }
    
    /**
     * Update edge meshes based on voxel positions and types
     */
    updateEdges(voxelData: { x: number; y: number; z: number; type: VoxelType }[]): void {
        // Clear existing edge meshes
        this.clearEdges();
        
        // Only render if visible and we have voxels
        if (!this.visible || voxelData.length === 0) {
            return;
        }
        
        // Separate transparent and opaque voxels
        const opaqueVoxels = voxelData.filter(v => !TRANSPARENT_TYPES.has(v.type));
        const transparentVoxels = voxelData.filter(v => TRANSPARENT_TYPES.has(v.type));
        
        // Process opaque voxels with normal opacity
        this.createEdgeMeshes(opaqueVoxels, this.opaqueMaterial);
        
        // Process transparent voxels with reduced opacity
        this.createEdgeMeshes(transparentVoxels, this.transparentMaterial);
    }
    
    /**
     * Create edge meshes for a set of voxels
     */
    private createEdgeMeshes(voxelData: { x: number; y: number; z: number; type: VoxelType }[], material: THREE.Material): void {
        if (voxelData.length === 0) return;
        
        // Get all edge configurations (12 edges per cube)
        const edgeConfigs = this.getEdgeConfigurations();
        const edgesPerVoxel = edgeConfigs.length;
        
        for (let edgeIndex = 0; edgeIndex < edgesPerVoxel; edgeIndex++) {
            const config = edgeConfigs[edgeIndex];
            
            // Create geometry for this edge orientation
            const edgeLength = this.voxelSize;
            const thickness = this.voxelSize * 0.02;
            
            let geometry;
            if (config.axis === 'x') {
                geometry = new THREE.BoxGeometry(edgeLength, thickness, thickness);
            } else if (config.axis === 'y') {
                geometry = new THREE.BoxGeometry(thickness, edgeLength, thickness);
            } else {
                geometry = new THREE.BoxGeometry(thickness, thickness, edgeLength);
            }
            
            // Create instanced mesh for this edge type
            const mesh = new THREE.InstancedMesh(
                geometry,
                material,
                voxelData.length
            );
            
            mesh.frustumCulled = true;
            mesh.renderOrder = 999; // Render on top
            
            // Set transforms and colors for each instance
            const tempMatrix = new THREE.Matrix4();
            const tempColor = new THREE.Color();
            
            for (let i = 0; i < voxelData.length; i++) {
                const voxel = voxelData[i];
                
                // Calculate edge position relative to voxel center
                const edgeX = voxel.x * this.voxelSize + this.voxelSize * (0.5 + config.offset.x);
                const edgeY = voxel.y * this.voxelSize + this.voxelSize * (0.5 + config.offset.y);
                const edgeZ = voxel.z * this.voxelSize + this.voxelSize * (0.5 + config.offset.z);
                
                tempMatrix.makeTranslation(edgeX, edgeY, edgeZ);
                mesh.setMatrixAt(i, tempMatrix);
                
                // Set edge color based on voxel type - darker variation of voxel color
                const baseColor = VOXEL_COLORS[voxel.type];
                tempColor.setHex(baseColor);
                
                // Darken the color for edge contrast (multiply by 0.3 to make it much darker)
                tempColor.multiplyScalar(0.3);
                
                mesh.setColorAt(i, tempColor);
            }
            
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) {
                mesh.instanceColor.needsUpdate = true;
            }
            
            this.edgeMeshes.push(mesh);
            this.scene.add(mesh);
        }
    }
    
    /**
     * Get edge configurations for a cube (12 edges)
     * Each edge is defined by its axis and offset from center
     */
    private getEdgeConfigurations(): { axis: 'x' | 'y' | 'z'; offset: { x: number; y: number; z: number } }[] {
        const s = 0.5; // Half size offset
        
        return [
            // Bottom edges (4)
            { axis: 'x', offset: { x: 0, y: -s, z: -s } }, // Bottom front
            { axis: 'x', offset: { x: 0, y: -s, z: s } },  // Bottom back
            { axis: 'z', offset: { x: -s, y: -s, z: 0 } }, // Bottom left
            { axis: 'z', offset: { x: s, y: -s, z: 0 } },  // Bottom right
            
            // Top edges (4)
            { axis: 'x', offset: { x: 0, y: s, z: -s } },  // Top front
            { axis: 'x', offset: { x: 0, y: s, z: s } },   // Top back
            { axis: 'z', offset: { x: -s, y: s, z: 0 } },  // Top left
            { axis: 'z', offset: { x: s, y: s, z: 0 } },   // Top right
            
            // Vertical edges (4)
            { axis: 'y', offset: { x: -s, y: 0, z: -s } }, // Front left
            { axis: 'y', offset: { x: s, y: 0, z: -s } },  // Front right
            { axis: 'y', offset: { x: -s, y: 0, z: s } },  // Back left
            { axis: 'y', offset: { x: s, y: 0, z: s } },   // Back right
        ];
    }
    
    /**
     * Clear all edge meshes
     */
    clearEdges(): void {
        for (const mesh of this.edgeMeshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this.edgeMeshes = [];
    }
    
    /**
     * Toggle edge visibility
     */
    toggleVisibility(): void {
        this.visible = !this.visible;
    }
    
    /**
     * Get visibility state
     */
    isVisible(): boolean {
        return this.visible;
    }
    
    /**
     * Set visibility state
     */
    setVisible(visible: boolean): void {
        this.visible = visible;
    }
    
    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.clearEdges();
        this.edgeGeometry.dispose();
        this.opaqueMaterial.dispose();
        this.transparentMaterial.dispose();
    }
}