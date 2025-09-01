import { VoxelEngine } from '../engine/VoxelEngine';
import * as THREE from 'three';

export interface PathNode {
    x: number;
    y: number;
    z: number;
    action: 'walk' | 'jump';
}

interface SearchNode {
    x: number;
    y: number;
    z: number;
    parent: SearchNode | null;
}

export class DebugPathfinder {
    private voxelEngine: VoxelEngine;
    private debugVisuals: THREE.Group;
    
    constructor(voxelEngine: VoxelEngine) {
        this.voxelEngine = voxelEngine;
        this.debugVisuals = new THREE.Group();
        this.debugVisuals.name = 'PathfindingDebug';
    }
    
    findPath(start: THREE.Vector3, goal: THREE.Vector3): PathNode[] | null {
        console.log('=== DEBUG PATHFINDER START ===');
        console.log(`World Start: (${start.x.toFixed(3)}, ${start.y.toFixed(3)}, ${start.z.toFixed(3)})`);
        console.log(`World Goal: (${goal.x.toFixed(3)}, ${goal.y.toFixed(3)}, ${goal.z.toFixed(3)})`);
        
        // Convert to voxel coordinates 
        // Use floor for Y to stay at ground level (0.05 -> 0, not 1)
        const startX = Math.floor(start.x / 0.1);
        const startY = Math.floor(start.y / 0.1);
        const startZ = Math.floor(start.z / 0.1);
        
        const goalX = Math.floor(goal.x / 0.1);
        const goalY = Math.floor(goal.y / 0.1);
        const goalZ = Math.floor(goal.z / 0.1);
        
        console.log(`Voxel Start: (${startX}, ${startY}, ${startZ})`);
        console.log(`Voxel Goal: (${goalX}, ${goalY}, ${goalZ})`);
        
        // Test voxel detection at start and goal
        this.testVoxelAt(startX, startY, startZ, 'START');
        this.testVoxelAt(goalX, goalY, goalZ, 'GOAL');
        
        // Test voxels between start and goal
        console.log('\n=== Testing direct line voxels ===');
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const testX = Math.round(startX + (goalX - startX) * t);
            const testY = Math.round(startY + (goalY - startY) * t);
            const testZ = Math.round(startZ + (goalZ - startZ) * t);
            this.testVoxelAt(testX, testY, testZ, `STEP ${i}`);
        }
        
        // Simple BFS with extensive logging
        console.log('\n=== Starting BFS Search ===');
        const queue: SearchNode[] = [];
        const visited = new Set<string>();
        
        const startNode: SearchNode = {
            x: startX,
            y: startY,
            z: startZ,
            parent: null
        };
        
        queue.push(startNode);
        visited.add(this.key(startX, startY, startZ));
        
        let iterations = 0;
        const maxIterations = 1000;
        let nodesExplored = 0;
        let blockedNodes = 0;
        
        while (queue.length > 0 && iterations < maxIterations) {
            iterations++;
            const current = queue.shift()!;
            
            if (iterations % 50 === 0) {
                console.log(`Iteration ${iterations}: Queue size=${queue.length}, Explored=${nodesExplored}, Blocked=${blockedNodes}`);
            }
            
            // Check if we reached goal
            if (current.x === goalX && current.y === goalY && current.z === goalZ) {
                console.log(`\n=== PATH FOUND ===`);
                console.log(`Iterations: ${iterations}`);
                console.log(`Nodes explored: ${nodesExplored}`);
                console.log(`Blocked nodes: ${blockedNodes}`);
                return this.reconstructPath(current);
            }
            
            // Get neighbors
            const directions = [
                { dx: 1, dz: 0, name: 'EAST' },
                { dx: -1, dz: 0, name: 'WEST' },
                { dx: 0, dz: 1, name: 'NORTH' },
                { dx: 0, dz: -1, name: 'SOUTH' }
            ];
            
            for (const dir of directions) {
                const nx = current.x + dir.dx;
                const nz = current.z + dir.dz;
                
                // Try same level
                const moves = this.getPossibleMoves(current.x, current.y, current.z, dir.dx, dir.dz, dir.name);
                
                for (const move of moves) {
                    const k = this.key(move.x, move.y, move.z);
                    
                    if (!visited.has(k)) {
                        visited.add(k);
                        nodesExplored++;
                        
                        queue.push({
                            x: move.x,
                            y: move.y,
                            z: move.z,
                            parent: current
                        });
                        
                        if (iterations <= 10) {
                            console.log(`  Added to queue: (${move.x}, ${move.y}, ${move.z})`);
                        }
                    }
                }
            }
        }
        
        console.log(`\n=== NO PATH FOUND ===`);
        console.log(`Iterations: ${iterations}`);
        console.log(`Nodes explored: ${nodesExplored}`);
        console.log(`Blocked nodes: ${blockedNodes}`);
        
