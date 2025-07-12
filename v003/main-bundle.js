// ECS Core Classes
class Component {
    constructor() {
        this.active = true;
    }
}

class Entity {
    constructor(world, id) {
        this.world = world;
        this.id = id;
        this.components = new Map();
    }
    
    addComponent(component) {
        const type = component.constructor.name;
        this.components.set(type, component);
        this.world.invalidateQueryCache();
        return component;
    }
    
    getComponent(type) {
        return this.components.get(type);
    }
    
    hasComponent(type) {
        return this.components.has(type);
    }
    
    removeComponent(type) {
        this.components.delete(type);
        this.world.invalidateQueryCache();
    }
}

class System {
    constructor(world) {
        this.world = world;
        this.enabled = true;
        this.priority = 0;
        this.requiredComponents = [];
    }
    
    update(deltaTime) {
        // Override in subclasses
    }
}

class World {
    constructor() {
        this.entities = new Set();
        this.systems = [];
        this.queryCache = new Map();
        this.nextEntityId = 1;
    }
    
    createEntity() {
        const entity = new Entity(this, this.nextEntityId++);
        this.entities.add(entity);
        
        this.systems.forEach(system => {
            if (system.onEntityAdded) {
                system.onEntityAdded(entity);
            }
        });
        
        return entity;
    }
    
    removeEntity(entity) {
        this.systems.forEach(system => {
            if (system.onEntityRemoved) {
                system.onEntityRemoved(entity);
            }
        });
        
        this.entities.delete(entity);
        
        this.queryCache.forEach((entities, key) => {
            entities.delete(entity);
        });
    }
    
    addSystem(system) {
        this.systems.push(system);
        this.systems.sort((a, b) => (a.priority || 0) - (b.priority || 0));
        return system;
    }
    
    query(componentTypes) {
        const key = componentTypes.sort().join(',');
        
        if (this.queryCache.has(key)) {
            return Array.from(this.queryCache.get(key));
        }
        
        const results = new Set();
        this.entities.forEach(entity => {
            if (componentTypes.every(type => entity.hasComponent(type))) {
                results.add(entity);
            }
        });
        
        this.queryCache.set(key, results);
        return Array.from(results);
    }
    
    invalidateQueryCache() {
        this.queryCache.clear();
    }
    
    update(deltaTime) {
        this.systems.forEach(system => {
            if (system.enabled) {
                system.update(deltaTime);
            }
        });
    }
    
    getEntityById(id) {
        for (const entity of this.entities) {
            if (entity.id === id) {
                return entity;
            }
        }
        return null;
    }
}

// Components
class TransformComponent extends Component {
    constructor(x = 0, y = 0, z = 0) {
        super();
        this.position = new THREE.Vector3(x, y, z);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.scale = new THREE.Vector3(1, 1, 1);
    }
}

class RenderComponent extends Component {
    constructor() {
        super();
        this.mesh = null;
        this.visible = true;
        this.castShadow = true;
        this.receiveShadow = true;
    }
}

class NameComponent extends Component {
    constructor(name = 'Entity') {
        super();
        this.name = name;
    }
}

class VelocityComponent extends Component {
    constructor() {
        super();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.angularVelocity = new THREE.Vector3(0, 0, 0);
        this.damping = 0.98;
        this.maxSpeed = 10;
    }
    
    applyDamping() {
        this.velocity.x *= this.damping;
        this.velocity.y *= this.damping;
        this.velocity.z *= this.damping;
    }
}

class PlayerControllerComponent extends Component {
    constructor() {
        super();
        this.moveSpeed = 5.0;
        this.jumpForce = 10.0;
        this.isGrounded = false;
        this.isJumping = false;
        this.jumpVelocity = 0;
    }
    
    jump() {
        if (this.isGrounded && !this.isJumping) {
            this.isJumping = true;
            this.jumpVelocity = this.jumpForce;
            return true;
        }
        return false;
    }
    
    land() {
        this.isGrounded = true;
        this.isJumping = false;
        this.jumpVelocity = 0;
    }
}

class InputComponent extends Component {
    constructor() {
        super();
        this.keys = {};
        this.mouse = { x: 0, y: 0, buttons: {} };
        
        // Set up input listeners
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') {
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        document.addEventListener('mousedown', (e) => {
            this.mouse.buttons[e.button] = true;
        });
        
        document.addEventListener('mouseup', (e) => {
            this.mouse.buttons[e.button] = false;
        });
    }
}

class RigidbodyComponent extends Component {
    constructor() {
        super();
        this.mass = 1.0;
        this.drag = 0.01;
        this.useGravity = true;
        this.isKinematic = false;
    }
}

