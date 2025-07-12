import * as THREE from 'three';
import { tileTypes } from './TileTypes.js';

/**
 * Core tile map management system
 * Handles tile placement, storage, coordinate management, and interaction with AdaptiveGrid
 */
export class TileMapSystem {
    constructor(scene, camera, adaptiveGrid, selectionManager, tileRenderer) {
        this.scene = scene;
        this.camera = camera;
        this.adaptiveGrid = adaptiveGrid;
        this.selectionManager = selectionManager;
        this.tileRenderer = tileRenderer;
        
        // Tile storage - Map<string, TileData>
        // Key format: "x,z" (y-coordinate handled by tile type height)
        this.tiles = new Map();
        
        // Rendering groups for different tile layers
        this.renderLayers = {
            terrain: new THREE.Group(),
            structures: new THREE.Group(),
            nature: new THREE.Group(),
            decorations: new THREE.Group()
        };
        
        // Editor state
        this.editMode = false;
        this.selectedTileType = 'grass';
        this.brushSize = 1;
        this.currentRotation = 0;
        
        // Input handling
        this.isPlacing = false;
        this.isRemoving = false;
        this.lastPlacedPosition = null;
        
        // Preview tile
        this.previewTile = null;
        this.previewPosition = new THREE.Vector3();
        
        // Undo/redo system
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.currentAction = [];
        
        this.init();
    }
    
    init() {
        // Add render layers to scene
        Object.values(this.renderLayers).forEach(layer => {
            layer.name = `tiles_${layer.name || 'unknown'}`;
            this.scene.add(layer);
        });
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('TileMapSystem initialized');
    }
    
    /**
     * Set up input event listeners for tile placement
     */
    setupEventListeners() {
        const canvas = document.querySelector('canvas');
        if (!canvas) {
            console.error('TileMapSystem: Canvas not found!');
            return;
        }
        
        console.log('TileMapSystem: Setting up event listeners on canvas');
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Mouse controls for tile placement
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        canvas.addEventListener('mouseenter', (e) => this.handleMouseEnter(e));
        canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        
        // Context menu override for tile editing
        canvas.addEventListener('contextmenu', (e) => {
            if (this.editMode) {
                e.preventDefault();
                this.handleRightClick(e);
            }
        });
        
        console.log('TileMapSystem: Event listeners setup complete');
    }
    
