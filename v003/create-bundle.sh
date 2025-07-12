#!/bin/bash

# Create a clean bundle without any imports/exports
echo "// Auto-generated bundle to bypass CORS" > main-bundled.js
echo "" >> main-bundled.js

# First, add the existing working bundle content (up to where we export for debugging)
head -1237 main-bundle.js >> main-bundled.js

# Then add GUI code without imports
echo "" >> main-bundled.js
echo "// GUI Components and Systems" >> main-bundled.js
echo "" >> main-bundled.js

# Process each GUI file and remove imports/exports
for file in utils/UIUtils.js components/GUIComponent.js components/InventoryGUI.js components/CharacterSheetGUI.js components/QuestJournalGUI.js components/DialogueGUI.js components/HUD.js components/ShopGUI.js systems/GUISystem.js; do
    echo "// === $file ===" >> main-bundled.js
    sed -E '/^import .* from /d; /^export default/d; s/^export (class|const|function)/\1/g' "$file" >> main-bundled.js
    echo "" >> main-bundled.js
done

# Add the GUI initialization code
cat << 'EOF' >> main-bundled.js

// Register GUI components
window.GUIComponent = GUIComponent;
window.InventoryGUI = InventoryGUI;
window.CharacterSheetGUI = CharacterSheetGUI;
window.QuestJournalGUI = QuestJournalGUI;
window.DialogueGUI = DialogueGUI;
window.HUD = HUD;
window.ShopGUI = ShopGUI;

// Add GUI system
world.addSystem(new GUISystem(world));

// Initialize GUI for player
function initializePlayerGUI() {
    // Add GUI components to player
    player.addComponent(new GUIComponent());
    player.addComponent(new HUD());
    
    // Create inventory GUI entity
    const inventoryEntity = world.createEntity();
    inventoryEntity.addComponent(new InventoryGUI());
    inventoryEntity.addComponent(new GUIComponent());
    
    // Create character sheet GUI entity
    const characterSheetEntity = world.createEntity();
    characterSheetEntity.addComponent(new CharacterSheetGUI());
    characterSheetEntity.addComponent(new GUIComponent());
    
    // Create quest journal GUI entity
    const questJournalEntity = world.createEntity();
    questJournalEntity.addComponent(new QuestJournalGUI());
    questJournalEntity.addComponent(new GUIComponent());
    
    // Store GUI references
    window.playerGUI = {
        player: player,
        inventory: inventoryEntity,
        characterSheet: characterSheetEntity,
        questJournal: questJournalEntity
    };
    
    console.log("GUI initialized for player");
}

initializePlayerGUI();

// Test GUI functionality
function testGUI() {
    console.log("Testing GUI components...");
    
    // Add some test items to player inventory
    const playerInventory = player.getComponent("InventoryComponent");
    if (playerInventory) {
        playerInventory.items[0] = {
            id: "sword_01",
            name: "Iron Sword",
            type: "weapon",
            quantity: 1,
            weight: 5,
            value: 100,
            damage: 10
        };
        
        playerInventory.items[1] = {
            id: "potion_01",
            name: "Health Potion",
            type: "consumable",
            quantity: 5,
            weight: 0.5,
            value: 50
        };
        
        playerInventory.items[2] = {
            id: "armor_01",
            name: "Leather Armor",
            type: "armor",
            quantity: 1,
            weight: 10,
            value: 200,
            defense: 5
        };
        
        console.log("Added test items to inventory");
    }
    
    // Set player character stats
    const playerCharacter = player.getComponent("CharacterComponent");
    if (playerCharacter) {
        playerCharacter.name = "Test Hero";
        playerCharacter.level = 5;
        playerCharacter.experience = 2500;
        playerCharacter.experienceToNext = 3000;
        playerCharacter.stats.currentHealth = 80;
        playerCharacter.stats.maxHealth = 100;
        playerCharacter.stats.currentMana = 45;
        playerCharacter.stats.maxMana = 50;
        
        console.log("Set player character stats");
    }
}

// Run GUI test after a short delay
setTimeout(testGUI, 1000);

// Keyboard shortcuts for GUI
window.addEventListener("keydown", (e) => {
    // Don't trigger shortcuts if typing in an input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    
    switch(e.key.toLowerCase()) {
        case "i":
            console.log("Toggle inventory");
            const invGUI = window.playerGUI.inventory.getComponent("InventoryGUI");
            if (invGUI) invGUI.toggle();
            break;
        case "c":
            console.log("Toggle character sheet");
            const charGUI = window.playerGUI.characterSheet.getComponent("CharacterSheetGUI");
            if (charGUI) charGUI.toggle();
            break;
        case "j":
            console.log("Toggle quest journal");
            const questGUI = window.playerGUI.questJournal.getComponent("QuestJournalGUI");
            if (questGUI) questGUI.toggle();
            break;
        case "escape":
            console.log("Close all windows");
            // Close all GUI windows
            world.entities.forEach(entity => {
                const gui = entity.getComponent("GUIComponent");
                if (gui && gui.guiType !== "hud") {
                    gui.close();
                }
            });
            break;
    }
});
EOF