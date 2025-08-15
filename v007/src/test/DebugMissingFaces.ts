import { VoxelType } from '../types';
import { BakedMeshGenerator } from '../engine/BakedMeshGenerator';

/**
 * Debug missing faces issue
 */
export function debugMissingFaces() {
    console.log('=== Debug Missing Faces ===');
    
    // Create a simple structure where we expect to see the issue
    const voxels = new Map<string, VoxelType>();
    
    // Create a 3x3x3 cube missing the center (hollow)
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            for (let z = 0; z < 3; z++) {
                // Skip center voxel
                if (x === 1 && y === 1 && z === 1) continue;
                voxels.set(`${x},${y},${z}`, VoxelType.STONE);
            }
        }
    }
    
    console.log('Created 3x3x3 hollow cube (26 voxels)');
    
    // Create generator with debug logging
    const bakedGen = new BakedMeshGenerator(0.1);
    
    // Patch the createSliceMask method to log what's happening
    const originalCreateSliceMask = bakedGen['createSliceMask'];
    bakedGen['createSliceMask'] = function(
        voxelMap: Map<string, VoxelType>,
        slice: number,
        primaryAxis: number,
        secondaryAxis: number,
        tertiaryAxis: number,
        bounds: { min: number[]; max: number[] }
    ) {
        const mask = originalCreateSliceMask.apply(this, [voxelMap, slice, primaryAxis, secondaryAxis, tertiaryAxis, bounds]);
        
        // Count non-null entries in mask
        let faceCount = 0;
        for (let v = 0; v < mask.length; v++) {
            for (let u = 0; u < mask[v].length; u++) {
                if (mask[v][u] !== null) faceCount++;
            }
        }
        
        const axisName = primaryAxis === 0 ? 'X' : primaryAxis === 1 ? 'Y' : 'Z';
        if (faceCount > 0 || slice === bounds.max[primaryAxis] + 1) {
            console.log(`${axisName} slice ${slice}: ${faceCount} faces in mask`);
            
            // Log details for boundary slices
            if (slice === bounds.max[primaryAxis] + 1) {
                console.log(`  This is the max+1 slice (checking for positive faces)`);
                console.log(`  Bounds: min=${bounds.min}, max=${bounds.max}`);
                // Check specific positions
                for (let v = 0; v < mask.length; v++) {
                    for (let u = 0; u < mask[v].length; u++) {
                        if (mask[v][u] !== null) {
                            const coord = [0, 0, 0];
                            coord[primaryAxis] = slice;
                            coord[secondaryAxis] = bounds.min[secondaryAxis] + u;
                            coord[tertiaryAxis] = bounds.min[tertiaryAxis] + v;
                            
                            const prevCoord = [...coord];
                            prevCoord[primaryAxis] = slice - 1;
                            
                            console.log(`    Found face at mask[${v}][${u}]: current=${coord}, prev=${prevCoord}`);
                        }
                    }
                }
            }
        }
        
        return mask;
    };
    
    // Also patch generateRectanglesFromMask to log face generation
    const originalGenerateRectangles = bakedGen['generateRectanglesFromMask'];
    bakedGen['generateRectanglesFromMask'] = function(
        mask: (VoxelType | null)[][],
        slice: number,
        primaryAxis: number,
        secondaryAxis: number,
        tertiaryAxis: number,
        bounds: { min: number[]; max: number[] },
        voxelMap: Map<string, VoxelType>
    ) {
        const faces = originalGenerateRectangles.apply(this, [mask, slice, primaryAxis, secondaryAxis, tertiaryAxis, bounds, voxelMap]);
        
        const axisName = primaryAxis === 0 ? 'X' : primaryAxis === 1 ? 'Y' : 'Z';
        if (slice === bounds.max[primaryAxis] + 1 && faces.length === 0) {
            console.log(`  WARNING: No faces generated for ${axisName} max+1 slice despite mask having entries!`);
        }
        
        return faces;
    };
    
    const result = bakedGen.generateOptimizedMesh(voxels);
    
    console.log('\n=== Summary ===');
    console.log('Total faces generated:', result.metadata.faceCount);
    
    // Expected faces:
    // - 6 outer faces (3x3 each) = 54 faces
    // - 6 inner faces (1x1 each) = 6 faces  
    // Total = 60 faces before greedy meshing
    console.log('Note: With greedy meshing, faces will be merged');
}

// Make available globally
(window as any).debugMissingFaces = debugMissingFaces;