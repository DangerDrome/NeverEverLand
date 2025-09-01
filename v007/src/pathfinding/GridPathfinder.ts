import { VoxelEngine } from '../engine/VoxelEngine';
import * as THREE from 'three';

export interface PathNode {
    x: number;  // Voxel X coordinate
    y: number;  // Voxel Y coordinate
    z: number;  // Voxel Z coordinate
    action: 'walk' | 'jump';  // How to reach this node
}

interface SearchNode {
    x: number;
    y: number;
    z: number;
    parent: SearchNode | null;
    action: 'walk' | 'jump';
}

export class GridPathfinder {
    private voxelEngine: VoxelEngine;
    private maxSearchDistance: number = 50; // Maximum voxels to search
    private maxJumpHeight: number = 2; // Can jump 2 voxels high
    private maxJumpDistance: number = 3; // Can jump 3 voxels horizontally
    private playerHeight: number = 1; // Player is 1 voxel tall (rounded up from 0.08m)
    
    constructor(voxelEngine: VoxelEngine) {
        this.voxelEngine = voxelEngine;
    }
    
    /**
     * Find a path from start to goal position using BFS
     * @param start Starting position in world coordinates
     * @param goal Goal position in world coordinates
     * @returns Array of path nodes or null if no path found
     */
    findPath(start: THREE.Vector3, goal: THREE.Vector3): PathNode[] | null {
        // Convert world positions to voxel coordinates
        const startVoxel = {
            x: Math.floor(start.x / 0.1),
            y: Math.floor(start.y / 0.1),
            z: Math.floor(start.z / 0.1)
        };
        
        const goalVoxel = {
            x: Math.floor(goal.x / 0.1),
            y: Math.floor(goal.y / 0.1),
            z: Math.floor(goal.z / 0.1)
        };
        
        console.log(`Pathfinding from voxel ${startVoxel.x},${startVoxel.y},${startVoxel.z} to ${goalVoxel.x},${goalVoxel.y},${goalVoxel.z}`);
        
        // Check if start and goal are the same
        if (startVoxel.x === goalVoxel.x && 
            startVoxel.y === goalVoxel.y && 
            startVoxel.z === goalVoxel.z) {
            return [];
        }
        
        // Verify goal position is valid (player's feet position should be empty)
        // It's OK if there's a voxel below (we're standing on it)
        if (this.isBlocked(goalVoxel.x, goalVoxel.y, goalVoxel.z)) {
            console.warn(`Goal position is blocked at ${goalVoxel.x}, ${goalVoxel.y}, ${goalVoxel.z}`);
            // Try one position higher (might be trying to stand on top of something)
            if (!this.isBlocked(goalVoxel.x, goalVoxel.y + 1, goalVoxel.z)) {
                console.log(`Adjusting goal one voxel higher`);
                goalVoxel.y += 1;
            } else {
                return null;
            }
        }
        
        // Check if goal is too far
        const distance = Math.abs(goalVoxel.x - startVoxel.x) + 
                        Math.abs(goalVoxel.y - startVoxel.y) + 
                        Math.abs(goalVoxel.z - startVoxel.z);
        if (distance > this.maxSearchDistance) {
            console.log('Path too far, limiting search');
            return null;
        }
        
        // BFS setup
        const queue: SearchNode[] = [];
        const visited = new Set<string>();
        let iterations = 0;
        const maxIterations = 10000; // Prevent infinite loops
        
        const startNode: SearchNode = {
            x: startVoxel.x,
            y: startVoxel.y,
            z: startVoxel.z,
            parent: null,
            action: 'walk'
        };
        
        queue.push(startNode);
        visited.add(this.nodeKey(startNode));
        
        // BFS search with iteration limit
        while (queue.length > 0 && iterations < maxIterations) {
            iterations++;
            const current = queue.shift()!;
            
            if (iterations % 1000 === 0) {
                console.log(`Pathfinding iteration ${iterations}, queue size: ${queue.length}`);
            }
            
            // Check if we reached the goal
            if (current.x === goalVoxel.x && 
                current.y === goalVoxel.y && 
                current.z === goalVoxel.z) {
                return this.reconstructPath(current);
            }
            
            // Get neighbors (walk and jump moves)
            const neighbors = this.getNeighbors(current);
            
            for (const neighbor of neighbors) {
                const key = this.nodeKey(neighbor);
                if (!visited.has(key)) {
                    visited.add(key);
                    neighbor.parent = current;
                    queue.push(neighbor);
                }
            }
        }
        
        // Check if we hit the iteration limit
        if (iterations >= maxIterations) {
            console.error(`Pathfinding hit iteration limit (${maxIterations})`);
        }
        
        // No path found
        console.log(`No path found after ${iterations} iterations`);
        return null;
    }
    
