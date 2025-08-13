import { VoxelType } from '../engine/VoxelEngine';
import { VoxParser } from '../io/VoxParser';
import { AssetInfo, AssetData, IAssetManager } from './types';
import { DEFAULT_ASSETS } from './defaultAssets';

export class StaticAssetManager implements IAssetManager {
    private voxParser: VoxParser;
    private assetCache: Map<string, AssetData>;
    private db: IDBDatabase | null = null;
    private readonly DB_NAME = 'VoxelAssets';
    private readonly DB_VERSION = 1;
    
    constructor() {
        this.voxParser = new VoxParser();
        this.assetCache = new Map();
        this.initIndexedDB();
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
                        // Ensure user assets also have correct voxel types
                        if (data.voxelData && data.type) {
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