import { tileTypes } from '../TileTypes.js';
import { PanelDragManager } from './PanelDragManager.js';

/**
 * Tile Palette UI component for tile selection and editing controls
 * Uses StyleUI framework for consistent styling
 */
export class TilePalette {
    constructor(container, tileMapSystem) {
        this.container = container;
        this.tileMapSystem = tileMapSystem;
        this.element = null;
        
        // UI state
        this.selectedTileType = 'grass';
        this.currentCategory = 'all';
        this.isVisible = false;
        
        this.init();
    }
    
    init() {
        this.createElement();
        this.setupEventListeners();
        this.updateTileSelection();
        
        // Initial badge update after a short delay
        setTimeout(() => {
            this.updateTileCountBadges();
        }, 100);
        
        console.log('TilePalette initialized');
    }
    
    /**
     * Create the main UI element using StyleUI
     */
    createElement() {
        // Create content container
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = 'var(--space-3)';
        content.style.minWidth = '280px';
        
        // Add edit mode toggle
        this.createEditModeSection(content);
        
        // Add tile category filter
        this.createCategoryFilter(content);
        
        // Add tile grid
        this.createTileGrid(content);
        
        // Add editing controls
        this.createEditingControls(content);
        
        // Add map management controls
        this.createMapControls(content);
        
        // Create panel with StyleUI
        this.element = window.UI.panel('Tile Palette', content, {
            icon: 'grid-3x3',
            collapsible: true,
            closable: true,
            startCollapsed: false
        });
        
        this.element.className += ' tile-palette-panel';
        this.element.style.position = 'absolute';
        this.element.style.top = 'var(--space-4)';
        this.element.style.left = 'calc(50% - 140px)'; // Center horizontally
        this.element.style.zIndex = '100';
        
        this.container.appendChild(this.element);
        
        // Make panel draggable
        PanelDragManager.makePanelDraggable(this.element, 'tile-palette');
    }
    
    /**
     * Create edit mode toggle section
     */
    createEditModeSection(parent) {
        const section = document.createElement('div');
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = 'var(--space-2)';
        
        // Mode selection row
        const modeRow = document.createElement('div');
        modeRow.style.display = 'flex';
        modeRow.style.gap = 'var(--space-2)';
        
        // Tile edit toggle
        this.editModeToggle = window.UI.button('Enable Tile Edit', {
            variant: 'primary',
            size: 'sm',
            onclick: () => this.toggleEditMode()
        });
        
        // Voxel mode toggle
        this.voxelModeToggle = window.UI.button('🧊 Voxel Mode', {
            variant: 'outline',
            size: 'sm',
            onclick: () => this.toggleVoxelMode()
        });
        
        modeRow.appendChild(this.editModeToggle);
        modeRow.appendChild(this.voxelModeToggle);
        
        // Status row
        const statusRow = document.createElement('div');
        statusRow.style.display = 'flex';
        statusRow.style.justifyContent = 'space-between';
        statusRow.style.alignItems = 'center';
        
        // Edit mode status indicator
        this.editModeStatus = document.createElement('span');
        this.editModeStatus.className = 'tag tag-dim';
        this.editModeStatus.textContent = 'Edit Mode: OFF';
        
        statusRow.appendChild(this.editModeStatus);
        
        section.appendChild(modeRow);
        section.appendChild(statusRow);
        parent.appendChild(section);
    }
    
    /**
     * Create category filter section
     */
    createCategoryFilter(parent) {
        const section = document.createElement('div');
        
        const title = document.createElement('h4');
        title.textContent = 'Category';
        title.style.margin = '0 0 var(--space-2) 0';
        title.style.color = 'var(--text-secondary)';
        title.style.fontSize = 'var(--font-size-xs)';
        section.appendChild(title);
        
        // Category buttons container
        const categoryContainer = document.createElement('div');
        categoryContainer.style.display = 'flex';
        categoryContainer.style.flexWrap = 'wrap';
        categoryContainer.style.gap = 'var(--space-1)';
        
        // Get all categories plus 'all'
        const categories = ['all', ...tileTypes.getCategories()];
        this.categoryButtons = new Map();
        
        categories.forEach(category => {
            const button = window.UI.button(category.charAt(0).toUpperCase() + category.slice(1), {
                variant: category === 'all' ? 'primary' : 'ghost',
                size: 'sm',
                onclick: () => this.selectCategory(category)
            });
            
            this.categoryButtons.set(category, button);
            categoryContainer.appendChild(button);
        });
        
        section.appendChild(categoryContainer);
        parent.appendChild(section);
    }
    
