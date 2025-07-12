import { World } from './core/World.js';
import { Entity } from './core/Entity.js';
import { Component } from './core/Component.js';
import { System } from './core/System.js';

// Import core components
import { TransformComponent } from './components/TransformComponent.js';
import { RenderComponent } from './components/RenderComponent.js';
import { NameComponent } from './components/NameComponent.js';
import { VelocityComponent } from './components/VelocityComponent.js';
import { ScriptComponent } from './components/ScriptComponent.js';
import { TagComponent } from './components/TagComponent.js';
// Physics components imported separately below
import { AnimatorComponent } from './components/AnimatorComponent.js';
import { CameraComponent } from './components/CameraComponent.js';

// Import Phase 3 components
import { PartyComponent } from './components/PartyComponent.js';
import { CharacterComponent } from './components/CharacterComponent.js';
import { AIComponent } from './components/AIComponent.js';
import { CombatComponent } from './components/CombatComponent.js';
import { InventoryComponent } from './components/InventoryComponent.js';

// Import GUI components
import { GUIComponent } from './components/GUIComponent.js';
import { InventoryGUI } from './components/InventoryGUI.js';
import { CharacterSheetGUI } from './components/CharacterSheetGUI.js';
import { QuestJournalGUI } from './components/QuestJournalGUI.js';
import { DialogueGUI } from './components/DialogueGUI.js';
import { HUD } from './components/HUD.js';
import { ShopGUI } from './components/ShopGUI.js';

// Import systems
import { RenderSystem } from './systems/RenderSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { AnimationSystem } from './systems/AnimationSystem.js';
import { ScriptSystem } from './systems/ScriptSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { PlayerControllerSystem } from './systems/PlayerControllerSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';

// Import Phase 3 systems
import { PartySystem } from './systems/PartySystem.js';
import { CharacterSystem } from './systems/CharacterSystem.js';
import { AISystem } from './systems/AISystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { InventorySystem } from './systems/InventorySystem.js';

// Import GUI system
import { GUISystem } from './systems/GUISystem.js';

// Import player controller components
import { PlayerControllerComponent } from './components/PlayerControllerComponent.js';
import { InputComponent } from './components/InputComponent.js';

// Import physics components
import { RigidbodyComponent } from './components/RigidbodyComponent.js';
import { BoxColliderComponent } from './components/BoxColliderComponent.js';
import { SphereColliderComponent } from './components/SphereColliderComponent.js';

// Three.js setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.BoxGeometry(50, 1, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x90EE90 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// Grid helper
const gridHelper = new THREE.GridHelper(50, 50, 0x000000, 0x000000);
gridHelper.material.opacity = 0.2;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// Initialize ECS
const world = new World();

// Register all components globally for inspector
window.Component = Component;
window.TransformComponent = TransformComponent;
window.RenderComponent = RenderComponent;
window.NameComponent = NameComponent;
window.VelocityComponent = VelocityComponent;
window.ScriptComponent = ScriptComponent;
window.TagComponent = TagComponent;
// Physics components registered individually
window.AnimatorComponent = AnimatorComponent;
window.CameraComponent = CameraComponent;
window.PartyComponent = PartyComponent;
window.CharacterComponent = CharacterComponent;
window.AIComponent = AIComponent;
window.CombatComponent = CombatComponent;
window.InventoryComponent = InventoryComponent;
window.PlayerControllerComponent = PlayerControllerComponent;
window.InputComponent = InputComponent;
window.RigidbodyComponent = RigidbodyComponent;
window.BoxColliderComponent = BoxColliderComponent;
window.SphereColliderComponent = SphereColliderComponent;
// GUI components
window.GUIComponent = GUIComponent;
window.InventoryGUI = InventoryGUI;
window.CharacterSheetGUI = CharacterSheetGUI;
window.QuestJournalGUI = QuestJournalGUI;
window.DialogueGUI = DialogueGUI;
window.HUD = HUD;
window.ShopGUI = ShopGUI;

// Add systems
world.addSystem(new RenderSystem(world, scene));
world.addSystem(new MovementSystem(world));
world.addSystem(new AnimationSystem(world));
world.addSystem(new ScriptSystem(world));
world.addSystem(new PhysicsSystem(world));
world.addSystem(new PlayerControllerSystem(world));
world.addSystem(new CollisionSystem(world));
world.addSystem(new PartySystem(world));
world.addSystem(new CharacterSystem(world));
world.addSystem(new AISystem(world));
world.addSystem(new CombatSystem(world));
world.addSystem(new InventorySystem(world));
world.addSystem(new GUISystem(world));

