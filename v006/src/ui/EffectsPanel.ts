import { TileEditor } from '@core/TileEditor';

/**
 * Effects panel for controlling post-processing effects
 */
export class EffectsPanel {
  private container: HTMLElement;
  private editor: TileEditor;
  private element: HTMLElement | null = null;
  
  // UI elements
  private tiltShiftButton: HTMLElement | null = null;
  private blurSlider: HTMLElement | null = null;
  private blurValueDisplay: HTMLElement | null = null;
  
  // New effect UI elements
  private gammaButton: HTMLElement | null = null;
  private gammaSlider: HTMLElement | null = null;
  private gammaValueDisplay: HTMLElement | null = null;
  private bloomButton: HTMLElement | null = null;
  private bloomSlider: HTMLElement | null = null;
  private bloomValueDisplay: HTMLElement | null = null;
  
  // State
  private tiltShiftEnabled: boolean = false;
  private currentBlurStrength: number = 2.0;
  
  // New effect state
  private gammaEnabled: boolean = false;
  private currentGamma: number = 1.0;
  private bloomEnabled: boolean = false;
  private currentBloomStrength: number = 1.5;
  
  private tooltipsToCreate: Array<{element: HTMLElement, content: string}> = [];

  constructor(container: HTMLElement, editor: TileEditor) {
    this.container = container;
    this.editor = editor;
    this.init();
  }
  
  private init(): void {
    // Ensure dark theme is applied
    if (!document.body.classList.contains('dark')) {
      document.body.classList.add('dark');
    }

    // Add custom slider styling that follows StyleUI design system
    this.addSliderStyling();

    const content = this.createContent();
    
    // Create the panel using StyleUI
    this.element = (window as any).UI.panel('FX', content, {
      icon: 'camera',
      collapsible: false,
      closable: true,
      draggable: true,
      resizable: false,
      startCollapsed: false,
    });

    if (this.element) {
      this.element.className += ' effects-panel';
      
      // Add consistent icon styling
      const titleElement = this.element.querySelector('.panel-title');
      if (titleElement) {
        const iconHTML = '<i data-lucide="camera" style="width: 20px; height: 20px; margin-right: 8px; stroke-width: 1px;"></i>';
        titleElement.innerHTML = iconHTML + titleElement.textContent;
        // Remove bold font weight from panel title and make text dim
        (titleElement as HTMLElement).style.fontWeight = 'normal';
        (titleElement as HTMLElement).style.color = 'var(--text-secondary)';
      }
      
      // Position in left middle
      this.element.style.position = 'fixed';
      this.element.style.left = '20px';
      this.element.style.width = '280px';
      this.element.style.zIndex = '1000';
      
      // Calculate center position without transform to avoid drag conflicts
      setTimeout(() => {
        this.centerVertically();
      }, 50);
      
      // Recenter on window resize
      window.addEventListener('resize', () => this.centerVertically());
      
      this.container.appendChild(this.element);
      
      // Initialize lucide icons
      if ((window as any).lucide) {
        (window as any).lucide.createIcons();
      }
      
      // Apply icon styling after Lucide processes icons
      setTimeout(() => {
        this.applyIconStyling();
        this.createTooltips();
      }, 100);
    }
  }

