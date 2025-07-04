import { Component } from '../core/Component.js';

/**
 * Animator Component
 * Manages animation state machines and transitions
 */
export class AnimatorComponent extends Component {
    constructor() {
        super();
        
        // Animation states
        this.states = new Map(); // Map of state name -> AnimationState
        this.currentState = null;
        this.defaultState = null;
        this.previousState = null;
        
        // Transition system
        this.transitions = new Map(); // Map of (fromState, toState) -> Transition
        this.currentTransition = null;
        this.transitionTime = 0;
        this.transitionDuration = 0;
        
        // Playback control
        this.isPlaying = true;
        this.isPaused = false;
        this.speed = 1.0; // Global animation speed multiplier
        this.time = 0; // Current animation time
        
        // Blending
        this.blendMode = 'override'; // 'override', 'additive', 'blend'
        this.blendWeight = 1.0;
        
        // Events
        this.onStateEnter = null; // Callback: (stateName, prevState) => {}
        this.onStateExit = null;  // Callback: (stateName, nextState) => {}
        this.onAnimationEvent = null; // Callback: (eventName, time, state) => {}
        
        // Layer system (for multiple animation layers)
        this.layers = new Map(); // Map of layer name -> AnimationLayer
        this.activeLayer = 'default';
        
        // Root motion
        this.applyRootMotion = false;
        this.rootMotionNode = null; // Which bone/node drives root motion
    }
    
    addState(name, animationClip, isDefault = false) {
        const state = new AnimationState(name, animationClip);
        this.states.set(name, state);
        
        if (isDefault || this.states.size === 1) {
            this.defaultState = name;
            if (!this.currentState) {
                this.currentState = name;
            }
        }
        
        this.markDirty();
        return state;
    }
    
    addTransition(fromState, toState, condition = null, duration = 0.3) {
        const key = `${fromState}->${toState}`;
        const transition = new AnimationTransition(fromState, toState, condition, duration);
        this.transitions.set(key, transition);
        return transition;
    }
    
    play(stateName = null, fadeTime = 0) {
        if (stateName && this.states.has(stateName)) {
            if (fadeTime > 0 && this.currentState !== stateName) {
                this.startTransition(stateName, fadeTime);
            } else {
                this.setState(stateName);
            }
        }
        
        this.isPlaying = true;
        this.isPaused = false;
        this.markDirty();
    }
    
    stop() {
        this.isPlaying = false;
        this.time = 0;
        this.markDirty();
    }
    
    pause() {
        this.isPaused = true;
        this.markDirty();
    }
    
    resume() {
        this.isPaused = false;
        this.markDirty();
    }
    
    setState(stateName) {
        if (!this.states.has(stateName)) return false;
        
        const prevState = this.currentState;
        this.previousState = prevState;
        this.currentState = stateName;
        this.time = 0;
        
        // Fire events
        if (this.onStateExit && prevState) {
            this.onStateExit(prevState, stateName);
        }
        if (this.onStateEnter) {
            this.onStateEnter(stateName, prevState);
        }
        
        this.markDirty();
        return true;
    }
    
    startTransition(toState, duration) {
        if (!this.states.has(toState)) return false;
        
        this.currentTransition = {
            fromState: this.currentState,
            toState: toState,
            duration: duration,
            time: 0
        };
        
        this.transitionTime = 0;
        this.transitionDuration = duration;
        
        this.markDirty();
        return true;
    }
    
    updateTransition(deltaTime) {
        if (!this.currentTransition) return;
        
        this.transitionTime += deltaTime;
        this.currentTransition.time = this.transitionTime;
        
        if (this.transitionTime >= this.transitionDuration) {
            // Transition complete
            this.setState(this.currentTransition.toState);
            this.currentTransition = null;
            this.transitionTime = 0;
            this.transitionDuration = 0;
        }
        
        this.markDirty();
    }
    
    getCurrentState() {
        return this.states.get(this.currentState);
    }
    
    getTransitionProgress() {
        if (!this.currentTransition) return 0;
        return Math.min(this.transitionTime / this.transitionDuration, 1);
    }
    
    setFloat(paramName, value) {
        // Set animation parameter (for conditions)
        if (!this.parameters) this.parameters = new Map();
        this.parameters.set(paramName, value);
        this.checkTransitions();
    }
    
