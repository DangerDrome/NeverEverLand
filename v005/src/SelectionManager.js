import * as THREE from 'three';

export class SelectionManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.scene = gameEngine.scene;
        this.camera = gameEngine.camera;
        this.renderer = gameEngine.renderer;
        
        // Selection state
        this.selectedObjects = new Set();
        this.selectableObjects = [];
        this.hoveredObject = null;
        
        // Drag selection state
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragEnd = { x: 0, y: 0 };
        
        // Raycaster for mouse picking
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Create 2D overlay canvas for selection brackets
        this.createOverlayCanvas();
        
        // Bracket styling - using semantic colors
        // Get computed styles to access CSS variables
        const computedStyle = getComputedStyle(document.documentElement);
        this.bracketColor = computedStyle.getPropertyValue('--info') || '#3b82f6'; // Info blue for selection
        this.bracketGlowColor = computedStyle.getPropertyValue('--info-light') || '#60a5fa';
        this.hoverColor = computedStyle.getPropertyValue('--warning') || '#f59e0b'; // Warning yellow for hover
        this.hoverGlowColor = computedStyle.getPropertyValue('--warning-light') || '#fbbf24';
        this.bracketWidth = 2;
        this.bracketLength = 15; // Length of corner bracket lines
        this.bracketPadding = 5; // Padding around bounding box
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Animation frame for updating brackets
        this.updateBrackets = this.updateBrackets.bind(this);
        this.startUpdateLoop();
    }
    
    createOverlayCanvas() {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1000';
        
        // Get the game container
        const container = document.getElementById('game-container');
        if (container) {
            container.appendChild(this.canvas);
        } else {
            document.body.appendChild(this.canvas);
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    setupEventListeners() {
        // Mouse down to start drag selection
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            this.onMouseDown(event);
        });
        
        // Mouse move for hover and drag
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.onMouseMove(event);
        });
        
        // Mouse up to end drag selection
        this.renderer.domElement.addEventListener('mouseup', (event) => {
            this.onMouseUp(event);
        });
        
        // Right click for context menu
        this.renderer.domElement.addEventListener('contextmenu', (event) => {
            this.onContextMenu(event);
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    onMouseDown(event) {
        // Only handle left mouse button for drag selection
        if (event.button !== 0) return;
        
        // Store drag start position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.dragStart.x = event.clientX - rect.left;
        this.dragStart.y = event.clientY - rect.top;
        this.dragEnd.x = this.dragStart.x;
        this.dragEnd.y = this.dragStart.y;
        
        // Calculate normalized device coordinates for raycasting
        this.mouse.x = (this.dragStart.x / rect.width) * 2 - 1;
        this.mouse.y = -(this.dragStart.y / rect.height) * 2 + 1;
        
        // Check if we're clicking on an object
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.updateSelectableObjects();
        const intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
        
        if (intersects.length === 0) {
            // Start drag selection only if we didn't click on an object
            this.isDragging = true;
            if (!event.shiftKey) {
                // Clear selection unless shift is held
                this.selectedObjects.clear();
            }
        }
    }
    
    onMouseUp(event) {
        // Only handle left mouse button
        if (event.button !== 0) return;
        
        if (this.isDragging) {
            // Finish drag selection
            this.performDragSelection();
            this.isDragging = false;
        } else {
            // Handle regular click selection
            this.handleClickSelection(event);
        }
    }
    
    onContextMenu(event) {
        // Prevent default browser context menu
        event.preventDefault();
        
        // Calculate mouse position for raycasting
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the picking ray
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.updateSelectableObjects();
        const intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
        
        if (intersects.length > 0) {
            // Right-clicked on an object
            const clicked = intersects[0].object;
            let rootObject = clicked;
            while (rootObject.parent && rootObject.parent.type !== 'Scene') {
                rootObject = rootObject.parent;
            }
            
            // Show context menu for object
            this.showContextMenu(event.clientX, event.clientY, rootObject);
        } else {
            // Right-clicked on empty space
            this.showContextMenu(event.clientX, event.clientY, null);
        }
    }
    
    showContextMenu(x, y, targetObject) {
        // Remove existing context menu if any
        const existingMenu = document.getElementById('selection-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu
        const menu = document.createElement('div');
        menu.id = 'selection-context-menu';
        menu.style.position = 'fixed';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.backgroundColor = 'var(--bg-layer-3)';
        menu.style.borderRadius = 'var(--radius-md)';
        menu.style.padding = 'var(--space-2)';
        menu.style.zIndex = '10000';
        menu.style.fontSize = 'var(--font-size-sm)';
        menu.style.minWidth = '120px';
        menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        
        // Add menu items based on context
        if (targetObject) {
            if (this.selectedObjects.has(targetObject)) {
                this.addMenuItem(menu, 'Deselect', () => {
                    this.selectedObjects.delete(targetObject);
                    this.hideContextMenu();
                });
            } else {
                this.addMenuItem(menu, 'Select', () => {
                    this.selectedObjects.add(targetObject);
                    this.hideContextMenu();
                });
            }
            
            this.addMenuItem(menu, 'Focus', () => {
                this.focusOnObject(targetObject);
                this.hideContextMenu();
            });
            
            this.addMenuItem(menu, 'Delete', () => {
                // Delete object (you can implement this in your game engine)
                console.log('Delete object:', targetObject);
                this.hideContextMenu();
            });
        } else {
            // Empty space context menu
            if (this.selectedObjects.size > 0) {
                this.addMenuItem(menu, 'Clear Selection', () => {
                    this.selectedObjects.clear();
                    this.hideContextMenu();
                });
            }
            
            this.addMenuItem(menu, 'Select All', () => {
                this.updateSelectableObjects();
                this.selectableObjects.forEach(object => {
                    let rootObject = object;
                    while (rootObject.parent && rootObject.parent.type !== 'Scene') {
                        rootObject = rootObject.parent;
                    }
                    this.selectedObjects.add(rootObject);
                });
                this.hideContextMenu();
            });
        }
        
        document.body.appendChild(menu);
        
        // Hide menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
        }, 10);
    }
    
    addMenuItem(menu, text, onclick) {
        const item = document.createElement('div');
        item.textContent = text;
        item.style.padding = 'var(--space-1) var(--space-2)';
        item.style.cursor = 'pointer';
        item.style.borderRadius = 'var(--radius-sm)';
        item.style.color = 'var(--text-primary)';
        
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = 'var(--bg-layer-4)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'transparent';
        });
        
        item.addEventListener('click', onclick);
        menu.appendChild(item);
    }
    
    hideContextMenu() {
        const menu = document.getElementById('selection-context-menu');
        if (menu) {
            menu.remove();
        }
    }
    
    focusOnObject(object) {
        // Temporarily clear selection and select only this object
        const previousSelection = Array.from(this.selectedObjects);
        this.selectedObjects.clear();
        this.selectedObjects.add(object);
        
        // Use the game engine's focusOnSelection method which includes proper padding
        if (this.gameEngine && this.gameEngine.focusOnSelection) {
            this.gameEngine.focusOnSelection();
        }
        
        // Restore previous selection
        this.selectedObjects.clear();
        previousSelection.forEach(obj => this.selectedObjects.add(obj));
    }
    
    handleClickSelection(event) {
        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Get all selectable objects in the scene
        this.updateSelectableObjects();
        
        // Calculate objects intersecting the ray
        const intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
        
        if (intersects.length > 0) {
            // Get the closest object
            const selected = intersects[0].object;
            
            // Find the root object (in case we hit a child mesh)
            let rootObject = selected;
            while (rootObject.parent && rootObject.parent.type !== 'Scene') {
                rootObject = rootObject.parent;
            }
            
            // Toggle selection
            if (event.shiftKey) {
                // Multi-select with shift key
                if (this.selectedObjects.has(rootObject)) {
                    this.selectedObjects.delete(rootObject);
                } else {
                    this.selectedObjects.add(rootObject);
                }
            } else {
                // Single select
                this.selectedObjects.clear();
                this.selectedObjects.add(rootObject);
            }
        } else if (!event.shiftKey) {
            // Clear selection if clicking empty space (unless shift is held)
            this.selectedObjects.clear();
        }
    }
    
    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        
        if (this.isDragging) {
            // Update drag end position
            this.dragEnd.x = event.clientX - rect.left;
            this.dragEnd.y = event.clientY - rect.top;
            
            // Update cursor for dragging
            this.renderer.domElement.style.cursor = 'crosshair';
        } else {
            // Normal hover behavior
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Update the picking ray with the camera and mouse position
            this.raycaster.setFromCamera(this.mouse, this.camera);
            
            // Get all selectable objects in the scene
            this.updateSelectableObjects();
            
            // Calculate objects intersecting the ray
            const intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
            
            if (intersects.length > 0) {
                // Get the closest object
                const hovered = intersects[0].object;
                
                // Find the root object (in case we hit a child mesh)
                let rootObject = hovered;
                while (rootObject.parent && rootObject.parent.type !== 'Scene') {
                    rootObject = rootObject.parent;
                }
                
                // Update hovered object
                this.hoveredObject = rootObject;
                
                // Change cursor to pointer
                this.renderer.domElement.style.cursor = 'pointer';
            } else {
                this.hoveredObject = null;
                this.renderer.domElement.style.cursor = 'default';
            }
        }
    }
    
    performDragSelection() {
        // Get selection rectangle bounds
        const x1 = Math.min(this.dragStart.x, this.dragEnd.x);
        const y1 = Math.min(this.dragStart.y, this.dragEnd.y);
        const x2 = Math.max(this.dragStart.x, this.dragEnd.x);
        const y2 = Math.max(this.dragStart.y, this.dragEnd.y);
        
        // Only perform selection if we actually dragged (minimum 10px movement)
        const dragDistance = Math.sqrt(
            Math.pow(this.dragEnd.x - this.dragStart.x, 2) + 
            Math.pow(this.dragEnd.y - this.dragStart.y, 2)
        );
        
        if (dragDistance < 10) return;
        
        // Check which objects fall within the selection rectangle
        this.updateSelectableObjects();
        
        this.selectableObjects.forEach(object => {
            // Find the root object
            let rootObject = object;
            while (rootObject.parent && rootObject.parent.type !== 'Scene') {
                rootObject = rootObject.parent;
            }
            
            // Get object's screen position
            const box = new THREE.Box3().setFromObject(rootObject);
            const center = box.getCenter(new THREE.Vector3());
            
            // Project to screen space
            const projected = center.clone().project(this.camera);
            const screenX = (projected.x * 0.5 + 0.5) * this.canvas.width;
            const screenY = (projected.y * -0.5 + 0.5) * this.canvas.height;
            
            // Check if object center is within selection rectangle
            if (screenX >= x1 && screenX <= x2 && screenY >= y1 && screenY <= y2) {
                this.selectedObjects.add(rootObject);
            }
        });
    }
    
    updateSelectableObjects() {
        // Get all mesh objects in the scene
        this.selectableObjects = [];
        this.scene.traverse((child) => {
            if (child.isMesh && child.visible) {
                // Exclude certain objects like grid helpers
                const isHelper = child.parent && (
                    child.parent.type === 'GridHelper' ||
                    child.parent.type === 'AxesHelper'
                );
                
                if (!isHelper) {
                    this.selectableObjects.push(child);
                }
            }
        });
    }
    
    startUpdateLoop() {
        requestAnimationFrame(this.updateBrackets);
    }
    
    updateBrackets() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw drag selection rectangle if dragging
        if (this.isDragging) {
            this.drawDragRectangle();
        }
        
        // Draw brackets for each selected object
        this.selectedObjects.forEach(object => {
            this.drawSelectionBrackets(object, false);
        });
        
        // Draw hover brackets if object is hovered but not selected
        if (this.hoveredObject && !this.selectedObjects.has(this.hoveredObject)) {
            this.drawSelectionBrackets(this.hoveredObject, true);
        }
        
        // Continue update loop
        requestAnimationFrame(this.updateBrackets);
    }
    
    drawSelectionBrackets(object, isHover = false) {
        // Get bounding box of the object
        const box = new THREE.Box3().setFromObject(object);
        
        // Get the 8 corners of the bounding box
        const corners = [
            new THREE.Vector3(box.min.x, box.min.y, box.min.z),
            new THREE.Vector3(box.max.x, box.min.y, box.min.z),
            new THREE.Vector3(box.min.x, box.max.y, box.min.z),
            new THREE.Vector3(box.max.x, box.max.y, box.min.z),
            new THREE.Vector3(box.min.x, box.min.y, box.max.z),
            new THREE.Vector3(box.max.x, box.min.y, box.max.z),
            new THREE.Vector3(box.min.x, box.max.y, box.max.z),
            new THREE.Vector3(box.max.x, box.max.y, box.max.z)
        ];
        
        // Project corners to screen space
        const screenCorners = corners.map(corner => {
            const projected = corner.clone().project(this.camera);
            return {
                x: (projected.x * 0.5 + 0.5) * this.canvas.width,
                y: (projected.y * -0.5 + 0.5) * this.canvas.height
            };
        });
        
        // Find the screen-space bounding box
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        screenCorners.forEach(corner => {
            minX = Math.min(minX, corner.x);
            minY = Math.min(minY, corner.y);
            maxX = Math.max(maxX, corner.x);
            maxY = Math.max(maxY, corner.y);
        });
        
        // Add padding
        minX -= this.bracketPadding;
        minY -= this.bracketPadding;
        maxX += this.bracketPadding;
        maxY += this.bracketPadding;
        
        // Draw corner brackets
        this.drawCornerBrackets(minX, minY, maxX, maxY, isHover);
    }
    
    drawCornerBrackets(x1, y1, x2, y2, isHover = false) {
        const ctx = this.ctx;
        
        // Setup styles with semantic colors
        if (isHover) {
            ctx.strokeStyle = this.hoverColor;
            ctx.lineWidth = this.bracketWidth - 0.5;
            ctx.shadowColor = this.hoverGlowColor;
            ctx.shadowBlur = 3;
        } else {
            ctx.strokeStyle = this.bracketColor;
            ctx.lineWidth = this.bracketWidth;
            ctx.shadowColor = this.bracketGlowColor;
            ctx.shadowBlur = 4;
        }
        ctx.lineCap = 'square';
        
        const len = this.bracketLength;
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x1, y1 + len);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1 + len, y1);
        ctx.stroke();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x2 - len, y1);
        ctx.lineTo(x2, y1);
        ctx.lineTo(x2, y1 + len);
        ctx.stroke();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x1, y2 - len);
        ctx.lineTo(x1, y2);
        ctx.lineTo(x1 + len, y2);
        ctx.stroke();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x2 - len, y2);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 - len);
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
    }
    
    drawDragRectangle() {
        const ctx = this.ctx;
        
        // Calculate rectangle bounds
        const x1 = Math.min(this.dragStart.x, this.dragEnd.x);
        const y1 = Math.min(this.dragStart.y, this.dragEnd.y);
        const x2 = Math.max(this.dragStart.x, this.dragEnd.x);
        const y2 = Math.max(this.dragStart.y, this.dragEnd.y);
        
        const width = x2 - x1;
        const height = y2 - y1;
        
        // Draw selection rectangle background with semantic color
        ctx.fillStyle = this.bracketColor + '20'; // 20 = ~12% opacity
        ctx.fillRect(x1, y1, width, height);
        
        // Draw selection rectangle border
        ctx.strokeStyle = this.bracketColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // Dashed line
        ctx.strokeRect(x1, y1, width, height);
        ctx.setLineDash([]); // Reset line dash
    }
    
    // Public methods
    
    selectObject(object) {
        this.selectedObjects.add(object);
    }
    
    deselectObject(object) {
        this.selectedObjects.delete(object);
    }
    
    clearSelection() {
        this.selectedObjects.clear();
    }
    
    getSelectedObjects() {
        return Array.from(this.selectedObjects);
    }
    
    isSelected(object) {
        return this.selectedObjects.has(object);
    }
    
    // Set custom bracket styling
    setBracketStyle(options) {
        if (options.color) this.bracketColor = options.color;
        if (options.glowColor) this.bracketGlowColor = options.glowColor;
        if (options.width) this.bracketWidth = options.width;
        if (options.length) this.bracketLength = options.length;
        if (options.padding) this.bracketPadding = options.padding;
    }
    
    // Cleanup
    dispose() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.selectedObjects.clear();
    }
}