class BoxColliderComponent extends Component {
    constructor() {
        super();
        this.size = new THREE.Vector3(1, 1, 1);
        this.offset = new THREE.Vector3(0, 0, 0);
        this.isTrigger = false;
    }
    
    setSize(x, y, z) {
        this.size.set(x, y, z);
    }
    
    getBounds(position) {
        return {
            min: new THREE.Vector3(
                position.x + this.offset.x - this.size.x / 2,
                position.y + this.offset.y - this.size.y / 2,
                position.z + this.offset.z - this.size.z / 2
            ),
            max: new THREE.Vector3(
                position.x + this.offset.x + this.size.x / 2,
                position.y + this.offset.y + this.size.y / 2,
                position.z + this.offset.z + this.size.z / 2
            )
        };
    }
}

class SphereColliderComponent extends Component {
    constructor() {
        super();
        this.radius = 0.5;
        this.offset = new THREE.Vector3(0, 0, 0);
        this.isTrigger = false;
    }
    
    getCenter(position) {
        return new THREE.Vector3(
            position.x + this.offset.x,
            position.y + this.offset.y,
            position.z + this.offset.z
        );
    }
}

class TagComponent extends Component {
    constructor(tags = []) {
        super();
        this.tags = new Set(tags);
    }
    
    hasTag(tag) {
        return this.tags.has(tag);
    }
}

// Phase 3 Components
class PartyComponent extends Component {
    constructor() {
        super();
        this.members = [];
        this.maxMembers = 4;
        this.activeLeader = 0;
        this.formation = 'line';
        this.spacing = 2.0;
    }
}

class CharacterComponent extends Component {
    constructor() {
        super();
        this.name = 'Hero';
        this.level = 1;
        this.experience = 0;
        this.experienceToNextLevel = 100;
        this.stats = {
            maxHealth: 100,
            currentHealth: 100,
            maxMana: 50,
            currentMana: 50,
            strength: 10,
            intelligence: 10,
            dexterity: 10,
            constitution: 10,
            defense: 5,
            magicResist: 3,
            healthRegen: 1,
            manaRegen: 0.5
        };
    }
}

class AIComponent extends Component {
    constructor() {
        super();
        this.currentBehavior = 'idle';
        this.targetEntity = null;
        this.detectionRange = 10;
        this.attackRange = 2;
        this.aggression = 50;
        this.currentPath = [];
        this.stats = {
            moveSpeed: 3,
            attackSpeed: 1,
            attackCooldown: 0
        };
    }
}

class CombatComponent extends Component {
    constructor() {
        super();
        this.inCombat = false;
        this.abilities = [
            {
                name: 'basic',
                baseDamage: 10,
                damageType: 'physical',
                cooldown: 1.0,
                currentCooldown: 0,
                manaCost: 0,
                scaling: 0.5
            }
        ];
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboWindow = 2.0;
        this.criticalMultiplier = 2.0;
        this.dodgeCooldown = 0;
        this.isBlocking = false;
        this.isDodging = false;
        this.blockReduction = 0.5;
    }
}

class InventoryComponent extends Component {
    constructor() {
        super();
        this.slots = 20;
        this.items = new Array(this.slots).fill(null);
        this.equipment = {
            head: null,
            chest: null,
            legs: null,
            feet: null,
            mainHand: null,
            offHand: null
        };
        this.maxWeight = 100;
        this.currentWeight = 0;
    }
}

// Stub components for compatibility
class ScriptComponent extends Component {
    constructor() {
        super();
        this.scripts = [];
    }
}

class AnimationComponent extends Component {
    constructor() {
        super();
        this.mixer = null;
        this.animations = new Map();
    }
}

class PhysicsComponent extends Component {
    constructor() {
        super();
    }
}

class CameraComponent extends Component {
    constructor() {
        super();
        this.camera = null;
    }
}

// Systems
class RenderSystem extends System {
    constructor(world, scene) {
        super(world);
        this.scene = scene;
        this.requiredComponents = ['TransformComponent', 'RenderComponent'];
        this.priority = 100;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            const transform = entity.getComponent('TransformComponent');
            const render = entity.getComponent('RenderComponent');
            
            if (!render.active || !render.mesh) return;
            
            render.mesh.position.copy(transform.position);
            render.mesh.rotation.copy(transform.rotation);
            render.mesh.scale.copy(transform.scale);
            
            render.mesh.visible = render.visible;
            render.mesh.castShadow = render.castShadow;
            render.mesh.receiveShadow = render.receiveShadow;
        });
    }
}

class MovementSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['TransformComponent', 'VelocityComponent'];
        this.priority = 20;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            const transform = entity.getComponent('TransformComponent');
            const velocity = entity.getComponent('VelocityComponent');
            
            if (!velocity.active) return;
            
            transform.position.x += velocity.velocity.x * deltaTime;
            transform.position.y += velocity.velocity.y * deltaTime;
            transform.position.z += velocity.velocity.z * deltaTime;
            
            transform.rotation.x += velocity.angularVelocity.x * deltaTime;
            transform.rotation.y += velocity.angularVelocity.y * deltaTime;
            transform.rotation.z += velocity.angularVelocity.z * deltaTime;
            
            velocity.applyDamping();
        });
    }
}

class PhysicsSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['RigidbodyComponent', 'TransformComponent'];
        this.priority = 25;
        this.gravity = new THREE.Vector3(0, -20, 0);
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            const rigidbody = entity.getComponent('RigidbodyComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!rigidbody.active || rigidbody.isKinematic) return;
            
            let velocity = entity.getComponent('VelocityComponent');
            if (!velocity) {
                entity.addComponent(new VelocityComponent());
                velocity = entity.getComponent('VelocityComponent');
            }
            
            if (rigidbody.useGravity) {
                velocity.velocity.y += this.gravity.y * deltaTime;
            }
            
            const controller = entity.getComponent('PlayerControllerComponent');
            if (controller) {
                if (transform.position.y <= 1 && velocity.velocity.y <= 0) {
                    transform.position.y = 1;
                    velocity.velocity.y = 0;
                    controller.isGrounded = true;
                    controller.isJumping = false;
                } else {
                    controller.isGrounded = false;
                }
            }
        });
    }
}

class PlayerControllerSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['PlayerControllerComponent', 'InputComponent', 'TransformComponent'];
        this.priority = 10;
        this.gravity = -20;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(this.requiredComponents);
        
        entities.forEach(entity => {
            const controller = entity.getComponent('PlayerControllerComponent');
            const input = entity.getComponent('InputComponent');
            const transform = entity.getComponent('TransformComponent');
            
            if (!controller.active || !input.active) return;
            
            // Movement
            const moveX = (input.keys['KeyA'] || input.keys['ArrowLeft'] ? -1 : 0) + 
                         (input.keys['KeyD'] || input.keys['ArrowRight'] ? 1 : 0);
            const moveZ = (input.keys['KeyW'] || input.keys['ArrowUp'] ? -1 : 0) + 
                         (input.keys['KeyS'] || input.keys['ArrowDown'] ? 1 : 0);
            
            let moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
            if (moveLength > 0) {
                const normalizedX = moveX / moveLength;
                const normalizedZ = moveZ / moveLength;
                
                transform.position.x += normalizedX * controller.moveSpeed * deltaTime;
                transform.position.z += normalizedZ * controller.moveSpeed * deltaTime;
            }
            
            // Jump handling
            if (input.keys['Space'] && controller.isGrounded && !controller.isJumping) {
                controller.jump();
            }
            
            // Apply jump physics
            if (controller.isJumping || !controller.isGrounded) {
                controller.jumpVelocity += this.gravity * deltaTime;
                transform.position.y += controller.jumpVelocity * deltaTime;
                
                if (transform.position.y <= 1) {
                    transform.position.y = 1;
                    controller.land();
                }
            }
        });
    }
}

class CollisionSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['TransformComponent'];
        this.priority = 30;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        const entities = this.world.query(['TransformComponent']);
        const colliderEntities = entities.filter(entity => 
            entity.hasComponent('BoxColliderComponent') || 
            entity.hasComponent('SphereColliderComponent')
        );
        
        for (let i = 0; i < colliderEntities.length; i++) {
            for (let j = i + 1; j < colliderEntities.length; j++) {
                this.checkCollision(colliderEntities[i], colliderEntities[j]);
            }
        }
    }
    
    checkCollision(entityA, entityB) {
        const transformA = entityA.getComponent('TransformComponent');
        const transformB = entityB.getComponent('TransformComponent');
        
        const rigidbodyA = entityA.getComponent('RigidbodyComponent');
        const rigidbodyB = entityB.getComponent('RigidbodyComponent');
        
        if (rigidbodyA && rigidbodyB && rigidbodyA.isKinematic && rigidbodyB.isKinematic) {
            return;
        }
        
        const sphereA = entityA.getComponent('SphereColliderComponent');
        const sphereB = entityB.getComponent('SphereColliderComponent');
        const boxA = entityA.getComponent('BoxColliderComponent');
        const boxB = entityB.getComponent('BoxColliderComponent');
        
        let collision = null;
        
        if (sphereA && sphereB) {
            collision = this.sphereSphereCollision(
                transformA.position, sphereA,
                transformB.position, sphereB
            );
        } else if (boxA && boxB) {
            collision = this.boxBoxCollision(
                transformA.position, boxA,
                transformB.position, boxB
            );
        } else if (sphereA && boxB) {
            collision = this.sphereBoxCollision(
                transformA.position, sphereA,
                transformB.position, boxB
            );
        } else if (boxA && sphereB) {
            collision = this.sphereBoxCollision(
                transformB.position, sphereB,
                transformA.position, boxA
            );
            if (collision) {
                collision.normal.x *= -1;
                collision.normal.y *= -1;
                collision.normal.z *= -1;
            }
        }
        
        if (collision) {
            this.resolveCollision(entityA, entityB, collision);
        }
    }
    
    sphereSphereCollision(posA, sphereA, posB, sphereB) {
        if (!sphereA.active || !sphereB.active) return null;
        
        const centerA = sphereA.getCenter(posA);
        const centerB = sphereB.getCenter(posB);
        
        const dx = centerB.x - centerA.x;
        const dy = centerB.y - centerA.y;
        const dz = centerB.z - centerA.z;
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDistance = sphereA.radius + sphereB.radius;
        
        if (distance < minDistance) {
            const normal = new THREE.Vector3(
                dx / distance,
                dy / distance,
                dz / distance
            );
            
            return {
                normal: normal,
                depth: minDistance - distance
            };
        }
        
        return null;
    }
    
    boxBoxCollision(posA, boxA, posB, boxB) {
        if (!boxA.active || !boxB.active) return null;
        
        const boundsA = boxA.getBounds(posA);
        const boundsB = boxB.getBounds(posB);
        
        const overlapX = Math.min(boundsA.max.x, boundsB.max.x) - Math.max(boundsA.min.x, boundsB.min.x);
        const overlapY = Math.min(boundsA.max.y, boundsB.max.y) - Math.max(boundsA.min.y, boundsB.min.y);
        const overlapZ = Math.min(boundsA.max.z, boundsB.max.z) - Math.max(boundsA.min.z, boundsB.min.z);
        
        if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
            let normal = new THREE.Vector3(0, 0, 0);
            let depth = Infinity;
            
            if (overlapX < overlapY && overlapX < overlapZ) {
                depth = overlapX;
                normal.x = posA.x < posB.x ? -1 : 1;
            } else if (overlapY < overlapZ) {
                depth = overlapY;
                normal.y = posA.y < posB.y ? -1 : 1;
            } else {
                depth = overlapZ;
                normal.z = posA.z < posB.z ? -1 : 1;
            }
            
            return { normal, depth };
        }
        
        return null;
    }
    
    sphereBoxCollision(spherePos, sphere, boxPos, box) {
        if (!sphere.active || !box.active) return null;
        
        const center = sphere.getCenter(spherePos);
        const bounds = box.getBounds(boxPos);
        
        const closest = new THREE.Vector3(
            Math.max(bounds.min.x, Math.min(center.x, bounds.max.x)),
            Math.max(bounds.min.y, Math.min(center.y, bounds.max.y)),
            Math.max(bounds.min.z, Math.min(center.z, bounds.max.z))
        );
        
        const dx = center.x - closest.x;
        const dy = center.y - closest.y;
        const dz = center.z - closest.z;
        
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        
        if (distanceSquared < sphere.radius * sphere.radius) {
            const distance = Math.sqrt(distanceSquared);
            const normal = distance > 0 ? new THREE.Vector3(
                dx / distance,
                dy / distance,
                dz / distance
            ) : new THREE.Vector3(0, 1, 0);
            
            return {
                normal: normal,
                depth: sphere.radius - distance
            };
        }
        
        return null;
    }
    
    resolveCollision(entityA, entityB, collision) {
        const transformA = entityA.getComponent('TransformComponent');
        const transformB = entityB.getComponent('TransformComponent');
        const rigidbodyA = entityA.getComponent('RigidbodyComponent');
        const rigidbodyB = entityB.getComponent('RigidbodyComponent');
        
        if (!rigidbodyA && !rigidbodyB) return;
        
        const separation = collision.depth / 2;
        
        if (rigidbodyA && !rigidbodyA.isKinematic) {
            transformA.position.x -= collision.normal.x * separation;
            transformA.position.y -= collision.normal.y * separation;
            transformA.position.z -= collision.normal.z * separation;
        }
        
        if (rigidbodyB && !rigidbodyB.isKinematic) {
            transformB.position.x += collision.normal.x * separation;
            transformB.position.y += collision.normal.y * separation;
            transformB.position.z += collision.normal.z * separation;
        }
    }
}

