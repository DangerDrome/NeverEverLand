# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL: NEVER PUT CODE IN INDEX.HTML 🚨

**ABSOLUTE RULE FOR v003**: The v003 folder uses a MODULAR ARCHITECTURE with ES6 modules. 

**NEVER** add components, systems, or any substantial code to index.html. The HTML file should ONLY contain:
- Basic HTML structure
- Script imports
- Initial setup/bootstrapping
- Small initialization code (< 50 lines)

**ALWAYS** create proper files:
- Components go in `/v003/components/ComponentName.js`
- Systems go in `/v003/systems/SystemName.js`
- Use ES6 import/export syntax
- Follow the existing modular pattern

**WHY**: Adding code to index.html creates a monolithic mess, breaks modularity, makes debugging horrible, and defeats the entire purpose of the ECS architecture.

## Project Overview

NeverEverLand is a Three.js-based isometric game engine with multiple versions:
- **v001**: Class-based architecture with comprehensive features including post-processing effects
- **v002**: Modular approach with WFC (Wave Function Collapse) terrain generation, player movement, and minimap
- **v003**: Entity Component System (ECS) architecture with proper modular file structure
- **v004**: Not specified in detail
- **v005**: Hybrid voxel/tile system with advanced editing capabilities (current active version)

## Architecture

### Core Components

Both versions share these fundamental components:
- **IsometricCamera**: Orthographic camera with dimetric projection (26.57° elevation, 45° azimuth)
- **TileGrid**: Grid system using instanced meshes for performance, with grid-to-world coordinate transforms
- **CameraControls**: WASD/arrow key panning and mouse wheel zoom
- **PixelationEffect**: Post-processing shader for retro pixel art aesthetic

### Version Differences

**v001** (`v001/main.js:5`):
- Object-oriented `IsometricFarmingGame` class
- Comprehensive post-processing pipeline
- Sample objects (trees, houses) for visual reference
- Debug information display
- Configurable settings via config object

**v002** (`v002/main.js:1`):
- Functional approach with global script execution
- **Player** system with grid-based movement (`v002/Player.js:4`)
- **WaveFunctionCollapse** for procedural terrain generation (`v002/WaveFunctionCollapse.js:4`)
- **Minimap** functionality
- FPS counter and performance monitoring
- Larger grid size (224x224) with instanced rendering

**v005** (`v005/src/main.js`):
- **HybridVoxelWorld**: Dual-resolution voxel system (6cm tiles, 5cm detail voxels)
- **TileMapSystem**: Grid-based tile placement with 1m x 1m cells
- **L-System Trees**: Procedural tree generation with organic growth patterns
- **StyleUI Framework**: Complete UI component library with panels, drag & drop
- **Post-processing**: Pixelation and bloom effects
- **Voxel Editing**: Real-time voxel placement/removal with chunked rendering

## Key Features

### Isometric Projection
- Uses true 2:1 pixel ratio dimetric projection
- Grid-to-screen transforms: `screenX = (x - y) * (tileWidth / 2)`
- Camera elevation: `Math.atan(0.5)` ≈ 26.57°

### Controls
- **WASD/Arrow Keys**: Camera panning
- **Mouse Wheel**: Zoom in/out
- **Q/E**: Adjust pixelation strength (v001)
- **P**: Toggle post-processing effects (v001)
- **G**: Toggle grid overlay visibility (v002/v005)
- **R**: Regenerate terrain with WFC (v002) / Rotate tile (v005)
- **F**: Focus camera on selection (all versions)
- **F3**: Toggle debug panel (v005)
- **F4**: Toggle tile palette (v005)
- **Escape**: Toggle pause menu (v005)
- **Middle Mouse**: Pan camera (v005)
- **Left Click**: Place tile/voxel (v005)
- **Right Click**: Remove tile/voxel (v005)

### Performance Optimizations
- Instanced mesh rendering for tiles (`v002/TileGrid.js:20`)
- Frustum culling for large grids
- Adaptive pixel grid that scales with zoom level
- Render order management for proper layering

## Development Commands

Since this is a client-side Three.js project, no build system is required. Open the HTML files directly in a modern web browser:

- **v001**: Open `v001/index.html`
- **v002**: Open `v002/index.html`
- **v003**: Open `v003/index.html`
- **v005**: Open `v005/index.html`

For development, a local server is **ALWAYS** running at http://localhost:8000/

## Development Guidelines

- **Local Server**: Always available at http://localhost:8000/
- **v005 Entry Point**: http://localhost:8000/v005/index.html

## Testing

No formal test suite exists. Testing is done through:
- Browser console debugging (`window.game` object available in v001)
- Visual inspection of rendering
- Performance monitoring via built-in FPS counter (v002)

