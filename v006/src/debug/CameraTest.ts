import * as THREE from 'three';

/**
 * Debug utility to verify camera rotation produces correct dimetric view
 */
export class CameraTest {
  static createTestScene(scene: THREE.Scene): void {
    // Create test cubes at key positions
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0xff0000 }), // Red
      new THREE.MeshStandardMaterial({ color: 0x00ff00 }), // Green  
      new THREE.MeshStandardMaterial({ color: 0x0000ff }), // Blue
      new THREE.MeshStandardMaterial({ color: 0xffff00 }), // Yellow
      new THREE.MeshStandardMaterial({ color: 0xff00ff }), // Magenta
    ];
    
    // Place cubes at grid positions to verify alignment
    const positions = [
      { x: 0, z: 0, mat: 0 },    // Center - Red
      { x: 5, z: 0, mat: 1 },    // Right - Green
      { x: 0, z: 5, mat: 2 },    // Forward - Blue
      { x: -5, z: 0, mat: 3 },   // Left - Yellow
      { x: 0, z: -5, mat: 4 },   // Back - Magenta
    ];
    
    positions.forEach(pos => {
      const cube = new THREE.Mesh(cubeGeometry, materials[pos.mat]);
      cube.position.set(pos.x, 0.5, pos.z); // Center of cube at y=0.5
      cube.castShadow = true;
      cube.receiveShadow = true;
      scene.add(cube);
    });
    
    // Add axis helper to verify orientations
    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);
    
    // Add ground plane for reference
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x808080,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Add measurement lines to verify 2:1 ratio
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    
    // Horizontal line (should appear 2x length of vertical in dimetric view)
    const hLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5, 0.01, 0),
      new THREE.Vector3(5, 0.01, 0),
    ]);
    const hLine = new THREE.Line(hLineGeometry, lineMaterial);
    scene.add(hLine);
    
    // Vertical line (should appear 1/2 length of horizontal in dimetric view)
    const vLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.01, -5),
      new THREE.Vector3(0, 0.01, 5),
    ]);
    const vLine = new THREE.Line(vLineGeometry, lineMaterial);
    scene.add(vLine);
  }
  
  /**
   * Calculate expected screen ratios for dimetric projection
   */
  static calculateDimetricRatios(): { horizontalToVertical: number; diagonalAngle: number } {
    // In true dimetric projection:
    // - Horizontal lines (X axis) and vertical lines (Z axis) should have 2:1 ratio
    // - Diagonal angles should be specific values
    
    const elevation = Math.atan(0.5); // ~26.565 degrees
    const azimuth = Math.PI / 4; // 45 degrees
    
    // Project unit vectors to screen space
    // For orthographic projection with camera looking along negative Y
    const screenX = Math.cos(azimuth);
    const screenZ = Math.sin(azimuth) * Math.cos(elevation);
    
    return {
      horizontalToVertical: screenX / screenZ, // Should be ~2 for dimetric
      diagonalAngle: Math.atan2(screenZ, screenX) * 180 / Math.PI, // Angle in degrees
    };
  }
}