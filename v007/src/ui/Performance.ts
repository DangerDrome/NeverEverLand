export class PerformanceMonitor {
    private fps: number = 0;
    private frameTime: number = 0;
    private lastTime: number;
    private frames: number = 0;
    private lastFpsUpdate: number = 0;
    private fpsHistory: number[];
    private frameTimeHistory: number[];
    private historyIndex: number = 0;
    private fpsElement: HTMLElement | null;
    private voxelsElement: HTMLElement | null;
    private memoryElement: HTMLElement | null;
    
    constructor() {
        this.fps = 0;
        this.frameTime = 0;
        this.lastTime = performance.now();
        this.frames = 0;
        this.lastFpsUpdate = 0;
        
        // Performance history
        this.fpsHistory = new Array(60).fill(0);
        this.frameTimeHistory = new Array(60).fill(0);
        this.historyIndex = 0;
        
        // Info bar elements
        this.fpsElement = document.getElementById('stats-fps');
        this.voxelsElement = document.getElementById('stats-voxels');
        this.memoryElement = document.getElementById('stats-memory');
    }
    
    update() {
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        
        this.frames++;
        this.frameTime = delta;
        
        // Update FPS every second
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastFpsUpdate = now;
            
            // Update history
            this.fpsHistory[this.historyIndex] = this.fps;
            this.frameTimeHistory[this.historyIndex] = this.frameTime;
            this.historyIndex = (this.historyIndex + 1) % 60;
        }
    }
    
    getFPS() {
        return this.fps;
    }
    
    getFrameTime() {
        return this.frameTime;
    }
    
    getAverageFPS() {
        const sum = this.fpsHistory.reduce((a: number, b: number) => a + b, 0);
        return sum / this.fpsHistory.length;
    }
    
    getAverageFrameTime() {
        const sum = this.frameTimeHistory.reduce((a: number, b: number) => a + b, 0);
        return sum / this.frameTimeHistory.length;
    }
    
    render(voxelCount: number = 0, instanceCount: number = 0) {
        // Calculate memory usage estimate (rough approximation)
        const memoryMB = ((voxelCount * 16) / (1024 * 1024)).toFixed(1);
        
        // Update info bar elements
        if (this.fpsElement) {
            this.fpsElement.textContent = `FPS: ${this.fps} / ${Math.round(this.getAverageFPS())}`;
        }
        
        if (this.voxelsElement) {
            this.voxelsElement.textContent = `Voxels: ${voxelCount.toLocaleString()}`;
        }
        
        if (this.memoryElement) {
            this.memoryElement.textContent = `Memory: ~${memoryMB}MB`;
        }
    }
}