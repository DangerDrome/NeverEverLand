import { TileEditor } from '@core/TileEditor';
import { globalConfig } from './config/globalConfig';

// Wait for StyleUI to be ready
declare global {
  interface Window {
    UI: any;
    lucide: any;
  }
}

// Initialize the application
function init(): void {
  // Initialize global config (which will apply settings)
  const config = globalConfig.getConfig();
  console.log('Global config loaded:', config);
  
  // Get container element
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container not found');
  }

  // Create tile editor instance
  const editor = new TileEditor(container);

  // Make editor and config globally accessible for debugging
  (window as any).editor = editor;
  (window as any).globalConfig = globalConfig;

  // Defer starting to ensure proper initialization
  requestAnimationFrame(() => {
    editor.start();
    console.log('NeverEverLand v006 Tile Editor initialized');
  });
}

// Wait for DOM and StyleUI to be ready
function waitForUI(): void {
  if (window.UI && window.lucide) {
    init();
  } else {
    setTimeout(waitForUI, 10);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForUI);
} else {
  waitForUI();
}