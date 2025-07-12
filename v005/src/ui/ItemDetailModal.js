
export class ItemDetailModal {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.isVisible = false;
    this.init();
  }

  init() {
    const modalContent = document.createElement('div');
    modalContent.style.display = 'flex';
    modalContent.style.flexDirection = 'column';
    modalContent.style.gap = 'var(--space-3)';

    this.itemName = document.createElement('h3');
    modalContent.appendChild(this.itemName);

    this.itemIcon = document.createElement('img');
    this.itemIcon.style.width = '64px';
    this.itemIcon.style.height = '64px';
    modalContent.appendChild(this.itemIcon);

    this.itemDescription = document.createElement('p');
    modalContent.appendChild(this.itemDescription);

    const useButton = window.UI.button('Use', { variant: 'success' });
    useButton.addEventListener('click', () => {
      console.log('Item used!');
      this.hide();
    });

    const closeButton = window.UI.button('Close', { variant: 'neutral' });
    closeButton.addEventListener('click', () => this.hide());

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = 'var(--space-2)';
    buttonContainer.appendChild(useButton);
    buttonContainer.appendChild(closeButton);
    modalContent.appendChild(buttonContainer);

    // Create a panel instead of modal for persistent display
    this.element = window.UI.panel('Item Details', modalContent, {
      icon: 'package'
    });
    this.element.style.position = 'absolute';
    this.element.style.top = '50%';
    this.element.style.left = '50%';
    this.element.style.transform = 'translate(-50%, -50%)';
    this.element.style.zIndex = '1000';
    this.element.style.minWidth = '300px';
    this.element.style.display = 'none'; // Initially hidden

    this.container.appendChild(this.element);
  }

  show(item) {
    this.itemName.textContent = item.name;
    this.itemIcon.src = item.icon;
    this.itemDescription.textContent = item.description || 'No description available.';
    this.isVisible = true;
    this.element.style.display = 'block';
  }

  hide() {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
