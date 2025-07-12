import { System } from '../core/System.js';

export class RenderSystem extends System {
    constructor(world, scene) {
        super(world);
        this.scene = scene;
        this.requiredComponents = ['TransformComponent', 'RenderComponent'];
        this.priority = 100; // Render last
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const transform = entity.getComponent('TransformComponent');
        const render = entity.getComponent('RenderComponent');
        
        if (!render.active || !render.mesh) return;
        
        // Update mesh transform
        render.mesh.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z
        );
        
        render.mesh.rotation.set(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z
        );
        
        render.mesh.scale.set(
            transform.scale.x,
            transform.scale.y,
            transform.scale.z
        );
        
        // Update visibility
        render.mesh.visible = render.visible;
        
        // Update shadow settings
        render.mesh.castShadow = render.castShadow;
        render.mesh.receiveShadow = render.receiveShadow;
        
        // Update render order
        render.mesh.renderOrder = render.renderOrder;
    }
    
    onEntityAdded(entity) {
        if (this.entityMatches(entity)) {
            const render = entity.getComponent('RenderComponent');
            if (render.mesh && !render.mesh.parent) {
                this.scene.add(render.mesh);
            }
        }
    }
    
    onEntityRemoved(entity) {
        if (this.entityMatches(entity)) {
            const render = entity.getComponent('RenderComponent');
            if (render.mesh && render.mesh.parent) {
                this.scene.remove(render.mesh);
            }
        }
    }
    
    entityMatches(entity) {
        return this.requiredComponents.every(comp => entity.hasComponent(comp));
    }
}