    /**
     * Get all valid neighbor positions from current position
     */
    private getNeighbors(node: SearchNode): SearchNode[] {
        const neighbors: SearchNode[] = [];
        
        // Try walking to adjacent voxels (4 directions, no diagonals)
        const walkDirections = [
            { dx: 1, dz: 0 },  // Right
            { dx: -1, dz: 0 }, // Left
            { dx: 0, dz: 1 },  // Forward
            { dx: 0, dz: -1 }  // Backward
        ];
        
        for (const dir of walkDirections) {
            // First try walking (includes step up/down)
            const walkNode = this.tryWalk(node, dir.dx, dir.dz);
            if (walkNode) {
                neighbors.push(walkNode);
            } else {
                // Walking failed - there's an obstacle
                // Try jumping over or onto it
                const jumpNode = this.tryJumpOverObstacle(node, dir.dx, dir.dz);
                if (jumpNode) {
                    neighbors.push(jumpNode);
                }
            }
        }
        
        return neighbors;
    }
    
    /**
     * Try to walk to an adjacent voxel
     */
    private tryWalk(from: SearchNode, dx: number, dz: number): SearchNode | null {
        const targetX = from.x + dx;
        const targetZ = from.z + dz;
        
        // Check horizontal movement first (same height)
        let targetY = from.y;
        if (this.canMoveTo(targetX, targetY, targetZ) && this.hasGround(targetX, targetY, targetZ)) {
            return {
                x: targetX,
                y: targetY,
                z: targetZ,
                parent: null,
                action: 'walk'
            };
        }
        
        // Try stepping up (1 voxel step - like stairs)
        targetY = from.y + 1;
        if (this.canMoveTo(targetX, targetY, targetZ) && 
            this.hasGround(targetX, targetY, targetZ) &&
            !this.isBlocked(from.x, from.y + 1, from.z)) { // Check head clearance at current position
            return {
                x: targetX,
                y: targetY,
                z: targetZ,
                parent: null,
                action: 'walk'
            };
        }
        
        // Try stepping down (allow falling multiple voxels)
        for (let dropHeight = 1; dropHeight <= 3; dropHeight++) {
            targetY = from.y - dropHeight;
            if (targetY < 0) break; // Don't go below world
            
            // Check if we can land there
            if (this.canMoveTo(targetX, targetY, targetZ) && 
                this.hasGround(targetX, targetY, targetZ)) {
                
                // Make sure the path down is clear
                let pathClear = true;
                for (let y = from.y - 1; y > targetY; y--) {
                    if (this.isBlocked(targetX, y, targetZ)) {
                        pathClear = false;
                        break;
                    }
                }
                
                if (pathClear) {
                    return {
                        x: targetX,
                        y: targetY,
                        z: targetZ,
                        parent: null,
                        action: 'walk'
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Try to jump over or onto an obstacle that's blocking our path
     */
    private tryJumpOverObstacle(from: SearchNode, dx: number, dz: number): SearchNode | null {
        // Check what's blocking us
        const blockX = from.x + dx;
        const blockZ = from.z + dz;
        
        // Is there an obstacle at our level?
        if (this.isBlocked(blockX, from.y, blockZ)) {
            console.log(`Obstacle detected at ${blockX},${from.y},${blockZ} when moving from ${from.x},${from.y},${from.z}`);
            // Try to jump ONTO it (1 up, 1 forward)
            const ontoX = blockX;
            const ontoY = from.y + 1;
            const ontoZ = blockZ;
            
            // Check if we can stand on top of the obstacle
            const topClear = this.voxelEngine.getVoxel(ontoX, ontoY, ontoZ) === 0;
            const hasBase = this.voxelEngine.getVoxel(ontoX, ontoY - 1, ontoZ) !== 0;
            
            if (topClear && hasBase) {
                console.log(`Can jump ONTO obstacle at ${ontoX},${ontoY},${ontoZ}`);
                return {
                    x: ontoX,
                    y: ontoY,
                    z: ontoZ,
                    parent: null,
                    action: 'jump'
                };
            }
            
            // Try to jump OVER the obstacle by scanning for valid landing spots
            for (let dist = 2; dist <= this.maxJumpDistance; dist++) {
                for (let h = 1; h >= -2; h--) { // Try various heights
                    const targetX = from.x + (dx * dist);
                    const targetY = from.y + h;
                    const targetZ = from.z + (dz * dist);
                    
                    if (targetY < 0) continue;
                    
                    // Check if this is a valid landing spot
                    const spotClear = this.voxelEngine.getVoxel(targetX, targetY, targetZ) === 0;
                    const hasGround = this.voxelEngine.getVoxel(targetX, targetY - 1, targetZ) !== 0;
                    
                    if (spotClear && hasGround) {
                        // Found a valid landing spot!
                        console.log(`Found landing spot at ${targetX},${targetY},${targetZ} when jumping over obstacle`);
                        return {
                            x: targetX,
                            y: targetY,
                            z: targetZ,
                            parent: null,
                            action: 'jump'
                        };
                    }
                }
            }
        }
        
        // Check if there's a platform above we need to jump to
        // (This case is already handled by the ONTO logic above)
        
        // Check if we need to jump across a gap
        const groundAtBlock = this.voxelEngine.getVoxel(blockX, from.y - 1, blockZ) !== 0;
        if (!groundAtBlock) {
            // There's a gap, scan for landing spot
            for (let dist = 2; dist <= this.maxJumpDistance; dist++) {
                const gapX = from.x + (dx * dist);
                const gapY = from.y;
                const gapZ = from.z + (dz * dist);
                
                // Check for valid landing
                const spotClear = this.voxelEngine.getVoxel(gapX, gapY, gapZ) === 0;
                const hasGround = this.voxelEngine.getVoxel(gapX, gapY - 1, gapZ) !== 0;
                
                if (spotClear && hasGround) {
                    console.log(`Jumping ACROSS gap to ${gapX},${gapY},${gapZ}`);
                    return {
                        x: gapX,
                        y: gapY,
                        z: gapZ,
                        parent: null,
                        action: 'jump'
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Try a specific jump
     */
    private tryJump(from: SearchNode, dx: number, dz: number, jumpDist: number, jumpHeight: number): SearchNode | null {
        const targetX = from.x + (dx * jumpDist);
        const targetY = from.y + jumpHeight;
        const targetZ = from.z + (dz * jumpDist);
        
        if (targetY < 0) return null; // Don't jump below world
        
        // Check if we can land there - be more lenient
        // Just check if the position itself is clear, not worrying about ground
        const positionClear = this.voxelEngine.getVoxel(targetX, targetY, targetZ) === 0;
        
        if (!positionClear) {
            return null; // Can't land inside a voxel
        }
        
        // For jumping, we're more lenient - we can land on ground or fall
        // The important thing is the position is clear
        console.log(`Jump node created: from ${from.x},${from.y},${from.z} to ${targetX},${targetY},${targetZ} (height:${jumpHeight}, dist:${jumpDist})`);
        return {
            x: targetX,
            y: targetY,
            z: targetZ,
            parent: null,
            action: 'jump'
        };
    }
    
    /**
     * Check if a position can be moved to (no collision)
     */
    private canMoveTo(x: number, y: number, z: number): boolean {
        // Check if the position and space above (for player height) are clear
        for (let h = 0; h < this.playerHeight; h++) {
            if (this.isBlocked(x, y + h, z)) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Check if there's solid ground below a position
     */
    private hasGround(x: number, y: number, z: number): boolean {
        return this.isBlocked(x, y - 1, z) || y <= 0;
    }
    
    /**
     * Check if a voxel position is blocked
     */
    private isBlocked(x: number, y: number, z: number): boolean {
        const voxelType = this.voxelEngine.getVoxel(x, y, z);
        return voxelType !== 0; // 0 is AIR in VoxelType enum
    }
    
    /**
     * Create a unique key for a node position
     */
    private nodeKey(node: { x: number; y: number; z: number }): string {
        return `${node.x},${node.y},${node.z}`;
    }
    
    /**
     * Reconstruct the path from the goal node back to start
     */
    private reconstructPath(goalNode: SearchNode): PathNode[] {
        const path: PathNode[] = [];
        let current: SearchNode | null = goalNode;
        
        while (current && current.parent) {
            path.unshift({
                x: current.x,
                y: current.y,
                z: current.z,
                action: current.action
            });
            current = current.parent;
        }
        
        // Log path for debugging
        console.log(`Path reconstructed with ${path.length} nodes:`);
        path.forEach((node, i) => {
            if (node.action === 'jump') {
                console.log(`  ${i}: JUMP to ${node.x},${node.y},${node.z}`);
            }
        });
        
        return path;
    }
    
    /**
     * Debug: Draw path visualization as flat highlighter squares
     */
    debugDrawPath(path: PathNode[], scene: THREE.Scene): THREE.Group {
        const pathGroup = new THREE.Group();
        pathGroup.name = 'PathDebug';
        
        // Walk nodes - bright green highlighter
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            opacity: 0.6, 
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Jump nodes - bright yellow highlighter
        const jumpMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00, 
            opacity: 0.6, 
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Flat plane geometry for highlighter effect (slightly smaller than voxel)
        const geometry = new THREE.PlaneGeometry(0.09, 0.09);
        
        // Add path nodes as flat squares on the ground
        for (let i = 0; i < path.length; i++) {
            const node = path[i];
            const mesh = new THREE.Mesh(
                geometry, 
                node.action === 'jump' ? jumpMaterial : material
            );
            
            // Position flat on the ground (just above to avoid z-fighting)
            mesh.position.set(
                node.x * 0.1 + 0.05,
                node.y * 0.1 + 0.001, // Just above the voxel surface
                node.z * 0.1 + 0.05
            );
            
            // Rotate to be horizontal (facing up)
            mesh.rotation.x = -Math.PI / 2;
            
            mesh.name = `PathNode_${i}`;
            pathGroup.add(mesh);
        }
        
        scene.add(pathGroup);
        return pathGroup;
    }
    
    /**
     * Clear debug visualization
     */
    clearDebugPath(scene: THREE.Scene) {
        const existing = scene.getObjectByName('PathDebug');
        if (existing) {
            scene.remove(existing);
        }
    }
}