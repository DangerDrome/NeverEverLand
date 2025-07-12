import { Component } from '../core/Component.js';

/**
 * Party Component - Manages party members and formation
 * Handles group coordination, leadership, and member relationships
 */
export class PartyComponent extends Component {
    constructor() {
        super();
        this.members = [];        // Array of entity IDs
        this.maxMembers = 4;     // Maximum party size
        this.activeLeader = 0;   // Index of current leader
        this.formation = 'line'; // 'line', 'triangle', 'circle', 'column'
        this.spacing = 2.0;      // Distance between members
        this.active = true;
    }
    
    addMember(entityId) {
        if (this.members.length < this.maxMembers && !this.members.includes(entityId)) {
            this.members.push(entityId);
            return true;
        }
        return false;
    }
    
    removeMember(entityId) {
        const index = this.members.indexOf(entityId);
        if (index !== -1) {
            this.members.splice(index, 1);
            // Adjust leader if needed
            if (this.activeLeader >= this.members.length) {
                this.activeLeader = Math.max(0, this.members.length - 1);
            }
            return true;
        }
        return false;
    }
    
    getLeader() {
        return this.members[this.activeLeader] || null;
    }
    
    switchLeader(index) {
        if (index >= 0 && index < this.members.length) {
            this.activeLeader = index;
            return true;
        }
        return false;
    }
    
    setFormation(formationType) {
        const validFormations = ['line', 'triangle', 'circle', 'column'];
        if (validFormations.includes(formationType)) {
            this.formation = formationType;
            return true;
        }
        return false;
    }
    
    serialize() {
        return {
            members: [...this.members],
            maxMembers: this.maxMembers,
            activeLeader: this.activeLeader,
            formation: this.formation,
            spacing: this.spacing,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.members = data.members || [];
        this.maxMembers = data.maxMembers || 4;
        this.activeLeader = data.activeLeader || 0;
        this.formation = data.formation || 'line';
        this.spacing = data.spacing || 2.0;
        this.active = data.active !== false;
    }
}