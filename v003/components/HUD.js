import GUIComponent from './GUIComponent.js';
import { UIConstants, UIFactory } from '../utils/UIUtils.js';

export default class HUD extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'hud';
        this.isDraggable = false;
        this.isResizable = false;
        
        // HUD elements to display
        this.elements = {
            healthBar: true,
            manaBar: true,
            staminaBar: true,
            minimap: true,
            hotbar: true,
            questTracker: true,
            resourceDisplay: true
        };
        
        // HUD state
        this.healthBars = [];
        this.questTracker = null;
        this.resourceDisplay = null;
    }
    
    createHUDContainer() {
        // Create the main HUD container that will be added to the GUI system
        const container = document.createElement('div');
        container.className = 'hud-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 500;
        `;
        
        // Create default player data
        const defaultPlayerData = {
            character: {
                currentHealth: 100,
                maxHealth: 100,
                currentMana: 50,
                maxMana: 50,
                currentStamina: 100,
                maxStamina: 100
            },
            activeQuests: [],
            resources: {
                wood: 0,
                stone: 0,
                food: 0,
                gold: 0
            }
        };
        
        // Top-left: Player bars
        if (this.elements.healthBar || this.elements.manaBar || this.elements.staminaBar) {
            const barsContainer = this.createPlayerBars(defaultPlayerData);
            container.appendChild(barsContainer);
            this.healthBars = barsContainer;
        }
        
        // Top-right: Minimap
        if (this.elements.minimap) {
            const minimap = this.createMinimap();
            container.appendChild(minimap);
        }
        
        // Bottom: Hotbar
        if (this.elements.hotbar) {
            const hotbar = this.createHotbar();
            container.appendChild(hotbar);
        }
        
        // Right side: Quest tracker
        if (this.elements.questTracker) {
            const questTracker = this.createQuestTracker([]);
            container.appendChild(questTracker);
            this.questTracker = questTracker;
        }
        
        // Top center: Resource display
        if (this.elements.resourceDisplay) {
            const resourceDisplay = this.createResourceDisplay(defaultPlayerData.resources);
            container.appendChild(resourceDisplay);
            this.resourceDisplay = resourceDisplay;
        }
        
        return container;
    }
    
    createHUDDisplay(playerData) {
        const container = document.createElement('div');
        container.className = 'hud-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 500;
        `;
        
        // Top-left: Player bars
        if (this.elements.healthBar || this.elements.manaBar || this.elements.staminaBar) {
            const barsContainer = this.createPlayerBars(playerData);
            container.appendChild(barsContainer);
        }
        
        // Top-right: Minimap
        if (this.elements.minimap) {
            const minimap = this.createMinimap();
            container.appendChild(minimap);
        }
        
        // Bottom: Hotbar
        if (this.elements.hotbar) {
            const hotbar = this.createHotbar();
            container.appendChild(hotbar);
        }
        
        // Right side: Quest tracker
        if (this.elements.questTracker) {
            const questTracker = this.createQuestTracker(playerData.activeQuests);
            container.appendChild(questTracker);
        }
        
        // Top center: Resource display
        if (this.elements.resourceDisplay) {
            const resourceDisplay = this.createResourceDisplay(playerData.resources);
            container.appendChild(resourceDisplay);
        }
        
        return container;
    }
    
    createPlayerBars(playerData) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            pointer-events: auto;
        `;
        
        const character = playerData.character;
        
        // Health bar
        if (this.elements.healthBar) {
            const healthBar = this.createBar('Health', character.currentHealth, character.maxHealth, '#F44336', '❤️');
            container.appendChild(healthBar);
        }
        
        // Mana bar
        if (this.elements.manaBar) {
            const manaBar = this.createBar('Mana', character.currentMana, character.maxMana, '#2196F3', '💧');
            container.appendChild(manaBar);
        }
        
        // Stamina bar
        if (this.elements.staminaBar) {
            const staminaBar = this.createBar('Stamina', character.currentStamina, character.maxStamina, '#FF9800', '⚡');
            container.appendChild(staminaBar);
        }
        
        return container;
    }
    
    createBar(name, current, max, color, icon) {
        return UIFactory.createProgressBar(name, current, max, color, icon);
    }
    
    createMinimap() {
        const minimap = document.createElement('div');
        minimap.className = 'minimap';
        minimap.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 200px;
            height: 200px;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #444;
            border-radius: 10px;
            pointer-events: auto;
        `;
        
        // Placeholder minimap content
        const canvas = document.createElement('canvas');
        canvas.width = 196;
        canvas.height = 196;
        canvas.style.cssText = 'border-radius: 8px;';
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 196, 196);
        
        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.moveTo(i * 20, 0);
            ctx.lineTo(i * 20, 196);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * 20);
            ctx.lineTo(196, i * 20);
            ctx.stroke();
        }
        
        // Player position
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(98, 98, 5, 0, Math.PI * 2);
        ctx.fill();
        
        minimap.appendChild(canvas);
        return minimap;
    }
    
    createHotbar() {
        const hotbar = document.createElement('div');
        hotbar.className = 'hotbar';
        hotbar.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 5px;
            background: rgba(0, 0, 0, 0.8);
            padding: 10px;
            border-radius: 10px;
            pointer-events: auto;
        `;
        
        // Create hotbar slots
        for (let i = 0; i < 10; i++) {
            const slot = document.createElement('div');
            slot.className = 'hotbar-slot';
            slot.style.cssText = `
                width: 50px;
                height: 50px;
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid #666;
                border-radius: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                cursor: pointer;
            `;
            
            // Slot number
            const number = document.createElement('div');
            number.style.cssText = `
                position: absolute;
                top: 2px;
                left: 4px;
                font-size: 10px;
                color: #888;
            `;
            number.textContent = i === 9 ? '0' : (i + 1);
            slot.appendChild(number);
            
            hotbar.appendChild(slot);
        }
        
        return hotbar;
    }
    
    createQuestTracker(activeQuests = []) {
        const tracker = document.createElement('div');
        tracker.className = 'quest-tracker';
        tracker.style.cssText = `
            position: absolute;
            top: 240px;
            right: 20px;
            width: 250px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 10px;
            padding: 15px;
            pointer-events: auto;
            max-height: 300px;
            overflow-y: auto;
        `;
        
        const title = document.createElement('div');
        title.style.cssText = 'color: #FFC107; font-weight: bold; margin-bottom: 10px;';
        title.textContent = '📋 Active Quests';
        tracker.appendChild(title);
        
        if (activeQuests.length === 0) {
            const noQuests = document.createElement('div');
            noQuests.style.cssText = 'color: #666; font-size: 12px;';
            noQuests.textContent = 'No active quests';
            tracker.appendChild(noQuests);
        } else {
            activeQuests.forEach(quest => {
                const questElement = this.createQuestTrackerItem(quest);
                tracker.appendChild(questElement);
            });
        }
        
        return tracker;
    }
    
    createQuestTrackerItem(quest) {
        const item = document.createElement('div');
        item.style.cssText = 'margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #333;';
        
        const title = document.createElement('div');
        title.style.cssText = 'color: #2196F3; font-size: 12px; margin-bottom: 5px;';
        title.textContent = quest.title;
        item.appendChild(title);
        
        // Show first incomplete objective
        const nextObjective = quest.objectives.find(obj => !obj.completed);
        if (nextObjective) {
            const objective = document.createElement('div');
            objective.style.cssText = 'color: #aaa; font-size: 11px;';
            objective.textContent = `• ${nextObjective.description}`;
            if (nextObjective.required > 1) {
                objective.textContent += ` (${nextObjective.current}/${nextObjective.required})`;
            }
            item.appendChild(objective);
        }
        
        return item;
    }
    
    createResourceDisplay(resources = {}) {
        const display = document.createElement('div');
        display.className = 'resource-display';
        display.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 20px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px 20px;
            border-radius: 20px;
            pointer-events: auto;
        `;
        
        Object.entries(resources).forEach(([resource, amount]) => {
            const resElement = UIFactory.createStyledElement('div', 'display: flex; align-items: center; gap: 5px;');
            resElement.innerHTML = `
                <span style="font-size: 16px;">${UIConstants.resourceIcons[resource] || '❓'}</span>
                <span style="color: #fff; font-weight: bold;">${amount}</span>
            `;
            display.appendChild(resElement);
        });
        
        return display;
    }
    
    updateHealthBars(players) {
        // Update health bars for player characters
        if (!this.healthBars || !players || players.length === 0) return;
        
        // For now, just update the first player
        const player = players[0];
        if (!player) return;
        
        const character = player.getComponent('CharacterComponent');
        if (!character) return;
        
        // Update the health bar values
        // This would update the actual DOM elements in a real implementation
        console.log(`Updating health bars: HP ${character.currentHealth}/${character.maxHealth}`);
    }
    
    updateQuestTracker(activeQuests) {
        // Update quest tracker display
        if (!this.questTracker) return;
        
        // Clear existing content
        this.questTracker.innerHTML = '';
        
        const title = document.createElement('div');
        title.style.cssText = 'color: #FFC107; font-weight: bold; margin-bottom: 10px;';
        title.textContent = '📋 Active Quests';
        this.questTracker.appendChild(title);
        
        if (!activeQuests || activeQuests.length === 0) {
            const noQuests = document.createElement('div');
            noQuests.style.cssText = 'color: #666; font-size: 12px;';
            noQuests.textContent = 'No active quests';
            this.questTracker.appendChild(noQuests);
        } else {
            activeQuests.forEach(quest => {
                const questElement = this.createQuestTrackerItem(quest);
                this.questTracker.appendChild(questElement);
            });
        }
    }
    
    updateResources(resources) {
        // Update resource display
        if (!this.resourceDisplay) return;
        
        // Clear existing content
        this.resourceDisplay.innerHTML = '';
        
        Object.entries(resources).forEach(([resource, amount]) => {
            const resElement = UIFactory.createStyledElement('div', 'display: flex; align-items: center; gap: 5px;');
            resElement.innerHTML = `
                <span style="font-size: 16px;">${UIConstants.resourceIcons[resource] || '❓'}</span>
                <span style="color: #fff; font-weight: bold;">${amount}</span>
            `;
            this.resourceDisplay.appendChild(resElement);
        });
    }
}