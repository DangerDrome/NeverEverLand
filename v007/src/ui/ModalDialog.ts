/**
 * Modal dialog utility for replacing browser confirm() and alert() dialogs
 */

export interface ModalOptions {
    title: string;
    message: string;
    type?: 'confirm' | 'alert' | 'error';
    confirmText?: string;
    cancelText?: string;
    confirmButtonStyle?: 'primary' | 'danger';
    onConfirm?: () => void;
    onCancel?: () => void;
}

export class ModalDialog {
    private static overlay: HTMLDivElement | null = null;
    
    private static ensureOverlay(): HTMLDivElement {
        if (!this.overlay) {
            this.overlay = document.getElementById('modal-overlay') as HTMLDivElement;
            if (!this.overlay) {
                // Create overlay if it doesn't exist
                this.overlay = document.createElement('div');
                this.overlay.id = 'modal-overlay';
                this.overlay.className = 'modal-overlay';
                document.body.appendChild(this.overlay);
            }
        }
        return this.overlay;
    }
    
    static confirm(options: ModalOptions): Promise<boolean> {
        return new Promise((resolve) => {
            const overlay = this.ensureOverlay();
            overlay.innerHTML = '';
            overlay.style.display = 'block';
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.minWidth = '400px';
            
            // Header
            const header = document.createElement('div');
            header.className = 'modal-header';
            
            const title = document.createElement('h2');
            title.className = 'modal-title';
            title.textContent = options.title || 'Confirm';
            header.appendChild(title);
            
            // Content
            const content = document.createElement('div');
            content.className = 'modal-content';
            content.style.padding = '20px';
            content.style.fontSize = '16px';
            content.textContent = options.message;
            
            // Buttons
            const buttons = document.createElement('div');
            buttons.className = 'modal-buttons';
            
            const cancelButton = document.createElement('button');
            cancelButton.className = 'modal-button modal-button-secondary';
            cancelButton.textContent = options.cancelText || 'Cancel';
            cancelButton.onclick = () => {
                this.close();
                if (options.onCancel) options.onCancel();
                resolve(false);
            };
            
            const confirmButton = document.createElement('button');
            const buttonStyle = options.confirmButtonStyle || 'primary';
            confirmButton.className = `modal-button modal-button-${buttonStyle}`;
            confirmButton.textContent = options.confirmText || 'OK';
            confirmButton.onclick = () => {
                this.close();
                if (options.onConfirm) options.onConfirm();
                resolve(true);
            };
            
            buttons.appendChild(cancelButton);
            buttons.appendChild(confirmButton);
            
            modal.appendChild(header);
            modal.appendChild(content);
            modal.appendChild(buttons);
            overlay.appendChild(modal);
            
            // Focus confirm button
            setTimeout(() => confirmButton.focus(), 0);
            
            // Close on overlay click
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    this.close();
                    resolve(false);
                }
            };
            
            // Close on Escape key
            const escapeHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    this.close();
                    resolve(false);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        });
    }
    
    static alert(options: ModalOptions | string): Promise<void> {
        return new Promise((resolve) => {
            const overlay = this.ensureOverlay();
            overlay.innerHTML = '';
            overlay.style.display = 'block';
            
            // Handle string shorthand
            const opts = typeof options === 'string' 
                ? { title: 'Alert', message: options }
                : options;
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.minWidth = '400px';
            
            // Header
            const header = document.createElement('div');
            header.className = 'modal-header';
            
            const title = document.createElement('h2');
            title.className = 'modal-title';
            title.textContent = opts.title || (opts.type === 'error' ? 'Error' : 'Alert');
            if (opts.type === 'error') {
                title.style.color = 'rgba(255, 100, 100, 0.9)';
            }
            header.appendChild(title);
            
            // Content
            const content = document.createElement('div');
            content.className = 'modal-content';
            content.style.padding = '20px';
            content.style.fontSize = '16px';
            content.textContent = opts.message;
            if (opts.type === 'error') {
                content.style.color = 'rgba(255, 150, 150, 0.9)';
            }
            
            // Buttons
            const buttons = document.createElement('div');
            buttons.className = 'modal-buttons';
            
            const okButton = document.createElement('button');
            okButton.className = 'modal-button modal-button-primary';
            okButton.textContent = 'OK';
            okButton.onclick = () => {
                this.close();
                resolve();
            };
            
            buttons.appendChild(okButton);
            
            modal.appendChild(header);
            modal.appendChild(content);
            modal.appendChild(buttons);
            overlay.appendChild(modal);
            
            // Focus OK button
            setTimeout(() => okButton.focus(), 0);
            
            // Close on overlay click
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    this.close();
                    resolve();
                }
            };
            
            // Close on Escape or Enter key
            const keyHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape' || e.key === 'Enter') {
                    this.close();
                    resolve();
                    document.removeEventListener('keydown', keyHandler);
                }
            };
            document.addEventListener('keydown', keyHandler);
        });
    }
    
    static close(): void {
        if (this.overlay) {
            this.overlay.style.display = 'none';
            this.overlay.innerHTML = '';
        }
    }
}