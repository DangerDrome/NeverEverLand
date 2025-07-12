import * as THREE from 'three';

export class AdaptiveGrid {
    constructor(size = 100, camera, scene) {
        this.size = size;
        this.camera = camera;
        this.scene = scene;
        
        // Grid levels configuration with improved visual hierarchy
        this.gridLevels = [
            { 
                name: 'major',
                spacing: 10,      // 10m grid
                color: 0x888888,  // Brighter for major lines
                baseOpacity: 1.0,
                lineWidth: 2,
                zoomRange: { min: 0, max: Infinity }
            },
            { 
                name: 'minor',
                spacing: 1,       // 1m grid
                color: 0x555555,
                baseOpacity: 0.7,
                lineWidth: 1,
                zoomRange: { min: 0, max: 30 }
            },
            { 
                name: 'fine',
                spacing: 0.5,     // 0.5m grid
                color: 0x333333,
                baseOpacity: 0.5,
                lineWidth: 1,
                zoomRange: { min: 0, max: 10 }
            },
            { 
                name: 'ultrafine',
                spacing: 0.1,     // 0.1m grid
                color: 0x222222,
                baseOpacity: 0.3,
                lineWidth: 1,
                zoomRange: { min: 0, max: 3 }
            }
        ];
        
        // Create grid groups for each level
        this.gridGroups = {};
        this.gridMaterials = {};
        
        this.createGridLevels();
        this.lastZoom = -1;
    }
    
    createGridLevels() {
        this.gridLevels.forEach(level => {
            // Create a group for this grid level
            const group = new THREE.Group();
            group.name = `grid-${level.name}`;
            
            // Create material for this level
            const material = new THREE.LineBasicMaterial({
                color: level.color,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                depthTest: true
            });
            
            this.gridMaterials[level.name] = material;
            
            // Create grid lines
            const lines = this.createGridLines(level);
            lines.forEach(line => group.add(line));
            
            this.gridGroups[level.name] = group;
            this.scene.add(group);
        });
    }
    
    createGridLines(level) {
        const lines = [];
        const halfSize = this.size / 2;
        const numLines = Math.floor(this.size / level.spacing) + 1;
        
        // Create geometry that can be reused
        const verticalGeometry = new THREE.BufferGeometry();
        const horizontalGeometry = new THREE.BufferGeometry();
        
        // Vertical lines (along Z axis)
        const verticalVertices = [];
        for (let i = 0; i < numLines; i++) {
            const x = -halfSize + i * level.spacing;
            verticalVertices.push(x, 0, -halfSize);
            verticalVertices.push(x, 0, halfSize);
        }
        
        // Horizontal lines (along X axis)
        const horizontalVertices = [];
        for (let i = 0; i < numLines; i++) {
            const z = -halfSize + i * level.spacing;
            horizontalVertices.push(-halfSize, 0, z);
            horizontalVertices.push(halfSize, 0, z);
        }
        
        // Set vertices
        verticalGeometry.setAttribute('position', 
            new THREE.Float32BufferAttribute(verticalVertices, 3));
        horizontalGeometry.setAttribute('position', 
            new THREE.Float32BufferAttribute(horizontalVertices, 3));
        
        // Create line segments
        const verticalLines = new THREE.LineSegments(verticalGeometry, this.gridMaterials[level.name]);
        const horizontalLines = new THREE.LineSegments(horizontalGeometry, this.gridMaterials[level.name]);
        
        lines.push(verticalLines, horizontalLines);
        
        return lines;
    }
    
    update() {
        // Get current zoom level from camera
        const currentZoom = this.camera.top - this.camera.bottom; // frustumSize
        
        // Always update for smooth transitions
        // Update opacity for each grid level based on zoom
        this.gridLevels.forEach(level => {
            const material = this.gridMaterials[level.name];
            const targetOpacity = this.calculateOpacity(level, currentZoom);
            
            // Smooth transition with different speeds for fade in/out
            const lerpFactor = material.opacity < targetOpacity ? 0.15 : 0.08;
            material.opacity = this.lerp(material.opacity, targetOpacity, lerpFactor);
            
            // Hide group entirely if opacity is very low
            const group = this.gridGroups[level.name];
            group.visible = material.opacity > 0.01;
        });
        
        this.lastZoom = currentZoom;
    }
    
