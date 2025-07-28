export class PerformanceMonitor {
    private fps: number = 0;
    private frameTime: number = 0;
    private lastTime: number;
    private frames: number = 0;
    private lastFpsUpdate: number = 0;
    private fpsHistory: number[];
    private frameTimeHistory: number[];
    private historyIndex: number = 0;
    private statsElement: HTMLElement | null;
    private visible: boolean = true;
    
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
        
        // Stats element
        this.statsElement = document.getElementById('stats');
        this.visible = true;
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
    
    toggle() {
        this.visible = !this.visible;
        if (this.statsElement) {
            this.statsElement.style.display = this.visible ? 'block' : 'none';
        }
    }
    
    show() {
        this.visible = true;
        if (this.statsElement) {
            this.statsElement.style.display = 'block';
        }
    }
    
    hide() {
        this.visible = false;
        if (this.statsElement) {
            this.statsElement.style.display = 'none';
        }
    }
}