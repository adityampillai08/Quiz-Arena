/**
 * A tiny publish/subscribe bus. Views and the quiz engine talk through it,
 * so none of them need to import each other.
 * Owned by the coordinator.
 */
export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {(payload?: any) => void} handler
   * @returns {() => void} call it to unsubscribe
   */
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /** Unsubscribe a handler. */
  off(event, handler) {
    const set = this._handlers.get(event);
    if (set) set.delete(handler);
  }

  /** Subscribe for a single call. */
  once(event, handler) {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  /**
   * Call every handler for an event. One failing handler never stops the others.
   * @param {string} event
   * @param {any} [payload]
   */
  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Handler for "${event}" failed:`, error);
      }
    }
  }

  /** Remove every handler. */
  clear() {
    this._handlers.clear();
  }
}

export const createEventBus = () => new EventBus();
