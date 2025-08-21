import { VoxelEngine } from '../engine/VoxelEngine';
import { VoxelRenderer } from '../engine/VoxelRenderer';
import { DrawingSystem } from '../interaction/DrawingSystem';
import { UndoRedoManager } from '../engine/UndoRedoManager';
import { FileManager } from '../io/FileManager';
import { settings } from '../main';
import { DirectionIndicator } from './DirectionIndicator';
import { LayerPanel } from './LayerPanel';
import { ModalDialog } from './ModalDialog';

interface MenuItem {
    label?: string;
    action?: string;
    icon?: string;
    shortcut?: string;
    submenu?: MenuItem[];
    type?: 'separator';
}

interface MenuDefinition {
    [key: string]: MenuItem[];
}

export class MenuBar {
    private menuElement: HTMLElement;
    private activeDropdown: HTMLElement | null = null;
    private menus: MenuDefinition;
    private recentScenes: string[] = [];
    
    constructor(
        private engine: VoxelEngine,
        private renderer: VoxelRenderer,
        private drawingSystem: DrawingSystem,
        private undoRedoManager: UndoRedoManager,
        private fileManager: FileManager,
        private directionIndicator: DirectionIndicator,
        private layerPanel: LayerPanel
    ) {
        this.menuElement = document.getElementById('menu-bar')!;
        this.menus = this.createMenuDefinitions();
        this.initializeMenu();
        this.loadRecentScenes();
    }
    
    private createMenuDefinitions(): MenuDefinition {
        return {
            file: [
                { label: 'Save Scene', action: 'save-scene', icon: 'save' },
                { label: 'Load Scene', action: 'load-scene', icon: 'folder-open' },
                { label: 'Recent Scenes', action: 'recent-scenes', icon: 'clock', submenu: [] },
                { type: 'separator' },
                { label: 'Export Voxels', action: 'export-voxels', icon: 'download' },
                { label: 'Import Voxels', action: 'import-voxels', icon: 'upload' },
                { type: 'separator' },
                { label: 'Reload', action: 'reload', icon: 'refresh-cw' }
            ],
            edit: [
                { label: 'Undo', action: 'undo', icon: 'undo', shortcut: 'Ctrl+Z' },
                { label: 'Redo', action: 'redo', icon: 'redo', shortcut: 'Ctrl+Y' },
                { type: 'separator' },
                { label: 'Clear All', action: 'clear-all', icon: 'trash-2' },
                { label: 'Fill Layer', action: 'fill-layer', icon: 'layers' }
            ],
            selection: [
                { label: 'Select All', action: 'select-all', icon: 'square' },
                { label: 'Select None', action: 'select-none', icon: 'square-dashed' },
                { label: 'Invert Selection', action: 'invert-selection', icon: 'rotate-3d' }
            ],
            layer: [
                { label: 'Add Layer', action: 'add-layer', icon: 'plus-circle' },
                { label: 'Delete Layer', action: 'delete-layer', icon: 'trash' },
                { label: 'Duplicate Layer', action: 'duplicate-layer', icon: 'copy' },
                { type: 'separator' },
                { label: 'Merge Down', action: 'merge-down', icon: 'git-merge' },
                { label: 'Flatten All', action: 'flatten-all', icon: 'layers' },
                { type: 'separator' },
                { label: 'Hide All', action: 'hide-all-layers', icon: 'eye-off' },
                { label: 'Show All', action: 'show-all-layers', icon: 'eye' }
            ],
            view: [
                { label: 'Toggle Grid', action: 'toggle-grid', icon: 'grid', shortcut: 'G' },
                { label: 'Reset Camera', action: 'reset-camera', icon: 'focus', shortcut: 'F' },
                { type: 'separator' },
                { label: 'Toggle Wireframe', action: 'toggle-wireframe', icon: 'box', shortcut: 'W' },
                { label: 'Toggle Tilt-Shift', action: 'toggle-tilt-shift', icon: 'aperture', shortcut: 'T' },
                { type: 'separator' },
                { label: 'Fullscreen', action: 'toggle-fullscreen', icon: 'maximize' }
            ],
            help: [
                { label: 'Controls', action: 'show-controls', icon: 'keyboard', shortcut: 'H' },
                { label: 'About', action: 'show-about', icon: 'info' }
            ]
        };
    }
    
