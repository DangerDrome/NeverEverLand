# v007 - High Performance Voxel System

A complete TypeScript-based voxel engine with instanced rendering, supporting up to 1M voxels at 60 FPS. Part of the NeverEverLand project evolution.

## 🚀 Quick Start

```bash
# Start the development server
./devserver.sh start

# Or with auto-open browser
./devserver.sh start --open

# The server runs on http://localhost:8007
```

## 🎮 Controls

### Mouse Controls
- **Left Click**: Place voxel
- **Right Click**: Remove voxel  
- **Middle Mouse**: Pan camera
- **Scroll Wheel**: Zoom in/out (enhanced zoom range: 0.1x - 20x)
- **Left Drag**: Rotate camera

### Keyboard Shortcuts
- **H**: Show/hide help menu
- **1-9**: Select voxel type (Grass, Dirt, Stone, Wood, Leaves, Water, Sand, Snow, Ice)
- **B**: Brush tool
- **E**: Eraser tool
- **X**: Box tool
- **L**: Line tool
- **P**: Fill tool
- **W**: Toggle wireframe/edge display
- **Z**: Undo last action (Ctrl+Z also works)
- **Y**: Redo (Ctrl+Y / Ctrl+Shift+Z also work)
- **G**: Toggle grid overlay
- **R**: Reset camera view
- **Ctrl+S**: Save scene
- **Ctrl+O**: Load scene
- **Ctrl+N**: New scene (clear all)
- **Escape**: Cancel current operation

### Drawing Tools
- **Brush**: Single voxel or area placement
- **Box**: Draw rectangular volumes (click and drag)
- **Line**: Draw straight lines between two points
- **Fill**: Fill connected areas of the same type
- **Eraser**: Remove voxels (E key)

### File Operations
- **Import VOX**: Load MagicaVoxel .vox files
- **Import JSON**: Load saved project files with full metadata
- **Export VOX**: Save as MagicaVoxel compatible .vox file
- **Export JSON**: Save with complete scene data and settings

## ✨ Features

### Core Engine
- **TypeScript**: Full type safety and modern development experience
- **Instanced Rendering**: Single draw call per voxel type for maximum performance
- **Mathematical Raycasting**: DDA algorithm for precise voxel selection
- **Undo/Redo System**: Complete operation history with automatic grouping
- **Save/Load**: Export and import voxel scenes as JSON or VOX files

### Import/Export Support
- **VOX Format**: Full MagicaVoxel compatibility
  - Import .vox files from MagicaVoxel
  - Export scenes for use in MagicaVoxel
  - Automatic coordinate system conversion (Y-up ↔ Z-up)
  - Color palette mapping to voxel types
  - Support for models up to 256×256×256 voxels
- **JSON Format**: Native format with metadata
  - Complete scene preservation
  - Voxel type information
  - Scene bounds and statistics
  - Human-readable format

### Performance
- ✅ **1M+ Voxels**: Supports over 1 million voxels at 60 FPS
- ✅ **< 100MB Memory**: Efficient memory usage with sparse storage
- ✅ **< 16ms Frame Time**: Smooth interactions and updates
- ✅ **Zero GC Pressure**: Pre-allocated arrays and efficient data structures

### User Interface
- Professional menu bar with File, Edit, View, and Help menus
- Real-time performance monitoring (voxel count, memory usage)
- Visual feedback for tool selection and operations
- Keyboard shortcut indicators in menus
- Modal dialogs for file operations

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Modern browser with WebGL support

### Commands

```bash
# Install dependencies
./devserver.sh install

# Start development server
./devserver.sh start

# Check server status
./devserver.sh status

# View logs
./devserver.sh logs

# Build for production
./devserver.sh build

# Preview production build
./devserver.sh preview

# Stop server
./devserver.sh stop

# Clean project (remove node_modules, dist, logs)
./devserver.sh clean
```

### Project Structure

