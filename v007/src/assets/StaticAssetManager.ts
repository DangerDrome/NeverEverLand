import { VoxelType } from '../engine/VoxelEngine';
import { VoxParser } from '../io/VoxParser';
import { VoxWriter } from '../io/VoxWriter';
import { AssetInfo, AssetData, IAssetManager } from './types';
import { DEFAULT_ASSETS } from './defaultAssets';

export class StaticAssetManager implements IAssetManager {
    private voxParser: VoxParser;
    private voxWriter: VoxWriter;
    private assetCache: Map<string, AssetData>;
    private db: IDBDatabase | null = null;
    private readonly DB_NAME = 'VoxelAssets';
    private readonly DB_VERSION = 1;
    private discoveredAssets: Map<VoxelType, AssetInfo[]> = new Map();
    
    constructor() {
        this.voxParser = new VoxParser();
        this.voxWriter = new VoxWriter();
        this.assetCache = new Map();
        this.initIndexedDB();
        this.discoverAssets();
    }
    
    private async initIndexedDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                
                if (!db.objectStoreNames.contains('assets')) {
                    const store = db.createObjectStore('assets', { keyPath: 'id' });
                    store.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }
    
    async loadAssetList(type: VoxelType): Promise<AssetInfo[]> {
        const assets: AssetInfo[] = [];
        
        // Load default assets
        const defaultAssets = DEFAULT_ASSETS[type] || [];
        assets.push(...defaultAssets);
        
        // Load user assets from IndexedDB
        if (this.db) {
            const tx = this.db.transaction(['assets'], 'readonly');
            const store = tx.objectStore('assets');
            const index = store.index('type');
            const request = index.getAll(type);
            
            await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const userAssets = request.result as AssetInfo[];
                    assets.push(...userAssets.map(a => ({ ...a, isUserAsset: true })));
                    resolve(undefined);
                };
                request.onerror = () => reject(request.error);
            });
        }
        
        return assets;
    }
    
    async loadAsset(id: string): Promise<AssetData> {
        // Check cache first
        if (this.assetCache.has(id)) {
            return this.assetCache.get(id)!;
        }
        
        // Check if it's a default asset
        const defaultAsset = this.findDefaultAsset(id);
        if (defaultAsset && defaultAsset.path) {
            const assetData = await this.loadDefaultAsset(defaultAsset);
            this.assetCache.set(id, assetData);
            return assetData;
        }
        
        // Load user asset from IndexedDB
        if (this.db) {
            const tx = this.db.transaction(['assets'], 'readonly');
            const store = tx.objectStore('assets');
            const request = store.get(id);
            
            const assetData = await new Promise<AssetData>((resolve, reject) => {
                request.onsuccess = () => {
                    if (request.result) {
                        const data = request.result as AssetData;
                        // For user assets, preserve the actual voxel colors
                        // Only override colors for default assets
                        if (!data.isUserAsset && data.voxelData && data.type) {
                            const correctedVoxelData = new Map<string, VoxelType>();
                            for (const [key, _] of data.voxelData) {
                                correctedVoxelData.set(key, data.type);
                            }
                            data.voxelData = correctedVoxelData;
                        }
                        resolve(data);
                    } else {
                        reject(new Error(`Asset not found: ${id}`));
                    }
                };
                request.onerror = () => reject(request.error);
            });
            
            this.assetCache.set(id, assetData);
            return assetData;
        }
        
        throw new Error(`Asset not found: ${id}`);
    }
    
    async saveAsset(asset: Omit<AssetData, 'id' | 'created'>): Promise<string> {
        if (!this.db) {
            await this.initIndexedDB();
        }
        
        const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const assetData: AssetData = {
            ...asset,
            id,
            created: new Date(),
            isUserAsset: true
        };
        
        const tx = this.db!.transaction(['assets'], 'readwrite');
        const store = tx.objectStore('assets');
        const request = store.add(assetData);
        
        await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(undefined);
            request.onerror = () => reject(request.error);
        });
        
        // Add to cache
        this.assetCache.set(id, assetData);
        
        return id;
    }
    
    async updateAsset(id: string, asset: Omit<AssetData, 'id' | 'created'>): Promise<string> {
        // Can only update user assets
        if (!id.startsWith('user_')) {
            throw new Error('Cannot update default assets - save as new asset instead');
        }
        
        if (!this.db) {
            await this.initIndexedDB();
        }
        
        // Get existing asset to preserve created date
        const existingAsset = await this.loadAsset(id);
        
        const updatedAsset: AssetData = {
            ...asset,
            id,
            created: existingAsset.created,
            modified: new Date(),
            isUserAsset: true
        };
        
        const tx = this.db!.transaction(['assets'], 'readwrite');
        const store = tx.objectStore('assets');
        const request = store.put(updatedAsset);
        
        await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(undefined);
            request.onerror = () => reject(request.error);
        });
        
        // Update cache
        this.assetCache.set(id, updatedAsset);
        
        return id;
    }
    
    async deleteAsset(id: string): Promise<void> {
        // Can only delete user assets
        if (!id.startsWith('user_')) {
            throw new Error('Cannot delete default assets');
        }
        
        if (!this.db) {
            return;
        }
        
        const tx = this.db.transaction(['assets'], 'readwrite');
        const store = tx.objectStore('assets');
        const request = store.delete(id);
        
        await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(undefined);
            request.onerror = () => reject(request.error);
        });
        
        // Remove from cache
        this.assetCache.delete(id);
    }
    
    private findDefaultAsset(id: string): AssetInfo | undefined {
        for (const type of Object.values(VoxelType)) {
            if (typeof type === 'number') {
                const assets = DEFAULT_ASSETS[type as VoxelType] || [];
                const asset = assets.find(a => a.id === id);
                if (asset) return asset;
            }
        }
        return undefined;
    }
    
    private async loadDefaultAsset(info: AssetInfo): Promise<AssetData> {
        if (!info.path) {
            throw new Error(`Default asset has no path: ${info.id}`);
        }
        
        try {
            const response = await fetch(info.path);
            if (!response.ok) {
                throw new Error(`Failed to load asset: ${response.status}`);
            }
            
            const buffer = await response.arrayBuffer();
            const voxData = await this.voxParser.parseVoxFile(buffer);
            const voxelData = this.voxParser.convertToVoxelData(voxData);
            
            // Override all voxel types with the asset's declared type
            const correctedVoxelData = new Map<string, VoxelType>();
            for (const [key, _] of voxelData) {
                correctedVoxelData.set(key, info.type);
            }
            
            return {
                ...info,
                voxelData: correctedVoxelData
            };
        } catch (error) {
            console.error(`Failed to load default asset ${info.id}:`, error);
            // Return empty asset as fallback
            return {
                ...info,
                voxelData: new Map()
            };
        }
    }
    
    /**
     * Export an asset as a .vox file
     */
    async exportAssetAsVox(id: string): Promise<void> {
        const asset = await this.loadAsset(id);
        if (!asset.voxelData || asset.voxelData.size === 0) {
            throw new Error('Asset has no voxel data');
        }
        
        // Group voxels by type for the VoxWriter
        const voxelsByType = new Map<VoxelType, Set<string>>();
        for (const [posKey, type] of asset.voxelData) {
            if (!voxelsByType.has(type)) {
                voxelsByType.set(type, new Set());
            }
            voxelsByType.get(type)!.add(posKey);
        }
        
        // Create VOX file
        const buffer = this.voxWriter.createVoxFile(voxelsByType);
        
        // Download the file
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${asset.name.replace(/[^a-z0-9]/gi, '_')}.vox`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    // Optional: Export all user assets as a zip file
    async exportAssets(): Promise<Blob> {
        // TODO: Implement zip export of user assets
        throw new Error('Export not implemented yet');
    }
    
    // Optional: Import assets from a zip file
    async importAssets(file: File): Promise<void> {
        // TODO: Implement zip import
        throw new Error('Import not implemented yet');
    }
}