import * as THREE from 'three';
import { VoxelType } from '../types';

// Voxel type colors for edge tinting (as RGB strings for IDE color preview)
const VOXEL_COLORS: Record<VoxelType, string> = {
    [VoxelType.AIR]: 'rgb(0, 0, 0)',
    [VoxelType.GRASS]: 'rgb(144, 238, 144)',
    [VoxelType.DIRT]: 'rgb(139, 105, 20)',
    [VoxelType.STONE]: 'rgb(105, 105, 105)',
    [VoxelType.WOOD]: 'rgb(222, 184, 135)',
    [VoxelType.LEAVES]: 'rgb(50, 205, 50)',
    [VoxelType.WATER]: 'rgb(135, 206, 235)',
    [VoxelType.SAND]: 'rgb(255, 228, 181)',
    [VoxelType.SNOW]: 'rgb(240, 248, 255)',
    [VoxelType.ICE]: 'rgb(135, 206, 235)'
};

// Transparent voxel types that should have limited edge rendering
const TRANSPARENT_TYPES = new Set([
    VoxelType.WATER,
    VoxelType.SNOW,
    VoxelType.ICE
]);

/**
 * EdgeRenderer - Renders cube edges as instanced lines on top of voxels
 * Optimized version with performance controls
 */
export class EdgeRenderer {
    private scene: THREE.Scene;
    private edgeMeshes: THREE.InstancedMesh[] = [];
    private visible: boolean = true;  // Default to visible
    private voxelSize: number;
    
    // Edge geometry - thin boxes to represent lines
    private edgeGeometry: THREE.BoxGeometry;
    private opaqueMaterial: THREE.MeshBasicMaterial;
    private transparentMaterial: THREE.MeshBasicMaterial;
    
    // Performance controls
    private static readonly MAX_EDGES_TO_RENDER = 5000;
    private static readonly EDGE_BATCH_SIZE = 1000;
    private isDisabledForPerformance: boolean = false;
    
    constructor(scene: THREE.Scene, voxelSize: number = 1.0, initialVisible: boolean = true) {
        this.scene = scene;
        this.voxelSize = voxelSize;
        this.visible = initialVisible;
        
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
        
        // Check if we should disable edges for performance
        if (voxelData.length > EdgeRenderer.MAX_EDGES_TO_RENDER) {
            this.isDisabledForPerformance = true;
            console.log(`Edge rendering disabled for performance (${voxelData.length} voxels > ${EdgeRenderer.MAX_EDGES_TO_RENDER} limit)`);
            return;
        }
        
        this.isDisabledForPerformance = false;
        
        // Only render if visible and we have voxels
        if (!this.visible || voxelData.length === 0) {
            return;
        }
        
        // For performance, only render edges for a subset of voxels if there are many
        let voxelsToRender = voxelData;
        if (voxelData.length > EdgeRenderer.EDGE_BATCH_SIZE) {
            // Sample evenly distributed voxels
            const step = Math.ceil(voxelData.length / EdgeRenderer.EDGE_BATCH_SIZE);
            voxelsToRender = voxelData.filter((_, index) => index % step === 0);
            console.log(`Rendering edges for ${voxelsToRender.length} of ${voxelData.length} voxels`);
        }
        
        // Separate transparent and opaque voxels
        const opaqueVoxels = voxelsToRender.filter(v => !TRANSPARENT_TYPES.has(v.type));
        const transparentVoxels = voxelsToRender.filter(v => TRANSPARENT_TYPES.has(v.type));
        
        // Process voxels with optimized method
        this.createOptimizedEdgeMeshes(opaqueVoxels, transparentVoxels);
    }
    
    /**
     * Create optimized edge meshes using a single mesh per material type
     */
    private createOptimizedEdgeMeshes(
        opaqueVoxels: { x: number; y: number; z: number; type: VoxelType }[],
        transparentVoxels: { x: number; y: number; z: number; type: VoxelType }[]
    ): void {
        // Create merged geometry for all edges
        const thickness = this.voxelSize * 0.02;
        
        // Process opaque voxels
        if (opaqueVoxels.length > 0) {
            this.createSingleEdgeMesh(opaqueVoxels, this.opaqueMaterial, thickness);
        }
        
        // Process transparent voxels
        if (transparentVoxels.length > 0) {
            this.createSingleEdgeMesh(transparentVoxels, this.transparentMaterial, thickness);
        }
    }
    