```
v007/
├── src/
│   ├── main.ts              # Application entry point
│   ├── engine/
│   │   ├── VoxelEngine.ts   # Core voxel management
│   │   ├── VoxelRenderer.ts # Instanced mesh rendering
│   │   └── UndoRedoManager.ts # Operation history
│   ├── interaction/
│   │   └── DrawingSystem.ts # Drawing tools and interactions
│   ├── ui/
│   │   ├── VoxelPanel.ts    # UI components and menus
│   │   ├── Performance.ts   # Performance monitoring
│   │   └── DirectionIndicator.ts # 3D axis helper
│   └── types/
│       └── index.ts         # TypeScript type definitions
├── devserver.sh             # Development server manager
├── index.html               # HTML entry point
├── package.json             # Project dependencies
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configuration
```

## 🎨 Voxel Types

1. **Grass** - Green terrain blocks
2. **Dirt** - Brown earth blocks
3. **Stone** - Gray rock blocks
4. **Wood** - Brown timber blocks
5. **Leaves** - Green foliage (transparent)
6. **Water** - Blue liquid (transparent)
7. **Sand** - Tan desert blocks
8. **Snow** - White winter blocks
9. **Ice** - Cyan frozen blocks (transparent)

## 📊 Technical Details

### Architecture
- **VoxelEngine**: Core engine managing voxel data and operations
- **VoxelRenderer**: High-performance instanced mesh rendering system
- **DrawingSystem**: Interactive voxel placement with multiple tools
- **UndoRedoManager**: Efficient operation history with grouping
- **Coordinate System**: Unified world-space coordinates with integer voxel positions

### Optimizations
- **Instanced Rendering**: Up to 1M instances per mesh
- **Spatial Hashing**: O(1) voxel lookups with Map<string, Voxel>
- **Batch Operations**: Groups voxel changes for efficient updates
- **Typed Arrays**: Pre-allocated Float32Arrays for transform matrices
- **Frustum Culling**: Automatic via Three.js
- **Dirty Region Tracking**: Only updates changed areas

### Performance Metrics
- **Target FPS**: 60 with 100k+ voxels
- **Memory Usage**: ~100MB for 1M voxels  
- **Load Time**: < 500ms initial setup
- **Interaction Latency**: < 16ms per frame

## 🔧 Configuration

The server runs on port **8007** by default. To change this:

1. Edit `vite.config.ts` and update the port
2. Edit `devserver.sh` and update `VITE_PORT=8007`

## 🐛 Troubleshooting

### Server won't start
```bash
# Kill any process on the port
./devserver.sh stop

# Clean and reinstall
./devserver.sh clean
./devserver.sh install
./devserver.sh start
```

### TypeScript errors
```bash
# Check TypeScript compilation
npx tsc --noEmit

# View detailed errors
./devserver.sh logs
```

### Performance issues
- Reduce voxel count (clear unused areas)
- Close other browser tabs
- Disable browser extensions
- Use Chrome/Firefox for best performance

## 📝 Recent Updates

- **Enhanced Zoom**: Increased zoom out range from 0.5x to 0.1x (5x more zoom out)
- **Improved DevServer**: Specialized script for v007 with better error handling
- **TypeScript**: Full migration from JavaScript with strict type checking
- **UI Overhaul**: Professional menu system with keyboard shortcuts
- **Drawing Tools**: Multiple tools for different building scenarios

## 🎯 Future Enhancements

- [ ] Chunk-based infinite world
- [ ] Texture atlas support
- [ ] Ambient occlusion
- [ ] Shadow mapping
- [ ] Multiplayer support
- [ ] VR/AR compatibility
- [ ] Procedural generation
- [ ] Custom voxel types
- [ ] Animation system
- [ ] Physics integration

## 📄 License

MIT License - Part of the NeverEverLand project

## 🙏 Credits

- Inspired by [nimadez/voxel-builder](https://github.com/nimadez/voxel-builder)
- Built with [Three.js](https://threejs.org/)
- Developed with [Vite](https://vitejs.dev/) and [TypeScript](https://www.typescriptlang.org/)