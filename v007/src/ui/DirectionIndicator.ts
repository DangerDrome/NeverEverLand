import * as THREE from 'three';

export class DirectionIndicator {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private cube: THREE.Group;
    private canvas: HTMLCanvasElement;
    private size: number;
    
    constructor() {
        this.size = 150;  // Larger size for padding
        
        // Create a separate canvas for the indicator
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.canvas.style.position = 'fixed';
        this.canvas.style.bottom = '60px';  // Moved up from 40px to 60px
        this.canvas.style.left = '30px';    // Moved right from 10px to 30px
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
        
        // Create cube group to hold separate faces
        this.cube = new THREE.Group();
        
        // Create separate faces with gaps
        const faceSize = 0.75;
        const gap = 0.15;  // Increased gap from 0.05 to 0.15
        const offset = faceSize / 2 + gap;
        
        // Create plane geometry for faces
        const planeGeometry = new THREE.PlaneGeometry(faceSize, faceSize);
        
        // +X face (right) - bright red
        const rightFace = new THREE.Mesh(
            planeGeometry,
            new THREE.MeshPhongMaterial({ color: 0xffcccc, emissive: 0x663333, shininess: 100, side: THREE.FrontSide })
        );
        rightFace.position.set(offset, 0, 0);
        rightFace.rotation.y = Math.PI / 2;
        this.cube.add(rightFace);
        
        // -X face (left) - darker red
        const leftFace = new THREE.Mesh(
            planeGeometry,
            new THREE.MeshPhongMaterial({ color: 0xaa6666, emissive: 0x332222, shininess: 100, side: THREE.FrontSide })
        );
        leftFace.position.set(-offset, 0, 0);
        leftFace.rotation.y = -Math.PI / 2;
        this.cube.add(leftFace);
        
        // +Y face (top) - bright green
        const topFace = new THREE.Mesh(
            planeGeometry,
            new THREE.MeshPhongMaterial({ color: 0xccffcc, emissive: 0x336633, shininess: 100, side: THREE.FrontSide })
        );
        topFace.position.set(0, offset, 0);
        topFace.rotation.x = -Math.PI / 2;
        this.cube.add(topFace);
        
        // -Y face (bottom) - darker green
        const bottomFace = new THREE.Mesh(
            planeGeometry,
            new THREE.MeshPhongMaterial({ color: 0x66aa66, emissive: 0x223322, shininess: 100, side: THREE.FrontSide })
        );
        bottomFace.position.set(0, -offset, 0);
        bottomFace.rotation.x = Math.PI / 2;
        this.cube.add(bottomFace);
        
        // +Z face (front) - bright blue
        const frontFace = new THREE.Mesh(
            planeGeometry,
            new THREE.MeshPhongMaterial({ color: 0xccddff, emissive: 0x333366, shininess: 100, side: THREE.FrontSide })
        );
        frontFace.position.set(0, 0, offset);
        this.cube.add(frontFace);
        
        // -Z face (back) - darker blue
        const backFace = new THREE.Mesh(
            planeGeometry,
            new THREE.MeshPhongMaterial({ color: 0x6666aa, emissive: 0x222233, shininess: 100, side: THREE.FrontSide })
        );
        backFace.position.set(0, 0, -offset);
        backFace.rotation.y = Math.PI;
        this.cube.add(backFace);
        
        this.scene.add(this.cube);
        
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
        const xLine = new THREE.Line(xLineGeometry, new THREE.LineBasicMaterial({ 
            color: 0xff9999, 
            opacity: 0.8,  // Increased opacity
            transparent: true,
            linewidth: 3   // Make line thicker
        }));
        // Add cylinder for thicker appearance
        const xCylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8),
            new THREE.MeshBasicMaterial({ color: 0xff9999, opacity: 0.8, transparent: true })
        );
        xCylinder.rotation.z = -Math.PI / 2;
        xCylinder.position.set(1.05, 0, 0);
        this.scene.add(xLine);
        this.scene.add(xCylinder);
        
        // Y axis line (pastel green)
        const yLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.4, 0),  // Start from cube edge
            new THREE.Vector3(0, 1.7, 0)   // End near circle (adjusted for new position)
        ]);
        const yLine = new THREE.Line(yLineGeometry, new THREE.LineBasicMaterial({ 
            color: 0x99ff99, 
            opacity: 0.8,  // Increased opacity
            transparent: true,
            linewidth: 3   // Make line thicker
        }));
        // Add cylinder for thicker appearance
        const yCylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8),
            new THREE.MeshBasicMaterial({ color: 0x99ff99, opacity: 0.8, transparent: true })
        );
        yCylinder.position.set(0, 1.05, 0);
        this.scene.add(yLine);
        this.scene.add(yCylinder);
        
        // Z axis line (pastel blue)
        const zLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0.4),  // Start from cube edge
            new THREE.Vector3(0, 0, 1.7)   // End near circle (adjusted for new position)
        ]);
        const zLine = new THREE.Line(zLineGeometry, new THREE.LineBasicMaterial({ 
            color: 0x99ccff, 
            opacity: 0.8,  // Increased opacity
            transparent: true,
            linewidth: 3   // Make line thicker
        }));
        // Add cylinder for thicker appearance
        const zCylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8),
            new THREE.MeshBasicMaterial({ color: 0x99ccff, opacity: 0.8, transparent: true })
        );
        zCylinder.rotation.x = Math.PI / 2;
        zCylinder.position.set(0, 0, 1.05);
        this.scene.add(zLine);
        this.scene.add(zCylinder);
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