import { VoxelEngine } from '../engine/VoxelEngine';
import * as THREE from 'three';

export interface PathNode {
    x: number;
    y: number;
    z: number;
    action: 'walk' | 'jump';
}

interface QueueNode {
    x: number;
    y: number;
    z: number;
    parent: QueueNode | null;
}

export class SimpleBFS {
    private voxelEngine: VoxelEngine;
    private maxDistance: number = 30;
    
    constructor(voxelEngine: VoxelEngine) {
        this.voxelEngine = voxelEngine;
    }
    
    findPath(start: THREE.Vector3, goal: THREE.Vector3): PathNode[] | null {
        // Convert to voxel coordinates
        const startX = Math.floor(start.x / 0.1);
        const startY = Math.floor(start.y / 0.1);
        const startZ = Math.floor(start.z / 0.1);
        
        const goalX = Math.floor(goal.x / 0.1);
        const goalY = Math.floor(goal.y / 0.1);
        const goalZ = Math.floor(goal.z / 0.1);
        
        console.log(`BFS: Finding path from (${startX},${startY},${startZ}) to (${goalX},${goalY},${goalZ})`);
        
        // Check if already at goal
        if (startX === goalX && startY === goalY && startZ === goalZ) {
            return [];
        }
        
        // Simple BFS
        const queue: QueueNode[] = [];
        const visited = new Set<string>();
        
        const startNode: QueueNode = {
            x: startX,
            y: startY,
            z: startZ,
            parent: null
        };
        
        queue.push(startNode);
        visited.add(`${startX},${startY},${startZ}`);
        
        let iterations = 0;
        const maxIterations = 5000;
        
        while (queue.length > 0 && iterations < maxIterations) {
            iterations++;
            
            const current = queue.shift()!;
            
            // Check if reached goal
            if (current.x === goalX && current.y === goalY && current.z === goalZ) {
                console.log(`Path found in ${iterations} iterations`);
                return this.reconstructPath(current);
            }
            
            // Get neighbors - only 4 cardinal directions, no diagonals
            const directions = [
                { dx: 1, dz: 0 },
                { dx: -1, dz: 0 },
                { dx: 0, dz: 1 },
                { dx: 0, dz: -1 }
            ];
            
            for (const dir of directions) {
                const moves = this.getPossibleMoves(current.x, current.y, current.z, dir.dx, dir.dz);
                
                for (const move of moves) {
                    const key = `${move.x},${move.y},${move.z}`;
                    
                    if (!visited.has(key)) {
                        visited.add(key);
                        
                        const newNode: QueueNode = {
                            x: move.x,
                            y: move.y,
                            z: move.z,
                            parent: current
                        };
                        
                        queue.push(newNode);
                    }
                }
            }
        }
        
        console.log(`No path found after ${iterations} iterations`);
        return null;
    }
    
    private getPossibleMoves(x: number, y: number, z: number, dx: number, dz: number): {x: number, y: number, z: number}[] {
        const moves: {x: number, y: number, z: number}[] = [];
        
        const nextX = x + dx;
        const nextZ = z + dz;
        
        // Check if we can walk forward at the same level
        if (this.canStandAt(nextX, y, nextZ)) {
            moves.push({ x: nextX, y: y, z: nextZ });
        }
        
        // Check if we can step up one block
        if (!this.isEmpty(nextX, y, nextZ) && this.canStandAt(nextX, y + 1, nextZ)) {
            moves.push({ x: nextX, y: y + 1, z: nextZ });
        }
        
        // Check if we can step down (up to 3 blocks)
        for (let down = 1; down <= 3; down++) {
            const newY = y - down;
            if (newY >= 0 && this.canStandAt(nextX, newY, nextZ)) {
                moves.push({ x: nextX, y: newY, z: nextZ });
                break; // Take first valid down position
            }
        }
        
        return moves;
    }
    
    private canStandAt(x: number, y: number, z: number): boolean {
        // Check feet position is empty
        if (this.voxelEngine.getVoxel(x, y, z) !== 0) {
            return false;
        }
        
        // Check head position is empty (player is ~2 blocks tall)
        if (this.voxelEngine.getVoxel(x, y + 1, z) !== 0) {
            return false;
        }
        
        // Check there's ground below
        if (y > 0 && this.voxelEngine.getVoxel(x, y - 1, z) === 0) {
            return false;
        }
        
        return true;
    }
    
    private isEmpty(x: number, y: number, z: number): boolean {
        return this.voxelEngine.getVoxel(x, y, z) === 0;
    }
    
    private reconstructPath(node: QueueNode): PathNode[] {
        const path: PathNode[] = [];
        let current: QueueNode | null = node;
        
        while (current && current.parent) {
            path.unshift({
                x: current.x,
                y: current.y,
                z: current.z,
                action: 'walk'
            });
            current = current.parent;
        }
        
        console.log(`Path has ${path.length} nodes`);
        return path;
    }
    
    debugDrawPath(path: PathNode[], scene: THREE.Scene): THREE.Group {
        // Remove existing path
        const existing = scene.getObjectByName('PathDebug');
        if (existing) {
            scene.remove(existing);
        }
        
        const pathGroup = new THREE.Group();
        pathGroup.name = 'PathDebug';
        
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            opacity: 0.6,
            transparent: true
        });
        
        const geometry = new THREE.PlaneGeometry(0.09, 0.09);
        
        for (const node of path) {
            const mesh = new THREE.Mesh(geometry, material);
            
            mesh.position.set(
                node.x * 0.1 + 0.05,
                node.y * 0.1 + 0.001,
                node.z * 0.1 + 0.05
            );
            
            mesh.rotation.x = -Math.PI / 2;
            pathGroup.add(mesh);
        }
        
        scene.add(pathGroup);
        return pathGroup;
    }
}