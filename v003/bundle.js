// Bundle all modules into one file to bypass CORS
// Run this with: node bundle.js

const fs = require('fs');
const path = require('path');

const files = [
    // Core ECS
    'core/Component.js',
    'core/Entity.js',
    'core/System.js',
    'core/World.js',
    'core/DevTools.js',
    
    // Utils
    'utils/UIUtils.js',
    
    // Components
    'components/TransformComponent.js',
    'components/RenderComponent.js',
    'components/NameComponent.js',
    'components/VelocityComponent.js',
    'components/ScriptComponent.js',
    'components/TagComponent.js',
    'components/AnimatorComponent.js',
    'components/CameraComponent.js',
    'components/RigidbodyComponent.js',
    'components/BoxColliderComponent.js',
    'components/SphereColliderComponent.js',
    'components/PlayerControllerComponent.js',
    'components/InputComponent.js',
    'components/PartyComponent.js',
    'components/CharacterComponent.js',
    'components/AIComponent.js',
    'components/CombatComponent.js',
    'components/InventoryComponent.js',
    'components/GUIComponent.js',
    'components/InventoryGUI.js',
    'components/CharacterSheetGUI.js',
    'components/QuestJournalGUI.js',
    'components/DialogueGUI.js',
    'components/HUD.js',
    'components/ShopGUI.js',
    
    // Systems
    'systems/RenderSystem.js',
    'systems/MovementSystem.js',
    'systems/AnimationSystem.js',
    'systems/ScriptSystem.js',
    'systems/PhysicsSystem.js',
    'systems/PlayerControllerSystem.js',
    'systems/CollisionSystem.js',
    'systems/PartySystem.js',
    'systems/CharacterSystem.js',
    'systems/AISystem.js',
    'systems/CombatSystem.js',
    'systems/InventorySystem.js',
    'systems/GUISystem.js',
    
    // Main initialization
    'main.js'
];

let bundle = '// Auto-generated bundle to bypass CORS\n\n';

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Remove import statements
        content = content.replace(/^import\s+.*?from\s+.*?;?\s*$/gm, '');
        
        // Remove export statements but keep the class/const declarations
        content = content.replace(/^export\s+(class|const|function|let|var)\s+/gm, '$1 ');
        content = content.replace(/^export\s+default\s+/gm, '');
        content = content.replace(/^export\s+\{[^}]*\};\s*$/gm, '');
        
        bundle += `// === ${file} ===\n${content}\n\n`;
    }
});

fs.writeFileSync('main-bundled.js', bundle);
console.log('Bundle created: main-bundled.js');