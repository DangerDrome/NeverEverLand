import * as THREE from 'three';
import { VoxelType, VoxelTypeDefinition } from '../types';
import { EdgeRenderer } from './EdgeRenderer';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

// Voxel type definitions with vibrant colors (as RGB strings for IDE color preview)
const VOXEL_TYPES: Record<number, VoxelTypeDefinition> = {
    [VoxelType.AIR]: { color: 'rgb(0, 0, 0)', transparent: true },
    [VoxelType.GRASS]: { color: 'rgb(144, 238, 144)' },      // Light pastel green
    [VoxelType.DIRT]: { color: 'rgb(139, 105, 20)' },       // Dark goldenrod (brownish)
    [VoxelType.STONE]: { color: 'rgb(105, 105, 105)' },      // Dim gray
    [VoxelType.WOOD]: { color: 'rgb(222, 184, 135)' },       // Burlywood (light brown)
    [VoxelType.LEAVES]: { color: 'rgb(50, 205, 50)' },     // Lime green
    [VoxelType.WATER]: { color: 'rgb(135, 206, 235)', transparent: true, opacity: 0.95 }, // Sky blue (more transparent)
    [VoxelType.SAND]: { color: 'rgb(255, 228, 181)' },       // Moccasin (sandy color)
    [VoxelType.SNOW]: { color: 'rgb(240, 248, 255)', transparent: true, opacity: 0.85 },  // Alice blue (semi-transparent)
    [VoxelType.ICE]: { color: 'rgb(135, 206, 235)', transparent: true, opacity: 0.9 }   // Sky blue
    // Custom colors will be added dynamically via updateCustomColors
};

interface InstanceData {
    startIndex: number;
    count: number;
}

export class VoxelRenderer {
    private scene: THREE.Scene;
    private voxelSize: number;
    private geometry: THREE.BoxGeometry;
    private edgesGeometry: THREE.EdgesGeometry;
    private materials: Map<VoxelType, THREE.MeshStandardMaterial>;
    private opaqueMesh: THREE.InstancedMesh | null;
    private transparentMesh: THREE.InstancedMesh | null;
    private edgeRenderer: EdgeRenderer;
    private instanceData: Map<VoxelType, InstanceData>;
    private tempMatrix: THREE.Matrix4;
    private tempColor: THREE.Color;
    private showEdges: boolean;
    private currentVoxelData: { x: number; y: number; z: number; type: VoxelType }[];
    
    // Performance optimization: pre-allocated buffers
    private static readonly INITIAL_CAPACITY = 100000;  // Pre-allocate for 100k voxels
    private static readonly GROWTH_FACTOR = 2;  // Double capacity when needed
    private opaqueCapacity: number = 0;
    private transparentCapacity: number = 0;
    private opaqueCount: number = 0;
    private transparentCount: number = 0;
    private voxelPositionMap: Map<string, number> = new Map();  // Maps position key to instance index
    private usedIndices: Set<number> = new Set();  // Track which indices are in use
    private freeOpaqueIndices: number[] = [];  // Pool of free opaque indices
    private freeTransparentIndices: number[] = [];  // Pool of free transparent indices
    private needsFullRebuild: boolean = false;
    private invisibleMatrix: THREE.Matrix4;
    
    constructor(scene: THREE.Scene, voxelSize = 1.0, initialShowEdges = true) {
        this.scene = scene;
        this.voxelSize = voxelSize;
        
        // Geometry shared by all voxel types
        this.geometry = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
        this.edgesGeometry = new THREE.EdgesGeometry(this.geometry);
        
        // Materials for each voxel type
        this.materials = new Map();
        
        // Separate meshes for opaque and transparent voxels
        this.opaqueMesh = null;
        this.transparentMesh = null;
        this.showEdges = initialShowEdges;
        
        // Edge renderer for clean edge display - ensure it's visible if showEdges is true
        this.edgeRenderer = new EdgeRenderer(scene, voxelSize, this.showEdges);
        this.edgeRenderer.setVisible(this.showEdges);
        
        // Store current voxel data for edge updates
        this.currentVoxelData = [];
        
        // Instance data per type
        this.instanceData = new Map();
        
        // Temporary objects
        this.tempMatrix = new THREE.Matrix4();
        this.tempColor = new THREE.Color();
        
        // Matrix for hiding instances (scale to 0)
        this.invisibleMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
        
        this.initialize();
    }
    
