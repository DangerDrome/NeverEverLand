/**
 * TileGrid class for creating and managing a grid-based map
 * Perfect for isometric farming/village management games
 */
class TileGrid {
    constructor(gridWidth = 10, gridHeight = 10, tileSize = 2) {
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        this.tileSize = tileSize;
        this.tiles = [];
        this.gridGroup = new THREE.Group();
        
        this.createGrid();
    }
    
    /**
     * Create the tile grid with alternating colors for visual clarity
     */
    createGrid() {
        // Create materials for different tile types
        const grassMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x4a7c3c,
            transparent: true,
            opacity: 0.9
        });
        
        const dirtMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x8b4513,
            transparent: true,
            opacity: 0.9
        });
        
        const tileMaterials = [grassMaterial, dirtMaterial];
        
        // Create tile geometry (slightly smaller than tileSize for visual separation)
        const tileGeometry = new THREE.PlaneGeometry(
            this.tileSize * 0.95, 
            this.tileSize * 0.95
        );
        
        // Calculate grid offset to center the grid at origin
        const offsetX = -(this.gridWidth - 1) * this.tileSize / 2;
        const offsetZ = -(this.gridHeight - 1) * this.tileSize / 2;
        
        // Create grid tiles
        for (let x = 0; x < this.gridWidth; x++) {
            this.tiles[x] = [];
            
            for (let z = 0; z < this.gridHeight; z++) {
                // Create tile mesh
                const materialIndex = (x + z) % 2; // Checkerboard pattern
                const tileMesh = new THREE.Mesh(tileGeometry, tileMaterials[materialIndex]);
                
                // Position tile
                tileMesh.position.set(
                    offsetX + x * this.tileSize,
                    0,
                    offsetZ + z * this.tileSize
                );
                
                // Rotate to lay flat (plane is vertical by default)
                tileMesh.rotation.x = -Math.PI / 2;
                
                // Store tile data
                const tileData = {
                    mesh: tileMesh,
                    gridX: x,
                    gridZ: z,
                    tileType: materialIndex === 0 ? 'grass' : 'dirt',
                    worldPosition: tileMesh.position.clone()
                };
                
                this.tiles[x][z] = tileData;
                this.gridGroup.add(tileMesh);
            }
        }
        
        // Add grid border for visual clarity
        this.createGridBorder();
    }
    
    /**
     * Create a border around the grid
     */
    createGridBorder() {
        const borderMaterial = new THREE.LineBasicMaterial({ 
            color: 0x666666,
            linewidth: 2
        });
        
        const borderPoints = [];
        const halfWidth = this.gridWidth * this.tileSize / 2;
        const halfHeight = this.gridHeight * this.tileSize / 2;
        
        // Create border rectangle
        borderPoints.push(new THREE.Vector3(-halfWidth, 0.01, -halfHeight));
        borderPoints.push(new THREE.Vector3(halfWidth, 0.01, -halfHeight));
        borderPoints.push(new THREE.Vector3(halfWidth, 0.01, halfHeight));
        borderPoints.push(new THREE.Vector3(-halfWidth, 0.01, halfHeight));
        borderPoints.push(new THREE.Vector3(-halfWidth, 0.01, -halfHeight));
        
        const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
        const borderLine = new THREE.Line(borderGeometry, borderMaterial);
        
        this.gridGroup.add(borderLine);
    }
    
    /**
     * Get tile at grid coordinates
     * @param {number} x - Grid X coordinate
     * @param {number} z - Grid Z coordinate
     * @returns {Object|null} Tile data or null if out of bounds
     */
    getTile(x, z) {
        if (x >= 0 && x < this.gridWidth && z >= 0 && z < this.gridHeight) {
            return this.tiles[x][z];
        }
        return null;
    }
    
    /**
     * Convert world position to grid coordinates
     * @param {THREE.Vector3} worldPosition - World position
     * @returns {Object} Grid coordinates {x, z}
     */
    worldToGrid(worldPosition) {
        const offsetX = (this.gridWidth - 1) * this.tileSize / 2;
        const offsetZ = (this.gridHeight - 1) * this.tileSize / 2;
        
        const gridX = Math.floor((worldPosition.x + offsetX) / this.tileSize);
        const gridZ = Math.floor((worldPosition.z + offsetZ) / this.tileSize);
        
        return { x: gridX, z: gridZ };
    }
    
    /**
     * Convert grid coordinates to world position
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridZ - Grid Z coordinate
     * @returns {THREE.Vector3} World position
     */
    gridToWorld(gridX, gridZ) {
        const offsetX = -(this.gridWidth - 1) * this.tileSize / 2;
        const offsetZ = -(this.gridHeight - 1) * this.tileSize / 2;
        
        return new THREE.Vector3(
            offsetX + gridX * this.tileSize,
            0,
            offsetZ + gridZ * this.tileSize
        );
    }
    
    /**
     * Change tile type at grid coordinates
     * @param {number} x - Grid X coordinate
     * @param {number} z - Grid Z coordinate
     * @param {string} tileType - New tile type ('grass' or 'dirt')
     */
    setTileType(x, z, tileType) {
        const tile = this.getTile(x, z);
        if (!tile) return;
        
        const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x4a7c3c });
        const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        
        tile.tileType = tileType;
        tile.mesh.material = tileType === 'grass' ? grassMaterial : dirtMaterial;
    }
    
    /**
     * Resize the grid (recreates all tiles)
     * @param {number} newWidth - New grid width
     * @param {number} newHeight - New grid height
     */
    resize(newWidth, newHeight) {
        // Clear existing tiles
        this.gridGroup.clear();
        this.tiles = [];
        
        // Update dimensions
        this.gridWidth = newWidth;
        this.gridHeight = newHeight;
        
        // Recreate grid
        this.createGrid();
    }
    
    /**
     * Get the grid group for adding to scene
     * @returns {THREE.Group}
     */
    getGroup() {
        return this.gridGroup;
    }
    
    /**
     * Get grid dimensions
     * @returns {Object} Grid dimensions {width, height, tileSize}
     */
    getDimensions() {
        return {
            width: this.gridWidth,
            height: this.gridHeight,
            tileSize: this.tileSize
        };
    }
} 