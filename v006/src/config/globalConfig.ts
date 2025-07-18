/**
 * Global configuration settings for the application
 */
export interface GlobalConfig {
  // UI Settings
  disableTextSelection: boolean;
  darkTheme: boolean;
  
  // Performance Settings
  shadowMapSize: number;
  ambientOcclusionEnabled: boolean;
  postProcessingEnabled: boolean;
  
  // Editor Settings
  gridSnapping: boolean;
  showGrid: boolean;
  showCoordinates: boolean;
  
  // Debug Settings
  showDebugPanel: boolean;
  showFPS: boolean;
  verboseLogging: boolean;
}

/**
 * Default global configuration
 */
export const defaultGlobalConfig: GlobalConfig = {
  // UI Settings
  disableTextSelection: true,
  darkTheme: true,
  
  // Performance Settings
  shadowMapSize: 1024,
  ambientOcclusionEnabled: false,
  postProcessingEnabled: true,
  
  // Editor Settings
  gridSnapping: true,
  showGrid: true,
  showCoordinates: true,
  
  // Debug Settings
  showDebugPanel: false,
  showFPS: true,
  verboseLogging: false,
};

/**
 * Global config manager
 */
export class GlobalConfigManager {
  private static instance: GlobalConfigManager;
  private config: GlobalConfig;
  
  private constructor() {
    // Load config from localStorage if available
    const savedConfig = localStorage.getItem('v006-global-config');
    if (savedConfig) {
      try {
        this.config = { ...defaultGlobalConfig, ...JSON.parse(savedConfig) };
      } catch {
        this.config = { ...defaultGlobalConfig };
      }
    } else {
      this.config = { ...defaultGlobalConfig };
    }
    
    // Apply initial settings
    this.applySettings();
  }
  
  static getInstance(): GlobalConfigManager {
    if (!GlobalConfigManager.instance) {
      GlobalConfigManager.instance = new GlobalConfigManager();
    }
    return GlobalConfigManager.instance;
  }
  
  getConfig(): GlobalConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<GlobalConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.applySettings();
  }
  
  private saveConfig(): void {
    localStorage.setItem('v006-global-config', JSON.stringify(this.config));
  }
  
  private applySettings(): void {
    // Apply text selection setting
    if (this.config.disableTextSelection) {
      document.body.classList.add('no-select');
    } else {
      document.body.classList.remove('no-select');
    }
    
    // Apply theme
    if (this.config.darkTheme) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    
    // Dispatch event for other systems to respond to config changes
    window.dispatchEvent(new CustomEvent('globalConfigChanged', { 
      detail: this.config 
    }));
  }
  
  // Convenience methods
  toggleTextSelection(): void {
    this.updateConfig({ disableTextSelection: !this.config.disableTextSelection });
  }
  
  toggleDarkTheme(): void {
    this.updateConfig({ darkTheme: !this.config.darkTheme });
  }
  
  toggleDebugPanel(): void {
    this.updateConfig({ showDebugPanel: !this.config.showDebugPanel });
  }
}

// Export singleton instance
export const globalConfig = GlobalConfigManager.getInstance();