import * as THREE from 'three';

/**
 * Manages wireframe overlays for baked meshes
 */
export class BakedMeshWireframe {
    private wireframeMeshes: Map<THREE.Mesh, THREE.LineSegments> = new Map();
    private showWireframe: boolean = false;
    
    /**
     * Create or update wireframe for a baked mesh
     */
    updateWireframe(bakedMesh: THREE.Mesh): void {
        // Remove existing wireframe if any
        this.removeWireframe(bakedMesh);
        
        if (!bakedMesh.geometry) return;
        
        // Create edges geometry
        const edges = new THREE.EdgesGeometry(bakedMesh.geometry);
        
        // Create line material
        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 1,
            transparent: true,
            opacity: 0.3,
            depthTest: true,
            depthWrite: false
        });
        
        // Create line segments
        const wireframe = new THREE.LineSegments(edges, material);
        wireframe.visible = this.showWireframe;
        
        // Copy transform from baked mesh
        wireframe.position.copy(bakedMesh.position);
        wireframe.rotation.copy(bakedMesh.rotation);
        wireframe.scale.copy(bakedMesh.scale);
        
        // Add to scene
        if (bakedMesh.parent) {
            bakedMesh.parent.add(wireframe);
        }
        
        // Store reference
        this.wireframeMeshes.set(bakedMesh, wireframe);
    }
    
    /**
     * Remove wireframe for a baked mesh
     */
    removeWireframe(bakedMesh: THREE.Mesh): void {
        const wireframe = this.wireframeMeshes.get(bakedMesh);
        if (wireframe) {
            if (wireframe.parent) {
                wireframe.parent.remove(wireframe);
            }
            wireframe.geometry.dispose();
            if (wireframe.material instanceof THREE.Material) {
                wireframe.material.dispose();
            }
            this.wireframeMeshes.delete(bakedMesh);
        }
    }
    
    /**
     * Toggle wireframe visibility
     */
    setVisible(visible: boolean): void {
        this.showWireframe = visible;
        for (const wireframe of this.wireframeMeshes.values()) {
            wireframe.visible = visible;
        }
    }
    
    /**
     * Update visibility of specific wireframe
     */
    updateVisibility(bakedMesh: THREE.Mesh, visible: boolean): void {
        const wireframe = this.wireframeMeshes.get(bakedMesh);
        if (wireframe) {
            wireframe.visible = visible && this.showWireframe;
        }
    }
    
    /**
     * Clear all wireframes
     */
    clear(): void {
        for (const [mesh, _] of this.wireframeMeshes) {
            this.removeWireframe(mesh);
        }
        this.wireframeMeshes.clear();
    }
    
    /**
     * Get current wireframe visibility state
     */
    isVisible(): boolean {
        return this.showWireframe;
    }
}