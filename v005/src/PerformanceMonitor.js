
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 60,
      frameTime: 0,
      uiUpdateTime: 0,
      drawCalls: 0
    };
    
    this.lastFrame = performance.now();
  }

  startFrame() {
    this.frameStart = performance.now();
  }

  measureUIUpdate(callback) {
    const start = performance.now();
    callback();
    this.metrics.uiUpdateTime = performance.now() - start;
  }

  endFrame() {
    const now = performance.now();
    this.metrics.frameTime = now - this.frameStart;
    this.metrics.fps = 1000 / (now - this.lastFrame);
    this.lastFrame = now;
    
    // Warn if frame budget exceeded
    if (this.metrics.frameTime > 16.67) {
      console.warn(`Frame budget exceeded: ${this.metrics.frameTime.toFixed(2)}ms`);
    }
  }
}
