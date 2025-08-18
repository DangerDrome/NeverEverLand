# Asset Management System

## Overview

The v007 voxel engine includes an automatic asset detection system that monitors the `/public/assets` folder and automatically updates asset configurations when new .vox files are added.

## How It Works

1. **File Structure**: Assets are organized by material type in `/public/assets/`:
   ```
   public/assets/
   ├── grass/
   ├── dirt/
   ├── stone/
   ├── wood/
   ├── leaves/
   ├── water/
   ├── sand/
   ├── snow/
   └── ice/
   ```

2. **Automatic Detection**: When you place a new .vox file in any material folder, the system:
   - Detects the new file
   - Parses the VOX file to get dimensions
   - Updates the folder's `assets.json`
   - Updates `/src/assets/defaultAssets.ts`
   - Automatically generates metadata (name, tags, etc.)

## Usage

### One-time Update
To scan all assets and update configurations:
```bash
npm run update-assets
```

### Watch Mode
To continuously monitor for new assets:
```bash
npm run watch-assets
```

### Adding New Assets

1. Create your voxel asset in MagicaVoxel
2. Export as .vox file
3. Place the file in the appropriate material folder (e.g., `/public/assets/grass/` for grass assets)
4. If watch mode is running, the asset will be detected automatically
5. Otherwise, run `npm run update-assets`

## Asset Naming Conventions

- Use lowercase with underscores: `grass_hill.vox`, `stone_wall.vox`
- The system will automatically generate:
  - ID: filename without extension (e.g., `grass_hill`)
  - Name: Title case with spaces (e.g., `Grass Hill`)
  - Tags: Based on filename patterns (hill, wall, path, etc.)

## Generated Files

The system maintains two files:

1. **assets.json** (per material folder):
   ```json
   {
     "grass": [
       {
         "id": "grass_hill",
         "name": "Grass Hill",
         "description": "Grass Hill asset",
         "file": "grass_hill.vox",
         "size": { "x": 5, "y": 3, "z": 5 },
         "preview": "grass_hill.png"
       }
     ]
   }
   ```

2. **defaultAssets.ts** (global):
   ```typescript
   export const DEFAULT_ASSETS: Partial<Record<VoxelType, AssetInfo[]>> = {
     [VoxelType.GRASS]: [
       {
         id: 'grass_hill',
         name: 'Grass Hill',
         type: VoxelType.GRASS,
         path: '/assets/grass/grass_hill.vox',
         size: { x: 5, y: 3, z: 5 },
         tags: ['grass', 'hill', 'terrain']
       }
     ]
   };
   ```

## Technical Details

- Scripts are located in `/tools/` directory
- The watcher uses `chokidar` for file system monitoring
- VOX files are parsed to extract actual dimensions
- Files are processed in alphabetical order
- The system preserves manual edits to tags if you modify defaultAssets.ts

## Troubleshooting

- If a VOX file can't be parsed, default dimensions (3x3x3) are used
- Check console output for warnings about parsing errors
- Ensure VOX files are valid MagicaVoxel format (version 150)