// Create player entity
function createPlayer() {
    const player = world.createEntity();
    player.addComponent(new NameComponent('Player'));
    player.addComponent(new TransformComponent());
    player.addComponent(new RenderComponent());
    player.addComponent(new PlayerControllerComponent());
    player.addComponent(new InputComponent());
    player.addComponent(new RigidbodyComponent());
    player.addComponent(new SphereColliderComponent());
    player.addComponent(new CharacterComponent());
    player.addComponent(new InventoryComponent());
    
    // Set up player mesh
    const playerGeometry = new THREE.CapsuleGeometry(0.5, 1.6, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    playerMesh.castShadow = true;
    
    const render = player.getComponent('RenderComponent');
    render.mesh = playerMesh;
    scene.add(playerMesh);
    
    // Position player
    const transform = player.getComponent('TransformComponent');
    transform.position.set(0, 2, 0);
    
    // Set up collider
    const collider = player.getComponent('SphereColliderComponent');
    collider.radius = 0.5;
    
    return player;
}

// Create some demo entities
function createDemoEntities() {
    // Create a box
    const box = world.createEntity();
    box.addComponent(new NameComponent('Interactive Box'));
    box.addComponent(new TransformComponent());
    box.addComponent(new RenderComponent());
    box.addComponent(new BoxColliderComponent());
    box.addComponent(new TagComponent(['interactable']));
    
    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    boxMesh.castShadow = true;
    
    const boxRender = box.getComponent('RenderComponent');
    boxRender.mesh = boxMesh;
    scene.add(boxMesh);
    
    const boxTransform = box.getComponent('TransformComponent');
    boxTransform.position.set(5, 1, 0);
    
    // Create walls
    createWall(0, 1, -25, 50, 4, 1); // North
    createWall(0, 1, 25, 50, 4, 1);  // South
    createWall(-25, 1, 0, 1, 4, 50); // West
    createWall(25, 1, 0, 1, 4, 50);  // East
}

function createWall(x, y, z, width, height, depth) {
    const wall = world.createEntity();
    wall.addComponent(new NameComponent('Wall'));
    wall.addComponent(new TransformComponent());
    wall.addComponent(new RenderComponent());
    wall.addComponent(new BoxColliderComponent());
    wall.addComponent(new RigidbodyComponent());
    
    const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    
    const render = wall.getComponent('RenderComponent');
    render.mesh = wallMesh;
    scene.add(wallMesh);
    
    const transform = wall.getComponent('TransformComponent');
    transform.position.set(x, y, z);
    
    const collider = wall.getComponent('BoxColliderComponent');
    collider.size.set(width, height, depth);
    
    const rigidbody = wall.getComponent('RigidbodyComponent');
    rigidbody.isKinematic = true; // Walls don't move
}

// Initialize entities
const player = createPlayer();
createDemoEntities();

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
    
    console.log('GUI initialized for player');
}

initializePlayerGUI();

// Camera follow
function updateCamera() {
    const playerTransform = player.getComponent('TransformComponent');
    if (playerTransform) {
        const offset = new THREE.Vector3(10, 10, 10);
        camera.position.copy(playerTransform.position).add(offset);
        camera.lookAt(playerTransform.position);
    }
}

// Make world and player accessible globally for debugging
window.world = world;
window.player = player;

// UI Setup
const entityCount = document.getElementById('entityCount');
const componentCount = document.getElementById('componentCount');
const systemCount = document.getElementById('systemCount');
const queryCount = document.getElementById('queryCount');
const performance = document.getElementById('performance');

// Update UI stats
function updateStats() {
    entityCount.textContent = world.entities.size;
    componentCount.textContent = world.entities.size * 5; // Approximate
    systemCount.textContent = world.systems.length;
    queryCount.textContent = world.queryCache.size;
    performance.textContent = `${Math.round(1000 / 16)}fps`; // Approximate
}

// Button handlers
document.getElementById('createBtn').addEventListener('click', () => {
    const entity = world.createEntity();
    entity.addComponent(new NameComponent(`Entity ${world.entities.size}`));
    entity.addComponent(new TransformComponent());
    entity.addComponent(new RenderComponent());
    
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(Math.random(), Math.random(), Math.random()) 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    
    const render = entity.getComponent('RenderComponent');
    render.mesh = mesh;
    scene.add(mesh);
    
    const transform = entity.getComponent('TransformComponent');
    transform.position.set(
        (Math.random() - 0.5) * 20,
        Math.random() * 5 + 1,
        (Math.random() - 0.5) * 20
    );
    
    updateStats();
});

