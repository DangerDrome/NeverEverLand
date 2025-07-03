// WaveFunctionCollapse.js - v002
// Simple WFC for generating a new layout of 3D squares

class WaveFunctionCollapse {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layout = [];
    }

    generate() {
        // Simple random on/off for each tile (1 = present, 0 = absent)
        this.layout = [];
        for (let x = 0; x < this.width; x++) {
            this.layout[x] = [];
            for (let y = 0; y < this.height; y++) {
                this.layout[x][y] = Math.random() > 0.5 ? 1 : 0;
            }
        }
        return this.layout;
    }
}
window.WaveFunctionCollapse = WaveFunctionCollapse; 