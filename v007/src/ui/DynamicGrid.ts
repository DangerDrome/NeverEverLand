import * as THREE from 'three';

export class DynamicGrid extends THREE.Group {
    private coarseGrid: THREE.LineSegments | null = null;
    private mediumGrid: THREE.LineSegments | null = null;
    private fineGrid: THREE.LineSegments | null = null;
    
    private coarseMaterial: THREE.LineBasicMaterial;
    private mediumMaterial: THREE.LineBasicMaterial;
    private fineMaterial: THREE.LineBasicMaterial;
    
    private yAxisLine: THREE.Mesh | null = null;
    private yAxisGlow: THREE.Mesh | null = null;
    private yAxisMaterial: THREE.MeshBasicMaterial;
    private yAxisGlowMaterial: THREE.MeshBasicMaterial;
    
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
        
        // Y-axis material (green for Y-up) - matching X/Z axis style
        this.yAxisMaterial = new THREE.MeshBasicMaterial({
            color: 0x66ff66,  // Bright green matching the brightness of X/Z axes
            transparent: true,
            opacity: 0,       // Start invisible
            depthWrite: false
        });
        
        // Y-axis glow material
        this.yAxisGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x66ff66,  // Same bright green
            transparent: true,
            opacity: 0,       // Start invisible
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.createGrids();
        this.createYAxis();
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
    
    private createYAxis(): void {
        // Create Y-axis line matching the style of X/Z axes
        const axisLength = 50; // Same as X/Z axes
        const axisThickness = 0.002; // Thinner to match updated X/Z axes
        
        // Main Y-axis line
        const yAxisGeometry = new THREE.BoxGeometry(axisThickness, axisLength * 2, axisThickness);
        this.yAxisLine = new THREE.Mesh(yAxisGeometry, this.yAxisMaterial);
        
        // Position at origin, extending upward
        this.yAxisLine.position.set(0, axisLength, 0);
        this.yAxisLine.renderOrder = 1; // Same as X/Z axes
        
        // Add glow effect for Y-axis
        const yGlowGeometry = new THREE.BoxGeometry(axisThickness * 3, axisLength * 2, axisThickness * 3);
        this.yAxisGlow = new THREE.Mesh(yGlowGeometry, this.yAxisGlowMaterial);
        this.yAxisGlow.position.set(0, axisLength, 0);
        this.yAxisGlow.renderOrder = 0;
        
        this.add(this.yAxisLine);
        this.add(this.yAxisGlow);
    }
    
    update(zoom: number, camera?: THREE.Camera): void {
        // Smooth zoom transitions
        this.currentZoom = THREE.MathUtils.lerp(this.currentZoom, zoom, 0.1);
        
        // Calculate angle-based fade factor
        let angleFade = 1.0;
        let dotProduct = 1.0; // Default to looking straight down
        
        if (camera) {
            // Get camera direction
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);
            
            // Calculate angle between camera direction and ground plane normal (Y-up)
            const groundNormal = new THREE.Vector3(0, 1, 0);
            dotProduct = Math.abs(cameraDir.dot(groundNormal));
            
            // Fade out when camera is at grazing angles (looking nearly horizontal)
            // dotProduct is 1 when looking straight down, 0 when looking horizontal
            // Start fading at 30 degrees (dot = 0.5), fully fade at 10 degrees (dot = 0.17)
            if (dotProduct < 0.5) {
                angleFade = THREE.MathUtils.mapLinear(dotProduct, 0.17, 0.5, 0, 1);
                angleFade = THREE.MathUtils.clamp(angleFade, 0, 1);
            }
        }
        
        // Update grid visibility and opacity based on zoom and angle
        // Coarse grid (10m) - visible at all zoom levels but fades when very close
        if (this.coarseGrid) {
            this.coarseGrid.visible = true;
            const coarseOpacity = this.currentZoom > 5 
                ? THREE.MathUtils.mapLinear(this.currentZoom, 5, 10, 0.6, 0.2)
                : 0.6;
            this.coarseMaterial.opacity = Math.max(0.2, coarseOpacity) * angleFade;
        }
        
        // Medium grid (1m) - visible from medium zoom
        if (this.mediumGrid) {
            this.mediumGrid.visible = this.currentZoom > 0.5 && angleFade > 0.1;
            if (this.mediumGrid.visible) {
                const mediumOpacity = this.currentZoom < 2
                    ? THREE.MathUtils.mapLinear(this.currentZoom, 0.5, 2, 0.1, 0.4)
                    : this.currentZoom > 5
                    ? THREE.MathUtils.mapLinear(this.currentZoom, 5, 10, 0.4, 0.2)
                    : 0.4;
                this.mediumMaterial.opacity = Math.max(0.1, mediumOpacity) * angleFade;
            }
        }
        
        // Fine grid (0.1m) - only visible when zoomed in close
        if (this.fineGrid) {
            this.fineGrid.visible = this.currentZoom > 2 && angleFade > 0.2;
            if (this.fineGrid.visible) {
                const fineOpacity = THREE.MathUtils.mapLinear(this.currentZoom, 2, 5, 0.1, 0.3);
                this.fineMaterial.opacity = Math.min(0.3, fineOpacity) * angleFade;
            }
        }
        
        // Y-axis visibility - inverse of grid visibility
        if (this.yAxisLine && this.yAxisMaterial && this.yAxisGlow && this.yAxisGlowMaterial) {
            // Y-axis fades in as grid fades out at grazing angles
            // Peak visibility around 20-30 degrees, then fades out again at very shallow angles
            let yAxisOpacity = 0;
            let yAxisGlowOpacity = 0;
            
            if (dotProduct < 0.5 && dotProduct > 0.1) {
                // Between 60 degrees and ~6 degrees from horizontal
                if (dotProduct > 0.3) {
                    // Fade in from 60 to ~45 degrees
                    yAxisOpacity = THREE.MathUtils.mapLinear(dotProduct, 0.5, 0.3, 0, 0.9);
                    yAxisGlowOpacity = THREE.MathUtils.mapLinear(dotProduct, 0.5, 0.3, 0, 0.2);
                } else {
                    // Fade out from ~45 to ~6 degrees
                    yAxisOpacity = THREE.MathUtils.mapLinear(dotProduct, 0.3, 0.1, 0.9, 0);
                    yAxisGlowOpacity = THREE.MathUtils.mapLinear(dotProduct, 0.3, 0.1, 0.2, 0);
                }
            }
            
            this.yAxisMaterial.opacity = yAxisOpacity;
            this.yAxisGlowMaterial.opacity = yAxisGlowOpacity;
            this.yAxisLine.visible = yAxisOpacity > 0.01;
            this.yAxisGlow.visible = yAxisGlowOpacity > 0.01;
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
        
        if (this.yAxisLine) {
            this.yAxisLine.geometry.dispose();
            this.remove(this.yAxisLine);
        }
        if (this.yAxisGlow) {
            this.yAxisGlow.geometry.dispose();
            this.remove(this.yAxisGlow);
        }
        
        this.coarseMaterial.dispose();
        this.mediumMaterial.dispose();
        this.fineMaterial.dispose();
        this.yAxisMaterial.dispose();
        this.yAxisGlowMaterial.dispose();
    }
}