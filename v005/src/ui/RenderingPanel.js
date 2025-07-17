import { PanelDragManager } from './PanelDragManager.js';

/**
 * Rendering Panel UI component for post-processing effects
 */
export class RenderingPanel {
    constructor(container, gameEngine) {
        this.container = container;
        this.gameEngine = gameEngine;
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
        
        // Post-processing toggle
        this.createPostProcessingToggle(content);
        
        // Pixelation settings
        this.createPixelationSection(content);
        
        // Bloom settings
        this.createBloomSection(content);
        
        // Rendering settings
        this.createRenderingSettings(content);
        
        // Performance settings
        this.createPerformanceSection(content);
        
        // Create panel
        this.element = window.UI.panel('Rendering Effects', content, {
            icon: 'settings',
            collapsible: true,
            closable: true,
            startCollapsed: true
        });
        
        this.element.style.position = 'fixed';
        this.element.style.top = '20px';
        this.element.style.left = '20px';
        this.element.style.width = '300px';
        this.element.style.zIndex = '1000';
        
        this.container.appendChild(this.element);
        PanelDragManager.makePanelDraggable(this.element, 'rendering-panel');
        
        this.setVisible(true);
    }
    
    createPostProcessingToggle(container) {
        const section = document.createElement('div');
        
        this.postProcessingButton = window.UI.button({
            text: 'Enable Post-Processing',
            variant: 'primary',
            onclick: () => {
                this.togglePostProcessing();
            }
        });
        
        section.appendChild(this.postProcessingButton);
        container.appendChild(section);
    }
    
    createPixelationSection(container) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        // Pixelation toggle
        const pixelToggle = document.createElement('div');
        pixelToggle.style.display = 'flex';
        pixelToggle.style.justifyContent = 'space-between';
        pixelToggle.style.alignItems = 'center';
        pixelToggle.style.marginBottom = 'var(--space-2)';
        
        const pixelLabel = document.createElement('label');
        pixelLabel.textContent = 'Pixelation Effect';
        
        this.pixelationToggle = document.createElement('input');
        this.pixelationToggle.type = 'checkbox';
        this.pixelationToggle.className = 'form-control';
        
        pixelToggle.appendChild(pixelLabel);
        pixelToggle.appendChild(this.pixelationToggle);
        
        // Pixel size slider
        const pixelSizeRow = document.createElement('div');
        pixelSizeRow.style.display = 'flex';
        pixelSizeRow.style.justifyContent = 'space-between';
        pixelSizeRow.style.alignItems = 'center';
        pixelSizeRow.style.marginBottom = 'var(--space-2)';
        
        const sizeLabel = document.createElement('label');
        sizeLabel.textContent = 'Pixel Size';
        sizeLabel.setAttribute('for', 'pixel-size');
        
        this.pixelSizeValue = document.createElement('span');
        this.pixelSizeValue.className = 'text-secondary font-mono';
        this.pixelSizeValue.textContent = '4';
        
        pixelSizeRow.appendChild(sizeLabel);
        pixelSizeRow.appendChild(this.pixelSizeValue);
        
        const pixelSizeRange = document.createElement('input');
        pixelSizeRange.type = 'range';
        pixelSizeRange.id = 'pixel-size';
        pixelSizeRange.className = 'form-control';
        pixelSizeRange.min = '1';
        pixelSizeRange.max = '16';
        pixelSizeRange.step = '1';
        pixelSizeRange.value = '4';
        
        group.appendChild(pixelToggle);
        group.appendChild(pixelSizeRow);
        group.appendChild(pixelSizeRange);
        container.appendChild(group);
        
