/**
 * Entity - Unique identifier in the ECS system
 * Entities are just IDs, components hold the data
 */
export class Entity {
    static #nextId = 1;
    
    constructor() {
        this.id = Entity.#nextId++;
        this.components = new Map();
        this.active = true;
    }
    
    static create() {
        return new Entity();
    }
    
    addComponent(component) {
        const componentName = component.constructor.name;
        this.components.set(componentName, component);
        return this;
    }
    
    removeComponent(componentType) {
        const componentName = typeof componentType === 'string' ? componentType : componentType.name;
        return this.components.delete(componentName);
    }
    
    getComponent(componentType) {
        const componentName = typeof componentType === 'string' ? componentType : componentType.name;
        return this.components.get(componentName);
    }
    
    hasComponent(componentType) {
        const componentName = typeof componentType === 'string' ? componentType : componentType.name;
        return this.components.has(componentName);
    }
    
    hasComponents(componentTypes) {
        return componentTypes.every(type => this.hasComponent(type));
    }
    
    destroy() {
        this.active = false;
        this.components.clear();
    }
    
    getComponentSignature() {
        return Array.from(this.components.keys()).sort().join(',');
    }
}