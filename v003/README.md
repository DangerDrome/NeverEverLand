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

### Phase 3 Systems (Implemented)
- **PartySystem**: Formation management, member coordination, leader switching
- **CharacterSystem**: Stats, leveling, health/mana, equipment processing
- **AISystem**: Behavior processing (follow, guard, patrol, aggressive) and pathfinding
- **CombatSystem**: Damage calculation, combat state management, status effects
- **InventorySystem**: Item management, weight calculations, currency tracking

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
- **Party & Character**: PartyComponent, CharacterComponent, AIComponent, CombatComponent, InventoryComponent
- **World Building**: VillageComponent, BuildingComponent, ResourceComponent, WorkerComponent, EconomyComponent

### Features
- **Physics Simulation**: Gravity, bouncing, collision detection with ground
- **Party Management**: 3-member parties with leader switching and formation control
- **AI Behaviors**: Follow, guard, patrol, and aggressive AI with automatic target detection
- **Combat System**: Real-time combat with damage calculation, critical hits, and status effects
- **Character Progression**: Leveling system with stat growth and equipment slots
- **Inventory Management**: 20-slot inventory with weight limits and currency tracking
- **Village Management**: Population control, morale tracking, and building coordination
- **Resource System**: Wood, stone, food, and gold with capacity limits and generation
- **Economy Simulation**: Market prices, trade values, and currency fluctuations
- **Worker Management**: Job assignments, productivity levels, and skill progression
- **Building System**: Construction mechanics, upgrade levels, and building types
- **Component Visualization**: Complete visual debugging system with real-time component state visualization
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

### Visual Component Debugging
- **Interactive Selection**: Click entities in 3D viewport to select and inspect
- **Real-time Visualization**: Each component type has distinct 3D visual indicators
- **Component Toggling**: Click components in inspector to toggle on/off with immediate visual feedback
- **State Synchronization**: Component active/inactive states sync between inspector and viewport
- **Visual Indicators**: Color-coded representations for all component types:
  - Physics: Wireframe collision shapes (spheres, boxes)
  - Animation: Animated helpers (pulsing rings, rotating shapes)
  - Party: Crown indicators for leadership
  - Character: Health bars and level indicators
  - AI: Behavior-specific colored spheres with unique animations
  - Combat: Attack range visualization
  - Inventory: Bag indicators that scale with content

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

### Phase 3: Party & Character Systems (✅ COMPLETED)
- ✅ Party management with 3-member parties and formation control
- ✅ AI system with follow, guard, patrol, and aggressive behaviors
- ✅ Character progression with stats, leveling, and equipment
- ✅ Real-time combat system with damage calculation and status effects
- ✅ Inventory management with 20 slots, weight limits, and currency

### Phase 4: World Building Systems (✅ COMPLETED)
- ✅ Village management with population, morale, and building coordination
- ✅ Complete resource system with wood, stone, food, and gold management
- ✅ Economy simulation with market prices, trade values, and currency tracking
- ✅ Worker system with job assignments, productivity, and skill progression
- ✅ Building system with construction mechanics and upgrade levels

### Phase 5: Advanced Gameplay (Planned)
- Quest system with objectives and dependencies
- Dialogue trees and NPC interactions
- Puzzle mechanics and interactive elements
- Boss encounters with complex mechanics

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

**Next Steps**: Continue with Phase 5 implementation (Quest Systems, Dialogue, NPCs, Events) or test the complete Phase 1-4 feature set including party management, AI, combat, villages, resources, and economy in the integrated demo.

**Performance Notes**: This engine is designed for scalability - it can handle simple prototypes today and complex RPG systems tomorrow, all while maintaining 60fps performance.