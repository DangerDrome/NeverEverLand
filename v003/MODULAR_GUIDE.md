# 🚨 MODULAR ARCHITECTURE GUIDE 🚨

## GOLDEN RULE: NEVER PUT CODE IN index.html

### How to Add a New Component

1. **Create a new file** in `/components/YourComponent.js`:
```javascript
import { Component } from '../core/Component.js';

export class YourComponent extends Component {
    constructor() {
        super();
        // Your properties here
        this.active = true;
    }
}
```

2. **Import it** where needed:
```javascript
import { YourComponent } from './components/YourComponent.js';
```

3. **Register it globally** (if needed for inspector):
```javascript
window.YourComponent = YourComponent;
```

### How to Add a New System

1. **Create a new file** in `/systems/YourSystem.js`:
```javascript
import { System } from '../core/System.js';

export class YourSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['YourComponent'];
    }
    
    processEntity(entity, deltaTime) {
        // Your logic here
    }
}
```

2. **Import and add to world**:
```javascript
import { YourSystem } from './systems/YourSystem.js';
world.addSystem(new YourSystem(world));
```

### Current Status

- `index.html` - Contains the old monolithic code (8600+ lines) but works
- `index.html.backup` - Backup of the working monolithic version
- `index-clean.html` - Clean example of how it SHOULD be done

### Going Forward

1. **For new features**: Use the modular pattern
2. **For bug fixes in existing code**: Fix in index.html for now
3. **For major refactors**: Extract to modules as needed

### Example: Adding a Jump System (The RIGHT Way)

Instead of adding to index.html, create:

`/components/JumpComponent.js`:
```javascript
import { Component } from '../core/Component.js';

export class JumpComponent extends Component {
    constructor() {
        super();
        this.jumpForce = 10;
        this.isJumping = false;
        this.canDoubleJump = false;
        this.active = true;
    }
}
```

`/systems/JumpSystem.js`:
```javascript
import { System } from '../core/System.js';

export class JumpSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['JumpComponent', 'RigidbodyComponent'];
    }
    
    processEntity(entity, deltaTime) {
        const jump = entity.getComponent('JumpComponent');
        const rigidbody = entity.getComponent('RigidbodyComponent');
        
        // Handle jump logic properly
    }
}
```

Then import and use in your main file.

## Remember: The modular system exists for a reason. Use it!