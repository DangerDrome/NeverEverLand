import { VoxelEngine, VoxelType } from '../engine/VoxelEngine';
import { PerformanceMonitor } from './PerformanceMonitor';

/**
 * Performance testing utilities for the voxel engine
 */
export class PerformanceTest {
    private voxelEngine: VoxelEngine;
    private monitor: PerformanceMonitor;
    
    constructor(voxelEngine: VoxelEngine) {
        this.voxelEngine = voxelEngine;
        this.monitor = PerformanceMonitor.getInstance();
    }
    
    /**
     * Test performance with a specific number of voxels
     */
    testVoxelCount(count: number): void {
        console.group(`Performance Test: ${count} voxels`);
        
        // Clear existing voxels
        this.voxelEngine.clear();
        
        // Generate random voxel positions in a cube
        const sideLength = Math.ceil(Math.cbrt(count));
        const voxelTypes = [
            VoxelType.GRASS,
            VoxelType.DIRT,
            VoxelType.STONE,
            VoxelType.WOOD,
            VoxelType.WATER
        ];
        
        console.log(`Creating ${count} voxels in a ${sideLength}x${sideLength}x${sideLength} cube...`);
        
        // Test batch creation
        this.monitor.startTimer('batchCreation');
        this.voxelEngine.startBatch();
        
        let created = 0;
        for (let x = 0; x < sideLength && created < count; x++) {
            for (let y = 0; y < sideLength && created < count; y++) {
                for (let z = 0; z < sideLength && created < count; z++) {
                    const type = voxelTypes[Math.floor(Math.random() * voxelTypes.length)];
                    this.voxelEngine.setVoxel(x, y, z, type, false);
                    created++;
                }
            }
        }
        
        this.voxelEngine.endBatch();
        const batchTime = this.monitor.endTimer('batchCreation');
        
        console.log(`✓ Batch creation: ${batchTime.toFixed(2)}ms (${(batchTime / count * 1000).toFixed(2)}μs per voxel)`);
        
        // Test single voxel update
        this.monitor.startTimer('singleUpdate');
        this.voxelEngine.setVoxel(0, 0, 0, VoxelType.LEAVES, false);
        this.voxelEngine.updateInstances();
        const singleTime = this.monitor.endTimer('singleUpdate');
        
        console.log(`✓ Single voxel update: ${singleTime.toFixed(2)}ms`);
        
        // Test brush operation (3x3x3)
        this.monitor.startTimer('brushOperation');
        this.voxelEngine.startBatch();
        for (let x = 10; x < 13; x++) {
            for (let y = 10; y < 13; y++) {
                for (let z = 10; z < 13; z++) {
                    this.voxelEngine.setVoxel(x, y, z, VoxelType.SAND, false);
                }
            }
        }
        this.voxelEngine.endBatch();
        const brushTime = this.monitor.endTimer('brushOperation');
        
        console.log(`✓ 3x3x3 brush operation: ${brushTime.toFixed(2)}ms`);
        
        // Test removal
        this.monitor.startTimer('removal');
        this.voxelEngine.startBatch();
        for (let i = 0; i < 100; i++) {
            const x = Math.floor(Math.random() * sideLength);
            const y = Math.floor(Math.random() * sideLength);
            const z = Math.floor(Math.random() * sideLength);
            this.voxelEngine.setVoxel(x, y, z, VoxelType.AIR, false);
        }
        this.voxelEngine.endBatch();
        const removalTime = this.monitor.endTimer('removal');
        
        console.log(`✓ Remove 100 voxels: ${removalTime.toFixed(2)}ms`);
        
        // Summary
        console.log('\nSummary:');
        console.log(`- Total voxels: ${this.voxelEngine.getVoxelCount()}`);
        console.log(`- Batch creation rate: ${(count / (batchTime / 1000)).toFixed(0)} voxels/second`);
        console.log(`- Update latency: ${singleTime.toFixed(2)}ms`);
        
        console.groupEnd();
    }
    
    /**
     * Run a series of performance tests
     */
    runTestSuite(): void {
        console.log('=== Voxel Engine Performance Test Suite ===\n');
        
        // Test with increasing voxel counts
        const testCounts = [1000, 5000, 10000, 25000, 50000, 100000];
        
        for (const count of testCounts) {
            this.testVoxelCount(count);
            console.log(''); // Empty line between tests
        }
        
        // Show overall metrics
        console.log('\n=== Overall Performance Metrics ===');
        this.monitor.logSummary();
        
        // Clear after tests
        this.voxelEngine.clear();
        this.monitor.reset();
    }
    
    /**
     * Test continuous drawing performance
     */
    testContinuousDrawing(duration: number = 5000): void {
        console.log(`Testing continuous drawing for ${duration}ms...`);
        
        const startTime = Date.now();
        let operations = 0;
        let totalTime = 0;
        
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= duration) {
                clearInterval(interval);
                
                console.log(`Continuous drawing test complete:`);
                console.log(`- Operations: ${operations}`);
                console.log(`- Average time: ${(totalTime / operations).toFixed(2)}ms`);
                console.log(`- Operations/sec: ${(operations / (duration / 1000)).toFixed(0)}`);
                return;
            }
            
            // Simulate brush stroke
            const start = performance.now();
            
            this.voxelEngine.startBatch();
            const x = Math.floor(Math.random() * 100);
            const y = Math.floor(Math.random() * 50);
            const z = Math.floor(Math.random() * 100);
            
            // Simulate 3x3x3 brush
            for (let dx = 0; dx < 3; dx++) {
                for (let dy = 0; dy < 3; dy++) {
                    for (let dz = 0; dz < 3; dz++) {
                        this.voxelEngine.setVoxel(
                            x + dx,
                            y + dy,
                            z + dz,
                            VoxelType.STONE,
                            false
                        );
                    }
                }
            }
            this.voxelEngine.endBatch();
            
            const opTime = performance.now() - start;
            totalTime += opTime;
            operations++;
            
            if (opTime > 16) {
                console.warn(`Slow operation: ${opTime.toFixed(2)}ms`);
            }
        }, 16); // Target 60 FPS
    }
}

// Export function to attach to window for easy testing
export function attachPerformanceTest(voxelEngine: VoxelEngine): void {
    const tester = new PerformanceTest(voxelEngine);
    
    (window as any).perfTest = {
        test: (count: number) => tester.testVoxelCount(count),
        suite: () => tester.runTestSuite(),
        continuous: (duration?: number) => tester.testContinuousDrawing(duration),
        monitor: PerformanceMonitor.getInstance()
    };
    
    console.log('Performance testing attached to window.perfTest');
    console.log('Usage:');
    console.log('  perfTest.test(10000)     - Test with 10k voxels');
    console.log('  perfTest.suite()         - Run full test suite');
    console.log('  perfTest.continuous()    - Test continuous drawing');
    console.log('  perfTest.monitor.logSummary() - Show performance metrics');
}