    setBool(paramName, value) {
        if (!this.parameters) this.parameters = new Map();
        this.parameters.set(paramName, value);
        this.checkTransitions();
    }
    
    setTrigger(paramName) {
        if (!this.parameters) this.parameters = new Map();
        this.parameters.set(paramName, true);
        this.checkTransitions();
        // Reset trigger after frame
        setTimeout(() => this.parameters.set(paramName, false), 0);
    }
    
    checkTransitions() {
        if (!this.currentState || this.currentTransition) return;
        
        // Check all transitions from current state
        for (const [key, transition] of this.transitions) {
            if (transition.fromState === this.currentState) {
                if (transition.condition && transition.condition(this.parameters)) {
                    this.startTransition(transition.toState, transition.duration);
                    break;
                }
            }
        }
    }
}

/**
 * Animation State
 * Represents a single animation clip with playback properties
 */
export class AnimationState {
    constructor(name, animationClip) {
        this.name = name;
        this.clip = animationClip; // Reference to animation clip
        
        // Playback properties
        this.speed = 1.0;
        this.loop = true;
        this.startTime = 0;
        this.endTime = animationClip ? animationClip.duration : 1;
        
        // Events
        this.events = []; // Array of AnimationEvent
        
        // Motion properties
        this.rootMotion = false;
        this.mirror = false; // Mirror animation (for symmetric anims)
        
        // Blending
        this.weight = 1.0;
        this.blendMode = 'override';
    }
    
    addEvent(time, eventName, data = null) {
        this.events.push(new AnimationEvent(time, eventName, data));
        this.events.sort((a, b) => a.time - b.time);
    }
    
    getEventsInRange(startTime, endTime) {
        return this.events.filter(event => 
            event.time >= startTime && event.time <= endTime
        );
    }
}

/**
 * Animation Transition
 * Defines how to transition between animation states
 */
export class AnimationTransition {
    constructor(fromState, toState, condition = null, duration = 0.3) {
        this.fromState = fromState;
        this.toState = toState;
        this.condition = condition; // Function that returns boolean
        this.duration = duration;
        
        // Transition properties
        this.exitTime = 0.75; // When in source state to start transition (0-1)
        this.hasExitTime = false;
        this.interruptionSource = 'none'; // 'none', 'current', 'next'
        
        // Blending curve
        this.curve = 'linear'; // 'linear', 'ease-in', 'ease-out', 'ease-in-out'
    }
    
    canTransition(parameters, currentStateTime, currentStateDuration) {
        // Check exit time condition
        if (this.hasExitTime) {
            const normalizedTime = currentStateTime / currentStateDuration;
            if (normalizedTime < this.exitTime) return false;
        }
        
        // Check custom condition
        if (this.condition) {
            return this.condition(parameters);
        }
        
        return true;
    }
}

/**
 * Animation Event
 * Triggered at specific times during animation playback
 */
export class AnimationEvent {
    constructor(time, eventName, data = null) {
        this.time = time; // Time in animation (seconds)
        this.eventName = eventName;
        this.data = data; // Additional event data
        this.fired = false; // Track if event was fired this loop
    }
}

/**
 * Tween Component
 * For simple property animations and tweens
 */
export class TweenComponent extends Component {
    constructor() {
        super();
        
        // Active tweens
        this.tweens = new Map(); // Map of id -> Tween
        this.nextTweenId = 1;
        
        // Tween groups (for playing multiple tweens together)
        this.groups = new Map(); // Map of groupName -> Set of tween ids
        
        // Global tween settings
        this.timeScale = 1.0;
        this.isPaused = false;
        
        // Events
        this.onTweenComplete = null; // Callback: (tweenId, target) => {}
        this.onTweenUpdate = null;   // Callback: (tweenId, target, progress) => {}
    }
    
    to(target, duration, properties, options = {}) {
        const tween = new Tween(
            this.nextTweenId++,
            target,
            duration,
            properties,
            options
        );
        
        this.tweens.set(tween.id, tween);
        this.markDirty();
        
        return tween;
    }
    