    private initialize(): void {
        // Create materials for each voxel type
        for (const [typeStr, def] of Object.entries(VOXEL_TYPES)) {
            const type = parseInt(typeStr) as VoxelType;
            if (type === VoxelType.AIR) continue;
            
            const material = new THREE.MeshStandardMaterial({
                color: def.color,
                transparent: def.transparent || false,
                opacity: def.opacity || 1.0,
                roughness: 0.8,
                metalness: 0.2
            });
            
            // Enable vertex colors for instance colors
            material.onBeforeCompile = (shader) => {
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <color_vertex>',
                    `
                    #include <color_vertex>
                    #ifdef USE_INSTANCING_COLOR
                        vColor.xyz *= instanceColor.xyz;
                    #endif
                    `
                );
            };
            
            this.materials.set(type, material);
        }
        
        // Initialize instance data tracking
        for (const type of this.materials.keys()) {
            this.instanceData.set(type, {
                startIndex: 0,
                count: 0
            });
        }
    }
    
    updateFromVoxelsByType(voxelsByType: Map<VoxelType, Set<string>>, _batchMode: boolean = false): void {
        const monitor = PerformanceMonitor.getInstance();
        monitor.startTimer('VoxelRenderer.update');
        
        try {
            // Fast path: if we have pre-allocated meshes and capacity is sufficient, do incremental update
            const totalOpaqueNeeded = this.countOpaqueVoxels(voxelsByType);
            const totalTransparentNeeded = this.countTransparentVoxels(voxelsByType);
            
            // Check if we need to rebuild meshes (capacity exceeded or first time)
            if (!this.opaqueMesh || !this.transparentMesh ||
                totalOpaqueNeeded > this.opaqueCapacity || 
                totalTransparentNeeded > this.transparentCapacity) {
                
                // Need full rebuild with larger capacity
                monitor.startTimer('VoxelRenderer.rebuild');
                this.rebuildMeshesWithCapacity(totalOpaqueNeeded, totalTransparentNeeded);
                monitor.endTimer('VoxelRenderer.rebuild');
            }
            
            // Now do incremental update
            monitor.startTimer('VoxelRenderer.incrementalUpdate');
            this.incrementalUpdate(voxelsByType);
            monitor.endTimer('VoxelRenderer.incrementalUpdate');
        } finally {
            const elapsed = monitor.endTimer('VoxelRenderer.update');
            
            // Log if update took too long
            if (elapsed > 50) {
                console.warn(`Slow voxel update: ${elapsed.toFixed(2)}ms for ${this.opaqueCount + this.transparentCount} voxels`);
            }
        }
    }
    
    private countOpaqueVoxels(voxelsByType: Map<VoxelType, Set<string>>): number {
        let count = 0;
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            const typeInfo = VOXEL_TYPES[type];
            if (!typeInfo) continue; // Skip unknown types
            if (!typeInfo.transparent) {
                count += positions.size;
            }
        }
        return count;
    }
    
    private countTransparentVoxels(voxelsByType: Map<VoxelType, Set<string>>): number {
        let count = 0;
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            const typeInfo = VOXEL_TYPES[type];
            if (!typeInfo) continue; // Skip unknown types
            if (typeInfo.transparent) {
                count += positions.size;
            }
        }
        return count;
    }
    
    private rebuildMeshesWithCapacity(minOpaqueCapacity: number, minTransparentCapacity: number): void {
        // Calculate new capacities with growth factor
        this.opaqueCapacity = Math.max(
            VoxelRenderer.INITIAL_CAPACITY,
            Math.ceil(minOpaqueCapacity * VoxelRenderer.GROWTH_FACTOR)
        );
        this.transparentCapacity = Math.max(
            VoxelRenderer.INITIAL_CAPACITY,
            Math.ceil(minTransparentCapacity * VoxelRenderer.GROWTH_FACTOR)
        );
        
        // Rebuilding meshes with new capacity
        // Note: Mesh capacity increased to handle more voxels
        
        // Remove old meshes
        if (this.opaqueMesh) {
            this.scene.remove(this.opaqueMesh);
            this.opaqueMesh.geometry.dispose();
            this.opaqueMesh = null;
        }
        if (this.transparentMesh) {
            this.scene.remove(this.transparentMesh);
            this.transparentMesh.geometry.dispose();
            this.transparentMesh = null;
        }
        
        // Create new meshes with larger capacity
        this.createPreallocatedMeshes();
        
        // Mark for full data rebuild
        this.needsFullRebuild = true;
        this.voxelPositionMap.clear();
    }
    
    private createPreallocatedMeshes(): void {
        // Create opaque mesh with pre-allocated capacity
        if (this.opaqueCapacity > 0) {
            const opaqueMaterial = new THREE.MeshStandardMaterial({
                roughness: 0.8,
                metalness: 0.2
            });
            
            this.opaqueMesh = new THREE.InstancedMesh(this.geometry, opaqueMaterial, this.opaqueCapacity);
            this.opaqueMesh.count = this.opaqueCapacity;  // Set to full capacity
            this.opaqueMesh.castShadow = true;
            this.opaqueMesh.receiveShadow = true;
            this.opaqueMesh.frustumCulled = false;  // Disable to prevent disappearing on zoom
            
            // Initialize all instances as invisible
            for (let i = 0; i < this.opaqueCapacity; i++) {
                this.opaqueMesh.setMatrixAt(i, this.invisibleMatrix);
            }
            this.opaqueMesh.instanceMatrix.needsUpdate = true;
            
            this.scene.add(this.opaqueMesh);
        }
        
        // Create transparent mesh with pre-allocated capacity
        if (this.transparentCapacity > 0) {
            const transparentMaterial = new THREE.MeshStandardMaterial({
                roughness: 0.8,
                metalness: 0.2,
                transparent: true,
                opacity: 0.8,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            
            this.transparentMesh = new THREE.InstancedMesh(this.geometry, transparentMaterial, this.transparentCapacity);
            this.transparentMesh.count = this.transparentCapacity;  // Set to full capacity
            this.transparentMesh.castShadow = true;
            this.transparentMesh.receiveShadow = true;
            this.transparentMesh.frustumCulled = false;  // Disable to prevent disappearing on zoom
            this.transparentMesh.renderOrder = 1;
            
            // Initialize all instances as invisible
            for (let i = 0; i < this.transparentCapacity; i++) {
                this.transparentMesh.setMatrixAt(i, this.invisibleMatrix);
            }
            this.transparentMesh.instanceMatrix.needsUpdate = true;
            
            this.scene.add(this.transparentMesh);
        }
    }
    
    private incrementalUpdate(voxelsByType: Map<VoxelType, Set<string>>): void {
        // If we need a full rebuild (after capacity increase), rebuild everything
        if (this.needsFullRebuild) {
            this.fullDataRebuild(voxelsByType);
            this.needsFullRebuild = false;
            return;
        }
        
        // Otherwise, do incremental update
        // Build set of current voxel positions
        const currentVoxels = new Set<string>();
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            for (const pos of positions) {
                currentVoxels.add(pos);
            }
        }
        
        // Find removed voxels (in map but not in current set)
        const toRemove: string[] = [];
        for (const [posKey, _] of this.voxelPositionMap) {
            if (!currentVoxels.has(posKey)) {
                toRemove.push(posKey);
            }
        }
        
        // Remove voxels that no longer exist
        for (const posKey of toRemove) {
            const instanceIndex = this.voxelPositionMap.get(posKey);
            if (instanceIndex !== undefined) {
                // Hide the instance by scaling to 0
                const isTransparent = instanceIndex >= this.opaqueCapacity;
                if (isTransparent && this.transparentMesh) {
                    const localIndex = instanceIndex - this.opaqueCapacity;
                    this.transparentMesh.setMatrixAt(localIndex, this.invisibleMatrix);
                    // Add to free list
                    this.freeTransparentIndices.push(localIndex);
                } else if (!isTransparent && this.opaqueMesh) {
                    this.opaqueMesh.setMatrixAt(instanceIndex, this.invisibleMatrix);
                    // Add to free list
                    this.freeOpaqueIndices.push(instanceIndex);
                }
                this.voxelPositionMap.delete(posKey);
                this.usedIndices.delete(instanceIndex);
            }
        }
        
        // Process new and updated voxels
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            
            const typeInfo = VOXEL_TYPES[type];
            if (!typeInfo) {
                // Skip unknown voxel types silently
                continue;
            }
            
            const isTransparent = typeInfo.transparent || false;
            const baseColor = typeInfo.color;
            const opacity = typeInfo.opacity || 1.0;
            
            for (const posKey of positions) {
                const [x, y, z] = posKey.split(',').map(Number);
                
                // Check if this voxel already exists
                let instanceIndex = this.voxelPositionMap.get(posKey);
                
                if (instanceIndex === undefined) {
                    // New voxel - get from free list or find new slot
                    if (isTransparent) {
                        // Get from free list or allocate new
                        const localIndex = this.freeTransparentIndices.pop();
                        if (localIndex !== undefined) {
                            instanceIndex = this.opaqueCapacity + localIndex;
                        } else {
                            // Find first unused transparent slot
                            for (let i = 0; i < this.transparentCapacity; i++) {
                                const globalIndex = this.opaqueCapacity + i;
                                if (!this.usedIndices.has(globalIndex)) {
                                    instanceIndex = globalIndex;
                                    break;
                                }
                            }
                        }
                    } else {
                        // Get from free list or allocate new
                        instanceIndex = this.freeOpaqueIndices.pop();
                        if (instanceIndex === undefined) {
                            // Find first unused opaque slot
                            for (let i = 0; i < this.opaqueCapacity; i++) {
                                if (!this.usedIndices.has(i)) {
                                    instanceIndex = i;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (instanceIndex === undefined) {
                        console.warn('No available slots for new voxel!');
                        continue;
                    }
                    
                    this.voxelPositionMap.set(posKey, instanceIndex);
                    this.usedIndices.add(instanceIndex);
                }
                
                // Update the instance
                this.tempMatrix.makeTranslation(
                    x * this.voxelSize + this.voxelSize * 0.5,
                    y * this.voxelSize + this.voxelSize * 0.5,
                    z * this.voxelSize + this.voxelSize * 0.5
                );
                
                if (typeof baseColor === 'string') {
                    this.tempColor.set(baseColor);
                } else {
                    this.tempColor.setHex(baseColor);
                }
                
                // Apply to appropriate mesh
                if (isTransparent && this.transparentMesh) {
                    const localIndex = instanceIndex - this.opaqueCapacity;
                    this.transparentMesh.setMatrixAt(localIndex, this.tempMatrix);
                    this.tempColor.multiplyScalar(opacity);
                    this.transparentMesh.setColorAt(localIndex, this.tempColor);
                } else if (!isTransparent && this.opaqueMesh) {
                    this.opaqueMesh.setMatrixAt(instanceIndex, this.tempMatrix);
                    this.opaqueMesh.setColorAt(instanceIndex, this.tempColor);
                }
            }
        }
        
        // Update counts for debugging
        this.opaqueCount = 0;
        this.transparentCount = 0;
        for (const [_, index] of this.voxelPositionMap) {
            if (index >= this.opaqueCapacity) {
                this.transparentCount++;
            } else {
                this.opaqueCount++;
            }
        }
        
        // Mark matrices as needing update
        if (this.opaqueMesh) {
            this.opaqueMesh.instanceMatrix.needsUpdate = true;
            if (this.opaqueMesh.instanceColor) {
                this.opaqueMesh.instanceColor.needsUpdate = true;
            }
        }
        if (this.transparentMesh) {
            this.transparentMesh.instanceMatrix.needsUpdate = true;
            if (this.transparentMesh.instanceColor) {
                this.transparentMesh.instanceColor.needsUpdate = true;
            }
        }
        
        // Build complete voxel data for edge rendering from ALL voxels in the scene
        // This ensures edges are shown for all voxels, not just newly added ones
        const allVoxelData: { x: number; y: number; z: number; type: VoxelType }[] = [];
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            for (const posKey of positions) {
                const [x, y, z] = posKey.split(',').map(Number);
                allVoxelData.push({ x, y, z, type });
            }
        }
        
        // Store the complete voxel data
        this.currentVoxelData = allVoxelData;
        
        // Update edges if enabled
        if (this.showEdges) {
            if (allVoxelData.length === 0) {
                // No voxels visible, clear edges
                this.edgeRenderer.clearEdges();
            } else if (allVoxelData.length < 50000) {  // Increased limit to 50k voxels
                // Update edges with ALL current voxels in the scene
                this.edgeRenderer.updateEdges(allVoxelData);
            } else {
                // Too many voxels, disable edges for performance
                console.warn(`Disabling edges: ${allVoxelData.length} voxels exceeds 50000 limit`);
                this.edgeRenderer.clearEdges();
                this.showEdges = false;
                this.edgeRenderer.setVisible(false);
            }
        }
    }
    
    private fullDataRebuild(voxelsByType: Map<VoxelType, Set<string>>): void {
        // Performing full data rebuild
        
        // Clear position map and indices
        this.voxelPositionMap.clear();
        this.usedIndices.clear();
        this.freeOpaqueIndices = [];
        this.freeTransparentIndices = [];
        
        // Reset all instances to invisible
        if (this.opaqueMesh) {
            for (let i = 0; i < this.opaqueCapacity; i++) {
                this.opaqueMesh.setMatrixAt(i, this.invisibleMatrix);
            }
        }
        if (this.transparentMesh) {
            for (let i = 0; i < this.transparentCapacity; i++) {
                this.transparentMesh.setMatrixAt(i, this.invisibleMatrix);
            }
        }
        
        // Rebuild data
        let opaqueIndex = 0;
        let transparentIndex = 0;
        
        const allVoxelData: { x: number; y: number; z: number; type: VoxelType }[] = [];
        
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            
            const typeInfo = VOXEL_TYPES[type];
            if (!typeInfo) {
                // Skip unknown voxel types silently
                continue;
            }
            
            const baseColor = typeInfo.color;
            const opacity = typeInfo.opacity || 1.0;
            const isTransparent = typeInfo.transparent || false;
            
            for (const posKey of positions) {
                const [x, y, z] = posKey.split(',').map(Number);
                allVoxelData.push({ x, y, z, type });
                
                // Determine instance index
                const instanceIndex = isTransparent ? 
                    (this.opaqueCapacity + transparentIndex) : opaqueIndex;
                
                // Store position mapping
                this.voxelPositionMap.set(posKey, instanceIndex);
                this.usedIndices.add(instanceIndex);
                
                // Set transformation matrix
                this.tempMatrix.makeTranslation(
                    x * this.voxelSize + this.voxelSize * 0.5,
                    y * this.voxelSize + this.voxelSize * 0.5,
                    z * this.voxelSize + this.voxelSize * 0.5
                );
                
                // Set color
                if (typeof baseColor === 'string') {
                    this.tempColor.set(baseColor);
                } else {
                    this.tempColor.setHex(baseColor);
                }
                
                // Apply to appropriate mesh
                if (isTransparent && this.transparentMesh) {
                    const localIndex = transparentIndex;
                    this.transparentMesh.setMatrixAt(localIndex, this.tempMatrix);
                    this.tempColor.multiplyScalar(opacity);
                    this.transparentMesh.setColorAt(localIndex, this.tempColor);
                    transparentIndex++;
                } else if (!isTransparent && this.opaqueMesh) {
                    this.opaqueMesh.setMatrixAt(instanceIndex, this.tempMatrix);
                    this.opaqueMesh.setColorAt(instanceIndex, this.tempColor);
                    opaqueIndex++;
                }
            }
        }
        
        // Update counts
        this.opaqueCount = opaqueIndex;
        this.transparentCount = transparentIndex;
        
        // Mark matrices as needing update
        if (this.opaqueMesh) {
            this.opaqueMesh.instanceMatrix.needsUpdate = true;
            if (this.opaqueMesh.instanceColor) {
                this.opaqueMesh.instanceColor.needsUpdate = true;
            }
        }
        if (this.transparentMesh) {
            this.transparentMesh.instanceMatrix.needsUpdate = true;
            if (this.transparentMesh.instanceColor) {
                this.transparentMesh.instanceColor.needsUpdate = true;
            }
        }
        
        // Store current voxel data
        this.currentVoxelData = allVoxelData;
        
        // Update edges if needed (with throttling)
        if (this.showEdges) {
            if (allVoxelData.length === 0) {
                // No voxels visible, clear edges
                this.edgeRenderer.clearEdges();
            } else if (allVoxelData.length < 50000) {  // Increased limit to 50k
                this.edgeRenderer.updateEdges(allVoxelData);
            } else {
                this.edgeRenderer.clearEdges();
            }
        }
    }
    
    // Removed updateMeshes method as we now use pre-allocated meshes
    
    // Get instance count for a specific type
    getInstanceCount(type: VoxelType): number {
        const data = this.instanceData.get(type);
        return data ? data.count : 0;
    }
    
    // Get total instance count
    getTotalInstanceCount() {
        let total = 0;
        for (const data of this.instanceData.values()) {
            total += data.count;
        }
        return total;
    }
    
    // Toggle edge display
    toggleEdges(): void {
        this.showEdges = !this.showEdges;
        this.edgeRenderer.setVisible(this.showEdges);
        
        // Immediately update edges based on current state
        if (this.showEdges) {
            // Rebuild complete voxel data if needed
            if (this.currentVoxelData.length === 0) {
                // Rebuild from voxelPositionMap if currentVoxelData is empty
                const allVoxelData: { x: number; y: number; z: number; type: VoxelType }[] = [];
                for (const [posKey, _] of this.voxelPositionMap) {
                    const [x, y, z] = posKey.split(',').map(Number);
                    // We don't have type info in the map, use a default
                    // This is a fallback - normally currentVoxelData should be populated
                    allVoxelData.push({ x, y, z, type: VoxelType.GRASS });
                }
                this.currentVoxelData = allVoxelData;
            }
            
            // Only show edges if voxel count is reasonable
            if (this.currentVoxelData.length > 0 && this.currentVoxelData.length < 50000) {  // Increased limit to 50k
                this.edgeRenderer.updateEdges(this.currentVoxelData);
            } else if (this.currentVoxelData.length >= 50000) {
                console.warn('Too many voxels for edge rendering, disabling edges for performance');
                this.showEdges = false;
                this.edgeRenderer.setVisible(false);
                this.edgeRenderer.clearEdges();
            }
        } else {
            // Clear edges when toggled off
            this.edgeRenderer.clearEdges();
        }
    }
    
    // Get edge display state
    getShowEdges(): boolean {
        return this.showEdges;
    }
    
    // Force update edges with current voxel data
    forceUpdateEdges(): void {
        if (this.showEdges && this.currentVoxelData.length > 0 && this.currentVoxelData.length < 50000) {  // Increased limit to 50k
            this.edgeRenderer.updateEdges(this.currentVoxelData);
        }
    }
    
    // Clear all instances
    clear() {
        // Don't dispose meshes, just hide all instances
        if (this.opaqueMesh) {
            for (let i = 0; i < this.opaqueCapacity; i++) {
                this.opaqueMesh.setMatrixAt(i, this.invisibleMatrix);
            }
            this.opaqueMesh.instanceMatrix.needsUpdate = true;
        }
        if (this.transparentMesh) {
            for (let i = 0; i < this.transparentCapacity; i++) {
                this.transparentMesh.setMatrixAt(i, this.invisibleMatrix);
            }
            this.transparentMesh.instanceMatrix.needsUpdate = true;
        }
        
        // Clear position map and data
        this.voxelPositionMap.clear();
        this.usedIndices.clear();
        this.freeOpaqueIndices = [];
        this.freeTransparentIndices = [];
        this.opaqueCount = 0;
        this.transparentCount = 0;
        
        // Clear edges and stored data
        this.edgeRenderer.clearEdges();
        this.currentVoxelData = [];
        
        for (const data of this.instanceData.values()) {
            data.startIndex = 0;
            data.count = 0;
        }
    }
    
    // Update custom color definitions from color palette
    static updateCustomColors(colorPalette: { hex: string; voxelType?: VoxelType }[]): void {
        colorPalette.forEach((color) => {
            // If color has a specific voxelType, update or add it
            if (color.voxelType !== undefined) {
                // Add or update the color definition
                VOXEL_TYPES[color.voxelType] = {
                    color: color.hex,
                    transparent: false
                };
            } else {
                // Otherwise update by index (legacy behavior)
                const index = colorPalette.indexOf(color);
                const voxelType = (VoxelType.CUSTOM_1 + index) as VoxelType;
                VOXEL_TYPES[voxelType] = {
                    color: color.hex,
                    transparent: false
                };
            }
        });
    }
    
    // Dispose of all resources
    dispose() {
        this.clear();
        
        this.geometry.dispose();
        this.edgesGeometry.dispose();
        
        for (const material of this.materials.values()) {
            material.dispose();
        }
        
        this.materials.clear();
        this.instanceData.clear();
        
        // Dispose edge renderer
        this.edgeRenderer.dispose();
    }
}