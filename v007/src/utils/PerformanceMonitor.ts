/**
 * Performance monitoring utility for tracking voxel engine performance
 */
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    
    private metrics: Map<string, {
        count: number;
        totalTime: number;
        minTime: number;
        maxTime: number;
        lastTime: number;
    }> = new Map();
    
    private activeTimers: Map<string, number> = new Map();
    
    private constructor() {}
    
    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }
    
    /**
     * Start timing an operation
     */
    startTimer(name: string): void {
        this.activeTimers.set(name, performance.now());
    }
    
    /**
     * End timing an operation
     */
    endTimer(name: string): number {
        const startTime = this.activeTimers.get(name);
        if (startTime === undefined) {
            console.warn(`Timer '${name}' was not started`);
            return 0;
        }
        
        const elapsed = performance.now() - startTime;
        this.activeTimers.delete(name);
        
        // Update metrics
        let metric = this.metrics.get(name);
        if (!metric) {
            metric = {
                count: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                lastTime: 0
            };
            this.metrics.set(name, metric);
        }
        
        metric.count++;
        metric.totalTime += elapsed;
        metric.minTime = Math.min(metric.minTime, elapsed);
        metric.maxTime = Math.max(metric.maxTime, elapsed);
        metric.lastTime = elapsed;
        
        return elapsed;
    }
    
    /**
     * Measure a function execution time
     */
    measure<T>(name: string, fn: () => T): T {
        this.startTimer(name);
        try {
            return fn();
        } finally {
            this.endTimer(name);
        }
    }
    
    /**
     * Get metrics for a specific operation
     */
    getMetrics(name: string): {
        count: number;
        avgTime: number;
        minTime: number;
        maxTime: number;
        lastTime: number;
        totalTime: number;
    } | null {
        const metric = this.metrics.get(name);
        if (!metric) return null;
        
        return {
            count: metric.count,
            avgTime: metric.totalTime / metric.count,
            minTime: metric.minTime,
            maxTime: metric.maxTime,
            lastTime: metric.lastTime,
            totalTime: metric.totalTime
        };
    }
    
    /**
     * Get all metrics
     */
    getAllMetrics(): Map<string, ReturnType<typeof this.getMetrics>> {
        const result = new Map<string, any>();
        for (const [name, _] of this.metrics) {
            result.set(name, this.getMetrics(name));
        }
        return result;
    }
    
    /**
     * Log performance summary
     */
    logSummary(): void {
        console.group('Performance Summary');
        
        for (const [name, metric] of this.metrics) {
            const avg = metric.totalTime / metric.count;
            console.log(
                `${name}: avg=${avg.toFixed(2)}ms, min=${metric.minTime.toFixed(2)}ms, ` +
                `max=${metric.maxTime.toFixed(2)}ms, count=${metric.count}, ` +
                `total=${metric.totalTime.toFixed(2)}ms`
            );
        }
        
        console.groupEnd();
    }
    
    /**
     * Reset all metrics
     */
    reset(): void {
        this.metrics.clear();
        this.activeTimers.clear();
    }
    
    /**
     * Reset specific metric
     */
    resetMetric(name: string): void {
        this.metrics.delete(name);
        this.activeTimers.delete(name);
    }
}