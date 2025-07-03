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
        ctx.save();
        ctx.translate(this.size / 2, this.size / 2);
        const scale = this.size / (this.grid.width * this.grid.tileWidth * 1.2);
        // Draw tiles
        for (let x = 0; x < this.grid.width; x++) {
            for (let y = 0; y < this.grid.height; y++) {
                const tile = this.grid.tiles[x] && this.grid.tiles[x][y];
                if (!tile) continue;
                const wx = (x - (this.grid.width - 1) / 2) * this.grid.tileWidth;
                const wz = (y - (this.grid.height - 1) / 2) * this.grid.tileWidth;
                ctx.fillStyle = '#6fcf97';
                ctx.fillRect(wx * scale - 2, wz * scale - 2, 4, 4);
            }
        }
        // Draw camera direction as an arrow
        const cam = this.cameraController.camera;
        const camPos = new THREE.Vector3();
        cam.getWorldPosition(camPos);
        const camDir = new THREE.Vector3();
        cam.getWorldDirection(camDir);
        // Arrow parameters
        const arrowLen = this.grid.width * this.grid.tileWidth * 0.18;
        const arrowHeadLen = this.grid.width * this.grid.tileWidth * 0.12;
        // Arrow shaft
        const tip = camPos.clone().add(camDir.clone().setY(0).normalize().multiplyScalar(arrowLen));
        ctx.beginPath();
        ctx.moveTo(camPos.x * scale, camPos.z * scale);
        ctx.lineTo(tip.x * scale, tip.z * scale);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Arrow head: symmetric about the forward direction
        function rotateVec2(vec, angle) {
            const cos = Math.cos(angle), sin = Math.sin(angle);
            return new THREE.Vector2(
                vec.x * cos - vec.y * sin,
                vec.x * sin + vec.y * cos
            );
        }
        const forward2 = new THREE.Vector2(camDir.x, camDir.z).normalize();
        const leftHead2 = rotateVec2(forward2, Math.PI - Math.PI / 4.5).multiplyScalar(arrowHeadLen);
        const rightHead2 = rotateVec2(forward2, Math.PI + Math.PI / 4.5).multiplyScalar(arrowHeadLen);
        ctx.beginPath();
        ctx.moveTo(tip.x * scale, tip.z * scale);
        ctx.lineTo((tip.x + leftHead2.x) * scale, (tip.z + leftHead2.y) * scale);
        ctx.lineTo((tip.x + rightHead2.x) * scale, (tip.z + rightHead2.y) * scale);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        // Draw player
        if (window.player) {
            const wx = (window.player.x - (this.grid.width - 1) / 2) * this.grid.tileWidth;
            const wz = (window.player.y - (this.grid.height - 1) / 2) * this.grid.tileWidth;
            ctx.beginPath();
            ctx.arc(wx * scale, wz * scale, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffe100';
            ctx.globalAlpha = 0.9;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }
}
window.Minimap = Minimap; 