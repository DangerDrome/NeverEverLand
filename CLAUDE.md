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

NeverEverLand is a Three.js-based isometric game engine with three main versions:
- **v001**: Class-based architecture with comprehensive features including post-processing effects
- **v002**: Modular approach with WFC (Wave Function Collapse) terrain generation, player movement, and minimap
- **v003**: Entity Component System (ECS) architecture with proper modular file structure

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
- **G**: Toggle grid overlay visibility (v002)
- **R**: Regenerate terrain with WFC (v002)
- **F**: Focus camera on player (v002)

### Performance Optimizations
- Instanced mesh rendering for tiles (`v002/TileGrid.js:20`)
- Frustum culling for large grids
- Adaptive pixel grid that scales with zoom level
- Render order management for proper layering

## Development Commands

Since this is a client-side Three.js project, no build system is required. Open the HTML files directly in a modern web browser:

- **v001**: Open `v001/index.html`
- **v002**: Open `v002/index.html`

For development, use a local server to avoid CORS issues:
```bash
python -m http.server 8000
# or
npx serve
```

## Development Guidelines

- **Server Usage**: 
  - never use a server, always use index.html 
- **CORS Bypass**:
  - Use Python's SimpleHTTPServer
  - Use `npx serve`
  - Disable browser security for local development

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