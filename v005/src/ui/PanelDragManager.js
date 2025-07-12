export class PanelDragManager {
  static makePanelDraggable(panelElement, panelId) {
    const header = panelElement.querySelector('.panel-header');
    if (!header) return;
    
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    header.style.cursor = 'move';
    header.style.userSelect = 'none';
    
    const loadPosition = () => {
      const savedPosition = localStorage.getItem(`panel-position-${panelId}`);
      if (savedPosition) {
        const { top, left, right, bottom } = JSON.parse(savedPosition);
        
        // Use saved position, but validate it's still on screen
        const maxX = window.innerWidth - panelElement.offsetWidth;
        const maxY = window.innerHeight - panelElement.offsetHeight;
        
        if (left !== undefined && left >= 0 && left <= maxX) {
          panelElement.style.left = left + 'px';
          panelElement.style.right = 'auto';
        } else if (right !== undefined && right >= 0 && right <= maxX) {
          panelElement.style.right = right + 'px';
          panelElement.style.left = 'auto';
        }
        
        if (top !== undefined && top >= 0 && top <= maxY) {
          panelElement.style.top = top + 'px';
          panelElement.style.bottom = 'auto';
        } else if (bottom !== undefined && bottom >= 0 && bottom <= maxY) {
          panelElement.style.bottom = bottom + 'px';
          panelElement.style.top = 'auto';
        }
      }
    };
    
    const savePosition = () => {
      const rect = panelElement.getBoundingClientRect();
      const position = {
        top: rect.top,
        left: rect.left,
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.bottom
      };
      localStorage.setItem(`panel-position-${panelId}`, JSON.stringify(position));
    };
    
    const onMouseDown = (e) => {
      // Don't drag if clicking on buttons
      if (e.target.closest('.panel-action-btn') || e.target.closest('.panel-toggle')) {
        return;
      }
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = panelElement.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      // Switch to left/top positioning for dragging
      panelElement.style.left = startLeft + 'px';
      panelElement.style.top = startTop + 'px';
      panelElement.style.right = 'auto';
      panelElement.style.bottom = 'auto';
      panelElement.style.transform = 'none'; // Clear any transform
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      
      e.preventDefault();
    };
    
    const onMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;
      
      // Constrain to window bounds
      const maxLeft = window.innerWidth - panelElement.offsetWidth;
      const maxTop = window.innerHeight - panelElement.offsetHeight;
      
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      
      panelElement.style.left = newLeft + 'px';
      panelElement.style.top = newTop + 'px';
    };
    
    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        savePosition();
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
    };
    
    header.addEventListener('mousedown', onMouseDown);
    
    // Load saved position on init
    loadPosition();
  }
}