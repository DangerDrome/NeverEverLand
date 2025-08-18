#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const VoxParserNode = require('./vox-parser-node.cjs');

const ASSETS_DIR = path.join(__dirname, '../public/assets');
const DEFAULT_ASSETS_FILE = path.join(__dirname, '../src/assets/defaultAssets.ts');
const voxParser = new VoxParserNode();

// Map of folder names to VoxelType enum values
const VOXEL_TYPE_MAP = {
    'grass': 'GRASS',
    'dirt': 'DIRT',
    'stone': 'STONE',
    'wood': 'WOOD',
    'leaves': 'LEAVES',
    'water': 'WATER',
    'sand': 'SAND',
    'snow': 'SNOW',
    'ice': 'ICE'
};

// Get size of vox file by parsing it
function getVoxSize(filePath) {
    try {
        return voxParser.parseVoxFile(filePath);
    } catch (error) {
        console.warn(`Warning: Could not parse VOX file ${filePath}:`, error.message);
        // Default size as fallback
        return { x: 3, y: 2, z: 3 };
    }
}

// Generate asset ID from filename
function generateAssetId(filename, folder) {
    const baseName = path.basename(filename, '.vox');
    return baseName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

// Generate asset name from filename
function generateAssetName(filename) {
    const baseName = path.basename(filename, '.vox');
    return baseName
        .split(/[_-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Update assets.json for a specific material type
async function updateAssetsJson(materialType) {
    const folderPath = path.join(ASSETS_DIR, materialType);
    const assetsJsonPath = path.join(folderPath, 'assets.json');
    
    if (!fs.existsSync(folderPath)) {
        return;
    }
    
    // Get all .vox files in the folder
    const voxFiles = fs.readdirSync(folderPath)
        .filter(file => file.endsWith('.vox'))
        .sort();
    
    // Create asset entries
    const assets = voxFiles.map(file => {
        const id = generateAssetId(file, materialType);
        const name = generateAssetName(file);
        const size = getVoxSize(path.join(folderPath, file));
        
        return {
            id,
            name,
            description: `${name} asset`,
            file,
            size,
            preview: file.replace('.vox', '.png')
        };
    });
    
    // Create the assets.json content
    const assetsJson = {
        [materialType]: assets
    };
    
    // Write the file
    fs.writeFileSync(assetsJsonPath, JSON.stringify(assetsJson, null, 2) + '\n');
    console.log(`✓ Updated ${assetsJsonPath} with ${assets.length} assets`);
}

// Update defaultAssets.ts
async function updateDefaultAssets() {
    const imports = `import { VoxelType } from '../engine/VoxelEngine';
import { AssetInfo } from './types';

// Default assets that ship with the application
// These will be stored as .vox files in the public/assets folder
`;

    let assetDefinitions = 'export const DEFAULT_ASSETS: Partial<Record<VoxelType, AssetInfo[]>> = {\n';
    assetDefinitions += '    [VoxelType.AIR]: [],\n';
    
    // Process each material type
    for (const [folder, voxelType] of Object.entries(VOXEL_TYPE_MAP)) {
        const folderPath = path.join(ASSETS_DIR, folder);
        
        if (!fs.existsSync(folderPath)) {
            assetDefinitions += `    \n    [VoxelType.${voxelType}]: [],\n`;
            continue;
        }
        
        const voxFiles = fs.readdirSync(folderPath)
            .filter(file => file.endsWith('.vox'))
            .sort();
        
        assetDefinitions += `    \n    [VoxelType.${voxelType}]: [\n`;
        
        voxFiles.forEach((file, index) => {
            const id = generateAssetId(file, folder);
            const name = generateAssetName(file);
            const size = getVoxSize(path.join(folderPath, file));
            const tags = generateTags(file, folder);
            
            assetDefinitions += '        {\n';
            assetDefinitions += `            id: '${id}',\n`;
            assetDefinitions += `            name: '${name}',\n`;
            assetDefinitions += `            type: VoxelType.${voxelType},\n`;
            assetDefinitions += `            path: '/assets/${folder}/${file}',\n`;
            assetDefinitions += `            size: { x: ${size.x}, y: ${size.y}, z: ${size.z} },\n`;
            assetDefinitions += `            tags: [${tags.map(t => `'${t}'`).join(', ')}]\n`;
            assetDefinitions += '        }';
            
            if (index < voxFiles.length - 1) {
                assetDefinitions += ',';
            }
            assetDefinitions += '\n';
        });
        
        assetDefinitions += '    ],\n';
    }
    
    assetDefinitions += '};\n';
    
    // Write the file
    fs.writeFileSync(DEFAULT_ASSETS_FILE, imports + assetDefinitions);
    console.log('✓ Updated defaultAssets.ts');
}

// Generate tags based on filename and type
function generateTags(filename, materialType) {
    const baseName = path.basename(filename, '.vox').toLowerCase();
    const tags = [materialType];
    
    // Add tags based on common patterns
    if (baseName.includes('path')) tags.push('path', 'road');
    if (baseName.includes('wall')) tags.push('wall', 'barrier');
    if (baseName.includes('block')) tags.push('block', 'cube');
    if (baseName.includes('pillar') || baseName.includes('post')) tags.push('pillar', 'column');
    if (baseName.includes('floor')) tags.push('floor', 'platform');
    if (baseName.includes('hill') || baseName.includes('mound')) tags.push('hill', 'terrain');
    if (baseName.includes('steps') || baseName.includes('stairs')) tags.push('steps', 'terrain');
    if (baseName.includes('spike')) tags.push('spike');
    if (baseName.includes('sphere') || baseName.includes('ball')) tags.push('sphere', 'round');
    if (baseName.includes('bush')) tags.push('bush', 'nature');
    if (baseName.includes('hedge')) tags.push('hedge', 'decoration');
    if (baseName.includes('pile')) tags.push('pile');
    if (baseName.includes('dune')) tags.push('dune', 'desert');
    if (baseName.includes('castle')) tags.push('castle');
    if (baseName.includes('man')) tags.push(baseName); // snowman
    if (baseName.includes('fall')) tags.push('waterfall', 'cascade');
    if (baseName.includes('stream')) tags.push('stream', 'river');
    if (baseName.includes('pool') || baseName.includes('pond')) tags.push('pool', 'pond');
    
    // Add size-based tags
    if (baseName.includes('small') || baseName.includes('tiny')) tags.push('small');
    if (baseName.includes('large') || baseName.includes('big')) tags.push('large');
    
    return [...new Set(tags)]; // Remove duplicates
}

// Update all asset files
async function updateAllAssets() {
    console.log('🔄 Updating all asset files...\n');
    
    // Update each material type's assets.json
    for (const materialType of Object.keys(VOXEL_TYPE_MAP)) {
        await updateAssetsJson(materialType);
    }
    
    // Update defaultAssets.ts
    await updateDefaultAssets();
    
    console.log('\n✅ All asset files updated!');
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--watch') || args.includes('-w')) {
        console.log('👁️  Watching for changes in', ASSETS_DIR);
        
        // Initial update
        await updateAllAssets();
        
        // Watch for changes
        const watcher = chokidar.watch(ASSETS_DIR, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });
        
        // Handle file additions
        watcher.on('add', async (filePath) => {
            if (path.extname(filePath) === '.vox') {
                console.log(`\n📦 New .vox file detected: ${path.relative(ASSETS_DIR, filePath)}`);
                
                // Get the material type from the folder
                const relativePath = path.relative(ASSETS_DIR, filePath);
                const materialType = relativePath.split(path.sep)[0];
                
                if (VOXEL_TYPE_MAP[materialType]) {
                    await updateAssetsJson(materialType);
                    await updateDefaultAssets();
                }
            }
        });
        
        // Handle file deletions
        watcher.on('unlink', async (filePath) => {
            if (path.extname(filePath) === '.vox') {
                console.log(`\n🗑️  .vox file deleted: ${path.relative(ASSETS_DIR, filePath)}`);
                
                // Get the material type from the folder
                const relativePath = path.relative(ASSETS_DIR, filePath);
                const materialType = relativePath.split(path.sep)[0];
                
                if (VOXEL_TYPE_MAP[materialType]) {
                    await updateAssetsJson(materialType);
                    await updateDefaultAssets();
                }
            }
        });
        
        console.log('\nPress Ctrl+C to stop watching...');
    } else {
        // Just run once
        await updateAllAssets();
    }
}

// Run the script
main().catch(console.error);