// Stub systems for compatibility
class AnimationSystem extends System {
    constructor(world) {
        super(world);
        this.priority = 90;
    }
    update(deltaTime) {}
}

class ScriptSystem extends System {
    constructor(world) {
        super(world);
        this.priority = 50;
    }
    update(deltaTime) {}
}

class PartySystem extends System {
    constructor(world) {
        super(world);
        this.priority = 40;
    }
    update(deltaTime) {}
}

class CharacterSystem extends System {
    constructor(world) {
        super(world);
        this.priority = 45;
    }
    update(deltaTime) {}
}

class AISystem extends System {
    constructor(world) {
        super(world);
        this.priority = 35;
    }
    update(deltaTime) {}
}

class CombatSystem extends System {
    constructor(world) {
        super(world);
        this.priority = 50;
    }
    update(deltaTime) {}
}

class InventorySystem extends System {
    constructor(world) {
        super(world);
        this.priority = 55;
    }
    update(deltaTime) {}
}

// Main initialization
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

// Create isometric camera
const aspect = window.innerWidth / window.innerHeight;
const d = 20;
const camera = new THREE.OrthographicCamera(
    -d * aspect, d * aspect,  // left, right
    d, -d,                    // top, bottom
    1, 1000                   // near, far
);

// Set up true isometric view (dimetric projection)
const angle = Math.atan(0.5); // ~26.57 degrees
const distance = 50;

camera.position.set(distance, distance * Math.sin(angle), distance);
camera.lookAt(0, 0, 0);
camera.zoom = 0.5; // Adjust zoom level for better view

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const container = document.getElementById('container');
container.appendChild(renderer.domElement);

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
window.PhysicsComponent = PhysicsComponent;
window.AnimationComponent = AnimationComponent;
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
    player.addComponent(new VelocityComponent());
    
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
    
    // Add player tag
    player.addComponent(new TagComponent(['player']));
    
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
    collider.setSize(width, height, depth);
    
    const rigidbody = wall.getComponent('RigidbodyComponent');
    rigidbody.isKinematic = true; // Walls don't move
}

// Initialize entities
const player = createPlayer();
createDemoEntities();

// Camera follow
function updateCamera() {
    const playerTransform = player.getComponent('TransformComponent');
    if (playerTransform) {
        // Maintain isometric angle while following player
        const angle = Math.atan(0.5);
        const distance = 50;
        
        camera.position.set(
            playerTransform.position.x + distance,
            playerTransform.position.y + distance * Math.sin(angle),
            playerTransform.position.z + distance
        );
        camera.lookAt(playerTransform.position);
    }
}

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

// Update entity list in inspector
function updateEntityList() {
    const entityList = document.getElementById('entityList');
    entityList.innerHTML = '';
    
    world.entities.forEach(entity => {
        const card = document.createElement('div');
        card.className = 'entity-card';
        
        const header = document.createElement('div');
        header.className = 'entity-header';
        
        const name = entity.getComponent('NameComponent');
        const title = document.createElement('strong');
        title.textContent = `${name ? name.name : 'Entity'} #${entity.id}`;
        header.appendChild(title);
        
        card.appendChild(header);
        
        // Add component badges
        const componentsDiv = document.createElement('div');
        entity.components.forEach((component, type) => {
            const badge = document.createElement('span');
            badge.className = `component ${type.toLowerCase()}`;
            badge.textContent = type.replace('Component', '');
            if (!component.active) {
                badge.classList.add('inactive');
            }
            badge.onclick = (e) => {
                e.stopPropagation();
                component.active = !component.active;
                updateEntityList();
            };
            componentsDiv.appendChild(badge);
        });
        
        card.appendChild(componentsDiv);
        entityList.appendChild(card);
    });
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
    updateEntityList();
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
    updateEntityList();
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
    updateEntityList();
});

// Camera controls
let cameraOffset = new THREE.Vector3(0, 0, 0);

// Mouse wheel zoom
window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.001;
    camera.zoom = Math.max(0.1, Math.min(2, camera.zoom - e.deltaY * zoomSpeed));
    camera.updateProjectionMatrix();
});

// Handle window resize
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 20;
    
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

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
    updateEntityList();
    
    // Render
    renderer.render(scene, camera);
}

// Initialize icons
lucide.createIcons();

// Initialize UI
updateStats();
updateEntityList();

// Start animation
requestAnimationFrame(animate);

// Export for debugging
window.world = world;
window.scene = scene;
window.camera = camera;
window.player = player;