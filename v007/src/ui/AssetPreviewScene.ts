import * as THREE from 'three';
import { VoxelType } from '../types';

// Import voxel type color definitions
const VOXEL_COLORS: Record<number, { color: string; opacity?: number }> = {
    [VoxelType.AIR]: { color: 'rgb(0, 0, 0)', opacity: 0 },
    [VoxelType.GRASS]: { color: 'rgb(144, 238, 144)' },
    [VoxelType.DIRT]: { color: 'rgb(139, 105, 20)' },
    [VoxelType.STONE]: { color: 'rgb(105, 105, 105)' },
    [VoxelType.WOOD]: { color: 'rgb(222, 184, 135)' },
    [VoxelType.LEAVES]: { color: 'rgb(50, 205, 50)' },
    [VoxelType.WATER]: { color: 'rgb(135, 206, 235)', opacity: 0.95 },
    [VoxelType.SAND]: { color: 'rgb(255, 228, 181)' },
    [VoxelType.SNOW]: { color: 'rgb(240, 248, 255)', opacity: 0.85 },
    [VoxelType.ICE]: { color: 'rgb(135, 206, 235)', opacity: 0.9 }
    // Custom colors will be added dynamically via updateCustomColors
};

export class AssetPreviewScene {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private voxelGroup: THREE.Group;
    private materials: Map<VoxelType, THREE.MeshStandardMaterial>;
    private voxelGeometry: THREE.BoxGeometry;
    private voxelSize = 0.1; // Same as main scene
    
    // Update custom color definitions from color palette
    static updateCustomColors(colorPalette: { hex: string; voxelType?: VoxelType }[]): void {
        colorPalette.forEach((color) => {
            // If color has a specific voxelType, update or add it
            if (color.voxelType !== undefined) {
                VOXEL_COLORS[color.voxelType] = {
                    color: color.hex
                };
            } else {
                // Otherwise update by index (legacy behavior)
                const index = colorPalette.indexOf(color);
                const voxelType = (VoxelType.CUSTOM_1 + index) as VoxelType;
                VOXEL_COLORS[voxelType] = {
                    color: color.hex
                };
            }
        });
    }
    
    constructor(size = 256) {
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create renderer with transparent background
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(size, size);
        this.renderer.setClearColor(0x000000, 0);
        
        // Create isometric camera
        const frustumSize = 5; // Smaller frustum for close-up view
        this.camera = new THREE.OrthographicCamera(
            -frustumSize / 2,
            frustumSize / 2,
            frustumSize / 2,
            -frustumSize / 2,
            -100,
            100
        );
        
        // Position camera for isometric view (same angle as main camera)
        const distance = 10;
        this.camera.position.set(distance, distance, distance);
        this.camera.lookAt(0, 0, 0);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);
        
        // Create voxel group
        this.voxelGroup = new THREE.Group();
        this.scene.add(this.voxelGroup);
        
        // Create shared geometry
        this.voxelGeometry = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
        
        // Create materials for each voxel type
        this.materials = new Map();
        for (const [typeStr, colorDef] of Object.entries(VOXEL_COLORS)) {
            const type = parseInt(typeStr) as VoxelType;
            if (type === VoxelType.AIR) continue;
            
            const material = new THREE.MeshStandardMaterial({
                color: colorDef.color,
                transparent: colorDef.opacity !== undefined,
                opacity: colorDef.opacity || 1.0,
                roughness: 0.8,
                metalness: 0.1
            });
            this.materials.set(type, material);
        }
    }
    
    loadAsset(assetData: Map<string, VoxelType>): void {
        // Clear existing voxels
        this.clear();
        
        // Calculate bounds for centering
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        for (const [posKey, _] of assetData) {
            const [x, y, z] = posKey.split(',').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
        }
        
        // Calculate center offset
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        // Create voxel meshes
        for (const [posKey, voxelType] of assetData) {
            if (voxelType === VoxelType.AIR) continue;
            
            const [x, y, z] = posKey.split(',').map(Number);
            const material = this.materials.get(voxelType);
            if (!material) continue;
            
            const mesh = new THREE.Mesh(this.voxelGeometry, material);
            mesh.position.set(
                (x - centerX) * this.voxelSize,
                (y - centerY) * this.voxelSize,
                (z - centerZ) * this.voxelSize
            );
            this.voxelGroup.add(mesh);
        }
        
        // Adjust camera to fit asset
        const width = (maxX - minX + 1) * this.voxelSize;
        const height = (maxY - minY + 1) * this.voxelSize;
        const depth = (maxZ - minZ + 1) * this.voxelSize;
        const maxDimension = Math.max(width, height, depth);
        
        // Adjust frustum size to fit asset with less padding for closer view
        const padding = 1.2; // Reduced padding for tighter framing in thumbnails
        const frustumSize = maxDimension * padding;
        this.camera.left = -frustumSize / 2;
        this.camera.right = frustumSize / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();
    }
    
    screenshot(width = 64, height = 64): string {
        // Store original size
        const originalWidth = this.renderer.domElement.width;
        const originalHeight = this.renderer.domElement.height;
        
        // Temporarily resize for screenshot
        this.renderer.setSize(width, height);
        
        // Render
        this.renderer.render(this.scene, this.camera);
        
        // Get data URL
        const dataURL = this.renderer.domElement.toDataURL('image/png');
        
        // Restore original size
        this.renderer.setSize(originalWidth, originalHeight);
        
        return dataURL;
    }
    
    rotate(angle: number): void {
        // Rotate the voxel group for turntable effect
        this.voxelGroup.rotation.y = angle;
    }
    
    clear(): void {
        // Remove all children from voxel group
        while (this.voxelGroup.children.length > 0) {
            const child = this.voxelGroup.children[0];
            this.voxelGroup.remove(child);
        }
    }
    
    dispose(): void {
        // Clean up resources
        this.clear();
        this.voxelGeometry.dispose();
        for (const material of this.materials.values()) {
            material.dispose();
        }
        this.renderer.dispose();
    }
}