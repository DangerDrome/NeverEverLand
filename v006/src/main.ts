import { TileEditor } from './TileEditor';

// Wait for StyleUI to be ready
declare global {
  interface Window {
    UI: any;
    lucide: any;
  }
}

// Initialize the application
function init(): void {
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}