    from(target, duration, properties, options = {}) {
        // Store current values
        const currentValues = {};
        for (const prop in properties) {
            if (target.hasOwnProperty(prop)) {
                currentValues[prop] = target[prop];
                target[prop] = properties[prop]; // Set to start value
            }
        }
        
        // Tween to current values
        return this.to(target, duration, currentValues, options);
    }
    
    fromTo(target, duration, fromProperties, toProperties, options = {}) {
        // Set initial values
        for (const prop in fromProperties) {
            if (target.hasOwnProperty(prop)) {
                target[prop] = fromProperties[prop];
            }
        }
        
        // Tween to final values
        return this.to(target, duration, toProperties, options);
    }
    
    killTween(tweenId) {
        if (this.tweens.has(tweenId)) {
            this.tweens.delete(tweenId);
            this.markDirty();
            return true;
        }
        return false;
    }
    
    killTweensOf(target) {
        let killedCount = 0;
        for (const [id, tween] of this.tweens) {
            if (tween.target === target) {
                this.tweens.delete(id);
                killedCount++;
            }
        }
        if (killedCount > 0) this.markDirty();
        return killedCount;
    }
    
    pauseAll() {
        this.isPaused = true;
        this.markDirty();
    }
    
    resumeAll() {
        this.isPaused = false;
        this.markDirty();
    }
    
    createGroup(groupName, tweenIds = []) {
        this.groups.set(groupName, new Set(tweenIds));
        return this;
    }
    
    playGroup(groupName) {
        const group = this.groups.get(groupName);
        if (!group) return false;
        
        for (const tweenId of group) {
            const tween = this.tweens.get(tweenId);
            if (tween) {
                tween.play();
            }
        }
        
        this.markDirty();
        return true;
    }
    
    pauseGroup(groupName) {
        const group = this.groups.get(groupName);
        if (!group) return false;
        
        for (const tweenId of group) {
            const tween = this.tweens.get(tweenId);
            if (tween) {
                tween.pause();
            }
        }
        
        this.markDirty();
        return true;
    }
    
    update(deltaTime) {
        if (this.isPaused) return;
        
        const scaledDeltaTime = deltaTime * this.timeScale;
        const completedTweens = [];
        
        for (const [id, tween] of this.tweens) {
            if (tween.update(scaledDeltaTime)) {
                // Tween completed
                completedTweens.push(id);
                
                if (this.onTweenComplete) {
                    this.onTweenComplete(id, tween.target);
                }
            } else if (this.onTweenUpdate) {
                this.onTweenUpdate(id, tween.target, tween.getProgress());
            }
        }
        
        // Remove completed tweens
        for (const id of completedTweens) {
            this.tweens.delete(id);
        }
        
        if (completedTweens.length > 0) {
            this.markDirty();
        }
    }
    
    getTweenCount() {
        return this.tweens.size;
    }
    
    getTweensOf(target) {
        const result = [];
        for (const tween of this.tweens.values()) {
            if (tween.target === target) {
                result.push(tween);
            }
        }
        return result;
    }
}

/**
 * Tween
 * Individual tween instance
 */
export class Tween {
    constructor(id, target, duration, properties, options = {}) {
        this.id = id;
        this.target = target;
        this.duration = duration;
        this.properties = { ...properties };
        
        // Options
        this.delay = options.delay || 0;
        this.ease = options.ease || 'linear';
        this.loop = options.loop || false;
        this.yoyo = options.yoyo || false;
        this.onComplete = options.onComplete || null;
        this.onUpdate = options.onUpdate || null;
        this.onStart = options.onStart || null;
        
        // State
        this.isPlaying = true;
        this.isPaused = false;
        this.time = 0;
        this.delayTime = 0;
        this.started = false;
        this.completed = false;
        this.loopCount = 0;
        this.yoyoDirection = 1; // 1 for forward, -1 for backward
        
        // Store initial values
        this.startValues = {};
        this.endValues = {};
        
        this.initializeValues();
    }
    
    initializeValues() {
        for (const prop in this.properties) {
            if (this.target.hasOwnProperty(prop)) {
                this.startValues[prop] = this.target[prop];
                this.endValues[prop] = this.properties[prop];
            }
        }
    }
    
