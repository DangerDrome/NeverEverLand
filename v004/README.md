# v004 - 3D to Pixel Art Renderer

A comprehensive Three.js demo showcasing real-time transformation of 3D scenes into pixel art aesthetics with extensive customization options.

## Features

### Core Rendering
- **Dimetric Camera**: True isometric projection (26.57°/45° angles)
- **Multi-pass Rendering**: Separate color, normal, and depth passes
- **Low-resolution Rendering**: Authentic pixel art at customizable resolutions
- **Pixel-perfect Scaling**: Integer scaling with nearest-neighbor filtering
- **Temporal Effects**: Frame blending and temporal offset for smooth animations
- **Camera Controls**: Full tilt, rotation, roll, and zoom control

### Dithering System
- **9 Noise Methods**:
  - Interleaved Gradient Noise (IGN)
  - Blue Noise approximation
  - White Noise
  - Bayer 4x4 and 8x8 matrices
  - Void & Cluster
  - Triangle distribution
  - Checkerboard
  - Halftone
  - Roberts Cross
- **Advanced Dithering**:
  - Adaptive dithering based on local contrast
  - Per-channel RGB dithering
  - Error diffusion (Floyd-Steinberg approximation)
  - Blend modes (Normal, Multiply, Overlay, Screen)
  - Pattern rotation and scaling
- **Gradient-aware Dithering**: Automatically detects and handles gradients
- **Adjustable Intensity**: Fine-tune the dithering effect

### Edge Detection
- **Multiple Methods**:
  - Sobel operator (color-based)
  - Depth-based edges
  - Normal-based edges
- **Customizable**: Threshold, color, and method selection

### Normal Shading
- **Shading Models**:
  - Lambert (classic diffuse)
  - Toon (cell shading)
  - Fresnel (rim lighting)
- **1-bit Dithering**: Apply dithering to lighting for retro shading

### Color Systems
- **Color Depth**: 2, 4, 8, 16, or 32 colors
- **Preset Palettes**:
  - Game Boy (4 shades of green)
  - CGA (4 colors)
  - PICO-8 (16 colors)
  - NES (4 colors)
  - ZX Spectrum (8 colors)
- **Color Enhancement**:
  - Saturation control
  - Contrast adjustment
  - Brightness control
  - Hue shifting
  - Temperature adjustment

### Advanced Lighting
- **Multiple Light Sources**:
  - 2 Directional lights with color and intensity control
  - 1 Point light with radius attenuation
  - Ambient light with adjustable color/intensity
- **Lighting Models**:
  - Phong shading
  - Blinn-Phong shading
  - Simplified PBR (Physically Based Rendering)
- **Advanced Features**:
  - Screen-space ambient occlusion (SSAO)
  - Specular highlights with power control
  - Metallic and roughness material properties
  - Emissive materials with color/intensity

### Material Properties
- **PBR-style Controls**:
  - Metallic (0-1): Controls reflectivity and color
  - Roughness (0-1): Controls specular spread
  - Emission: Self-illuminating materials
- **Per-material Adjustments**: Different properties for each object

### Post-Processing Effects
- **Vignette**: Darkened corners with intensity control
- **Scanlines**: CRT monitor effect
- **Chromatic Aberration**: Color fringing effect
- **Bloom**: Glow effect for bright areas (planned)

### Scene Variety
- **Geometric Shapes**: Basic primitives with gradient sphere
- **Terrain**: Procedural landscape with trees
- **Character**: Simple humanoid figure
- **Architecture**: Buildings and structures

### Export & Presets
- **Export Options**:
  - Screenshots: Full resolution or pixel-perfect exports
  - GIF Recording: Capture animations (basic implementation)
  - Sprite Sheets: Export rotation sequences as sprite sheets
  - Palette Export: Save palettes in .pal format
  - GIMP Palette: Export palettes in GIMP .gpl format
- **Preset System**: Save/load custom configurations
- **20 Built-in Presets**:
  - **Default**: Balanced settings for general use
  - **Game Boy**: Classic green monochrome
  - **1-bit**: Pure black & white dithering
  - **CGA**: 4-color PC graphics
  - **Pixel Perfect**: High quality pixel art
  - **Manga Style**: Halftone patterns with toon shading
  - **Retro Terminal**: Green phosphor monitor look
  - **PC-98**: Japanese computer aesthetic
  - **Newspaper**: Halftone print style
  - **Obra Dinn**: Inspired by Return of the Obra Dinn
  - **Watercolor**: Soft, artistic rendering
  - **Arcade**: Bright colors with toon shading
  - **ASCII Art**: Ultra-low resolution
  - **Film Noir**: High contrast with rim lighting
  - **Crosshatch**: Artistic pen & ink style
  - **VHS**: Analog video aesthetic
  - **Blueprint**: Technical drawing style
  - **Thermal**: Heat vision effect
  - **Matrix**: Green digital rain aesthetic

### Performance
- **Real-time Stats**: FPS, draw calls, triangles, render resolution
- **Optimized Pipeline**: Efficient multi-pass rendering
- **Adaptive Quality**: Scales well across devices

## Controls

### Keyboard
- **Mouse**: Look around
- **Scroll**: Zoom in/out

### GUI Controls
- **Pixel Scale**: 1-8x resolution reduction
- **Dither Intensity**: 0-100% effect strength
- **Color Depth**: Bit depth simulation
- **Noise Method**: Various dithering patterns
- **Edge Detection**: Toggle and configure edge rendering
- **Normal Shading**: Lighting effects with optional dithering
- **Color Palette**: Retro color schemes
- **Scene**: Switch between test scenes
- **Animation**: Toggle object rotation

## Technical Details

### Rendering Pipeline
1. Scene rendered to low-resolution target
2. Normal pass for shading information
3. Depth pass for edge detection
4. Combined in shader with:
   - Pixelation
   - Color quantization/palette mapping
   - Dithering
   - Normal-based shading
   - Edge detection overlay

### Shader Features
- Gradient detection using neighbor sampling
- Multiple dithering algorithms
- Palette-based color mapping
- Temporal stability (no flickering)
- Branchless GPU optimization

## Usage

1. Open `index.html` in a modern browser
2. Use the GUI to experiment with settings
3. Try different presets for quick looks
4. Save your own presets for later use
5. Export screenshots at any resolution

## Browser Requirements
- WebGL 2.0 support
- ES6 JavaScript
- Modern browser (Chrome 80+, Firefox 75+, Safari 13+)

## Performance Tips
- Lower pixel scale for better performance
- Disable edge detection on slower devices
- Use simpler noise methods (Bayer, Checker) for speed
- Reduce scene complexity when needed

## Credits
Built with Three.js r158 and dat.GUI
Inspired by classic pixel art games and modern retro aesthetics