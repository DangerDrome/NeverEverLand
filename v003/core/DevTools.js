/**
 * Development Tools
 * Provides debugging, hot reload, and performance monitoring capabilities
 */
export class DevTools {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.enabled = true;
        
        // Hot reload
        this.hotReloadEnabled = false;
        this.moduleCache = new Map();
        this.watchedFiles = new Set();
        
        // Debug state
        this.debugPanels = new Map();
        this.showDebugInfo = false;
        this.showPerformanceGraph = false;
        
        // Performance monitoring
        this.performanceHistory = [];
        this.maxHistoryLength = 300; // 5 seconds at 60fps
        
        // Component inspector
        this.selectedEntity = null;
        this.componentInspector = null;
        
        this.initialize();
    }
    
    initialize() {
        if (!this.enabled) return;
        
        this.setupKeyboardShortcuts();
        this.createDebugUI();
        this.startPerformanceMonitoring();
        
        console.log('DevTools initialized');
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Only handle if not already handled by game
            if (event.defaultPrevented) return;
            
            switch (event.code) {
                case 'F4':
                    this.toggleDebugInfo();
                    event.preventDefault();
                    break;
                case 'F5':
                    this.reloadCurrentDemo();
                    event.preventDefault();
                    break;
                case 'F6':
                    this.togglePerformanceGraph();
                    event.preventDefault();
                    break;
                case 'F7':
                    this.toggleComponentInspector();
                    event.preventDefault();
                    break;
                case 'F8':
                    this.dumpWorldState();
                    event.preventDefault();
                    break;
            }
        });
    }
    
    createDebugUI() {
        // Create debug overlay container
        this.debugContainer = document.createElement('div');
        this.debugContainer.id = 'devtools-overlay';
        this.debugContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        `;
        document.body.appendChild(this.debugContainer);
        
        // Create debug info panel
        this.createDebugInfoPanel();
        
        // Create performance graph
        this.createPerformanceGraph();
        
        // Create component inspector
        this.createComponentInspector();
    }
    
    createDebugInfoPanel() {
        this.debugInfoPanel = document.createElement('div');
        this.debugInfoPanel.style.cssText = `
            position: absolute;
            top: 200px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            padding: 10px;
            border-radius: 5px;
            max-width: 400px;
            display: none;
            pointer-events: auto;
        `;
        this.debugContainer.appendChild(this.debugInfoPanel);
    }
    
    createPerformanceGraph() {
        this.performanceCanvas = document.createElement('canvas');
        this.performanceCanvas.width = 300;
        this.performanceCanvas.height = 100;
        this.performanceCanvas.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #333;
            display: none;
        `;
        this.debugContainer.appendChild(this.performanceCanvas);
        
        this.performanceCtx = this.performanceCanvas.getContext('2d');
    }
    
    createComponentInspector() {
        this.componentInspector = document.createElement('div');
        this.componentInspector.style.cssText = `
            position: absolute;
            top: 50%;
            right: 10px;
            transform: translateY(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 5px;
            width: 350px;
            max-height: 70vh;
            overflow-y: auto;
            display: none;
            pointer-events: auto;
        `;
        this.debugContainer.appendChild(this.componentInspector);
    }
    
    startPerformanceMonitoring() {
        setInterval(() => {
            if (!this.enabled) return;
            
            const stats = this.gameEngine.getStats();
            const perfData = {
                timestamp: performance.now(),
                fps: stats.performance.averageFPS,
                frameTime: stats.performance.frameTime,
                entities: stats.entities,
                systems: Object.keys(stats.systems).length,
                drawCalls: stats.rendering?.drawCalls || 0,
                triangles: stats.rendering?.triangles || 0
            };
            
            this.performanceHistory.push(perfData);
            
            if (this.performanceHistory.length > this.maxHistoryLength) {\n                this.performanceHistory.shift();\n            }\n            \n            if (this.showPerformanceGraph) {\n                this.updatePerformanceGraph();\n            }\n            \n            if (this.showDebugInfo) {\n                this.updateDebugInfo(stats);\n            }\n            \n        }, 1000 / 30); // 30fps update rate for debug info\n    }\n    \n    updateDebugInfo(stats) {\n        if (!this.debugInfoPanel) return;\n        \n        const html = `\n            <h3>🛠️ DevTools Debug Info</h3>\n            <div style=\"font-size: 11px; line-height: 1.4;\">\n                <strong>Engine:</strong><br>\n                FPS: ${stats.performance.averageFPS.toFixed(1)} (${stats.performance.minFPS.toFixed(1)}-${stats.performance.maxFPS.toFixed(1)})<br>\n                Frame Time: ${stats.performance.frameTime.toFixed(2)}ms<br>\n                Frame Count: ${stats.frameCount}<br><br>\n                \n                <strong>ECS:</strong><br>\n                Entities: ${stats.entities}<br>\n                Archetypes: ${stats.archetypes}<br>\n                Query Cache: ${stats.queryCacheSize}<br><br>\n                \n                <strong>Systems:</strong><br>\n                ${Object.entries(stats.systems).map(([name, sysStats]) => \n                    `${name}: ${sysStats.averageFrameTime.toFixed(2)}ms`\n                ).join('<br>')}<br><br>\n                \n                <strong>Rendering:</strong><br>\n                Draw Calls: ${stats.rendering?.drawCalls || 0}<br>\n                Triangles: ${stats.rendering?.triangles || 0}<br>\n                Culled: ${stats.rendering?.culled || 0}<br><br>\n                \n                <strong>Memory:</strong><br>\n                Heap: ${(performance.memory?.usedJSHeapSize / 1048576).toFixed(1) || 'N/A'} MB<br>\n                Component Pools: ${Object.keys(stats.poolStats).length}<br><br>\n                \n                <strong>Hotkeys:</strong><br>\n                F4: Toggle Debug | F5: Reload Demo<br>\n                F6: Perf Graph | F7: Inspector<br>\n                F8: Dump State\n            </div>\n        `;\n        \n        this.debugInfoPanel.innerHTML = html;\n    }\n    \n    updatePerformanceGraph() {\n        if (!this.performanceCtx || this.performanceHistory.length < 2) return;\n        \n        const ctx = this.performanceCtx;\n        const canvas = this.performanceCanvas;\n        \n        // Clear canvas\n        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';\n        ctx.fillRect(0, 0, canvas.width, canvas.height);\n        \n        // Draw grid\n        ctx.strokeStyle = '#333';\n        ctx.lineWidth = 1;\n        for (let i = 0; i <= 6; i++) {\n            const y = (i / 6) * canvas.height;\n            ctx.beginPath();\n            ctx.moveTo(0, y);\n            ctx.lineTo(canvas.width, y);\n            ctx.stroke();\n        }\n        \n        // Draw FPS line\n        ctx.strokeStyle = '#00ff00';\n        ctx.lineWidth = 2;\n        ctx.beginPath();\n        \n        const maxFPS = 60;\n        const dataPoints = Math.min(this.performanceHistory.length, canvas.width);\n        const startIndex = this.performanceHistory.length - dataPoints;\n        \n        for (let i = 0; i < dataPoints; i++) {\n            const data = this.performanceHistory[startIndex + i];\n            const x = (i / (dataPoints - 1)) * canvas.width;\n            const y = canvas.height - (data.fps / maxFPS) * canvas.height;\n            \n            if (i === 0) {\n                ctx.moveTo(x, y);\n            } else {\n                ctx.lineTo(x, y);\n            }\n        }\n        ctx.stroke();\n        \n        // Draw frame time line\n        ctx.strokeStyle = '#ff6600';\n        ctx.lineWidth = 1;\n        ctx.beginPath();\n        \n        const maxFrameTime = 33; // 33ms = 30fps\n        for (let i = 0; i < dataPoints; i++) {\n            const data = this.performanceHistory[startIndex + i];\n            const x = (i / (dataPoints - 1)) * canvas.width;\n            const y = canvas.height - (data.frameTime / maxFrameTime) * canvas.height;\n            \n            if (i === 0) {\n                ctx.moveTo(x, y);\n            } else {\n                ctx.lineTo(x, y);\n            }\n        }\n        ctx.stroke();\n        \n        // Draw labels\n        ctx.fillStyle = '#ffffff';\n        ctx.font = '10px monospace';\n        ctx.fillText('FPS', 5, 15);\n        ctx.fillStyle = '#00ff00';\n        ctx.fillText('60', 5, 25);\n        ctx.fillStyle = '#ff6600';\n        ctx.fillText('Frame Time', 5, 40);\n    }\n    \n    // Debug actions\n    toggleDebugInfo() {\n        this.showDebugInfo = !this.showDebugInfo;\n        this.debugInfoPanel.style.display = this.showDebugInfo ? 'block' : 'none';\n        console.log('Debug info:', this.showDebugInfo ? 'ON' : 'OFF');\n    }\n    \n    togglePerformanceGraph() {\n        this.showPerformanceGraph = !this.showPerformanceGraph;\n        this.performanceCanvas.style.display = this.showPerformanceGraph ? 'block' : 'none';\n        console.log('Performance graph:', this.showPerformanceGraph ? 'ON' : 'OFF');\n    }\n    \n    toggleComponentInspector() {\n        const showing = this.componentInspector.style.display !== 'none';\n        this.componentInspector.style.display = showing ? 'none' : 'block';\n        \n        if (!showing) {\n            this.updateComponentInspector();\n        }\n        \n        console.log('Component inspector:', showing ? 'OFF' : 'ON');\n    }\n    \n    updateComponentInspector() {\n        if (!this.selectedEntity) {\n            // Find first entity with multiple components\n            const entities = this.gameEngine.query(['TransformComponent']);\n            this.selectedEntity = entities[0] || null;\n        }\n        \n        if (!this.selectedEntity) {\n            this.componentInspector.innerHTML = '<h3>No entities found</h3>';\n            return;\n        }\n        \n        let html = '<h3>🔍 Component Inspector</h3>';\n        html += `<p><strong>Entity ID:</strong> ${this.selectedEntity.id}</p>`;\n        \n        // List all components\n        for (const [componentName, component] of this.selectedEntity.components) {\n            html += `<div style=\"margin: 10px 0; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 3px;\">`;\n            html += `<strong>${componentName}</strong><br>`;\n            \n            // Show component properties\n            const serialized = component.serialize();\n            for (const [prop, value] of Object.entries(serialized)) {\n                let displayValue = value;\n                if (typeof value === 'object' && value !== null) {\n                    displayValue = JSON.stringify(value, null, 2);\n                }\n                html += `<small>${prop}: ${displayValue}</small><br>`;\n            }\n            \n            html += `</div>`;\n        }\n        \n        this.componentInspector.innerHTML = html;\n    }\n    \n    dumpWorldState() {\n        const stats = this.gameEngine.getStats();\n        const worldData = {\n            timestamp: new Date().toISOString(),\n            stats,\n            entities: []\n        };\n        \n        // Dump entity data\n        const entities = this.gameEngine.query([]);\n        for (const entity of entities.slice(0, 10)) { // Limit to first 10 entities\n            const entityData = {\n                id: entity.id,\n                active: entity.active,\n                components: {}\n            };\n            \n            for (const [componentName, component] of entity.components) {\n                entityData.components[componentName] = component.serialize();\n            }\n            \n            worldData.entities.push(entityData);\n        }\n        \n        console.log('🌍 World State Dump:', worldData);\n        \n        // Also save to localStorage for persistence\n        try {\n            localStorage.setItem('devtools-world-dump', JSON.stringify(worldData, null, 2));\n            console.log('World state saved to localStorage');\n        } catch (error) {\n            console.warn('Could not save to localStorage:', error);\n        }\n    }\n    \n    reloadCurrentDemo() {\n        console.log('🔄 Reloading current demo...');\n        location.reload();\n    }\n    \n    // Hot reload functionality (basic implementation)\n    enableHotReload() {\n        this.hotReloadEnabled = true;\n        console.log('🔥 Hot reload enabled (basic refresh-based)');\n    }\n    \n    // Entity selection for debugging\n    selectEntity(entity) {\n        this.selectedEntity = entity;\n        if (this.componentInspector.style.display !== 'none') {\n            this.updateComponentInspector();\n        }\n        console.log('Selected entity:', entity.id);\n    }\n    \n    // Performance profiling\n    startProfiling() {\n        console.time('DevTools Profiling');\n        this.profilingStartTime = performance.now();\n    }\n    \n    endProfiling() {\n        const duration = performance.now() - this.profilingStartTime;\n        console.timeEnd('DevTools Profiling');\n        console.log(`Profiling duration: ${duration.toFixed(2)}ms`);\n        return duration;\n    }\n    \n    // Settings\n    setEnabled(enabled) {\n        this.enabled = enabled;\n        this.debugContainer.style.display = enabled ? 'block' : 'none';\n    }\n    \n    // Cleanup\n    destroy() {\n        if (this.debugContainer && this.debugContainer.parentNode) {\n            this.debugContainer.parentNode.removeChild(this.debugContainer);\n        }\n        this.performanceHistory = [];\n        console.log('DevTools destroyed');\n    }\n}