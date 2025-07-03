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

const grid = new window.TileGrid(100, 100, 2, 1);
scene.add(grid.getGroup());

const player = new window.Player(grid, Math.floor(grid.width / 2), Math.floor(grid.height / 2));
scene.add(player.mesh);
player.mesh.renderOrder = 2;

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
    line.renderOrder = 100;
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
    sprite.renderOrder = 100;
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
let lastHoveredInstanceId = null;
let lastHoveredColor = new THREE.Color(0x6fcf97);
let gridOverlayVisible = true;
const wfc = new window.WaveFunctionCollapse(grid.width, grid.height);
function applyWFCLayer() {
    const layout = wfc.generate();
    grid.buildFromLayout(layout);
    // Ensure player is above tiles
    scene.remove(player.mesh);
    scene.add(player.mesh);
    // If player's tile is missing, move to first available tile
    if (!layout[player.x] || !layout[player.x][player.y]) {
        outer: for (let x = 0; x < grid.width; x++) {
            for (let y = 0; y < grid.height; y++) {
                if (layout[x][y]) { player.setPosition(x, y); break outer; }
            }
        }
    }
}
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG') {
        gridOverlayVisible = !gridOverlayVisible;
        if (grid.gridLines) grid.gridLines.visible = gridOverlayVisible;
    }
    // Player movement
    if (e.code === 'ArrowUp' || e.code === 'KeyW') player.move(0, -1);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') player.move(0, 1);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') player.move(-1, 0);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') player.move(1, 0);
    // WFC regenerate
    if (e.code === 'KeyR') applyWFCLayer();
});
const minimap = new window.Minimap(grid, cameraController);
let lastFpsUpdate = 0;
let frames = 0;
let fps = 0;
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    controls.update(dt);
    renderer.render(scene, camera);

    // Instanced mesh hover highlight
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(grid.instancedMesh, false);
    if (lastHoveredInstanceId !== null) {
        grid.instancedMesh.setColorAt(lastHoveredInstanceId, lastHoveredColor);
        grid.instancedMesh.instanceColor.needsUpdate = true;
        lastHoveredInstanceId = null;
    }
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
        const instanceId = intersects[0].instanceId;
        // Save previous color
        if (!grid.instancedMesh.instanceColor) {
            const color = new THREE.Color(0x6fcf97);
            const colors = [];
            for (let i = 0; i < grid.instancedMesh.count; i++) {
                colors.push(color.r, color.g, color.b);
            }
            grid.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
        }
        grid.instancedMesh.getColorAt(instanceId, lastHoveredColor);
        grid.instancedMesh.setColorAt(instanceId, new THREE.Color(0xaee9d1));
        grid.instancedMesh.instanceColor.needsUpdate = true;
        lastHoveredInstanceId = instanceId;
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

    // FPS counter
    frames++;
    const now = performance.now();
    if (now - lastFpsUpdate > 500) {
        fps = Math.round((frames * 1000) / (now - lastFpsUpdate));
        lastFpsUpdate = now;
        frames = 0;
        const fpsDiv = document.getElementById('fpsCounter');
        if (fpsDiv) fpsDiv.textContent = `FPS: ${fps}`;
    }
}
animate();

// Handle resize
window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    cameraController.onWindowResize(w / h);
});

// Run WFC once at start
applyWFCLayer();

window.player = player; 