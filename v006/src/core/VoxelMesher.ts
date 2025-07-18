import * as THREE from 'three';
import { VoxelChunk } from './VoxelChunk';
import {
  VoxelType,
  VoxelData,
  VoxelCoordinate,
  VoxelFace,
  FACE_NORMALS,
  VOXEL_PROPERTIES,
  VOXEL_SIZE,
  VoxelUtils
} from './VoxelTypes';

/**
 * Mesh data for a single voxel type
 */
interface MeshData {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
  vertexCount: number;
}

/**
 * Configuration for meshing
 */
export interface MeshingConfig {
  /** Whether to use vertex colors or materials */
  useVertexColors: boolean;
  /** Whether to generate smooth normals */
  smoothNormals: boolean;
  /** Whether to merge adjacent faces (basic optimization) */
  mergeFaces: boolean;
}

/**
 * Converts voxel data into optimized Three.js geometry
 */
export class VoxelMesher {
  private config: MeshingConfig;

  constructor(config?: Partial<MeshingConfig>) {
    this.config = {
      useVertexColors: true,
      smoothNormals: false,
      mergeFaces: true,
      ...config
    };
  }

  /**
   * Generate mesh for a voxel chunk
   */
  public generateChunkMesh(chunk: VoxelChunk): THREE.Mesh | null {
    if (chunk.getIsEmpty()) {
      return null;
    }

    // Group mesh data by voxel type for efficient rendering
    const meshDataByType = new Map<VoxelType, MeshData>();

    // Initialize mesh data for each voxel type that might be used
    for (const voxelType of Object.values(VoxelType)) {
      if (voxelType !== VoxelType.Air && typeof voxelType === 'number') {
        meshDataByType.set(voxelType, this.createEmptyMeshData());
      }
    }

    // Generate geometry for each voxel
    chunk.forEachVoxel((coord, voxel) => {
      if (voxel.type === VoxelType.Air) return;

      const meshData = meshDataByType.get(voxel.type);
      if (!meshData) return;

      this.addVoxelToMesh(chunk, coord, voxel, meshData);
    });

    // Create Three.js geometry and materials
    return this.createMeshFromData(meshDataByType, chunk);
  }

  /**
   * Create empty mesh data structure
   */
  private createEmptyMeshData(): MeshData {
    return {
      positions: [],
      normals: [],
      colors: [],
      indices: [],
      vertexCount: 0
    };
  }

  /**
   * Add a single voxel to the mesh data
   */
  private addVoxelToMesh(
    chunk: VoxelChunk,
    coord: VoxelCoordinate,
    voxel: VoxelData,
    meshData: MeshData
  ): void {
    const voxelProps = VOXEL_PROPERTIES[voxel.type];
    
    // Skip transparent voxels (like air)
    if (voxelProps.transparent && voxel.type === VoxelType.Air) {
      return;
    }

    // Check each face to see if it should be rendered
    const faces = [
      { face: VoxelFace.Top,    delta: [0, 1, 0] },
      { face: VoxelFace.Bottom, delta: [0, -1, 0] },
      { face: VoxelFace.North,  delta: [0, 0, 1] },
      { face: VoxelFace.South,  delta: [0, 0, -1] },
      { face: VoxelFace.East,   delta: [1, 0, 0] },
      { face: VoxelFace.West,   delta: [-1, 0, 0] }
    ];

    for (const { face, delta } of faces) {
      if (this.shouldRenderFace(chunk, coord, voxel.type, delta)) {
        this.addFaceToMesh(coord, face, voxel.type, meshData);
      }
    }
  }

  /**
   * Check if a face should be rendered
   */
  private shouldRenderFace(
    chunk: VoxelChunk,
    coord: VoxelCoordinate,
    voxelType: VoxelType,
    delta: number[]
  ): boolean {
    // Get neighbor voxel
    const neighbor = chunk.getNeighborVoxel(coord, delta[0]!, delta[1]!, delta[2]!);
    
    // If neighbor is outside chunk, assume it's air (render the face)
    if (neighbor === null) {
      return true;
    }

    // Use VoxelUtils to determine if face should be rendered
    return VoxelUtils.shouldRenderFace(voxelType, neighbor.type);
  }

