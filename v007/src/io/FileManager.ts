import { VoxelEngine } from '../engine/VoxelEngine';
import { VoxelType } from '../types';
import { VoxParser } from './VoxParser';
import { VoxWriter } from './VoxWriter';

/**
 * File manager for importing and exporting voxel data
 * Supports multiple formats: VOX (MagicaVoxel) and JSON
 */
export class FileManager {
    private voxelEngine: VoxelEngine;
    private voxParser: VoxParser;
    private voxWriter: VoxWriter;
    
    constructor(voxelEngine: VoxelEngine) {
        this.voxelEngine = voxelEngine;
        this.voxParser = new VoxParser();
        this.voxWriter = new VoxWriter();
    }
    
    /**
     * Import voxel data from a file
     */
    async importFile(file: File): Promise<void> {
        const extension = file.name.split('.').pop()?.toLowerCase();
        
        switch (extension) {
            case 'vox':
                await this.importVoxFile(file);
                break;
            case 'json':
                await this.importJsonFile(file);
                break;
            default:
                throw new Error(`Unsupported file format: ${extension}`);
        }
    }
    
    /**
     * Export voxel data to a file
     */
    async exportFile(format: 'vox' | 'json', filename?: string): Promise<void> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const defaultFilename = `voxels_${timestamp}`;
        const actualFilename = filename || defaultFilename;
        
        switch (format) {
            case 'vox':
                await this.exportVoxFile(actualFilename);
                break;
            case 'json':
                await this.exportJsonFile(actualFilename);
                break;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    
    /**
     * Import VOX file (MagicaVoxel format)
     */
    private async importVoxFile(file: File): Promise<void> {
        try {
            const buffer = await file.arrayBuffer();
            const voxData = await this.voxParser.parseVoxFile(buffer);
            
            console.log(`Importing VOX file with ${voxData.models.length} models`);
            
            // Clear existing voxels
            this.voxelEngine.clear();
            
            // Convert and import voxels
            const voxels = this.voxParser.convertToVoxelData(voxData);
            
            for (const [posKey, type] of voxels.entries()) {
                const [x, y, z] = posKey.split(',').map(Number);
                this.voxelEngine.setVoxel(x, y, z, type, false); // Don't record undo
            }
            
            // Update rendering
            this.voxelEngine.updateInstances();
            
            console.log(`Imported ${voxels.size} voxels from VOX file`);
            
            // Log the import
            import('../ui/ActionLogger').then(({ ActionLogger }) => {
                const logger = ActionLogger.getInstance();
                logger.log(ActionLogger.actions.importVoxels(file.name));
            });
        } catch (error) {
            console.error('Error importing VOX file:', error);
            throw new Error(`Failed to import VOX file: ${error}`);
        }
    }
    
    /**
     * Export VOX file (MagicaVoxel format)
     */
    private async exportVoxFile(filename: string): Promise<void> {
        try {
            // Get voxel data from engine
            const voxelData = this.voxelEngine.exportVoxels();
            
            // Convert to voxelsByType map
            const voxelsByType = new Map<VoxelType, Set<string>>();
            for (const [typeStr, positions] of Object.entries(voxelData.voxels)) {
                const type = parseInt(typeStr) as VoxelType;
                voxelsByType.set(type, new Set(positions as string[]));
            }
            
            // Create VOX file
            const buffer = this.voxWriter.createVoxFile(voxelsByType);
            
            // Download file
            this.downloadFile(buffer, `${filename}.vox`, 'application/octet-stream');
            
            console.log(`Exported ${this.voxelEngine.getVoxelCount()} voxels to VOX file`);
            
            // Log the export
            import('../ui/ActionLogger').then(({ ActionLogger }) => {
                const logger = ActionLogger.getInstance();
                logger.log(ActionLogger.actions.exportVoxels('VOX'));
            });
        } catch (error) {
            console.error('Error exporting VOX file:', error);
            throw new Error(`Failed to export VOX file: ${error}`);
        }
    }
    
    /**
     * Import JSON file (native format with full features)
     */
    private async importJsonFile(file: File): Promise<void> {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Validate data format
            if (!data.voxels || typeof data.voxels !== 'object') {
                throw new Error('Invalid JSON format: missing voxels data');
            }
            
            // Import using existing engine method
            this.voxelEngine.importVoxels(data);
            
            // Update rendering
            this.voxelEngine.updateInstances();
            
            console.log(`Imported voxels from JSON file`);
            
            // Log the import
            import('../ui/ActionLogger').then(({ ActionLogger }) => {
                const logger = ActionLogger.getInstance();
                logger.log(ActionLogger.actions.importVoxels(file.name));
            });
        } catch (error) {
            console.error('Error importing JSON file:', error);
            throw new Error(`Failed to import JSON file: ${error}`);
        }
    }
    
