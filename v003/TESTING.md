# NeverEverLand v003 - Testing Guide

## Quick Start Testing

### 1. Launch the Demo
```bash
cd /path/to/NeverEverLand/v003
python -m http.server 8000
# Navigate to http://localhost:8000
```

### 2. Basic UI Testing
- **Entity Creation**: Click "Create Entity" button to spawn entities with random components
- **Component Inspector**: Use the right panel to inspect entities and their components
- **Selection**: Click entities in the 3D viewport to select and inspect them
- **Component Toggle**: Click component badges to toggle them on/off

## Phase 3 Component Testing

### PartyComponent Testing
1. **Add Party Component**: Click + button on an entity, repeat until PartyComponent is added
2. **Expected Display**: `PartyComponent (1/3 members, leader: 0)`
3. **Visual Indicator**: 🟡 Yellow component badge
4. **Console Log**: `👥 Added party management component`

### CharacterComponent Testing  
1. **Add Character Component**: Use + button to add CharacterComponent
2. **Expected Display**: `CharacterComponent (Lv.2, HP: 100/120)` (random level 1-5)
3. **Visual Indicator**: 🟢 Green component badge
4. **Console Log**: `⚔️ Added character stats component`
5. **Stats**: Auto-calculates health/mana based on vitality/intelligence stats

### AIComponent Testing
1. **Add AI Component**: Use + button to add AIComponent
2. **Expected Display**: `AIComponent (follow, idle)` (random behavior type)
3. **Visual Indicator**: 🔘 Blue-grey component badge  
4. **Console Log**: `🤖 Added AI component (aggressive)` (shows behavior type)
5. **Behaviors**: follow, guard, patrol, aggressive (randomly assigned)

**Advanced AI Testing:**
- Add **Movement** component to AI entities to see actual movement
- AI entities with "aggressive" behavior will automatically seek and attack nearby entities
- AI entities with "follow" behavior will move toward other entities

### CombatComponent Testing
1. **Add Combat Component**: Use + button to add CombatComponent
2. **Expected Display**: `CombatComponent (ATK: 15, idle)` (random attack 10-30)
3. **Visual Indicator**: 🔴 Red component badge
4. **Console Log**: `⚔️ Added combat component`

**Combat in Action:**
- Create entity with AIComponent (aggressive) + CombatComponent + Movement
- Watch console for: `🗡️ Entity 7 attacks for 18 damage (CRITICAL!)`
- Entities with CharacterComponent will show health decrease

### InventoryComponent Testing
1. **Add Inventory Component**: Use + button to add InventoryComponent
2. **Expected Display**: `InventoryComponent (0/20 items, 45 gold)` (random currency)
3. **Visual Indicator**: 🟣 Purple component badge
4. **Console Log**: `🎒 Added inventory component`

## System Integration Testing

### Party Formation Testing
**Setup:**
1. Create 3 entities
2. Add PartyComponent + CharacterComponent + AIComponent + Movement to each
3. Set different AI behaviors (follow/guard/patrol)

**Expected Behavior:**
- Entities with "follow" AI will move toward party members
- Formation logic calculates positions relative to party leader
- Console shows party coordination updates

### Combat System Testing
**Setup:**
1. Create "Attacker": AIComponent (aggressive) + CombatComponent + Movement + CharacterComponent
2. Create "Target": CharacterComponent + Health

**Expected Behavior:**
```
🤖 AI finding targets within detection radius
🗡️ Entity 5 attacks for 22 damage (CRITICAL!)
💥 Entity 3 takes 22 damage (78/100 HP)
```

### Character Progression Testing
**Setup:**
1. Add CharacterComponent to entity
2. Watch stat display: `CharacterComponent (Lv.3, HP: 85/130)`

**Expected Features:**
- Health/mana calculated from stats (Vitality × 10, Intelligence × 5)
- Attack power from Strength × 2
- Equipment slots ready for future items

## Console Monitoring

Open Browser DevTools (F12) → Console to watch:

### System Loading
```
📦 Loading Phase 2 components for ECS...
✅ Phase 2 components are now available in the ECS inspector
📦 Loading Phase 3 components for ECS...
🎯 Adding Phase 3 systems to ECS...
✅ PartySystem added to ECS
✅ CharacterSystem added to ECS
✅ AISystem added to ECS
✅ CombatSystem added to ECS
✅ InventorySystem added to ECS
```

### Component Activity
```
👥 Added party management component
🤖 Added AI component (patrol)
⚔️ Added combat component
🗡️ Entity 12 attacks for 15 damage
💥 Entity 8 takes 15 damage (85/100 HP)
✨ Status effect poison expired
```

## Debug Hotkeys

- **F1**: Performance stats overlay
- **F3**: Detailed debug info  
- **F4**: DevTools debug panel
- **F8**: Dump world state to console

## Performance Testing

### Entity Stress Test
1. Click "Stress Test" button to create many entities
2. Add various Phase 3 components to stress test systems
3. Monitor FPS in performance overlay (F1)
4. Expected: Stable 60 FPS with 100+ entities

### System Performance
- CharacterSystem: Minimal overhead, processes stats
- AISystem: Most intensive, runs pathfinding and behavior logic
- CombatSystem: Moderate, processes attacks and status effects
- PartySystem: Light, calculates formation positions
- InventorySystem: Minimal, weight calculations

## Advanced Testing Scenarios

### Full Party Combat
1. Create Party Leader: PartyComponent + CharacterComponent + AIComponent (aggressive) + CombatComponent + Movement
2. Create Party Members: CharacterComponent + AIComponent (follow) + CombatComponent + Movement  
3. Create Enemies: CharacterComponent + AIComponent (aggressive) + CombatComponent + Movement
4. Watch party coordination and combat in console

### Character Equipment Test
1. Create entity with CharacterComponent + InventoryComponent
2. Check equipment slots: weapon, armor, accessory (ready for future items)
3. Verify currency and inventory space tracking

## Troubleshooting

### Components Not Appearing
- Ensure Phase 2 and Phase 3 are loaded (check console for "✅ Phase 3 components loaded")
- Refresh page if components don't appear in + dropdown

### AI Not Moving
- Ensure entity has both AIComponent AND Movement component
- AI needs targets to follow/attack - create multiple entities

### No Combat Activity  
- Entities need AIComponent (aggressive) + CombatComponent + Movement
- Targets need CharacterComponent or Health for damage tracking
- Check console for combat messages

## Expected Performance
- **Stable 60 FPS** with 100+ entities
- **Real-time AI** decision making every 0.5 seconds
- **Immediate combat** response and damage calculation
- **Live component** updates in inspector every 1 second

---

**All Phase 3 systems are fully functional and integrated!** 🎉
The ECS engine now supports party-based RPG mechanics with AI, combat, and character progression.