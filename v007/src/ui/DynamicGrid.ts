import * as THREE from 'three';

export class DynamicGrid extends THREE.Group {
    private coarseGrid: THREE.LineSegments | null = null;
    private mediumGrid: THREE.LineSegments | null = null;
    private fineGrid: THREE.LineSegments | null = null;
    
    private coarseMaterial: THREE.LineBasicMaterial;
    private mediumMaterial: THREE.LineBasicMaterial;
    private fineMaterial: THREE.LineBasicMaterial;
    
    private currentZoom: number = 1;
    private size: number;
    private fadeDistance: number;
    
    constructor(size: number = 100) {
        super();
        this.size = size;
        this.fadeDistance = size * 0.4; // Start fading at 40% of grid size
        
        // Create materials with better visibility
        this.coarseMaterial = new THREE.LineBasicMaterial({
            color: 0x444444,  // Lighter grey
            transparent: true,
            opacity: 0.6,     // Much more visible
            depthWrite: false
        });
        
        this.mediumMaterial = new THREE.LineBasicMaterial({
            color: 0x333333,  // Medium grey
            transparent: true,
            opacity: 0.4,     // More visible
            depthWrite: false
        });
        
        this.fineMaterial = new THREE.LineBasicMaterial({
            color: 0x2a2a2a,  // Dark grey
            transparent: true,
            opacity: 0.3,     // More visible
            depthWrite: false
        });
        
        this.createGrids();
    }
    
    private createGrids(): void {
        // Coarse grid - 10m spacing
        this.coarseGrid = this.createGridLines(10, this.coarseMaterial);
        this.add(this.coarseGrid);
        
        // Medium grid - 1m spacing
        this.mediumGrid = this.createGridLines(1, this.mediumMaterial);
        this.mediumGrid.visible = false;
        this.add(this.mediumGrid);
        
        // Fine grid - 0.1m spacing (voxel size)
        this.fineGrid = this.createGridLines(0.1, this.fineMaterial);
        this.fineGrid.visible = false;
        this.add(this.fineGrid);
    }
    
    private createGridLines(spacing: number, material: THREE.Material): THREE.LineSegments {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        
        const halfSize = this.size / 2;
        const divisions = Math.floor(this.size / spacing);
        const actualHalfSize = (divisions * spacing) / 2;
        
        // Create grid lines parallel to X axis
        for (let i = 0; i <= divisions; i++) {
            const z = -actualHalfSize + i * spacing;
            
            // Calculate fade based on distance from center
            const distanceFromCenter = Math.abs(z) / this.fadeDistance;
            const fade = 1 - Math.min(1, distanceFromCenter);
            
            if (fade > 0) {
                vertices.push(-actualHalfSize, 0.001, z);
                vertices.push(actualHalfSize, 0.001, z);
            }
        }
        
        // Create grid lines parallel to Z axis
        for (let i = 0; i <= divisions; i++) {
            const x = -actualHalfSize + i * spacing;
            
            // Calculate fade based on distance from center
            const distanceFromCenter = Math.abs(x) / this.fadeDistance;
            const fade = 1 - Math.min(1, distanceFromCenter);
            
            if (fade > 0) {
                vertices.push(x, 0.001, -actualHalfSize);
                vertices.push(x, 0.001, actualHalfSize);
            }
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        return new THREE.LineSegments(geometry, material);
    }
    
    update(zoom: number): void {
        // Smooth zoom transitions
        this.currentZoom = THREE.MathUtils.lerp(this.currentZoom, zoom, 0.1);
        
        // Update grid visibility and opacity based on zoom
        // Coarse grid (10m) - visible at all zoom levels but fades when very close
        if (this.coarseGrid) {
            this.coarseGrid.visible = true;
            const coarseOpacity = this.currentZoom > 5 
                ? THREE.MathUtils.mapLinear(this.currentZoom, 5, 10, 0.6, 0.2)
                : 0.6;
            this.coarseMaterial.opacity = Math.max(0.2, coarseOpacity);
        }
        
        // Medium grid (1m) - visible from medium zoom
        if (this.mediumGrid) {
            this.mediumGrid.visible = this.currentZoom > 0.5;
            if (this.mediumGrid.visible) {
                const mediumOpacity = this.currentZoom < 2
                    ? THREE.MathUtils.mapLinear(this.currentZoom, 0.5, 2, 0.1, 0.4)
                    : this.currentZoom > 5
                    ? THREE.MathUtils.mapLinear(this.currentZoom, 5, 10, 0.4, 0.2)
                    : 0.4;
                this.mediumMaterial.opacity = Math.max(0.1, mediumOpacity);
            }
        }
        
        // Fine grid (0.1m) - only visible when zoomed in close
        if (this.fineGrid) {
            this.fineGrid.visible = this.currentZoom > 2;
            if (this.fineGrid.visible) {
                const fineOpacity = THREE.MathUtils.mapLinear(this.currentZoom, 2, 5, 0.1, 0.3);
                this.fineMaterial.opacity = Math.min(0.3, fineOpacity);
            }
        }
    }
    
    setVisible(visible: boolean): void {
        this.visible = visible;
    }
    
    dispose(): void {
        // Clean up geometries and materials
        if (this.coarseGrid) {
            this.coarseGrid.geometry.dispose();
            this.remove(this.coarseGrid);
        }
        if (this.mediumGrid) {
            this.mediumGrid.geometry.dispose();
            this.remove(this.mediumGrid);
        }
        if (this.fineGrid) {
            this.fineGrid.geometry.dispose();
            this.remove(this.fineGrid);
        }
        
        this.coarseMaterial.dispose();
        this.mediumMaterial.dispose();
        this.fineMaterial.dispose();
    }
}