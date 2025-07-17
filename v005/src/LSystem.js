/**
 * LSystem.js - L-system implementation for procedural tree generation
 */

export class LSystem {
    constructor() {
        // Organic L-system with X variable
        this.treeTypes = {
            organic: {
                axiom: "X", // Back to simple start
                rules: {
                    "F": ["FF", "F", "FFF"], // Random F expansion
                    "X": [
                        "F+[&F-X\\F-X][^F+X/F+X][&F\\X][^F/X]",
                        "F-[^F+X/F+X][&F-X\\F-X][^F/X]",
                        "F[+F&X][−F^X][\\F+X][/F-X]",
                        "F+[&F-X][^F+X][\\FX][/FX]",
                        "F[&FX][^FX][+FX][-FX]", // More branching
                        "FF[+X][-X][&X][^X]" // Trunk-focused with branching
                    ]
                },
                iterations: 3,
                angle: 25,
                segmentLength: 2,
                // Variation parameters
                angleVariation: 10, // ±10 degrees random variation
                segmentVariation: 0.3, // ±30% segment length variation
                branchingProbability: 0.8 // 80% chance to execute branch commands
            },
            simple: {
                axiom: "T",  // T = trunk
                rules: {
                    "T": "T[+B][-B]",  // Trunk grows and creates two branches
                    "B": "B[+S][-S]",  // Branches create smaller branches
                    "S": "S"           // Small branches stop
                },
                iterations: 1,
                angle: 30,
                trunkLength: 10,    // 10 voxels tall trunk
                branchLength: 8,    // 8 voxels long branches
                smallBranchLength: 4 // 4 voxels small branches
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
                const rule = rules[char];
                if (rule) {
                    // If rule is an array, pick a random option
                    if (Array.isArray(rule)) {
                        nextResult += rule[Math.floor(Math.random() * rule.length)];
                    } else {
                        nextResult += rule;
                    }
                } else {
                    nextResult += char;
                }
            }
            result = nextResult;
        }
        
        return result;
    }
    
    /**
     * Generate tree voxels using L-system
     */
    generateTreeVoxels(treeType, width, height, depth, trunkHeight) {
        if (treeType === 'organic') {
            return this.generateOrganicTreeVoxels(width, height, depth, trunkHeight);
        } else {
            return this.generateSimpleTreeVoxels(width, height, depth, trunkHeight);
        }
    }
    
    /**
     * Generate organic L-system tree using turtle graphics
     */
    generateOrganicTreeVoxels(width, height, depth, trunkHeight) {
        const config = this.treeTypes.organic;
        const lString = this.generateString(config.axiom, config.rules, config.iterations);
        
        console.log('Generated L-string:', lString);
        
        const voxels = [];
        const centerX = Math.floor(width / 2);
        const centerZ = Math.floor(depth / 2);
        
        // Turtle graphics state with proper 3D vectors
        const stack = [];
        let position = { x: centerX, y: 0, z: centerZ };
        
        // Turtle orientation vectors
        let heading = { x: 0, y: 1, z: 0 };  // Forward direction (initially up)
        let left = { x: -1, y: 0, z: 0 };    // Left direction  
        let up = { x: 0, y: 0, z: 1 };       // Up direction
        
        const baseSegmentLength = config.segmentLength;
        const baseAngleStep = config.angle * Math.PI / 180;
        const angleVariation = (config.angleVariation || 0) * Math.PI / 180;
        const segmentVariation = config.segmentVariation || 0;
        
        // Helper functions for 3D vector operations
        const rotateVector = (vector, axis, angle) => {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const oneMinusCos = 1 - cos;
            
            const x = vector.x;
            const y = vector.y;
            const z = vector.z;
            
            const ax = axis.x;
            const ay = axis.y;
            const az = axis.z;
            
            return {
                x: (cos + ax * ax * oneMinusCos) * x + (ax * ay * oneMinusCos - az * sin) * y + (ax * az * oneMinusCos + ay * sin) * z,
                y: (ay * ax * oneMinusCos + az * sin) * x + (cos + ay * ay * oneMinusCos) * y + (ay * az * oneMinusCos - ax * sin) * z,
                z: (az * ax * oneMinusCos - ay * sin) * x + (az * ay * oneMinusCos + ax * sin) * y + (cos + az * az * oneMinusCos) * z
            };
        };
        
        const normalizeVector = (v) => {
            const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            return length > 0 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 0, z: 0 };
        };
        