        return null;
    }
    
    private getPossibleMoves(x: number, y: number, z: number, dx: number, dz: number, dirName: string): {x: number, y: number, z: number}[] {
        const moves: {x: number, y: number, z: number}[] = [];
        const nx = x + dx;
        const nz = z + dz;
        
        // Log what we're checking
        if (Math.random() < 0.05) { // Log 5% to avoid spam
            console.log(`Checking ${dirName} from (${x},${y},${z}) to (${nx},${y},${nz})`);
        }
        
        // Check same level
        if (this.canWalkTo(nx, y, nz, 'same')) {
            moves.push({ x: nx, y: y, z: nz });
        }
        
        // Check step up
        if (this.canWalkTo(nx, y + 1, nz, 'up')) {
            // Verify there's actually a block to step on
            const hasBlock = this.voxelEngine.getVoxel(nx, y, nz) !== 0;
            if (hasBlock) {
                moves.push({ x: nx, y: y + 1, z: nz });
            }
        }
        
        // Check step down
        for (let dy = 1; dy <= 3; dy++) {
            if (y - dy >= 0 && this.canWalkTo(nx, y - dy, nz, 'down')) {
                moves.push({ x: nx, y: y - dy, z: nz });
                break;
            }
        }
        
        return moves;
    }
    
    private canWalkTo(x: number, y: number, z: number, moveType: string): boolean {
        // Check foot position
        const footVoxel = this.voxelEngine.getVoxel(x, y, z);
        if (footVoxel !== 0) {
            if (Math.random() < 0.02) {
                console.log(`  BLOCKED at feet (${x},${y},${z}): voxel=${footVoxel}`);
            }
            return false;
        }
        
        // Check head position
        const headVoxel = this.voxelEngine.getVoxel(x, y + 1, z);
        if (headVoxel !== 0) {
            if (Math.random() < 0.02) {
                console.log(`  BLOCKED at head (${x},${y+1},${z}): voxel=${headVoxel}`);
            }
            return false;
        }
        
        // Check ground
        if (y > 0) {
            const groundVoxel = this.voxelEngine.getVoxel(x, y - 1, z);
            if (groundVoxel === 0) {
                if (Math.random() < 0.02) {
                    console.log(`  NO GROUND at (${x},${y-1},${z})`);
                }
                return false;
            }
        }
        
        return true;
    }
    
    private testVoxelAt(x: number, y: number, z: number, label: string) {
        console.log(`\nTesting ${label} at (${x}, ${y}, ${z}):`);
        
        // Test multiple heights
        for (let dy = -1; dy <= 2; dy++) {
            const testY = y + dy;
            const voxel = this.voxelEngine.getVoxel(x, testY, z);
            const symbol = voxel === 0 ? '.' : '#';
            console.log(`  y=${testY}: voxel=${voxel} [${symbol}]`);
        }
        
        // Test surrounding positions at same level
        console.log(`  Surrounding at y=${y}:`);
        for (let dz = -1; dz <= 1; dz++) {
            let row = '    ';
            for (let dx = -1; dx <= 1; dx++) {
                const v = this.voxelEngine.getVoxel(x + dx, y, z + dz);
                row += v === 0 ? '.' : '#';
            }
            console.log(row);
        }
    }
    
    private key(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }
    
    private reconstructPath(node: SearchNode): PathNode[] {
        const path: PathNode[] = [];
        let current: SearchNode | null = node;
        
        while (current && current.parent) {
            path.unshift({
                x: current.x,
                y: current.y,
                z: current.z,
                action: 'walk'
            });
            current = current.parent;
        }
        
        console.log('\n=== PATH DETAILS ===');
        path.forEach((node, i) => {
            console.log(`  Step ${i}: (${node.x}, ${node.y}, ${node.z})`);
        });
        
        return path;
    }
    
    debugDrawPath(path: PathNode[], scene: THREE.Scene): THREE.Group {
        // Remove old debug visuals
        const existing = scene.getObjectByName('PathDebug');
        if (existing) scene.remove(existing);
        
        const group = new THREE.Group();
        group.name = 'PathDebug';
        
        // Green for path
        const pathMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            opacity: 0.6,
            transparent: true
        });
        
        // Red for blocked positions
        const blockedMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            opacity: 0.4,
            transparent: true
        });
        
        const geom = new THREE.PlaneGeometry(0.09, 0.09);
        
        // Draw path
        path.forEach((node, i) => {
            const mesh = new THREE.Mesh(geom, pathMat);
            mesh.position.set(
                node.x * 0.1 + 0.05,
                node.y * 0.1 + 0.001,
                node.z * 0.1 + 0.05
            );
            mesh.rotation.x = -Math.PI / 2;
            
            // Add text label
            if (i % 5 === 0) {
                console.log(`Path node ${i} at world pos: (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
            }
            
            group.add(mesh);
        });
        
        scene.add(group);
        return group;
    }
}