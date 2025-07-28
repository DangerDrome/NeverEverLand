import * as THREE from 'three';
import { VoxelEngine, VoxelType } from '../engine/VoxelEngine';
import { VoxelPosition, DrawMode, ToolMode } from '../types';

export declare class DrawingSystem {
    voxelEngine: VoxelEngine;
    isDrawing: boolean;
    drawMode: DrawMode;
    currentVoxelType: VoxelType;
    brushSize: number;
    toolMode: ToolMode;
    
    constructor(voxelEngine: VoxelEngine);
    
    updatePreview(hit: any): void;
    startDrawing(hit: any, mode: DrawMode): void;
    stopDrawing(): void;
    applyBrush(centerX: number, centerY: number, centerZ: number): void;
    setBrushSize(size: number): void;
    setVoxelType(type: VoxelType): void;
    nextVoxelType(): void;
    previousVoxelType(): void;
    getCurrentVoxelTypeName(): string;
    setToolMode(mode: ToolMode): void;
}