        const crossProduct = (a, b) => ({
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x
        });
        
        // Process L-system string
        for (let i = 0; i < lString.length; i++) {
            const char = lString[i];
            
            switch (char) {
                case 'F': // Draw forward
                    // Add random variation to segment length
                    const randomSegmentLength = baseSegmentLength * (1 + (Math.random() - 0.5) * segmentVariation);
                    const newPos = {
                        x: position.x + heading.x * randomSegmentLength,
                        y: position.y + heading.y * randomSegmentLength,
                        z: position.z + heading.z * randomSegmentLength
                    };
                    
                    // Draw line from position to newPos
                    // Determine if this is trunk or branch
                    const isTrunk = position.y < trunkHeight;
                    const isBranch = !isTrunk && position.y < trunkHeight + height * 0.7;
                    this.drawLine(voxels, position, newPos, width, height, depth, isTrunk, isBranch);
                    
                    position = newPos;
                    break;
                    
                case '+': // Turn left (yaw)
                    const randomAngle1 = baseAngleStep + (Math.random() - 0.5) * angleVariation;
                    heading = rotateVector(heading, up, randomAngle1);
                    left = rotateVector(left, up, randomAngle1);
                    break;
                    
                case '-': // Turn right (yaw)
                    const randomAngle2 = baseAngleStep + (Math.random() - 0.5) * angleVariation;
                    heading = rotateVector(heading, up, -randomAngle2);
                    left = rotateVector(left, up, -randomAngle2);
                    break;
                    
                case '^': // Pitch up
                    const randomAngle3 = baseAngleStep + (Math.random() - 0.5) * angleVariation;
                    heading = rotateVector(heading, left, randomAngle3);
                    up = rotateVector(up, left, randomAngle3);
                    break;
                    
                case '&': // Pitch down
                    const randomAngle4 = baseAngleStep + (Math.random() - 0.5) * angleVariation;
                    heading = rotateVector(heading, left, -randomAngle4);
                    up = rotateVector(up, left, -randomAngle4);
                    break;
                    
                case '\\': // Roll clockwise
                    const randomAngle5 = baseAngleStep + (Math.random() - 0.5) * angleVariation;
                    left = rotateVector(left, heading, randomAngle5);
                    up = rotateVector(up, heading, randomAngle5);
                    break;
                    
                case '/': // Roll counter-clockwise
                    const randomAngle6 = baseAngleStep + (Math.random() - 0.5) * angleVariation;
                    left = rotateVector(left, heading, -randomAngle6);
                    up = rotateVector(up, heading, -randomAngle6);
                    break;
                    
                case '[': // Push state (save position and orientation)
                    // Random branching - some branches may not execute
                    if (Math.random() < (config.branchingProbability || 1.0)) {
                        stack.push({
                            position: { ...position },
                            heading: { ...heading },
                            left: { ...left },
                            up: { ...up }
                        });
                    }
                    break;
                    
                case ']': // Pop state (restore position and orientation)
                    if (stack.length > 0) {
                        const state = stack.pop();
                        position = state.position;
                        heading = state.heading;
                        left = state.left;
                        up = state.up;
                    }
                    break;
                    
                case 'X': // Do nothing - just a variable for rules
                    break;
            }
        }
        
        // Ensure trunk connectivity by adding a solid trunk first
        this.ensureTrunkConnectivity(voxels, centerX, centerZ, trunkHeight);
        
        // Add foliage clusters at branch endpoints
        this.addFoliageToTree(voxels, width, height, depth, trunkHeight);
        
