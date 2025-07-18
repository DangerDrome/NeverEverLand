import { TileEditor } from '@core/TileEditor';

// Wait for StyleUI to be ready
declare global {
  interface Window {
    UI: any;
    lucide: any;
  }
}

// Initialize the application
function init(): void {
  // Ensure dark theme is applied
  document.body.classList.add('dark');
  
  // Get container element
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container not found');
  }

  // Create tile editor instance
  const editor = new TileEditor(container);

  // Make editor globally accessible for debugging
  (window as any).editor = editor;

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