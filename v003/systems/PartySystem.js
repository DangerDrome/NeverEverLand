import { System } from '../core/System.js';

export class PartySystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['PartyComponent'];
        this.priority = 40;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            this.processEntity(entity, deltaTime);
        });
    }
    
    processEntity(entity, deltaTime) {
        const party = entity.getComponent('PartyComponent');
        
        if (!party.active) return;
        
        // Update party formation
        if (party.members.length > 0) {
            this.updateFormation(party, entity);
        }
        
        // Check for party member proximity
        this.checkMemberProximity(party);
    }
    
    updateFormation(party, leaderEntity) {
        const leaderTransform = leaderEntity.getComponent('TransformComponent');
        if (!leaderTransform) return;
        
        const activeLeaderIndex = party.activeLeader % party.members.length;
        
        party.members.forEach((memberId, index) => {
            if (index === activeLeaderIndex) return;
            
            const member = this.world.getEntityById(memberId);
            if (!member) return;
            
            const memberTransform = member.getComponent('TransformComponent');
            if (!memberTransform) return;
            
            // Calculate formation position
            let targetX, targetZ;
            
            switch (party.formation) {
                case 'line':
                    targetX = leaderTransform.position.x - (index - activeLeaderIndex) * party.spacing;
                    targetZ = leaderTransform.position.z;
                    break;
                case 'square':
                    const row = Math.floor(index / 2);
                    const col = index % 2;
                    targetX = leaderTransform.position.x - row * party.spacing;
                    targetZ = leaderTransform.position.z - (col - 0.5) * party.spacing;
                    break;
                case 'diamond':
                    const angle = (index / party.members.length) * Math.PI * 2;
                    targetX = leaderTransform.position.x + Math.cos(angle) * party.spacing * 2;
                    targetZ = leaderTransform.position.z + Math.sin(angle) * party.spacing * 2;
                    break;
                default:
                    targetX = leaderTransform.position.x;
                    targetZ = leaderTransform.position.z;
            }
            
            // Smoothly move towards target
            const speed = 5.0;
            memberTransform.position.x += (targetX - memberTransform.position.x) * speed * deltaTime;
            memberTransform.position.z += (targetZ - memberTransform.position.z) * speed * deltaTime;
        });
    }
    
    checkMemberProximity(party) {
        // Check if party members are too far from leader
        const maxDistance = party.spacing * 5;
        
        party.members.forEach((memberId, index) => {
            const member = this.world.getEntityById(memberId);
            if (!member) return;
            
            const memberTransform = member.getComponent('TransformComponent');
            if (!memberTransform) return;
            
            // Calculate distance to leader
            const leaderIndex = party.activeLeader % party.members.length;
            if (index === leaderIndex) return;
            
            const leaderId = party.members[leaderIndex];
            const leader = this.world.getEntityById(leaderId);
            if (!leader) return;
            
            const leaderTransform = leader.getComponent('TransformComponent');
            if (!leaderTransform) return;
            
            const distance = Math.sqrt(
                Math.pow(memberTransform.position.x - leaderTransform.position.x, 2) +
                Math.pow(memberTransform.position.z - leaderTransform.position.z, 2)
            );
            
            if (distance > maxDistance) {
                // Teleport member to leader if too far
                memberTransform.position.x = leaderTransform.position.x;
                memberTransform.position.z = leaderTransform.position.z;
            }
        });
    }
    
    addMember(partyEntity, memberEntity) {
        const party = partyEntity.getComponent('PartyComponent');
        if (!party || party.members.length >= party.maxMembers) return false;
        
        party.members.push(memberEntity.id);
        return true;
    }
    
    removeMember(partyEntity, memberEntity) {
        const party = partyEntity.getComponent('PartyComponent');
        if (!party) return false;
        
        const index = party.members.indexOf(memberEntity.id);
        if (index !== -1) {
            party.members.splice(index, 1);
            return true;
        }
        return false;
    }
    
    switchLeader(partyEntity) {
        const party = partyEntity.getComponent('PartyComponent');
        if (!party || party.members.length === 0) return;
        
        party.activeLeader = (party.activeLeader + 1) % party.members.length;
    }
}