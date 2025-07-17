import * as THREE from 'three';

/**
 * Tile type definitions and factory for the tile map system
 * Provides standardized tile properties, geometries, and materials
 */
export class TileTypes {
    constructor() {
        this.types = new Map();
        this.geometries = new Map();
        this.materials = new Map();
        this.textures = new Map();
        
        this.initializeBasicTiles();
    }
    
    /**
     * Initialize basic tile types for the system
     */
    initializeBasicTiles() {
        // Grass terrain tile
        this.registerTileType('grass', {
            name: 'Grass',
            category: 'terrain',
            geometry: 'box',
            material: 'grass',
            size: { width: 1, height: 0.25, depth: 1 },
            color: 0x4CAF50,
            texture: null,
            solid: false,
            walkable: true,
            rotatable: false
        });
        
        // Stone floor tile
        this.registerTileType('stone', {
            name: 'Stone Floor',
            category: 'terrain',
            geometry: 'box',
            material: 'stone',
            size: { width: 1, height: 0.25, depth: 1 },
            color: 0x757575,
            texture: null,
            solid: false,
            walkable: true,
            rotatable: false
        });
        
        // Water tile
        this.registerTileType('water', {
            name: 'Water',
            category: 'terrain',
            geometry: 'box',
            material: 'water',
            size: { width: 1, height: 0.25, depth: 1 },
            color: 0x2196F3,
            texture: null,
            solid: false,
            walkable: false,
            rotatable: false
        });
        
        // Basic wall tile
        this.registerTileType('wall', {
            name: 'Wall',
            category: 'structure',
            geometry: 'cube',
            material: 'brick',
            size: { width: 1, height: 1, depth: 1 },
            color: 0x8D6E63,
            texture: null,
            solid: true,
            walkable: false,
            rotatable: true
        });
        
        // Tree tile - now uses cone geometry with random height
        this.registerTileType('tree', {
            name: 'Tree',
            category: 'nature',
            geometry: 'cone',
            material: 'tree',
            size: { width: 1.2, height: 2.5, depth: 1.2 }, // Base size, will be randomized
            color: 0x2E7D32,
            texture: null,
            solid: true,
            walkable: false,
            rotatable: false,
            randomHeight: { min: 1, max: 4 } // Random height range in meters
        });

        // L-System tree - uses custom L-system generation
        this.registerTileType('ltree', {
            name: 'L-Tree',
            category: 'nature',
            geometry: 'lsystem',
            material: 'tree',
            size: { width: 3, height: 4, depth: 3 }, // Larger area for branches
            color: 0x2E7D32,
            texture: null,
            solid: true,
            walkable: false,
            rotatable: false,
            randomHeight: { min: 3, max: 5 } // Height range for L-system trees
        });
        
        // House foundation
        this.registerTileType('foundation', {
            name: 'Foundation',
            category: 'structure',
            geometry: 'cube',
            material: 'concrete',
            size: { width: 1, height: 0.2, depth: 1 },
            color: 0x9E9E9E,
            texture: null,
            solid: true,
            walkable: true,
            rotatable: false
        });
        
        // Create basic geometries
        this.createBasicGeometries();
        
        // Create basic materials
        this.createBasicMaterials();
    }
    
    /**
     * Register a new tile type
     */
    registerTileType(id, definition) {
        this.types.set(id, {
            id,
            ...definition
        });
    }
    
    /**
     * Get tile type definition by ID
     */
    getTileType(id) {
        return this.types.get(id);
    }
    
    /**
     * Get all tile types, optionally filtered by category
     */
    getTileTypes(category = null) {
        if (category) {
            return Array.from(this.types.values()).filter(type => type.category === category);
        }
        return Array.from(this.types.values());
    }
    
    /**
     * Get all tile categories
     */
    getCategories() {
        const categories = new Set();
        this.types.forEach(type => categories.add(type.category));
        return Array.from(categories);
    }
    