    /**
     * Create a single instanced mesh for all edges of given voxels
     */
    private createSingleEdgeMesh(
        voxelData: { x: number; y: number; z: number; type: VoxelType }[],
        material: THREE.Material,
        thickness: number
    ): void {
        // Create a simple wireframe box geometry
        const boxGeometry = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
        const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
        const lineGeometry = new THREE.BufferGeometry();
        
        // Convert edges to a line segments geometry
        const positions: number[] = [];
        const colors: number[] = [];
        
        for (const voxel of voxelData) {
            const x = voxel.x * this.voxelSize + this.voxelSize * 0.5;
            const y = voxel.y * this.voxelSize + this.voxelSize * 0.5;
            const z = voxel.z * this.voxelSize + this.voxelSize * 0.5;
            // Use exact voxel size for edges to prevent gaps and overlaps
            const halfSize = this.voxelSize * 0.5;
            
            // Use black edges for maximum visibility
            const baseColor = new THREE.Color(0x000000);  // Black edges for better contrast
            
            // Define the 12 edges of a cube as line segments
            const edges = [
                // Bottom face
                [-halfSize, -halfSize, -halfSize], [halfSize, -halfSize, -halfSize],
                [halfSize, -halfSize, -halfSize], [halfSize, -halfSize, halfSize],
                [halfSize, -halfSize, halfSize], [-halfSize, -halfSize, halfSize],
                [-halfSize, -halfSize, halfSize], [-halfSize, -halfSize, -halfSize],
                // Top face
                [-halfSize, halfSize, -halfSize], [halfSize, halfSize, -halfSize],
                [halfSize, halfSize, -halfSize], [halfSize, halfSize, halfSize],
                [halfSize, halfSize, halfSize], [-halfSize, halfSize, halfSize],
                [-halfSize, halfSize, halfSize], [-halfSize, halfSize, -halfSize],
                // Vertical edges
                [-halfSize, -halfSize, -halfSize], [-halfSize, halfSize, -halfSize],
                [halfSize, -halfSize, -halfSize], [halfSize, halfSize, -halfSize],
                [halfSize, -halfSize, halfSize], [halfSize, halfSize, halfSize],
                [-halfSize, -halfSize, halfSize], [-halfSize, halfSize, halfSize]
            ];
            
            // Add edge positions and colors
            for (let i = 0; i < edges.length; i += 2) {
                positions.push(
                    x + edges[i][0], y + edges[i][1], z + edges[i][2],
                    x + edges[i + 1][0], y + edges[i + 1][1], z + edges[i + 1][2]
                );
                colors.push(
                    baseColor.r, baseColor.g, baseColor.b,
                    baseColor.r, baseColor.g, baseColor.b
                );
            }
        }
        
        // Create line segments
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const lineMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: material.transparent ? 0.3 : 0.8,  // Good visibility balance
            depthTest: true,  // IMPORTANT: Test depth so backfaces are hidden
            depthWrite: false,  // Don't write to depth buffer
            linewidth: 2  // Note: linewidth > 1 only works with WebGLRenderer, not WebGL2
        });
        
        const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
        lineSegments.frustumCulled = false;  // Disable frustum culling to prevent disappearing
        lineSegments.renderOrder = 2;  // Render slightly after voxels
        
        // Compute bounding box for proper culling
        lineSegments.geometry.computeBoundingBox();
        
        this.edgeMeshes.push(lineSegments as any); // Cast to InstancedMesh type for compatibility
        this.scene.add(lineSegments);
        
        // Dispose temporary geometry
        boxGeometry.dispose();
        edgesGeometry.dispose();
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
        return this.visible && !this.isDisabledForPerformance;
    }
    
    /**
     * Set visibility state
     */
    setVisible(visible: boolean): void {
        this.visible = visible;
    }
    
    /**
     * Check if edges are disabled for performance
     */
    getIsDisabledForPerformance(): boolean {
        return this.isDisabledForPerformance;
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