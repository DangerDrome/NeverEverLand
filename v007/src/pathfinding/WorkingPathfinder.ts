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
    g: number; // Cost from start
    h: number; // Heuristic to end
    f: number; // Total cost
    parent: Node | null;
}

export class WorkingPathfinder {
    private voxelEngine: VoxelEngine;
    
    constructor(voxelEngine: VoxelEngine) {
        this.voxelEngine = voxelEngine;
    }
    
    findPath(start: THREE.Vector3, goal: THREE.Vector3): PathNode[] | null {
        // Convert world to voxel coordinates
        const sx = Math.floor(start.x / 0.1);
        const sy = Math.floor(start.y / 0.1);
        const sz = Math.floor(start.z / 0.1);
        
        const gx = Math.floor(goal.x / 0.1);
        const gy = Math.floor(goal.y / 0.1);
        const gz = Math.floor(goal.z / 0.1);
        
        console.log(`Finding path from (${sx},${sy},${sz}) to (${gx},${gy},${gz})`);
        
        // A* algorithm
        const openSet: Node[] = [];
        const closedSet = new Set<string>();
        
        const startNode: Node = {
            x: sx, y: sy, z: sz,
            g: 0,
            h: this.distance(sx, sy, sz, gx, gy, gz),
            f: 0,
            parent: null
        };
        startNode.f = startNode.g + startNode.h;
        
        openSet.push(startNode);
        
        let iterations = 0;
        const maxIterations = 5000;
        
        while (openSet.length > 0 && iterations++ < maxIterations) {
            // Get node with lowest f cost
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift()!;
            
            // Found goal?
            if (current.x === gx && current.y === gy && current.z === gz) {
                console.log(`Path found in ${iterations} iterations`);
                return this.buildPath(current);
            }
            
            closedSet.add(this.key(current.x, current.y, current.z));
            
            // Check all neighbors
            this.getNeighbors(current).forEach(neighbor => {
                const k = this.key(neighbor.x, neighbor.y, neighbor.z);
                if (closedSet.has(k)) return;
                
                const g = current.g + 1;
                const h = this.distance(neighbor.x, neighbor.y, neighbor.z, gx, gy, gz);
                const f = g + h;
                
                // Check if already in open set
                const existing = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y && n.z === neighbor.z);
                
                if (!existing) {
                    openSet.push({
                        x: neighbor.x,
                        y: neighbor.y,
                        z: neighbor.z,
                        g: g,
                        h: h,
                        f: f,
                        parent: current
                    });
                } else if (g < existing.g) {
                    existing.g = g;
                    existing.f = g + existing.h;
                    existing.parent = current;
                }
            });
        }
        
        console.log(`No path found after ${iterations} iterations`);
        return null;
    }
    
    private getNeighbors(node: Node): {x: number, y: number, z: number}[] {
        const neighbors: {x: number, y: number, z: number}[] = [];
        
        // 4 cardinal directions
        const dirs = [
            [1, 0], [-1, 0], [0, 1], [0, -1]
        ];
        
        for (const [dx, dz] of dirs) {
            const nx = node.x + dx;
            const nz = node.z + dz;
            
            // Try same level
            if (this.isValidMove(nx, node.y, nz)) {
                neighbors.push({x: nx, y: node.y, z: nz});
            }
            
            // Try step up (if blocked at same level)
            else if (this.isValidMove(nx, node.y + 1, nz)) {
                neighbors.push({x: nx, y: node.y + 1, z: nz});
            }
            
            // Try step down
            else {
                for (let dy = 1; dy <= 3; dy++) {
                    if (this.isValidMove(nx, node.y - dy, nz)) {
                        neighbors.push({x: nx, y: node.y - dy, z: nz});
                        break;
                    }
                }
            }
        }
        
        return neighbors;
    }
    
    private isValidMove(x: number, y: number, z: number): boolean {
        // Must be empty at foot level
        if (this.voxelEngine.getVoxel(x, y, z) !== 0) return false;
        
        // Must be empty at head level
        if (this.voxelEngine.getVoxel(x, y + 1, z) !== 0) return false;
        
        // Must have ground below (or be at world bottom)
        if (y > 0 && this.voxelEngine.getVoxel(x, y - 1, z) === 0) return false;
        
        return true;
    }
    
    private distance(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number {
        return Math.abs(x2 - x1) + Math.abs(y2 - y1) + Math.abs(z2 - z1);
    }
    
    private key(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }
    
    private buildPath(node: Node): PathNode[] {
        const path: PathNode[] = [];
        let current: Node | null = node;
        
        while (current && current.parent) {
            path.unshift({
                x: current.x,
                y: current.y,
                z: current.z,
                action: 'walk'
            });
            current = current.parent;
        }
        
        return path;
    }
    
    debugDrawPath(path: PathNode[], scene: THREE.Scene): THREE.Group {
        const existing = scene.getObjectByName('PathDebug');
        if (existing) scene.remove(existing);
        
        const group = new THREE.Group();
        group.name = 'PathDebug';
        
        const mat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            opacity: 0.6,
            transparent: true
        });
        
        const geom = new THREE.PlaneGeometry(0.09, 0.09);
        
        path.forEach(node => {
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(
                node.x * 0.1 + 0.05,
                node.y * 0.1 + 0.001,
                node.z * 0.1 + 0.05
            );
            mesh.rotation.x = -Math.PI / 2;
            group.add(mesh);
        });
        
        scene.add(group);
        return group;
    }
}