// js/toast.js
// Global toast notification system — replaces all native alert() calls

/**
 * showToast(message, type, duration)
 * @param {string} message - The message to display
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration - Auto-dismiss after ms (default 3500)
 */
export const showToast = function(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '💬'}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// Keep it globally available for legacy window.alert replacements
window.showToast = showToast;