    update(deltaTime) {
        if (!this.isPlaying || this.isPaused || this.completed) return false;
        
        // Handle delay
        if (this.delayTime < this.delay) {
            this.delayTime += deltaTime;
            return false;
        }
        
        // Start tween
        if (!this.started) {
            this.started = true;
            if (this.onStart) {
                this.onStart(this);
            }
        }
        
        // Update time
        this.time += deltaTime * this.yoyoDirection;
        
        // Calculate progress
        let progress = Math.max(0, Math.min(1, this.time / this.duration));
        
        // Apply easing
        const easedProgress = this.applyEasing(progress);
        
        // Interpolate properties
        for (const prop in this.properties) {
            if (this.target.hasOwnProperty(prop)) {
                const startValue = this.startValues[prop];
                const endValue = this.endValues[prop];
                
                if (typeof startValue === 'number' && typeof endValue === 'number') {
                    this.target[prop] = startValue + (endValue - startValue) * easedProgress;
                } else if (typeof startValue === 'object' && startValue !== null) {
                    // Handle objects (like position, color, etc.)
                    this.interpolateObject(this.target[prop], startValue, endValue, easedProgress);
                }
            }
        }
        
        // Fire update callback
        if (this.onUpdate) {
            this.onUpdate(this);
        }
        
        // Check completion
        if (progress >= 1) {
            if (this.yoyo && this.yoyoDirection === 1) {
                // Start yoyo backward
                this.yoyoDirection = -1;
                this.time = this.duration;
            } else if (this.loop) {
                // Restart loop
                this.time = 0;
                this.yoyoDirection = 1;
                this.loopCount++;
                
                if (typeof this.loop === 'number' && this.loopCount >= this.loop) {
                    this.completed = true;
                }
            } else {
                this.completed = true;
            }
            
            if (this.completed && this.onComplete) {
                this.onComplete(this);
            }
        }
        
        return this.completed;
    }
    
    interpolateObject(target, start, end, progress) {
        if (start && end && typeof start === 'object' && typeof end === 'object') {
            for (const key in end) {
                if (start.hasOwnProperty(key) && typeof start[key] === 'number' && typeof end[key] === 'number') {
                    target[key] = start[key] + (end[key] - start[key]) * progress;
                }
            }
        }
    }
    
    applyEasing(t) {
        switch (this.ease) {
            case 'linear':
                return t;
            case 'ease-in':
                return t * t;
            case 'ease-out':
                return 1 - (1 - t) * (1 - t);
            case 'ease-in-out':
                return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
            case 'bounce-out':
                if (t < 1 / 2.75) {
                    return 7.5625 * t * t;
                } else if (t < 2 / 2.75) {
                    return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
                } else if (t < 2.5 / 2.75) {
                    return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
                } else {
                    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
                }
            case 'elastic-out':
                return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
            default:
                return t;
        }
    }
    
    play() {
        this.isPlaying = true;
        this.isPaused = false;
        return this;
    }
    
    pause() {
        this.isPaused = true;
        return this;
    }
    
    stop() {
        this.isPlaying = false;
        this.completed = true;
        return this;
    }
    
    restart() {
        this.time = 0;
        this.delayTime = 0;
        this.started = false;
        this.completed = false;
        this.loopCount = 0;
        this.yoyoDirection = 1;
        this.isPlaying = true;
        this.isPaused = false;
        this.initializeValues();
        return this;
    }
    
    getProgress() {
        return Math.max(0, Math.min(1, this.time / this.duration));
    }
    
    // Chainable methods for easy tween building
    delay(seconds) {
        this.delay = seconds;
        return this;
    }
    
    ease(easingFunction) {
        this.ease = easingFunction;
        return this;
    }
    
    loop(times = true) {
        this.loop = times;
        return this;
    }
    
    yoyo(enabled = true) {
        this.yoyo = enabled;
        return this;
    }
    
    onComplete(callback) {
        this.onComplete = callback;
        return this;
    }
    
    onUpdate(callback) {
        this.onUpdate = callback;
        return this;
    }
    
    onStart(callback) {
        this.onStart = callback;
        return this;
    }
}

/**
 * Animation Clip
 * Contains keyframe data for animations
 */
export class AnimationClip {
    constructor(name, duration = 1) {
        this.name = name;
        this.duration = duration;
        this.tracks = new Map(); // Map of property path -> AnimationTrack
        this.events = []; // Array of AnimationEvent
        this.loop = true;
        this.frameRate = 30;
    }
    