    calculateOpacity(level, zoom) {
        const { zoomRange, baseOpacity } = level;
        
        // If we're outside the zoom range, return 0
        if (zoom < zoomRange.min || zoom > zoomRange.max) {
            return 0;
        }
        
        // Calculate fade factors for smooth transitions
        let opacity = baseOpacity;
        
        // Smooth fade transitions based on zoom level
        const fadeDistance = 3; // Distance over which to fade
        
        // Fade in near minimum zoom
        if (zoom < zoomRange.min + fadeDistance) {
            const fadeIn = (zoom - zoomRange.min) / fadeDistance;
            opacity *= this.smoothstep(0, 1, fadeIn);
        }
        
        // Fade out near maximum zoom
        if (zoomRange.max !== Infinity && zoom > zoomRange.max - fadeDistance * 2) {
            const fadeOut = (zoomRange.max - zoom) / (fadeDistance * 2);
            opacity *= this.smoothstep(0, 1, fadeOut);
        }
        
        // Additional opacity adjustments for better visual hierarchy
        if (level.name === 'minor') {
            if (zoom > 25) {
                opacity *= 0.3;
            } else if (zoom > 15) {
                opacity *= 0.6;
            }
        } else if (level.name === 'fine') {
            if (zoom > 8) {
                opacity *= 0.4;
            } else if (zoom > 5) {
                opacity *= 0.7;
            }
        } else if (level.name === 'ultrafine') {
            if (zoom > 2) {
                opacity *= 0.5;
            } else if (zoom > 1.5) {
                opacity *= 0.7;
            }
        }
        
        return opacity;
    }
    
    smoothstep(edge0, edge1, x) {
        // Scale, bias and saturate x to [0, 1] range
        x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        // Evaluate polynomial
        return x * x * (3 - 2 * x);
    }
    
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }
    
    dispose() {
        // Clean up resources
        Object.values(this.gridGroups).forEach(group => {
            group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
            });
            this.scene.remove(group);
        });
        
        Object.values(this.gridMaterials).forEach(material => {
            material.dispose();
        });
    }
    
    setVisible(visible) {
        Object.values(this.gridGroups).forEach(group => {
            group.visible = visible;
        });
    }
    
    // Helper method to get current grid spacing based on zoom
    getCurrentGridSpacing() {
        const zoom = this.camera.top - this.camera.bottom;
        
        // Return the finest visible grid spacing
        for (let i = this.gridLevels.length - 1; i >= 0; i--) {
            const level = this.gridLevels[i];
            if (zoom <= level.zoomRange.max && this.gridMaterials[level.name].opacity > 0.1) {
                return level.spacing;
            }
        }
        
        return this.gridLevels[0].spacing; // Default to major grid
    }
    
    // Snap a position to the nearest grid point
    snapToGrid(position, gridLevel = null) {
        const spacing = gridLevel ? 
            this.gridLevels.find(l => l.name === gridLevel)?.spacing || this.getCurrentGridSpacing() :
            this.getCurrentGridSpacing();
            
        return new THREE.Vector3(
            Math.round(position.x / spacing) * spacing,
            position.y,
            Math.round(position.z / spacing) * spacing
        );
    }
    
    // Get grid coordinates from world position
    getGridCoordinates(position, gridLevel = null) {
        const spacing = gridLevel ? 
            this.gridLevels.find(l => l.name === gridLevel)?.spacing || this.getCurrentGridSpacing() :
            this.getCurrentGridSpacing();
            
        return {
            x: Math.round(position.x / spacing),
            z: Math.round(position.z / spacing),
            spacing: spacing
        };
    }
}