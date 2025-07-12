import { Component } from '../core/Component.js';

export class TagComponent extends Component {
    constructor(tags = []) {
        super();
        this.tags = new Set(tags);
        this.active = true;
    }
    
    addTag(tag) {
        this.tags.add(tag);
    }
    
    removeTag(tag) {
        this.tags.delete(tag);
    }
    
    hasTag(tag) {
        return this.tags.has(tag);
    }
    
    hasTags(tags) {
        return tags.every(tag => this.tags.has(tag));
    }
    
    hasAnyTag(tags) {
        return tags.some(tag => this.tags.has(tag));
    }
    
    clearTags() {
        this.tags.clear();
    }
    
    serialize() {
        return {
            tags: Array.from(this.tags),
            active: this.active
        };
    }
    
    deserialize(data) {
        this.tags = new Set(data.tags || []);
        this.active = data.active !== false;
    }
}