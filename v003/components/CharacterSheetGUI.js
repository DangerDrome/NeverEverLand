import GUIComponent from './GUIComponent.js';
import { UIConstants, UIFactory } from '../utils/UIUtils.js';

export default class CharacterSheetGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'character';
        this.size = { width: 500, height: 600 };
        
        // Character sheet sections
        this.sections = {
            stats: true,
            equipment: true,
            skills: true,
            attributes: true
        };
        
        // Equipment slots
        this.equipmentSlots = [
            { slot: 'head', name: 'Head', icon: '🎩' },
            { slot: 'chest', name: 'Chest', icon: '👕' },
            { slot: 'legs', name: 'Legs', icon: '👖' },
            { slot: 'feet', name: 'Feet', icon: '👢' },
            { slot: 'weapon', name: 'Weapon', icon: '⚔️' },
            { slot: 'offhand', name: 'Off-hand', icon: '🛡️' }
        ];
    }
    
    createCharacterDisplay(character) {
        const container = document.createElement('div');
        container.className = 'character-sheet';
        container.style.cssText = `
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            height: 100%;
            overflow-y: auto;
        `;
        
        // Header with name and level
        const header = this.createCharacterHeader(character);
        container.appendChild(header);
        
        // Stats section
        if (this.sections.stats) {
            const stats = this.createStatsSection(character);
            container.appendChild(stats);
        }
        
        // Equipment section
        if (this.sections.equipment) {
            const equipment = this.createEquipmentSection(character);
            container.appendChild(equipment);
        }
        
        // Skills section
        if (this.sections.skills) {
            const skills = this.createSkillsSection(character);
            container.appendChild(skills);
        }
        
        return container;
    }
    
    createCharacterHeader(character) {
        const header = document.createElement('div');
        header.className = 'character-header';
        header.style.cssText = `
            text-align: center;
            padding: 10px;
            background: rgba(76, 175, 80, 0.2);
            border-radius: 8px;
        `;
        
        header.innerHTML = `
            <h2 style="margin: 0; color: #4CAF50;">${character.name}</h2>
            <p style="margin: 5px 0; color: #aaa;">Level ${character.level} ${character.characterClass}</p>
            <div style="margin-top: 10px;">
                <div style="background: #333; border-radius: 10px; overflow: hidden; height: 20px;">
                    <div style="background: #4CAF50; width: ${(character.experience / character.experienceToNext) * 100}%; height: 100%; transition: width 0.3s;"></div>
                </div>
                <small style="color: #888;">${character.experience} / ${character.experienceToNext} XP</small>
            </div>
        `;
        
        return header;
    }
    
    createStatsSection(character) {
        const section = document.createElement('div');
        section.className = 'stats-section';
        section.style.cssText = `
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 8px;
        `;
        
        const title = document.createElement('h3');
        title.textContent = '📊 Stats';
        title.style.cssText = 'margin: 0 0 10px 0; color: #FFC107;';
        section.appendChild(title);
        
        const statsGrid = document.createElement('div');
        statsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        `;
        
        // Create stat displays
        const stats = [
            { name: 'Health', current: character.currentHealth, max: character.maxHealth, color: '#F44336' },
            { name: 'Mana', current: character.currentMana, max: character.maxMana, color: '#2196F3' },
            { name: 'Stamina', current: character.currentStamina, max: character.maxStamina, color: '#FF9800' },
            { name: 'Strength', value: character.strength, color: '#8BC34A' },
            { name: 'Intelligence', value: character.intelligence, color: '#9C27B0' },
            { name: 'Agility', value: character.agility, color: '#00BCD4' }
        ];
        
        stats.forEach(stat => {
            const statElement = this.createStatElement(stat);
            statsGrid.appendChild(statElement);
        });
        
        section.appendChild(statsGrid);
        return section;
    }
    
    createStatElement(stat) {
        const element = document.createElement('div');
        element.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            padding: 8px;
            border-radius: 4px;
            border-left: 3px solid ${stat.color};
        `;
        
        if (stat.max !== undefined) {
            // Bar stat (health, mana, stamina)
            element.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: ${stat.color}; font-weight: bold;">${stat.name}</span>
                    <span style="color: #fff;">${stat.current}/${stat.max}</span>
                </div>
                <div style="background: #222; border-radius: 3px; overflow: hidden; height: 6px;">
                    <div style="background: ${stat.color}; width: ${(stat.current / stat.max) * 100}%; height: 100%;"></div>
                </div>
            `;
        } else {
            // Value stat (strength, int, etc)
            element.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: ${stat.color}; font-weight: bold;">${stat.name}</span>
                    <span style="color: #fff; font-size: 18px; font-weight: bold;">${stat.value}</span>
                </div>
            `;
        }
        
        return element;
    }
    
    createEquipmentSection(character) {
        const section = document.createElement('div');
        section.className = 'equipment-section';
        section.style.cssText = `
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 8px;
        `;
        
        const title = document.createElement('h3');
        title.textContent = '🛡️ Equipment';
        title.style.cssText = 'margin: 0 0 10px 0; color: #FFC107;';
        section.appendChild(title);
        
        const equipmentGrid = document.createElement('div');
        equipmentGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        `;
        
        this.equipmentSlots.forEach(slotInfo => {
            const equipped = character.equipment[slotInfo.slot];
            const slotElement = this.createEquipmentSlot(slotInfo, equipped);
            equipmentGrid.appendChild(slotElement);
        });
        
        section.appendChild(equipmentGrid);
        return section;
    }
    
    createEquipmentSlot(slotInfo, item) {
        const slot = document.createElement('div');
        slot.className = 'equipment-slot';
        slot.dataset.slot = slotInfo.slot;
        slot.style.cssText = `
            aspect-ratio: 1;
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid #666;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            position: relative;
            transition: all 0.2s;
        `;
        
        slot.addEventListener('mouseenter', () => {
            slot.style.borderColor = '#FFC107';
            slot.style.transform = 'scale(1.05)';
        });
        
        slot.addEventListener('mouseleave', () => {
            slot.style.borderColor = '#666';
            slot.style.transform = 'scale(1)';
        });
        
        if (item) {
            // Show equipped item
            const itemIcon = document.createElement('div');
            itemIcon.style.fontSize = '32px';
            itemIcon.textContent = slotInfo.icon;
            slot.appendChild(itemIcon);
            
            const itemName = document.createElement('div');
            itemName.style.cssText = 'font-size: 10px; color: #4CAF50; margin-top: 4px;';
            itemName.textContent = item.name;
            slot.appendChild(itemName);
        } else {
            // Empty slot
            const emptyIcon = document.createElement('div');
            emptyIcon.style.cssText = 'font-size: 24px; opacity: 0.3;';
            emptyIcon.textContent = slotInfo.icon;
            slot.appendChild(emptyIcon);
            
            const slotLabel = document.createElement('div');
            slotLabel.style.cssText = 'font-size: 10px; color: #666; margin-top: 4px;';
            slotLabel.textContent = slotInfo.name;
            slot.appendChild(slotLabel);
        }
        
        // Drop zone for equipment
        slot.addEventListener('dragover', (e) => e.preventDefault());
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            const event = new CustomEvent('equipItem', {
                detail: { slot: slotInfo.slot }
            });
            document.dispatchEvent(event);
        });
        
        return slot;
    }
    
    createSkillsSection(character) {
        const section = document.createElement('div');
        section.className = 'skills-section';
        section.style.cssText = `
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 8px;
        `;
        
        const title = document.createElement('h3');
        title.textContent = '⚡ Skills';
        title.style.cssText = 'margin: 0 0 10px 0; color: #FFC107;';
        section.appendChild(title);
        
        // Placeholder for skills
        const skillsInfo = document.createElement('div');
        skillsInfo.style.cssText = 'color: #888; text-align: center; padding: 20px;';
        skillsInfo.textContent = 'Skills coming soon...';
        section.appendChild(skillsInfo);
        
        return section;
    }
}