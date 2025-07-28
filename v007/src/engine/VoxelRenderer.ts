import * as THREE from 'three';
import { VoxelType, VoxelTypeDefinition } from '../types';

// Voxel type definitions with vibrant colors
const VOXEL_TYPES: Record<VoxelType, VoxelTypeDefinition> = {
    [VoxelType.AIR]: { color: 0x000000, transparent: true },
    [VoxelType.GRASS]: { color: 0x90EE90 },      // Light pastel green
    [VoxelType.DIRT]: { color: 0x8B6914 },       // Dark goldenrod (brownish)
    [VoxelType.STONE]: { color: 0x696969 },      // Dim gray
    [VoxelType.WOOD]: { color: 0xDEB887 },       // Burlywood (light brown)
    [VoxelType.LEAVES]: { color: 0x32CD32 },     // Lime green
    [VoxelType.WATER]: { color: 0x00CED1, transparent: true, opacity: 0.8 }, // Dark turquoise
    [VoxelType.SAND]: { color: 0xFFE4B5 },       // Moccasin (sandy color)
    [VoxelType.SNOW]: { color: 0xF0F8FF },       // Alice blue (bright white-blue)
    [VoxelType.ICE]: { color: 0x87CEEB, transparent: true, opacity: 0.9 }   // Sky blue
};

interface InstanceData {
    startIndex: number;
    count: number;
}

export class VoxelRenderer {
    private scene: THREE.Scene;
    private voxelSize: number;
    private geometry: THREE.BoxGeometry;
    private materials: Map<VoxelType, THREE.MeshStandardMaterial>;
    private mesh: THREE.InstancedMesh | null;
    private matricesArray: Float32Array;
    private colorsArray: Float32Array;
    private maxInstances: number;
    private instanceData: Map<VoxelType, InstanceData>;
    private tempMatrix: THREE.Matrix4;
    private tempColor: THREE.Color;
    
    constructor(scene: THREE.Scene, voxelSize = 1.0) {
        this.scene = scene;
        this.voxelSize = voxelSize;
        
        // Geometry shared by all voxel types
        this.geometry = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
        
        // Materials for each voxel type
        this.materials = new Map();
        
        // Single mesh with multiple groups for each voxel type
        this.mesh = null;
        
        // Buffers for thin instancing
        this.matricesArray = new Float32Array(0);
        this.colorsArray = new Float32Array(0);
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
        // Calculate instance counts and assign start indices
        let totalInstances = 0;
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            
            const data = this.instanceData.get(type);
            if (data) {
                data.startIndex = totalInstances;
                data.count = Math.min(positions.size, this.maxInstances - totalInstances);
                totalInstances += data.count;
            }
        }
        
        // Fill buffers
        for (const [type, positions] of voxelsByType.entries()) {
            if (type === VoxelType.AIR) continue;
            
            const data = this.instanceData.get(type);
            if (!data || data.count === 0) continue;
            
            const baseColor = VOXEL_TYPES[type].color;
            let localIndex = 0;
            
            for (const posKey of positions) {
                if (localIndex >= data.count) break;
                
                const [x, y, z] = posKey.split(',').map(Number);
                const globalIndex = data.startIndex + localIndex;
                
                // Set transformation matrix - offset by half voxel size to center in grid cells
                this.tempMatrix.makeTranslation(
                    x * this.voxelSize + this.voxelSize * 0.5,
                    y * this.voxelSize + this.voxelSize * 0.5,
                    z * this.voxelSize + this.voxelSize * 0.5
                );
                
                this.tempMatrix.toArray(this.matricesArray, globalIndex * 16);
                
                // Set color - no darkness modification to keep vibrant colors
                this.tempColor.setHex(baseColor);
                
                // Debug: Log the color being set for first few voxels
                if (globalIndex < 5) {
                    console.log(`Voxel ${globalIndex} (${VoxelType[type]}): color=0x${baseColor.toString(16)} rgb=(${this.tempColor.r.toFixed(2)}, ${this.tempColor.g.toFixed(2)}, ${this.tempColor.b.toFixed(2)})`);
                }
                
                // Optional: very subtle variation (uncomment if desired)
                // const variation = 0.95 + Math.random() * 0.1;
                // this.tempColor.multiplyScalar(variation);
                
                this.tempColor.toArray(this.colorsArray, globalIndex * 3);
                
                localIndex++;
            }
        }
        
        this.updateMesh(totalInstances);
    }
    
    updateMesh(totalInstances) {
        // Remove old meshes
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
        
        if (totalInstances === 0) {
            return;
        }
        
        // Create simple material - let Three.js handle instance colors natively
        const material = new THREE.MeshStandardMaterial({
            roughness: 0.8,
            metalness: 0.2
        });
        
        // Create mesh with all instances
        this.mesh = new THREE.InstancedMesh(this.geometry, material, totalInstances);
        this.mesh.count = totalInstances;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = true;
        
        // Apply transforms and colors using Three.js built-in methods
        const tempMatrix = new THREE.Matrix4();
        const tempColor = new THREE.Color();
        
        for (let i = 0; i < totalInstances; i++) {
            // Set transformation matrix
            tempMatrix.fromArray(this.matricesArray, i * 16);
            this.mesh.setMatrixAt(i, tempMatrix);
            
            // Set instance color using Three.js built-in method
            tempColor.fromArray(this.colorsArray, i * 3);
            this.mesh.setColorAt(i, tempColor);
        }
        
        // Mark attributes as needing update
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) {
            this.mesh.instanceColor.needsUpdate = true;
        }
        
        this.scene.add(this.mesh);
        
        console.log(`Created mesh with ${totalInstances} instances`);
        console.log('First few colors:', this.colorsArray.slice(0, 9)); // Show first 3 voxel colors (3 components each)
    }
    
    // Get instance count for a specific type
    getInstanceCount(type) {
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
    
    // Clear all instances
    clear() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
        
        for (const data of this.instanceData.values()) {
            data.startIndex = 0;
            data.count = 0;
        }
    }
    
    // Dispose of all resources
    dispose() {
        this.clear();
        
        this.geometry.dispose();
        
        for (const material of this.materials.values()) {
            material.dispose();
        }
        
        this.materials.clear();
        this.instanceData.clear();
    }
}