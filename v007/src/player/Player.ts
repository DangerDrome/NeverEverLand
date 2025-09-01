import * as THREE from 'three';
import { VoxelEngine, VoxelType } from '../engine/VoxelEngine';
import { PathNode } from '../pathfinding/GridPathfinder';

export class Player {
    private mesh: THREE.Mesh;
    private position: THREE.Vector3;
    private velocity: THREE.Vector3;
    private targetPosition: THREE.Vector3 | null = null;
    private scene: THREE.Scene;
    private voxelEngine: VoxelEngine;
    
    // Movement parameters
    // private moveSpeed: number = 200.0; // Not used anymore - we snap to grid
    private jumpForce: number = 3.0;   // Jump force to reach ~2 voxels high (0.2m)
    private gravity: number = -20.0;    // Reduced gravity to match jump scale
    private isGrounded: boolean = true;
    private isMoving: boolean = false;
    private moveDirection: THREE.Vector3 = new THREE.Vector3();
    private stepMovement: boolean = false; // Whether we're doing a single step
    private stepTarget: THREE.Vector3 | null = null; // Target position for step movement
    private keyHeldTime: number = 0; // Track how long a key has been held
    private activeKey: string | null = null; // Track which key is being held
    private lastStepTime: number = 0; // Track when we last stepped
    
    // Pathfinding
    private currentPath: PathNode[] | null = null;
    private pathIndex: number = 0;
    private pathStepTimer: number = 0;
    private pathStepInterval: number = 0.05; // Faster path following - 20 steps per second
    
    // Player appearance
    private playerColor: number = 0x00ff00; // Green for now
    private playerSize: number = 0.08; // Slightly smaller than voxel size (0.1m)
    
