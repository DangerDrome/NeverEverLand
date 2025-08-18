export class CustomColorPicker {
    private element: HTMLElement | null = null;
    private currentColor: string;
    private onChangeCallback: ((color: string) => void) | null = null;
    private hue: number = 0;
    private saturation: number = 100;
    private value: number = 50;
    
    constructor(initialColor: string) {
        this.currentColor = initialColor;
        this.hexToHsv(initialColor);
    }
    
    show(anchorElement: HTMLElement, onChange: (color: string) => void): void {
        this.onChangeCallback = onChange;
        
        // Remove any existing picker
        this.hide();
        
        // Create picker element
        this.createElement();
        
        // Position above anchor element
        const rect = anchorElement.getBoundingClientRect();
        const pickerWidth = 240;
        const pickerHeight = 280;
        
        let left = rect.left + rect.width / 2 - pickerWidth / 2;
        let top = rect.top - pickerHeight - 10;
        
        // Adjust if off screen
        if (left < 10) left = 10;
        if (left + pickerWidth > window.innerWidth - 10) {
            left = window.innerWidth - pickerWidth - 10;
        }
        if (top < 10) {
            top = rect.bottom + 10; // Show below if no room above
        }
        
        this.element!.style.left = `${left}px`;
        this.element!.style.top = `${top}px`;
        this.element!.style.display = 'block';
        
        // Add click outside listener
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
    }
    
    hide(): void {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
            this.element = null;
        }
        document.removeEventListener('click', this.handleClickOutside);
    }
    
    private createElement(): void {
        this.element = document.createElement('div');
        this.element.className = 'custom-color-picker';
        this.element.style.cssText = `
            position: fixed;
            width: 240px;
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            padding: 16px;
            z-index: 10002;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        // Create color area (saturation/value picker)
        const colorArea = document.createElement('div');
        colorArea.style.cssText = `
            width: 100%;
            height: 150px;
            border-radius: 4px;
            position: relative;
            cursor: crosshair;
            margin-bottom: 12px;
            background: linear-gradient(to bottom, transparent, black),
                        linear-gradient(to right, white, hsl(${this.hue}, 100%, 50%));
        `;
        
        // Create color area cursor
        const colorCursor = document.createElement('div');
        colorCursor.style.cssText = `
            position: absolute;
            width: 12px;
            height: 12px;
            border: 2px solid white;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
        `;
        colorArea.appendChild(colorCursor);
        
        // Position cursor based on current saturation/value
        this.updateColorCursor(colorCursor, colorArea);
        
        // Color area interaction
        colorArea.addEventListener('mousedown', (e) => {
            const handleMove = (event: MouseEvent) => {
                const rect = colorArea.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
                const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
                
                this.saturation = (x / rect.width) * 100;
                this.value = 100 - (y / rect.height) * 100;
                
                colorCursor.style.left = `${x}px`;
                colorCursor.style.top = `${y}px`;
                
                this.updateColor();
            };
            
            handleMove(e);
            
            const handleUp = () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleUp);
            };
            
            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleUp);
        });
        
        // Create hue slider
        const hueSlider = document.createElement('div');
        hueSlider.style.cssText = `
            width: 100%;
            height: 20px;
            border-radius: 10px;
            position: relative;
            cursor: pointer;
            margin-bottom: 12px;
            background: linear-gradient(to right, 
                hsl(0, 100%, 50%), 
                hsl(60, 100%, 50%), 
                hsl(120, 100%, 50%), 
                hsl(180, 100%, 50%), 
                hsl(240, 100%, 50%), 
                hsl(300, 100%, 50%), 
                hsl(360, 100%, 50%));
        `;
        
        // Create hue cursor
        const hueCursor = document.createElement('div');
        hueCursor.style.cssText = `
            position: absolute;
            width: 24px;
            height: 24px;
            border: 2px solid white;
            border-radius: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
            background: hsl(${this.hue}, 100%, 50%);
        `;
        hueSlider.appendChild(hueCursor);
        
        // Position hue cursor
        hueCursor.style.left = `${(this.hue / 360) * 100}%`;
        
        // Hue slider interaction
        hueSlider.addEventListener('mousedown', (e) => {
            const handleMove = (event: MouseEvent) => {
                const rect = hueSlider.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
                
                this.hue = (x / rect.width) * 360;
                hueCursor.style.left = `${x}px`;
                hueCursor.style.background = `hsl(${this.hue}, 100%, 50%)`;
                
                // Update color area background
                colorArea.style.background = `
                    linear-gradient(to bottom, transparent, black),
                    linear-gradient(to right, white, hsl(${this.hue}, 100%, 50%))
                `;
                
                this.updateColor();
            };
            
            handleMove(e);
            
            const handleUp = () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleUp);
            };
            
            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleUp);
        });
        
        // Create hex input
        const hexContainer = document.createElement('div');
        hexContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        `;
        
        const hexLabel = document.createElement('label');
        hexLabel.textContent = 'HEX:';
        hexLabel.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            font-weight: 500;
        `;
        
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.value = this.currentColor;
        hexInput.style.cssText = `
            flex: 1;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            padding: 6px 8px;
            color: rgba(255, 255, 255, 0.9);
            font-size: 12px;
            font-family: monospace;
            text-transform: uppercase;
        `;
        
        hexInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                this.currentColor = value;
                this.hexToHsv(value);
                this.updateColorCursor(colorCursor, colorArea);
                hueCursor.style.left = `${(this.hue / 360) * 100}%`;
                hueCursor.style.background = `hsl(${this.hue}, 100%, 50%)`;
                colorArea.style.background = `
                    linear-gradient(to bottom, transparent, black),
                    linear-gradient(to right, white, hsl(${this.hue}, 100%, 50%))
                `;
                if (this.onChangeCallback) {
                    this.onChangeCallback(this.currentColor);
                }
            }
        });
        
        hexContainer.appendChild(hexLabel);
        hexContainer.appendChild(hexInput);
        
        // Create preview
        const preview = document.createElement('div');
        preview.style.cssText = `
            width: 100%;
            height: 40px;
            border-radius: 4px;
            background: ${this.currentColor};
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        // Store references for updates
        (this.element as any).hexInput = hexInput;
        (this.element as any).preview = preview;
        
        // Assemble picker
        this.element.appendChild(colorArea);
        this.element.appendChild(hueSlider);
        this.element.appendChild(hexContainer);
        this.element.appendChild(preview);
        
        document.body.appendChild(this.element);
    }
    
    private updateColorCursor(cursor: HTMLElement, area: HTMLElement): void {
        const rect = area.getBoundingClientRect();
        const x = (this.saturation / 100) * rect.width;
        const y = ((100 - this.value) / 100) * rect.height;
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
    }
    
    private updateColor(): void {
        this.currentColor = this.hsvToHex(this.hue, this.saturation, this.value);
        
        if (this.element) {
            const hexInput = (this.element as any).hexInput;
            const preview = (this.element as any).preview;
            
            if (hexInput) hexInput.value = this.currentColor;
            if (preview) preview.style.background = this.currentColor;
        }
        
        if (this.onChangeCallback) {
            this.onChangeCallback(this.currentColor);
        }
    }
    
    private hexToHsv(hex: string): void {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        // Hue
        if (delta === 0) {
            this.hue = 0;
        } else if (max === r) {
            this.hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
        } else if (max === g) {
            this.hue = ((b - r) / delta + 2) * 60;
        } else {
            this.hue = ((r - g) / delta + 4) * 60;
        }
        
        // Saturation
        this.saturation = max === 0 ? 0 : (delta / max) * 100;
        
        // Value
        this.value = max * 100;
    }
    
    private hsvToHex(h: number, s: number, v: number): string {
        const c = (v / 100) * (s / 100);
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v / 100 - c;
        
        let r = 0, g = 0, b = 0;
        
        if (h >= 0 && h < 60) {
            r = c; g = x; b = 0;
        } else if (h >= 60 && h < 120) {
            r = x; g = c; b = 0;
        } else if (h >= 120 && h < 180) {
            r = 0; g = c; b = x;
        } else if (h >= 180 && h < 240) {
            r = 0; g = x; b = c;
        } else if (h >= 240 && h < 300) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }
        
        const toHex = (n: number) => {
            const hex = Math.round((n + m) * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }
    
    private handleClickOutside = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        if (this.element && !this.element.contains(target)) {
            this.hide();
        }
    };
}