    /**
     * Create basic geometries for tiles
     */
    createBasicGeometries() {
        // Plane geometry for floor tiles
        this.geometries.set('plane', new THREE.PlaneGeometry(1, 1));
        
        // Box geometry for terrain tiles (0.25m tall)
        this.geometries.set('box', new THREE.BoxGeometry(1, 0.25, 1));
        
        // Cube geometry for walls and structures
        this.geometries.set('cube', new THREE.BoxGeometry(1, 1, 1));
        
        // Cylinder geometry for posts
        this.geometries.set('cylinder', new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
        
        // Cone geometry for trees
        this.geometries.set('cone', new THREE.ConeGeometry(0.5, 1, 8));
        
        // Sphere geometry for decorative elements
        this.geometries.set('sphere', new THREE.SphereGeometry(0.5, 8, 6));
    }
    
    /**
     * Create basic materials for tiles
     */
    createBasicMaterials() {
        // Grass material with flat shading for visible edges
        this.materials.set('grass', new THREE.MeshPhongMaterial({ 
            color: 0x4CAF50,
            shininess: 5,
            specular: 0x111111,
            flatShading: true
        }));
        
        // Stone material with flat shading
        this.materials.set('stone', new THREE.MeshPhongMaterial({ 
            color: 0x757575,
            shininess: 10,
            specular: 0x222222,
            flatShading: true
        }));
        
        // Water material (slightly transparent) with flat shading
        this.materials.set('water', new THREE.MeshPhongMaterial({ 
            color: 0x2196F3,
            transparent: true,
            opacity: 0.7,
            shininess: 30,
            specular: 0x4444ff,
            flatShading: true
        }));
        
        // Brick material for walls with flat shading
        this.materials.set('brick', new THREE.MeshPhongMaterial({ 
            color: 0x8D6E63,
            shininess: 5,
            specular: 0x222222,
            flatShading: true
        }));
        
        // Wood material with flat shading
        this.materials.set('wood', new THREE.MeshPhongMaterial({ 
            color: 0x8D6E63,
            shininess: 5,
            specular: 0x111111,
            flatShading: true
        }));
        
        // Tree material (dark green pine) with flat shading
        this.materials.set('tree', new THREE.MeshPhongMaterial({ 
            color: 0x2E7D32,
            shininess: 10,
            specular: 0x111111,
            flatShading: true
        }));
        
        // Concrete material with flat shading
        this.materials.set('concrete', new THREE.MeshPhongMaterial({ 
            color: 0x9E9E9E,
            shininess: 20,
            specular: 0x333333,
            flatShading: true
        }));
    }
    
    /**
     * Get geometry for a tile type
     */
    getGeometry(tileTypeId, applyRandomScale = true) {
        const tileType = this.getTileType(tileTypeId);
        if (!tileType) return null;
        
        // For box geometry, create it directly with the specified size
        if (tileType.geometry === 'box') {
            const { width, height, depth } = tileType.size;
            return new THREE.BoxGeometry(width, height, depth);
        }
        
        const baseGeometry = this.geometries.get(tileType.geometry);
        if (!baseGeometry) return null;
        
        // Clone and scale geometry based on tile size
        const geometry = baseGeometry.clone();
        let { width, height, depth } = tileType.size;
        
        // Apply random height for trees only if requested
        if (applyRandomScale && tileType.randomHeight && tileTypeId === 'tree') {
            const { min, max } = tileType.randomHeight;
            height = min + Math.random() * (max - min);
        }
        
        geometry.scale(width, height, depth);
        
        return geometry;
    }
    
    /**
     * Get material for a tile type
     */
    getMaterial(tileTypeId) {
        const tileType = this.getTileType(tileTypeId);
        if (!tileType) return null;
        
        return this.materials.get(tileType.material);
    }
    
    /**
     * Create a Three.js mesh for a tile
     */
    createTileMesh(tileTypeId, position = new THREE.Vector3()) {
        const geometry = this.getGeometry(tileTypeId);
        const material = this.getMaterial(tileTypeId);
        
        if (!geometry || !material) {
            console.warn(`Could not create mesh for tile type: ${tileTypeId}`);
            return null;
        }
        
        // Create group to hold mesh and edges
        const group = new THREE.Group();
        
        // Main mesh
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        
        // Add edge geometry for better visibility
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000, 
            linewidth: 2,
            transparent: true,
            opacity: 0.3
        });
        const edgesMesh = new THREE.LineSegments(edges, lineMaterial);
        group.add(edgesMesh);
        
        group.position.copy(position);
        
        // Add tile metadata
        group.userData = {
            tileType: tileTypeId,
            tileData: this.getTileType(tileTypeId)
        };
        
        return group;
    }
    
    /**
     * Get default height offset for a tile type
     * Used for proper positioning on the grid
     */
    getTileHeightOffset(tileTypeId) {
        const tileType = this.getTileType(tileTypeId);
        if (!tileType) return 0;
        
        // For trees with random height, use average height
        if (tileType.randomHeight && tileTypeId === 'tree') {
            const { min, max } = tileType.randomHeight;
            const avgHeight = (min + max) / 2;
            return avgHeight / 2;
        }
        
        // Return half height to position tile bottom at grid level
        return tileType.size.height / 2;
    }
    
    /**
     * Check if a tile type is rotatable
     */
    isRotatable(tileTypeId) {
        const tileType = this.getTileType(tileTypeId);
        return tileType ? tileType.rotatable : false;
    }
    
    /**
     * Check if a tile type is solid (blocks movement)
     */
    isSolid(tileTypeId) {
        const tileType = this.getTileType(tileTypeId);
        return tileType ? tileType.solid : false;
    }
    
    /**
     * Check if a tile type is walkable
     */
    isWalkable(tileTypeId) {
        const tileType = this.getTileType(tileTypeId);
        return tileType ? tileType.walkable : true;
    }
    
    /**
     * Cleanup resources
     */
    dispose() {
        // Dispose geometries
        this.geometries.forEach(geometry => geometry.dispose());
        this.geometries.clear();
        
        // Dispose materials
        this.materials.forEach(material => material.dispose());
        this.materials.clear();
        
        // Dispose textures if any
        this.textures.forEach(texture => texture.dispose());
        this.textures.clear();
        
        this.types.clear();
    }
}

/**
 * Global tile types instance
 * Import this to access the shared tile type registry
 */
export const tileTypes = new TileTypes();