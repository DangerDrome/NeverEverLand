// Player.js - v002
// Simple player character as a colored cube

class Player {
    constructor(grid, x = 0, y = 0, color = 0xffe100) {
        this.grid = grid;
        this.x = x;
        this.y = y;
        this.color = color;
        const size = grid.tileWidth * 0.6;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.4, metalness: 0.2 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = false;
        this.setPosition(x, y);
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
        const offsetX = (this.grid.width - 1) / 2;
        const offsetZ = (this.grid.height - 1) / 2;
        this.mesh.position.set(
            (x - offsetX) * this.grid.tileWidth,
            this.grid.tileWidth * 0.3, // slightly above tile
            (y - offsetZ) * this.grid.tileWidth
        );
    }

    canMove(dx, dy) {
        const newX = this.x + dx;
        const newY = this.y + dy;
        if (newX < 0 || newX >= this.grid.width || newY < 0 || newY >= this.grid.height) return false;
        return this.grid.tiles[newX][newY] !== null && this.grid.tiles[newX][newY] !== undefined;
    }

    move(dx, dy) {
        if (!this.canMove(dx, dy)) return;
        const newX = this.x + dx;
        const newY = this.y + dy;
        this.setPosition(newX, newY);
    }
}
window.Player = Player; 