import { VoxelEngine } from '../engine/VoxelEngine';
import * as THREE from 'three';

export interface PathNode {
    x: number;
    y: number;
    z: number;
    action: 'walk' | 'jump';
}

interface Node {
    x: number;
    y: number;
    z: number;
    g: number;
    h: number;
    f: number;
    parent: Node | null;
}

export class VoxelAStar {
    private voxelEngine: VoxelEngine;
    private maxIterations: number = 10000;
    private maxSearchDistance: number = 50; // Maximum distance to search
    
    constructor(voxelEngine: VoxelEngine) {
        this.voxelEngine = voxelEngine;
    }
    
    findPath(start: THREE.Vector3, goal: THREE.Vector3): PathNode[] | null {
        // Convert world coordinates to voxel grid
        const startNode: Node = {
            x: Math.floor(start.x / 0.1),
            y: Math.floor(start.y / 0.1),
            z: Math.floor(start.z / 0.1),
            g: 0,
            h: 0,
            f: 0,
            parent: null
        };
        
        const goalNode: Node = {
            x: Math.floor(goal.x / 0.1),
            y: Math.floor(goal.y / 0.1),
            z: Math.floor(goal.z / 0.1),
            g: 0,
            h: 0,
            f: 0,
            parent: null
        };
        
        console.log(`Pathfinding from (${startNode.x},${startNode.y},${startNode.z}) to (${goalNode.x},${goalNode.y},${goalNode.z})`);
        
        // Check if start and goal are the same
        if (this.isSamePosition(startNode, goalNode)) {
            return [];
        }
        
        // Check if goal is too far
        const distance = Math.abs(goalNode.x - startNode.x) + 
                        Math.abs(goalNode.y - startNode.y) + 
                        Math.abs(goalNode.z - startNode.z);
        if (distance > this.maxSearchDistance) {
            console.warn(`Goal is too far away (${distance} > ${this.maxSearchDistance})`);
            return null;
        }
        
        // Verify start and goal are valid positions
        if (!this.isWalkable(startNode.x, startNode.y, startNode.z)) {
            console.warn('Start position is not walkable');
        }
        if (!this.isWalkable(goalNode.x, goalNode.y, goalNode.z)) {
            console.warn('Goal position is not walkable');
        }
        
        // Initialize open and closed lists
        const openList: Node[] = [];
        const closedSet = new Set<string>();
        
        // Calculate initial heuristic
        startNode.h = this.heuristic(startNode, goalNode);
        startNode.f = startNode.g + startNode.h;
        openList.push(startNode);
        
        let iterations = 0;
        
        while (openList.length > 0 && iterations < this.maxIterations) {
            iterations++;
            
            // Get node with lowest F score
            let currentIndex = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < openList[currentIndex].f) {
                    currentIndex = i;
                }
            }
            
            const current = openList[currentIndex];
            
            // Debug logging every 100 iterations
            if (iterations % 100 === 0) {
                console.log(`Iteration ${iterations}: Current (${current.x},${current.y},${current.z}), Open list size: ${openList.length}`);
            }
            
            // Check if we reached the goal
            if (this.isSamePosition(current, goalNode)) {
                console.log(`Path found in ${iterations} iterations`);
                return this.reconstructPath(current);
            }
            
            // Move current from open to closed
            openList.splice(currentIndex, 1);
            closedSet.add(this.getNodeKey(current));
            
            // Get all valid neighbors
            const neighbors = this.getNeighbors(current);
            
