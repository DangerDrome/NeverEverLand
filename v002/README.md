# Isometric Game Engine v002

A modular Three.js engine for isometric/dimetric games, using true 2:1 pixel ratio projection as described by Pikuma.

## Key Features
- **Dimetric Camera**: Orthographic camera with elevation ≈ 26.57°, azimuth 45°, for perfect 2:1 pixel tiles
- **Grid System**: Grid-to-screen and screen-to-grid transforms for isometric rendering
- **Smooth Controls**: WASD/Arrow key panning, mouse wheel zoom, optional pixel grid snapping
- **Pixelation Effect**: Post-processing shader for retro chunky pixel look
- **Modular Design**: Clean ES6 modules for camera, grid, controls, and effects

## Isometric/Dimetric Math
- **Camera**:
  - Elevation: `Math.atan(0.5)` ≈ 26.57°
  - Azimuth: 45°
- **Grid-to-Screen**:
  - `screenX = (x - y) * (tileWidth / 2)`
  - `screenY = (x + y) * (tileHeight / 2)`
- **Screen-to-Grid (inverse)**:
  - `x = (screenY / (tileHeight / 2) + screenX / (tileWidth / 2)) / 2`
  - `y = (screenY / (tileHeight / 2) - screenX / (tileWidth / 2)) / 2`

## Controls
- **WASD / Arrow Keys**: Pan camera
- **Mouse Wheel**: Zoom in/out
- **Q/E**: Pixelation strength +/-
- **P**: Toggle post-processing

## Project Structure
```
├── index.html            # Main HTML file, Three.js import map
├── main.js               # Main entry point and game loop
├── IsometricCamera.js    # Camera setup (dimetric projection)
├── TileGrid.js           # Grid system and transforms
├── CameraControls.js     # Input handling for camera
└── PixelationEffect.js   # Post-processing pixelation effect
```

## References
- Pikuma: [Isometric Projection in Game Development](https://pikuma.com/blog/isometric-projection-in-games)

---

Ready for true isometric/dimetric game development! 