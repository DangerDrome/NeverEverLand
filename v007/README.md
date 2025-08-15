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
- **Left Click**: Place voxel/asset
- **Right Click**: Remove voxel  
- **Middle Mouse**: Pan camera
- **Scroll Wheel**: Zoom in/out (enhanced zoom range: 0.1x - 20x)
- **Left Drag**: Rotate camera
- **Shift+Scroll**: Zoom while drawing (drag operations)

### Keyboard Shortcuts
- **H**: Show/hide help menu
- **V**: Single voxel brush (default mode)
- **1-9**: Select voxel type (Grass, Dirt, Stone, Wood, Leaves, Water, Sand, Snow, Ice)
- **B**: Brush tool
- **E**: Eraser tool
- **X**: Box tool
- **L**: Line tool
- **P**: Fill tool
- **S**: Selection tool
- **W**: Toggle wireframe/edge display
- **T**: Toggle tilt-shift effect
- **Z**: Undo last action (Ctrl+Z also works)
- **Y**: Redo (Ctrl+Y / Ctrl+Shift+Z also work)
- **G**: Toggle grid overlay (dynamic zoom-based visibility)
- **R**: Rotate asset (when in asset placement mode)
- **F**: Focus/Reset camera view
- **[/]**: Decrease/Increase brush size
- **Ctrl+S**: Save scene
- **Ctrl+O**: Load scene
- **Ctrl+N**: New scene (clear all)
- **Escape**: Cancel current operation / Clear asset selection

### Drawing Tools
- **Brush**: Single voxel or area placement (adjustable size with [/] keys)
- **Box**: Draw rectangular volumes (click and drag)
- **Line**: Draw straight lines between two points
- **Fill**: Fill connected areas of the same type (paint bucket tool)
- **Selection**: Box selection tool for copying/moving regions
- **Eraser**: Remove voxels (E key or right-click drag)
- **Constraint Plane**: Hold for 300ms to see grid preview during drag operations
- **Custom Colors**: All tools support custom colors from color picker

### Asset System
- **Voxel Brush Button**: First button (V key) for single voxel painting mode with color picker
- **Color Picker**: Click V button to select from multiple color palettes (Default, Pastel, Neon)
- **Asset Selection**: Click voxel type buttons (1-9) to show asset popover
- **Single Voxel Mode**: Shift+Click voxel buttons for traditional single voxel painting
- **Asset Placement**: Click to place selected asset, R to rotate before placing
- **Asset Library**: Premade structures for each voxel type
- **Asset Thumbnails**: Isometric preview rendering for all assets
- **Asset Creation**: Use `/createAssets.html` to generate new voxel assets
- **Asset Storage**: Assets stored as .vox files in `/public/assets/{type}/`
- **Drag & Drop**: Drag .vox files onto the viewport to import them
- **Asset Editing**: Edit placed assets and save back to the asset library

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
- ✅ **O(1) Operations**: Constant-time voxel lookups and modifications
- ✅ **Batch Rendering**: Single draw call per material type
- ✅ **Dynamic Edge Display**: Wireframe rendering up to 50k voxels

