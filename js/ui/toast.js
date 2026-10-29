/**
 * Creates temporary, accessible toast notifications.
 */

import { byId, el } from '../dom.js';

const MAX_VISIBLE_TOASTS = 3;
const TRANSITION_FALLBACK_MS = 350;

/**
 * Displays a notification and removes it after its exit transition.
 * @param {{ message: string, type?: 'info'|'success'|'error', durationMs?: number }} options
 */
export function showToast({
  message,
  type = 'info',
  durationMs = 3500
} = {}) {
  const root = byId('toast-root');

  if (!root) {
    console.warn('Cannot show toast: #toast-root is missing.');
    return;
  }

  const validTypes = ['info', 'success', 'error'];
  const safeType = validTypes.includes(type) ? type : 'info';
  const toast = el('div', {
    className: `toast toast--${safeType}`,
    text: String(message ?? ''),
    attrs: { role: 'status' }
  });

  root.append(toast);

  /**
   * Starts the toast exit transition and removes its DOM node.
   */
  function dismissToast() {
    if (!toast.isConnected || toast.dataset.dismissing === 'true') return;

    toast.dataset.dismissing = 'true';
    toast.classList.remove('is-visible');

    let removed = false;

    const removeToast = () => {
      if (removed) return;
      removed = true;
      clearTimeout(fallbackTimer);
      toast.removeEventListener('transitionend', handleTransitionEnd);

      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    };

    const handleTransitionEnd = (event) => {
      if (event.target === toast) {
        removeToast();
      }
    };

    const fallbackTimer = setTimeout(removeToast, TRANSITION_FALLBACK_MS);
    toast.addEventListener('transitionend', handleTransitionEnd);
  }

  /**
   * Makes the toast visible on the next animation frame.
   */
  function show() {
    if (toast.isConnected) {
      toast.classList.add('is-visible');
    }
  }

  const existingToasts = Array.from(root.querySelectorAll('.toast'));

  while (existingToasts.length >= MAX_VISIBLE_TOASTS) {
    const oldest = existingToasts.shift();
    if (oldest) {
      oldest.remove();
    }
  }

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(show);
  } else {
    show();
  }

  const safeDuration = Number.isFinite(durationMs)
    ? Math.max(0, durationMs)
    : 3500;

  setTimeout(dismissToast, safeDuration);
}
