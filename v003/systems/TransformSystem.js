import { System } from '../core/System.js';
import { TransformComponent } from '../components/TransformComponent.js';

/**
 * Transform System
 * Handles matrix calculations, hierarchy updates, and spatial indexing
 */
export class TransformSystem extends System {
    constructor(world) {
        super(world);
        this.requiredComponents = ['TransformComponent'];
        this.priority = 10; // High priority - other systems depend on transforms
        
        // Spatial indexing for performance
        this.spatialGrid = new SpatialGrid(100, 100, 10); // 100x100 world, 10-unit cells
        this.needsSpatialUpdate = new Set();
        
        // Matrix calculation pools
        this.matrixPool = [];
        this.tempMatrix = this.createMatrix();
        this.tempVector = { x: 0, y: 0, z: 0 };
    }
    
    update(deltaTime, entities) {
        // Update velocities and positions
        this.updateMovement(entities, deltaTime);
        
        // Update matrices for dirty transforms
        this.updateMatrices(entities);
        
        // Update spatial indexing
        this.updateSpatialIndex(entities);
        
        // Update bounds for entities that need it
        this.updateBounds(entities);
    }
    
    updateMovement(entities, deltaTime) {
        for (const entity of entities) {
            const transform = entity.getComponent('TransformComponent');
            
            // Apply velocity-based movement
            transform.applyVelocity(deltaTime);
            
            // Apply drag/friction if configured
            if (transform.drag) {
                const drag = Math.pow(1 - transform.drag, deltaTime);
                transform.velocity.x *= drag;
                transform.velocity.y *= drag;
                transform.velocity.z *= drag;
            }
        }
    }
    
    updateMatrices(entities) {
        // Sort by hierarchy depth to ensure parents are updated before children
        const sortedEntities = this.sortByHierarchyDepth(entities);
        
        for (const entity of sortedEntities) {
            const transform = entity.getComponent('TransformComponent');
            
            if (transform.isDirty) {
                this.updateTransformMatrix(transform);
                transform.markClean();
            }
        }
    }
    
    updateTransformMatrix(transform) {
        // Create local matrix
        if (!transform.matrix) {
            transform.matrix = this.createMatrix();
        }
        
        this.calculateLocalMatrix(transform, transform.matrix);
        
        // Calculate world matrix
        if (!transform.worldMatrix) {
            transform.worldMatrix = this.createMatrix();
        }
        
        if (transform.parent) {
            // World matrix = parent world matrix * local matrix
            this.multiplyMatrices(transform.parent.worldMatrix, transform.matrix, transform.worldMatrix);
        } else {
            // No parent, world matrix = local matrix
            this.copyMatrix(transform.matrix, transform.worldMatrix);
        }
        
        // Mark for spatial index update
        this.needsSpatialUpdate.add(transform);
    }
    
    calculateLocalMatrix(transform, matrix) {
        // Reset matrix to identity
        this.setIdentityMatrix(matrix);
        
        // Apply transformations: Scale * Rotation * Translation
        this.applyScale(matrix, transform.scale);
        this.applyRotation(matrix, transform.rotation);
        this.applyTranslation(matrix, transform.position);
    }
    
    sortByHierarchyDepth(entities) {
        return entities.filter(entity => {
            const transform = entity.getComponent('TransformComponent');
            return transform.isDirty;
        }).sort((a, b) => {
            const depthA = this.getHierarchyDepth(a.getComponent('TransformComponent'));
            const depthB = this.getHierarchyDepth(b.getComponent('TransformComponent'));
            return depthA - depthB;
        });
    }
    
    getHierarchyDepth(transform) {
        let depth = 0;
        let current = transform.parent;
        while (current) {
            depth++;
            current = current.parent;
        }
        return depth;
    }
    
    updateSpatialIndex(entities) {
        // Remove entities that need updates from spatial grid
        for (const transform of this.needsSpatialUpdate) {
            if (transform.spatialIndex) {
                this.spatialGrid.remove(transform.spatialIndex);
            }
        }
        
        // Re-add with new positions
        for (const transform of this.needsSpatialUpdate) {
            const gridX = Math.floor(transform.position.x / this.spatialGrid.cellSize);
            const gridZ = Math.floor(transform.position.z / this.spatialGrid.cellSize);
            
            transform.spatialIndex = this.spatialGrid.add(gridX, gridZ, transform);
        }
        
        this.needsSpatialUpdate.clear();
    }
    
    updateBounds(entities) {
        for (const entity of entities) {
            const transform = entity.getComponent('TransformComponent');
            const renderable = entity.getComponent('RenderableComponent');
            
            if (renderable && renderable.mesh && renderable.mesh.geometry) {
                // Update bounding box based on geometry and transform
                this.calculateBounds(transform, renderable);
            }
        }
    }
    
    calculateBounds(transform, renderable) {
        const geometry = renderable.mesh.geometry;
        
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        
        // Transform bounding box by world matrix
        const min = this.transformPoint(geometry.boundingBox.min, transform.worldMatrix);
        const max = this.transformPoint(geometry.boundingBox.max, transform.worldMatrix);
        
        transform.bounds = {
            min: { x: Math.min(min.x, max.x), y: Math.min(min.y, max.y), z: Math.min(min.z, max.z) },
            max: { x: Math.max(min.x, max.x), y: Math.max(min.y, max.y), z: Math.max(min.z, max.z) }
        };
    }
    
