import * as THREE from 'three';

export class DirectionIndicator {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private cube: THREE.Mesh;
    private canvas: HTMLCanvasElement;
    private size: number;
    
    constructor() {
        this.size = 120;
        
        // Create a separate canvas for the indicator
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '10px';
        this.canvas.style.right = '10px';
        this.canvas.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        this.canvas.style.borderRadius = '4px';
        this.canvas.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1000';
        
        // Add to container
        document.getElementById('container')!.appendChild(this.canvas);
        
        // Create renderer for indicator
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(this.size, this.size);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Create mini scene
        this.scene = new THREE.Scene();
        
        // Create camera for indicator
        const aspect = 1;
        const size = 2;
        this.camera = new THREE.OrthographicCamera(
            -size, size,
            size, -size,
            0.1, 100
        );
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);
        
        // Create indicator cube with different colored faces
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Create materials for each face with distinct colors
        const materials = [
            new THREE.MeshBasicMaterial({ color: 0xff0000 }), // +X (right) - red
            new THREE.MeshBasicMaterial({ color: 0x800000 }), // -X (left) - dark red
            new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // +Y (top) - green
            new THREE.MeshBasicMaterial({ color: 0x008000 }), // -Y (bottom) - dark green
            new THREE.MeshBasicMaterial({ color: 0x0000ff }), // +Z (front) - blue
            new THREE.MeshBasicMaterial({ color: 0x000080 })  // -Z (back) - dark blue
        ];
        
        this.cube = new THREE.Mesh(geometry, materials);
        this.scene.add(this.cube);
        
        // Add edges for better visibility
        const edges = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
        const edgesMesh = new THREE.LineSegments(edges, edgesMaterial);
        this.cube.add(edgesMesh);
        
        // Add axis arrows
        this.addAxisArrows();
        
        // Add axis labels
        this.addAxisLabels();
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
    }
    
    private addAxisArrows(): void {
        const arrowLength = 1.5;
        
        // X axis arrow (red)
        const xDir = new THREE.Vector3(1, 0, 0);
        const xOrigin = new THREE.Vector3(0, 0, 0);
        const xArrow = new THREE.ArrowHelper(xDir, xOrigin, arrowLength, 0xff0000, 0.5, 0.5);
        this.scene.add(xArrow);
        
        // Y axis arrow (green)
        const yDir = new THREE.Vector3(0, 1, 0);
        const yArrow = new THREE.ArrowHelper(yDir, xOrigin, arrowLength, 0x00ff00, 0.5, 0.5);
        this.scene.add(yArrow);
        
        // Z axis arrow (blue)
        const zDir = new THREE.Vector3(0, 0, 1);
        const zArrow = new THREE.ArrowHelper(zDir, xOrigin, arrowLength, 0x0000ff, 0.5, 0.5);
        this.scene.add(zArrow);
    }
    
    private addAxisLabels(): void {
        // Create sprite material for labels
        const createTextSprite = (text: string, color: string) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = 64;
            canvas.height = 64;
            
            context.fillStyle = color;
            context.font = 'bold 48px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(0.5, 0.5, 1);
            
            return sprite;
        };
        
        // X label
        const xLabel = createTextSprite('X', '#ff0000');
        xLabel.position.set(2, 0, 0);
        this.scene.add(xLabel);
        
        // Y label
        const yLabel = createTextSprite('Y', '#00ff00');
        yLabel.position.set(0, 2, 0);
        this.scene.add(yLabel);
        
        // Z label
        const zLabel = createTextSprite('Z', '#0000ff');
        zLabel.position.set(0, 0, 2);
        this.scene.add(zLabel);
    }
    
    update(mainCamera: THREE.Camera): void {
        // Sync camera rotation with main camera
        this.camera.position.copy(mainCamera.position);
        this.camera.position.normalize().multiplyScalar(5);
        this.camera.lookAt(0, 0, 0);
        
        // Update camera matrices
        this.camera.updateMatrixWorld();
        this.camera.updateProjectionMatrix();
    }
    
    render(): void {
        // Simply render to our own canvas
        this.renderer.render(this.scene, this.camera);
    }
    
    dispose(): void {
        // Clean up
        this.renderer.dispose();
        this.canvas.remove();
    }
}