import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';

/**
 * Debug face orientation issues
 */
export function debugFaceOrientation() {
    console.log('=== Debug Face Orientation ===');
    
    // Create a simple 2x2x2 cube to test all faces
    const voxels = new Map<string, VoxelType>();
    
    // Create 2x2x2 cube
    for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
                voxels.set(`${x},${y},${z}`, VoxelType.STONE);
            }
        }
    }
    
    console.log('Created 2x2x2 cube');
    
    // Patch BakedMeshGenerator to add logging
    const bakedGen = new BakedMeshGenerator(0.1);
    
    // Override the generateRectanglesFromMask method to add logging
    const originalMethod = bakedGen['generateRectanglesFromMask'];
    bakedGen['generateRectanglesFromMask'] = function(
        mask: (VoxelType | null)[][],
        slice: number,
        primaryAxis: number,
        secondaryAxis: number,
        tertiaryAxis: number,
        bounds: { min: number[]; max: number[] },
        voxelMap: Map<string, VoxelType>
    ) {
        const faces = originalMethod.apply(this, [mask, slice, primaryAxis, secondaryAxis, tertiaryAxis, bounds, voxelMap]);
        
        // Log face generation details
        if (faces.length > 0) {
            const axisName = primaryAxis === 0 ? 'X' : primaryAxis === 1 ? 'Y' : 'Z';
            console.log(`\n${axisName} axis, slice ${slice}:`);
            
            faces.forEach((face: any, i: number) => {
                const normalDir = face.normal.x !== 0 ? `X${face.normal.x > 0 ? '+' : '-'}` :
                                face.normal.y !== 0 ? `Y${face.normal.y > 0 ? '+' : '-'}` :
                                `Z${face.normal.z > 0 ? '+' : '-'}`;
                
                console.log(`  Face ${i}: pos=(${face.x},${face.y},${face.z}) size=${face.width}x${face.height} normal=${normalDir}`);
                
                // Check if this face position makes sense
                const currentKey = `${face.x},${face.y},${face.z}`;
                const hasVoxel = voxelMap.has(currentKey);
                
                // For positive normals, check if there's a voxel at the face position
                if ((face.normal.x > 0 || face.normal.y > 0 || face.normal.z > 0) && !hasVoxel) {
                    console.log(`    ⚠️  WARNING: Positive normal but no voxel at face position!`);
                }
            });
        }
        
        return faces;
    };
    
    const result = bakedGen.generateOptimizedMesh(voxels);
    
    console.log('\n=== Summary ===');
    console.log('Total faces:', result.metadata.faceCount);
    console.log('Expected: 12 faces (6 sides × 2x2 faces per side, merged to 6 with greedy meshing)');
}

// Make available globally
(window as any).debugFaceOrientation = debugFaceOrientation;