  private addSliderStyling(): void {
    // Add custom slider CSS that follows StyleUI design system
    if (!document.getElementById('effects-slider-styles')) {
      const style = document.createElement('style');
      style.id = 'effects-slider-styles';
      style.textContent = `
        /* Effects Panel Slider Styling using StyleUI Design System */
        .effects-panel .form-input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) var(--progress, 50%), var(--bg-layer-4) var(--progress, 50%), var(--bg-layer-4) 100%);
          border: none;
          outline: none;
          border-radius: var(--radius-full);
          height: 8px;
          padding: 0;
          cursor: pointer;
          transition: background var(--transition-fast);
        }

        .effects-panel .form-input[type="range"]:focus {
          outline: none;
          border: none;
        }

        /* WebKit Slider Track */
        .effects-panel .form-input[type="range"]::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: var(--radius-full);
          background: transparent;
          border: none;
          outline: none;
        }

        /* WebKit Slider Thumb */
        .effects-panel .form-input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: var(--radius-full);
          background: var(--color-primary);
          border: none;
          outline: none;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: all var(--transition-fast);
          margin-top: -5px;
        }

        .effects-panel .form-input[type="range"]::-webkit-slider-thumb:hover {
          background: var(--color-primary-hover);
          transform: scale(1.15);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .effects-panel .form-input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(1.0);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        }

        /* Firefox Slider Track */
        .effects-panel .form-input[type="range"]::-moz-range-track {
          background: var(--bg-layer-4);
          border: none;
          outline: none;
          border-radius: var(--radius-full);
          height: 8px;
        }

        /* Firefox Slider Progress */
        .effects-panel .form-input[type="range"]::-moz-range-progress {
          background: var(--color-primary);
          border: none;
          outline: none;
          border-radius: var(--radius-full);
          height: 8px;
        }

        /* Firefox Slider Thumb */
        .effects-panel .form-input[type="range"]::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: var(--radius-full);
          background: var(--color-primary);
          border: none;
          outline: none;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: all var(--transition-fast);
        }

        .effects-panel .form-input[type="range"]::-moz-range-thumb:hover {
          background: var(--color-primary-hover);
          transform: scale(1.15);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .effects-panel .form-input[type="range"]::-moz-range-thumb:active {
          transform: scale(1.0);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        }

        /* Disable default Firefox focus outline */
        .effects-panel .form-input[type="range"]::-moz-focus-outer {
          border: 0;
          outline: none;
        }
        
        /* Disable all focus outlines */
        .effects-panel .form-input[type="range"]:focus-visible {
          outline: none;
          border: none;
        }
        
        /* Darker background for effect toggle buttons when off */
        .effects-panel .btn-secondary {
          background-color: var(--bg-layer-4) !important;
          border-color: var(--bg-layer-4) !important;
        }
        
        .effects-panel .btn-secondary:hover:not(:disabled) {
          background-color: var(--bg-layer-3) !important;
          border-color: var(--bg-layer-3) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private updateSliderProgress(slider: HTMLInputElement): void {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const value = parseFloat(slider.value);
    const progress = ((value - min) / (max - min)) * 100;
    
    // Update CSS custom property for progress fill
    slider.style.setProperty('--progress', `${progress}%`);
  }

  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.style.padding = 'var(--space-3)';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = 'var(--space-3)';
    content.style.fontSize = 'var(--font-size-sm)';

    // Tilt-Shift section
    const tiltShiftSection = this.createTiltShiftSection();
    content.appendChild(tiltShiftSection);
    
    // Gamma section
    const gammaSection = this.createGammaSection();
    content.appendChild(gammaSection);
    
    // Bloom section
    const bloomSection = this.createBloomSection();
    content.appendChild(bloomSection);

    return content;
  }

  private createTiltShiftSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.gap = 'var(--space-3)';

    // Title and toggle row
    const titleRow = document.createElement('div');
    titleRow.style.display = 'flex';
    titleRow.style.alignItems = 'center';
    titleRow.style.gap = 'var(--space-3)';
    titleRow.style.justifyContent = 'flex-start';

    // Toggle button using StyleUI pattern
    const toggleConfig = {
      variant: this.tiltShiftEnabled ? 'primary' : 'secondary',
      size: 'md',
      icon: 'focus',
      className: 'tilt-shift-toggle',
      onClick: () => this.toggleTiltShift()
    };

    const toggleComponent = (window as any).UI.button(toggleConfig);
    this.tiltShiftButton = toggleComponent.element;
    this.tiltShiftButton.style.flexShrink = '0';
    
    // Force button size to match TilePalette
    this.tiltShiftButton.style.setProperty('width', '40px', 'important');
    this.tiltShiftButton.style.setProperty('height', '40px', 'important');
    this.tiltShiftButton.style.setProperty('min-width', '40px', 'important');
    this.tiltShiftButton.style.setProperty('padding', '0', 'important');
    this.tiltShiftButton.style.setProperty('position', 'relative', 'important');
    
    // Force icon size and positioning
    const toggleIcon = this.tiltShiftButton.querySelector('svg, i[data-lucide]');
    if (toggleIcon) {
      (toggleIcon as HTMLElement).style.setProperty('position', 'absolute', 'important');
      (toggleIcon as HTMLElement).style.setProperty('top', '50%', 'important');
      (toggleIcon as HTMLElement).style.setProperty('left', '50%', 'important');
      (toggleIcon as HTMLElement).style.setProperty('transform', 'translate(-50%, -50%)', 'important');
      (toggleIcon as HTMLElement).style.setProperty('width', '24px', 'important');
      (toggleIcon as HTMLElement).style.setProperty('height', '24px', 'important');
      (toggleIcon as HTMLElement).style.setProperty('stroke-width', '1.5px', 'important');
    }
    
    titleRow.appendChild(this.tiltShiftButton);

    const title = document.createElement('h5');
    title.textContent = 'Tilt-Shift';
    title.style.margin = '0';
    title.style.color = 'var(--text-primary)';
    title.style.fontSize = 'var(--font-size-sm)';
    title.style.fontWeight = '600';
    titleRow.appendChild(title);
    
    this.tooltipsToCreate.push({ 
      element: this.tiltShiftButton, 
      content: 'Toggle tilt-shift effect' 
    });

    section.appendChild(titleRow);

    // Blur strength control
    const blurSection = document.createElement('div');
    blurSection.style.display = 'flex';
    blurSection.style.flexDirection = 'column';
    blurSection.style.gap = 'var(--space-2)';

    const blurLabelRow = document.createElement('div');
    blurLabelRow.style.display = 'flex';
    blurLabelRow.style.alignItems = 'center';
    blurLabelRow.style.justifyContent = 'space-between';

    const blurLabel = document.createElement('div');
    blurLabel.textContent = 'Blur Strength:';
    blurLabel.style.fontSize = 'var(--font-size-xs)';
    blurLabel.style.color = 'var(--text-secondary)';
    blurLabel.style.fontWeight = '500';
    blurLabelRow.appendChild(blurLabel);

    // Blur value display
    this.blurValueDisplay = document.createElement('span');
    this.blurValueDisplay.textContent = this.currentBlurStrength.toFixed(1);
    this.blurValueDisplay.style.fontSize = 'var(--font-size-xs)';
    this.blurValueDisplay.style.color = 'var(--text-primary)';
    this.blurValueDisplay.style.fontFamily = 'var(--font-mono)';
    this.blurValueDisplay.style.fontWeight = '600';
    blurLabelRow.appendChild(this.blurValueDisplay);

    blurSection.appendChild(blurLabelRow);

    // Blur slider
    this.blurSlider = document.createElement('input');
    this.blurSlider.setAttribute('type', 'range');
    this.blurSlider.setAttribute('min', '0.5');
    this.blurSlider.setAttribute('max', '10.0');  // Doubled the range
    this.blurSlider.setAttribute('step', '0.1');
    this.blurSlider.setAttribute('value', this.currentBlurStrength.toString());
    this.blurSlider.className = 'form-input';  // Use StyleUI form input class
    this.blurSlider.style.width = '100%';
    this.blurSlider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.setBlurStrength(value);
      this.updateSliderProgress(this.blurSlider as HTMLInputElement);
    });
    // Set initial progress
    this.updateSliderProgress(this.blurSlider as HTMLInputElement);
    blurSection.appendChild(this.blurSlider);

    section.appendChild(blurSection);

    return section;
  }

  private createGammaSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.gap = 'var(--space-3)';

    // Title and toggle row
    const titleRow = document.createElement('div');
    titleRow.style.display = 'flex';
    titleRow.style.alignItems = 'center';
    titleRow.style.gap = 'var(--space-3)';
    titleRow.style.justifyContent = 'flex-start';

    // Toggle button
    const toggleConfig = {
      variant: this.gammaEnabled ? 'primary' : 'secondary',
      size: 'md',
      icon: 'contrast',
      className: 'gamma-toggle',
      onClick: () => this.toggleGamma()
    };

    const toggleComponent = (window as any).UI.button(toggleConfig);
    this.gammaButton = toggleComponent.element;
    this.gammaButton.style.flexShrink = '0';
    
    // Force button size to match TilePalette
    this.gammaButton.style.setProperty('width', '40px', 'important');
    this.gammaButton.style.setProperty('height', '40px', 'important');
    this.gammaButton.style.setProperty('min-width', '40px', 'important');
    this.gammaButton.style.setProperty('padding', '0', 'important');
    this.gammaButton.style.setProperty('position', 'relative', 'important');
    
    titleRow.appendChild(this.gammaButton);

    const title = document.createElement('h5');
    title.textContent = 'Gamma Correction';
    title.style.margin = '0';
    title.style.color = 'var(--text-primary)';
    title.style.fontSize = 'var(--font-size-sm)';
    title.style.fontWeight = '600';
    titleRow.appendChild(title);
    
    this.tooltipsToCreate.push({ 
      element: this.gammaButton, 
      content: 'Toggle gamma correction' 
    });

    section.appendChild(titleRow);

    // Gamma control
    const gammaSection = document.createElement('div');
    gammaSection.style.display = 'flex';
    gammaSection.style.flexDirection = 'column';
    gammaSection.style.gap = 'var(--space-2)';

    const gammaLabelRow = document.createElement('div');
    gammaLabelRow.style.display = 'flex';
    gammaLabelRow.style.alignItems = 'center';
    gammaLabelRow.style.justifyContent = 'space-between';

    const gammaLabel = document.createElement('div');
    gammaLabel.textContent = 'Gamma:';
    gammaLabel.style.fontSize = 'var(--font-size-xs)';
    gammaLabel.style.color = 'var(--text-secondary)';
    gammaLabel.style.fontWeight = '500';
    gammaLabelRow.appendChild(gammaLabel);

    // Gamma value display
    this.gammaValueDisplay = document.createElement('span');
    this.gammaValueDisplay.textContent = this.currentGamma.toFixed(1);
    this.gammaValueDisplay.style.fontSize = 'var(--font-size-xs)';
    this.gammaValueDisplay.style.color = 'var(--text-primary)';
    this.gammaValueDisplay.style.fontFamily = 'var(--font-mono)';
    this.gammaValueDisplay.style.fontWeight = '600';
    gammaLabelRow.appendChild(this.gammaValueDisplay);

    gammaSection.appendChild(gammaLabelRow);

    // Gamma slider
    this.gammaSlider = document.createElement('input');
    this.gammaSlider.setAttribute('type', 'range');
    this.gammaSlider.setAttribute('min', '0.1');
    this.gammaSlider.setAttribute('max', '3.0');
    this.gammaSlider.setAttribute('step', '0.1');
    this.gammaSlider.setAttribute('value', this.currentGamma.toString());
    this.gammaSlider.className = 'form-input';  // Use StyleUI form input class
    this.gammaSlider.style.width = '100%';
    this.gammaSlider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.setGamma(value);
      this.updateSliderProgress(this.gammaSlider as HTMLInputElement);
    });
    // Set initial progress
    this.updateSliderProgress(this.gammaSlider as HTMLInputElement);
    gammaSection.appendChild(this.gammaSlider);

    section.appendChild(gammaSection);

    return section;
  }

  private createBloomSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.gap = 'var(--space-3)';

    // Title and toggle row
    const titleRow = document.createElement('div');
    titleRow.style.display = 'flex';
    titleRow.style.alignItems = 'center';
    titleRow.style.gap = 'var(--space-3)';
    titleRow.style.justifyContent = 'flex-start';

    // Toggle button
    const toggleConfig = {
      variant: this.bloomEnabled ? 'primary' : 'secondary',
      size: 'md',
      icon: 'sun',
      className: 'bloom-toggle',
      onClick: () => this.toggleBloom()
    };

    const toggleComponent = (window as any).UI.button(toggleConfig);
    this.bloomButton = toggleComponent.element;
    this.bloomButton.style.flexShrink = '0';
    
    // Force button size to match TilePalette
    this.bloomButton.style.setProperty('width', '40px', 'important');
    this.bloomButton.style.setProperty('height', '40px', 'important');
    this.bloomButton.style.setProperty('min-width', '40px', 'important');
    this.bloomButton.style.setProperty('padding', '0', 'important');
    this.bloomButton.style.setProperty('position', 'relative', 'important');
    
    titleRow.appendChild(this.bloomButton);

    const title = document.createElement('h5');
    title.textContent = 'Bloom';
    title.style.margin = '0';
    title.style.color = 'var(--text-primary)';
    title.style.fontSize = 'var(--font-size-sm)';
    title.style.fontWeight = '600';
    titleRow.appendChild(title);
    
    this.tooltipsToCreate.push({ 
      element: this.bloomButton, 
      content: 'Toggle bloom effect' 
    });

    section.appendChild(titleRow);

    // Bloom control
    const bloomSection = document.createElement('div');
    bloomSection.style.display = 'flex';
    bloomSection.style.flexDirection = 'column';
    bloomSection.style.gap = 'var(--space-2)';

    const bloomLabelRow = document.createElement('div');
    bloomLabelRow.style.display = 'flex';
    bloomLabelRow.style.alignItems = 'center';
    bloomLabelRow.style.justifyContent = 'space-between';

    const bloomLabel = document.createElement('div');
    bloomLabel.textContent = 'Intensity:';
    bloomLabel.style.fontSize = 'var(--font-size-xs)';
    bloomLabel.style.color = 'var(--text-secondary)';
    bloomLabel.style.fontWeight = '500';
    bloomLabelRow.appendChild(bloomLabel);

    // Bloom value display
    this.bloomValueDisplay = document.createElement('span');
    this.bloomValueDisplay.textContent = this.currentBloomStrength.toFixed(1);
    this.bloomValueDisplay.style.fontSize = 'var(--font-size-xs)';
    this.bloomValueDisplay.style.color = 'var(--text-primary)';
    this.bloomValueDisplay.style.fontFamily = 'var(--font-mono)';
    this.bloomValueDisplay.style.fontWeight = '600';
    bloomLabelRow.appendChild(this.bloomValueDisplay);

    bloomSection.appendChild(bloomLabelRow);

    // Bloom slider
    this.bloomSlider = document.createElement('input');
    this.bloomSlider.setAttribute('type', 'range');
    this.bloomSlider.setAttribute('min', '0.0');
    this.bloomSlider.setAttribute('max', '3.0');
    this.bloomSlider.setAttribute('step', '0.1');
    this.bloomSlider.setAttribute('value', this.currentBloomStrength.toString());
    this.bloomSlider.className = 'form-input';  // Use StyleUI form input class
    this.bloomSlider.style.width = '100%';
    this.bloomSlider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.setBloomIntensity(value);
      this.updateSliderProgress(this.bloomSlider as HTMLInputElement);
    });
    // Set initial progress
    this.updateSliderProgress(this.bloomSlider as HTMLInputElement);
    bloomSection.appendChild(this.bloomSlider);

    section.appendChild(bloomSection);

    return section;
  }

  private toggleTiltShift(): void {
    this.tiltShiftEnabled = !this.tiltShiftEnabled;
    this.editor.toggleTiltShift(this.tiltShiftEnabled);
    
    // When enabling tilt-shift, automatically enable gamma at 2.0 and set blur to 10
    if (this.tiltShiftEnabled) {
      // Set blur strength to 10
      this.setBlurStrength(10.0);
      if (this.blurValueDisplay) {
        this.blurValueDisplay.textContent = '10.0';
      }
      if (this.blurSlider) {
        (this.blurSlider as HTMLInputElement).value = '10.0';
        this.updateSliderProgress(this.blurSlider as HTMLInputElement);
      }
      
      // Enable gamma and set to 2.0
      if (!this.gammaEnabled) {
        this.gammaEnabled = true;
        this.editor.toggleGamma(this.gammaEnabled);
        
        if (this.gammaButton) {
          this.gammaButton.classList.add('btn-primary');
          this.gammaButton.classList.remove('btn-secondary');
        }
      }
      
      this.setGamma(2.0);
      if (this.gammaValueDisplay) {
        this.gammaValueDisplay.textContent = '2.0';
      }
      if (this.gammaSlider) {
        (this.gammaSlider as HTMLInputElement).value = '2.0';
        this.updateSliderProgress(this.gammaSlider as HTMLInputElement);
      }
    }
    
    // Update button appearance with dark background when off
    if (this.tiltShiftButton) {
      if (this.tiltShiftEnabled) {
        this.tiltShiftButton.classList.add('btn-primary');
        this.tiltShiftButton.classList.remove('btn-secondary');
      } else {
        this.tiltShiftButton.classList.remove('btn-primary');
        this.tiltShiftButton.classList.add('btn-secondary');
      }
    }
    
    console.log('Tilt-shift:', this.tiltShiftEnabled ? 'ON' : 'OFF');
  }



  private setBlurStrength(strength: number): void {
    this.currentBlurStrength = strength;
    this.editor.setTiltShiftBlur(strength);
    
    // Update display
    if (this.blurValueDisplay) {
      this.blurValueDisplay.textContent = strength.toFixed(1);
    }
    
    // Update slider progress
    if (this.blurSlider) {
      this.updateSliderProgress(this.blurSlider as HTMLInputElement);
    }
  }

  private toggleGamma(): void {
    this.gammaEnabled = !this.gammaEnabled;
    this.editor.toggleGamma(this.gammaEnabled);
    
    // Update button appearance with dark background when off
    if (this.gammaButton) {
      if (this.gammaEnabled) {
        this.gammaButton.classList.add('btn-primary');
        this.gammaButton.classList.remove('btn-secondary');
      } else {
        this.gammaButton.classList.remove('btn-primary');
        this.gammaButton.classList.add('btn-secondary');
      }
    }
    
    console.log('Gamma:', this.gammaEnabled ? 'ON' : 'OFF');
  }

  private setGamma(gamma: number): void {
    this.currentGamma = gamma;
    this.editor.setGammaExposure(gamma);
    
    // Update display
    if (this.gammaValueDisplay) {
      this.gammaValueDisplay.textContent = gamma.toFixed(1);
    }
    
    // Update slider progress
    if (this.gammaSlider) {
      this.updateSliderProgress(this.gammaSlider as HTMLInputElement);
    }
  }

  private toggleBloom(): void {
    this.bloomEnabled = !this.bloomEnabled;
    this.editor.toggleBloom(this.bloomEnabled);
    
    // Update button appearance with dark background when off
    if (this.bloomButton) {
      if (this.bloomEnabled) {
        this.bloomButton.classList.add('btn-primary');
        this.bloomButton.classList.remove('btn-secondary');
      } else {
        this.bloomButton.classList.remove('btn-primary');
        this.bloomButton.classList.add('btn-secondary');
      }
    }
    
    console.log('Bloom:', this.bloomEnabled ? 'ON' : 'OFF');
  }

  private setBloomIntensity(intensity: number): void {
    this.currentBloomStrength = intensity;
    this.editor.setBloomIntensity(intensity);
    
    // Update display
    if (this.bloomValueDisplay) {
      this.bloomValueDisplay.textContent = intensity.toFixed(1);
    }
    
    // Update slider progress
    if (this.bloomSlider) {
      this.updateSliderProgress(this.bloomSlider as HTMLInputElement);
    }
  }

  private createTooltips(): void {
    // Create tooltips using StyleUI
    this.tooltipsToCreate.forEach(({ element, content }) => {
      const tooltipConfig = {
        target: element,
        content: content,
        position: 'top'
      };
      (window as any).UI.tooltip(tooltipConfig);
    });
    
    this.tooltipsToCreate = [];
  }

  private applyIconStyling(): void {
    // Apply icon styling to all buttons after Lucide creates the icons
    const allButtons = [this.tiltShiftButton, this.gammaButton, this.bloomButton];
    
    allButtons.forEach(button => {
      if (button) {
        const icon = button.querySelector('svg, i[data-lucide]');
        if (icon) {
          (icon as HTMLElement).style.setProperty('position', 'absolute', 'important');
          (icon as HTMLElement).style.setProperty('top', '50%', 'important');
          (icon as HTMLElement).style.setProperty('left', '50%', 'important');
          (icon as HTMLElement).style.setProperty('transform', 'translate(-50%, -50%)', 'important');
          (icon as HTMLElement).style.setProperty('width', '24px', 'important');
          (icon as HTMLElement).style.setProperty('height', '24px', 'important');
          (icon as HTMLElement).style.setProperty('stroke-width', '1.5px', 'important');
        }
      }
    });
  }

  /**
   * Center the panel vertically
   */
  private centerVertically(): void {
    if (this.element) {
      const panelHeight = this.element.offsetHeight;
      const screenHeight = window.innerHeight;
      const topPos = (screenHeight - panelHeight) / 2 + 40; // Add 40px offset to move down
      this.element.style.top = `${topPos}px`;
    }
  }

  /**
   * Get the panel element
   */
  public getElement(): HTMLElement | null {
    return this.element;
  }

  /**
   * Update panel state (called from editor)
   */
  public update(): void {
    // Update any dynamic content if needed
  }

  /**
   * Dispose of the panel
   */
  public dispose(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Remove resize listener
    window.removeEventListener('resize', () => this.centerVertically());
  }
} 