    /**
     * Handle keyboard input for tile editing
     */
    handleKeyDown(e) {
        if (!this.editMode) return;
        
        switch (e.key.toLowerCase()) {
            case 'r':
                this.rotateTile();
                break;
            case 'z':
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                }
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                // Quick tile type selection
                this.selectTileByIndex(parseInt(e.key) - 1);
                break;
        }
    }
    
    /**
     * Handle mouse down for tile placement
     */
    handleMouseDown(e) {
        console.log('TileMapSystem handleMouseDown:', e.button, 'Edit mode:', this.editMode);
        if (!this.editMode) return;
        
        if (e.button === 0) { // Left click - place tile
            console.log('Starting tile placement');
            this.isPlacing = true;
            this.placeTileAtCursor(e);
        } else if (e.button === 2) { // Right click - remove tile
            console.log('Starting tile removal');
            this.isRemoving = true;
            this.removeTileAtCursor(e);
        }
    }
    
    /**
     * Handle mouse move for tile placement
     */
    handleMouseMove(e) {
        if (!this.editMode) return;
        
        // Update preview tile position
        const worldPos = this.getWorldPositionFromMouse(e);
        if (worldPos) {
            this.updatePreviewTile(worldPos);
        } else {
            // Hide preview if we can't get world position
            if (this.previewTile) {
                this.previewTile.visible = false;
            }
        }
        
        if (this.isPlacing) {
            this.placeTileAtCursor(e);
        } else if (this.isRemoving) {
            this.removeTileAtCursor(e);
        }
    }
    
    /**
     * Handle mouse up to stop tile placement
     */
    handleMouseUp(e) {
        if (this.isPlacing || this.isRemoving) {
            this.commitCurrentAction();
        }
        
        this.isPlacing = false;
        this.isRemoving = false;
        this.lastPlacedPosition = null;
    }
    
    /**
     * Handle right click for tile removal
     */
    handleRightClick(e) {
        this.removeTileAtCursor(e);
        this.commitCurrentAction();
    }
    
    /**
     * Handle mouse enter to show preview
     */
    handleMouseEnter(e) {
        if (this.editMode && this.previewTile) {
            this.previewTile.visible = true;
        }
    }
    
    /**
     * Handle mouse leave to hide preview
     */
    handleMouseLeave(e) {
        if (this.previewTile) {
            this.previewTile.visible = false;
        }
    }
    
    /**
     * Convert mouse position to world coordinates and place tile
     */
    placeTileAtCursor(e) {
        const worldPos = this.getWorldPositionFromMouse(e);
        if (worldPos) {
            // Get grid position for comparison
            const gridPos = this.adaptiveGrid.getGridCoordinates(worldPos);
            const gridKey = `${gridPos.x},${gridPos.z}`;
            
            // Only place if we haven't already placed at this position during this drag
            if (this.lastPlacedPosition !== gridKey) {
                this.placeTile(this.selectedTileType, worldPos, this.currentRotation);
                this.lastPlacedPosition = gridKey;
            }
        }
    }
    
    /**
     * Convert mouse position to world coordinates and remove tile
     */
    removeTileAtCursor(e) {
        const worldPos = this.getWorldPositionFromMouse(e);
        if (worldPos) {
            // Get grid position for comparison
            const gridPos = this.adaptiveGrid.getGridCoordinates(worldPos);
            const gridKey = `${gridPos.x},${gridPos.z}`;
            
            // Only remove if we haven't already removed at this position during this drag
            if (this.lastPlacedPosition !== gridKey) {
                this.removeTile(worldPos);
                this.lastPlacedPosition = gridKey;
            }
        }
    }
    
    /**
     * Get world position from mouse event using raycasting
     */
    getWorldPositionFromMouse(e) {
        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();
        
        // Convert to normalized device coordinates
        const mouse = new THREE.Vector2();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Debug: Log mouse coordinates
        if (Math.random() < 0.01) { // Log occasionally to avoid spam
            console.log('Mouse NDC:', mouse.x.toFixed(2), mouse.y.toFixed(2));
        }
        
        // Raycast to the ground plane (y = 0)
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // Create a large ground plane for intersection
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        
        if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
            // Return the raw intersection point (don't snap yet)
            return intersection;
        }
        
        return null;
    }
    
    /**
     * Place a tile at the specified world position
     */
    placeTile(tileTypeId, worldPosition, rotation = 0) {
        console.log('placeTile called with:', tileTypeId, worldPosition, rotation);
        
        // Get grid coordinates using 1-meter grid (snap to square centers)
        const tileGridSpacing = 1.0;
        const gridX = Math.floor(worldPosition.x / tileGridSpacing);
        const gridZ = Math.floor(worldPosition.z / tileGridSpacing);
        const key = `${gridX},${gridZ}`;
        
        console.log('Grid position:', {x: gridX, z: gridZ}, 'Key:', key);
        
        // Check if position is the same as last placed (for continuous placement)
        if (this.lastPlacedPosition && this.lastPlacedPosition === key) {
            return;
        }
        this.lastPlacedPosition = key;
        
        // Remove existing tile at this position if there is one
        if (this.tiles.has(key)) {
            console.log(`Replacing existing tile at (${gridX}, ${gridZ})`);
            this.removeTileInternal({x: gridX, z: gridZ});
        }
        
        // Create new tile data - convert grid coordinates to world position at square center
        const worldPos = new THREE.Vector3(
            gridX * tileGridSpacing + tileGridSpacing * 0.5,
            0,
            gridZ * tileGridSpacing + tileGridSpacing * 0.5
        );
        
        console.log('World position for tile:', worldPos);
        
        // Use TileRenderer to add the tile instance
        const instanceId = this.tileRenderer.addTileInstance(tileTypeId, worldPos, rotation);
        
        console.log('Instance ID from TileRenderer:', instanceId);
        
        if (instanceId !== null) {
            const tileData = {
                type: tileTypeId,
                position: { x: gridX, z: gridZ },
                rotation: rotation,
                instanceId: instanceId
            };
            
            this.tiles.set(key, tileData);
            console.log(`Placed ${tileTypeId} tile at (${gridX}, ${gridZ})`);
        } else {
            console.error('Failed to get instance ID from TileRenderer');
        }
    }
    
    /**
     * Remove tile at the specified world position
     */
    removeTile(worldPosition) {
        // Get grid coordinates using 1-meter grid (snap to square centers)
        const tileGridSpacing = 1.0;
        const gridX = Math.floor(worldPosition.x / tileGridSpacing);
        const gridZ = Math.floor(worldPosition.z / tileGridSpacing);
        this.removeTileInternal({x: gridX, z: gridZ});
    }
    
    /**
     * Internal method to remove tile by grid coordinates
     */
    removeTileInternal(gridPos) {
        const key = `${gridPos.x},${gridPos.z}`;
        const tileData = this.tiles.get(key);
        
        if (tileData) {
            // Remove instance from TileRenderer
            if (this.tileRenderer && tileData.instanceId !== undefined) {
                this.tileRenderer.removeTileInstance(tileData.type, tileData.instanceId);
            }
            
            // Remove from storage
            this.tiles.delete(key);
            
            console.log(`Removed tile at (${gridPos.x}, ${gridPos.z})`);
        }
    }
    
    
    /**
     * Rotate the current tile selection
     */
    rotateTile() {
        if (tileTypes.isRotatable(this.selectedTileType)) {
            this.currentRotation = (this.currentRotation + Math.PI / 2) % (Math.PI * 2);
            
            // Update preview tile rotation
            if (this.previewTile) {
                this.previewTile.rotation.y = this.currentRotation;
            }
            
            console.log(`Rotated to ${(this.currentRotation * 180 / Math.PI).toFixed(0)}°`);
        }
    }
    
    /**
     * Select tile type by index
     */
    selectTileByIndex(index) {
        const allTypes = tileTypes.getTileTypes();
        if (index >= 0 && index < allTypes.length) {
            this.selectedTileType = allTypes[index].id;
            console.log(`Selected tile: ${allTypes[index].name}`);
        }
    }
    
    /**
     * Set the selected tile type
     */
    setSelectedTileType(tileTypeId) {
        if (tileTypes.getTileType(tileTypeId)) {
            this.selectedTileType = tileTypeId;
            this.currentRotation = 0; // Reset rotation when changing tiles
        }
    }
    
    /**
     * Get the currently selected tile type
     */
    getSelectedTileType() {
        return this.selectedTileType;
    }
    
    /**
     * Toggle edit mode
     */
    setEditMode(enabled) {
        this.editMode = enabled;
        
        // Show/hide preview tile
        if (enabled) {
            console.log('Creating preview tile...');
            this.createPreviewTile();
            // Disable selection manager's rectangle when in tile edit mode
            if (this.selectionManager) {
                this.selectionManager.setEnabled(false);
            }
        } else {
            console.log('Removing preview tile...');
            this.removePreviewTile();
            // Re-enable selection manager
            if (this.selectionManager) {
                this.selectionManager.setEnabled(true);
            }
        }
        
        console.log(`Tile edit mode: ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Check if edit mode is active
     */
    isEditMode() {
        return this.editMode;
    }
    
    /**
     * Commit current action to history for undo/redo
     */
    commitCurrentAction() {
        // Take a snapshot of current tile state
        const snapshot = this.createSnapshot();
        
        // Remove any history after current index (for when we're in the middle of history)
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add new snapshot
        this.history.push(snapshot);
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    /**
     * Create a snapshot of current tile state
     */
    createSnapshot() {
        const snapshot = new Map();
        this.tiles.forEach((tileData, key) => {
            snapshot.set(key, {
                type: tileData.type,
                position: { ...tileData.position },
                rotation: tileData.rotation
            });
        });
        return snapshot;
    }
    
    /**
     * Restore from a snapshot
     */
    restoreSnapshot(snapshot) {
        // Clear current tiles
        this.clearAllTiles();
        
        // Restore tiles from snapshot
        snapshot.forEach((tileData, key) => {
            const worldPos = new THREE.Vector3(tileData.position.x, 0, tileData.position.z);
            this.placeTile(tileData.type, worldPos, tileData.rotation);
        });
    }
    
    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreSnapshot(this.history[this.historyIndex]);
            console.log('Undo');
        }
    }
    
    /**
     * Redo last undone action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreSnapshot(this.history[this.historyIndex]);
            console.log('Redo');
        }
    }
    
    /**
     * Clear all tiles from the map
     */
    clearAllTiles() {
        // Clear all instances from TileRenderer
        if (this.tileRenderer) {
            this.tileRenderer.clearAllInstances();
        }
        
        // Clear tile storage
        this.tiles.clear();
    }
    
    /**
     * Get tile at specific grid position
     */
    getTileAt(gridX, gridZ) {
        return this.tiles.get(`${gridX},${gridZ}`);
    }
    
    /**
     * Get all tiles
     */
    getAllTiles() {
        return Array.from(this.tiles.values());
    }
    
    /**
     * Get tile count
     */
    getTileCount() {
        return this.tiles.size;
    }
    
    /**
     * Export tile map data
     */
    exportTileMap() {
        const data = {
            version: '1.0',
            timestamp: Date.now(),
            tiles: []
        };
        
        this.tiles.forEach((tileData) => {
            data.tiles.push({
                type: tileData.type,
                position: tileData.position,
                rotation: tileData.rotation
            });
        });
        
        return data;
    }
    
    /**
     * Import tile map data
     */
    importTileMap(data) {
        if (!data || !data.tiles) {
            console.error('Invalid tile map data');
            return false;
        }
        
        // Clear existing tiles
        this.clearAllTiles();
        
        // Import tiles
        data.tiles.forEach((tileData) => {
            const worldPos = new THREE.Vector3(tileData.position.x, 0, tileData.position.z);
            this.placeTile(tileData.type, worldPos, tileData.rotation || 0);
        });
        
        // Commit to history
        this.commitCurrentAction();
        
        console.log(`Imported ${data.tiles.length} tiles`);
        return true;
    }
    
    /**
     * Create preview tile for placement visualization
     */
    createPreviewTile() {
        if (this.previewTile) {
            this.removePreviewTile();
        }
        
        try {
            // Create a semi-transparent preview tile
            const geometry = tileTypes.getGeometry(this.selectedTileType);
            const baseMaterial = tileTypes.getMaterial(this.selectedTileType);
            
            if (!geometry || !baseMaterial) {
                console.error('Failed to get geometry or material for tile type:', this.selectedTileType);
                return;
            }
            
            // Create a new material that supports emissive
            const material = new THREE.MeshStandardMaterial({
                color: baseMaterial.color,
                transparent: true,
                opacity: 0.6,
                emissive: 0x00ff00,
                emissiveIntensity: 0.3,
                side: THREE.DoubleSide
            });
            
            this.previewTile = new THREE.Mesh(geometry, material);
            this.previewTile.name = 'preview_tile';
            this.previewTile.visible = false;
            this.previewTile.renderOrder = 999; // Render on top
            this.previewTile.frustumCulled = false; // Always render
            
            // Make sure the material needs update
            this.previewTile.material.needsUpdate = true;
            
            // Add to scene but not to render layers
            this.scene.add(this.previewTile);
            console.log('Preview tile created successfully');
        } catch (error) {
            console.error('Error creating preview tile:', error);
        }
    }
    
    /**
     * Update preview tile position
     */
    updatePreviewTile(worldPosition) {
        if (!this.previewTile || !this.editMode) return;
        
        // Snap to 1-meter grid square centers (not intersections)
        const tileGridSpacing = 1.0; // Always use 1 meter grid for tiles
        const gridX = Math.floor(worldPosition.x / tileGridSpacing);
        const gridZ = Math.floor(worldPosition.z / tileGridSpacing);
        
        // Convert grid coordinates to world position at square center
        const snappedPos = new THREE.Vector3(
            gridX * tileGridSpacing + tileGridSpacing * 0.5,
            0,
            gridZ * tileGridSpacing + tileGridSpacing * 0.5
        );
        
        // Update position with height offset
        this.previewTile.position.copy(snappedPos);
        this.previewTile.position.y = tileTypes.getTileHeightOffset(this.selectedTileType);
        
        // Update rotation
        this.previewTile.rotation.y = this.currentRotation;
        
        // Check if position is valid (not occupied)
        const key = `${gridX},${gridZ}`;
        const isOccupied = this.tiles.has(key);
        
        // Change appearance based on validity
        if (isOccupied) {
            this.previewTile.material.emissive.setHex(0xff0000); // Red for occupied
            this.previewTile.material.opacity = 0.4;
        } else {
            this.previewTile.material.emissive.setHex(0x00ff00); // Green for valid
            this.previewTile.material.opacity = 0.6;
        }
        
        this.previewTile.visible = true;
    }
    
    /**
     * Remove preview tile from scene
     */
    removePreviewTile() {
        if (this.previewTile) {
            this.scene.remove(this.previewTile);
            if (this.previewTile.geometry) this.previewTile.geometry.dispose();
            if (this.previewTile.material) this.previewTile.material.dispose();
            this.previewTile = null;
        }
    }
    
    /**
     * Update preview tile when tile type changes
     */
    setSelectedTileType(tileTypeId) {
        this.selectedTileType = tileTypeId;
        
        // Recreate preview tile with new type
        if (this.editMode && this.previewTile) {
            this.createPreviewTile();
        }
    }
    
    /**
     * Cleanup resources
     */
    dispose() {
        this.clearAllTiles();
        this.removePreviewTile();
        
        // Remove render layers from scene
        Object.values(this.renderLayers).forEach(layer => {
            this.scene.remove(layer);
        });
        
        console.log('TileMapSystem disposed');
    }
}