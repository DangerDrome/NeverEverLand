// v006/src/core/VoxelWorker.js

// Minimal greedy meshing for worker (no color, no instancing, just positions/normals/indices)
function greedyMesh(chunkData) {
  // Assume chunkData.voxels is an array of {x, y, z, type}
  // Only merge faces between solid and air
  const positions = [];
  const normals = [];
  const indices = [];
  let vertexCount = 0;
  const solid = new Set();
  for (const v of chunkData.voxels) {
    if (v.type !== 0) { // 0 = Air
      solid.add(`${v.x},${v.y},${v.z}`);
    }
  }
  // For each solid voxel, add all exposed faces
  const faceDeltas = [
    { n: [0, 1, 0], d: [0, 1, 0] }, // top
    { n: [0, -1, 0], d: [0, -1, 0] }, // bottom
    { n: [0, 0, 1], d: [0, 0, 1] }, // front
    { n: [0, 0, -1], d: [0, 0, -1] }, // back
    { n: [1, 0, 0], d: [1, 0, 0] }, // right
    { n: [-1, 0, 0], d: [-1, 0, 0] } // left
  ];
  for (const v of chunkData.voxels) {
    if (v.type === 0) continue;
    for (const { n, d } of faceDeltas) {
      const nx = v.x + d[0], ny = v.y + d[1], nz = v.z + d[2];
      if (!solid.has(`${nx},${ny},${nz}`)) {
        // Add face (quad)
        const base = vertexCount;
        // 4 corners of the face
        const corners = [
          [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]
        ];
        // Map corners to face orientation
        let verts;
        if (n[0] !== 0) { // X face
          verts = corners.map(([y, z, _]) => [v.x + (n[0] > 0 ? 1 : 0), v.y + y, v.z + z]);
        } else if (n[1] !== 0) { // Y face
          verts = corners.map(([x, z, _]) => [v.x + x, v.y + (n[1] > 0 ? 1 : 0), v.z + z]);
        } else { // Z face
          verts = corners.map(([x, y, _]) => [v.x + x, v.y + y, v.z + (n[2] > 0 ? 1 : 0)]);
        }
        for (const vert of verts) {
          positions.push(...vert);
          normals.push(...n);
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        vertexCount += 4;
      }
    }
  }
  return { positions, normals, indices };
}

self.onmessage = function(e) {
  const { type, chunkCoord, chunkData, config } = e.data;
  if (type === 'mesh') {
    const geometry = greedyMesh(chunkData);
    self.postMessage({ type: 'meshResult', chunkCoord, geometry });
  }
}; 