## Common Development Patterns

### Adding New Tile Types
Extend the `TileGrid` class by modifying the materials array and adding new geometry types.

### Implementing Interactive Objects
Use Three.js raycasting for mouse interaction with the grid system. See `v002/main.js:125` for raycaster implementation.

### Performance Considerations
- Use instanced meshes for repeated geometry
- Implement LOD (Level of Detail) for distant objects
- Consider object pooling for frequently spawned items
- Use texture atlasing for multiple tile types

## File Structure

```
├── v001/                    # Full-featured version
│   ├── main.js             # Main game class and initialization
│   ├── IsometricCamera.js  # Camera management
│   ├── TileGrid.js         # Grid system
│   ├── CameraControls.js   # Input handling
│   ├── PixelationEffect.js # Post-processing effects
│   └── index.html          # Entry point
├── v002/                    # Modular version
│   ├── main.js             # Game loop and coordination
│   ├── Player.js           # Player character system
│   ├── WaveFunctionCollapse.js # Terrain generation
│   ├── Minimap.js          # Minimap rendering
│   ├── TileGrid.js         # Enhanced grid with instancing
│   └── index.html          # Entry point
└── v003/                    # ECS Architecture (MODULAR - DO NOT PUT CODE IN HTML!)
    ├── index.html          # ONLY initialization and imports
    ├── components/         # Component definitions (one per file)
    │   ├── TransformComponent.js
    │   ├── RenderableComponent.js
    │   ├── PhysicsComponent.js
    │   └── [ComponentName].js
    ├── systems/            # System implementations (one per file)
    │   ├── TransformSystem.js
    │   ├── RenderingSystem.js
    │   ├── PhysicsSystem.js
    │   └── [SystemName].js
    ├── core/               # ECS core functionality
    │   ├── Entity.js
    │   ├── Component.js
    │   ├── System.js
    │   └── World.js
    └── GameEngine.js       # Main engine class
└── v005/                    # Hybrid Voxel/Tile System (CURRENT ACTIVE VERSION)
    ├── index.html          # Entry point
    ├── src/                # All source code
    │   ├── main.js         # Main game initialization
    │   ├── HybridVoxelWorld.js # Hybrid voxel/tile rendering system
    │   ├── TileMapSystem.js    # Tile placement and management
    │   ├── VoxelWorld.js       # Core voxel engine
    │   ├── LSystem.js          # L-system tree generation
    │   └── ui/             # UI components using StyleUI framework
    └── test_assets/        # 3D models and textures
```

## Browser Compatibility

Requires modern browsers with WebGL support:
- Chrome 40+, Firefox 36+, Safari 8+, Edge 12+
- Three.js r158+ loaded via CDN

## Debug Access

In v001, access the game instance via `window.game` for debugging:
- `window.game.getGameState()` - Current game state
- `window.game.isometricCamera.getCamera().position` - Camera position
- `window.game.tileGrid.getDimensions()` - Grid information

In v002, access via `window.player` for player debugging.

In v005, access via `window.gameEngine` for full engine access:
- `window.gameEngine.voxelWorld` - Voxel world system
- `window.gameEngine.tileMapSystem` - Tile map system
- `window.debugVoxels()` - Debug voxel chunk information

## v005 Architecture Details

### Hybrid Voxel System
The HybridVoxelWorld uses two voxel resolutions:
- **Tile Voxels**: 6cm (0.06m) for placed tiles - stored in `tileChunks`
- **Detail Voxels**: 5cm (0.05m) for voxel editing - stored in regular chunks
- Tiles are 16x16 voxels (0.96m x 0.96m) to fit within 1m grid cells

### Coordinate Systems
- **Grid Coordinates**: Integer positions for 1m x 1m grid cells (0,0), (1,0), etc.
- **World Coordinates**: Grid cell centers at (0.5, 0.5), (1.5, 0.5), etc.
- **Voxel Coordinates**: Integer voxel positions based on voxel size

### Important Voxel Placement Notes
- Tile placement uses offsets to align with preview: `xOffset = 0.01, zOffset = 0.01`
- Voxel templates use `Math.floor` for width/depth to keep tiles under 1m
- Preview meshes use actual tile sizes from TileTypes, not voxel approximations

### L-System Trees
Trees use the organic formula: `X → F+[-F-XF-X][+FF][--XF[+X]][++F-X]`
- Proper 3D turtle graphics with heading, left, up vectors
- Trunk connectivity algorithms to prevent gaps
- Height-based foliage density (40% at bottom, 80% at top)
- Individual leaf color variations