    private initializeMenu(): void {
        // Initialize Lucide icons (including the logo)
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
        
        // Set up menu items
        const menuItems = this.menuElement.querySelectorAll('.menu-item');
        menuItems.forEach((item) => {
            const menuName = item.getAttribute('data-menu');
            if (menuName) {
                item.addEventListener('click', (e) => this.toggleMenu(e, menuName));
            }
        });
        
        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.menuElement.contains(e.target as Node) && this.activeDropdown) {
                this.closeActiveDropdown();
            }
        });
        
        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    private toggleMenu(event: Event, menuName: string): void {
        event.stopPropagation();
        
        const menuItem = event.target as HTMLElement;
        const rect = menuItem.getBoundingClientRect();
        
        if (this.activeDropdown) {
            this.closeActiveDropdown();
            if (this.activeDropdown.getAttribute('data-menu') === menuName) {
                return;
            }
        }
        
        const dropdown = this.createDropdown(this.menus[menuName], menuName);
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = rect.bottom + 'px';
        document.body.appendChild(dropdown);
        
        this.activeDropdown = dropdown;
        
        // Initialize icons in the dropdown
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
    }
    
    private createDropdown(items: MenuItem[], menuName: string): HTMLElement {
        const dropdown = document.createElement('div');
        dropdown.className = 'menu-dropdown';
        dropdown.setAttribute('data-menu', menuName);
        dropdown.style.display = 'block';
        
        items.forEach(item => {
            if (item.type === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'menu-separator';
                dropdown.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'menu-dropdown-item';
                
                // Create left side container for icon and label
                const leftSide = document.createElement('div');
                leftSide.style.cssText = 'display: flex; align-items: center; gap: 8px;';
                
                if (item.icon) {
                    const icon = document.createElement('i');
                    icon.setAttribute('data-lucide', item.icon);
                    icon.setAttribute('width', '16');
                    icon.setAttribute('height', '16');
                    leftSide.appendChild(icon);
                }
                
                const label = document.createElement('span');
                label.textContent = item.label || '';
                leftSide.appendChild(label);
                
                menuItem.appendChild(leftSide);
                
                // Add shortcut on the right if present
                if (item.shortcut) {
                    const shortcut = document.createElement('span');
                    shortcut.className = 'menu-shortcut';
                    shortcut.textContent = item.shortcut;
                    menuItem.appendChild(shortcut);
                }
                
                if (item.action) {
                    menuItem.addEventListener('click', () => this.handleAction(item.action!));
                }
                
                if (item.submenu) {
                    // Handle submenu if needed
                }
                
                dropdown.appendChild(menuItem);
            }
        });
        
        return dropdown;
    }
    
    private closeActiveDropdown(): void {
        if (this.activeDropdown) {
            this.activeDropdown.remove();
            this.activeDropdown = null;
        }
    }
    
    private async handleAction(action: string): Promise<void> {
        this.closeActiveDropdown();
        
        switch (action) {
            case 'save-scene':
                await this.saveScene();
                break;
            case 'load-scene':
                await this.loadScene();
                break;
            case 'export-voxels':
                this.fileManager.exportFile('vox');
                break;
            case 'import-voxels':
                this.promptForImport();
                break;
            case 'reload':
                if (await ModalDialog.confirm({ title: 'Reload Page', message: 'Any unsaved changes will be lost. Continue?' })) {
                    location.reload();
                }
                break;
            case 'undo':
                this.undoRedoManager.undo();
                break;
            case 'redo':
                this.undoRedoManager.redo();
                break;
            case 'clear-all':
                if (await ModalDialog.confirm({ title: 'Clear All', message: 'This will remove all voxels. Are you sure?' })) {
                    this.engine.clear();
                    this.engine.updateInstances();
                }
                break;
            case 'fill-layer':
                // TODO: Implement fill layer functionality
                break;
            case 'select-all':
            case 'select-none':
            case 'invert-selection':
                // TODO: Implement selection actions
                break;
            case 'add-layer':
                // TODO: Implement add layer
                break;
            case 'delete-layer':
                // TODO: Implement delete layer
                break;
            case 'duplicate-layer':
                // TODO: Implement duplicate layer
                break;
            case 'merge-down':
                // TODO: Implement merge down
                break;
            case 'flatten-all':
                // TODO: Implement flatten all
                break;
            case 'hide-all-layers':
                // TODO: Implement hide all layers
                break;
            case 'show-all-layers':
                // TODO: Implement show all layers
                break;
            case 'toggle-grid':
                settings.grid.showGrid = !settings.grid.showGrid;
                // Update grid visibility
                const event = new CustomEvent('toggleGrid', { detail: settings.grid.showGrid });
                window.dispatchEvent(event);
                break;
            case 'reset-camera':
                // Emit custom event for camera reset
                window.dispatchEvent(new CustomEvent('resetCamera'));
                break;
            case 'toggle-wireframe':
                this.renderer.toggleEdges();
                break;
            case 'toggle-tilt-shift':
                // Emit custom event for tilt-shift toggle
                window.dispatchEvent(new CustomEvent('toggleTiltShift'));
                break;
            case 'toggle-fullscreen':
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
                break;
            case 'show-controls':
                await this.showControlsDialog();
                break;
            case 'show-about':
                await this.showAboutDialog();
                break;
        }
    }
    
    private async saveScene(): Promise<void> {
        const defaultName = `scene_${new Date().toISOString().slice(0, 10)}`;
        // TODO: Implement custom prompt dialog
        const filename = prompt('Enter filename:', defaultName);
        
        if (filename) {
            this.fileManager.exportFile('json', filename);
            this.addRecentScene(filename);
        }
    }
    
    private async loadScene(): Promise<void> {
        this.promptForImport();
    }
    
    private addRecentScene(filename: string): void {
        this.recentScenes = this.recentScenes.filter(f => f !== filename);
        this.recentScenes.unshift(filename);
        if (this.recentScenes.length > 10) {
            this.recentScenes = this.recentScenes.slice(0, 10);
        }
        localStorage.setItem('recentScenes', JSON.stringify(this.recentScenes));
        this.updateRecentScenesMenu();
    }
    
    private loadRecentScenes(): void {
        const stored = localStorage.getItem('recentScenes');
        if (stored) {
            this.recentScenes = JSON.parse(stored);
            this.updateRecentScenesMenu();
        }
    }
    
    private updateRecentScenesMenu(): void {
        const recentMenu = this.menus.file.find(item => item.action === 'recent-scenes');
        if (recentMenu) {
            recentMenu.submenu = this.recentScenes.map(filename => ({
                label: filename,
                action: `load-recent:${filename}`,
                icon: 'file'
            }));
        }
    }
    
    private setupKeyboardShortcuts(): void {
        // Key shortcuts are handled by main app, but we can add menu-specific ones here if needed
    }
    
    private promptForImport(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.vox,.json';
        input.onchange = async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) {
                await this.fileManager.importFile(file);
                this.engine.updateInstances();
            }
        };
        input.click();
    }
    
    private async showControlsDialog(): Promise<void> {
        const content = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h3>Mouse Controls</h3>
                    <div style="margin-bottom: 15px;">
                        <strong>Left Click:</strong> Place voxel/asset<br>
                        <strong>Right Click:</strong> Remove voxel<br>
                        <strong>Middle Mouse:</strong> Pan camera<br>
                        <strong>Scroll Wheel:</strong> Zoom in/out<br>
                        <strong>Left Drag:</strong> Rotate camera
                    </div>
                    
                    <h3>Drawing Tools</h3>
                    <div>
                        <strong>V:</strong> Single voxel brush<br>
                        <strong>B:</strong> Brush tool<br>
                        <strong>E:</strong> Eraser tool<br>
                        <strong>X:</strong> Box tool<br>
                        <strong>L:</strong> Line tool<br>
                        <strong>P:</strong> Fill tool<br>
                        <strong>S:</strong> Selection tool
                    </div>
                </div>
                
                <div>
                    <h3>General Controls</h3>
                    <div style="margin-bottom: 15px;">
                        <strong>1-9:</strong> Select voxel type<br>
                        <strong>G:</strong> Toggle grid<br>
                        <strong>W:</strong> Toggle wireframe<br>
                        <strong>T:</strong> Toggle tilt-shift<br>
                        <strong>F:</strong> Reset camera<br>
                        <strong>R:</strong> Rotate asset<br>
                        <strong>[/]:</strong> Brush size -/+
                    </div>
                    
                    <h3>File Operations</h3>
                    <div>
                        <strong>Ctrl+S:</strong> Save scene<br>
                        <strong>Ctrl+O:</strong> Load scene<br>
                        <strong>Ctrl+N:</strong> New scene<br>
                        <strong>Ctrl+Z:</strong> Undo<br>
                        <strong>Ctrl+Y:</strong> Redo
                    </div>
                </div>
            </div>
        `;
        
        await ModalDialog.alert({ title: 'Keyboard Controls', message: content, html: true });
    }
    
    private async showAboutDialog(): Promise<void> {
        try {
            const response = await fetch('/README.md');
            const markdown = await response.text();
            
            // Extract the relevant sections
            const sections = ['## 🚀 Quick Start', '## 🎮 Controls', '## ✨ Features'];
            let relevantContent = '';
            
            for (const section of sections) {
                const startIndex = markdown.indexOf(section);
                if (startIndex !== -1) {
                    const nextSection = markdown.indexOf('\n## ', startIndex + 1);
                    const endIndex = nextSection !== -1 ? nextSection : markdown.length;
                    relevantContent += markdown.slice(startIndex, endIndex) + '\n\n';
                }
            }
            
            // Parse markdown to HTML
            if ((window as any).markdownit) {
                const md = (window as any).markdownit();
                const html = md.render(relevantContent);
                
                const content = `
                    <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
                        ${html}
                    </div>
                    <div style="margin-top: 20px; text-align: center; color: rgba(255, 255, 255, 0.6);">
                        Version 1.2.1 • Built with Three.js
                    </div>
                `;
                
                await ModalDialog.alert({ title: 'About Never Ever Land', message: content, html: true });
            }
        } catch (error) {
            const content = `
                <div style="text-align: center;">
                    <h2>Never Ever Land</h2>
                    <p>High-performance voxel engine with TypeScript</p>
                    <p style="color: rgba(255, 255, 255, 0.6);">Version 1.2.1</p>
                </div>
            `;
            await ModalDialog.alert({ title: 'About', message: content, html: true });
        }
    }
}