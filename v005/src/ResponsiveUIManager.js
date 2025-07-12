
export class ResponsiveUIManager {
  constructor() {
    this.baseWidth = 1920;
    this.baseHeight = 1080;
    this.scaleFactor = 1;
    
    this.updateScale();
    window.addEventListener('resize', () => this.updateScale());
  }

  updateScale() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Calculate scale factor
    const scaleX = width / this.baseWidth;
    const scaleY = height / this.baseHeight;
    this.scaleFactor = Math.min(scaleX, scaleY);
    
    // Apply to UI root
    document.documentElement.style.setProperty('--ui-scale', this.scaleFactor);
    
    // Adjust for mobile
    if (width < 768) {
      document.body.classList.add('mobile-ui');
      this.adjustMobileLayout();
    } else {
      document.body.classList.remove('mobile-ui');
    }
  }

  adjustMobileLayout() {
    // Move UI elements for mobile
    const hotbar = document.querySelector('.hotbar');
    if (hotbar) {
      hotbar.style.bottom = '80px'; // Higher for thumb reach
    }
  }
}
