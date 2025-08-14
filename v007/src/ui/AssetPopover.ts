import * as THREE from 'three';
import { VoxelType } from '../engine/VoxelEngine';
import { AssetInfo, AssetData } from '../assets/types';
import { StaticAssetManager } from '../assets/StaticAssetManager';
import { AssetPreviewScene } from './AssetPreviewScene';
import { ModalDialog } from './ModalDialog';

export class AssetPopover {
    private element: HTMLElement | null = null;
    private assetManager: StaticAssetManager;
    private onSelectCallback: ((asset: AssetInfo) => void) | null = null;
    private onEditCallback: ((asset: AssetInfo) => void) | null = null;
    private onDeleteCallback: ((asset: AssetInfo) => void) | null = null;
    private previewScene: AssetPreviewScene;
    private previewCache: Map<string, string> = new Map(); // asset id -> base64 image
    
    constructor(assetManager: StaticAssetManager) {
        this.assetManager = assetManager;
        
        // Create asset preview scene for generating thumbnails
        this.previewScene = new AssetPreviewScene(128);
    }
    
    async show(anchorElement: HTMLElement, type: VoxelType, onSelect: (asset: AssetInfo) => void, onEdit?: (asset: AssetInfo) => void, onDelete?: (asset: AssetInfo) => void): Promise<void> {
        this.onSelectCallback = onSelect;
        this.onEditCallback = onEdit || null;
        this.onDeleteCallback = onDelete || null;
        
        // Hide any existing popover first
        this.hide();
        
        // Load assets for this type
        const assets = await this.assetManager.loadAssetList(type);
        
        if (assets.length === 0) {
            // No assets available for this type
            throw new Error('No assets available');
        }
        
        // Create popover if it doesn't exist
        if (!this.element) {
            this.createElement();
        }
        
        // Clear existing content
        this.element!.innerHTML = '';
        
        // Add title
        const title = document.createElement('div');
        title.style.cssText = `
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 12px;
            text-align: center;
        `;
        title.textContent = `${this.getVoxelTypeName(type)} Assets`;
        this.element!.appendChild(title);
        
        // Create horizontal container
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: flex;
            flex-direction: row;
            gap: 12px;
            padding: 0;
            align-items: center;
            justify-content: center;
        `;
        
        // Add asset items
        for (const asset of assets) {
            const item = await this.createAssetItem(asset);
            grid.appendChild(item);
        }
        
        this.element!.appendChild(grid);
        
        // Create arrow elements (will position them later)
        const arrow = document.createElement('div');
        arrow.id = 'popover-arrow';
        arrow.style.cssText = `
            position: absolute;
            bottom: -10px;
            width: 0;
            height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 10px solid rgba(30, 30, 30, 0.95);
            z-index: 1001;
        `;
        this.element!.appendChild(arrow);
        
        // Add arrow border
        const arrowBorder = document.createElement('div');
        arrowBorder.id = 'popover-arrow-border';
        arrowBorder.style.cssText = `
            position: absolute;
            bottom: -11px;
            width: 0;
            height: 0;
            border-left: 11px solid transparent;
            border-right: 11px solid transparent;
            border-top: 11px solid rgba(255, 255, 255, 0.15);
            z-index: 1000;
        `;
        this.element!.appendChild(arrowBorder);
        
        
        // First, make the element visible but off-screen to measure it
        this.element!.style.display = 'block';
        this.element!.style.visibility = 'hidden';
        this.element!.style.left = '-9999px';
        
        // Now we can get the actual height
        const popoverHeight = this.element!.offsetHeight;
        // Dynamic width based on number of assets (each item is 80px + 12px gap)
        const popoverWidth = Math.min(assets.length * 92 + 20, window.innerWidth - 40); // Leave margin on sides
        
        // Position popover above the anchor element
        const rect = anchorElement.getBoundingClientRect();
        
        // Center popover on the button
        const buttonCenterX = rect.left + rect.width / 2;
        let left = buttonCenterX - popoverWidth / 2;
        let top = rect.top - popoverHeight - 20; // 20px gap above button
        
        // Ensure popover stays within viewport horizontally
        if (left < 10) left = 10;
        if (left + popoverWidth > window.innerWidth - 10) {
            left = window.innerWidth - popoverWidth - 10;
        }
        
        // Ensure popover stays within viewport vertically
        // Always try to show above first
        if (top < 10) {
            // If not enough space above, try below
            top = rect.bottom + 10;
            
            // If it would go off bottom of screen, show above anyway but clip to top
            if (top + popoverHeight > window.innerHeight - 10) {
                top = Math.max(10, rect.top - popoverHeight - 10);
            }
        }
        
        // Apply final position, width and make visible
        this.element!.style.left = `${left}px`;
        this.element!.style.top = `${top}px`;
        this.element!.style.width = `${popoverWidth}px`;
        this.element!.style.visibility = 'visible';
        
        // Position arrow to point to center of button
        const arrowX = buttonCenterX - left; // Position relative to popover
        
        const arrowElement = document.getElementById('popover-arrow');
        const arrowBorderElement = document.getElementById('popover-arrow-border');
        
        if (arrowElement) {
            arrowElement.style.left = `${arrowX}px`;
            arrowElement.style.transform = 'translateX(-50%)';
        }
        
        if (arrowBorderElement) {
            arrowBorderElement.style.left = `${arrowX}px`;
            arrowBorderElement.style.transform = 'translateX(-50%)';
        }
        
        // Add click outside listener
        // Use a longer delay to ensure the click event that opened the popover has finished
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
    }
    
    hide(): void {
        if (this.element) {
            this.element.style.display = 'none';
        }
        document.removeEventListener('click', this.handleClickOutside);
    }
    
    private createElement(): void {
        this.element = document.createElement('div');
        this.element.className = 'asset-popover';
        this.element.style.cssText = `
            position: fixed;
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            padding: 16px;
            min-width: 150px;
            max-width: 90vw;
            z-index: 1000;
            display: none;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        document.body.appendChild(this.element);
    }
    
