// main.js - v002 (classic script version, no postprocessing)
// Assumes all engine classes are loaded globally

const container = document.getElementById('gameContainer');
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB, 1);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const aspect = window.innerWidth / window.innerHeight;
const cameraController = new window.IsometricCamera(aspect, 16);
const camera = cameraController.getCamera();

const grid = new window.TileGrid(10, 10, 2, 1);
scene.add(grid.getGroup());

const controls = new window.CameraControls(cameraController, renderer.domElement);

// Lighting
const ambient = new THREE.AmbientLight(0x404040, 0.7);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(10, 20, 10);
sun.castShadow = true;
scene.add(sun);

// Axes overlay
const axisLength = 5;
function addThickAxis(start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, linewidth: 6 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
}
addThickAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(axisLength, 0, 0), 0x00b3a6); // X (dimmed cyan)
addThickAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, axisLength, 0), 0xb3b300); // Y (dimmed yellow)
addThickAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, axisLength), 0xb300a6); // Z (dimmed magenta)

// Add 3D text labels for X, Y, Z axes
function createAxisLabel(text, color, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    // Draw circle background
    ctx.beginPath();
    ctx.arc(64, 32, 28, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    // Draw black text with padding
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(text, 64, 36);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(1, 0.5, 1); // Smaller label
    return sprite;
}
scene.add(createAxisLabel('X', '#00b3a6', new THREE.Vector3(axisLength + 0.5, 0, 0)));
scene.add(createAxisLabel('Y', '#b3b300', new THREE.Vector3(0, axisLength + 0.5, 0)));
scene.add(createAxisLabel('Z', '#b300a6', new THREE.Vector3(0, 0, axisLength + 0.5)));

// Raycaster for mouse picking
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

container.addEventListener('mousemove', (event) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

// Animation loop
const clock = new THREE.Clock();
let lastHoveredTile = null;
let gridOverlayVisible = true;
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG') {
        gridOverlayVisible = !gridOverlayVisible;
        if (grid.gridLines) grid.gridLines.visible = gridOverlayVisible;
    }
});
const minimap = new window.Minimap(grid, cameraController);
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    controls.update(dt);
    renderer.render(scene, camera);

    // Raycast for tile hover
    raycaster.setFromCamera(mouse, camera);
    let hoveredTile = null;
    for (let x = 0; x < grid.width; x++) {
        for (let y = 0; y < grid.height; y++) {
            const tile = grid.tiles[x][y];
            if (!tile || !tile.mesh) continue;
            const intersects = raycaster.intersectObject(tile.mesh, false);
            if (intersects.length > 0) {
                hoveredTile = tile;
                break;
            }
        }
        if (hoveredTile) break;
    }
    // Remove overlay from last hovered tile if different
    if (lastHoveredTile && lastHoveredTile !== hoveredTile) {
        lastHoveredTile.mesh.material[2].color.set(0x6fcf97);
    }
    // Add overlay to currently hovered tile
    if (hoveredTile) {
        hoveredTile.mesh.material[2].color.set(0xaee9d1);
    }
    lastHoveredTile = hoveredTile;

    // 2D viewport culling for tiles with threshold
    const cullThreshold = -0.1; // margin in NDC
    for (let x = 0; x < grid.width; x++) {
        for (let y = 0; y < grid.height; y++) {
            const tile = grid.tiles[x][y];
            if (!tile || !tile.mesh) continue;
            // Project tile center to NDC
            const worldPos = tile.mesh.position.clone();
            worldPos.project(camera);
            // Cull if outside screen rectangle with threshold
            if (worldPos.x < -1 - cullThreshold || worldPos.x > 1 + cullThreshold || worldPos.y < -1 - cullThreshold || worldPos.y > 1 + cullThreshold) {
                tile.mesh.visible = false;
            } else {
                tile.mesh.visible = true;
            }
        }
    }

    // Hide grid overlay if zoomed out too far
    if (grid.gridLines) {
        if (cameraController.viewSize > 15) {
            grid.gridLines.visible = false;
        } else {
            grid.gridLines.visible = gridOverlayVisible;
        }
    }

    minimap.draw();
}
animate();

// Handle resize
window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    cameraController.onWindowResize(w / h);
}); 