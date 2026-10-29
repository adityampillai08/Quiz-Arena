/**
 * Timer ring and countdown number on the quiz screen.
 * Listens to the engine's ticks and updates the ring, the seconds text,
 * the "urgent" flag, and a quiet screen reader announcement at 10 and 5 seconds.
 */

import { EVENTS, QUESTION_TIME_MS, URGENT_THRESHOLD_MS } from '../constants.js';
import { byId } from '../dom.js';

// Ticks arrive about 10 times a second; ignore ring changes smaller than this.
const MIN_FRACTION_CHANGE = 0.005;

/** Keep a number between 0 and 1. */
function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Set up the timer display.
 * @param {{ bus: EventBus }} deps
 * @returns {{ reset(): void }}
 */
export function initTimerView({ bus }) {
  const timerNode = byId('timer');
  const textNode = byId('timer-text');
  const announcer = byId('timer-announcer');

  // What is on screen right now, so we only touch the DOM when something changed.
  let shownFraction = -1;
  let shownSeconds = -1;
  let shownUrgent = '';
  // Each announcement is made once per question.
  let announced10 = false;
  let announced5 = false;
  // After the answer is locked we ignore any late ticks.
  let isActive = true;

  function setFraction(fraction) {
    if (timerNode) timerNode.style.setProperty('--timer-fraction', String(Number(fraction.toFixed(3))));
    shownFraction = fraction;
  }

  function setSeconds(seconds) {
    if (textNode) textNode.textContent = String(seconds);
    shownSeconds = seconds;
  }

  function setUrgent(isUrgent) {
    const value = isUrgent ? 'true' : 'false';
    if (value === shownUrgent) return;
    if (timerNode) timerNode.dataset.urgent = value;
    shownUrgent = value;
  }

  function announce(message) {
    if (announcer) announcer.textContent = message;
  }

  /** Say "10 seconds left" or "5 seconds left" once each, never every second. */
  function announceIfNeeded(seconds, remainingMs) {
    if (remainingMs <= 0) return;
    if (seconds <= 5 && !announced5) {
      // Marking both as done avoids a late "10 seconds" after a throttled tab skips ahead.
      announced5 = true;
      announced10 = true;
      announce('5 seconds left');
    } else if (seconds <= 10 && seconds > 5 && !announced10) {
      announced10 = true;
      announce('10 seconds left');
    }
  }

  /** Put everything back to a full, calm timer. */
  function reset() {
    isActive = true;
    announced10 = false;
    announced5 = false;
    shownUrgent = '';
    setFraction(1);
    setSeconds(Math.ceil(QUESTION_TIME_MS / 1000));
    setUrgent(false);
    announce('');
  }

  function handleTick(payload) {
    if (!isActive || !payload) return;

    const remainingMs = Math.max(0, Number(payload.remainingMs) || 0);
    const fraction = Number.isFinite(Number(payload.fraction))
      ? clamp01(Number(payload.fraction))
      : clamp01(remainingMs / (Number(payload.totalMs) || QUESTION_TIME_MS));
    const seconds = Math.ceil(remainingMs / 1000);

    if (Math.abs(fraction - shownFraction) >= MIN_FRACTION_CHANGE || fraction === 0) {
      setFraction(fraction);
    }
    if (seconds !== shownSeconds) setSeconds(seconds);

    setUrgent(remainingMs > 0 && remainingMs <= URGENT_THRESHOLD_MS);
    announceIfNeeded(seconds, remainingMs);
  }

  function handleAnswerLocked() {
    isActive = false;
    setUrgent(false);
  }

  // --- Setup (runs once) ---
  bus.on(EVENTS.TIMER_TICK, handleTick);
  bus.on(EVENTS.QUESTION_SHOWN, reset);
  bus.on(EVENTS.ANSWER_LOCKED, handleAnswerLocked);
  bus.on(EVENTS.TIMER_FROZEN, ({ remainingMs }) => {
    console.log('TIMER_FROZEN received:', remainingMs);
    const timerNode = byId('timer');
    if (timerNode) {
      timerNode.dataset.frozen = 'true';
      // Force a tick update to show frozen time
      handleTick({ remainingMs, totalMs: QUESTION_TIME_MS, fraction: remainingMs / QUESTION_TIME_MS });
    }
  });
  bus.on(EVENTS.TIMER_RESUMED, ({ remainingMs }) => {
    console.log('TIMER_RESUMED received:', remainingMs);
    const timerNode = byId('timer');
    if (timerNode) {
      timerNode.dataset.frozen = 'false';
      // Force a tick update to show resumed time
      handleTick({ remainingMs, totalMs: QUESTION_TIME_MS, fraction: remainingMs / QUESTION_TIME_MS });
    }
  });
  bus.on(EVENTS.TIME_ADDED, ({ addedMs, newDuration }) => {
    console.log('TIME_ADDED received:', { addedMs, newDuration });
    // The engine's timer already updated; next TIMER_TICK will reflect new duration
  });

  return { reset };
}