    /**
     * Create tile grid section
     */
    createTileGrid(parent) {
        const section = document.createElement('div');
        
        const title = document.createElement('h4');
        title.textContent = 'Tiles';
        title.style.margin = '0 0 var(--space-2) 0';
        title.style.color = 'var(--text-secondary)';
        title.style.fontSize = 'var(--font-size-xs)';
        section.appendChild(title);
        
        // Tile grid container
        this.tileGrid = document.createElement('div');
        this.tileGrid.style.display = 'grid';
        this.tileGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(60px, 1fr))';
        this.tileGrid.style.gap = 'var(--space-2)';
        this.tileGrid.style.maxHeight = '200px';
        this.tileGrid.style.overflowY = 'auto';
        this.tileGrid.style.padding = 'var(--space-2)';
        this.tileGrid.style.backgroundColor = 'var(--bg-layer-3)';
        this.tileGrid.style.borderRadius = 'var(--radius-md)';
        
        section.appendChild(this.tileGrid);
        parent.appendChild(section);
        
        this.updateTileGrid();
    }
    
    /**
     * Create editing controls section
     */
    createEditingControls(parent) {
        const section = document.createElement('div');
        
        const title = document.createElement('h4');
        title.textContent = 'Tools';
        title.style.margin = '0 0 var(--space-2) 0';
        title.style.color = 'var(--text-secondary)';
        title.style.fontSize = 'var(--font-size-xs)';
        section.appendChild(title);
        
        // Tools container
        const toolsContainer = document.createElement('div');
        toolsContainer.style.display = 'flex';
        toolsContainer.style.flexDirection = 'column';
        toolsContainer.style.gap = 'var(--space-2)';
        
        // Rotation control
        const rotationRow = document.createElement('div');
        rotationRow.style.display = 'flex';
        rotationRow.style.alignItems = 'center';
        rotationRow.style.gap = 'var(--space-2)';
        
        const rotateButton = window.UI.button('Rotate (R)', {
            variant: 'ghost',
            size: 'sm',
            onclick: () => this.rotateTile()
        });
        
        this.rotationDisplay = document.createElement('span');
        this.rotationDisplay.className = 'tag tag-info';
        this.rotationDisplay.textContent = '0°';
        
        rotationRow.appendChild(rotateButton);
        rotationRow.appendChild(this.rotationDisplay);
        toolsContainer.appendChild(rotationRow);
        
        // Undo/Redo controls
        const historyRow = document.createElement('div');
        historyRow.style.display = 'flex';
        historyRow.style.gap = 'var(--space-2)';
        
        const undoButton = window.UI.button('Undo', {
            variant: 'ghost',
            size: 'sm',
            onclick: () => this.tileMapSystem.undo()
        });
        
        const redoButton = window.UI.button('Redo', {
            variant: 'ghost',
            size: 'sm',
            onclick: () => this.tileMapSystem.redo()
        });
        
        historyRow.appendChild(undoButton);
        historyRow.appendChild(redoButton);
        toolsContainer.appendChild(historyRow);
        
        section.appendChild(toolsContainer);
        parent.appendChild(section);
    }
    
    /**
     * Create map management controls
     */
    createMapControls(parent) {
        const section = document.createElement('div');
        
        const title = document.createElement('h4');
        title.textContent = 'Map';
        title.style.margin = '0 0 var(--space-2) 0';
        title.style.color = 'var(--text-secondary)';
        title.style.fontSize = 'var(--font-size-xs)';
        section.appendChild(title);
        
        // Map controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.style.display = 'flex';
        controlsContainer.style.flexDirection = 'column';
        controlsContainer.style.gap = 'var(--space-2)';
        
        // Save/Load row
        const saveLoadRow = document.createElement('div');
        saveLoadRow.style.display = 'flex';
        saveLoadRow.style.gap = 'var(--space-2)';
        
        const saveButton = window.UI.button('Save Map', {
            variant: 'primary',
            size: 'sm',
            onclick: () => this.saveMap()
        });
        
        const loadButton = window.UI.button('Load Map', {
            variant: 'ghost',
            size: 'sm',
            onclick: () => this.loadMap()
        });
        
        saveLoadRow.appendChild(saveButton);
        saveLoadRow.appendChild(loadButton);
        controlsContainer.appendChild(saveLoadRow);
        
        // Clear map button
        const clearButton = window.UI.button('Clear All', {
            variant: 'error',
            size: 'sm',
            onclick: () => this.clearMap()
        });
        controlsContainer.appendChild(clearButton);
        
        // Tile count display
        this.tileCountDisplay = document.createElement('div');
        this.tileCountDisplay.style.display = 'flex';
        this.tileCountDisplay.style.alignItems = 'center';
        this.tileCountDisplay.style.gap = 'var(--space-2)';
        this.tileCountDisplay.innerHTML = '<span style="color: var(--text-secondary); font-size: var(--font-size-xs);">Tiles:</span><span class="tag tag-neutral" id="tile-count">0</span>';
        controlsContainer.appendChild(this.tileCountDisplay);
        
        section.appendChild(controlsContainer);
        parent.appendChild(section);
    }
    
    /**
     * Update the tile grid based on current category
     */
    updateTileGrid() {
        // Clear existing tiles
        this.tileGrid.innerHTML = '';
        
        // Get tiles for current category
        const tilesToShow = this.currentCategory === 'all' 
            ? tileTypes.getTileTypes()
            : tileTypes.getTileTypes(this.currentCategory);
        
        // Create tile buttons
        tilesToShow.forEach(tileType => {
            const tileButton = this.createTileButton(tileType);
            this.tileGrid.appendChild(tileButton);
        });
        
        // Initialize Lucide icons for the new tile buttons
        if (window.lucide && window.lucide.createIcons) {
            setTimeout(() => {
                window.lucide.createIcons();
            }, 50);
        }
        
        // Initialize count badges
        this.updateTileCountBadges();
    }
    
    /**
     * Create a tile button for the grid
     */
    createTileButton(tileType) {
        const button = document.createElement('div');
        button.className = 'tile-button';
        button.dataset.tileType = tileType.id; // Store tile type for easy lookup
        button.style.width = '60px';
        button.style.height = '60px';
        button.style.border = '2px solid var(--border-color)';
        button.style.borderRadius = 'var(--radius-md)';
        button.style.backgroundColor = `#${tileType.color.toString(16).padStart(6, '0')}`;
        button.style.cursor = 'pointer';
        button.style.display = 'flex';
        button.style.flexDirection = 'column';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.transition = 'all var(--transition-fast)';
        button.style.position = 'relative';
        
        // Add StyleUI icon based on tile type
        const icon = this.createTileIcon(tileType);
        if (icon) {
            button.appendChild(icon);
        }
        
        // Add tile name
        const nameLabel = document.createElement('div');
        nameLabel.textContent = tileType.name;
        nameLabel.style.fontSize = 'var(--font-size-2xs)';
        nameLabel.style.color = 'var(--text-primary)';
        nameLabel.style.textAlign = 'center';
        nameLabel.style.background = 'var(--overlay-backdrop)';
        nameLabel.style.padding = 'var(--space-0-5)';
        nameLabel.style.borderRadius = 'var(--radius-sm)';
        nameLabel.style.position = 'absolute';
        nameLabel.style.bottom = '2px';
        nameLabel.style.left = '2px';
        nameLabel.style.right = '2px';
        button.appendChild(nameLabel);
        
        // Add tile count indicator (will be updated later)
        // Don't add it here - let updateTileCountBadges handle it
        
        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
            button.style.borderColor = 'var(--primary)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.borderColor = this.selectedTileType === tileType.id 
                ? 'var(--primary)' 
                : 'var(--border-color)';
        });
        
        // Click handler
        button.addEventListener('click', () => {
            this.selectTile(tileType.id);
        });
        
        // Update selection state
        if (this.selectedTileType === tileType.id) {
            button.style.borderColor = 'var(--primary)';
            button.style.borderWidth = '3px';
        }
        
        return button;
    }
    
    /**
     * Get count of tiles of a specific type in the scene
     */
    getTileCountByType(tileTypeId) {
        let count = 0;
        this.tileMapSystem.tiles.forEach(tile => {
            if (tile.tileType === tileTypeId) {
                count++;
            }
        });
        return count;
    }
    
    createTileIcon(tileType) {
        let iconName = null;
        
        // Map tile types to StyleUI icons
        switch (tileType.id) {
            case 'grass':
                iconName = 'leaf';
                break;
            case 'stone':
                iconName = 'mountain';
                break;
            case 'water':
                iconName = 'droplets';
                break;
            case 'wall':
                iconName = 'square';
                break;
            case 'tree':
                iconName = 'tree-pine';
                break;
            case 'ltree':
                iconName = 'trees';
                break;
            case 'foundation':
                iconName = 'home';
                break;
            default:
                // Check category for fallback icons
                switch (tileType.category) {
                    case 'terrain':
                        iconName = 'map';
                        break;
                    case 'structure':
                        iconName = 'building';
                        break;
                    case 'nature':
                        iconName = 'flower';
                        break;
                    default:
                        iconName = 'square';
                }
        }
        
        if (iconName) {
            const iconElement = document.createElement('i');
            iconElement.setAttribute('data-lucide', iconName);
            iconElement.style.cssText = `
                width: 24px;
                height: 24px;
                color: rgba(255, 255, 255, 0.9);
                filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
            `;
            
            return iconElement;
        }
        
        return null;
    }
    
    /**
     * Select a category
     */
    selectCategory(category) {
        this.currentCategory = category;
        
        // Update button states
        this.categoryButtons.forEach((button, cat) => {
            if (cat === category) {
                button.className = button.className.replace('btn-ghost', 'btn-primary');
            } else {
                button.className = button.className.replace('btn-primary', 'btn-ghost');
            }
        });
        
        // Update tile grid
        this.updateTileGrid();
        
        // Initialize Lucide icons for tile previews
        if (window.lucide && window.lucide.createIcons) {
            setTimeout(() => {
                window.lucide.createIcons();
            }, 100); // Small delay to ensure all elements are rendered
        }
    }
    
    /**
     * Select a tile type
     */
    selectTile(tileTypeId) {
        this.selectedTileType = tileTypeId;
        this.tileMapSystem.setSelectedTileType(tileTypeId);
        
        // Update tile grid to show selection
        this.updateTileGrid();
        
        // Re-initialize Lucide icons after grid update
        if (window.lucide && window.lucide.createIcons) {
            setTimeout(() => {
                window.lucide.createIcons();
            }, 100);
        }
        
        console.log(`Selected tile: ${tileTypes.getTileType(tileTypeId).name}`);
    }
    
    /**
     * Toggle edit mode
     */
    toggleEditMode() {
        const isEditMode = this.tileMapSystem.isEditMode();
        this.tileMapSystem.setEditMode(!isEditMode);
        this.updateEditModeUI();
    }
    
    toggleVoxelMode() {
        // Access voxel world through global game engine
        if (window.gameEngine && window.gameEngine.voxelWorld) {
            window.gameEngine.voxelWorld.toggleVoxelMode();
        } else {
            console.warn('VoxelWorld not available');
        }
    }
    
    /**
     * Update edit mode UI
     */
    updateEditModeUI() {
        const isEditMode = this.tileMapSystem.isEditMode();
        
        this.editModeToggle.textContent = isEditMode ? 'Disable Tile Edit' : 'Enable Tile Edit';
        this.editModeToggle.className = isEditMode 
            ? this.editModeToggle.className.replace('btn-primary', 'btn-error')
            : this.editModeToggle.className.replace('btn-error', 'btn-primary');
        
        this.editModeStatus.textContent = `Edit Mode: ${isEditMode ? 'ON' : 'OFF'}`;
        this.editModeStatus.className = isEditMode ? 'tag tag-success' : 'tag tag-dim';
    }
    
    /**
     * Rotate the current tile
     */
    rotateTile() {
        this.tileMapSystem.rotateTile();
        const rotation = this.tileMapSystem.currentRotation;
        const degrees = Math.round(rotation * 180 / Math.PI);
        this.rotationDisplay.textContent = `${degrees}°`;
    }
    
    /**
     * Save the current map
     */
    saveMap() {
        const mapData = this.tileMapSystem.exportTileMap();
        const dataStr = JSON.stringify(mapData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `tilemap_${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('Map saved');
    }
    
    /**
     * Load a map from file
     */
    loadMap() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const mapData = JSON.parse(e.target.result);
                        this.tileMapSystem.importTileMap(mapData);
                        this.updateTileCount();
                        console.log('Map loaded');
                    } catch (error) {
                        console.error('Failed to load map:', error);
                    }
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    }
    
    /**
     * Clear the current map
     */
    clearMap() {
        if (confirm('Are you sure you want to clear all tiles?')) {
            this.tileMapSystem.clearAllTiles();
            this.updateTileCount();
            console.log('Map cleared');
        }
    }
    
    /**
     * Update tile count display
     */
    updateTileCount() {
        const count = this.tileMapSystem.getTileCount();
        const countElement = this.element.querySelector('#tile-count');
        if (countElement) {
            countElement.textContent = count.toString();
        }
    }
    
    /**
     * Update only the count badges without recreating the grid
     */
    updateTileCountBadges() {
        const tileButtons = this.tileGrid.querySelectorAll('.tile-button');
        
        tileButtons.forEach(button => {
            const tileTypeId = button.dataset.tileType;
            if (!tileTypeId) return;
            
            const count = this.getTileCountByType(tileTypeId);
            
            // Find or create badge
            let badge = button.querySelector('.tile-count-badge');
            
            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'tile-count-badge';
                    badge.style.position = 'absolute';
                    badge.style.top = '2px';
                    badge.style.right = '2px';
                    badge.style.fontSize = 'var(--font-size-2xs)';
                    badge.style.backgroundColor = 'var(--primary)';
                    badge.style.color = 'var(--text-on-primary)';
                    badge.style.minWidth = '18px';
                    badge.style.height = '18px';
                    badge.style.borderRadius = '9px';
                    badge.style.display = 'flex';
                    badge.style.alignItems = 'center';
                    badge.style.justifyContent = 'center';
                    badge.style.padding = '0 4px';
                    badge.style.fontWeight = 'bold';
                    badge.style.zIndex = '10';
                    button.appendChild(badge);
                }
                badge.textContent = count.toString();
            } else if (badge) {
                // Remove badge if count is 0
                badge.remove();
            }
        });
    }
    
    /**
     * Update tile selection from external source
     */
    updateTileSelection() {
        this.selectedTileType = this.tileMapSystem.getSelectedTileType();
        this.updateTileGrid();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Debounce timer for grid updates
        this.updateDebounceTimer = null;
        
        // Listen for tile map changes to update count
        const originalPlaceTile = this.tileMapSystem.placeTile.bind(this.tileMapSystem);
        this.tileMapSystem.placeTile = (...args) => {
            originalPlaceTile(...args);
            this.updateTileCount();
            
            // Debounce grid updates to avoid constant recreation during drag
            if (this.updateDebounceTimer) {
                clearTimeout(this.updateDebounceTimer);
            }
            this.updateDebounceTimer = setTimeout(() => {
                this.updateTileCountBadges(); // Only update badges, not entire grid
            }, 100);
        };
        
        const originalRemoveTile = this.tileMapSystem.removeTileInternal.bind(this.tileMapSystem);
        this.tileMapSystem.removeTileInternal = (...args) => {
            originalRemoveTile(...args);
            this.updateTileCount();
            
            // Debounce grid updates
            if (this.updateDebounceTimer) {
                clearTimeout(this.updateDebounceTimer);
            }
            this.updateDebounceTimer = setTimeout(() => {
                this.updateTileCountBadges(); // Only update badges, not entire grid
            }, 100);
        };
    }
    
    /**
     * Show/hide the palette
     */
    setVisible(visible) {
        this.isVisible = visible;
        this.element.style.display = visible ? 'block' : 'none';
    }
    
    /**
     * Toggle palette visibility
     */
    toggleVisibility() {
        this.setVisible(!this.isVisible);
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        console.log('TilePalette destroyed');
    }
}