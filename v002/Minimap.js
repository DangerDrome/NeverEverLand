// Minimap.js - v002
// Renders a 2D top-down minimap of the tile grid and camera view

class Minimap {
    constructor(grid, cameraController) {
        this.grid = grid;
        this.cameraController = cameraController;
        this.size = 180;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = '10px';
        this.canvas.style.bottom = '10px';
        this.canvas.style.background = 'rgba(24,24,24,0.85)';
        this.canvas.style.border = '2px solid #222';
        this.canvas.style.zIndex = 100;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.size, this.size);
        // Draw grid
        ctx.save();
        ctx.translate(this.size / 2, this.size / 2);
        const scale = this.size / (this.grid.width * this.grid.tileWidth * 1.2);
        // Draw tiles
        for (let x = 0; x < this.grid.width; x++) {
            for (let y = 0; y < this.grid.height; y++) {
                const tile = this.grid.tiles[x][y];
                if (!tile) continue;
                const wx = (x - (this.grid.width - 1) / 2) * this.grid.tileWidth;
                const wz = (y - (this.grid.height - 1) / 2) * this.grid.tileWidth;
                ctx.fillStyle = '#6fcf97';
                ctx.fillRect(wx * scale - 2, wz * scale - 2, 4, 4);
            }
        }
        // Draw camera view rectangle
        const cam = this.cameraController.camera;
        const corners = [
            new THREE.Vector3(cam.left, 0, cam.top),
            new THREE.Vector3(cam.right, 0, cam.top),
            new THREE.Vector3(cam.right, 0, cam.bottom),
            new THREE.Vector3(cam.left, 0, cam.bottom)
        ];
        // Transform corners to world space
        for (let v of corners) v.applyMatrix4(cam.matrixWorld);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const wx = corners[i].x * scale;
            const wz = corners[i].z * scale;
            if (i === 0) ctx.moveTo(wx, wz);
            else ctx.lineTo(wx, wz);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}
window.Minimap = Minimap; 