            for (const neighbor of neighbors) {
                const key = this.getNodeKey(neighbor);
                
                // Skip if already evaluated
                if (closedSet.has(key)) continue;
                
                // Calculate scores
                const tentativeG = current.g + this.getMoveCost(current, neighbor);
                
                // Check if neighbor is in open list
                const existingIndex = openList.findIndex(n => this.isSamePosition(n, neighbor));
                
                if (existingIndex === -1) {
                    // New node - add to open list
                    neighbor.g = tentativeG;
                    neighbor.h = this.heuristic(neighbor, goalNode);
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = current;
                    openList.push(neighbor);
                } else if (tentativeG < openList[existingIndex].g) {
                    // Better path found
                    openList[existingIndex].g = tentativeG;
                    openList[existingIndex].f = tentativeG + openList[existingIndex].h;
                    openList[existingIndex].parent = current;
                }
            }
        }
        
        console.log(`No path found after ${iterations} iterations`);
        return null;
    }
    
    private getNeighbors(node: Node): Node[] {
        const neighbors: Node[] = [];
        
        // Check all 8 horizontal directions (4 cardinal + 4 diagonal)
        const directions = [
            { dx: 1, dy: 0, dz: 0 },   // East
            { dx: -1, dy: 0, dz: 0 },  // West
            { dx: 0, dy: 0, dz: 1 },   // North
            { dx: 0, dy: 0, dz: -1 },  // South
            { dx: 1, dy: 0, dz: 1 },   // NE
            { dx: 1, dy: 0, dz: -1 },  // SE
            { dx: -1, dy: 0, dz: 1 },  // NW
            { dx: -1, dy: 0, dz: -1 }, // SW
        ];
        
        for (const dir of directions) {
            const newX = node.x + dir.dx;
            const newY = node.y + dir.dy;
            const newZ = node.z + dir.dz;
            
            // For diagonal movement, check that we're not cutting through corners
            if (dir.dx !== 0 && dir.dz !== 0) {
                // Check both adjacent cells to prevent corner cutting
                const clear1 = this.isWalkable(node.x + dir.dx, node.y, node.z);
                const clear2 = this.isWalkable(node.x, node.y, node.z + dir.dz);
                
                if (!clear1 || !clear2) {
                    continue; // Can't move diagonally through a corner
                }
            }
            
            // Check horizontal movement at same level
            const canWalk = this.isWalkable(newX, node.y, newZ);
            const hasGround = this.hasGround(newX, node.y, newZ);
            
            if (canWalk && hasGround) {
                neighbors.push({
                    x: newX,
                    y: node.y,
                    z: newZ,
                    g: 0,
                    h: 0,
                    f: 0,
                    parent: null
                });
            } else if (!canWalk && Math.random() < 0.1) {
                console.log(`Cannot walk to (${newX},${node.y},${newZ}) - blocked by voxel`);
            }
            
            // Check if we can step up one block (only if blocked at current level)
            if (this.voxelEngine.getVoxel(newX, node.y, newZ) !== 0 && // Block in the way
                this.isWalkable(newX, node.y + 1, newZ) && // Space above is free
                this.hasGround(newX, node.y + 1, newZ)) { // Has ground to stand on
                neighbors.push({
                    x: newX,
                    y: node.y + 1,
                    z: newZ,
                    g: 0,
                    h: 0,
                    f: 0,
                    parent: null
                });
            }
            
            // Check if we can step down (up to 3 blocks)
            for (let down = 1; down <= 3; down++) {
                const downY = node.y - down;
                if (downY >= 0 && this.isWalkable(newX, downY, newZ) && 
                    this.hasGround(newX, downY, newZ)) {
                    neighbors.push({
                        x: newX,
                        y: downY,
                        z: newZ,
                        g: 0,
                        h: 0,
                        f: 0,
                        parent: null
                    });
                    break; // Only add the first valid down position
                }
            }
        }
        
        return neighbors;
    }
    
    private isWalkable(x: number, y: number, z: number): boolean {
        // Check if position is empty (no voxel) at foot level
        const footVoxel = this.voxelEngine.getVoxel(x, y, z);
        
        // Also check head space (player is about 2 voxels tall)
        const headVoxel = this.voxelEngine.getVoxel(x, y + 1, z);
        
        const footClear = footVoxel === 0;
        const headClear = headVoxel === 0;
        
        // Both foot and head position must be clear
        const isWalkable = footClear && headClear;
        
        // Debug log for blocked positions
        if (!isWalkable && Math.random() < 0.02) {
            if (!footClear) {
                console.log(`Foot blocked at (${x},${y},${z}) with voxel type ${footVoxel}`);
            }
            if (!headClear) {
                console.log(`Head blocked at (${x},${y+1},${z}) with voxel type ${headVoxel}`);
            }
        }
        
        return isWalkable;
    }
    
    private hasGround(x: number, y: number, z: number): boolean {
        // Must have solid ground IMMEDIATELY below (no floating paths)
        if (y <= 0) return true; // At world bottom
        
        // Check exactly one block below
        const groundBelow = this.voxelEngine.getVoxel(x, y - 1, z) !== 0;
        
        if (!groundBelow && Math.random() < 0.05) {
            console.log(`No ground at (${x},${y},${z}) - floating position rejected`);
        }
        
        return groundBelow;
    }
    
    private getMoveCost(from: Node, to: Node): number {
        // Calculate distance
        const dx = Math.abs(to.x - from.x);
        const dz = Math.abs(to.z - from.z);
        const dy = Math.abs(to.y - from.y);
        
        // Diagonal movement costs more (sqrt(2) ≈ 1.41)
        let cost = 1;
        if (dx > 0 && dz > 0) {
            cost = 1.41; // Diagonal movement
        }
        
        // Add extra cost for vertical movement
        if (dy > 0) {
            cost += dy * 0.5; // Prefer horizontal paths
        }
        
        return cost;
    }
    
    private heuristic(node: Node, goal: Node): number {
        // Manhattan distance with slight preference for straight paths
        const dx = Math.abs(node.x - goal.x);
        const dy = Math.abs(node.y - goal.y);
        const dz = Math.abs(node.z - goal.z);
        
        // Standard Manhattan distance
        return dx + dy + dz;
    }
    
    private isSamePosition(a: Node, b: Node): boolean {
        return a.x === b.x && a.y === b.y && a.z === b.z;
    }
    
    private getNodeKey(node: Node): string {
        return `${node.x},${node.y},${node.z}`;
    }
    
    private reconstructPath(goalNode: Node): PathNode[] {
        const path: PathNode[] = [];
        let current: Node | null = goalNode;
        
        while (current && current.parent) {
            path.unshift({
                x: current.x,
                y: current.y,
                z: current.z,
                action: 'walk' // All moves are walks for now
            });
            current = current.parent;
        }
        
        console.log(`Path found with ${path.length} nodes`);
        return path;
    }
    
    /**
     * Debug visualization of the path
     */
    debugDrawPath(path: PathNode[], scene: THREE.Scene): THREE.Group {
        // Remove existing debug path
        const existing = scene.getObjectByName('PathDebug');
        if (existing) {
            scene.remove(existing);
        }
        
        const pathGroup = new THREE.Group();
        pathGroup.name = 'PathDebug';
        
        // Create material for path nodes
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            opacity: 0.6,
            transparent: true
        });
        
        const geometry = new THREE.PlaneGeometry(0.09, 0.09);
        
        for (let i = 0; i < path.length; i++) {
            const node = path[i];
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position at voxel center
            mesh.position.set(
                node.x * 0.1 + 0.05,
                node.y * 0.1 + 0.001,
                node.z * 0.1 + 0.05
            );
            
            // Rotate to be horizontal
            mesh.rotation.x = -Math.PI / 2;
            
            pathGroup.add(mesh);
        }
        
        scene.add(pathGroup);
        return pathGroup;
    }
}