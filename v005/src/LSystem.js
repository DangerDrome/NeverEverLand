/**
 * LSystem.js - L-system implementation for procedural tree generation
 */

export class LSystem {
    constructor() {
        // Define different tree types with their L-system rules
        this.treeTypes = {
            simple: {
                axiom: "F",
                rules: {
                    "F": "F[+F]F[-F]F"
                },
                iterations: 3,
                angle: 25,
                lengthFactor: 0.5
            },
            bushy: {
                axiom: "F",
                rules: {
                    "F": "FF+[+F-F-F]-[-F+F+F]"
                },
                iterations: 3,
                angle: 22.5,
                lengthFactor: 0.5
            },
            pine: {
                axiom: "F",
                rules: {
                    "F": "F[++F]F[--F]F"
                },
                iterations: 4,
                angle: 15,
                lengthFactor: 0.6
            },
            willow: {
                axiom: "F",
                rules: {
                    "F": "F[+F]F[-F][F]"
                },
                iterations: 4,
                angle: 30,
                lengthFactor: 0.65
            }
        };
    }
    
    /**
     * Generate L-system string from axiom and rules
     */
    generateString(axiom, rules, iterations) {
        let result = axiom;
        
        for (let i = 0; i < iterations; i++) {
            let nextResult = "";
            for (let char of result) {
                nextResult += rules[char] || char;
            }
            result = nextResult;
        }
        
        return result;
    }
    
    /**
     * Convert L-system string to 3D voxel positions
     */
    generateTreeVoxels(treeType, width, height, depth, trunkHeight) {
        const config = this.treeTypes[treeType] || this.treeTypes.simple;
        const lString = this.generateString(config.axiom, config.rules, config.iterations);
        
        const voxels = [];
        const centerX = width / 2;
        const centerZ = depth / 2;
        
        // State for turtle graphics
        const stack = [];
        let position = { x: centerX, y: 0, z: centerZ };
        let direction = { x: 0, y: 1, z: 0 }; // Growing upward
        let angleX = 0; // Rotation around X axis
        let angleZ = 0; // Rotation around Z axis
        let segmentLength = height / Math.pow(2, config.iterations); // Base segment length
        let thickness = Math.max(1, Math.min(width, depth) / 8); // Base thickness
        
        // Process L-system string
        for (let char of lString) {
            switch (char) {
                case 'F': // Draw forward
                    this.drawBranch(voxels, position, direction, segmentLength, thickness, trunkHeight, height);
                    
                    // Move position forward
                    position = {
                        x: position.x + direction.x * segmentLength,
                        y: position.y + direction.y * segmentLength,
                        z: position.z + direction.z * segmentLength
                    };
                    
                    // Reduce thickness for higher branches
                    if (position.y > trunkHeight) {
                        thickness *= 0.8;
                    }
                    break;
                    
                case '+': // Rotate positive
                    angleX += config.angle * Math.PI / 180;
                    direction = this.rotateDirection(direction, angleX, angleZ);
                    break;
                    
                case '-': // Rotate negative
                    angleX -= config.angle * Math.PI / 180;
                    direction = this.rotateDirection(direction, angleX, angleZ);
                    break;
                    
                case '[': // Push state
                    stack.push({
                        position: { ...position },
                        direction: { ...direction },
                        angleX: angleX,
                        angleZ: angleZ,
                        thickness: thickness
                    });
                    
                    // Also rotate around Z for 3D branching
                    angleZ += (Math.random() - 0.5) * config.angle * Math.PI / 180;
                    direction = this.rotateDirection(direction, angleX, angleZ);
                    break;
                    
                case ']': // Pop state
                    if (stack.length > 0) {
                        const state = stack.pop();
                        position = state.position;
                        direction = state.direction;
                        angleX = state.angleX;
                        angleZ = state.angleZ;
                        thickness = state.thickness;
                    }
                    break;
            }
            
            // Reduce segment length as we go higher
            segmentLength *= config.lengthFactor;
        }
        
        // Add leaves at the end points
        this.addLeaves(voxels, stack, width, height, depth);
        
        return voxels;
    }
    
    /**
     * Draw a branch segment
     */
    drawBranch(voxels, start, direction, length, thickness, trunkHeight, totalHeight) {
        const steps = Math.ceil(length);
        const isTrunk = start.y < trunkHeight;
        
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const pos = {
                x: start.x + direction.x * length * t,
                y: start.y + direction.y * length * t,
                z: start.z + direction.z * length * t
            };
            
            // Draw a sphere of voxels at this position
            const radius = thickness * (isTrunk ? 1 : 0.7);
            this.addSphere(voxels, pos, radius, isTrunk);
        }
    }
    
    /**
     * Add a sphere of voxels
     */
    addSphere(voxels, center, radius, isTrunk) {
        const r = Math.ceil(radius);
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dz = -r; dz <= r; dz++) {
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (distance <= radius) {
                        const x = Math.floor(center.x + dx);
                        const y = Math.floor(center.y + dy);
                        const z = Math.floor(center.z + dz);
                        
                        if (x >= 0 && y >= 0 && z >= 0) {
                            voxels.push({
                                x: x,
                                y: y,
                                z: z,
                                filled: true,
                                isTrunk: isTrunk
                            });
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Add leaves at branch endpoints
     */
    addLeaves(voxels, endpoints, width, height, depth) {
        // Add foliage clusters at various points
        const foliagePositions = [];
        
        // Collect all voxel positions that are near the top
        const topThreshold = height * 0.6;
        const existingPositions = new Set();
        
        voxels.forEach(voxel => {
            if (voxel.y > topThreshold && !voxel.isTrunk) {
                const key = `${Math.floor(voxel.x)},${Math.floor(voxel.y)},${Math.floor(voxel.z)}`;
                if (!existingPositions.has(key)) {
                    existingPositions.add(key);
                    foliagePositions.push({ x: voxel.x, y: voxel.y, z: voxel.z });
                }
            }
        });
        
        // Add leaf clusters around branch endpoints
        foliagePositions.forEach(pos => {
            const clusterRadius = 2 + Math.random() * 2;
            for (let i = 0; i < 20; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * clusterRadius;
                const y = (Math.random() - 0.5) * clusterRadius;
                
                const leafX = Math.floor(pos.x + Math.cos(angle) * r);
                const leafY = Math.floor(pos.y + y);
                const leafZ = Math.floor(pos.z + Math.sin(angle) * r);
                
                if (leafX >= 0 && leafY >= 0 && leafZ >= 0 &&
                    leafX < width && leafY < height && leafZ < depth) {
                    voxels.push({
                        x: leafX,
                        y: leafY,
                        z: leafZ,
                        filled: true,
                        isTrunk: false
                    });
                }
            }
        });
    }
    
    /**
     * Rotate direction vector
     */
    rotateDirection(dir, angleX, angleZ) {
        // Simplified 3D rotation
        const cosX = Math.cos(angleX);
        const sinX = Math.sin(angleX);
        const cosZ = Math.cos(angleZ);
        const sinZ = Math.sin(angleZ);
        
        // Rotate around X axis (pitch)
        let y = dir.y * cosX - dir.z * sinX;
        let z = dir.y * sinX + dir.z * cosX;
        
        // Rotate around Z axis (yaw)
        let x = dir.x * cosZ - y * sinZ;
        y = dir.x * sinZ + y * cosZ;
        
        // Normalize
        const length = Math.sqrt(x * x + y * y + z * z);
        return {
            x: x / length,
            y: y / length,
            z: z / length
        };
    }
}