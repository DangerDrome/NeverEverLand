// TileGrid.js - v002
// 3D isometric grid for Three.js: place tiles on XZ plane, let camera do projection

class TileGrid {
    /**
     * @param {number} width - grid width in tiles
     * @param {number} height - grid height in tiles
     * @param {number} tileWidth - width of a tile (world units)
     */
    constructor(width = 10, height = 10, tileWidth = 2) {
        this.width = width;
        this.height = height;
        this.tileWidth = tileWidth;
        this.tiles = [];
        this.group = new THREE.Group();
        this._addRepeatingGridLines();
        this._createGrid();
    }

    // Create the grid of tiles
    _createGrid() {
        // Materials: [right, left, top, bottom, front, back]
        const sideMaterial = new THREE.MeshLambertMaterial({ color: 0x4a7c3c, side: THREE.FrontSide });
        const topMaterial = new THREE.MeshLambertMaterial({ color: 0x6fcf97, side: THREE.FrontSide });
        const geometry = new THREE.BoxGeometry(this.tileWidth, this.tileWidth / 3, this.tileWidth);
        // Ensure geometry is centered so top face is at y=0
        geometry.translate(0, -this.tileWidth / 6, 0);
        const offsetX = (this.width - 1) / 2;
        const offsetZ = (this.height - 1) / 2;
        for (let x = 0; x < this.width; x++) {
            this.tiles[x] = [];
            for (let y = 0; y < this.height; y++) {
                // Clone materials for each tile to allow independent highlighting
                const tileMaterials = [
                    sideMaterial.clone(), // right
                    sideMaterial.clone(), // left
                    topMaterial.clone(),  // top
                    sideMaterial.clone(), // bottom
                    sideMaterial.clone(), // front
                    sideMaterial.clone()  // back
                ];
                const mesh = new THREE.Mesh(geometry, tileMaterials);
                mesh.position.set(
                    (x - offsetX) * this.tileWidth,
                    0,
                    (y - offsetZ) * this.tileWidth
                );
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = false;
                this.group.add(mesh);
                this.tiles[x][y] = { mesh, x, y };
                // Add edge faces (outlines) only for top, +X, and +Z faces
                const edges = new THREE.EdgesGeometry(geometry);
                const pos = edges.attributes.position;
                const filtered = [];
                const maxY = 0; // top face
                const maxX = this.tileWidth / 2;
                const maxZ = this.tileWidth / 2;
                for (let i = 0; i < pos.count; i += 2) {
                    const a = new THREE.Vector3().fromBufferAttribute(pos, i);
                    const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
                    // Top face
                    if (a.y === maxY && b.y === maxY) {
                        filtered.push(a.x, a.y, a.z, b.x, b.y, b.z);
                        continue;
                    }
                    // +X face (right)
                    if (a.x === maxX && b.x === maxX) {
                        filtered.push(a.x, a.y, a.z, b.x, b.y, b.z);
                        continue;
                    }
                    // +Z face (front)
                    if (a.z === maxZ && b.z === maxZ) {
                        filtered.push(a.x, a.y, a.z, b.x, b.y, b.z);
                        continue;
                    }
                }
                const filteredGeometry = new THREE.BufferGeometry();
                filteredGeometry.setAttribute('position', new THREE.Float32BufferAttribute(filtered, 3));
                const edgeLines = new THREE.LineSegments(filteredGeometry, new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 1 }));
                mesh.add(edgeLines);
            }
        }
    }

    _addRepeatingGridLines() {
        // Draw grid lines at every tile edge, but extend far beyond the tile area
        const lineMaterial = new THREE.LineDashedMaterial({ color: 0x222222, opacity: 0.7, transparent: true, dashSize: 0.05, gapSize: 0.1 });
        const gridGeometry = new THREE.BufferGeometry();
        const points = [];
        // Large range for overlay
        const gridMin = -100, gridMax = 100;
        const step = this.tileWidth;
        // Vertical lines (constant x, varying z)
        for (let x = gridMin; x <= gridMax; x += step) {
            points.push(new THREE.Vector3(x, 0.0, gridMin));
            points.push(new THREE.Vector3(x, 0.0, gridMax));
        }
        // Horizontal lines (constant z, varying x)
        for (let z = gridMin; z <= gridMax; z += step) {
            points.push(new THREE.Vector3(gridMin, 0.0, z));
            points.push(new THREE.Vector3(gridMax, 0.0, z));
        }
        gridGeometry.setFromPoints(points);
        gridGeometry.computeBoundingSphere();
        const gridLines = new THREE.LineSegments(gridGeometry, lineMaterial);
        gridLines.computeLineDistances();
        this.group.add(gridLines);
        this.gridLines = gridLines;
    }

    /**
     * Get the Three.js group for adding to the scene
     */
    getGroup() {
        return this.group;
    }
}
window.TileGrid = TileGrid; 