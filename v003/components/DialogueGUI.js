import GUIComponent from './GUIComponent.js';
import { UIConstants, UIFactory } from '../utils/UIUtils.js';

export default class DialogueGUI extends GUIComponent {
    constructor() {
        super();
        this.guiType = 'dialogue';
        this.size = { width: 600, height: 400 };
        this.position = { x: 'center', y: 'bottom' }; // Special positioning
        
        // Dialogue state
        this.currentSpeaker = null;
        this.currentText = '';
        this.currentChoices = [];
        this.typewriterSpeed = 30; // ms per character
        this.isTyping = false;
        this.skipTyping = false;
    }
    
    createDialogueContainer() {
        // Main method called by GUISystem - create empty container for now
        const container = document.createElement('div');
        container.className = 'dialogue-container';
        container.style.cssText = `
            background: linear-gradient(to bottom, rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.85));
            border: 2px solid #444;
            border-radius: 10px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            height: 100%;
            color: #fff;
            text-align: center;
        `;
        
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'margin-top: 50px; color: #666;';
        placeholder.textContent = 'No active dialogue';
        container.appendChild(placeholder);
        
        return container;
    }
    
    updateDialogue(dialogueComponent) {
        // Update the dialogue display with new content
        const container = document.querySelector('.dialogue-container');
        if (!container || !dialogueComponent) return;
        
        // Clear and update with new dialogue
        container.innerHTML = '';
        const newContent = this.createDialogueDisplay(dialogueComponent.currentNode, dialogueComponent.characterName);
        container.appendChild(newContent);
    }
    
    createDialogueDisplay(dialogueNode, speaker) {
        const container = document.createElement('div');
        container.className = 'dialogue-container';
        container.style.cssText = `
            background: linear-gradient(to bottom, rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.85));
            border: 2px solid #444;
            border-radius: 10px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            height: 100%;
        `;
        
        // Speaker name
        const speakerElement = document.createElement('div');
        speakerElement.className = 'dialogue-speaker';
        speakerElement.style.cssText = `
            color: #FFC107;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #444;
        `;
        speakerElement.textContent = speaker || 'Unknown';
        container.appendChild(speakerElement);
        
        // Dialogue text
        const textElement = document.createElement('div');
        textElement.className = 'dialogue-text';
        textElement.style.cssText = `
            flex: 1;
            color: #fff;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        `;
        container.appendChild(textElement);
        
        // Choices
        const choicesElement = document.createElement('div');
        choicesElement.className = 'dialogue-choices';
        choicesElement.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        container.appendChild(choicesElement);
        
        // Start dialogue display
        this.displayDialogue(dialogueNode, textElement, choicesElement);
        
        return container;
    }
    
    displayDialogue(dialogueNode, textElement, choicesElement) {
        if (!dialogueNode) return;
        
        this.currentText = dialogueNode.text;
        this.currentChoices = dialogueNode.choices || [];
        
        // Clear previous content
        textElement.innerHTML = '';
        choicesElement.innerHTML = '';
        
        // Typewriter effect for text
        this.typewriterEffect(textElement, this.currentText, () => {
            // Show choices after text is complete
            this.displayChoices(choicesElement, this.currentChoices);
        });
    }
    
    typewriterEffect(element, text, onComplete) {
        this.isTyping = true;
        let index = 0;
        
        const type = () => {
            if (this.skipTyping || index >= text.length) {
                element.textContent = text;
                this.isTyping = false;
                if (onComplete) onComplete();
                return;
            }
            
            element.textContent = text.substring(0, index + 1);
            index++;
            setTimeout(type, this.typewriterSpeed);
        };
        
        type();
        
        // Allow skip on click
        element.addEventListener('click', () => {
            if (this.isTyping) {
                this.skipTyping = true;
            }
        });
    }
    
    displayChoices(choicesElement, choices) {
        choices.forEach((choice, index) => {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'dialogue-choice';
            choiceButton.style.cssText = `
                padding: 12px 20px;
                background: rgba(33, 150, 243, 0.2);
                border: 1px solid #2196F3;
                border-radius: 5px;
                color: #fff;
                cursor: pointer;
                transition: all 0.2s;
                text-align: left;
                font-size: 14px;
            `;
            
            choiceButton.textContent = `${index + 1}. ${choice.text}`;
            
            choiceButton.addEventListener('mouseenter', () => {
                choiceButton.style.background = 'rgba(33, 150, 243, 0.4)';
                choiceButton.style.transform = 'translateX(10px)';
            });
            
            choiceButton.addEventListener('mouseleave', () => {
                choiceButton.style.background = 'rgba(33, 150, 243, 0.2)';
                choiceButton.style.transform = 'translateX(0)';
            });
            
            choiceButton.addEventListener('click', () => {
                const event = new CustomEvent('dialogueChoice', {
                    detail: { choiceIndex: index, choice: choice }
                });
                document.dispatchEvent(event);
            });
            
            // Keyboard shortcut
            if (index < 9) {
                const shortcut = document.createElement('span');
                shortcut.style.cssText = 'opacity: 0.6; font-size: 12px;';
                shortcut.textContent = ` (Press ${index + 1})`;
                choiceButton.appendChild(shortcut);
            }
            
            choicesElement.appendChild(choiceButton);
        });
    }
}