### User Interface
- Professional menu bar with File, Edit, View, and Help menus
- Clean info bar footer showing current tool, stats, and actions
- Real-time performance monitoring (FPS, voxel count, memory usage)
- Tool-specific mouse cursors matching UI icons
- Visual feedback for tool selection and operations
- Keyboard shortcut indicators in menus
- Modal dialogs for file operations
- Voxel panel with type selection and asset popover
- Tilt-shift depth of field effect (toggle with T)
- Layer system for organizing voxel content
- Color picker with multiple palettes (Default, Pastel, Neon)
- Layer thumbnails with real-time preview updates
- Dynamic header icon color matching selected voxel

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
│   │   ├── VoxelLayer.ts    # Layer management system
│   │   ├── ColorRegistry.ts # Dynamic color assignment system
│   │   └── UndoRedoManager.ts # Operation history
│   ├── interaction/
│   │   └── DrawingSystem.ts # Drawing tools and interactions
│   ├── ui/
│   │   ├── VoxelPanel.ts    # UI components and menus
│   │   ├── AssetPopover.ts  # Asset selection popover
│   │   ├── AssetPreviewScene.ts # Isometric asset preview renderer
│   │   ├── LayerPanel.ts    # Layer management UI
│   │   ├── ColorPickerPopover.ts # Color palette selection
│   │   ├── ModalDialog.ts   # Modal dialog system
│   │   ├── Performance.ts   # Performance monitoring
│   │   └── DirectionIndicator.ts # 3D axis helper
│   ├── assets/
│   │   ├── types.ts         # Asset system type definitions
│   │   ├── defaultAssets.ts # Default asset configurations
│   │   └── StaticAssetManager.ts # Asset loading and management
│   ├── io/
│   │   ├── VoxParser.ts     # MagicaVoxel .vox file parser
│   │   ├── VoxWriter.ts     # MagicaVoxel .vox file writer
│   │   └── FileManager.ts   # File import/export handling
│   └── types/
│       └── index.ts         # TypeScript type definitions
├── public/
│   ├── assets/              # Voxel asset library
│   │   ├── grass/           # Grass type assets (trees, flowers)
│   │   ├── stone/           # Stone type assets (rocks, pillars)
│   │   ├── wood/            # Wood type assets (crates, barrels)
│   │   └── leaves/          # Leaves type assets (bushes, hedges)
│   └── createAssets.html    # Asset generation tool
├── devserver.sh             # Development server manager
├── index.html               # HTML entry point
├── package.json             # Project dependencies
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configuration
```

## 🎨 Voxel Types & Assets

### Voxel Types
1. **Grass** - Green terrain blocks
2. **Dirt** - Brown earth blocks
3. **Stone** - Gray rock blocks
4. **Wood** - Brown timber blocks
5. **Leaves** - Green foliage (transparent)
6. **Water** - Blue liquid (transparent)
7. **Sand** - Tan desert blocks
8. **Snow** - White winter blocks
9. **Ice** - Cyan frozen blocks (transparent)

### Default Assets
Each voxel type includes premade structures:

**Grass Assets:**
- Grass Patch (3×1×3) - Flat grass terrain piece
- Small Hill (5×3×5) - Raised grass mound
- Grass Steps (4×3×4) - Terraced grass formation

**Dirt Assets:**
- Dirt Mound (3×2×3) - Small pile of dirt
- Dirt Path (5×1×2) - Long dirt trail
- Dirt Pile (2×2×2) - Compact dirt heap

**Stone Assets:**
- Stone Block (2×2×2) - Solid stone cube
- Stone Wall (4×3×1) - Vertical stone barrier
- Stone Pillar (1×4×1) - Tall stone column

**Wood Assets:**
- Wood Plank (3×1×1) - Horizontal wood beam
- Wood Post (1×3×1) - Vertical wood support
- Wood Floor (3×1×3) - Wooden platform

**Leaves Assets:**
- Leaves Bush (2×2×2) - Dense foliage
- Leaves Hedge (4×2×1) - Horizontal hedge
- Leaves Sphere (3×3×3) - Round topiary

**Water Assets:**
- Water Pool (3×1×3) - Small water basin
- Water Stream (5×1×1) - Flowing water channel
- Water Fall (1×4×1) - Vertical water cascade

**Sand Assets:**
- Sand Dune (4×2×3) - Desert hill formation
- Sand Castle (3×3×3) - Beach castle structure
- Sand Path (3×1×3) - Sandy walkway

**Snow Assets:**
- Snow Pile (3×2×3) - Mound of snow
- Snowman (2×3×2) - Classic snowman figure
- Snow Wall (4×2×1) - Snow barrier

**Ice Assets:**
- Ice Block (2×2×2) - Frozen cube
- Ice Spike (2×4×2) - Pointed ice formation
- Ice Platform (3×1×3) - Frozen surface

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

### UI & Visual Improvements
- **Custom Tool Cursors**: Each tool now displays its matching icon as the cursor
- **Paint Bucket Fix**: Fixed garbled cursor to use proper paint bucket icon
- **Selection Mode Cursor**: Crosshair cursor correctly shows in selection mode
- **Info Bar Footer**: Replaced HUD with clean footer showing tool, stats, and actions
- **Dynamic Header Icon**: Swords icon color matches selected voxel color
- **UI Polish**: Removed blue glow from single voxel button for cleaner look
- **Version Display**: Version number now right-aligned in info bar
- **Multi-Brush Color Support**: Custom colors now work with all brush sizes

### Layer System & Color Management
- **Layer System**: Organize voxels into multiple layers with visibility controls
- **Color Picker**: Multiple color palettes (Default, Pastel, Neon) with tab switching
- **ColorRegistry**: Dynamic color assignment system supporting 256+ unique colors
- **Layer Thumbnails**: Real-time isometric previews for each layer
- **Asset Editing**: Edit placed assets and save them back to the library
- **Drag & Drop**: Import .vox files directly by dragging onto the viewport
- **Modal Dialogs**: Promise-based dialogs replacing browser popups
- **Per-Layer Operations**: Import, export, and clear operations per layer

### Asset System & UI
- **Complete Asset System**: 27 premade structures across all 9 voxel types
- **Asset Preview Thumbnails**: Isometric 3D previews rendered in real-time
- **Voxel Brush Button**: Dedicated button (V key) for single voxel mode with color picker
- **Minimalist Asset Cards**: Clean 40×40px cards matching button dimensions
- **Asset Popover**: Click voxel buttons to show available assets
- **Dynamic Asset Loading**: Lazy-loaded assets with caching
- **VOX Format Support**: All assets stored as MagicaVoxel .vox files

### Drawing & Interaction
- **Zoom While Drawing**: Scroll wheel works during drag operations
- **Dynamic Grid System**: Grid visibility scales with zoom level
- **Ground Plane Protection**: Prevents placing voxels below y=0
- **Preview Color Matching**: Draw preview matches actual voxel colors
- **Smart Edge Brightness**: Darker voxels get brighter edges for visibility
- **Constraint Plane**: Visual grid appears after 300ms hold

### Performance & Technical
- **Asset Preview Scene**: Dedicated rendering system for thumbnails
- **Coordinate System Fix**: Proper VOX to Three.js axis conversion
- **Color Preservation**: Assets maintain declared type colors
- **Memory Efficient**: Preview cache system for thumbnails
- **Batch Operations**: Grouped voxel updates for performance

### Build & Compatibility Fixes
- **TypeScript Build Fixes**: Updated type definitions to use Partial<Record<>> for extensibility
- **Asset System Types**: Added 'modified' property to AssetInfo interface
- **Color Mapping**: Fixed partial record handling in VoxWriter and drawing systems
- **Cloudflare Build**: Resolved all TypeScript errors for successful deployment

### Previous Updates
- **Selection Tool**: Box selection mode for working with regions
- **Performance Optimizations**: O(1) voxel operations, pre-allocated buffers
- **Edge Rendering**: Optimized wireframe display supporting up to 50k voxels
- **Enhanced Zoom**: Increased zoom out range from 0.5x to 0.1x
- **TypeScript Migration**: Full type safety with strict checking
- **UI Overhaul**: Professional menu system with keyboard shortcuts
- **Drawing Tools**: Multiple tools for different building scenarios

## 🎯 Future Enhancements

- [x] Layer system for organizing content
- [x] Multiple color palettes with custom colors
- [x] Asset editing and management
- [ ] Chunk-based infinite world
- [ ] Texture atlas support
- [ ] Ambient occlusion
- [ ] Shadow mapping
- [ ] Multiplayer support
- [ ] VR/AR compatibility
- [ ] Procedural generation
- [ ] Animation system
- [ ] Physics integration
- [ ] Layer operations in undo/redo system
- [ ] Drawing system using active layer

## 📄 License

MIT License - Part of the NeverEverLand project

## 🙏 Credits

- Inspired by [nimadez/voxel-builder](https://github.com/nimadez/voxel-builder)
- Built with [Three.js](https://threejs.org/)
- Developed with [Vite](https://vitejs.dev/) and [TypeScript](https://www.typescriptlang.org/)