    private async createAssetItem(asset: AssetInfo): Promise<HTMLElement> {
        const item = document.createElement('div');
        item.style.cssText = `
            background: rgba(50, 50, 50, 0.5);
            border: none;
            border-radius: 6px;
            padding: 2px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
            width: 80px;
            height: 80px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
        `;
        
        // Add preview image
        const preview = document.createElement('div');
        preview.style.cssText = `
            width: 76px;
            height: 76px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        `;
        
        // Generate or get cached preview
        const previewUrl = await this.getAssetPreview(asset);
        if (previewUrl) {
            const img = document.createElement('img');
            img.src = previewUrl;
            img.style.cssText = `
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            `;
            preview.appendChild(img);
        } else {
            // Fallback icon
            preview.innerHTML = `<span style="color: rgba(255, 255, 255, 0.5); font-size: 16px;">📦</span>`;
        }
        
        item.appendChild(preview);
        
        // Add user asset indicator
        if (asset.isUserAsset) {
            const badge = document.createElement('div');
            badge.style.cssText = `
                position: absolute;
                top: 4px;
                right: 4px;
                background: rgba(100, 200, 100, 0.8);
                color: white;
                font-size: 10px;
                padding: 2px 4px;
                border-radius: 3px;
            `;
            badge.textContent = 'USER';
            item.appendChild(badge);
        }
        
        // Container for action buttons
        const actionButtons: HTMLElement[] = [];
        
        // Add edit button
        if (this.onEditCallback) {
            const editButton = document.createElement('button');
            editButton.style.cssText = `
                position: absolute;
                bottom: 4px;
                right: 4px;
                background: rgba(60, 60, 60, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                opacity: 0;
            `;
            editButton.innerHTML = '<i data-lucide="pencil" style="width: 12px; height: 12px; color: rgba(255, 255, 255, 0.8);"></i>';
            editButton.title = 'Edit Asset';
            
            // Edit button hover effect
            editButton.addEventListener('mouseenter', () => {
                editButton.style.background = 'rgba(100, 150, 255, 0.9)';
                editButton.style.transform = 'scale(1.1)';
            });
            
            editButton.addEventListener('mouseleave', () => {
                editButton.style.background = 'rgba(60, 60, 60, 0.9)';
                editButton.style.transform = 'scale(1)';
            });
            
            // Edit button click handler
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onEditCallback) {
                    this.onEditCallback(asset);
                }
                this.hide();
            });
            
            item.appendChild(editButton);
            actionButtons.push(editButton);
        }
        
        // Add export button
        const exportButton = document.createElement('button');
        exportButton.style.cssText = `
            position: absolute;
            bottom: 4px;
            right: ${actionButtons.length > 0 ? (actionButtons.length * 24 + 4) + 'px' : '4px'};
            background: rgba(60, 60, 60, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            opacity: 0;
        `;
        exportButton.innerHTML = '<i data-lucide="download" style="width: 12px; height: 12px; color: rgba(255, 255, 255, 0.8);"></i>';
        exportButton.title = 'Export as VOX';
        
        // Export button hover effect
        exportButton.addEventListener('mouseenter', () => {
            exportButton.style.background = 'rgba(100, 200, 100, 0.9)';
            exportButton.style.transform = 'scale(1.1)';
        });
        
        exportButton.addEventListener('mouseleave', () => {
            exportButton.style.background = 'rgba(60, 60, 60, 0.9)';
            exportButton.style.transform = 'scale(1)';
        });
        
        // Export button click handler
        exportButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await this.assetManager.exportAssetAsVox(asset.id);
                console.log(`Exported asset: ${asset.name}`);
            } catch (error) {
                console.error('Failed to export asset:', error);
                await ModalDialog.alert({
                    title: 'Export Failed',
                    message: `Failed to export asset: ${error}`,
                    type: 'error'
                });
            }
        });
        
        item.appendChild(exportButton);
        actionButtons.push(exportButton);
        
        // Add delete button for user assets
        if (this.onDeleteCallback && asset.isUserAsset) {
            const deleteButton = document.createElement('button');
            deleteButton.style.cssText = `
                position: absolute;
                bottom: 4px;
                right: ${actionButtons.length > 0 ? (actionButtons.length * 24 + 4) + 'px' : '4px'};
                background: rgba(60, 60, 60, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                opacity: 0;
            `;
            deleteButton.innerHTML = '<i data-lucide="trash-2" style="width: 12px; height: 12px; color: rgba(255, 255, 255, 0.8);"></i>';
            deleteButton.title = 'Delete Asset';
            
            // Delete button hover effect
            deleteButton.addEventListener('mouseenter', () => {
                deleteButton.style.background = 'rgba(255, 100, 100, 0.9)';
                deleteButton.style.transform = 'scale(1.1)';
            });
            
            deleteButton.addEventListener('mouseleave', () => {
                deleteButton.style.background = 'rgba(60, 60, 60, 0.9)';
                deleteButton.style.transform = 'scale(1)';
            });
            
            // Delete button click handler
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (this.onDeleteCallback) {
                    const confirmed = await ModalDialog.confirm({
                        title: 'Delete Asset',
                        message: `Are you sure you want to delete the asset "${asset.name}"? This action cannot be undone.`,
                        confirmText: 'Delete',
                        cancelText: 'Cancel',
                        confirmButtonStyle: 'danger'
                    });
                    
                    if (confirmed) {
                        this.onDeleteCallback(asset);
                        this.hide();
                    }
                }
            });
            
            item.appendChild(deleteButton);
            actionButtons.push(deleteButton);
        }
        
        // Show buttons on hover
        if (actionButtons.length > 0) {
            item.addEventListener('mouseenter', () => {
                actionButtons.forEach(btn => btn.style.opacity = '1');
            });
            
            item.addEventListener('mouseleave', () => {
                actionButtons.forEach(btn => btn.style.opacity = '0');
            });
        }
        
        // Initialize Lucide icons
        setTimeout(() => {
            if ((window as any).lucide) {
                (window as any).lucide.createIcons();
            }
        }, 0);
        
        // Hover effect
        item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(70, 70, 70, 0.7)';
            item.style.transform = 'scale(1.05)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.background = 'rgba(50, 50, 50, 0.5)';
            item.style.transform = 'scale(1)';
        });
        
        // Click handler
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onSelectCallback) {
                this.onSelectCallback(asset);
            }
            this.hide();
        });
        
        return item;
    }
    
    private async getAssetPreview(asset: AssetInfo): Promise<string | null> {
        // Check cache
        if (this.previewCache.has(asset.id)) {
            return this.previewCache.get(asset.id)!;
        }
        
        try {
            // Load asset data
            const assetData = await this.assetManager.loadAsset(asset.id);
            if (!assetData || !assetData.voxelData || assetData.voxelData.size === 0) {
                return null;
            }
            
            // Generate preview using the preview scene
            this.previewScene.loadAsset(assetData.voxelData);
            const dataURL = this.previewScene.screenshot(76, 76);
            
            // Cache the result
            this.previewCache.set(asset.id, dataURL);
            
            return dataURL;
        } catch (error) {
            console.error(`Failed to generate preview for ${asset.id}:`, error);
            return null;
        }
    }
    
    private getVoxelTypeName(type: VoxelType): string {
        const names: Record<VoxelType, string> = {
            [VoxelType.AIR]: 'Air',
            [VoxelType.GRASS]: 'Grass',
            [VoxelType.DIRT]: 'Dirt',
            [VoxelType.STONE]: 'Stone',
            [VoxelType.WOOD]: 'Wood',
            [VoxelType.LEAVES]: 'Leaves',
            [VoxelType.WATER]: 'Water',
            [VoxelType.SAND]: 'Sand',
            [VoxelType.SNOW]: 'Snow',
            [VoxelType.ICE]: 'Ice'
        };
        return names[type] || 'Unknown';
    }
    
    private handleClickOutside = (e: MouseEvent): void => {
        // Don't hide if clicking on a voxel button (which might be trying to show another popover)
        const target = e.target as HTMLElement;
        const isVoxelButton = target.closest('.voxel-button');
        
        if (this.element && !this.element.contains(target) && !isVoxelButton) {
            this.hide();
        }
    };
    
    clearPreviewCache(assetId?: string): void {
        if (assetId) {
            // Clear specific asset preview
            this.previewCache.delete(assetId);
        } else {
            // Clear all previews
            this.previewCache.clear();
        }
    }
    
    dispose(): void {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.previewScene.dispose();
        document.removeEventListener('click', this.handleClickOutside);
    }
}