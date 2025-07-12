import { PanelDragManager } from './PanelDragManager.js';

/**
 * Voxel Palette UI component using StyleUI framework
 */
export class VoxelPalette {
    constructor(container, voxelWorld) {
        this.container = container;
        this.voxelWorld = voxelWorld;
        this.element = null;
        this.isVisible = false;
        
        this.init();
    }
    
    init() {
        this.createElement();
        this.setupEventListeners();
    }
    
    createElement() {
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = 'var(--space-3)';
        
        // Voxel mode toggle
        this.createVoxelModeSection(content);
        
        // Edit mode
        this.createEditModeSection(content);
        
        // Voxel type
        this.createVoxelTypeSection(content);
        
        // Brush size
        this.createBrushSizeSection(content);
        
        // Brush shape
        this.createBrushShapeSection(content);
        
        // Action buttons
        this.createActionButtons(content);
        
        // Create panel
        this.element = window.UI.panel('Voxel Tools', content, {
            icon: 'box',
            collapsible: true,
            closable: true,
            startCollapsed: true
        });
        
        this.element.style.position = 'fixed';
        this.element.style.top = '20px';
        this.element.style.right = '20px';
        this.element.style.width = '280px';
        this.element.style.zIndex = '1000';
        
        this.container.appendChild(this.element);
        PanelDragManager.makePanelDraggable(this.element, 'voxel-palette');
        
        this.setVisible(true);
    }
    
    createVoxelModeSection(container) {
        const section = document.createElement('div');
        
        this.voxelModeButton = window.UI.button({
            text: 'Enable Voxel Mode',
            variant: 'success',
            onclick: () => {
                this.voxelWorld.toggleVoxelMode();
                this.updateVoxelModeButton();
            }
        });
        
        section.appendChild(this.voxelModeButton);
        container.appendChild(section);
    }
    
    createEditModeSection(container) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = 'Edit Mode';
        label.setAttribute('for', 'edit-mode');
        
        const select = document.createElement('select');
        select.id = 'edit-mode';
        select.className = 'form-control';
        select.innerHTML = `
            <option value="place">Place Voxels</option>
            <option value="remove">Remove Voxels</option>
        `;
        
        group.appendChild(label);
        group.appendChild(select);
        container.appendChild(group);
        
