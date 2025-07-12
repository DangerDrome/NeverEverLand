import { Component } from '../core/Component.js';

export class AnimatorComponent extends Component {
    constructor() {
        super();
        this.mixer = null;
        this.animations = new Map();
        this.currentAnimation = null;
        this.currentAction = null;
        this.animationPriorities = new Map();
        this.transitionQueue = [];
        this.active = true;
    }
    
    setMixer(mixer) {
        this.mixer = mixer;
    }
    
    addAnimation(name, clip, priority = 0) {
        this.animations.set(name, clip);
        this.animationPriorities.set(name, priority);
    }
    
    removeAnimation(name) {
        this.animations.delete(name);
        this.animationPriorities.delete(name);
    }
    
    serialize() {
        return {
            currentAnimation: this.currentAnimation,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.currentAnimation = data.currentAnimation || null;
        this.active = data.active !== false;
    }
}