    // Spatial queries
    queryRadius(position, radius) {
        return this.spatialGrid.queryRadius(position.x, position.z, radius);
    }
    
    queryRect(min, max) {
        return this.spatialGrid.queryRect(min.x, min.z, max.x, max.z);
    }
    
    // Matrix operations (simplified 4x4 matrix operations)
    createMatrix() {
        return new Float32Array(16);
    }
    
    setIdentityMatrix(matrix) {
        matrix.fill(0);
        matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
    }
    
    copyMatrix(source, dest) {
        for (let i = 0; i < 16; i++) {
            dest[i] = source[i];
        }
    }
    
    applyTranslation(matrix, position) {
        matrix[12] += position.x;
        matrix[13] += position.y;
        matrix[14] += position.z;
    }
    
    applyScale(matrix, scale) {
        matrix[0] *= scale.x;
        matrix[5] *= scale.y;
        matrix[10] *= scale.z;
    }
    
    applyRotation(matrix, rotation) {
        // Simplified rotation - for full implementation, use quaternions
        const { x, y, z } = rotation;
        
        // Apply Y rotation (yaw)
        if (y !== 0) {
            const cos = Math.cos(y);
            const sin = Math.sin(y);
            const temp = this.createMatrix();
            this.setIdentityMatrix(temp);
            temp[0] = cos; temp[2] = sin;
            temp[8] = -sin; temp[10] = cos;
            this.multiplyMatrices(matrix, temp, matrix);
        }
        
        // Apply X rotation (pitch)
        if (x !== 0) {
            const cos = Math.cos(x);
            const sin = Math.sin(x);
            const temp = this.createMatrix();
            this.setIdentityMatrix(temp);
            temp[5] = cos; temp[6] = -sin;
            temp[9] = sin; temp[10] = cos;
            this.multiplyMatrices(matrix, temp, matrix);
        }
        
        // Apply Z rotation (roll)
        if (z !== 0) {
            const cos = Math.cos(z);
            const sin = Math.sin(z);
            const temp = this.createMatrix();
            this.setIdentityMatrix(temp);
            temp[0] = cos; temp[1] = -sin;
            temp[4] = sin; temp[5] = cos;
            this.multiplyMatrices(matrix, temp, matrix);
        }
    }
    
    multiplyMatrices(a, b, result) {
        // 4x4 matrix multiplication
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += a[i * 4 + k] * b[k * 4 + j];
                }
                result[i * 4 + j] = sum;
            }
        }
    }
    
    transformPoint(point, matrix) {
        return {
            x: point.x * matrix[0] + point.y * matrix[4] + point.z * matrix[8] + matrix[12],
            y: point.x * matrix[1] + point.y * matrix[5] + point.z * matrix[9] + matrix[13],
            z: point.x * matrix[2] + point.y * matrix[6] + point.z * matrix[10] + matrix[14]
        };
    }
}

/**
 * Spatial Grid for efficient spatial queries
 */
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.grid = new Map();
        this.nextId = 1;
    }
    
    getKey(x, z) {
        return `${x},${z}`;
    }
    
    add(gridX, gridZ, transform) {
        const key = this.getKey(gridX, gridZ);
        const id = this.nextId++;
        
        if (!this.grid.has(key)) {
            this.grid.set(key, new Map());
        }
        
        this.grid.get(key).set(id, transform);
        
        return { x: gridX, z: gridZ, id, key };
    }
    
    remove(spatialIndex) {
        if (!spatialIndex) return;
        
        const cell = this.grid.get(spatialIndex.key);
        if (cell) {
            cell.delete(spatialIndex.id);
            if (cell.size === 0) {
                this.grid.delete(spatialIndex.key);
            }
        }
    }
    
    queryRadius(x, z, radius) {
        const results = [];
        const cellRadius = Math.ceil(radius / this.cellSize);
        const centerX = Math.floor(x / this.cellSize);
        const centerZ = Math.floor(z / this.cellSize);
        
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dz = -cellRadius; dz <= cellRadius; dz++) {
                const key = this.getKey(centerX + dx, centerZ + dz);
                const cell = this.grid.get(key);
                
                if (cell) {
                    for (const transform of cell.values()) {
                        const distance = Math.sqrt(
                            (transform.position.x - x) ** 2 + 
                            (transform.position.z - z) ** 2
                        );
                        
                        if (distance <= radius) {
                            results.push(transform);
                        }
                    }
                }
            }
        }
        
        return results;
    }
    
    queryRect(minX, minZ, maxX, maxZ) {
        const results = [];
        const minCellX = Math.floor(minX / this.cellSize);
        const minCellZ = Math.floor(minZ / this.cellSize);
        const maxCellX = Math.floor(maxX / this.cellSize);
        const maxCellZ = Math.floor(maxZ / this.cellSize);
        
        for (let x = minCellX; x <= maxCellX; x++) {
            for (let z = minCellZ; z <= maxCellZ; z++) {
                const key = this.getKey(x, z);
                const cell = this.grid.get(key);
                
                if (cell) {
                    for (const transform of cell.values()) {
                        if (transform.position.x >= minX && transform.position.x <= maxX &&
                            transform.position.z >= minZ && transform.position.z <= maxZ) {
                            results.push(transform);
                        }
                    }
                }
            }
        }
        
        return results;
    }
}