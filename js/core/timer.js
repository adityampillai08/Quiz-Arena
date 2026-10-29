/**
 * A countdown timer for one quiz question.
 * Owned by Engine. No DOM: it only uses setInterval and performance.now().
 *
 * We measure elapsed time with performance.now() instead of counting ticks,
 * because browsers slow down setInterval in background tabs.
 *
 * New: supports pause()/resume() and addTime(ms) for boosters (Time Freeze, Extra Time).
 */

export class CountdownTimer {
  /**
   * @param {{ durationMs: number, tickMs?: number, onTick?: (remainingMs: number) => void, onExpire?: () => void }} options
   *   onTick is called every tickMs, and once with 0 right before onExpire().
   *   New: pause/resume/addTime are controlled through the class methods.
   */
  constructor({ durationMs, tickMs = 100, onTick, onExpire }) {
    this._durationMsOriginal = Number(durationMs) > 0 ? Number(durationMs) : 0;
    this._durationMs = this._durationMsOriginal;
    this._tickMs = Number(tickMs) > 0 ? Number(tickMs) : 100;
    this._onTick = typeof onTick === 'function' ? onTick : null;
    this._onExpire = typeof onExpire === 'function' ? onExpire : null;

    this._intervalId = null;
    this._startedAt = 0;
    this._remainingMs = this._durationMs;
    this._running = false;
    // Changes on every start/stop/reset so an old tick can tell it is outdated.
    this._runId = 0;
    // Booster state: frozen and extra time
    this._frozen = false;
    this._frozenRemainingMs = 0;
    this._extraTimeMs = 0;
  }

  /** Starts counting down from the full duration. Ignored if already running. */
  start() {
    if (this._running) return;

    this._runId += 1;
    const runId = this._runId;
    this._running = true;
    this._remainingMs = this._durationMs;
    this._startedAt = performance.now();
    this._intervalId = setInterval(() => this._tick(runId), this._tickMs);
  }

  /** Pauses/freezes the timer. No time is lost while paused. */
  pause() {
    this.freeze();
  }

  /** Freezes the timer. No time is lost until resume(). */
  freeze() {
    if (this._running && !this._frozen) {
      this._frozenRemainingMs = this._calculateRemaining();
      this._frozen = true;
    }
  }

  /** Resumes the timer from a paused/frozen state. */
  resume() {
    if (this._frozen && this._running) {
      const remaining = this._frozenRemainingMs;
      this._frozen = false;
      this._startedAt = performance.now() - (this._durationMs - remaining);
    }
  }

  /** Adds milliseconds to the timer duration (for Extra Time booster). */
  addTime(ms) {
    const added = Number(ms) > 0 ? Number(ms) : 0;
    if (added <= 0) return;

    this._extraTimeMs += added;
    this._durationMs = this._durationMsOriginal + this._extraTimeMs;

    if (this._frozen) {
      this._frozenRemainingMs += added;
    } else if (this._running) {
      const currentRemaining = this._calculateRemaining();
      const newRemaining = currentRemaining + added;
      this._startedAt = performance.now() - (this._durationMs - newRemaining);
    } else {
      this._remainingMs += added;
    }
  }

  /** Stops the timer and goes back to 'idle'. Safe to call at any time. */
  stop() {
    if (this._running) {
      this._remainingMs = this._calculateRemaining();
    }
    this._halt();
  }

  /** Stops the timer and restores the full duration. */
  reset() {
    this._halt();
    this._remainingMs = this._durationMsOriginal;
    this._frozen = false;
    this._frozenRemainingMs = 0;
    this._extraTimeMs = 0;
  }

  /** @returns {number} milliseconds left, never below 0 */
  get remainingMs() {
    if (this._frozen) {
      // Return the time that was left when frozen
      return this._frozenRemainingMs || 0;
    }
    return this._running ? this._calculateRemaining() : this._remainingMs;
  }

  /** @returns {boolean} true while the countdown is active */
  get isRunning() {
    return this._running;
  }

  /** Clears the interval and invalidates any tick that is still pending. */
  _halt() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._running = false;
    this._runId += 1;
  }

  /** @returns {number} time left based on the real clock */
  _calculateRemaining() {
    const elapsed = performance.now() - this._startedAt;
    // Apply extra time and account for frozen time
    const effectiveDuration = this._durationMsOriginal + this._extraTimeMs;
    return Math.max(0, effectiveDuration - elapsed);
  }

  /**
   * Runs on every interval step.
   * @param {number} runId the run this tick belongs to
   */
  _tick(runId) {
    if (!this._running || runId !== this._runId) return;

    if (!this._frozen) {
      const remaining = this._calculateRemaining();
      if (remaining > 0) {
        this._remainingMs = remaining;
        this._safeCall(this._onTick, remaining);
        return;
      }
    } else {
      // Timer is frozen: still update _remainingMs for reading, but don't count down
      const effectiveDuration = this._durationMsOriginal + this._extraTimeMs;
      const elapsed = performance.now() - this._startedAt;
      this._frozenRemainingMs = Math.max(0, effectiveDuration - elapsed);
    }

    this._expire(runId);
  }

  /**
   * Finishes the countdown: one final tick with 0, then onExpire once.
   * @param {number} runId
   */
  _expire(runId) {
    // Stop the interval first so this can never run twice.
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._running = false;
    this._remainingMs = 0;
    this._frozen = false;

    this._safeCall(this._onTick, 0);

    // If a callback called stop() or reset(), the run id changed: do not expire.
    if (runId !== this._runId) return;
    this._safeCall(this._onExpire);
  }

  /**
   * Calls a callback without letting its errors break the timer.
   * @param {Function|null} callback
   * @param {...any} args
   */
  _safeCall(callback, ...args) {
    if (!callback) return;
    try {
      callback(...args);
    } catch (error) {
      console.error('Timer callback failed:', error);
    }
  }
}