import { System } from '../core/System.js';
import { 
    AnimatorComponent, 
    TweenComponent, 
    AnimationClip,
    AnimationState 
} from '../components/AnimationComponent.js';
import { TransformComponent } from '../components/TransformComponent.js';

/**
 * Animation System
 * Handles animation playback, tweening, and keyframe interpolation
 */
export class AnimationSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['TransformComponent'];
        this.priority = 12; // Run after input but before physics/rendering
        
        // Animation clips library
        this.clips = new Map(); // Map of clip name -> AnimationClip
        
        // Global animation settings
        this.globalTimeScale = 1.0;
        this.globalPaused = false;
        
        // Performance settings
        this.maxAnimatorsPerFrame = 50; // Limit for performance
        this.maxTweensPerFrame = 100;
        
        // Animation pooling (for performance)
        this.clipPool = new Map();
        this.statePool = [];
        
        // Statistics
        this.stats = {
            activeAnimators: 0,
            activeTweens: 0,
            clipsCached: 0,
            animationEvents: 0,
            frameTime: 0
        };
        
        // Built-in easing functions
        this.easingFunctions = new Map();
        this.initializeEasingFunctions();
        
        console.log('AnimationSystem initialized');
    }
    
    update(deltaTime, entities) {
        if (this.globalPaused) return;
        
        const startTime = performance.now();
        this.resetStats();
        
        const scaledDeltaTime = deltaTime * this.globalTimeScale;
        
        // Update animators
        this.updateAnimators(scaledDeltaTime, entities);
        
        // Update tweens
        this.updateTweens(scaledDeltaTime, entities);
        
        this.stats.frameTime = performance.now() - startTime;
    }
    
    updateAnimators(deltaTime, entities) {
        const animatorEntities = entities.filter(entity => 
            entity.hasComponent('AnimatorComponent')
        );
        
        let processedCount = 0;
        
        for (const entity of animatorEntities) {
            if (processedCount >= this.maxAnimatorsPerFrame) break;
            
            const animator = entity.getComponent('AnimatorComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!animator.isPlaying || animator.isPaused) continue;
            
            this.updateAnimator(animator, transform, deltaTime);
            processedCount++;
        }
        
        this.stats.activeAnimators = processedCount;
    }
    
    updateAnimator(animator, transform, deltaTime) {
        // Update transitions
        if (animator.currentTransition) {
            animator.updateTransition(deltaTime);
        }
        
        // Update current state
        const currentState = animator.getCurrentState();
        if (currentState) {
            this.updateAnimationState(animator, currentState, transform, deltaTime);
        }
        
        // Check for automatic transitions
        animator.checkTransitions();
    }
    
    updateAnimationState(animator, state, transform, deltaTime) {
        // Update animation time
        animator.time += deltaTime * animator.speed * state.speed;
        
        // Handle looping
        if (state.clip && animator.time >= state.clip.duration) {
            if (state.loop) {
                animator.time = animator.time % state.clip.duration;
            } else {
                animator.time = state.clip.duration;
                animator.stop();
            }
        }
        
        // Sample animation clip
        if (state.clip) {
            this.sampleAnimationClip(state.clip, animator.time, transform, animator);
        }
        
        // Fire animation events
        this.checkAnimationEvents(state, animator.time, deltaTime, animator);
    }
    
    sampleAnimationClip(clip, time, transform, animator) {
        // Apply clip to transform
        clip.sample(time, transform);
        
        // Handle blending if in transition
        if (animator.currentTransition) {
            const progress = animator.getTransitionProgress();
            this.blendTransition(animator, transform, progress);
        }
    }
    
    blendTransition(animator, transform, progress) {
        // Simple linear blending between states
        const fromState = animator.states.get(animator.currentTransition.fromState);
        const toState = animator.states.get(animator.currentTransition.toState);
        
        if (!fromState || !toState || !fromState.clip || !toState.clip) return;
        
        // Sample both clips
        const fromTransform = { ...transform };
        const toTransform = { ...transform };
        
        fromState.clip.sample(animator.time, fromTransform);
        toState.clip.sample(0, toTransform); // Start of new animation
        
        // Blend transforms
        this.blendTransforms(transform, fromTransform, toTransform, progress);
    }
    
    blendTransforms(result, from, to, weight) {
        // Blend position
        if (from.position && to.position) {
            result.position.x = from.position.x + (to.position.x - from.position.x) * weight;
            result.position.y = from.position.y + (to.position.y - from.position.y) * weight;
            result.position.z = from.position.z + (to.position.z - from.position.z) * weight;
        }
        
        // Blend rotation (simplified - should use quaternions for proper rotation blending)
        if (from.rotation && to.rotation) {
            result.rotation.x = from.rotation.x + (to.rotation.x - from.rotation.x) * weight;
            result.rotation.y = from.rotation.y + (to.rotation.y - from.rotation.y) * weight;
            result.rotation.z = from.rotation.z + (to.rotation.z - from.rotation.z) * weight;
        }
        
        // Blend scale
        if (from.scale && to.scale) {
            result.scale.x = from.scale.x + (to.scale.x - from.scale.x) * weight;
            result.scale.y = from.scale.y + (to.scale.y - from.scale.y) * weight;
            result.scale.z = from.scale.z + (to.scale.z - from.scale.z) * weight;
        }
        
        result.markDirty();
    }
    
    checkAnimationEvents(state, currentTime, deltaTime, animator) {
        const previousTime = currentTime - deltaTime;
        const events = state.getEventsInRange(previousTime, currentTime);
        
        for (const event of events) {
            if (!event.fired) {
                event.fired = true;
                this.stats.animationEvents++;
                
                if (animator.onAnimationEvent) {
                    animator.onAnimationEvent(event.eventName, event.time, state);
                }
                
                // Reset fired flag for looping
                if (state.loop && currentTime < previousTime) {
                    event.fired = false;
                }
            }
        }
    }
    
    updateTweens(deltaTime, entities) {
        const tweenEntities = entities.filter(entity => 
            entity.hasComponent('TweenComponent')
        );
        
        let totalTweens = 0;
        
        for (const entity of tweenEntities) {
            const tweenComponent = entity.getComponent('TweenComponent');
            
            if (totalTweens >= this.maxTweensPerFrame) break;
            
            tweenComponent.update(deltaTime);
            totalTweens += tweenComponent.getTweenCount();
        }
        
        this.stats.activeTweens = totalTweens;
    }
    
    // Animation Clip Management
    registerClip(name, clip) {
        this.clips.set(name, clip);
        this.stats.clipsCached = this.clips.size;
        return clip;
    }
    
    getClip(name) {
        return this.clips.get(name);
    }
    
    createClip(name, duration = 1) {
        const clip = new AnimationClip(name, duration);
        this.registerClip(name, clip);
        return clip;
    }
    
    // Predefined animation creators
    createMoveAnimation(name, from, to, duration = 1) {
        const clip = this.createClip(name, duration);
        
        clip.addTrack('position', [
            { time: 0, value: from },
            { time: duration, value: to }
        ]);
        
        return clip;
    }
    
    createRotateAnimation(name, fromRotation, toRotation, duration = 1) {
        const clip = this.createClip(name, duration);
        
        clip.addTrack('rotation', [
            { time: 0, value: fromRotation },
            { time: duration, value: toRotation }
        ]);
        
        return clip;
    }
    
    createScaleAnimation(name, fromScale, toScale, duration = 1) {
        const clip = this.createClip(name, duration);
        
        clip.addTrack('scale', [
            { time: 0, value: fromScale },
            { time: duration, value: toScale }
        ]);
        
        return clip;
    }
    
    createBounceAnimation(name, height = 2, duration = 1) {
        const clip = this.createClip(name, duration);
        
        // Create bounce curve using keyframes
        const keyframes = [];
        const bounces = 3;
        
        for (let i = 0; i <= bounces; i++) {
            const t = i / bounces;
            const bounce = Math.pow(1 - t, 2) * height;
            keyframes.push({
                time: t * duration,
                value: { x: 0, y: bounce, z: 0 }
            });
        }
        
        clip.addTrack('position', keyframes);
        return clip;
    }
    
    createSpinAnimation(name, axis = 'y', rotations = 1, duration = 1) {
        const clip = this.createClip(name, duration);
        
        const endRotation = { x: 0, y: 0, z: 0 };
        endRotation[axis] = rotations * Math.PI * 2;
        
        clip.addTrack('rotation', [
            { time: 0, value: { x: 0, y: 0, z: 0 } },
            { time: duration, value: endRotation }
        ]);
        
        return clip;
    }
    
    createPulseAnimation(name, minScale = 0.8, maxScale = 1.2, duration = 0.5) {
        const clip = this.createClip(name, duration);
        
        clip.addTrack('scale', [
            { time: 0, value: { x: 1, y: 1, z: 1 } },
            { time: duration * 0.5, value: { x: maxScale, y: maxScale, z: maxScale } },
            { time: duration, value: { x: minScale, y: minScale, z: minScale } }
        ]);
        
        return clip;
    }
    
    // Helper methods for creating common tweens
    createMoveTween(entity, targetPosition, duration = 1, options = {}) {
        const tweenComponent = entity.getComponent('TweenComponent');
        const transform = entity.getComponent('TransformComponent');
        
        if (!tweenComponent || !transform) return null;
        
        return tweenComponent.to(transform.position, duration, targetPosition, options);
    }
    
    createRotateTween(entity, targetRotation, duration = 1, options = {}) {
        const tweenComponent = entity.getComponent('TweenComponent');
        const transform = entity.getComponent('TransformComponent');
        
        if (!tweenComponent || !transform) return null;
        
        return tweenComponent.to(transform.rotation, duration, targetRotation, options);
    }
    
    createScaleTween(entity, targetScale, duration = 1, options = {}) {
        const tweenComponent = entity.getComponent('TweenComponent');
        const transform = entity.getComponent('TransformComponent');
        
        if (!tweenComponent || !transform) return null;
        
        return tweenComponent.to(transform.scale, duration, targetScale, options);
    }
    
    createFadeTween(entity, targetAlpha, duration = 1, options = {}) {
        const tweenComponent = entity.getComponent('TweenComponent');
        const renderable = entity.getComponent('RenderableComponent');
        
        if (!tweenComponent || !renderable || !renderable.mesh || !renderable.mesh.material) return null;
        
        // Handle different material types
        let material = renderable.mesh.material;
        if (Array.isArray(material)) {
            material = material[0]; // Use first material
        }
        
        if (!material.transparent) {
            material.transparent = true;
        }
        
        return tweenComponent.to(material, duration, { opacity: targetAlpha }, options);
    }
    
    // Sequence and parallel animation builders
    createSequence(entity, animations) {
        // Create a sequence of animations that play one after another
        const tweenComponent = entity.getComponent('TweenComponent');
        if (!tweenComponent) return null;
        
        let currentDelay = 0;
        const tweens = [];
        
        for (const anim of animations) {
            const tween = anim.createTween(entity);
            if (tween) {
                tween.delay(currentDelay);
                currentDelay += anim.duration + (anim.delay || 0);
                tweens.push(tween);
            }
        }
        
        return tweens;
    }
    
    createParallel(entity, animations) {
        // Create animations that play at the same time
        const tweenComponent = entity.getComponent('TweenComponent');
        if (!tweenComponent) return null;
        
        const tweens = [];
        
        for (const anim of animations) {
            const tween = anim.createTween(entity);
            if (tween) {
                tweens.push(tween);
            }
        }
        
        return tweens;
    }
    
    // Easing functions
    initializeEasingFunctions() {
        this.easingFunctions.set('linear', t => t);
        this.easingFunctions.set('ease-in', t => t * t);
        this.easingFunctions.set('ease-out', t => 1 - (1 - t) * (1 - t));
        this.easingFunctions.set('ease-in-out', t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
        
        // Bounce easing
        this.easingFunctions.set('bounce-in', t => 1 - this.easingFunctions.get('bounce-out')(1 - t));
        this.easingFunctions.set('bounce-out', t => {
            if (t < 1 / 2.75) {
                return 7.5625 * t * t;
            } else if (t < 2 / 2.75) {
                return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
            } else if (t < 2.5 / 2.75) {
                return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
            } else {
                return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
            }
        });
        
        // Elastic easing
        this.easingFunctions.set('elastic-in', t => {
            if (t === 0) return 0;
            if (t === 1) return 1;
            return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
        });
        
        this.easingFunctions.set('elastic-out', t => {
            if (t === 0) return 0;
            if (t === 1) return 1;
            return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
        });
        
        // Back easing
        this.easingFunctions.set('back-in', t => {
            const s = 1.70158;
            return t * t * ((s + 1) * t - s);
        });
        
        this.easingFunctions.set('back-out', t => {
            const s = 1.70158;
            return --t * t * ((s + 1) * t + s) + 1;
        });
    }
    
    getEasingFunction(name) {
        return this.easingFunctions.get(name) || this.easingFunctions.get('linear');
    }
    
    // Global controls
    pauseAll() {
        this.globalPaused = true;
    }
    
    resumeAll() {
        this.globalPaused = false;
    }
    
    setGlobalTimeScale(scale) {
        this.globalTimeScale = Math.max(0, scale);
    }
    
    // Animation presets
    createPresetAnimations() {
        // Create common animation presets
        
        // Fade in/out
        this.createClip('fade-in', 0.5).addTrack('opacity', [
            { time: 0, value: 0 },
            { time: 0.5, value: 1 }
        ]);
        
        this.createClip('fade-out', 0.5).addTrack('opacity', [
            { time: 0, value: 1 },
            { time: 0.5, value: 0 }
        ]);
        
        // Scale animations
        this.createClip('scale-in', 0.3).addTrack('scale', [
            { time: 0, value: { x: 0, y: 0, z: 0 } },
            { time: 0.3, value: { x: 1, y: 1, z: 1 } }
        ]);
        
        this.createClip('scale-out', 0.3).addTrack('scale', [
            { time: 0, value: { x: 1, y: 1, z: 1 } },
            { time: 0.3, value: { x: 0, y: 0, z: 0 } }
        ]);
        
        // Slide animations
        this.createClip('slide-up', 0.5).addTrack('position', [
            { time: 0, value: { x: 0, y: -5, z: 0 } },
            { time: 0.5, value: { x: 0, y: 0, z: 0 } }
        ]);
        
        this.createClip('slide-down', 0.5).addTrack('position', [
            { time: 0, value: { x: 0, y: 5, z: 0 } },
            { time: 0.5, value: { x: 0, y: 0, z: 0 } }
        ]);
        
        // Rotation animations
        this.createSpinAnimation('spin-cw', 'y', 1, 1);
        this.createSpinAnimation('spin-ccw', 'y', -1, 1);
        
        // Bounce and pulse
        this.createBounceAnimation('bounce', 2, 1);
        this.createPulseAnimation('pulse', 0.9, 1.1, 0.5);
        
        console.log('Animation presets created');
    }
    
    // Debug and utility methods
    getAnimationInfo(entity) {
        const animator = entity.getComponent('AnimatorComponent');
        const tweenComponent = entity.getComponent('TweenComponent');
        
        const info = {
            hasAnimator: !!animator,
            hasTweens: !!tweenComponent,
            currentState: null,
            isPlaying: false,
            time: 0,
            tweenCount: 0
        };
        
        if (animator) {
            info.currentState = animator.currentState;
            info.isPlaying = animator.isPlaying;
            info.time = animator.time;
        }
        
        if (tweenComponent) {
            info.tweenCount = tweenComponent.getTweenCount();
        }
        
        return info;
    }
    
    resetStats() {
        this.stats.activeAnimators = 0;
        this.stats.activeTweens = 0;
        this.stats.animationEvents = 0;
        this.stats.frameTime = 0;
    }
    
    getStats() {
        return {
            ...this.stats,
            clipsCached: this.clips.size,
            easingFunctions: this.easingFunctions.size
        };
    }
    
    // Cleanup
    dispose() {
        this.clips.clear();
        this.clipPool.clear();
        this.statePool.length = 0;
        this.easingFunctions.clear();
        console.log('AnimationSystem disposed');
    }
}