import { VoxelType } from '../engine/VoxelEngine';

export interface AssetInfo {
    id: string;
    name: string;
    type: VoxelType;
    path?: string;  // For default assets
    size: { x: number; y: number; z: number };
    preview?: string;  // Base64 thumbnail
    tags?: string[];
    created?: Date;
    isUserAsset?: boolean;
}

export interface AssetData extends AssetInfo {
    voxelData: Map<string, VoxelType>;  // "x,y,z" -> VoxelType
}

export interface IAssetManager {
    // Core operations
    loadAssetList(type: VoxelType): Promise<AssetInfo[]>;
    loadAsset(id: string): Promise<AssetData>;
    saveAsset(asset: Omit<AssetData, 'id' | 'created'>): Promise<string>;
    deleteAsset(id: string): Promise<void>;
    
    // Optional features
    searchAssets?(query: string): Promise<AssetInfo[]>;
    exportAssets?(): Promise<Blob>;
    importAssets?(file: File): Promise<void>;
}