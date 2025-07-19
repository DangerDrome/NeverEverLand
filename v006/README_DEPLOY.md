# Cloudflare Pages Deployment Guide for v006

## Quick Fix for Submodule Error

If you see this error during deployment:
```
fatal: No url found for submodule path 'v005/src/StyleUI' in .gitmodules
Failed: error occurred while updating repository submodules
```

### Solution:

1. **Remove the submodule entry** from your git index:
```bash
git rm --cached v005/src/StyleUI
git add v005/src/StyleUI
git commit -m "Fix: Convert StyleUI from submodule to regular directory"
git push
```

2. **Alternative: Use v006 as root directory**
   - In Cloudflare Pages, set **Root directory** to: `v006`
   - This will skip the v005 directory entirely

## Cloudflare Pages Configuration

### Build Settings:
- **Framework preset**: Vite
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `v006` (recommended)
- **Node.js version**: 18

### Environment Variables:
```
NODE_VERSION=18
NPM_VERSION=latest
```

## Build Process

1. Cloudflare will:
   - Clone your repository
   - Navigate to v006 directory
   - Run `npm install`
   - Run `npm run build`
   - Serve files from `v006/dist/`

2. Your app will be available at:
   - `https://your-project.pages.dev`
   - Custom domain (optional)

## Troubleshooting

### If deployment fails:
1. Check build logs in Cloudflare dashboard
2. Ensure all dependencies are in package.json
3. Test build locally: `cd v006 && npm run build`
4. Make sure no large files (>25MB) are in the repository

### Performance already optimized:
- ✅ Material caching for tiles
- ✅ UI updates throttled to 30fps
- ✅ Configurable shadows and post-processing
- ✅ Production build with minification