    addTrack(propertyPath, keyframes) {
        const track = new AnimationTrack(propertyPath, keyframes);
        this.tracks.set(propertyPath, track);
        return track;
    }
    
    addEvent(time, eventName, data = null) {
        this.events.push(new AnimationEvent(time, eventName, data));
        this.events.sort((a, b) => a.time - b.time);
    }
    
    sample(time, target) {
        // Sample all tracks at given time and apply to target
        for (const track of this.tracks.values()) {
            track.sample(time, target);
        }
    }
    
    getEventsInRange(startTime, endTime) {
        return this.events.filter(event => 
            event.time >= startTime && event.time <= endTime
        );
    }
}

/**
 * Animation Track
 * Contains keyframe data for a specific property
 */
export class AnimationTrack {
    constructor(propertyPath, keyframes = []) {
        this.propertyPath = propertyPath; // e.g., "position.x", "rotation.y"
        this.keyframes = keyframes.sort((a, b) => a.time - b.time);
        this.interpolation = 'linear'; // 'linear', 'step', 'cubic'
    }
    
    addKeyframe(time, value, easing = 'linear') {
        const keyframe = new Keyframe(time, value, easing);
        this.keyframes.push(keyframe);
        this.keyframes.sort((a, b) => a.time - b.time);
        return keyframe;
    }
    
    sample(time, target) {
        if (this.keyframes.length === 0) return;
        
        // Find surrounding keyframes
        let prevKeyframe = null;
        let nextKeyframe = null;
        
        for (let i = 0; i < this.keyframes.length; i++) {
            const keyframe = this.keyframes[i];
            
            if (keyframe.time <= time) {
                prevKeyframe = keyframe;
            }
            
            if (keyframe.time >= time) {
                nextKeyframe = keyframe;
                break;
            }
        }
        
        // Apply value to target
        let value;
        
        if (!prevKeyframe) {
            value = nextKeyframe.value;
        } else if (!nextKeyframe) {
            value = prevKeyframe.value;
        } else if (prevKeyframe === nextKeyframe) {
            value = prevKeyframe.value;
        } else {
            // Interpolate between keyframes
            const t = (time - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
            value = this.interpolate(prevKeyframe.value, nextKeyframe.value, t, prevKeyframe.easing);
        }
        
        // Apply to target using property path
        this.setPropertyByPath(target, this.propertyPath, value);
    }
    
    interpolate(startValue, endValue, t, easing) {
        // Apply easing
        const easedT = this.applyEasing(t, easing);
        
        if (typeof startValue === 'number' && typeof endValue === 'number') {
            return startValue + (endValue - startValue) * easedT;
        } else if (typeof startValue === 'object' && startValue !== null) {
            // Handle objects (vectors, colors, etc.)
            const result = {};
            for (const key in endValue) {
                if (startValue.hasOwnProperty(key)) {
                    result[key] = startValue[key] + (endValue[key] - startValue[key]) * easedT;
                }
            }
            return result;
        }
        
        return endValue; // Default to end value for unsupported types
    }
    
    setPropertyByPath(target, path, value) {
        const parts = path.split('.');
        let current = target;
        
        for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        
        const finalProp = parts[parts.length - 1];
        if (typeof value === 'object' && value !== null && typeof current[finalProp] === 'object') {
            // Merge objects
            Object.assign(current[finalProp], value);
        } else {
            current[finalProp] = value;
        }
    }
    
    applyEasing(t, easing) {
        switch (easing) {
            case 'linear':
                return t;
            case 'ease-in':
                return t * t;
            case 'ease-out':
                return 1 - (1 - t) * (1 - t);
            case 'ease-in-out':
                return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
            default:
                return t;
        }
    }
}

/**
 * Keyframe
 * Single keyframe in an animation track
 */
export class Keyframe {
    constructor(time, value, easing = 'linear') {
        this.time = time;
        this.value = value;
        this.easing = easing;
        
        // Additional properties for advanced keyframes
        this.inTangent = null;
        this.outTangent = null;
        this.weightedMode = false;
        this.inWeight = 1;
        this.outWeight = 1;
    }
}