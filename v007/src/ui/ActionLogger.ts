/**
 * ActionLogger - Tracks and displays user actions in the info bar
 */
export class ActionLogger {
    private static instance: ActionLogger;
    private logElement: HTMLElement | null = null;
    private currentTimeout: number | null = null;
    
    private constructor() {
        this.logElement = document.getElementById('action-log');
    }
    
    static getInstance(): ActionLogger {
        if (!ActionLogger.instance) {
            ActionLogger.instance = new ActionLogger();
        }
        return ActionLogger.instance;
    }
    
    log(message: string, duration: number = 3000): void {
        if (!this.logElement) return;
        
        // Clear any existing timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
        }
        
        // Set the new message
        this.logElement.textContent = message;
        this.logElement.style.color = 'rgba(255, 255, 255, 0.9)';
        
        // Fade back to "Ready" after duration
        this.currentTimeout = window.setTimeout(() => {
            if (this.logElement) {
                this.logElement.style.color = 'rgba(255, 255, 255, 0.6)';
                this.logElement.textContent = 'Ready';
            }
            this.currentTimeout = null;
        }, duration);
    }
    
    // Predefined action messages
    static actions = {
        // Voxel operations
        placeVoxel: (count: number = 1) => `Placed ${count} voxel${count > 1 ? 's' : ''}`,
        removeVoxel: (count: number = 1) => `Removed ${count} voxel${count > 1 ? 's' : ''}`,
        fillArea: (count: number) => `Filled area with ${count} voxels`,
        
        // Tool changes
        selectTool: (tool: string) => `Selected ${tool} tool`,
        changeBrushSize: (size: number) => `Brush size: ${size}`,
        selectVoxelType: (type: string) => `Selected ${type}`,
        selectColor: (color: string) => `Selected color ${color}`,
        
        // File operations
        saveScene: (filename: string) => `Saved scene: ${filename}`,
        loadScene: (filename: string) => `Loaded scene: ${filename}`,
        exportVoxels: (format: string) => `Exported as ${format}`,
        importVoxels: (filename: string) => `Imported: ${filename}`,
        
        // Layer operations
        createLayer: (name: string) => `Created layer: ${name}`,
        deleteLayer: (name: string) => `Deleted layer: ${name}`,
        selectLayer: (name: string) => `Selected layer: ${name}`,
        
        // Camera operations
        resetCamera: () => 'Reset camera view',
        toggleGrid: (visible: boolean) => `Grid ${visible ? 'shown' : 'hidden'}`,
        toggleWireframe: (visible: boolean) => `Wireframe ${visible ? 'enabled' : 'disabled'}`,
        
        // Undo/Redo
        undo: () => 'Undo',
        redo: () => 'Redo',
        
        // General
        ready: () => 'Ready',
        error: (msg: string) => `Error: ${msg}`
    };
}