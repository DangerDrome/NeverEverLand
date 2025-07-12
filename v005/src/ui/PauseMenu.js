
export class PauseMenu {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.isVisible = false;
    this.init();
  }

  init() {
    // Create the panel using StyleUI's UI.panel factory
    const menuContent = document.createElement('div');
    menuContent.style.display = 'flex';
    menuContent.style.flexDirection = 'column';
    menuContent.style.gap = 'var(--space-3)';

    const resumeButton = window.UI.button('Resume Game', { variant: 'primary', icon: 'play' });
    resumeButton.addEventListener('click', () => this.hide());

    const optionsButton = window.UI.button('Options', { variant: 'neutral', icon: 'settings' });
    // optionsButton.addEventListener('click', () => console.log('Options clicked'));

    const exitButton = window.UI.button('Exit Game', { variant: 'error', icon: 'log-out' });
    // exitButton.addEventListener('click', () => console.log('Exit clicked'));

    menuContent.appendChild(resumeButton);
    menuContent.appendChild(optionsButton);
    menuContent.appendChild(exitButton);

    this.element = window.UI.panel('Pause Menu', menuContent, {
      icon: 'pause',
      collapsible: false,
      size: 'lg'
    });

    this.element.style.position = 'absolute';
    this.element.style.top = '50%';
    this.element.style.left = '50%';
    this.element.style.transform = 'translate(-50%, -50%)';
    this.element.style.zIndex = '1000';
    this.element.style.display = 'none'; // Initially hidden

    this.container.appendChild(this.element);
  }

  show() {
    this.isVisible = true;
    this.element.style.display = 'block';
  }

  hide() {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
