import * as THREE from 'three';

export class DirectionIndicator {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private cube: THREE.Mesh;
    private canvas: HTMLCanvasElement;
    private size: number;
    
    constructor() {
        this.size = 150;  // Larger size for padding
        
        // Create a separate canvas for the indicator
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '10px';
        this.canvas.style.right = '10px';
        this.canvas.style.border = '1px solid rgba(0, 0, 0, 0.3)';
        this.canvas.style.borderRadius = '8px';
        this.canvas.style.backgroundColor = 'rgba(50, 50, 50, 0.8)';
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
        
        // Create camera for indicator with more padding
        const aspect = 1;
        const size = 2.5;  // Increased from 2 to 2.5 for more padding
        this.camera = new THREE.OrthographicCamera(
            -size, size,
            size, -size,
            0.1, 100
        );
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);
        
        // Create indicator cube with pastel colored faces
        const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        
        // Create materials for each face with pastel colors
        const materials = [
            new THREE.MeshPhongMaterial({ color: 0xffb3ba, emissive: 0x552222, shininess: 100 }), // +X (right) - pastel red
            new THREE.MeshPhongMaterial({ color: 0x8b5a5a, emissive: 0x2a1515, shininess: 100 }), // -X (left) - dark pastel red
            new THREE.MeshPhongMaterial({ color: 0xbaffc9, emissive: 0x225522, shininess: 100 }), // +Y (top) - pastel green
            new THREE.MeshPhongMaterial({ color: 0x5a8b5a, emissive: 0x152a15, shininess: 100 }), // -Y (bottom) - dark pastel green
            new THREE.MeshPhongMaterial({ color: 0xbae1ff, emissive: 0x222255, shininess: 100 }), // +Z (front) - pastel blue
            new THREE.MeshPhongMaterial({ color: 0x5a5a8b, emissive: 0x15152a, shininess: 100 })  // -Z (back) - dark pastel blue
        ];
        
        this.cube = new THREE.Mesh(geometry, materials);
        this.scene.add(this.cube);
        
        // Add thicker edges with darker color for Blender-style look
        const edges = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 3 });
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
        // Create lines connecting cube to label circles
        const lineMaterial = new THREE.LineBasicMaterial({ opacity: 0.6, transparent: true });
        
        // X axis line (pastel red)
        const xLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0.4, 0, 0),  // Start from cube edge
            new THREE.Vector3(1.7, 0, 0)   // End near circle (adjusted for new position)
        ]);
        const xLine = new THREE.Line(xLineGeometry, new THREE.LineBasicMaterial({ color: 0xff9999, opacity: 0.6, transparent: true }));
        this.scene.add(xLine);
        
        // Y axis line (pastel green)
        const yLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.4, 0),  // Start from cube edge
            new THREE.Vector3(0, 1.7, 0)   // End near circle (adjusted for new position)
        ]);
        const yLine = new THREE.Line(yLineGeometry, new THREE.LineBasicMaterial({ color: 0x99ff99, opacity: 0.6, transparent: true }));
        this.scene.add(yLine);
        
        // Z axis line (pastel blue)
        const zLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0.4),  // Start from cube edge
            new THREE.Vector3(0, 0, 1.7)   // End near circle (adjusted for new position)
        ]);
        const zLine = new THREE.Line(zLineGeometry, new THREE.LineBasicMaterial({ color: 0x99ccff, opacity: 0.6, transparent: true }));
        this.scene.add(zLine);
    }
    
    private addAxisLabels(): void {
        // Create sprite material for labels with circle backgrounds
        const createTextSprite = (text: string, color: string, bgColor: string) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = 128;  // Larger canvas for better quality
            canvas.height = 128;
            
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = 56;  // Larger radius
            
            // Draw circle background
            context.beginPath();
            context.arc(centerX, centerY, radius, 0, Math.PI * 2);
            context.fillStyle = bgColor;
            context.fill();
            
            // Draw darker border
            context.beginPath();
            context.arc(centerX, centerY, radius, 0, Math.PI * 2);
            context.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            context.lineWidth = 3;
            context.stroke();
            
            // Draw text with stroke for extra boldness
            context.font = '900 72px Arial Black, Arial';  // Use Arial Black for extra bold
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Draw text stroke first (makes it appear bolder)
            context.strokeStyle = '#222222';
            context.lineWidth = 4;
            context.strokeText(text, centerX, centerY + 2);
            
            // Draw text fill
            context.fillStyle = '#222222';
            context.fillText(text, centerX, centerY + 2); // Slight offset to center visually
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(0.7, 0.7, 1); // Larger circles
            
            return sprite;
        };
        
        // X label with pastel red circle
        const xLabel = createTextSprite('X', '#ffffff', '#ff9999');
        xLabel.position.set(2.1, 0, 0);  // Adjusted for larger circles
        this.scene.add(xLabel);
        
        // Y label with pastel green circle
        const yLabel = createTextSprite('Y', '#ffffff', '#99ff99');
        yLabel.position.set(0, 2.1, 0);  // Adjusted for larger circles
        this.scene.add(yLabel);
        
        // Z label with pastel blue circle
        const zLabel = createTextSprite('Z', '#ffffff', '#99ccff');
        zLabel.position.set(0, 0, 2.1);  // Adjusted for larger circles
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