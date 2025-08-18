# Debug Utilities

This folder contains debugging utilities for the voxel engine's mesh generation and baking systems.

## Available Debug Functions

These functions are exposed globally in development mode and can be called from the browser console:

- `testBaking()` - Test the baking system with a 3x3x3 cube
- `visualBakingTest()` - Visual test of the baking system
- `debugBaking()` - Debug baking process
- `testTopFaces()` - Test top face detection
- `testPlatformFaces()` - Test platform face generation
- `debugBakedFaces()` - Debug baked face visualization with arrows
- `clearDebugArrows()` - Clear debug arrows from the scene
- `debugMissingFaces()` - Debug missing faces in mesh generation
- `testBoundaryFaces()` - Test boundary face detection
- `verifyGreedyMeshing()` - Verify greedy meshing algorithm
- `compareBaking()` - Compare different baking methods
- `testSeparatedVoxels()` - Test separated voxel handling
- `testBoundaryFix()` - Test boundary fix algorithms
- `testAllFaces()` - Comprehensive face testing

## Usage

Open the browser console and run any of these functions:

```javascript
// Test the baking system
testBaking()

// Visual debugging with arrows
debugBakedFaces()

// Clear debug visualizations
clearDebugArrows()
```

## Note

These are development utilities and should not be included in production builds.