    /**
     * Export JSON file (native format with full features)
     */
    private async exportJsonFile(filename: string): Promise<void> {
        try {
            // Get voxel data with metadata
            const data = this.voxelEngine.exportVoxels();
            
            // Add additional metadata
            const exportData = {
                ...data,
                metadata: {
                    version: '2.0',
                    timestamp: Date.now(),
                    voxelCount: this.voxelEngine.getVoxelCount(),
                    bounds: this.voxelEngine.getBounds(),
                    format: 'NeverEverLand v007',
                    features: {
                        voxelTypes: Object.keys(VoxelType).filter(k => isNaN(Number(k))),
                        voxelSize: data.voxelSize
                    }
                }
            };
            
            // Create JSON string with pretty formatting
            const json = JSON.stringify(exportData, null, 2);
            
            // Download file
            const blob = new Blob([json], { type: 'application/json' });
            this.downloadFile(blob, `${filename}.json`, 'application/json');
            
            console.log(`Exported ${this.voxelEngine.getVoxelCount()} voxels to JSON file`);
            
            // Log the export
            import('../ui/ActionLogger').then(({ ActionLogger }) => {
                const logger = ActionLogger.getInstance();
                logger.log(ActionLogger.actions.exportVoxels('JSON'));
            });
        } catch (error) {
            console.error('Error exporting JSON file:', error);
            throw new Error(`Failed to export JSON file: ${error}`);
        }
    }
    
    /**
     * Helper function to download a file
     */
    private downloadFile(data: ArrayBuffer | Blob, filename: string, mimeType: string): void {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    /**
     * Get supported file extensions for import
     */
    getSupportedImportFormats(): string[] {
        return ['vox', 'json'];
    }
    
    /**
     * Get supported file extensions for export
     */
    getSupportedExportFormats(): string[] {
        return ['vox', 'json'];
    }
    
    /**
     * Export a specific layer to VOX file
     */
    async exportLayer(layerId: string, format: 'vox' | 'json'): Promise<void> {
        const layers = this.voxelEngine.getAllLayers();
        const layer = layers.find(l => l.id === layerId);
        
        if (!layer) {
            throw new Error(`Layer with id ${layerId} not found`);
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `${layer.name.replace(/\s+/g, '_')}_${timestamp}`;
        
        if (format === 'vox') {
            // Get voxels from the specific layer
            const voxelsByType = layer.getVoxelsByType();
            
            // Create VOX file
            const buffer = this.voxWriter.createVoxFile(voxelsByType);
            
            // Download file
            this.downloadFile(buffer, `${filename}.vox`, 'application/octet-stream');
            
            console.log(`Exported ${layer.getVoxelCount()} voxels from layer "${layer.name}" to VOX file`);
        } else {
            // Export as JSON with layer data
            const exportData = {
                version: '2.0',
                timestamp: Date.now(),
                voxelSize: 0.1,
                layers: [layer.exportData()],
                metadata: {
                    format: 'NeverEverLand v007 Layer Export',
                    layerName: layer.name,
                    voxelCount: layer.getVoxelCount()
                }
            };
            
            const json = JSON.stringify(exportData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            this.downloadFile(blob, `${filename}.json`, 'application/json');
            
            console.log(`Exported layer "${layer.name}" to JSON file`);
        }
    }
    
    /**
     * Import VOX file into a specific layer
     */
    async importToLayer(file: File, layerId: string): Promise<void> {
        const layers = this.voxelEngine.getAllLayers();
        const layer = layers.find(l => l.id === layerId);
        
        if (!layer) {
            throw new Error(`Layer with id ${layerId} not found`);
        }
        
        const extension = file.name.split('.').pop()?.toLowerCase();
        
        if (extension === 'vox') {
            try {
                const buffer = await file.arrayBuffer();
                const voxData = await this.voxParser.parseVoxFile(buffer);
                
                console.log(`Importing VOX file with ${voxData.models.length} models into layer "${layer.name}"`);
                
                // Clear the layer first
                layer.clear();
                
                // Convert and import voxels
                const voxels = this.voxParser.convertToVoxelData(voxData);
                
                for (const [posKey, type] of voxels.entries()) {
                    layer.setVoxel(posKey, type);
                }
                
                // Update rendering
                this.voxelEngine.updateInstances();
                
                console.log(`Imported ${voxels.size} voxels into layer "${layer.name}"`);
            } catch (error) {
                console.error('Error importing VOX file:', error);
                throw new Error(`Failed to import VOX file: ${error}`);
            }
        } else {
            throw new Error(`Unsupported file format for layer import: ${extension}`);
        }
    }
}