    constructor(scene: THREE.Scene, voxelEngine: VoxelEngine) {
        this.scene = scene;
        this.voxelEngine = voxelEngine;
        this.position = new THREE.Vector3(0, 1, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        // Create player mesh (simple cube for now)
        const geometry = new THREE.BoxGeometry(this.playerSize, this.playerSize, this.playerSize);
        const material = new THREE.MeshPhongMaterial({ 
            color: this.playerColor,
            emissive: this.playerColor,
            emissiveIntensity: 0.2
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Add outline to make player more visible
        const outlineGeometry = new THREE.BoxGeometry(
            this.playerSize * 1.05, 
            this.playerSize * 1.05, 
            this.playerSize * 1.05
        );
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.BackSide
        });
        const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
        this.mesh.add(outlineMesh);
    }
    
    spawn(position: THREE.Vector3) {
        // Scale position to voxel size
        this.position.copy(position);
        this.position.multiplyScalar(0.1); // Convert to 0.1m scale
        this.mesh.position.copy(this.position);
        this.velocity.set(0, 0, 0);
        this.scene.add(this.mesh);
        this.isGrounded = false;
    }
    
    destroy() {
        this.scene.remove(this.mesh);
    }
    
    update(deltaTime: number) {
        // Track if we were in the air last frame
        const wasInAir = !this.isGrounded;
        
        // Apply gravity if not grounded
        if (!this.isGrounded) {
            this.velocity.y += this.gravity * deltaTime;
        }
        
        // Handle path following
        if (this.currentPath && this.pathIndex < this.currentPath.length) {
            this.followPath(deltaTime);
        }
        
        // Handle key held timing
        else if (this.activeKey) {
            this.keyHeldTime += deltaTime;
            
            // Continuous movement when holding key
            const moveSpeed = 10.0; // Voxels per second
            const stepInterval = 1.0 / moveSpeed; // 0.1 seconds between steps
            
            // Check if enough time has passed since last step
            if (this.keyHeldTime - this.lastStepTime >= stepInterval) {
                // Time to step to next voxel (or apply air control)
                if (this.activeKey === 'forward') this.stepToNextVoxel(0, 0, -1);
                else if (this.activeKey === 'backward') this.stepToNextVoxel(0, 0, 1);
                else if (this.activeKey === 'left') this.stepToNextVoxel(-1, 0, 0);
                else if (this.activeKey === 'right') this.stepToNextVoxel(1, 0, 0);
                
                this.lastStepTime = this.keyHeldTime;
            }
            
            // Only zero velocity when grounded (air movement uses velocity)
            if (this.isGrounded) {
                this.velocity.x = 0;
                this.velocity.z = 0;
            }
        } else {
            // Apply friction when not moving
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;
            
            // Only snap when completely stopped and grounded (not during movement or jumping)
            if (Math.abs(this.velocity.x) < 0.001 && Math.abs(this.velocity.z) < 0.001 && !this.targetPosition && !this.isMoving && this.isGrounded) {
                this.velocity.x = 0;
                this.velocity.z = 0;
                this.snapToGrid();
            }
        }
        
        // Calculate new position
        const newPosition = this.position.clone().add(
            this.velocity.clone().multiplyScalar(deltaTime)
        );
        
        // Check collision with voxels
        const collisionResult = this.checkCollision(newPosition);
        
        if (collisionResult.collision) {
            // Simple sliding: if blocked in one direction, try to keep moving in the other
            const slidePosition = this.position.clone();
            
            // Try sliding along X axis
            if (!collisionResult.x && this.velocity.x !== 0) {
                slidePosition.x = newPosition.x;
            }
            
            // Try sliding along Z axis
            if (!collisionResult.z && this.velocity.z !== 0) {
                slidePosition.z = newPosition.z;
            }
            
            // Handle Y axis (gravity/jumping)
            if (collisionResult.y) {
                // Only stop Y velocity if we're moving down (landing)
                if (this.velocity.y < 0) {
                    this.velocity.y = 0;
                    this.isGrounded = true;
                }
                // If moving up and hit ceiling, stop upward movement
                else if (this.velocity.y > 0) {
                    this.velocity.y = 0;
                }
            } else {
                slidePosition.y = newPosition.y;
            }
            
            // Apply the slide position if it's different from current
            if (!slidePosition.equals(this.position)) {
                this.position.copy(slidePosition);
            }
            
            // Only stop velocity in blocked directions if we're on the ground
            // When jumping, we want to maintain horizontal velocity even if we graze an obstacle
            if (this.isGrounded || this.velocity.y <= 0) {
                if (collisionResult.x) this.velocity.x = 0;
                if (collisionResult.z) this.velocity.z = 0;
            }
        } else {
            this.position.copy(newPosition);
            this.isGrounded = false;
        }
        
        // Prevent falling through the world (scaled for 0.1m voxels)
        if (this.position.y < 0.05) {
            this.position.y = 0.05;
            this.velocity.y = 0;
            this.isGrounded = true;
        }
        
        // Update grounded state every frame
        this.updateGroundedState();
        
        // If we just landed and we're not actively moving, snap to grid
        if (wasInAir && this.isGrounded && !this.activeKey && !this.targetPosition) {
            this.snapToGrid();
        }
        
        // Update mesh position
        this.mesh.position.copy(this.position);
    }
    
    private checkCollision(newPosition: THREE.Vector3): { collision: boolean, x: boolean, y: boolean, z: boolean } {
        const result = { collision: false, x: false, y: false, z: false };
        
        // Player bounding box half-size (player is 0.08m cube)
        const halfSize = this.playerSize / 2;
        
        // Check X axis movement
        const xPos = new THREE.Vector3(newPosition.x, this.position.y, this.position.z);
        if (this.checkAABBVoxelCollision(xPos, halfSize)) {
            result.collision = true;
            result.x = true;
        }
        
        // Check Y axis movement
        const yPos = new THREE.Vector3(this.position.x, newPosition.y, this.position.z);
        if (this.checkAABBVoxelCollision(yPos, halfSize)) {
            result.collision = true;
            result.y = true;
        }
        
        // Check Z axis movement
        const zPos = new THREE.Vector3(this.position.x, this.position.y, newPosition.z);
        if (this.checkAABBVoxelCollision(zPos, halfSize)) {
            result.collision = true;
            result.z = true;
        }
        
        return result;
    }
    
    private checkAABBVoxelCollision(position: THREE.Vector3, halfSize: number): boolean {
        // Player AABB bounds
        const playerMin = {
            x: position.x - halfSize,
            y: position.y - halfSize,
            z: position.z - halfSize
        };
        const playerMax = {
            x: position.x + halfSize,
            y: position.y + halfSize,
            z: position.z + halfSize
        };
        
        // Check voxels that the player bounds could overlap
        const minVoxelX = Math.floor(playerMin.x / 0.1);
        const maxVoxelX = Math.floor(playerMax.x / 0.1);
        const minVoxelY = Math.floor(playerMin.y / 0.1);
        const maxVoxelY = Math.floor(playerMax.y / 0.1);
        const minVoxelZ = Math.floor(playerMin.z / 0.1);
        const maxVoxelZ = Math.floor(playerMax.z / 0.1);
        
        for (let x = minVoxelX; x <= maxVoxelX; x++) {
            for (let y = minVoxelY; y <= maxVoxelY; y++) {
                for (let z = minVoxelZ; z <= maxVoxelZ; z++) {
                    if (this.voxelEngine.getVoxel(x, y, z) !== VoxelType.AIR) {
                        // Voxel AABB bounds (voxels are 0.1m cubes centered at grid + 0.05)
                        const voxelCenter = {
                            x: x * 0.1 + 0.05,
                            y: y * 0.1 + 0.05,
                            z: z * 0.1 + 0.05
                        };
                        const voxelHalfSize = 0.05;
                        
                        // Check AABB vs AABB collision
                        if (playerMax.x > voxelCenter.x - voxelHalfSize &&
                            playerMin.x < voxelCenter.x + voxelHalfSize &&
                            playerMax.y > voxelCenter.y - voxelHalfSize &&
                            playerMin.y < voxelCenter.y + voxelHalfSize &&
                            playerMax.z > voxelCenter.z - voxelHalfSize &&
                            playerMin.z < voxelCenter.z + voxelHalfSize) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    
    // Movement controls
    moveForward(keyPressed: boolean = true) {
        this.moveDirection.set(0, 0, -1);
        this.targetPosition = null;
        this.clearPath(); // Clear any active path
        
        if (keyPressed && !this.activeKey) {
            // First press - do a single step immediately
            this.activeKey = 'forward';
            this.keyHeldTime = 0;
            this.lastStepTime = 0;
            this.stepToNextVoxel(0, 0, -1);
        }
    }
    
    moveBackward(keyPressed: boolean = true) {
        this.moveDirection.set(0, 0, 1);
        this.targetPosition = null;
        this.clearPath(); // Clear any active path
        
        if (keyPressed && !this.activeKey) {
            // First press - do a single step immediately
            this.activeKey = 'backward';
            this.keyHeldTime = 0;
            this.lastStepTime = 0;
            this.stepToNextVoxel(0, 0, 1);
        }
    }
    
    moveLeft(keyPressed: boolean = true) {
        this.moveDirection.set(-1, 0, 0);
        this.targetPosition = null;
        this.clearPath(); // Clear any active path
        
        if (keyPressed && !this.activeKey) {
            // First press - do a single step immediately
            this.activeKey = 'left';
            this.keyHeldTime = 0;
            this.lastStepTime = 0;
            this.stepToNextVoxel(-1, 0, 0);
        }
    }
    
    moveRight(keyPressed: boolean = true) {
        this.moveDirection.set(1, 0, 0);
        this.targetPosition = null;
        this.clearPath(); // Clear any active path
        
        if (keyPressed && !this.activeKey) {
            // First press - do a single step immediately
            this.activeKey = 'right';
            this.keyHeldTime = 0;
            this.lastStepTime = 0;
            this.stepToNextVoxel(1, 0, 0);
        }
    }
    
    private stepToNextVoxel(dx: number, _dy: number, dz: number) {
        if (this.isGrounded) {
            // Calculate target position one voxel away - GRID SNAPPED
            const currentVoxelX = Math.floor(this.position.x / 0.1);
            const currentVoxelZ = Math.floor(this.position.z / 0.1);
            
            const targetVoxelX = currentVoxelX + dx;
            const targetVoxelZ = currentVoxelZ + dz;
            
            // INSTANTLY move to center of next voxel when grounded
            const newPosition = new THREE.Vector3(
                targetVoxelX * 0.1 + 0.05,
                this.position.y,
                targetVoxelZ * 0.1 + 0.05
            );
            
            // Check if we can move there (collision check)
            if (!this.checkAABBVoxelCollision(newPosition, this.playerSize / 2)) {
                this.position.x = newPosition.x;
                this.position.z = newPosition.z;
                // Keep Y unchanged - let gravity handle it
                this.mesh.position.copy(this.position);
                
                // Check if we're on the ground after moving
                this.updateGroundedState();
            }
        } else {
            // When in air, apply velocity-based movement instead of stepping
            // This will be handled by setting velocity, not instant position changes
            this.velocity.x = dx * 2.0; // Moderate air control speed
            this.velocity.z = dz * 2.0;
        }
        
        this.stepMovement = false;
        this.isMoving = false;
    }
    
    private updateGroundedState() {
        // Check if there's a voxel directly below us
        const checkPos = new THREE.Vector3(
            this.position.x,
            this.position.y - 0.05, // Check slightly below
            this.position.z
        );
        
        const wasGrounded = this.isGrounded;
        this.isGrounded = this.checkAABBVoxelCollision(checkPos, this.playerSize / 2) || 
                         this.position.y <= 0.05; // Also grounded if at world floor
        
        // Log grounded state changes for debugging jumps
        if (wasGrounded !== this.isGrounded) {
            console.log(`Grounded state changed: ${wasGrounded} -> ${this.isGrounded} at Y=${this.position.y.toFixed(2)}`);
        }
    }
    
    stopMoving() {
        this.isMoving = false;
        this.stepMovement = false;
        this.stepTarget = null;
        this.moveDirection.set(0, 0, 0);
        this.activeKey = null;
        this.keyHeldTime = 0;
        this.lastStepTime = 0;
        // Only snap to grid and stop velocity when on the ground
        if (this.isGrounded) {
            this.velocity.x = 0;
            this.velocity.z = 0;
            this.snapToGrid();
        }
        // If in air, let momentum continue
    }
    
    private snapToGrid() {
        // Snap to center of voxel cubes, matching how voxels are rendered
        // Voxels are rendered at grid position * 0.1 + 0.05 (half voxel size)
        const voxelX = Math.floor(this.position.x / 0.1);
        const voxelZ = Math.floor(this.position.z / 0.1);
        
        // Convert to world space and add half voxel size to center in the cube
        this.position.x = voxelX * 0.1 + 0.05;
        this.position.z = voxelZ * 0.1 + 0.05;
        
        // Don't snap Y to preserve vertical movement
        this.mesh.position.copy(this.position);
    }
    
    jump() {
        // Always allow jump if we're on the ground or close to it
        if (this.isGrounded || this.position.y <= 0.06) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            console.log('Jump! Grounded:', this.isGrounded, 'Y:', this.position.y);
        } else {
            console.log('Cannot jump - not grounded. Y:', this.position.y);
        }
    }
    
    moveToPosition(targetPosition: THREE.Vector3) {
        // Fallback direct movement when no pathfinding is available
        // This is now deprecated in favor of setPath()
        console.warn('Direct moveToPosition called - consider using pathfinding');
        this.clearPath();
        
        // For now, just try to move in a straight line
        const dx = targetPosition.x - this.position.x;
        const dz = targetPosition.z - this.position.z;
        
        if (Math.abs(dx) > Math.abs(dz)) {
            this.stepToNextVoxel(dx > 0 ? 1 : -1, 0, 0);
        } else if (Math.abs(dz) > 0.01) {
            this.stepToNextVoxel(0, 0, dz > 0 ? 1 : -1);
        }
    }
    
    getMesh(): THREE.Mesh {
        return this.mesh;
    }
    
    getPosition(): THREE.Vector3 {
        return this.position.clone();
    }
    
    setPosition(position: THREE.Vector3) {
        this.position.copy(position);
        this.mesh.position.copy(position);
    }
    
    // Pathfinding methods
    setPath(path: PathNode[] | null) {
        this.currentPath = path;
        this.pathIndex = 0;
        this.pathStepTimer = 0;
        
        // Clear any active movement
        this.targetPosition = null;
        this.activeKey = null;
        this.isMoving = false;
        
        if (path && path.length > 0) {
            console.log(`Path set with ${path.length} nodes`);
        }
    }
    
    private followPath(deltaTime: number) {
        if (!this.currentPath || this.pathIndex >= this.currentPath.length) {
            this.currentPath = null;
            return;
        }
        
        const targetNode = this.currentPath[this.pathIndex];
        const targetPos = new THREE.Vector3(
            targetNode.x * 0.1 + 0.05,
            targetNode.y * 0.1 + 0.05,
            targetNode.z * 0.1 + 0.05
        );
        
        // NO JUMPING IN PATHFINDING - all nodes are walk nodes now
        
        // Walk logic - only process on timer
        this.pathStepTimer += deltaTime;
        
        if (this.pathStepTimer >= this.pathStepInterval) {
            this.pathStepTimer = 0;
            
            if (targetNode.action === 'walk') {
                // Calculate direction to target
                const dx = targetPos.x - this.position.x;
                const dz = targetPos.z - this.position.z;
                
                // Check if we're close enough to the target horizontally
                if (Math.abs(dx) < 0.06 && Math.abs(dz) < 0.06) {
                    // We're at the target X/Z, now handle Y
                    const dy = targetPos.y - this.position.y;
                    
                    if (Math.abs(dy) < 0.06) {
                        // Close enough in all dimensions - move to next node
                        this.pathIndex++;
                    } else if (dy > 0.05 && this.isGrounded) {
                        // Need to step up - teleport up one voxel
                        console.log(`Stepping up from Y=${this.position.y.toFixed(2)} to Y=${targetPos.y.toFixed(2)}`);
                        this.position.y = targetPos.y;
                        this.mesh.position.copy(this.position);
                        this.updateGroundedState();
                    } else if (dy < -0.05) {
                        // Need to step down - let gravity handle it
                        console.log(`Stepping down to Y=${targetPos.y.toFixed(2)}`);
                        // Just wait for gravity to bring us down
                        if (Math.abs(this.position.y - targetPos.y) < 0.1) {
                            this.pathIndex++;
                        }
                    }
                } else {
                    // Move horizontally toward target - trust the pathfinding
                    if (this.isGrounded) {
                        const moveSpeed = 0.1; // Move one voxel per step
                        const distance = Math.sqrt(dx * dx + dz * dz);
                        
                        if (distance > 0) {
                            // Normalize and scale movement
                            const moveX = (dx / distance) * moveSpeed;
                            const moveZ = (dz / distance) * moveSpeed;
                            
                            // Move toward target
                            this.position.x += moveX;
                            this.position.z += moveZ;
                            
                            // Clamp to target if we would overshoot
                            if (Math.abs(targetPos.x - this.position.x) < Math.abs(moveX)) {
                                this.position.x = targetPos.x;
                            }
                            if (Math.abs(targetPos.z - this.position.z) < Math.abs(moveZ)) {
                                this.position.z = targetPos.z;
                            }
                            
                            this.mesh.position.copy(this.position);
                            this.updateGroundedState();
                        }
                    }
                }
            }
        }
    }
    
    hasPath(): boolean {
        return this.currentPath !== null && this.pathIndex < this.currentPath.length;
    }
    
    getPathIndex(): number {
        return this.pathIndex;
    }
    
    clearPath() {
        this.currentPath = null;
        this.pathIndex = 0;
        this.pathStepTimer = 0;
    }
}