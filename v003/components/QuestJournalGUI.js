import GUIComponent from './GUIComponent.js';
import { UIConstants, UIFactory } from '../utils/UIUtils.js';

export default class QuestJournalGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'quest';
        this.size = { width: 600, height: 500 };
        
        // Quest display settings
        this.selectedQuest = null;
        this.filter = 'active'; // all, active, completed, failed
        this.sortBy = 'recent'; // recent, name, progress
    }
    
    createQuestJournal(quests) {
        // Main method called by GUISystem
        return this.createQuestDisplay(quests);
    }
    
    createQuestDisplay(quests) {
        const container = document.createElement('div');
        container.className = 'quest-journal';
        container.style.cssText = `
            display: flex;
            height: 100%;
        `;
        
        // Quest list (left side)
        const questList = this.createQuestList(quests);
        container.appendChild(questList);
        
        // Quest details (right side)
        const questDetails = this.createQuestDetails();
        container.appendChild(questDetails);
        
        return container;
    }
    
    createQuestList(quests) {
        const listContainer = document.createElement('div');
        listContainer.className = 'quest-list';
        listContainer.style.cssText = `
            width: 40%;
            background: rgba(0, 0, 0, 0.3);
            border-right: 1px solid #444;
            overflow-y: auto;
        `;
        
        // Filter tabs
        const tabs = this.createFilterTabs();
        listContainer.appendChild(tabs);
        
        // Quest items
        const list = document.createElement('div');
        list.style.cssText = 'padding: 10px;';
        
        const filteredQuests = this.filterQuests(quests, this.filter);
        filteredQuests.forEach(quest => {
            const questItem = this.createQuestItem(quest);
            list.appendChild(questItem);
        });
        
        listContainer.appendChild(list);
        return listContainer;
    }
    
    createFilterTabs() {
        const tabs = document.createElement('div');
        tabs.className = 'quest-tabs';
        tabs.style.cssText = `
            display: flex;
            background: rgba(0, 0, 0, 0.5);
            border-bottom: 1px solid #444;
        `;
        
        const filters = [
            { value: 'active', label: 'Active', color: '#2196F3' },
            { value: 'completed', label: 'Completed', color: '#4CAF50' },
            { value: 'failed', label: 'Failed', color: '#F44336' },
            { value: 'all', label: 'All', color: '#9E9E9E' }
        ];
        
        filters.forEach(filter => {
            const tab = document.createElement('button');
            tab.className = 'quest-tab';
            tab.textContent = filter.label;
            tab.style.cssText = `
                flex: 1;
                padding: 10px;
                border: none;
                background: ${this.filter === filter.value ? filter.color : 'transparent'};
                color: white;
                cursor: pointer;
                transition: all 0.2s;
            `;
            
            tab.addEventListener('click', () => {
                this.filter = filter.value;
                this.refresh();
            });
            
            tabs.appendChild(tab);
        });
        
        return tabs;
    }
    
    createQuestItem(quest) {
        const item = document.createElement('div');
        item.className = 'quest-item';
        item.dataset.questId = quest.questId;
        item.style.cssText = `
            padding: 15px;
            margin-bottom: 10px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            cursor: pointer;
            border-left: 3px solid ${this.getQuestColor(quest.status)};
            transition: all 0.2s;
        `;
        
        item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(255, 255, 255, 0.1)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.background = 'rgba(255, 255, 255, 0.05)';
        });
        
        item.addEventListener('click', () => {
            this.selectedQuest = quest;
            this.updateQuestDetails(quest);
        });
        
        // Quest info
        const title = document.createElement('h4');
        title.textContent = quest.title;
        title.style.cssText = 'margin: 0 0 5px 0; color: #fff;';
        item.appendChild(title);
        
        const progress = this.createQuestProgress(quest);
        item.appendChild(progress);
        
        return item;
    }
    
    createQuestProgress(quest) {
        const progress = document.createElement('div');
        progress.className = 'quest-progress';
        
        const completed = quest.objectives.filter(obj => obj.completed).length;
        const total = quest.objectives.length;
        const percentage = (completed / total) * 100;
        
        progress.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #888; font-size: 12px;">Progress</span>
                <span style="color: #888; font-size: 12px;">${completed}/${total}</span>
            </div>
            <div style="background: #333; border-radius: 3px; overflow: hidden; height: 4px;">
                <div style="background: ${this.getQuestColor(quest.status)}; width: ${percentage}%; height: 100%; transition: width 0.3s;"></div>
            </div>
        `;
        
        return progress;
    }
    
    createQuestDetails() {
        const details = document.createElement('div');
        details.className = 'quest-details';
        details.style.cssText = `
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        `;
        
        // Placeholder when no quest selected
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'color: #666; text-align: center; margin-top: 50px;';
        placeholder.textContent = 'Select a quest to view details';
        details.appendChild(placeholder);
        
        return details;
    }
    
    updateQuestDetails(quest) {
        const detailsElement = document.querySelector('.quest-details');
        detailsElement.innerHTML = '';
        
        // Quest header
        const header = document.createElement('div');
        header.style.cssText = 'margin-bottom: 20px;';
        header.innerHTML = `
            <h2 style="margin: 0; color: ${this.getQuestColor(quest.status)};">${quest.title}</h2>
            <p style="margin: 10px 0; color: #aaa;">${quest.description}</p>
        `;
        detailsElement.appendChild(header);
        
        // Objectives
        const objectivesSection = document.createElement('div');
        objectivesSection.style.cssText = 'margin-bottom: 20px;';
        
        const objectivesTitle = document.createElement('h3');
        objectivesTitle.textContent = '📋 Objectives';
        objectivesTitle.style.cssText = 'color: #FFC107; margin-bottom: 10px;';
        objectivesSection.appendChild(objectivesTitle);
        
        quest.objectives.forEach(obj => {
            const objElement = this.createObjectiveElement(obj);
            objectivesSection.appendChild(objElement);
        });
        
        detailsElement.appendChild(objectivesSection);
        
        // Rewards
        if (quest.rewards) {
            const rewardsSection = this.createRewardsSection(quest.rewards);
            detailsElement.appendChild(rewardsSection);
        }
    }
    
    createObjectiveElement(objective) {
        const element = document.createElement('div');
        element.style.cssText = `
            padding: 10px;
            margin-bottom: 8px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        // Checkbox
        const checkbox = document.createElement('div');
        checkbox.style.cssText = `
            width: 20px;
            height: 20px;
            border: 2px solid ${objective.completed ? '#4CAF50' : '#666'};
            border-radius: 3px;
            background: ${objective.completed ? '#4CAF50' : 'transparent'};
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        if (objective.completed) {
            checkbox.textContent = '✓';
            checkbox.style.color = 'white';
        }
        element.appendChild(checkbox);
        
        // Description
        const desc = document.createElement('div');
        desc.style.cssText = `
            flex: 1;
            color: ${objective.completed ? '#888' : '#fff'};
            text-decoration: ${objective.completed ? 'line-through' : 'none'};
        `;
        desc.textContent = objective.description;
        element.appendChild(desc);
        
        // Progress
        if (objective.required > 1) {
            const progress = document.createElement('div');
            progress.style.cssText = 'color: #888; font-size: 12px;';
            progress.textContent = `${objective.current}/${objective.required}`;
            element.appendChild(progress);
        }
        
        return element;
    }
    
    createRewardsSection(rewards) {
        const section = document.createElement('div');
        section.style.cssText = 'background: rgba(76, 175, 80, 0.1); padding: 15px; border-radius: 8px;';
        
        const title = document.createElement('h3');
        title.textContent = '🎁 Rewards';
        title.style.cssText = 'color: #4CAF50; margin: 0 0 10px 0;';
        section.appendChild(title);
        
        const rewardsList = document.createElement('div');
        rewardsList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px;';
        
        if (rewards.experience) {
            const xpReward = document.createElement('div');
            xpReward.style.cssText = 'background: rgba(0, 0, 0, 0.3); padding: 5px 10px; border-radius: 4px;';
            xpReward.innerHTML = `⭐ ${rewards.experience} XP`;
            rewardsList.appendChild(xpReward);
        }
        
        if (rewards.gold) {
            const goldReward = document.createElement('div');
            goldReward.style.cssText = 'background: rgba(0, 0, 0, 0.3); padding: 5px 10px; border-radius: 4px;';
            goldReward.innerHTML = `🪙 ${rewards.gold} Gold`;
            rewardsList.appendChild(goldReward);
        }
        
        if (rewards.reputation) {
            const repReward = document.createElement('div');
            repReward.style.cssText = 'background: rgba(0, 0, 0, 0.3); padding: 5px 10px; border-radius: 4px;';
            repReward.innerHTML = `🏆 ${rewards.reputation} Reputation`;
            rewardsList.appendChild(repReward);
        }
        
        section.appendChild(rewardsList);
        return section;
    }
    
    getQuestColor(status) {
        return UIConstants.questColors[status] || '#9E9E9E';
    }
    
    filterQuests(quests, filter) {
        if (filter === 'all') return quests;
        return quests.filter(quest => quest.status === filter);
    }
    
    refresh() {
        // Re-render with current filter
        const event = new CustomEvent('questJournalRefresh');
        document.dispatchEvent(event);
    }
}