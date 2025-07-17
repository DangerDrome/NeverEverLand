# Camera Rotation Verification

## Dimetric Projection Analysis

The v006 tile editor implements a true dimetric projection using the following parameters:

### Camera Angles
- **Elevation**: arctan(0.5) ≈ 26.565° (0.4636 radians)
- **Azimuth**: 45° (π/4 radians)

### Mathematical Verification

For a proper dimetric projection:
1. The camera elevation angle of arctan(0.5) creates the characteristic 2:1 ratio
2. When viewing a square grid from this angle, it appears as diamonds
3. Horizontal lines appear twice as long as vertical lines on screen

### Implementation Details

The camera setup in `Camera.ts`:
```typescript
const elevation = Math.atan(0.5); // ~26.57 degrees  
const azimuth = Math.PI / 4;      // 45 degrees

// Convert spherical to cartesian coordinates
const height = distance * Math.sin(elevation);
const groundDistance = distance * Math.cos(elevation);
const x = groundDistance * Math.cos(azimuth);
const z = groundDistance * Math.sin(azimuth);
```

### Grid Implementation

The grid was corrected to use square geometry in world space:
- Grid lines run parallel to X and Z axes
- When viewed from the dimetric angle, squares appear as diamonds
- Cell highlights are square planes that appear as diamonds

### Coordinate System

- **Grid Space**: Integer coordinates (0,0), (1,0), etc.
- **World Space**: Grid (0,0) maps to world origin (0,0,0)
- **Cell Centers**: Add 0.5 * cellSize to get center of cell

### Testing

Run with `#debug` hash to see test scene:
- Colored cubes at key positions
- White measurement lines showing 2:1 ratio
- Axis helper showing world orientation

## Common Issues and Solutions

1. **Grid appears as squares instead of diamonds**
   - Ensure camera elevation is arctan(0.5), not 30° or 45°
   - Check that grid is square in world space

2. **Grid doesn't align with objects**
   - Verify coordinate conversions are consistent
   - Grid coords map to cell corners, not centers

3. **Camera controls feel wrong**
   - Pan movement must account for isometric projection
   - Screen X/Y movement affects both world X and Z