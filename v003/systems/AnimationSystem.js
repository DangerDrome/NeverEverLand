import { System } from '../core/System.js';

export class AnimationSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['AnimatorComponent'];
        this.priority = 90; // Run after movement but before render
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const animator = entity.getComponent('AnimatorComponent');
        
        if (!animator.active || !animator.mixer) return;
        
        // Update animation mixer
        animator.mixer.update(deltaTime);
        
        // Handle animation transitions
        if (animator.transitionQueue && animator.transitionQueue.length > 0) {
            const transition = animator.transitionQueue[0];
            transition.progress += deltaTime / transition.duration;
            
            if (transition.progress >= 1) {
                // Transition complete
                animator.transitionQueue.shift();
                animator.currentAnimation = transition.to;
            }
        }
        
        // Update animation based on entity state
        this.updateAnimationState(entity, animator);
    }
    
    updateAnimationState(entity, animator) {
        // Check movement for walk/run animations
        const velocity = entity.getComponent('VelocityComponent');
        if (velocity) {
            const speed = velocity.velocity.length();
            
            if (speed > 0.1) {
                if (speed > 5) {
                    this.playAnimation(animator, 'run');
                } else {
                    this.playAnimation(animator, 'walk');
                }
            } else {
                this.playAnimation(animator, 'idle');
            }
        }
        
        // Check combat state
        const combat = entity.getComponent('CombatComponent');
        if (combat && combat.inCombat) {
            this.playAnimation(animator, 'combat_idle', 0.5);
        }
        
        // Check character state
        const character = entity.getComponent('CharacterComponent');
        if (character && character.stats.currentHealth === 0) {
            this.playAnimation(animator, 'death', 1.0);
        }
    }
    
    playAnimation(animatorComponent, animationName, priority = 0) {
        if (animatorComponent.currentAnimation === animationName) return;
        
        const clip = animatorComponent.animations.get(animationName);
        if (!clip) return;
        
        // Check priority
        const currentPriority = animatorComponent.animationPriorities?.get(
            animatorComponent.currentAnimation
        ) || 0;
        
        if (priority < currentPriority) return;
        
        // Play animation
        const action = animatorComponent.mixer.clipAction(clip);
        
        // Stop current animation
        if (animatorComponent.currentAction) {
            animatorComponent.currentAction.fadeOut(0.5);
        }
        
        // Start new animation
        action.reset();
        action.fadeIn(0.5);
        action.play();
        
        animatorComponent.currentAnimation = animationName;
        animatorComponent.currentAction = action;
    }
    
    stopAnimation(animatorComponent) {
        if (animatorComponent.currentAction) {
            animatorComponent.currentAction.stop();
            animatorComponent.currentAction = null;
            animatorComponent.currentAnimation = null;
        }
    }
    
    setAnimationSpeed(animatorComponent, speed) {
        if (animatorComponent.currentAction) {
            animatorComponent.currentAction.setEffectiveTimeScale(speed);
        }
    }
    
    queueTransition(animatorComponent, toAnimation, duration = 0.5) {
        if (!animatorComponent.transitionQueue) {
            animatorComponent.transitionQueue = [];
        }
        
        animatorComponent.transitionQueue.push({
            from: animatorComponent.currentAnimation,
            to: toAnimation,
            duration: duration,
            progress: 0
        });
    }
}