import { Entity } from './Entity.js';
import { SystemManager } from './System.js';
import { ComponentPool } from './Component.js';

/**
 * World - Main ECS coordinator
 * Manages entities, components, and systems with archetype-based optimization
 */
export class World {
    constructor() {
        this.entities = new Map();
        this.archetypes = new Map(); // Component signature -> Set of entities
        this.componentPools = new Map();
        this.systemManager = new SystemManager(this);
        this.toDestroy = new Set();
        this.queryCache = new Map();
        this.frameCount = 0;
    }
    
    // Entity Management
    createEntity() {
        const entity = Entity.create();
        this.entities.set(entity.id, entity);
        return entity;
    }
    
    destroyEntity(entity) {
        if (typeof entity === 'number') {
            entity = this.entities.get(entity);
        }
        
        if (entity && entity.active) {
            this.toDestroy.add(entity);
        }
    }
    
    getEntity(id) {
        return this.entities.get(id);
    }
    
    // Component Management
    addComponent(entity, component) {
        // Remove from old archetype
        const oldSignature = entity.getComponentSignature();
        this.removeFromArchetype(entity, oldSignature);
        
        // Add component
        entity.addComponent(component);
        
        // Add to new archetype
        const newSignature = entity.getComponentSignature();
        this.addToArchetype(entity, newSignature);
        
        // Invalidate query cache
        this.invalidateQueryCache();
        
        return entity;
    }
    
    removeComponent(entity, componentType) {
        if (!entity.hasComponent(componentType)) {
            return entity;
        }
        
        // Remove from old archetype
        const oldSignature = entity.getComponentSignature();
        this.removeFromArchetype(entity, oldSignature);
        
        // Return component to pool if available
        const component = entity.getComponent(componentType);
        const componentName = typeof componentType === 'string' ? componentType : componentType.name;
        const pool = this.componentPools.get(componentName);
        if (pool && component) {
            pool.release(component);
        }
        
        // Remove component
        entity.removeComponent(componentType);
        
        // Add to new archetype
        const newSignature = entity.getComponentSignature();
        this.addToArchetype(entity, newSignature);
        
        // Invalidate query cache
        this.invalidateQueryCache();
        
        return entity;
    }
    
    // Archetype Management (for performance optimization)
    addToArchetype(entity, signature) {
        if (!this.archetypes.has(signature)) {
            this.archetypes.set(signature, new Set());
        }
        this.archetypes.get(signature).add(entity);
    }
    
    removeFromArchetype(entity, signature) {
        const archetype = this.archetypes.get(signature);
        if (archetype) {
            archetype.delete(entity);
            if (archetype.size === 0) {
                this.archetypes.delete(signature);
            }
        }
    }
    
    // Query System with caching
    query(componentTypes) {
        if (!componentTypes || componentTypes.length === 0) {
            return Array.from(this.entities.values()).filter(e => e.active);
        }
        
        const queryKey = componentTypes.sort().join(',');
        
        // Check cache first
        if (this.queryCache.has(queryKey)) {
            return this.queryCache.get(queryKey);
        }
        
        // Find entities that have all required components
        const matchingEntities = [];
        
        for (const entity of this.entities.values()) {
            if (entity.active && entity.hasComponents(componentTypes)) {
                matchingEntities.push(entity);
            }
        }
        
        // Cache the result
        this.queryCache.set(queryKey, matchingEntities);
        
        return matchingEntities;
    }
    
    invalidateQueryCache() {
        this.queryCache.clear();
    }
    
    // Component Pool Management
    registerComponentPool(ComponentClass, initialSize = 100) {
        const componentName = ComponentClass.name;
        if (!this.componentPools.has(componentName)) {
            this.componentPools.set(componentName, new ComponentPool(ComponentClass, initialSize));
        }
    }
    
    acquireComponent(ComponentClass) {
        const componentName = ComponentClass.name;
        const pool = this.componentPools.get(componentName);
        
        if (pool) {
            return pool.acquire();
        } else {
            return new ComponentClass();
        }
    }
    
    // System Management
    addSystem(system) {
        return this.systemManager.addSystem(system);
    }
    
    removeSystem(systemType) {
        return this.systemManager.removeSystem(systemType);
    }
    
    getSystem(systemType) {
        return this.systemManager.getSystem(systemType);
    }
    
    // Main Update Loop
    update(deltaTime) {
        this.frameCount++;
        
        // Update systems
        this.systemManager.update(deltaTime);
        
        // Clean up destroyed entities
        this.processDestroyedEntities();
        
        // Clear query cache periodically to prevent memory leaks
        if (this.frameCount % 60 === 0) {
            this.invalidateQueryCache();
        }
    }
    
    processDestroyedEntities() {
        for (const entity of this.toDestroy) {
            // Remove from archetype
            const signature = entity.getComponentSignature();
            this.removeFromArchetype(entity, signature);
            
            // Return components to pools
            for (const [componentName, component] of entity.components) {
                const pool = this.componentPools.get(componentName);
                if (pool) {
                    pool.release(component);
                }
            }
            
            // Destroy entity
            entity.destroy();
            this.entities.delete(entity.id);
        }
        
        if (this.toDestroy.size > 0) {
            this.toDestroy.clear();
            this.invalidateQueryCache();
        }
    }
    
    // Performance and Debug Info
    getStats() {
        const archetypeStats = {};
        for (const [signature, entities] of this.archetypes) {
            archetypeStats[signature] = entities.size;
        }
        
        const poolStats = {};
        for (const [name, pool] of this.componentPools) {
            poolStats[name] = {
                active: pool.getActiveCount(),
                pooled: pool.getPoolSize()
            };
        }
        
        return {
            entities: this.entities.size,
            archetypes: this.archetypes.size,
            archetypeStats,
            poolStats,
            systems: this.systemManager.getPerformanceStats(),
            frameCount: this.frameCount,
            queryCacheSize: this.queryCache.size
        };
    }
    
    // Serialization for save/load
    serialize() {
        const entitiesData = [];
        for (const entity of this.entities.values()) {
            if (entity.active) {
                const entityData = {
                    id: entity.id,
                    components: {}
                };
                
                for (const [componentName, component] of entity.components) {
                    entityData.components[componentName] = component.serialize();
                }
                
                entitiesData.push(entityData);
            }
        }
        
        return {
            entities: entitiesData,
            frameCount: this.frameCount
        };
    }
    
    // Clear world
    clear() {
        // Destroy all entities
        for (const entity of this.entities.values()) {
            this.destroyEntity(entity);
        }
        this.processDestroyedEntities();
        
        // Clear all pools
        for (const pool of this.componentPools.values()) {
            pool.releaseAll();
        }
        
        // Reset frame count
        this.frameCount = 0;
    }
}