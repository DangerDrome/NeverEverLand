/**
 * Simple object pool for reusing frequently created objects
 * Reduces garbage collection pressure
 */
export class ObjectPool<T> {
    private pool: T[] = [];
    private createFn: () => T;
    private resetFn: (obj: T) => void;
    private maxSize: number;
    
    constructor(
        createFn: () => T,
        resetFn: (obj: T) => void = () => {},
        maxSize: number = 100
    ) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;
    }
    
    /**
     * Get an object from the pool or create a new one
     */
    acquire(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.createFn();
    }
    
    /**
     * Return an object to the pool
     */
    release(obj: T): void {
        if (this.pool.length < this.maxSize) {
            this.resetFn(obj);
            this.pool.push(obj);
        }
    }
    
    /**
     * Clear the pool
     */
    clear(): void {
        this.pool = [];
    }
    
    /**
     * Get current pool size
     */
    size(): number {
        return this.pool.length;
    }
}

/**
 * Singleton pools for common THREE.js objects
 */
export class GlobalPools {
    private static instance: GlobalPools;
    
    public readonly vector3Pool: ObjectPool<{ x: number; y: number; z: number }>;
    public readonly colorPool: ObjectPool<{ r: number; g: number; b: number }>;
    
    private constructor() {
        // Vector3-like pool
        this.vector3Pool = new ObjectPool(
            () => ({ x: 0, y: 0, z: 0 }),
            (v) => { v.x = 0; v.y = 0; v.z = 0; },
            500
        );
        
        // Color-like pool
        this.colorPool = new ObjectPool(
            () => ({ r: 0, g: 0, b: 0 }),
            (c) => { c.r = 0; c.g = 0; c.b = 0; },
            200
        );
    }
    
    public static getInstance(): GlobalPools {
        if (!GlobalPools.instance) {
            GlobalPools.instance = new GlobalPools();
        }
        return GlobalPools.instance;
    }
}