document.getElementById('clearBtn').addEventListener('click', () => {
    // Remove all entities except player
    world.entities.forEach(entity => {
        if (entity !== player) {
            const render = entity.getComponent('RenderComponent');
            if (render && render.mesh) {
                scene.remove(render.mesh);
            }
            world.removeEntity(entity);
        }
    });
    updateStats();
});

document.getElementById('queryBtn').addEventListener('click', () => {
    const results = world.query(['TransformComponent', 'RenderComponent']);
    console.log(`Query found ${results.length} entities with Transform and Render components`);
});

document.getElementById('stressBtn').addEventListener('click', () => {
    for (let i = 0; i < 100; i++) {
        const entity = world.createEntity();
        entity.addComponent(new NameComponent(`Stress Entity ${i}`));
        entity.addComponent(new TransformComponent());
        entity.addComponent(new VelocityComponent());
        
        const transform = entity.getComponent('TransformComponent');
        transform.position.set(
            (Math.random() - 0.5) * 40,
            Math.random() * 10 + 1,
            (Math.random() - 0.5) * 40
        );
        
        const velocity = entity.getComponent('VelocityComponent');
        velocity.velocity.set(
            (Math.random() - 0.5) * 5,
            0,
            (Math.random() - 0.5) * 5
        );
    }
    updateStats();
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Keyboard shortcuts for GUI
window.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key.toLowerCase()) {
        case 'i':
            console.log('Toggle inventory');
            const invGUI = window.playerGUI.inventory.getComponent('InventoryGUI');
            if (invGUI) invGUI.toggle();
            break;
        case 'c':
            console.log('Toggle character sheet');
            const charGUI = window.playerGUI.characterSheet.getComponent('CharacterSheetGUI');
            if (charGUI) charGUI.toggle();
            break;
        case 'j':
            console.log('Toggle quest journal');
            const questGUI = window.playerGUI.questJournal.getComponent('QuestJournalGUI');
            if (questGUI) questGUI.toggle();
            break;
        case 'escape':
            console.log('Close all windows');
            // Close all GUI windows
            world.entities.forEach(entity => {
                const gui = entity.getComponent('GUIComponent');
                if (gui && gui.guiType !== 'hud') {
                    gui.close();
                }
            });
            break;
    }
});

// Test GUI functionality
function testGUI() {
    console.log('Testing GUI components...');
    
    // Add some test items to player inventory
    const playerInventory = player.getComponent('InventoryComponent');
    if (playerInventory) {
        playerInventory.addItem({
            id: 'sword_01',
            name: 'Iron Sword',
            type: 'weapon',
            quantity: 1,
            weight: 5,
            value: 100,
            damage: 10
        });
        
        playerInventory.addItem({
            id: 'potion_01',
            name: 'Health Potion',
            type: 'consumable',
            quantity: 5,
            weight: 0.5,
            value: 50
        });
        
        playerInventory.addItem({
            id: 'armor_01',
            name: 'Leather Armor',
            type: 'armor',
            quantity: 1,
            weight: 10,
            value: 200,
            defense: 5
        });
        
        console.log('Added test items to inventory');
    }
    
    // Set player character stats
    const playerCharacter = player.getComponent('CharacterComponent');
    if (playerCharacter) {
        playerCharacter.name = 'Test Hero';
        playerCharacter.level = 5;
        playerCharacter.experience = 2500;
        playerCharacter.experienceToNext = 3000;
        playerCharacter.currentHealth = 80;
        playerCharacter.maxHealth = 100;
        playerCharacter.currentMana = 45;
        playerCharacter.maxMana = 50;
        
        console.log('Set player character stats');
    }
}

// Run GUI test after a short delay
setTimeout(testGUI, 1000);

// Animation loop
let lastTime = 0;
function animate(currentTime) {
    requestAnimationFrame(animate);
    
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // Update world
    world.update(deltaTime);
    
    // Update camera
    updateCamera();
    
    // Update stats
    updateStats();
    
    // Render
    renderer.render(scene, camera);
}

// Initialize icons
lucide.createIcons();

// Start animation
requestAnimationFrame(animate);

// Export for debugging
window.world = world;
window.scene = scene;
window.camera = camera;
window.player = player;