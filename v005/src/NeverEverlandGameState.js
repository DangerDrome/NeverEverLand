
import * as THREE from 'three';

export class NeverEverlandGameState {
  constructor() {
    this.state = {
      player: {
        health: 100,
        maxHealth: 100,
        mana: 50,
        maxMana: 50,
        level: 1,
        experience: 0,
        position: new THREE.Vector3(),
        inventory: []
      },
      world: {
        timeOfDay: 12,
        weather: 'clear',
        activeQuests: [],
        npcs: new Map(),
        enemies: new Map()
      },
      ui: {
        activeMenu: null,
        selectedTarget: null,
        chatMessages: [],
        notifications: []
      }
    };
    
    this.subscribers = new Map();
  }

  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    this.subscribers.get(path).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(path).delete(callback);
    };
  }

  update(path, value) {
    // Update state
    const keys = path.split('.');
    let current = this.state;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    const oldValue = current[keys[keys.length - 1]];
    current[keys[keys.length - 1]] = value;
    
    // Notify subscribers
    this.notifySubscribers(path, value, oldValue);
  }

  notifySubscribers(path, newValue, oldValue) {
    // Notify exact path subscribers
    if (this.subscribers.has(path)) {
      this.subscribers.get(path).forEach(callback => {
        callback(newValue, oldValue);
      });
    }
    
    // Notify parent path subscribers
    const parentPath = path.substring(0, path.lastIndexOf('.'));
    if (parentPath && this.subscribers.has(parentPath)) {
      this.subscribers.get(parentPath).forEach(callback => {
        callback(this.getState(parentPath));
      });
    }
  }

  getState(path) {
    const keys = path.split('.');
    let current = this.state;
    for (const key of keys) {
        if (current === undefined) {
            return undefined;
        }
        current = current[key];
    }
    return current;
  }
}
