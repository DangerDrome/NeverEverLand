# NeverEverLand v003 - ECS Game Engine

A state-of-the-art Entity Component System (ECS) game engine built for the NeverEverLand RPG project. This version represents a complete architectural overhaul featuring modular design, hot reload capabilities, and cutting-edge optimization techniques.

## 🚀 Quick Start

1. **Local Development Server** (recommended):
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx serve
   
   # PHP
   php -S localhost:8000
   ```

2. **Open in Browser**:
   Navigate to `http://localhost:8000/v003/` to access the integrated ECS demo

## 🏗️ Architecture Overview

### Core ECS Foundation
- **Archetype-based ECS**: Cache-friendly component storage with O(1) operations
- **Component Pooling**: Eliminates garbage collection pressure
- **Spatial Partitioning**: Efficient collision detection and culling
- **Query Caching**: Optimized component queries with dirty tracking

### Phase 1 Systems (Implemented)
- **TransformSystem**: Position, rotation, scale with matrix caching
- **RenderingSystem**: Three.js integration with frustum culling and LOD
- **MovementSystem**: Entity movement with boundary collision
- **VisualSystem**: Dynamic material properties and effects
- **LifetimeSystem**: Entity lifecycle management
- **HealthSystem**: Health-based visual feedback

### Phase 2 Systems (Implemented)
- **PhysicsSystem**: Gravity, forces, collision detection, and dynamics
- **AnimationSystem**: Tweening, state machines, and complex sequences

## 🎮 Integrated ECS Demo

The main demo (`index.html`) showcases all ECS functionality in one unified interface:

### Entity Management
- **Create Entity**: Add new entities with random components
- **Component Inspector**: Add/remove any component via + button
- **Real-time Updates**: Watch component values change live
- **Selection System**: Click entities to inspect and visualize

### Available Components
- **Core**: Transform, Renderable, Movement, Health, Lifetime, VisualComponent
- **Physics**: RigidbodyComponent, BoxColliderComponent, SphereColliderComponent, PhysicsMaterialComponent  
- **Animation**: TweenComponent, AnimatorComponent

### Features
- **Physics Simulation**: Gravity, bouncing, collision detection with ground
- **Component Visualization**: Wireframe colliders, animation helpers
- **Performance Monitoring**: Real-time stats and entity counts
- **Component Activation**: Toggle components on/off to see effects

## 🛠️ Development Tools

### Debug Hotkeys
- `F1`: Toggle performance stats overlay
- `F3`: Toggle detailed debug info
- `F4`: Toggle DevTools debug panel
- `F5`: Reload current demo
- `F6`: Toggle performance graph
- `F7`: Component inspector
- `F8`: Dump world state to console
- `ESC`: Return to demo selector

### Performance Monitoring
Real-time tracking of:
- Frame rate (FPS) with min/max
- Frame time and system performance
- Entity counts and archetype usage
- Draw calls and triangle counts
- Memory usage and component pools

### Component Inspector
- Live entity component viewing
- Real-time property updates
- Serialization debugging
- Component state inspection

## 📊 Performance Targets

- **60 FPS**: Stable with 1000+ entities
- **<1ms**: Core system update times
- **<100ms**: Scene transition loading
- **Sub-frame**: Hot reload response time

## 🏃‍♂️ Optimization Features

### Memory Management
- **Object Pooling**: Pre-allocated component instances
- **Sparse Sets**: O(1) component operations
- **Cache-Friendly Layout**: Structure of Arrays (SOA)
- **Garbage Collection**: Minimized allocations

### Rendering Pipeline
- **Frustum Culling**: Octree spatial partitioning
- **GPU Instancing**: Batch similar objects
- **LOD System**: Distance-based detail reduction
- **Material Batching**: Reduced draw calls

### Spatial Optimization
- **Spatial Grid**: Fast neighbor queries
- **Hierarchical Transforms**: Parent-child relationships
- **Dirty Flags**: Only update changed components
- **Query Caching**: Efficient component lookups

## 🔧 Technical Implementation

### ECS Architecture
```javascript
// Entity creation
const entity = world.createEntity();

// Component management
const transform = world.acquireComponent(TransformComponent);
transform.setPosition(x, y, z);
world.addComponent(entity, transform);

// System queries
const entities = world.query(['TransformComponent', 'RenderableComponent']);
```

### Component Types
- **TransformComponent**: Position, rotation, scale, velocity
- **RenderableComponent**: Mesh, material, LOD, visibility
- **CameraComponent**: Projection, following, viewport
- **LightComponent**: Type, color, shadows, range
- **InputComponent**: Mappings, commands, contexts

### System Architecture
- **Priority-based execution**: Systems run in dependency order
- **Fixed timestep**: Stable physics and animation
- **Performance tracking**: Built-in profiling
- **Hot-swappable**: Live system replacement

## 🎯 Roadmap

### Phase 2: Party & Character Systems (Planned)
- Party management and AI
- Character switching and coordination
- Combat system foundation
- Animation system

### Phase 3: World Building (Planned)
- Village construction system
- Resource management
- Economy simulation
- Save/load system

### Phase 4: Advanced Gameplay (Planned)
- Quest system
- Dialogue trees
- Puzzle mechanics
- Boss encounters

## 🧪 Testing & Debugging

### Performance Testing
- Entity stress tests (1000+ entities)
- Component query benchmarks
- Memory usage profiling
- Rendering performance metrics

### Debug Features
- Real-time component editing
- Entity selection and inspection
- System performance graphs
- World state serialization

## 🔄 Hot Reload System

Currently supports:
- Page refresh-based reloading
- State preservation in localStorage
- Development server integration
- Error recovery and reporting

## 📱 Browser Support

**Requirements:**
- WebGL 2.0 support
- ES2020 modules
- Modern JavaScript features

**Tested on:**
- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## 🚨 Error Handling

- Comprehensive error boundaries
- Development-friendly error messages
- Automatic error reporting overlay
- Graceful degradation for unsupported features

## 📈 Performance Monitoring

Built-in metrics include:
- FPS and frame time tracking
- System execution profiling
- Memory usage monitoring
- Component pool statistics
- Query cache efficiency

## 🎨 Visual Features

- Isometric dimetric projection (26.57° elevation)
- Dynamic shadows and lighting
- Post-processing pipeline ready
- Pixel-perfect rendering support
- Material and texture management

## 📚 Documentation

- Complete API documentation in code
- Architecture diagrams in GameEngine.md
- Performance optimization guide
- Component and system examples

---

**Next Steps**: Continue with Phase 2 implementation (Party & Character Systems) or explore the existing demos to understand the engine capabilities.

**Performance Notes**: This engine is designed for scalability - it can handle simple prototypes today and complex RPG systems tomorrow, all while maintaining 60fps performance.