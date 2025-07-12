
export class ManaBar {
  constructor(container) {
    this.container = container;
    this.currentMana = 50;
    this.maxMana = 50;
    this.init();
  }

  init() {
    // Create wrapper for progress bar and text
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'progress-wrapper';
    
    // Create progress bar
    this.element = document.createElement('div');
    this.element.className = 'progress';
    this.element.innerHTML = `
      <div class="progress-bar progress-bar-info progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="${this.currentMana}" aria-valuemin="0" aria-valuemax="${this.maxMana}"></div>
    `;
    
    // Create text element as a tag
    this.textElement = document.createElement('span');
    this.textElement.className = 'tag tag-info';
    this.textElement.style.fontWeight = 'var(--font-bold)';
    this.textElement.textContent = `${Math.floor(this.currentMana)}/${this.maxMana}`;
    
    // Assemble wrapper
    this.wrapper.appendChild(this.element);
    this.wrapper.appendChild(this.textElement);
    this.container.appendChild(this.wrapper);
    
    this.fillElement = this.element.querySelector('.progress-bar');
    this.updateMana(this.currentMana);
  }

  updateMana(newMana) {
    this.currentMana = Math.max(0, Math.min(newMana, this.maxMana));
    const targetWidth = (this.currentMana / this.maxMana) * 100;
    this.fillElement.style.width = `${targetWidth}%`;
    this.textElement.textContent = `${Math.floor(this.currentMana)}/${this.maxMana}`;
  }

  destroy() {
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}
