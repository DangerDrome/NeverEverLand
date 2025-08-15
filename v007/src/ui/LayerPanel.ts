import { VoxelEngine } from '../engine/VoxelEngine';
import { VoxelLayer } from '../engine/VoxelLayer';
import { AssetPreviewScene } from './AssetPreviewScene';
import { VoxelType } from '../types';
import { ModalDialog } from './ModalDialog';

export class LayerPanel {
    private container: HTMLDivElement;
    private layerList: HTMLDivElement;
    private voxelEngine: VoxelEngine;
    private updateCallback: () => void;
    private previewScene: AssetPreviewScene;
    
    constructor(voxelEngine: VoxelEngine, updateCallback: () => void) {
        this.voxelEngine = voxelEngine;
        this.updateCallback = updateCallback;
        
        // Create preview scene for generating thumbnails
        this.previewScene = new AssetPreviewScene();
        
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'layer-panel';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'layer-panel-header';
        header.innerHTML = '<i data-lucide="layers" style="width: 16px; height: 16px; margin-right: 6px;"></i><span>Layers</span>';
        
        // Make header draggable
        let isDragging = false;
        let currentX: number;
        let currentY: number;
        let initialX: number;
        let initialY: number;
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            initialX = e.clientX - this.container.offsetLeft;
            initialY = e.clientY - this.container.offsetTop;
            header.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            this.container.style.left = currentX + 'px';
            this.container.style.top = currentY + 'px';
            this.container.style.right = 'auto';
            this.container.style.bottom = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'grab';
        });
        
        // Create layer list container
        this.layerList = document.createElement('div');
        this.layerList.className = 'layer-list';
        
        // Create footer toolbar
        const footer = document.createElement('div');
        footer.className = 'layer-panel-footer';
        
        // Add layer button
        const addButton = this.createButton('plus', 'Add Layer', () => {
            const layer = this.voxelEngine.createLayer();
            this.voxelEngine.setActiveLayer(layer.id);
            this.refresh();
            this.updateCallback();
        });
        
        // Delete layer button
        const deleteButton = this.createButton('trash-2', 'Delete Layer', () => {
            const activeLayer = this.voxelEngine.getActiveLayer();
            if (activeLayer && this.voxelEngine.getAllLayers().length > 1) {
                this.voxelEngine.deleteLayer(activeLayer.id);
                this.refresh();
                this.updateCallback();
            }
        });
        
        // Duplicate layer button
        const duplicateButton = this.createButton('copy', 'Duplicate Layer', () => {
            const activeLayer = this.voxelEngine.getActiveLayer();
            if (activeLayer) {
                const newLayer = this.voxelEngine.duplicateLayer(activeLayer.id);
                if (newLayer) {
                    this.voxelEngine.setActiveLayer(newLayer.id);
                    this.refresh();
                    this.updateCallback();
                }
            }
        });
        
        // Merge down button
        const mergeButton = this.createButton('merge', 'Merge Down', () => {
            const activeLayer = this.voxelEngine.getActiveLayer();
            if (activeLayer) {
                const layers = this.voxelEngine.getAllLayers();
                const index = layers.findIndex(l => l.id === activeLayer.id);
                if (index > 0) {
                    this.voxelEngine.mergeLayerDown(activeLayer.id);
                    this.refresh();
                    this.updateCallback();
                }
            }
        });
        
        footer.appendChild(addButton);
        footer.appendChild(deleteButton);
        footer.appendChild(duplicateButton);
        footer.appendChild(mergeButton);
        
        // Assemble panel
        this.container.appendChild(header);
        this.container.appendChild(this.layerList);
        this.container.appendChild(footer);
        
        // Initialize Lucide icons in header
        setTimeout(() => {
            if ((window as any).lucide) {
                (window as any).lucide.createIcons();
            }
        }, 0);
        
        // Initial refresh
        this.refresh();
    }
    
    private createButton(iconName: string, tooltip: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'layer-panel-button';
        button.title = tooltip;
        button.innerHTML = `<i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>`;
        button.addEventListener('click', onClick);
        
        // Initialize Lucide icon
        setTimeout(() => {
            if ((window as any).lucide) {
                (window as any).lucide.createIcons();
            }
        }, 0);
        
        return button;
    }
    
    refresh(): void {
        // Clear layer list
        this.layerList.innerHTML = '';
        
        const layers = this.voxelEngine.getAllLayers();
        const activeLayer = this.voxelEngine.getActiveLayer();
        
        // Add layers in reverse order (top to bottom)
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const layerItem = this.createLayerItem(layer, layer.id === activeLayer?.id, i);
            this.layerList.appendChild(layerItem);
        }
    }
    
    private createLayerItem(layer: VoxelLayer, isActive: boolean, index: number): HTMLDivElement {
        const item = document.createElement('div');
        item.className = 'layer-item' + (isActive ? ' active' : '');
        item.dataset.layerId = layer.id;
        
        // Mark asset editing layers
        if (layer.isEditingAsset) {
            item.dataset.editingAsset = 'true';
        }
        
        // Mark baked layers
        if (layer.isBaked) {
            item.dataset.baked = 'true';
        }
        
        // Click to select layer
        item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.layer-controls')) return;
            this.voxelEngine.setActiveLayer(layer.id);
            this.refresh();
        });
        
        // Preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'layer-preview-container';
        
        // Preview canvas
        const preview = document.createElement('canvas');
        preview.className = 'layer-preview';
        preview.width = 48;
        preview.height = 48;
        
        // Refresh preview button
        const refreshButton = document.createElement('button');
        refreshButton.className = 'layer-preview-refresh';
        refreshButton.innerHTML = '<i data-lucide="refresh-cw" style="width: 12px; height: 12px;"></i>';
        refreshButton.title = 'Refresh preview';
        refreshButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.updateLayerPreview(layer, preview);
        });
        
        previewContainer.appendChild(preview);
        previewContainer.appendChild(refreshButton);
        
        // Generate initial preview
        this.updateLayerPreview(layer, preview);
        
        // Visibility toggle
        const visibilityButton = document.createElement('button');
        visibilityButton.className = 'layer-visibility';
        visibilityButton.innerHTML = layer.visible ? 
            '<i data-lucide="eye" style="width: 12px; height: 12px;"></i>' : 
            '<i data-lucide="eye-off" style="width: 12px; height: 12px;"></i>';
        visibilityButton.style.opacity = layer.visible ? '1' : '0.3';
        visibilityButton.addEventListener('click', (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            this.refresh();
            this.updateCallback();
        });
        
        // Layer name and info container
        const nameContainer = document.createElement('div');
        nameContainer.className = 'layer-name-container';
        
        // Layer name with asset editing indicator
        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.style.display = 'flex';
        nameSpan.style.alignItems = 'center';
        nameSpan.style.gap = '4px';
        
        // Add pencil icon for asset editing layers
        if (layer.isEditingAsset) {
            const editIcon = document.createElement('i');
            editIcon.setAttribute('data-lucide', 'pencil');
            editIcon.style.cssText = 'width: 12px; height: 12px; color: rgba(100, 200, 100, 0.8);';
            nameSpan.appendChild(editIcon);
        }
        
        // Add editable text
        const nameText = document.createElement('span');
        nameText.textContent = layer.name;
        nameText.contentEditable = 'true';
        nameText.addEventListener('blur', () => {
            layer.name = nameText.textContent || 'Untitled';
            this.refresh();
        });
        nameText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameText.blur();
            }
        });
        nameSpan.appendChild(nameText);
        
        // Layer info (voxel count and baking status)
        const infoSpan = document.createElement('span');
        infoSpan.className = 'layer-info';
        let infoText = `${layer.getVoxelCount()} voxels`;
        if (layer.isBaked) {
            const metadata = layer.getBakingMetadata();
            if (metadata) {
                const reduction = ((1 - metadata.vertexCount / (metadata.originalVoxelCount * 24)) * 100).toFixed(1);
                // Add line break before baked status
                infoText += `\nBaked (${reduction}%)`;
            }
        } else {
            // Show unbaked status
            infoText += '\nUnbaked';
        }
        infoSpan.innerHTML = infoText.replace('\n', '<br>');
        
        nameContainer.appendChild(nameSpan);
        nameContainer.appendChild(infoSpan);
        
        // Remove lock button - no longer needed
        
        // Save button - different for asset editing layers
        const saveButton = document.createElement('button');
        saveButton.className = 'layer-save';
        
        if (layer.isEditingAsset) {
            // Save Asset button for editing layers
            saveButton.innerHTML = '<i data-lucide="save" style="width: 12px; height: 12px;"></i>';
            saveButton.title = 'Save as Asset';
            saveButton.style.background = 'rgba(100, 200, 100, 0.3)';
            saveButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.saveAssetFromLayer(layer);
            });
        } else {
            // Normal save as VOX button
            saveButton.innerHTML = '<i data-lucide="download" style="width: 12px; height: 12px;"></i>';
            saveButton.title = 'Save layer as VOX';
            saveButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                // Export this layer as VOX
                if ((window as any).app?.fileManager) {
                    await (window as any).app.fileManager.exportLayer(layer.id, 'vox');
                }
            });
        }
        
        // Load button
        const loadButton = document.createElement('button');
        loadButton.className = 'layer-load';
        loadButton.innerHTML = '<i data-lucide="upload" style="width: 12px; height: 12px;"></i>';
        loadButton.title = 'Load VOX into layer';
        loadButton.addEventListener('click', (e) => {
            e.stopPropagation();
            // Create hidden file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.vox';
            input.onchange = async (event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (file && (window as any).app?.fileManager) {
                    await (window as any).app.fileManager.importToLayer(file, layer.id);
                    this.refresh();
                    this.updateCallback();
                    // Update preview after loading
                    this.updateLayerPreview(layer, preview);
                }
            };
            input.click();
        });
        
        // Bake/Unbake button (moved to where lock button was)
        const bakeButton = document.createElement('button');
        bakeButton.className = layer.isBaked ? 'layer-unbake' : 'layer-bake';
        bakeButton.innerHTML = layer.isBaked ? 
            '<i data-lucide="package-x" style="width: 12px; height: 12px;"></i>' : 
            '<i data-lucide="package" style="width: 12px; height: 12px;"></i>';
        bakeButton.title = layer.isBaked ? 'Unbake layer (restore editing)' : 'Bake layer (optimize for performance)';
        bakeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (layer.isBaked) {
                this.voxelEngine.unbakeLayer(layer.id);
            } else {
                this.voxelEngine.bakeLayer(layer.id);
            }
            this.refresh();
            this.updateCallback();
        });
        
        // Icon column (visibility and bake button)
        const iconColumn = document.createElement('div');
        iconColumn.className = 'layer-icon-column';
        iconColumn.appendChild(visibilityButton);
        iconColumn.appendChild(bakeButton);
        
        // File button column (load and save stacked)
        const fileColumn = document.createElement('div');
        fileColumn.className = 'layer-file-column';
        fileColumn.appendChild(loadButton);
        fileColumn.appendChild(saveButton);
        
        // Controls container
        const controls = document.createElement('div');
        controls.className = 'layer-controls';
        controls.appendChild(iconColumn);
        controls.appendChild(nameContainer);
        controls.appendChild(fileColumn);
        
        // Assemble item
        item.appendChild(previewContainer);
        item.appendChild(controls);
        
        // Initialize Lucide icons for this item
        setTimeout(() => {
            if ((window as any).lucide) {
                (window as any).lucide.createIcons();
            }
        }, 0);
        
        return item;
    }
    
    private updateLayerPreview(layer: VoxelLayer, canvas: HTMLCanvasElement): void {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Clear canvas with checkerboard pattern for empty layers
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, 48, 48);
        ctx.fillStyle = '#444';
        for (let x = 0; x < 48; x += 8) {
            for (let y = 0; y < 48; y += 8) {
                if ((x / 8 + y / 8) % 2 === 0) {
                    ctx.fillRect(x, y, 8, 8);
                }
            }
        }
        
        // Get layer voxels
        const voxelsByType = layer.getVoxelsByType();
        const assetData = new Map<string, VoxelType>();
        
        // Convert to asset data format
        for (const [type, positions] of voxelsByType) {
            if (type === VoxelType.AIR) continue;
            for (const posKey of positions) {
                assetData.set(posKey, type);
            }
        }
        
        // If layer has voxels, generate preview
        if (assetData.size > 0) {
            this.previewScene.loadAsset(assetData);
            const dataUrl = this.previewScene.screenshot(48, 48);
            
            // Load the screenshot into canvas
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, 48, 48);
                ctx.drawImage(img, 0, 0);
            };
            img.src = dataUrl;
        }
    }
    
    getElement(): HTMLElement {
        return this.container;
    }
    
    private async saveAssetFromLayer(layer: VoxelLayer): Promise<void> {
        if (!layer.isEditingAsset || !layer.editingAssetType) {
            console.error('Layer is not editing an asset');
            return;
        }
        
        try {
            // Get the asset manager
            const assetManager = (window as any).app?.voxelPanel?.getAssetManager();
            if (!assetManager) {
                console.error('Asset manager not available');
                return;
            }
            
            // Prepare asset data
            const assetData = {
                name: layer.name.replace('Edit: ', ''),
                type: layer.editingAssetType,
                voxelData: layer.getVoxels()
            };
            
            // Save the asset
            let assetId: string;
            if (layer.editingAssetId && layer.editingAssetId.startsWith('user_')) {
                // Update existing user asset
                assetId = await assetManager.updateAsset(layer.editingAssetId, assetData);
                console.log(`Updated asset: ${assetId}`);
            } else {
                // Create new user asset (for default assets or new assets)
                assetId = await assetManager.saveAsset(assetData);
                console.log(`Created new asset: ${assetId}`);
            }
            
            // Clear the asset preview cache to force thumbnail regeneration
            const voxelPanel = (window as any).app?.voxelPanel;
            if (voxelPanel && voxelPanel.getAssetPopover) {
                const assetPopover = voxelPanel.getAssetPopover();
                if (assetPopover && assetPopover.clearPreviewCache) {
                    assetPopover.clearPreviewCache(assetId);
                }
            }
            
            // Show success feedback
            const saveButton = document.querySelector(`[data-layer-id="${layer.id}"] .layer-save`) as HTMLButtonElement;
            if (saveButton) {
                const originalBg = saveButton.style.background;
                const originalTitle = saveButton.title;
                saveButton.style.background = 'rgba(100, 255, 100, 0.5)';
                saveButton.title = 'Saved!';
                
                setTimeout(() => {
                    saveButton.style.background = originalBg;
                    saveButton.title = originalTitle;
                }, 2000);
            }
            
            // Optionally ask to delete the edit layer
            const deleteLayer = await ModalDialog.confirm({
                title: 'Asset Saved',
                message: 'Asset saved successfully! Would you like to delete this edit layer?',
                confirmText: 'Delete Layer',
                cancelText: 'Keep Layer'
            });
            
            if (deleteLayer) {
                this.voxelEngine.deleteLayer(layer.id);
                this.refresh();
                this.updateCallback();
            }
        } catch (error) {
            console.error('Failed to save asset:', error);
            await ModalDialog.alert({
                title: 'Save Failed',
                message: `Failed to save asset: ${error}`,
                type: 'error'
            });
        }
    }
    
    dispose(): void {
        this.previewScene.dispose();
    }
}