        return voxels;
    }
    
    /**
     * Ensure trunk has connectivity and proper thickness
     */
    ensureTrunkConnectivity(voxels, centerX, centerZ, trunkHeight) {
        // Find all trunk voxels and group by height
        const trunkVoxelsByHeight = new Map();
        
        voxels.forEach(voxel => {
            if (voxel.isTrunk && voxel.y < trunkHeight) {
                const y = Math.floor(voxel.y);
                if (!trunkVoxelsByHeight.has(y)) {
                    trunkVoxelsByHeight.set(y, []);
                }
                trunkVoxelsByHeight.get(y).push(voxel);
            }
        });
        
        // Ensure trunk connectivity and add thickness at base
        for (let y = 0; y < trunkHeight; y++) {
            // Calculate trunk radius - thick only at very base
            let currentRadius = 1; // Default trunk radius
            
            // Only thick at bottom 20% of trunk height
            const thickBaseHeight = Math.max(2, Math.floor(trunkHeight * 0.2));
            if (y < thickBaseHeight) {
                const baseProgress = y / thickBaseHeight;
                const maxRadius = 2;
                // Quick exponential taper from thick base to normal
                currentRadius = Math.ceil(maxRadius * Math.pow(1 - baseProgress, 2) + 1 * baseProgress);
            }
            
            // Check if we have enough trunk voxels at this level
            const existingVoxels = trunkVoxelsByHeight.get(y) || [];
            const targetVoxelCount = currentRadius * currentRadius; // Rough area coverage
            
            if (existingVoxels.length < targetVoxelCount) {
                // Add trunk voxels in a circular pattern around center
                for (let dx = -currentRadius; dx <= currentRadius; dx++) {
                    for (let dz = -currentRadius; dz <= currentRadius; dz++) {
                        const distance = Math.sqrt(dx * dx + dz * dz);
                        if (distance <= currentRadius) {
                            const x = centerX + dx;
                            const z = centerZ + dz;
                            
                            // Check if voxel already exists here
                            const exists = existingVoxels.some(v => 
                                Math.floor(v.x) === x && Math.floor(v.z) === z
                            );
                            
                            if (!exists) {
                                voxels.push({
                                    x: x,
                                    y: y,
                                    z: z,
                                    filled: true,
                                    isTrunk: true
                                });
                                
                                // Update the map
                                if (!trunkVoxelsByHeight.has(y)) {
                                    trunkVoxelsByHeight.set(y, []);
                                }
                                trunkVoxelsByHeight.get(y).push({ x: x, y: y, z: z });
                            }
                        }
                    }
                }
            }
        }
        
        // Ensure ground connection - add base trunk voxel if missing
        if (!trunkVoxelsByHeight.has(0) || trunkVoxelsByHeight.get(0).length === 0) {
            voxels.push({
                x: centerX,
                y: 0,
                z: centerZ,
                filled: true,
                isTrunk: true
            });
        }
    }
    
    /**
     * Add foliage clusters to make the tree look leafy
     */
    addFoliageToTree(voxels, width, height, depth, trunkHeight) {
        // Find branch endpoints (voxels that are isolated at the extremities)
        const endpoints = [];
        const voxelMap = new Map();
        
        // Create a map of voxel positions for quick lookup
        voxels.forEach(voxel => {
            const key = `${Math.floor(voxel.x)},${Math.floor(voxel.y)},${Math.floor(voxel.z)}`;
            voxelMap.set(key, voxel);
        });
        
        // Find ALL branch endpoints (any non-trunk voxel with few neighbors)
        voxels.forEach(voxel => {
            // Consider all non-trunk voxels above a certain height
            if (!voxel.isTrunk && voxel.y > trunkHeight * 0.5) {
                const neighbors = this.countNeighbors(voxel, voxelMap);
                // If it has few neighbors, it's likely a branch tip
                if (neighbors <= 2) {
                    endpoints.push(voxel);
                }
            }
        });
        
        // Also add endpoints for any isolated branch segments
        voxels.forEach(voxel => {
            if (!voxel.isTrunk && voxel.y > trunkHeight) {
                const neighbors = this.countNeighbors(voxel, voxelMap);
                // If completely isolated or at end of branch, add foliage
                if (neighbors <= 1) {
                    // Check if already in endpoints to avoid duplicates
                    const alreadyExists = endpoints.some(ep => 
                        Math.floor(ep.x) === Math.floor(voxel.x) && 
                        Math.floor(ep.y) === Math.floor(voxel.y) && 
                        Math.floor(ep.z) === Math.floor(voxel.z)
                    );
                    if (!alreadyExists) {
                        endpoints.push(voxel);
                    }
                }
            }
        });
        
        // Add foliage clusters around each endpoint
        endpoints.forEach(endpoint => {
            this.addFoliageCluster(voxels, endpoint, width, height, depth);
        });
    }
    
    /**
     * Count neighboring voxels within 1 unit distance
     */
    countNeighbors(voxel, voxelMap) {
        let count = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (dx === 0 && dy === 0 && dz === 0) continue;
                    const key = `${Math.floor(voxel.x + dx)},${Math.floor(voxel.y + dy)},${Math.floor(voxel.z + dz)}`;
                    if (voxelMap.has(key)) count++;
                }
            }
        }
        return count;
    }
    
    /**
     * Add a foliage cluster around a branch endpoint
     */
    addFoliageCluster(voxels, center, width, height, depth) {
        // Adjust cluster size and density based on height
        const heightRatio = center.y / height;
        
        // Lower leaves are sparser, smaller clusters
        const baseDensity = 0.4; // Sparse at bottom
        const topDensity = 0.8;  // Dense at top
        const density = baseDensity + (topDensity - baseDensity) * heightRatio;
        
        // Smaller clusters lower down
        const baseRadius = 2;
        const topRadius = 4;
        const clusterRadius = baseRadius + (topRadius - baseRadius) * heightRatio + Math.random();
        
        for (let dx = -clusterRadius; dx <= clusterRadius; dx++) {
            for (let dy = -clusterRadius; dy <= clusterRadius; dy++) {
                for (let dz = -clusterRadius; dz <= clusterRadius; dz++) {
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    // Create spherical foliage clusters
                    if (distance <= clusterRadius && Math.random() < density) {
                        const leafX = Math.floor(center.x + dx);
                        const leafY = Math.floor(center.y + dy);
                        const leafZ = Math.floor(center.z + dz);
                        
                        // Check bounds
                        if (leafX >= 0 && leafX < width && 
                            leafY >= 0 && leafY < height && 
                            leafZ >= 0 && leafZ < depth) {
                            
                            // Generate random color variation for this leaf
                            const hueShift = (Math.random() - 0.5) * 0.1; // ±5% hue variation
                            const saturationMult = 0.8 + Math.random() * 0.4; // 80-120% saturation
                            const lightnessMult = 0.7 + Math.random() * 0.6; // 70-130% lightness
                            
                            voxels.push({
                                x: leafX,
                                y: leafY,
                                z: leafZ,
                                filled: true,
                                isTrunk: false,
                                isLeaf: true,
                                // Store color variation data
                                leafColorVariation: {
                                    hueShift: hueShift,
                                    saturationMult: saturationMult,
                                    lightnessMult: lightnessMult
                                }
                            });
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Draw a line between two points with guaranteed connectivity
     */
    drawLine(voxels, start, end, width, height, depth, isTrunk, isBranch = false) {
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const dz = Math.abs(end.z - start.z);
        
        const steps = Math.max(dx, dy, dz, 1); // Ensure at least 1 step
        
        // Use higher resolution for better connectivity
        const subSteps = steps * 2; // Double the resolution
        
        for (let i = 0; i <= subSteps; i++) {
            const t = subSteps === 0 ? 0 : i / subSteps;
            const x = Math.round(start.x + (end.x - start.x) * t);
            const y = Math.round(start.y + (end.y - start.y) * t);
            const z = Math.round(start.z + (end.z - start.z) * t);
            
            // Check bounds
            if (x >= 0 && x < width && y >= 0 && y < height && z >= 0 && z < depth) {
                // Check if voxel already exists to avoid duplicates
                const exists = voxels.some(v => 
                    Math.floor(v.x) === x && 
                    Math.floor(v.y) === y && 
                    Math.floor(v.z) === z
                );
                
                if (!exists) {
                    voxels.push({
                        x: x,
                        y: y,
                        z: z,
                        filled: true,
                        isTrunk: isTrunk,
                        isBranch: isBranch && !isTrunk
                    });
                }
            }
        }
        
        // Additional gap-filling: ensure direct neighbors are connected
        this.fillLineGaps(voxels, start, end, width, height, depth, isTrunk, isBranch);
    }
    
    /**
     * Fill any remaining gaps in the line
     */
    fillLineGaps(voxels, start, end, width, height, depth, isTrunk, isBranch) {
        // Create a map of existing voxels for quick lookup
        const voxelMap = new Set();
        voxels.forEach(v => {
            voxelMap.add(`${Math.floor(v.x)},${Math.floor(v.y)},${Math.floor(v.z)}`);
        });
        
        // Walk along the line and ensure connectivity
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dz = end.z - start.z;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (length === 0) return;
        
        const stepSize = 0.5; // Small step size for thorough checking
        const numSteps = Math.ceil(length / stepSize);
        
        let lastVoxel = { 
            x: Math.round(start.x), 
            y: Math.round(start.y), 
            z: Math.round(start.z) 
        };
        
        for (let i = 1; i <= numSteps; i++) {
            const t = i / numSteps;
            const currentVoxel = {
                x: Math.round(start.x + dx * t),
                y: Math.round(start.y + dy * t),
                z: Math.round(start.z + dz * t)
            };
            
            // Check if we have a gap between last and current voxel
            const gap = Math.max(
                Math.abs(currentVoxel.x - lastVoxel.x),
                Math.abs(currentVoxel.y - lastVoxel.y),
                Math.abs(currentVoxel.z - lastVoxel.z)
            );
            
            if (gap > 1) {
                // Fill the gap with intermediate voxels
                this.fillVoxelGap(voxels, lastVoxel, currentVoxel, width, height, depth, isTrunk, isBranch, voxelMap);
            }
            
            lastVoxel = currentVoxel;
        }
    }
    
    /**
     * Fill gap between two voxels
     */
    fillVoxelGap(voxels, start, end, width, height, depth, isTrunk, isBranch, voxelMap) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dz = end.z - start.z;
        const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
        
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const x = Math.round(start.x + dx * t);
            const y = Math.round(start.y + dy * t);
            const z = Math.round(start.z + dz * t);
            
            // Check bounds and if voxel doesn't already exist
            if (x >= 0 && x < width && y >= 0 && y < height && z >= 0 && z < depth) {
                const key = `${x},${y},${z}`;
                if (!voxelMap.has(key)) {
                    voxels.push({
                        x: x,
                        y: y,
                        z: z,
                        filled: true,
                        isTrunk: isTrunk,
                        isBranch: isBranch && !isTrunk
                    });
                    voxelMap.add(key);
                }
            }
        }
    }
    
    /**
     * Generate simple L-system tree with controlled branching
     */
    generateSimpleTreeVoxels(width, height, depth, trunkHeight) {
        const voxels = [];
        const centerX = Math.floor(width / 2);
        const centerZ = Math.floor(depth / 2);
        
        // Simple manual tree structure:
        // 1. Trunk - straight up
        for (let y = 0; y < trunkHeight; y++) {
            voxels.push({
                x: centerX,
                y: y,
                z: centerZ,
                filled: true,
                isTrunk: true
            });
        }
        
        // 2. First level branches - two long branches at 30 degree angles
        const branchLength = 8;
        const angle1 = 30 * Math.PI / 180;
        
        // Left branch
        for (let i = 0; i < branchLength; i++) {
            const x = centerX - Math.ceil(i * Math.sin(angle1));
            const y = trunkHeight + Math.floor(i * Math.cos(angle1));
            const z = centerZ;
            
            if (x >= 0 && x < width && y < height) {
                voxels.push({
                    x: x,
                    y: y,
                    z: z,
                    filled: true,
                    isTrunk: true
                });
            }
        }
        
        // Right branch
        for (let i = 0; i < branchLength; i++) {
            const x = centerX + Math.ceil(i * Math.sin(angle1));
            const y = trunkHeight + Math.floor(i * Math.cos(angle1));
            const z = centerZ;
            
            if (x >= 0 && x < width && y < height) {
                voxels.push({
                    x: x,
                    y: y,
                    z: z,
                    filled: true,
                    isTrunk: true
                });
            }
        }
        
        // 3. Second level branches - shorter branches from the end of first branches
        const smallBranchLength = 4;
        const angle2 = 25 * Math.PI / 180;
        
        // Calculate end positions of first branches
        const leftEndX = centerX - Math.ceil((branchLength - 1) * Math.sin(angle1));
        const leftEndY = trunkHeight + Math.floor((branchLength - 1) * Math.cos(angle1));
        const rightEndX = centerX + Math.ceil((branchLength - 1) * Math.sin(angle1));
        const rightEndY = trunkHeight + Math.floor((branchLength - 1) * Math.cos(angle1));
        
        // Small branches from left branch
        for (let i = 0; i < smallBranchLength; i++) {
            // Inner small branch
            const x1 = leftEndX + Math.ceil(i * Math.sin(angle2));
            const y1 = leftEndY + Math.floor(i * Math.cos(angle2));
            
            if (x1 >= 0 && x1 < width && y1 < height) {
                voxels.push({
                    x: x1,
                    y: y1,
                    z: centerZ,
                    filled: true,
                    isTrunk: false
                });
            }
            
            // Outer small branch
            const x2 = leftEndX - Math.ceil(i * Math.sin(angle2) * 0.5);
            const y2 = leftEndY + Math.floor(i * Math.cos(angle2));
            
            if (x2 >= 0 && x2 < width && y2 < height) {
                voxels.push({
                    x: x2,
                    y: y2,
                    z: centerZ,
                    filled: true,
                    isTrunk: false
                });
            }
        }
        
        // Small branches from right branch
        for (let i = 0; i < smallBranchLength; i++) {
            // Inner small branch
            const x1 = rightEndX - Math.ceil(i * Math.sin(angle2));
            const y1 = rightEndY + Math.floor(i * Math.cos(angle2));
            
            if (x1 >= 0 && x1 < width && y1 < height) {
                voxels.push({
                    x: x1,
                    y: y1,
                    z: centerZ,
                    filled: true,
                    isTrunk: false
                });
            }
            
            // Outer small branch
            const x2 = rightEndX + Math.ceil(i * Math.sin(angle2) * 0.5);
            const y2 = rightEndY + Math.floor(i * Math.cos(angle2));
            
            if (x2 >= 0 && x2 < width && y2 < height) {
                voxels.push({
                    x: x2,
                    y: y2,
                    z: centerZ,
                    filled: true,
                    isTrunk: false
                });
            }
        }
        
        // Add some foliage at the ends
        this.addSimpleLeaves(voxels, width, height, depth);
        
        return voxels;
    }
    
    /**
     * Draw a branch segment
     */
    drawBranch(voxels, start, direction, length, thickness, trunkHeight) {
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
     * Add simple leaves at branch endpoints
     */
    addSimpleLeaves(voxels, width, height, depth) {
        // Add small clusters of leaves at the end of branches
        const leafPositions = [];
        
        // Find the highest voxels (branch tips)
        voxels.forEach(voxel => {
            if (!voxel.isTrunk && voxel.y > height * 0.7) {
                leafPositions.push({ x: voxel.x, y: voxel.y, z: voxel.z });
            }
        });
        
        // Add leaf clusters
        leafPositions.forEach(pos => {
            // Small 3x3x3 cluster
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const x = pos.x + dx;
                        const y = pos.y + dy;
                        const z = pos.z + dz;
                        
                        if (x >= 0 && x < width && y >= 0 && y < height && z >= 0 && z < depth) {
                            if (Math.random() > 0.3) { // 70% chance for each leaf voxel
                                voxels.push({
                                    x: x,
                                    y: y,
                                    z: z,
                                    filled: true,
                                    isTrunk: false
                                });
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Add leaves at branch endpoints (old complex version)
     */
    addLeaves(voxels, width, height, depth) {
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