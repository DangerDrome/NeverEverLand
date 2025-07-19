import { TileEditor } from '@core/TileEditor';
import { globalConfig } from './config/globalConfig';

// Import StyleUI components
import '../StyleUI/components/core.js';
import '../StyleUI/components/button.js';
import '../StyleUI/components/card.js';
import '../StyleUI/components/panel.js';
import '../StyleUI/components/form.js';
import '../StyleUI/components/menu.js';
import '../StyleUI/components/modal.js';
import '../StyleUI/components/tooltip.js';
import '../StyleUI/components/toast.js';
import '../StyleUI/init.js';

// Import CSS files
import '../StyleUI/css/variables.css';
import '../StyleUI/css/base.css';
import '../StyleUI/css/typography.css';
import '../StyleUI/css/colors.css';
import '../StyleUI/css/button.css';
import '../StyleUI/css/card.css';
import '../StyleUI/css/panel.css';
import '../StyleUI/css/forms.css';
import '../StyleUI/css/modal.css';
import '../StyleUI/css/menu.css';
import '../StyleUI/css/tag.css';
import '../StyleUI/css/spinners.css';
import '../StyleUI/css/tooltip.css';
import '../StyleUI/css/toast.css';
import '../StyleUI/css/icons.css';
import '../StyleUI/css/animations.css';
import '../StyleUI/css/ultrathin.css';
import '../StyleUI/css/mobile.css';

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