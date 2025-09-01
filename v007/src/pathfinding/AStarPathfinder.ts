import { VoxelEngine } from '../engine/VoxelEngine';
import * as THREE from 'three';

export interface PathNode {
    x: number;
    y: number;
    z: number;
    action: 'walk' | 'jump';
}

interface AStarNode {
    x: number;
    y: number;
    z: number;
    g: number; // Cost from start
    h: number; // Heuristic to goal
    f: number; // g + h
    parent: AStarNode | null;
    action: 'walk' | 'jump';
}

export class AStarPathfinder {
    private voxelEngine: VoxelEngine;
    private maxSearchDistance: number = 100;
    
    constructor(voxelEngine: VoxelEngine) {
        this.voxelEngine = voxelEngine;
    }
    
    findPath(start: THREE.Vector3, goal: THREE.Vector3): PathNode[] | null {
        // Convert to voxel coordinates
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
        
        console.log(`A* Pathfinding from (${startVoxel.x},${startVoxel.y},${startVoxel.z}) to (${goalVoxel.x},${goalVoxel.y},${goalVoxel.z})`);
        
        // A* implementation
        const openList: AStarNode[] = [];
        const closedSet = new Set<string>();
        
        const startNode: AStarNode = {
            x: startVoxel.x,
            y: startVoxel.y,
            z: startVoxel.z,
            g: 0,
            h: this.heuristic(startVoxel, goalVoxel),
            f: 0,
            parent: null,
            action: 'walk'
        };
        startNode.f = startNode.g + startNode.h;
        
        openList.push(startNode);
        
        let iterations = 0;
        const maxIterations = 5000;
        
        while (openList.length > 0 && iterations < maxIterations) {
            iterations++;
            
            // Get node with lowest f score
            openList.sort((a, b) => a.f - b.f);
            const current = openList.shift()!;
            
            // Check if we reached goal
            if (current.x === goalVoxel.x && 
                current.y === goalVoxel.y && 
                current.z === goalVoxel.z) {
                console.log(`Path found in ${iterations} iterations!`);
                return this.reconstructPath(current);
            }
            
            closedSet.add(`${current.x},${current.y},${current.z}`);
            
            // Get all possible moves from current position
            const neighbors = this.getNeighbors(current, goalVoxel);
            
            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y},${neighbor.z}`;
                if (closedSet.has(key)) continue;
                
                // Check if this path to neighbor is better
                const existingNode = openList.find(n => n.x === neighbor.x && n.y === neighbor.y && n.z === neighbor.z);
                
                if (!existingNode) {
                    openList.push(neighbor);
                } else if (neighbor.g < existingNode.g) {
                    // Found better path to this node
                    existingNode.g = neighbor.g;
                    existingNode.f = existingNode.g + existingNode.h;
                    existingNode.parent = neighbor.parent;
                    existingNode.action = neighbor.action;
                }
            }
        }
        
        console.log(`No path found after ${iterations} iterations`);
        return null;
    }
    
    private getNeighbors(node: AStarNode, goal: any): AStarNode[] {
        const neighbors: AStarNode[] = [];
        
        // All 4 cardinal directions
        const dirs = [
            {dx: 1, dz: 0}, {dx: -1, dz: 0},
            {dx: 0, dz: 1}, {dx: 0, dz: -1}
        ];
        
        for (const dir of dirs) {
            // Try all possible moves in this direction
            const moves = this.getPossibleMoves(node, dir.dx, dir.dz);
            
            for (const move of moves) {
                // Make jumps more expensive to prefer walking
                const cost = move.action === 'jump' ? 2 : 1;
                
                const neighbor: AStarNode = {
                    x: move.x,
                    y: move.y,
                    z: move.z,
                    g: node.g + cost,
                    h: this.heuristic(move, goal),
                    f: 0,
                    parent: node,
                    action: move.action
                };
                neighbor.f = neighbor.g + neighbor.h;
                
                neighbors.push(neighbor);
            }
        }
        
        return neighbors;
    }
    
    private getPossibleMoves(from: AStarNode, dx: number, dz: number): {x: number, y: number, z: number, action: 'walk' | 'jump'}[] {
        const moves: {x: number, y: number, z: number, action: 'walk' | 'jump'}[] = [];
        
        const nextX = from.x + dx;
        const nextZ = from.z + dz;
        
        // Check same level first
        if (this.isValidPosition(nextX, from.y, nextZ)) {
            moves.push({x: nextX, y: from.y, z: nextZ, action: 'walk'});
        }
        
        // Check one step up
        if (this.isValidPosition(nextX, from.y + 1, nextZ) && 
            this.voxelEngine.getVoxel(nextX, from.y, nextZ) !== 0) { // There's a block to step on
            moves.push({x: nextX, y: from.y + 1, z: nextZ, action: 'walk'});
        }
        
        // Check stepping down (up to 3 blocks)
        for (let down = 1; down <= 3; down++) {
            const downY = from.y - down;
            if (downY >= 0 && this.isValidPosition(nextX, downY, nextZ)) {
                moves.push({x: nextX, y: downY, z: nextZ, action: 'walk'});
                break;
            }
        }
        
        // NO JUMPING - just pathfind around obstacles
        
        return moves;
    }
    
    private isValidPosition(x: number, y: number, z: number): boolean {
        // Position must be empty
        if (this.voxelEngine.getVoxel(x, y, z) !== 0) return false;
        
        // Must have ground below (or be at world bottom)
        if (y <= 0) return true;
        
        // Check for ground within reasonable distance
        for (let checkY = y - 1; checkY >= Math.max(0, y - 3); checkY--) {
            if (this.voxelEngine.getVoxel(x, checkY, z) !== 0) {
                return true;
            }
        }
        
        return false;
    }
    
    private heuristic(a: any, b: any): number {
        // Manhattan distance with slight vertical penalty
        return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + Math.abs(a.y - b.y) * 1.5;
    }
    
    private reconstructPath(node: AStarNode): PathNode[] {
        const path: PathNode[] = [];
        let current: AStarNode | null = node;
        
        while (current && current.parent) {
            path.unshift({
                x: current.x,
                y: current.y,
                z: current.z,
                action: current.action
            });
            current = current.parent;
        }
        
        console.log(`Path with ${path.length} nodes, jumps at:`, 
            path.filter(n => n.action === 'jump').map(n => `(${n.x},${n.y},${n.z})`));
        
        return path;
    }
    
    /**
     * Debug: Draw path visualization
     */
    debugDrawPath(path: PathNode[], scene: THREE.Scene): THREE.Group {
        const pathGroup = new THREE.Group();
        pathGroup.name = 'PathDebug';
        
        // Walk nodes - green
        const walkMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            opacity: 0.6, 
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Jump nodes - yellow
        const jumpMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00, 
            opacity: 0.8, 
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Flat plane geometry
        const geometry = new THREE.PlaneGeometry(0.09, 0.09);
        
        for (let i = 0; i < path.length; i++) {
            const node = path[i];
            const mesh = new THREE.Mesh(
                geometry, 
                node.action === 'jump' ? jumpMaterial : walkMaterial
            );
            
            // Position on ground
            mesh.position.set(
                node.x * 0.1 + 0.05,
                node.y * 0.1 + 0.001,
                node.z * 0.1 + 0.05
            );
            
            // Rotate to be horizontal
            mesh.rotation.x = -Math.PI / 2;
            
            mesh.name = `PathNode_${i}`;
            pathGroup.add(mesh);
        }
        
        scene.add(pathGroup);
        return pathGroup;
    }
}