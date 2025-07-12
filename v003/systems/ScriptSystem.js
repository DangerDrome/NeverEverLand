import { System } from '../core/System.js';

export class ScriptSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['ScriptComponent'];
        this.priority = 50;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const script = entity.getComponent('ScriptComponent');
        
        if (!script.active) return;
        
        script.update(entity, deltaTime);
    }
}