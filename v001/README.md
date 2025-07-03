# Isometric Farming Game - Three.js Starter

A clean, modular Three.js starter project for creating isometric farming and village management games inspired by Stardew Valley and Age of Empires II, with a retro pixel art aesthetic.

## Features

- **Isometric Camera**: Perfect orthographic camera setup with classic 30°/45° angles
- **Tile Grid System**: Configurable grid with 10x10 tiles by default
- **Smooth Controls**: WASD/Arrow key panning with mouse wheel zoom
- **Pixelation Effect**: Custom post-processing shader for retro pixel art look
- **Modular Architecture**: Clean, extensible class-based structure
- **Sample Objects**: Trees and buildings for visual reference

## Quick Start

1. Open `index.html` in a modern web browser
2. Use controls to explore the scene:
   - **WASD** or **Arrow Keys**: Pan camera
   - **Mouse Wheel**: Zoom in/out
   - **Q/E**: Adjust pixelation strength

## Project Structure

```
├── index.html          # Main HTML file with Three.js CDN links
├── main.js             # Main application and game loop
├── IsometricCamera.js  # Camera setup and management
├── TileGrid.js         # Grid system and tile management
├── CameraControls.js   # Input handling for camera movement
└── PixelationEffect.js # Post-processing effects
```

## Customization Guide

### Adjusting the Isometric Angle

In `IsometricCamera.js`, modify the `setIsometricAngle()` method:

```javascript
// Standard isometric (30° elevation, 45° azimuth)
camera.setIsometricAngle(30, 45);

// More top-down view
camera.setIsometricAngle(45, 45);

// Classic Age of Empires style
camera.setIsometricAngle(25, 45);
```

### Changing Grid Size

In `main.js`, modify the config object:

```javascript
this.config = {
    gridSize: { width: 20, height: 15 }, // Larger grid
    tileSize: 1.5,                       // Smaller tiles
    pixelSize: 6,                        // More pixelation
    cameraViewSize: 25                   // Wider view
};
```

Or resize dynamically:
```javascript
game.tileGrid.resize(15, 15); // 15x15 grid
```

### Adjusting Pixelation Strength

```javascript
// Set specific pixel size (1-20)
game.pixelationEffect.setPixelSize(8);

// Or use the built-in controls
game.pixelationEffect.increasePixelation();
game.pixelationEffect.decreasePixelation();
```

### Adding Custom Tiles

In `TileGrid.js`, extend the `createGrid()` method:

```javascript
// Add new materials
const waterMaterial = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });

// Use in tile creation
const tileMaterials = [grassMaterial, dirtMaterial, waterMaterial, stoneMaterial];
```

### Camera Controls Customization

```javascript
// Adjust control sensitivity
game.cameraControls.setPanSpeed(2.0);    // Faster panning
game.cameraControls.setZoomSpeed(0.05);  // Slower zoom
game.cameraControls.setSmoothing(0.2);   // More responsive
```

## Advanced Features

### Adding Film Grain Effect

```javascript
// Enable retro film grain
game.pixelationEffect.addRetroEffects();
```

### Custom Lighting Setup

The lighting system supports realistic shadows and depth. Modify in `main.js`:

```javascript
// Adjust directional light for different times of day
directionalLight.color.setHex(0xffaa88); // Sunset lighting
directionalLight.intensity = 0.6;        // Dimmer light
```

### Debug Information

Access the debug console for real-time information:

```javascript
// View current game state
console.log(window.game.getGameState());

// Camera position
console.log(window.game.isometricCamera.getCamera().position);

// Grid information
console.log(window.game.tileGrid.getDimensions());
```

## Extending the System

### Adding Interactive Objects

```javascript
// Example: Add clickable farmable plots
class FarmPlot {
    constructor(x, z, tileGrid) {
        this.gridPos = { x, z };
        this.worldPos = tileGrid.gridToWorld(x, z);
        this.planted = false;
        this.createMesh();
    }
    
    createMesh() {
        const geometry = new THREE.BoxGeometry(1.8, 0.1, 1.8);
        const material = new THREE.MeshLambertMaterial({ 
            color: this.planted ? 0x8B4513 : 0x654321 
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.worldPos);
        this.mesh.position.y = 0.05;
    }
}
```

### Mouse Interaction

```javascript
// Add raycasting for tile selection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, game.isometricCamera.getCamera());
    const intersects = raycaster.intersectObjects(game.scene.children, true);
    
    if (intersects.length > 0) {
        const clickedTile = intersects[0];
        // Handle tile interaction
    }
}
```

## Performance Tips

1. **Disable antialiasing** for pixel art style (already done)
2. **Use object pooling** for frequently spawned objects
3. **Implement frustum culling** for large grids
4. **LOD system** for distant objects
5. **Texture atlasing** for multiple tile types

## Browser Support

- Modern browsers with WebGL support
- Chrome 40+, Firefox 36+, Safari 8+, Edge 12+

## Dependencies

- Three.js r158+ (loaded via CDN)
- Post-processing modules (EffectComposer, RenderPass, ShaderPass)

## License

This starter code is provided as-is for educational and development purposes.

---

**Ready to build your farming empire!** 🚜🌾

Start by modifying the tile types, adding interactive objects, or implementing a save system. The modular architecture makes it easy to extend and customize. 