  /**
   * Add a single face to the mesh data
   */
  private addFaceToMesh(
    coord: VoxelCoordinate,
    face: VoxelFace,
    voxelType: VoxelType,
    meshData: MeshData
  ): void {
    const voxelProps = VOXEL_PROPERTIES[voxelType];
    const normal = FACE_NORMALS[face];
    
    // Face vertices in local space (0 to VOXEL_SIZE)
    const vertices = this.getFaceVertices(face);
    
    // Transform vertices to world position
    const worldX = coord.x * VOXEL_SIZE;
    const worldY = coord.y * VOXEL_SIZE;
    const worldZ = coord.z * VOXEL_SIZE;

    // Add vertices
    for (const vertex of vertices) {
      meshData.positions.push(
        worldX + (vertex[0] || 0) * VOXEL_SIZE,
        worldY + (vertex[1] || 0) * VOXEL_SIZE,
        worldZ + (vertex[2] || 0) * VOXEL_SIZE
      );
      
      meshData.normals.push(normal[0], normal[1], normal[2]);
      
      // Add vertex color
      const color = new THREE.Color(voxelProps.color);
      meshData.colors.push(color.r, color.g, color.b);
    }

    // Add indices for two triangles (quad = 2 triangles)
    const baseIndex = meshData.vertexCount;
    meshData.indices.push(
      baseIndex, baseIndex + 1, baseIndex + 2,
      baseIndex, baseIndex + 2, baseIndex + 3
    );
    
    meshData.vertexCount += 4;
  }

  /**
   * Get vertices for a specific face
   */
  private getFaceVertices(face: VoxelFace): number[][] {
    switch (face) {
      case VoxelFace.Top:
        return [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]];
      case VoxelFace.Bottom:
        return [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]];
      case VoxelFace.North:
        return [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]];
      case VoxelFace.South:
        return [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
      case VoxelFace.East:
        return [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]];
      case VoxelFace.West:
        return [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]];
      default:
        return [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
    }
  }

  /**
   * Create Three.js mesh from mesh data
   */
  private createMeshFromData(
    meshDataByType: Map<VoxelType, MeshData>,
    chunk: VoxelChunk
  ): THREE.Mesh | null {
    // Combine all mesh data into a single geometry for performance
    const combinedMeshData = this.createEmptyMeshData();
    
    for (const [, meshData] of meshDataByType) {
      if (meshData.vertexCount === 0) continue;
      
      // Offset indices for combined mesh
      const indexOffset = combinedMeshData.vertexCount;
      for (const index of meshData.indices) {
        combinedMeshData.indices.push(index + indexOffset);
      }
      
      // Add all vertex data
      combinedMeshData.positions.push(...meshData.positions);
      combinedMeshData.normals.push(...meshData.normals);
      combinedMeshData.colors.push(...meshData.colors);
      combinedMeshData.vertexCount += meshData.vertexCount;
    }
    
    if (combinedMeshData.vertexCount === 0) {
      return null;
    }

    // Create Three.js geometry
    const geometry = new THREE.BufferGeometry();
    
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(combinedMeshData.positions, 3)
    );
    
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(combinedMeshData.normals, 3)
    );
    
    if (this.config.useVertexColors) {
      geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(combinedMeshData.colors, 3)
      );
    }
    
    geometry.setIndex(combinedMeshData.indices);
    
    // Optimize geometry
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    // Create material
    const material = this.createMaterial();
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Position mesh at chunk origin
    const chunkCoord = chunk.getCoordinate();
    const chunkSizeVoxels = 16 * 20; // CHUNK_SIZE * VOXELS_PER_GRID
    mesh.position.set(
      chunkCoord.x * chunkSizeVoxels * VOXEL_SIZE,
      0,
      chunkCoord.z * chunkSizeVoxels * VOXEL_SIZE
    );
    
    return mesh;
  }

  /**
   * Create material for voxel meshes
   */
  private createMaterial(): THREE.Material {
    if (this.config.useVertexColors) {
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0.1
      });
    } else {
      return new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.8,
        metalness: 0.1
      });
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<MeshingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): MeshingConfig {
    return { ...this.config };
  }

  /**
   * Calculate mesh statistics
   */
  public calculateMeshStats(mesh: THREE.Mesh): {
    vertices: number;
    triangles: number;
    faces: number;
  } {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const positions = geometry.getAttribute('position');
    const indices = geometry.getIndex();
    
    return {
      vertices: positions ? positions.count : 0,
      triangles: indices ? indices.count / 3 : 0,
      faces: indices ? indices.count / 6 : 0 // Each face = 2 triangles = 6 indices
    };
  }

  /**
   * Dispose of mesh resources
   */
  public disposeMesh(mesh: THREE.Mesh): void {
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        material.dispose();
      }
    } else if (mesh.material) {
      mesh.material.dispose();
    }
  }
}