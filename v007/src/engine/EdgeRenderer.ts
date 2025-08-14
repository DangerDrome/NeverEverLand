import * as THREE from 'three';
import { VoxelType } from '../types';

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
    private static readonly MAX_EDGES_TO_RENDER = 50000;  // Much higher limit - 50k voxels
    private static readonly EDGE_BATCH_SIZE = 50000;  // Don't sample, render all or none
    private isDisabledForPerformance: boolean = false;
    
    constructor(scene: THREE.Scene, voxelSize: number = 1.0, initialVisible: boolean = true) {
        this.scene = scene;
        this.voxelSize = voxelSize;
        this.visible = initialVisible;
        
        // Create thicker box geometry for edges to prevent flickering
        const edgeThickness = voxelSize * 0.04; // 4% of voxel size for thicker, more stable edges
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
        
        // Don't sample voxels - render all or none to avoid visual corruption
        let voxelsToRender = voxelData;
        
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
        // Create multiple line segments with slight offsets to simulate thickness
        const halfSize = this.voxelSize * 0.5;
        const edgeOffset = this.voxelSize * 0.002; // Small offset for multiple passes
        
        // Create 3 passes with slight offsets for thicker appearance
        for (let pass = 0; pass < 3; pass++) {
            const offset = edgeOffset * (pass - 1);
            
            // Pre-calculate buffer size for better performance
            const edgesPerVoxel = 24;  // 12 edges * 2 vertices each
            const totalVertices = voxelData.length * edgesPerVoxel;
            
            // Pre-allocate typed arrays for better performance
            const positions = new Float32Array(totalVertices * 3);
            const colors = new Float32Array(totalVertices * 3);
            
            // Pre-define edge offsets (12 edges as vertex pairs) with slight variation
            const h = halfSize + offset;
            const edgeOffsets = [
                // Bottom face
                -h, -h, -h, h, -h, -h,
                h, -h, -h, h, -h, h,
                h, -h, h, -h, -h, h,
                -h, -h, h, -h, -h, -h,
                // Top face
                -h, h, -h, h, h, -h,
                h, h, -h, h, h, h,
                h, h, h, -h, h, h,
                -h, h, h, -h, h, -h,
                // Vertical edges
                -h, -h, -h, -h, h, -h,
                h, -h, -h, h, h, -h,
                h, -h, h, h, h, h,
                -h, -h, h, -h, h, h
            ];
            
            // Use dark color for edges with varying intensity
            const intensity = pass === 1 ? 0 : 0.2; // Center line is darkest
            const baseColor = new THREE.Color(intensity, intensity, intensity);
            
            let posIndex = 0;
            let colorIndex = 0;
            
            // Process each voxel
            for (const voxel of voxelData) {
                const x = voxel.x * this.voxelSize + this.voxelSize * 0.5;
                const y = voxel.y * this.voxelSize + this.voxelSize * 0.5;
                const z = voxel.z * this.voxelSize + this.voxelSize * 0.5;
                
                // Add all edge vertices for this voxel
                for (let i = 0; i < edgeOffsets.length; i += 3) {
                    positions[posIndex++] = x + edgeOffsets[i];
                    positions[posIndex++] = y + edgeOffsets[i + 1];
                    positions[posIndex++] = z + edgeOffsets[i + 2];
                    
                    colors[colorIndex++] = baseColor.r;
                    colors[colorIndex++] = baseColor.g;
                    colors[colorIndex++] = baseColor.b;
                }
            }
            
            // Create geometry with pre-allocated buffers
            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            lineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            // Use different opacity for each pass to create depth
            const opacity = pass === 1 ? 
                (material.transparent ? 0.4 : 1.0) : // Center line more opaque
                (material.transparent ? 0.2 : 0.5);  // Outer lines less opaque
            
            const lineMaterial = new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: opacity,
                depthTest: true,
                depthWrite: false,
                linewidth: 1  // Standard width, thickness comes from multiple passes
            });
            
            const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
            lineSegments.frustumCulled = false;  // Disable frustum culling
            lineSegments.renderOrder = 2 + pass * 0.1;  // Slight render order variation
            
            // Compute bounding box for proper culling
            lineGeometry.computeBoundingBox();
            
            this.edgeMeshes.push(lineSegments as any);
            this.scene.add(lineSegments);
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