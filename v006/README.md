# NeverEverLand v006 - TypeScript Tile Editor

A dimetric isometric tile editor built with TypeScript, Three.js, and Vite.

## Features

- **Dimetric Isometric Grid**: Proper diamond-shaped grid cells for isometric tile placement
- **TypeScript**: Full type safety with strict mode enabled
- **Multiple Grid Levels**: Major (10m), Standard (1m), and Fine (0.5m) grids with opacity scaling
- **Advanced Camera Controls**: 
  - Pan with middle mouse (inverted direction)
  - Zoom to mouse position with scroll wheel
  - Fixed dimetric projection (26.565° elevation, 45° azimuth)
- **Grid Highlighting**: Visual feedback showing which cell the mouse is over
- **Coordinate Display**: Real-time grid coordinate display
- **Info Panel**: Advanced performance monitoring with:
  - 3D orientation viewer with dimetric orthographic camera
  - Real-time FPS, frame time, and draw calls graphs
  - Detailed renderer statistics (triangles, geometries, textures, programs)
  - StyleUI integration with proper Inter font and color theming

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open browser to http://localhost:5173

## Controls

- **Middle Mouse Drag**: Pan camera (highlight stays at current location during pan)
- **Scroll Wheel**: Zoom in/out towards mouse position
- **G**: Toggle grid visibility
- **1**: Select mode
- **2**: Place mode  
- **3**: Erase mode
- **R**: Rotate tile (90° increments)

## Architecture

### Project Structure

```
src/
├── main.ts              # Application entry point
├── core/                # Core editor systems
│   ├── TileEditor.ts    # Main editor engine/orchestrator
│   ├── Camera.ts        # Dimetric camera with pan/zoom
│   ├── DimetricGrid.ts  # Isometric grid rendering
│   └── constants.ts     # Shared constants and utilities
├── types/               # TypeScript type definitions
│   ├── coordinates.ts   # Coordinate system types & utilities
│   └── index.ts         # General editor types and enums
└── ui/                  # User interface components
    └── InfoPanel.ts     # Performance monitoring panel
```

### Core Systems

- **TileEditor**: Main editor engine that coordinates all systems and handles user input
- **DimetricCamera**: Fixed dimetric projection camera with advanced pan/zoom controls
- **DimetricGrid**: Renders the isometric diamond grid at multiple detail levels
- **InfoPanel**: Performance monitoring UI with 3D orientation viewer and real-time graphs

### Type System

The project uses TypeScript with strict mode enabled for maximum type safety:

- `GridCoordinate`: Integer grid positions for tile placement
- `WorldPosition`: 3D world space positions  
- `ScreenPosition`: 2D screen coordinates
- `EditorState`: Current editor mode, selection, zoom level, etc.
- `EditorConfig`: Configuration options for the editor

### Coordinate Systems

- **Grid Space**: Integer coordinates for tile placement (0,0), (1,0), etc.
- **World Space**: 3D positions where tiles are rendered (converted via `CoordinateUtils`)
- **Screen Space**: 2D pixel coordinates for UI interactions

### Key Features

- **Zoom to Mouse**: Camera zooms towards the exact mouse position for intuitive navigation
- **Grid Highlight Stability**: Grid highlight stays fixed during middle-mouse panning
- **Shared Constants**: All dimetric angles, grid sizes, and camera settings in `constants.ts`
- **Path Aliases**: Clean imports using `@core/*`, `@types/*`, `@ui/*` aliases
- **StyleUI Integration**: Consistent theming with Inter font and CSS variables

## Development

### Build for production:
```bash
npm run build
```

### Type checking:
```bash
npm run typecheck
```

### Preview production build:
```bash
npm run preview
```

## Camera & Projection

The camera system uses proper dimetric projection:
- **Elevation**: arctan(0.5) ≈ 26.565°
- **Azimuth**: 45°
- **Grid Appearance**: Diamonds with 2:1 ratio (width:height)
- **Orthographic**: Consistent scale regardless of distance

All dimetric calculations are centralized in `@core/constants` for consistency across the camera, grid, and info panel mini-scene.

## StyleUI Integration

v006 integrates with the StyleUI design system:
- **Typography**: Inter font family with proper weight variants
- **Colors**: Uses CSS custom properties for theming
- **Components**: Panels, buttons, and tags follow StyleUI patterns
- **Responsive**: Adapts to light/dark themes automatically

## Next Steps

- Implement tile definitions and rendering system
- Add tile palette UI for selection
- Create tile placement/removal logic with visual feedback
- Add save/load functionality for tile maps
- Implement undo/redo system with command pattern
- Add asset loading for tile textures and models
- Create export functionality for different formats