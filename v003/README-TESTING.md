# 🎮 Testing NeverEverLand v003 - Phase 2

## Quick Start

### Option 1: Python Server (Recommended)
```bash
cd /home/danger/Documents/GitHub/NeverEverLand/v003
python3 serve.py
```
Then open: **http://localhost:8000**

### Option 2: Node.js Server
```bash
cd /home/danger/Documents/GitHub/NeverEverLand/v003
npx http-server -p 8000 --cors
```

### Option 3: Any Static Server
Use any static file server that supports CORS and serves `.js` files with correct MIME types.

---

## 🧪 What to Test

### 1. ECS Demo (Default)
- **Component Inspector**: Drag entities, add/remove components
- **Entity Selection**: Click entities in 3D viewport
- **Stress Test**: Create 100 entities with systems
- **Query Test**: Test ECS query performance

### 2. Physics Demo 🔬
Click **"Physics Demo"** button to test:

#### Demo Modes (Press 1-5):
1. **Bouncing Balls** - Auto-spawning physics objects
2. **Collision Test** - Different materials (bouncy, ice, rubber, metal)
3. **Stack Demo** - Box tower knocked down by heavy ball
4. **Force Field** - Objects attracted to center point
5. **Friction Test** - Ramps with different friction coefficients

#### Controls:
- `Space` - Spawn ball at random position
- `Click` - Apply upward impulse to objects
- `G` - Toggle gravity on/off
- `C` - Clear all dynamic objects
- `M` - Next demo mode
- `R` - Reset current mode
- `H` - Show help in console

#### What You'll See:
- **Real collision detection** (AABB, sphere-sphere, plane collision)
- **Physics materials** with different friction/bounce properties
- **Gravity simulation** with realistic falling
- **Force application** and impulse responses
- **Performance optimization** with spatial grid and object sleeping

### 3. Animation Demo 🎬
Click **"Animation Demo"** button to test:

#### Demo Types (Press 1-5):
1. **Basic Tweens** - Position, rotation, scale, opacity, color animations
2. **Animation States** - State machines with transitions (Idle→Walk→Run)
3. **Complex Sequences** - Chained animations with delays
4. **Physics Animation** - Gravity simulation using easing
5. **UI Animations** - Button hovers, panel slides, progress bars

#### Controls:
- `Space` - Pause/Resume all animations
- `↑/↓` - Speed up/down animation playback
- `Click` - Select objects (highlights in yellow)
- `M` - Next demo type
- `R` - Restart current demo
- `H` - Show help in console

#### What You'll See:
- **Smooth tweening** with professional easing curves
- **State machine animations** with automatic transitions
- **Complex sequences** with parallel and sequential animations
- **UI-style animations** for game interfaces
- **Performance monitoring** with animation stats

---

## 🎯 Key Features to Verify

### ECS Architecture
- ✅ **Components are pure data** (no logic)
- ✅ **Systems handle all logic** (no data storage)
- ✅ **Entity is just an ID** with component map
- ✅ **Queries work efficiently** with caching
- ✅ **Component pooling** for performance

### Physics System
- ✅ **Collision Detection**: Multiple shape types
- ✅ **Collision Resolution**: Impulse-based physics
- ✅ **Physics Materials**: Friction, restitution, density
- ✅ **Force System**: Gravity, custom forces, impulses
- ✅ **Performance**: Spatial grid, sleeping objects
- ✅ **Integration**: Works seamlessly with ECS

### Animation System  
- ✅ **Tweening**: Position, rotation, scale, color, opacity
- ✅ **Easing Functions**: Linear, bounce, elastic, back, etc.
- ✅ **State Machines**: Transitions with conditions
- ✅ **Keyframe Animation**: Multi-track timeline support
- ✅ **Sequence Building**: Complex animation chains
- ✅ **Performance**: Global time scaling, pause/resume

### Integration Quality
- ✅ **System Execution Order**: Input → Animation → Physics → Transform → Camera → Rendering
- ✅ **Component Pooling**: Memory optimization for all component types
- ✅ **Clean Separation**: Each system is independent and testable
- ✅ **Easy Demo Switching**: Seamless transitions between test scenarios
- ✅ **Professional UI**: Proper cleanup and error handling

---

## 🐛 Troubleshooting

### CORS Errors
- **Problem**: `Cross origin requests are only supported for protocol schemes...`
- **Solution**: Use a local server (see Quick Start above)
- **Why**: ES6 modules require HTTP/HTTPS, not file:// protocol

### Missing Dependencies
- **Problem**: `THREE is not defined`
- **Solution**: Ensure Three.js loads before our scripts
- **Check**: Look for `three.min.js` in the v003 directory

### Performance Issues
- **Problem**: Low FPS or lag
- **Solution**: Reduce entity count, check browser dev tools
- **Monitor**: Use browser's Performance tab and console stats

### Demo Not Loading
- **Problem**: Demo buttons don't work
- **Solution**: Check browser console for specific errors
- **Debug**: Verify all .js files are accessible via server

---

## 📊 Expected Performance

### Target Metrics:
- **60 FPS** with 50+ physics objects
- **< 16ms** frame time for smooth animation
- **< 1ms** physics collision detection
- **< 0.5ms** animation system update
- **Memory stable** with component pooling

### Browser Compatibility:
- ✅ **Chrome/Edge** - Full support
- ✅ **Firefox** - Full support  
- ✅ **Safari** - Full support (ES6 modules)
- ❌ **IE** - Not supported (ES6 required)

---

## 🎓 Learning Outcomes

After testing, you should understand:

1. **ECS Architecture** - How data and logic separation scales
2. **Physics Integration** - Real-time collision detection and response
3. **Animation Systems** - Professional game animation techniques
4. **Performance Optimization** - Component pooling, spatial partitioning
5. **System Design** - How complex systems work together cleanly

## 🚀 Next Steps

Phase 2 Complete! Ready for:
- **Audio System** - 3D spatial audio
- **Particle System** - Visual effects
- **AI System** - Behavior trees, pathfinding  
- **Networking** - Multiplayer support
- **Content Pipeline** - Asset loading, scene management

---

**Happy Testing!** 🎮✨