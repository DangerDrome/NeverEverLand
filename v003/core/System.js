/**
 * Base System class
 * Systems contain logic and operate on entities with specific components
 */
export class System {
    constructor(world) {
        this.world = world;
        this.enabled = true;
        this.priority = 0;
        this.requiredComponents = [];
        this.updateTime = 0;
        this.frameCount = 0;
    }
    
    // Override in subclasses to specify required components
    getRequiredComponents() {
        return this.requiredComponents;
    }
    
    // Main update method - override in subclasses
    update(deltaTime, entities) {
        // Base implementation does nothing
    }
    
    // Called when system is added to world
    onAdded() {
        // Override in subclasses
    }
    
    // Called when system is removed from world
    onRemoved() {
        // Override in subclasses
    }
    
    // Called when an entity with required components is added
    onEntityAdded(entity) {
        // Override in subclasses
    }
    
    // Called when an entity with required components is removed
    onEntityRemoved(entity) {
        // Override in subclasses
    }
    
    // Query entities with specific components
    query(componentTypes) {
        return this.world.query(componentTypes);
    }
    
    // Create a new entity
    createEntity() {
        return this.world.createEntity();
    }
    
    // Destroy an entity
    destroyEntity(entity) {
        this.world.destroyEntity(entity);
    }
    
    // Performance tracking
    startFrame() {
        this.frameStart = performance.now();
    }
    
    endFrame() {
        if (this.frameStart) {
            const frameTime = performance.now() - this.frameStart;
            this.updateTime = this.updateTime * 0.9 + frameTime * 0.1; // Moving average
            this.frameCount++;
        }
    }
    
    getAverageFrameTime() {
        return this.updateTime;
    }
    
    enable() {
        this.enabled = true;
    }
    
    disable() {
        this.enabled = false;
    }
}

/**
 * System Manager
 * Handles system registration, ordering, and execution
 */
export class SystemManager {
    constructor(world) {
        this.world = world;
        this.systems = new Map();
        this.sortedSystems = [];
        this.needsSort = false;
    }
    
    addSystem(system) {
        const systemName = system.constructor.name;
        if (this.systems.has(systemName)) {
            console.warn(`System ${systemName} already exists`);
            return;
        }
        
        this.systems.set(systemName, system);
        this.needsSort = true;
        system.onAdded();
        return system;
    }
    
    removeSystem(systemType) {
        const systemName = typeof systemType === 'string' ? systemType : systemType.name;
        const system = this.systems.get(systemName);
        
        if (system) {
            system.onRemoved();
            this.systems.delete(systemName);
            this.needsSort = true;
        }
        
        return system;
    }
    
    getSystem(systemType) {
        const systemName = typeof systemType === 'string' ? systemType : systemType.name;
        return this.systems.get(systemName);
    }
    
    update(deltaTime) {
        if (this.needsSort) {
            this.sortSystems();
            this.needsSort = false;
        }
        
        for (const system of this.sortedSystems) {
            if (system.enabled) {
                system.startFrame();
                
                const entities = this.world.query(system.getRequiredComponents());
                system.update(deltaTime, entities);
                
                system.endFrame();
            }
        }
    }
    
    sortSystems() {
        this.sortedSystems = Array.from(this.systems.values())
            .sort((a, b) => a.priority - b.priority);
    }
    
    // Get performance statistics
    getPerformanceStats() {
        const stats = {};
        for (const [name, system] of this.systems) {
            stats[name] = {
                averageFrameTime: system.getAverageFrameTime(),
                frameCount: system.frameCount,
                enabled: system.enabled,
                priority: system.priority
            };
        }
        return stats;
    }
    
    // Enable/disable all systems
    setEnabled(enabled) {
        for (const system of this.systems.values()) {
            if (enabled) {
                system.enable();
            } else {
                system.disable();
            }
        }
    }
}