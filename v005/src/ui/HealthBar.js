
export class HealthBar {
  constructor(container) {
    this.container = container;
    this.currentHealth = 100;
    this.maxHealth = 100;
    this.animationFrame = null;
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
      <div class="progress-bar progress-bar-error progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="${this.currentHealth}" aria-valuemin="0" aria-valuemax="${this.maxHealth}"></div>
    `;
    
    // Create text element as a tag
    this.textElement = document.createElement('span');
    this.textElement.className = 'tag tag-error';
    this.textElement.style.fontWeight = 'var(--font-bold)';
    this.textElement.textContent = `${Math.floor(this.currentHealth)}/${this.maxHealth}`;
    
    // Assemble wrapper
    this.wrapper.appendChild(this.element);
    this.wrapper.appendChild(this.textElement);
    this.container.appendChild(this.wrapper);
    
    this.fillElement = this.element.querySelector('.progress-bar');
  }

  updateHealth(newHealth) {
    this.currentHealth = Math.max(0, Math.min(newHealth, this.maxHealth));
    
    // Animate health bar
    this.animateHealthChange();
  }

  animateHealthChange() {
    const targetWidth = (this.currentHealth / this.maxHealth) * 100;
    this.fillElement.style.width = `${targetWidth}%`;
    this.textElement.textContent = `${Math.floor(this.currentHealth)}/${this.maxHealth}`;
    
    // Add pulse effect for critical health
    if (this.currentHealth / this.maxHealth < 0.25) {
      this.element.classList.add('critical');
    } else {
      this.element.classList.remove('critical');
    }
  }

  destroy() {
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}