        this.pixelSizeRange = pixelSizeRange;
    }
    
    createBloomSection(container) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        // Bloom toggle
        const bloomToggle = document.createElement('div');
        bloomToggle.style.display = 'flex';
        bloomToggle.style.justifyContent = 'space-between';
        bloomToggle.style.alignItems = 'center';
        bloomToggle.style.marginBottom = 'var(--space-2)';
        
        const bloomLabel = document.createElement('label');
        bloomLabel.textContent = 'Bloom Effect';
        
        this.bloomToggle = document.createElement('input');
        this.bloomToggle.type = 'checkbox';
        this.bloomToggle.className = 'form-control';
        
        bloomToggle.appendChild(bloomLabel);
        bloomToggle.appendChild(this.bloomToggle);
        
        // Bloom strength slider
        const bloomStrengthRow = document.createElement('div');
        bloomStrengthRow.style.display = 'flex';
        bloomStrengthRow.style.justifyContent = 'space-between';
        bloomStrengthRow.style.alignItems = 'center';
        bloomStrengthRow.style.marginBottom = 'var(--space-2)';
        
        const strengthLabel = document.createElement('label');
        strengthLabel.textContent = 'Bloom Strength';
        strengthLabel.setAttribute('for', 'bloom-strength');
        
        this.bloomStrengthValue = document.createElement('span');
        this.bloomStrengthValue.className = 'text-secondary font-mono';
        this.bloomStrengthValue.textContent = '1.0';
        
        bloomStrengthRow.appendChild(strengthLabel);
        bloomStrengthRow.appendChild(this.bloomStrengthValue);
        
        const bloomStrengthRange = document.createElement('input');
        bloomStrengthRange.type = 'range';
        bloomStrengthRange.id = 'bloom-strength';
        bloomStrengthRange.className = 'form-control';
        bloomStrengthRange.min = '0';
        bloomStrengthRange.max = '3';
        bloomStrengthRange.step = '0.1';
        bloomStrengthRange.value = '1.0';
        
        group.appendChild(bloomToggle);
        group.appendChild(bloomStrengthRow);
        group.appendChild(bloomStrengthRange);
        container.appendChild(group);
        
        this.bloomStrengthRange = bloomStrengthRange;
    }
    
    createRenderingSettings(container) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const title = document.createElement('h4');
        title.textContent = 'Rendering Settings';
        title.style.marginBottom = 'var(--space-2)';
        
        // Anti-aliasing toggle
        const aaToggle = document.createElement('div');
        aaToggle.style.display = 'flex';
        aaToggle.style.justifyContent = 'space-between';
        aaToggle.style.alignItems = 'center';
        aaToggle.style.marginBottom = 'var(--space-2)';
        
        const aaLabel = document.createElement('label');
        aaLabel.textContent = 'Anti-aliasing';
        
        this.antiAliasingToggle = document.createElement('input');
        this.antiAliasingToggle.type = 'checkbox';
        this.antiAliasingToggle.className = 'form-control';
        this.antiAliasingToggle.checked = true;
        
        aaToggle.appendChild(aaLabel);
        aaToggle.appendChild(this.antiAliasingToggle);
        
        // Shadow quality select
        const shadowGroup = document.createElement('div');
        shadowGroup.style.marginBottom = 'var(--space-2)';
        
        const shadowLabel = document.createElement('label');
        shadowLabel.textContent = 'Shadow Quality';
        shadowLabel.setAttribute('for', 'shadow-quality');
        
        const shadowSelect = document.createElement('select');
        shadowSelect.id = 'shadow-quality';
        shadowSelect.className = 'form-control';
        shadowSelect.innerHTML = `
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
        `;
        
        shadowGroup.appendChild(shadowLabel);
        shadowGroup.appendChild(shadowSelect);
        
        group.appendChild(title);
        group.appendChild(aaToggle);
        group.appendChild(shadowGroup);
        container.appendChild(group);
        
        this.shadowQualitySelect = shadowSelect;
    }
    
    createPerformanceSection(container) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const title = document.createElement('h4');
        title.textContent = 'Performance';
        title.style.marginBottom = 'var(--space-2)';
        
        // FPS display
        const fpsDisplay = document.createElement('div');
        fpsDisplay.style.display = 'flex';
        fpsDisplay.style.justifyContent = 'space-between';
        fpsDisplay.style.alignItems = 'center';
        fpsDisplay.style.marginBottom = 'var(--space-2)';
        
        const fpsLabel = document.createElement('span');
        fpsLabel.textContent = 'FPS:';
        
        this.fpsValue = document.createElement('span');
        this.fpsValue.className = 'text-secondary font-mono';
        this.fpsValue.textContent = '60';
        
        fpsDisplay.appendChild(fpsLabel);
        fpsDisplay.appendChild(this.fpsValue);
        
        // Render time display
        const renderTimeDisplay = document.createElement('div');
        renderTimeDisplay.style.display = 'flex';
        renderTimeDisplay.style.justifyContent = 'space-between';
        renderTimeDisplay.style.alignItems = 'center';
        renderTimeDisplay.style.marginBottom = 'var(--space-2)';
        
        const renderLabel = document.createElement('span');
        renderLabel.textContent = 'Render Time:';
        
        this.renderTimeValue = document.createElement('span');
        this.renderTimeValue.className = 'text-secondary font-mono';
        this.renderTimeValue.textContent = '16ms';
        
        renderTimeDisplay.appendChild(renderLabel);
        renderTimeDisplay.appendChild(this.renderTimeValue);
        
        // VSync toggle
        const vsyncToggle = document.createElement('div');
        vsyncToggle.style.display = 'flex';
        vsyncToggle.style.justifyContent = 'space-between';
        vsyncToggle.style.alignItems = 'center';
        
        const vsyncLabel = document.createElement('label');
        vsyncLabel.textContent = 'VSync';
        
        this.vsyncToggle = document.createElement('input');
        this.vsyncToggle.type = 'checkbox';
        this.vsyncToggle.className = 'form-control';
        this.vsyncToggle.checked = true;
        
        vsyncToggle.appendChild(vsyncLabel);
        vsyncToggle.appendChild(this.vsyncToggle);
        
        group.appendChild(title);
        group.appendChild(fpsDisplay);
        group.appendChild(renderTimeDisplay);
        group.appendChild(vsyncToggle);
        container.appendChild(group);
    }
    
    setupEventListeners() {
        this.pixelationToggle.addEventListener('change', (e) => {
            this.togglePixelation(e.target.checked);
        });
        
        this.pixelSizeRange.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            this.pixelSizeValue.textContent = size;
            this.updatePixelSize(size);
        });
        
        this.bloomToggle.addEventListener('change', (e) => {
            this.toggleBloom(e.target.checked);
        });
        
        this.bloomStrengthRange.addEventListener('input', (e) => {
            const strength = parseFloat(e.target.value);
            this.bloomStrengthValue.textContent = strength.toFixed(1);
            this.updateBloomStrength(strength);
        });
        
        this.antiAliasingToggle.addEventListener('change', (e) => {
            this.toggleAntiAliasing(e.target.checked);
        });
        
        this.shadowQualitySelect.addEventListener('change', (e) => {
            this.updateShadowQuality(e.target.value);
        });
        
        this.vsyncToggle.addEventListener('change', (e) => {
            this.toggleVSync(e.target.checked);
        });
    }
    
    togglePostProcessing() {
        if (this.gameEngine.postProcessingManager) {
            const isEnabled = this.gameEngine.postProcessingManager.togglePostProcessing();
            this.postProcessingButton.textContent = isEnabled ? 'Disable Post-Processing' : 'Enable Post-Processing';
            this.postProcessingButton.className = this.postProcessingButton.className.replace(
                isEnabled ? 'btn-primary' : 'btn-danger', 
                isEnabled ? 'btn-danger' : 'btn-primary'
            );
        }
    }
    
    togglePixelation(enabled) {
        if (this.gameEngine.postProcessingManager) {
            this.gameEngine.postProcessingManager.setPixelationEnabled(enabled);
        }
    }
    
    updatePixelSize(size) {
        if (this.gameEngine.postProcessingManager) {
            this.gameEngine.postProcessingManager.setPixelSize(size);
        }
    }
    
    toggleBloom(enabled) {
        if (this.gameEngine.postProcessingManager) {
            this.gameEngine.postProcessingManager.setBloomEnabled(enabled);
        }
    }
    
    updateBloomStrength(strength) {
        if (this.gameEngine.postProcessingManager) {
            this.gameEngine.postProcessingManager.setBloomStrength(strength);
        }
    }
    
    toggleAntiAliasing(enabled) {
        if (this.gameEngine.renderer) {
            this.gameEngine.renderer.setPixelRatio(enabled ? window.devicePixelRatio : 1);
        }
    }
    
    updateShadowQuality(quality) {
        if (this.gameEngine.renderer) {
            const renderer = this.gameEngine.renderer;
            switch (quality) {
                case 'none':
                    renderer.shadowMap.enabled = false;
                    break;
                case 'low':
                    renderer.shadowMap.enabled = true;
                    renderer.shadowMap.type = THREE.BasicShadowMap;
                    break;
                case 'medium':
                    renderer.shadowMap.enabled = true;
                    renderer.shadowMap.type = THREE.PCFShadowMap;
                    break;
                case 'high':
                    renderer.shadowMap.enabled = true;
                    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                    break;
            }
        }
    }
    
    toggleVSync(enabled) {
        // VSync is typically controlled by the browser/system
        // This is more of a display setting
        console.log('VSync toggled:', enabled);
    }
    
    updatePerformanceStats(fps, renderTime) {
        if (this.fpsValue) {
            this.fpsValue.textContent = Math.round(fps);
        }
        if (this.renderTimeValue) {
            this.renderTimeValue.textContent = renderTime.toFixed(1) + 'ms';
        }
    }
    
    setVisible(visible) {
        this.isVisible = visible;
        if (this.element) {
            this.element.style.display = visible ? 'block' : 'none';
        }
    }
    
    updateState() {
        if (!this.gameEngine.postProcessingManager) return;
        
        const manager = this.gameEngine.postProcessingManager;
        
        // Update toggle states to match current settings
        this.pixelationToggle.checked = manager.isPixelationEnabled();
        this.bloomToggle.checked = manager.isBloomEnabled();
        
        if (manager.getPixelSize) {
            this.pixelSizeRange.value = manager.getPixelSize();
            this.pixelSizeValue.textContent = manager.getPixelSize();
        }
        
        if (manager.getBloomStrength) {
            this.bloomStrengthRange.value = manager.getBloomStrength();
            this.bloomStrengthValue.textContent = manager.getBloomStrength().toFixed(1);
        }
    }
}