        this.editModeSelect = select;
    }
    
    createVoxelTypeSection(container) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = 'Voxel Type';
        label.setAttribute('for', 'voxel-type');
        
        const select = document.createElement('select');
        select.id = 'voxel-type';
        select.className = 'form-control';
        select.innerHTML = `
            <option value="1">Custom</option>
            <option value="2">Grass</option>
            <option value="3">Dirt</option>
            <option value="4">Stone</option>
            <option value="5">Wood</option>
            <option value="6">Leaves</option>
        `;
        
        group.appendChild(label);
        group.appendChild(select);
        container.appendChild(group);
        
        this.voxelTypeSelect = select;
    }
    
    createBrushSizeSection(container) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const labelRow = document.createElement('div');
        labelRow.style.display = 'flex';
        labelRow.style.justifyContent = 'space-between';
        labelRow.style.alignItems = 'center';
        labelRow.style.marginBottom = 'var(--space-2)';
        
        const label = document.createElement('label');
        label.textContent = 'Brush Size';
        label.setAttribute('for', 'brush-size');
        label.style.marginBottom = '0';
        
        this.brushSizeValue = document.createElement('span');
        this.brushSizeValue.className = 'text-secondary font-mono';
        this.brushSizeValue.textContent = '1';
        
        labelRow.appendChild(label);
        labelRow.appendChild(this.brushSizeValue);
        
        const range = document.createElement('input');
        range.type = 'range';
        range.id = 'brush-size';
        range.className = 'form-control';
        range.min = '1';
        range.max = '5';
        range.step = '1';
        range.value = '1';
        
        group.appendChild(labelRow);
        group.appendChild(range);
        container.appendChild(group);
        
        this.brushSizeRange = range;
    }
    
    createBrushShapeSection(container) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = 'Brush Shape';
        label.setAttribute('for', 'brush-shape');
        
        const select = document.createElement('select');
        select.id = 'brush-shape';
        select.className = 'form-control';
        select.innerHTML = `
            <option value="cube">Cube</option>
            <option value="sphere">Sphere</option>
        `;
        
        group.appendChild(label);
        group.appendChild(select);
        container.appendChild(group);
        
        this.brushShapeSelect = select;
    }
    
    createActionButtons(container) {
        const section = document.createElement('div');
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = 'var(--space-2)';
        
        const undoRedoRow = document.createElement('div');
        undoRedoRow.style.display = 'flex';
        undoRedoRow.style.gap = 'var(--space-2)';
        
        this.undoButton = window.UI.button({
            text: 'Undo',
            icon: 'undo-2',
            variant: 'outline',
            onclick: () => this.voxelWorld.editingSystem.undo()
        });
        this.undoButton.style.flex = '1';
        
        this.redoButton = window.UI.button({
            text: 'Redo',
            icon: 'redo-2',
            variant: 'outline',
            onclick: () => this.voxelWorld.editingSystem.redo()
        });
        this.redoButton.style.flex = '1';
        
        undoRedoRow.appendChild(this.undoButton);
        undoRedoRow.appendChild(this.redoButton);
        
        const generateButton = window.UI.button({
            text: 'Generate Test Terrain',
            icon: 'mountain',
            variant: 'primary',
            onclick: () => this.voxelWorld.generateTestWorld()
        });
        generateButton.style.width = '100%';
        
        section.appendChild(undoRedoRow);
        section.appendChild(generateButton);
        
        // Progress bar section
        const progressSection = document.createElement('div');
        progressSection.style.cssText = `
            padding: var(--space-3);
            background: var(--surface-secondary);
            border-radius: var(--radius-md);
            margin-top: var(--space-2);
        `;
        
        const progressTitle = document.createElement('div');
        progressTitle.style.fontWeight = 'bold';
        progressTitle.style.marginBottom = 'var(--space-2)';
        progressTitle.textContent = 'Voxelization Progress';
        
        // Create wrapper for progress bar and tag
        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'progress-wrapper';
        
        // Create progress container
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress';
        
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'progress-bar progress-bar-success';
        this.progressBar.style.width = '0%';
        this.progressBar.setAttribute('role', 'progressbar');
        this.progressBar.setAttribute('aria-valuenow', '0');
        this.progressBar.setAttribute('aria-valuemin', '0');
        this.progressBar.setAttribute('aria-valuemax', '100');
        
        // Create text element as a tag (separate from progress bar)
        this.progressText = document.createElement('span');
        this.progressText.className = 'tag tag-success';
        this.progressText.style.fontWeight = 'var(--font-bold)';
        this.progressText.textContent = '0%';
        
        // Assemble components
        progressContainer.appendChild(this.progressBar);
        progressWrapper.appendChild(progressContainer);
        progressWrapper.appendChild(this.progressText);
        progressSection.appendChild(progressTitle);
        progressSection.appendChild(progressWrapper);
        
        section.appendChild(progressSection);
        container.appendChild(section);
    }
    
    setupEventListeners() {
        this.editModeSelect.addEventListener('change', (e) => {
            this.voxelWorld.editingSystem.editMode = e.target.value;
        });
        
        this.voxelTypeSelect.addEventListener('change', (e) => {
            this.voxelWorld.editingSystem.setVoxelType(parseInt(e.target.value));
        });
        
        this.brushSizeRange.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            this.brushSizeValue.textContent = size;
            this.voxelWorld.editingSystem.setBrushSize(size);
        });
        
        this.brushShapeSelect.addEventListener('change', (e) => {
            this.voxelWorld.editingSystem.setBrushShape(e.target.value);
        });
    }
    
    updateVoxelModeButton() {
        if (this.voxelWorld.isVoxelMode) {
            this.voxelModeButton.textContent = 'Disable Voxel Mode';
            this.voxelModeButton.className = this.voxelModeButton.className.replace('btn-success', 'btn-danger');
        } else {
            this.voxelModeButton.textContent = 'Enable Voxel Mode';
            this.voxelModeButton.className = this.voxelModeButton.className.replace('btn-danger', 'btn-success');
        }
    }
    
    setVisible(visible) {
        this.isVisible = visible;
        if (this.element) {
            this.element.style.display = visible ? 'block' : 'none';
        }
    }
    
    updateState() {
        if (!this.voxelWorld.editingSystem) return;
        
        const state = this.voxelWorld.editingSystem.getState();
        
        this.editModeSelect.value = state.editMode;
        this.voxelTypeSelect.value = state.selectedVoxelType.toString();
        this.brushSizeRange.value = state.brushSize.toString();
        this.brushSizeValue.textContent = state.brushSize.toString();
        this.brushShapeSelect.value = state.brushShape;
        
        this.undoButton.disabled = !state.canUndo;
        this.redoButton.disabled = !state.canRedo;
        
        this.updateVoxelModeButton();
    }
    
    updateProgress(percentage, text = null) {
        if (this.progressBar && this.progressText) {
            this.progressBar.style.width = `${percentage}%`;
            this.progressBar.setAttribute('aria-valuenow', percentage.toString());
            this.progressText.textContent = text || `${Math.floor(percentage)}%`;
            
            // Add/remove animation based on progress
            if (percentage > 0 && percentage < 100) {
                this.progressBar.classList.add('progress-bar-striped', 'progress-bar-animated');
            } else {
                this.progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
            }
        }
    }
    
    resetProgress() {
        this.updateProgress(0, '0%');
    }
}