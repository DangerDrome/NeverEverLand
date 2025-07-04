/**
 * Base Component class
 * Components are pure data containers with dirty flag optimization
 */
export class Component {
    constructor() {
        this.#dirty = true;
        this.created = performance.now();
    }
    
    #dirty = true;
    
    get isDirty() {
        return this.#dirty;
    }
    
    markDirty() {
        this.#dirty = true;
    }
    
    markClean() {
        this.#dirty = false;
    }
    
    // Override in subclasses for custom serialization
    serialize() {
        const data = {};
        for (const [key, value] of Object.entries(this)) {
            if (!key.startsWith('#') && key !== 'created') {
                data[key] = value;
            }
        }
        return data;
    }
    
    // Override in subclasses for custom deserialization
    deserialize(data) {
        Object.assign(this, data);
        this.markDirty();
    }
    
    // Create a copy of this component
    clone() {
        const ComponentClass = this.constructor;
        const cloned = new ComponentClass();
        cloned.deserialize(this.serialize());
        return cloned;
    }
}

/**
 * Component Pool for memory optimization
 * Reuses component instances to reduce garbage collection
 */
export class ComponentPool {
    constructor(ComponentClass, initialSize = 100) {
        this.ComponentClass = ComponentClass;
        this.pool = [];
        this.active = new Set();
        
        // Pre-allocate components
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new ComponentClass());
        }
    }
    
    acquire() {
        let component;
        if (this.pool.length > 0) {
            component = this.pool.pop();
        } else {
            component = new this.ComponentClass();
        }
        
        this.active.add(component);
        component.markDirty();
        return component;
    }
    
    release(component) {
        if (this.active.has(component)) {
            this.active.delete(component);
            // Reset component to default state
            component.reset?.();
            this.pool.push(component);
        }
    }
    
    releaseAll() {
        for (const component of this.active) {
            component.reset?.();
            this.pool.push(component);
        }
        this.active.clear();
    }
    
    getActiveCount() {
        return this.active.size;
    }
    
    getPoolSize() {
        return this.pool.length;
    }
}