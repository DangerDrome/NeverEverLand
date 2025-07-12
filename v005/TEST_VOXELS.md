# Testing the Voxel System

## How to Test Phase 2: Voxel Rendering System

### Prerequisites
1. Open a local server: `python -m http.server 8000` or `npx serve`
2. Navigate to `http://localhost:8000/v005/`

### Basic Testing Steps

#### 1. Initial Load Test
- **Expected**: Game loads with existing tile system working
- **Check**: No console errors, 3D scene renders properly

#### 2. Voxel Mode Activation
- **Action**: Press `Ctrl+V` to toggle voxel mode
- **Expected**: 
  - Console message about voxel mode toggle
  - Voxel palette appears in top-right corner
  - Test terrain chunks generate automatically (5x5 chunk grid)

#### 3. Voxel Placement Testing
- **Action**: Left-click on existing voxel terrain
- **Expected**: 
  - Green wireframe preview shows placement position
  - New voxel appears at cursor location
  - Preview updates in real-time as mouse moves

#### 4. Voxel Removal Testing
- **Action**: 
  - Select "Remove" mode in voxel palette OR press `X`
  - Right-click on existing voxels
- **Expected**:
  - Red wireframe preview shows removal position
  - Voxels disappear when clicked
  - White highlight shows selected voxel

#### 5. Brush Size Testing
- **Action**: 
  - Use `[` and `]` keys to change brush size
  - Or use the slider in voxel palette
- **Expected**:
  - Brush size indicator updates
  - Larger areas affected by placement/removal

#### 6. Voxel Type Testing
- **Action**: Change voxel type in palette dropdown
- **Expected**:
  - Different colored/textured voxels placed
  - Available types: Grass, Dirt, Stone, Wood, Leaves

#### 7. Undo/Redo Testing
- **Action**: 
  - Make several voxel changes
  - Press `Ctrl+Z` to undo
  - Press `Ctrl+Shift+Z` to redo
- **Expected**:
  - Changes revert step by step
  - Redo restores undone changes

#### 8. Mode Switching Test
- **Action**: Press `Ctrl+V` to return to tile mode
- **Expected**:
  - Voxel palette disappears
  - Tile system becomes active again
  - Voxel terrain remains visible but not editable

### Performance Testing

#### 9. LOD System Testing
- **Action**: 
  - Enable voxel mode
  - Use mouse wheel to zoom out far from terrain
  - Move camera around with middle mouse drag
- **Expected**:
  - Distant chunks become wireframe (outline mode)
  - Very distant chunks unload completely
  - Frame rate remains stable (check console FPS logs)

#### 10. Large Edit Testing
- **Action**:
  - Set brush size to maximum (5)
  - Make large edits to terrain
- **Expected**:
  - Multiple voxels affected simultaneously
  - Smooth performance even with large changes
  - Mesh updates happen asynchronously

### Debugging Information

#### Console Output to Monitor:
- **FPS tracking**: Should maintain 60fps
- **Chunk loading**: "Loading chunk at..." messages
- **Voxel mode**: "Voxel mode enabled/disabled" messages
- **Error checking**: No red error messages

#### Visual Indicators:
- **Green wireframe**: Placement preview
- **Red wireframe**: Removal preview  
- **White wireframe**: Voxel highlight
- **Terrain chunks**: Automatic 5x5 grid generation

### Expected File Structure Verification:
```
/v005/src/
├── VoxelChunk.js ✓
├── VoxelMesher.js ✓
├── VoxelEditingSystem.js ✓
├── VoxelLODSystem.js ✓
├── VoxelWorld.js ✓
└── main.js (updated) ✓
```

### Troubleshooting Common Issues:

#### Issue: "Cannot resolve module" errors
- **Solution**: Check that all import paths are correct (using 'three' not '../lib/three.min.js')

#### Issue: Voxel palette doesn't appear
- **Solution**: Ensure voxel mode is activated with `Ctrl+V`, check browser console for errors

#### Issue: No terrain generates
- **Solution**: Check that VoxelWorld.generateTestWorld() is being called, verify chunk creation

#### Issue: Poor performance
- **Solution**: Check LOD system is active, verify greedy meshing is working, monitor chunk count

#### Issue: Controls don't work
- **Solution**: Verify event listeners are set up, check that voxel editing is enabled

### Success Criteria:
- ✅ Voxel mode toggles with Ctrl+V
- ✅ Test terrain generates automatically  
- ✅ Voxel placement/removal works with visual feedback
- ✅ Undo/redo system functions
- ✅ Performance remains at 60fps
- ✅ LOD system adjusts quality based on distance
- ✅ Seamless integration with existing tile system

If all tests pass, Phase 2 is successfully implemented and ready for Phase 3!