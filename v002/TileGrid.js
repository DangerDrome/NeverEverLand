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
        this._createInstancedGrid();
    }

    _createInstancedGrid() {
        // Only one box geometry and material
        const geometry = new THREE.BoxGeometry(this.tileWidth, this.tileWidth / 3, this.tileWidth);
        geometry.translate(0, -this.tileWidth / 6, 0);
        const material = new THREE.MeshLambertMaterial({ color: 0x4a7c3c });
        const maxInstances = this.width * this.height;
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(this.instancedMesh);
        this.tiles = [];
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
        gridLines.renderOrder = 0;
        this.group.add(gridLines);
        this.gridLines = gridLines;
    }

    /**
     * Get the Three.js group for adding to the scene
     */
    getGroup() {
        return this.group;
    }

    clearTiles() {
        this.instancedMesh.count = 0;
        this.tiles = [];
    }

    buildFromLayout(layout) {
        // Update instanced mesh from WFC layout
        let instanceId = 0;
        const offsetX = (this.width - 1) / 2;
        const offsetZ = (this.height - 1) / 2;
        const dummy = new THREE.Object3D();
        this.tiles = [];
        // Prepare for edge lines
        if (this.edgeLines) {
            this.group.remove(this.edgeLines);
            this.edgeLines.geometry.dispose();
        }
        const boxEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(this.tileWidth, this.tileWidth / 3, this.tileWidth));
        boxEdgeGeo.translate(0, -this.tileWidth / 6, 0);
        let edgePositions = [];
        const maxY = 0;
        const maxX = this.tileWidth / 2;
        const maxZ = this.tileWidth / 2;
        const EPS = 1e-4;
        for (let x = 0; x < this.width; x++) {
            this.tiles[x] = [];
            for (let y = 0; y < this.height; y++) {
                if (layout[x][y]) {
                    dummy.position.set(
                        (x - offsetX) * this.tileWidth,
                        0,
                        (y - offsetZ) * this.tileWidth
                    );
                    dummy.updateMatrix();
                    this.instancedMesh.setMatrixAt(instanceId, dummy.matrix);
                    this.tiles[x][y] = { instanceId, x, y };
                    instanceId++;
                    // Transform and collect edge positions (only top, +X, +Z faces)
                    const posAttr = boxEdgeGeo.attributes.position;
                    for (let i = 0; i < posAttr.count; i += 2) {
                        let a = new THREE.Vector3().fromBufferAttribute(posAttr, i).applyMatrix4(dummy.matrix);
                        let b = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1).applyMatrix4(dummy.matrix);
                        if ((Math.abs(a.y - maxY) < EPS && Math.abs(b.y - maxY) < EPS) ||
                            (Math.abs(a.x - maxX) < EPS && Math.abs(b.x - maxX) < EPS) ||
                            (Math.abs(a.z - maxZ) < EPS && Math.abs(b.z - maxZ) < EPS)) {
                            edgePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
                        }
                    }
                } else {
                    this.tiles[x][y] = null;
                }
            }
        }
        this.instancedMesh.count = instanceId;
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        // Build merged edge geometry
        const edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
        this.edgeLines = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 1 }));
        this.edgeLines.renderOrder = 1;
        this.group.add(this.edgeLines);
    }
}
window.TileGrid = TileGrid; 