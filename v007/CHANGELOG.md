# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2025-08-21

### Changed
- Standardized version management with centralized version.json
- Added proper changelog following Keep a Changelog format

## [1.2.0] - 2025-08-21

### Added
- Eyedropper tool for color picking
- Normal vector arrow visualization with hover effects
- Arrowhead indicators for normal direction

### Fixed
- Selection tool raycast blocking issues
- Single voxel selection getting stuck
- Camera tumbling during voxel transformation
- Box selection dragging functionality
- Normal arrow visibility at grazing angles

## [1.1.0] - 2025-08-19

### Added
- Undo/redo functionality with layer management
- Rotation functionality in BoxSelectionTool
- Fill tool improvements
- Box tool functionality in drawing system

### Changed
- Improved drawing system with consistent grid-snapped preview behavior
- Enhanced shadow settings for better visual quality
- Updated TransformGizmo colors for improved visual feedback

### Fixed
- TypeScript build errors for Cloudflare deployment
- Selection persistence during duplication

## [1.0.0] - 2025-08-18

### Added
- Comprehensive test suite for voxel baking system
- Enhanced drawing and selection tools
- Rotation functionality to TransformGizmo

### Changed
- Improved gizmo visibility and interaction handling

## [0.9.0] - 2025-08-16

### Added
- 2D fill selection tool
- Screen space selection
- ToolsPanel for improved tool management
- DirectionIndicator improvements

### Changed
- Enhanced selection tools and UI interactions
- Updated asset management to use Partial types
- Improved UI consistency with updated styles

### Fixed
- Asset popover dimensions and visibility

## [0.8.0] - 2025-08-15

### Added
- ToolsPanel for tool management
- WebFetch permission for blog.coding.kiwi
- Comprehensive test coverage for voxel baking

### Changed
- Enhanced asset management with Partial types
- Improved color handling in VoxWriter and DrawingSystem

## [0.7.0] - 2025-08-14

### Added
- MenuBar with comprehensive menu functionality
- ActionLogger for tracking user actions
- ColorRegistry for dynamic color management
- VoxelLayer system
- ColorPickerPopover
- LayerPanel for layer management
- ModalDialog for UI interactions
- Camera rotation tracking
- Asset preview with glow effect
- Eraser tool with glow effect
- Dynamic axis visibility based on camera angle
- Y-axis with dynamic visibility

### Changed
- Enhanced cursor management in DrawingSystem
- Improved axis colors to bright variants
- Enhanced grid update logic for responsiveness

### Fixed
- Various UI improvements and fixes

## [0.6.0] - 2025-08-12

### Added
- Dynamic grid system for improved visibility
- Performance monitoring and object pooling
- Batch update system for voxel engine
- Axis lines with glowing effects
- Selection management (select all, invert, copy, cut, paste)
- Constrained drawing positions
- Grid alignment to voxel edges

### Changed
- Enhanced camera zoom functionality with manual control
- Updated drawing system to use actual voxel colors
- Optimized shadow settings for quality and performance
- Increased voxel edge rendering limit to 50,000
- Improved ray-plane intersection logic

### Fixed
- Grid rendering alignment
- Ground Y position alignment with voxels
- Z-fighting issues in preview rendering

## [0.5.0] - 2025-08-11

### Added
- BoxSelectionTool with transform capabilities
- TransformGizmo with constant screen size during zoom
- Tilt-shift post-processing effect
- VoxelEngine with edge display toggle
- Selection change recording in UndoRedoManager

### Changed
- Enhanced gizmo visibility and interaction
- Camera settings with negative near plane to prevent clipping

### Fixed
- Selection transparency restoration after dragging
- Original voxel restoration after transformations

## [0.4.0] - 2025-07-28

### Added
- VoxelApp with THREE.js integration
- Core VoxelEngine and VoxelRenderer
- Basic undo/redo functionality
- Orthographic camera setup

### Changed
- Improved zoom speed settings
- Enhanced editor state management

## [0.3.0] - 2025-07-22

### Added
- TypeScript Tile Editor (v006)
- Smooth camera transitions with animated rotation
- Tile placement with drag-and-drop
- Camera rotation and elevation adjustments
- Menu bar and replace mode functionality
- Undo/redo in TileEditor
- Tile size adjustments
- Mobile touch event handling

### Changed
- Enhanced tile placement with stack direction
- Improved touch event handling for drawing and panning
- Mobile layout optimizations

### Fixed
- Mobile touch event handling issues
- Panel dragging on mobile devices

## [0.2.0] - 2025-07-12

### Added
- v005 Hybrid Voxel/Tile System
- HybridVoxelWorld with dual-resolution voxels
- TileMapSystem for grid-based tile placement
- VoxelWorld core engine
- L-System procedural tree generation
- StyleUI framework integration

### Changed
- Enhanced documentation for v003 with modular architecture guidelines
- Integrated VoxelWorld with GameEngine
- Enhanced tile rendering with random heights

## [0.1.0] - 2025-07-05

### Added
- v003 Entity Component System (ECS) architecture
- Phase 3: Party, Character, AI, Combat, Inventory systems
- Phase 4: World Building Systems
- Phase 5: Advanced Gameplay Systems
- Phase 6: Complete GUI System
- Phase 7: Core gameplay loop

### Changed
- Strict modular architecture (no code in index.html)
- Complete ECS implementation with 7 phases

## [0.0.2] - 2025-07-04

### Added
- v002 functional approach
- Wave Function Collapse (WFC) terrain generation
- Player movement system
- Minimap functionality
- FPS counter
- Pixel grid overlay
- Larger grid (224x224) with instanced rendering

### Changed
- Refactored TileGrid to use instanced meshes
- Added render order for proper layering

## [0.0.1] - 2025-07-03

### Added
- Initial commit
- v001 class-based architecture
- IsometricCamera with orthographic projection
- TileGrid system
- CameraControls (WASD/arrows, mouse wheel)
- PixelationEffect post-processing
- Basic Three.js setup and project structure