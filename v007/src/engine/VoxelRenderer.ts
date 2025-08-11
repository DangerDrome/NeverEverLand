import * as THREE from 'three';
import { VoxelType, VoxelTypeDefinition } from '../types';
import { EdgeRenderer } from './EdgeRenderer';

// Voxel type definitions with vibrant colors (as RGB strings for IDE color preview)
const VOXEL_TYPES: Record<VoxelType, VoxelTypeDefinition> = {
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
    private matricesArray: Float32Array;
    private colorsArray: Float32Array;
    private opacityArray: Float32Array;
    private maxInstances: number;
    private instanceData: Map<VoxelType, InstanceData>;
    private tempMatrix: THREE.Matrix4;
    private tempColor: THREE.Color;
    private showEdges: boolean;
    private currentVoxelData: { x: number; y: number; z: number; type: VoxelType }[];
    
    constructor(scene: THREE.Scene, voxelSize = 1.0) {
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
        this.showEdges = false;
        
        // Edge renderer for clean edge display
        this.edgeRenderer = new EdgeRenderer(scene, voxelSize);
        
        // Store current voxel data for edge updates
        this.currentVoxelData = [];
        
        // Buffers for instancing
        this.matricesArray = new Float32Array(0);
        this.colorsArray = new Float32Array(0);
        this.opacityArray = new Float32Array(0);
        this.maxInstances = 1048576; // 1M instances
        
        // Instance data per type
        this.instanceData = new Map();
        
        // Temporary objects
        this.tempMatrix = new THREE.Matrix4();
        this.tempColor = new THREE.Color();
        
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
        
        // Pre-allocate buffers
        this.matricesArray = new Float32Array(this.maxInstances * 16);
        this.colorsArray = new Float32Array(this.maxInstances * 3);
        this.opacityArray = new Float32Array(this.maxInstances);
        
        // Initialize instance data tracking
        for (const type of this.materials.keys()) {
            this.instanceData.set(type, {
                startIndex: 0,
                count: 0
            });
        }
    }
    
    updateFromVoxelsByType(voxelsByType: Map<VoxelType, Set<string>>): void {
        console.log('VoxelRenderer.updateFromVoxelsByType called with:', voxelsByType);
        
        // Separate opaque and transparent voxels
        let opaqueCount = 0;
        let transparentCount = 0;
        
        // Collect all voxel data for edge rendering (including type)
        const allVoxelData: { x: number; y: number; z: number; type: VoxelType }[] = [];
        
        // First pass: count instances for each category
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            
            const typeInfo = VOXEL_TYPES[type];
            if (typeInfo.transparent) {
                transparentCount += positions.size;
            } else {
                opaqueCount += positions.size;
            }
        }
        
        // Allocate instance indices
        let opaqueIndex = 0;
        let transparentIndex = 0;
        
        // Second pass: fill buffers
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            
            const typeInfo = VOXEL_TYPES[type];
            const baseColor = typeInfo.color;
            const opacity = typeInfo.opacity || 1.0;
            const isTransparent = typeInfo.transparent || false;
            
            for (const posKey of positions) {
                const [x, y, z] = posKey.split(',').map(Number);
                
                // Collect voxel data for edge rendering (including type)
                allVoxelData.push({ x, y, z, type });
                
                // CRITICAL FIX: Offset transparent voxels to come after opaque ones in the buffer
                // This prevents them from overwriting each other
                const globalIndex = isTransparent ? (opaqueCount + transparentIndex) : opaqueIndex;
                
                // Set transformation matrix - offset by half voxel size to center in grid cells
                this.tempMatrix.makeTranslation(
                    x * this.voxelSize + this.voxelSize * 0.5,
                    y * this.voxelSize + this.voxelSize * 0.5,
                    z * this.voxelSize + this.voxelSize * 0.5
                );
                
                this.tempMatrix.toArray(this.matricesArray, globalIndex * 16);
                
                // Set color (handle both string and number formats)
                if (typeof baseColor === 'string') {
                    this.tempColor.set(baseColor);
                } else {
                    this.tempColor.setHex(baseColor);
                }
                this.tempColor.toArray(this.colorsArray, globalIndex * 3);
                
                // Set opacity
                this.opacityArray[globalIndex] = opacity;
                
                // Debug: Log the first few transparent voxels
                if (isTransparent && globalIndex < 3) {
                    console.log(`Transparent voxel ${globalIndex} (${VoxelType[type]}): color=0x${baseColor.toString(16)}, opacity=${opacity}`);
                }
                
                // Increment appropriate index
                if (isTransparent) {
                    transparentIndex++;
                } else {
                    opaqueIndex++;
                }
            }
        }
        
        this.updateMeshes(opaqueCount, transparentCount);
        
        // Store current voxel data for edge toggle
        this.currentVoxelData = allVoxelData;
        
        // Update edge renderer with all voxel data if edges are visible
        if (this.showEdges) {
            this.edgeRenderer.updateEdges(allVoxelData);
        }
    }
    
    updateMeshes(opaqueCount: number, transparentCount: number): void {
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
        
        const tempMatrix = new THREE.Matrix4();
        const tempColor = new THREE.Color();
        
        // Create opaque mesh
        if (opaqueCount > 0) {
            const opaqueMaterial = new THREE.MeshStandardMaterial({
                roughness: 0.8,
                metalness: 0.2
            });
            
            this.opaqueMesh = new THREE.InstancedMesh(this.geometry, opaqueMaterial, opaqueCount);
            this.opaqueMesh.count = opaqueCount;
            this.opaqueMesh.castShadow = true;
            this.opaqueMesh.receiveShadow = true;
            this.opaqueMesh.frustumCulled = true;
            
            // Apply transforms and colors for opaque instances
            for (let i = 0; i < opaqueCount; i++) {
                tempMatrix.fromArray(this.matricesArray, i * 16);
                this.opaqueMesh.setMatrixAt(i, tempMatrix);
                
                tempColor.fromArray(this.colorsArray, i * 3);
                this.opaqueMesh.setColorAt(i, tempColor);
            }
            
            this.opaqueMesh.instanceMatrix.needsUpdate = true;
            if (this.opaqueMesh.instanceColor) {
                this.opaqueMesh.instanceColor.needsUpdate = true;
            }
            
            this.scene.add(this.opaqueMesh);
        }
        
        // Create transparent mesh
        if (transparentCount > 0) {
            // Custom shader material for transparency with per-instance opacity
            const transparentMaterial = new THREE.MeshStandardMaterial({
                roughness: 0.8,
                metalness: 0.2,
                transparent: true,
                opacity: 0.8,  // Base opacity
                depthWrite: false,  // Important for proper transparency
                side: THREE.DoubleSide  // Render both sides for water
            });
            
            this.transparentMesh = new THREE.InstancedMesh(this.geometry, transparentMaterial, transparentCount);
            this.transparentMesh.count = transparentCount;
            this.transparentMesh.castShadow = true;
            this.transparentMesh.receiveShadow = true;
            this.transparentMesh.frustumCulled = true;
            this.transparentMesh.renderOrder = 1;  // Render after opaque objects
            
            // Apply transforms and colors for transparent instances
            // CRITICAL: Read from the correct offset in the buffer (after opaque voxels)
            for (let i = 0; i < transparentCount; i++) {
                const bufferIndex = opaqueCount + i;  // Offset by opaque count
                tempMatrix.fromArray(this.matricesArray, bufferIndex * 16);
                this.transparentMesh.setMatrixAt(i, tempMatrix);
                
                tempColor.fromArray(this.colorsArray, bufferIndex * 3);
                // Apply opacity to color alpha channel
                const opacity = this.opacityArray[bufferIndex];
                tempColor.multiplyScalar(opacity);
                this.transparentMesh.setColorAt(i, tempColor);
            }
            
            this.transparentMesh.instanceMatrix.needsUpdate = true;
            if (this.transparentMesh.instanceColor) {
                this.transparentMesh.instanceColor.needsUpdate = true;
            }
            
            this.scene.add(this.transparentMesh);
        }
        
        console.log(`Created meshes: opaque=${opaqueCount}, transparent=${transparentCount}`);
    }
    
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
            // Use stored voxel data to immediately show edges
            if (this.currentVoxelData.length > 0) {
                this.edgeRenderer.updateEdges(this.currentVoxelData);
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
    
    // Clear all instances
    clear() {
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
        
        // Clear edges and stored data
        this.edgeRenderer.clearEdges();
        this.currentVoxelData = [];
        
        for (const data of this.instanceData.values()) {
            data.startIndex = 0;
            data.count = 0;
        }
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