# NeverEverLand v006 - TypeScript Tile Editor

A dimetric isometric tile editor built with TypeScript, Three.js, and Vite.

## Features

- **Dimetric Isometric Grid**: Proper diamond-shaped grid cells for isometric tile placement
- **TypeScript**: Full type safety for better development experience
- **Multiple Grid Levels**: Major (10m), Standard (1m), and Fine (0.5m) grids
- **Camera Controls**: Pan with middle mouse, zoom with scroll wheel
- **Grid Highlighting**: Visual feedback showing which cell the mouse is over
- **Coordinate Display**: Real-time grid coordinate display
- **FPS Counter**: Performance monitoring

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open browser to http://localhost:8000

## Controls

- **Middle Mouse Drag**: Pan camera
- **Scroll Wheel**: Zoom in/out (smooth orthographic zoom)
- **G**: Toggle grid visibility
- **1**: Select mode
- **2**: Place mode
- **3**: Erase mode
- **R**: Rotate tile (90° increments)

## Architecture

### Core Systems

- **DimetricGrid**: Renders the isometric diamond grid at multiple detail levels
- **DimetricCamera**: Fixed dimetric projection camera with pan/zoom controls
- **TileEditor**: Main editor class that coordinates all systems

### Type System

The project uses TypeScript with strict mode enabled for maximum type safety:

- `GridCoordinate`: Integer grid positions
- `WorldPosition`: 3D world space positions
- `ScreenPosition`: 2D screen coordinates
- `EditorState`: Current editor mode, selection, etc.

### Coordinate Systems

- **Grid Space**: Integer coordinates for tile placement (0,0), (1,0), etc.
- **World Space**: 3D positions where tiles are rendered
- **Screen Space**: 2D pixel coordinates for UI

## Development

### Build for production:
```bash
npm run build
```

### Type checking:
```bash
npm run typecheck
```

## Camera Verification

The camera uses proper dimetric projection with:
- Elevation angle: arctan(0.5) ≈ 26.565°
- Azimuth angle: 45°
- Grid appears as diamonds with 2:1 ratio (width:height)

To verify camera setup, add `#debug` to URL:
```
http://localhost:8000/#debug
```

This shows test cubes and measurement lines to verify the dimetric projection is correct.

## Next Steps

- Implement tile definitions and rendering
- Add tile palette UI
- Create tile placement/removal logic
- Add save/load functionality
- Implement undo/redo system