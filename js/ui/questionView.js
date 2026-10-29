/**
 * Live quiz screen logic.
 * Shows each question with its four options, then shows the result
 * (green, red, or dimmed) when the engine says the answer is locked.
 * This file only reports clicks; the engine decides what is right.
 * NEW: Booster tray, grant reveals, option elimination.
 */

import { EVENTS, DIFFICULTIES, OPTIONS_PER_QUESTION, QUESTIONS_PER_QUIZ } from '../constants.js';
import { BOOSTER_IDS, MAX_BOOSTERS_PER_QUESTION } from '../constants.js';
import { $$, byId, capitalize, clearChildren, el, formatNumber, setText } from '../dom.js';
import { getBoosterInfo } from '../core/boosters.js';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

// Keyboard shortcuts: 1-4 and a-d both pick an option.
const KEY_TO_INDEX = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };

// Booster tray HTML template (created once, updated later)
// We'll build the tray DOM elements here and insert them into the quiz screen
let boosterTray = null;
let boosterOverlay = null;

// Track which booster is currently active
let currentlyActiveBooster = null;

/** Turn a streak number into the small text shown above the question. */
function updateScoreAndStreak(score, streak) {
  setText('quiz-score', formatNumber(score));
  const streakNode = byId('quiz-streak');
  if (!streakNode) return;
  const count = Number(streak) || 0;
  streakNode.textContent = `${count} in a row`;
  streakNode.hidden = count < 2;
}

/**"Question 3 of 10" text plus the progress bar. */
function updateProgress(questionNumber, total) {
  setText('quiz-progress-text', `Question ${questionNumber} of ${total}`);
  const bar = byId('quiz-progress-bar');
  if (!bar) return;
  const fraction = total > 0 ? questionNumber / total : 0;
  bar.style.setProperty('--progress', String(Number(fraction.toFixed(3))));
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', String(total));
  bar.setAttribute('aria-valuenow', String(questionNumber));
}

/** Show the difficulty text and swap the colour class on the badge. */
function updateDifficulty(difficulty) {
  const badge = byId('quiz-difficulty');
  if (!badge) return;
  badge.textContent = capitalize(difficulty);
  badge.classList.remove(...DIFFICULTIES.map((name) => `badge--${name}`));
  if (DIFFICULTIES.includes(difficulty)) badge.classList.add(`badge--${difficulty}`);
}

/** Build one option button using the exact markup from the DOM contract. */
function buildOptionButton(index, text) {
  return el(
    'button',
    { className: 'option', attrs: { type: 'button' }, dataset: { index: String(index), state: 'idle' } },
    el('span', { className: 'option__key', text: OPTION_KEYS[index] }),
    el('span', { className: 'option__text', text })
  );
}

/** Replace the old options with exactly four new buttons. */
function renderOptions(options, eliminatedIndexes = []) {
  const list = byId('options-list');
  if (!list) return;
  clearChildren(list);

  // Ensure options is an array with the correct length
  const safeOptions = Array.isArray(options) ? options : [];
  const optionCount = safeOptions.length;
  const correctIndex = safeOptions.correctIndex !== undefined ? safeOptions.correctIndex : 0;

  for (let index = 0; index < OPTIONS_PER_QUESTION; index += 1) {
    // Check if this option should be eliminated
    const isEliminated = eliminatedIndexes && eliminatedIndexes.includes(index);
    const optionText = index < safeOptions.length ? safeOptions[index] : '';

    const button = el(
      'button',
      {
        className: 'option' + (isEliminated ? ' option--eliminated' : ''),
        attrs: {
          type: 'button',
          disabled: isEliminated || false,
          'aria-disabled': isEliminated ? 'true' : 'false',
          'aria-label': isEliminated ? 'This option has been eliminated' : undefined
        },
        dataset: { index: String(index), state: isEliminated ? 'eliminated' : 'idle' },
      },
      el('span', { className: 'option__key', text: OPTION_KEYS[index] }),
      el('span', { className: 'option__text', text: optionText })
    );

    // Add strike-through style for eliminated options
    if (isEliminated) {
      const spanText = button.querySelector('.option__text');
      if (spanText) spanText.style.textDecoration = 'line-through';
      spanText.style.opacity = '0.5';
    }

    list.append(button);
  }
}

/** @returns {HTMLElement[]} the option buttons currently on screen */
function getOptionButtons() {
  const list = byId('options-list');
  return list ? $$('.option', list) : [];
}

/** Text of one option as the player sees it (used in the feedback message). */
function getOptionText(index) {
  const button = getOptionButtons()[index];
  const textNode = button ? button.querySelector('.option__text') : null;
  return textNode ? textNode.textContent : '';
}

function showBanner(tone, message) {
  const banner = byId('feedback-banner');
  if (!banner) return;
  banner.textContent = message;
  banner.dataset.tone = tone;
  banner.hidden = false;
  banner.removeAttribute('hidden');
}

function hideBanner() {
  const banner = byId('feedback-banner');
  if (!banner) return;
  banner.textContent = '';
  banner.removeAttribute('data-tone');
  banner.hidden = true;
}

function setPhase(phase) {
  const screen = byId('screen-quiz');
  if (screen) screen.dataset.phase = phase;
}

/** The message under the question once the answer is locked. */
function buildFeedback(record, correctIndex) {
  const correctText = getOptionText(correctIndex);
  if (record.timedOut) {
    return { tone: 'timeout', message: `Time's up. The answer was "${correctText}".` };
  }
  if (record.isCorrect) {
    return { tone: 'correct', message: `Correct! +${record.pointsAwarded}` };
  }
  return { tone: 'wrong', message: `Not quite. The answer was "${correctText}".` };
}

/** Colour the options: correct one green, the wrong pick red, the rest dim. */
function colourOptions(record, correctIndex, eliminatedIndexes = []) {
  getOptionButtons().forEach((button, index) => {
    let state = 'dim';
    if (index === correctIndex) {
      state = 'correct';
    } else if (record.selectedIndex !== null && !record.isCorrect && index === record.selectedIndex) {
      state = 'wrong';
    }
    button.dataset.state = state;
    button.disabled = true;

    // Apply eliminated state if needed
    if (eliminatedIndexes && eliminatedIndexes.includes(index)) {
      button.dataset.state = 'eliminated';
      button.disabled = true;
      const spanText = button.querySelector('.option__text');
      if (spanText) {
        spanText.style.textDecoration = 'line-through';
        spanText.style.opacity = '0.5';
      }
    }
  });
}

/** Build the booster tray HTML */
function buildBoosterTray(inventory, currentlyActive, bus) {
  // Create tray container if it doesn't exist
  let tray = byId('booster-tray');
  if (!tray) {
    tray = el('div', { className: 'booster-tray' }, null);
    tray.setAttribute('role', 'region');
    tray.setAttribute('aria-label', 'Booster tray');
    const main = byId('main');
    if (main) main.insertBefore(tray, byId('next-button'));
    boosterTray = tray;
  }

  // Clear existing buttons
  clearChildren(tray);

  // Build booster cards from inventory
  const inventoryArray = inventory || [];
  const defs = {
    'double-up': { icon: 'double', label: 'Double Up', activeClass: 'booster--double-up' },
    'double-jeopardy': { icon: 'jeopardy', label: 'Double Jeopardy', activeClass: 'booster--double-jeopardy' },
    eraser: { icon: 'eraser', label: 'Eraser', activeClass: 'booster--eraser' },
    'fifty-fifty': { icon: 'fifty', label: '50/50', activeClass: 'booster--fifty-fifty' },
    'time-freeze': { icon: 'freeze', label: 'Time Freeze', activeClass: 'booster--time-freeze', description: 'pauses the timer for this question. The timer ring freezes and turns an icy blue colour. The time bonus for this question is calculated from the time that was left at the moment of freezing, so freezing early does not give a free maximum bonus unless the player was fast.' },
    'extra-time': { icon: 'extra', label: 'Extra Time', activeClass: 'booster--extra-time', description: 'adds 10 seconds to this question\'s clock. The time bonus is still capped at MAX_TIME_BONUS (the ratio remaining/15000 must be clamped to 1).' },
    'second-chance': { icon: 'chance', label: 'Second Chance', activeClass: 'booster--second-chance', description: 'if the first answer is wrong, the player gets one retry. The wrong option gets disabled and marked, the banner says \"Second chance, pick again\", and the timer keeps running. A correct retry earns base points only (no time bonus), counts as correct for accuracy and the streak, and is flagged in the answer record. A wrong retry is a normal wrong answer. If time runs out instead of a wrong click, the booster is wasted (a timeout is final).' },
    'streak-saver': { icon: 'streak', label: 'Streak Saver', activeClass: 'booster--streak-saver', description: 'if the answer is wrong or time runs out, the streak is NOT reset (it also does not go up). If the answer is correct it does nothing special, the streak goes up as normal and the booster is still consumed.' },
    'quick-draw': { icon: 'quick', label: 'Quick Draw', activeClass: 'booster--quick-draw', description: 'a correct answer gets the time bonus tripled (so up to 150 instead of 50). Rewards speed. Nothing happens on a wrong answer.' },
    pass: { icon: 'pass', label: 'Pass', activeClass: 'booster--pass', description: 'skips the question safely. The question is recorded as skipped: 0 points, the streak is untouched, it does not count as correct, and it appears in the review as \"Skipped with Pass\" rather than as a wrong answer. After using it the question locks immediately and the Next button appears as usual.' },
  };
  // If no inventory, show friendly message
  if (!inventoryArray || inventoryArray.length === 0) {
    const msg = el('p', { className: 'booster-tray__empty' }, 'No boosters');
    tray.append(msg);
    return tray;
  }

  // Show up to 4 boosters (max inventory)
  const shown = inventoryArray.slice(0, 4);

  shown.forEach((boosterId, i) => {
    const def = defs[boosterId];
    if (!def) return;

    const isActive = currentlyActive === boosterId;
    const card = el('button', {
      className: `booster-card ${isActive ? 'booster-card--active' : ''} ${def.activeClass}`,
      attrs: {
        type: 'button',
        'aria-label': `${def.label}: ${def.description || ''}`,
        'data-booster-id': boosterId
      },
      role: 'button',
      'aria-pressed': isActive ? 'true' : 'false',
      'aria-label': `${def.label}, activated. Tap again to deactivate.`
    },
    el('span', { className: 'booster-card__icon' }),
    el('span', { className: 'booster-card__label', text: def.label }),
    el('span', { className: 'booster-card__description', text: def.description || '' })
  );

    // Add click handler
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      // Tell the engine to request this booster
      bus.emit(EVENTS.UI_BOOSTER_REQUESTED, { boosterId });
    });

    tray.append(card);
  });

  return tray;
}

/** Build the booster grant reveal overlay */
function buildBoosterGrantOverlay(newBoosters, inventory, grantNumber, onClose) {
  // Check if overlay already exists
  if (byId('booster-grant-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'booster-grant-overlay';
  overlay.className = 'booster-grant-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'booster-grant-title');

  const title = document.createElement('h2');
  title.id = 'booster-grant-title';
  title.className = 'booster-grant__title';
  title.textContent = grantNumber === 1 ? 'Booster drop!' : 'More boosters!';

  const subtitle = document.createElement('p');
  subtitle.className = 'booster-grant__subtitle';
  subtitle.textContent = grantNumber === 1 ? 'You received 2 new boosters!' : 'You received 2 more boosters!';

  const inventoryDiv = document.createElement('div');
  inventoryDiv.className = 'booster-grant__inventory';
  if (inventory && inventory.length > 0) {
    const inventoryText = document.createElement('p');
    inventoryText.className = 'booster-grant__current-inventory';
    inventoryText.textContent = `You now hold ${inventory.length} boosters:`;
    inventoryDiv.appendChild(inventoryText);
  }

  const newDiv = document.createElement('div');
  newDiv.className = 'booster-grant__new';
  // First booster will be shown, then second

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn--primary';
  closeBtn.setAttribute('data-action', 'close');
  closeBtn.setAttribute('role', 'button');
  closeBtn.textContent = 'Let\'s go';

  overlay.append(title, subtitle, inventoryDiv, newDiv, closeBtn);

  document.body.appendChild(overlay);

  // Set up focus trap and keyboard handling
  const foundCloseBtn = overlay.querySelector('[data-action="close"]');
  if (foundCloseBtn) {
    foundCloseBtn.addEventListener('click', () => {
      onClose();
    });
  }

  // Escape key to close
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };
  overlay.addEventListener('keydown', handleKeydown);

  // Enter key on overlay to close (when focused)
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement === overlay) {
      e.preventDefault();
      onClose();
    }
  });

  return overlay;
}

/** Initialize the question view with booster support */
export function initQuestionView({ bus }) {
  // 'idle' (nothing shown), 'answering' or 'locked'.
  let phase = 'idle';
  // Set the moment the player clicks, so a fast double click only counts once.
  let isLocked = false;
  // Same idea for the Next button.
  let hasRequestedNext = false;
  // Booster state
  let boosterInventory = [];
  let currentlyActiveBooster = null;
  let eliminatedOptions = [];
  let currentQuestion = null; // Store the current question for re-rendering

  function resetLocalState() {
    phase = 'idle';
    isLocked = false;
    hasRequestedNext = false;
    currentlyActiveBooster = null;
    eliminatedOptions = [];
    // Remove active booster badge
    const activeBadge = document.querySelector('.booster-active-badge');
    if (activeBadge) {
      activeBadge.remove();
      currentlyActiveBooster = null;
    }
  }

  function reset() {
    resetLocalState();
    const list = byId('options-list');
    if (list) clearChildren(list);
    hideBanner();
    const nextButton = byId('next-button');
    if (nextButton) nextButton.hidden = true;
    const screen = byId('screen-quiz');
    if (screen) screen.removeAttribute('data-phase');
    // Remove tray and overlay
    if (boosterTray) boosterTray.remove();
    if (boosterOverlay) boosterOverlay.remove();
    boosterTray = null;
    boosterOverlay = null;
    currentlyActiveBooster = null;
  }

  function setupBoosterTray(inventory) {
    // Build and insert the booster tray
    boosterTray = buildBoosterTray(inventory, currentlyActiveBooster, bus);
  }

  function showBoosterGrant(newBoosters, grantNumber) {
    console.log('showBoosterGrant called:', { newBoosters, grantNumber });
    // Show the grant overlay
    boosterOverlay = buildBoosterGrantOverlay(newBoosters, boosterInventory, grantNumber, () => {
      console.log('Booster grant overlay closed');
      // User clicked "Let's go" or pressed Escape
      boosterOverlay.remove();
      boosterOverlay = null;
      // After overlay closes, notify engine to proceed
      bus.emit(EVENTS.UI_BOOSTERS_REVEAL_DONE);
    });
    console.log('boosterOverlay after buildBoosterGrantOverlay:', boosterOverlay);
  }

  function handleQuestionShown(payload) {
    const question = payload && payload.question;
    if (!question || !Array.isArray(question.options)) {
      console.warn('QUESTION_SHOWN had no usable question.');
      return;
    }
    currentQuestion = question; // Store for re-rendering on OPTIONS_ELIMINATED
    const total = Number(payload.total) || QUESTIONS_PER_QUIZ;
    const questionNumber = Number(payload.questionNumber) || (Number(payload.index) || 0) + 1;

    resetLocalState();
    phase = 'answering';

    updateProgress(questionNumber, total);
    setText('quiz-category', question.category || '');
    updateDifficulty(question.difficulty);
    updateScoreAndStreak(payload.score, payload.streak);
    setText('question-text', question.text || '');

    // Initialize booster inventory from payload
    boosterInventory = payload.boosterInventory || [];

    // Build booster tray
    setupBoosterTray(boosterInventory);

    // Render options (may have eliminated ones from previous booster use)
    renderOptions(question.options, eliminatedOptions);

    // Set focus to first option
    const firstOption = getOptionButtons()[0];
    if (firstOption) firstOption.focus({ preventScroll: true });

    setPhase('answering');
    hideBanner();

    const nextButton = byId('next-button');
    if (nextButton) nextButton.hidden = true;
  }

  /** Report the player's choice. The engine will answer with ANSWER_LOCKED. */
  function selectOption(index) {
    if (phase !== 'answering' || isLocked) return;
    if (!Number.isInteger(index) || index < 0 || index >= OPTIONS_PER_QUESTION) return;
    isLocked = true;
    bus.emit(EVENTS.UI_OPTION_SELECTED, { index });
  }

  function requestNext() {
    if (phase !== 'locked' || hasRequestedNext) return;
    hasRequestedNext = true;
    bus.emit(EVENTS.UI_NEXT_REQUESTED);
  }

  function handleAnswerLocked(payload) {
    const record = payload && payload.record;
    if (!record) {
      console.warn('ANSWER_LOCKED had no record.');
      return;
    }
    const correctIndex = Number(payload.correctIndex);

    phase = 'locked';
    isLocked = true;
    setPhase('locked');

    // Colour options with any eliminations
    colourOptions(record, correctIndex, eliminatedOptions);

    updateScoreAndStreak(payload.runningScore, payload.streak);

    const feedback = buildFeedback(record, correctIndex);
    showBanner(feedback.tone, feedback.message);

    const nextButton = byId('next-button');
    if (nextButton) {
      nextButton.textContent = payload.isLast ? 'See results' : 'Next question';
      nextButton.hidden = false;
      nextButton.focus({ preventScroll: true });
      nextButton.scrollIntoView({ block: 'nearest' });
    }

    // Handle booster effects based on what was used
    // ... (will be connected to engine events)
  }

  function handleOptionsClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('.option');
    if (!button || button.disabled) return;

    // The engine handles booster activation and consumption
    // UI just reports the option selection
    selectOption(Number(button.dataset.index));
  }

  function handleKeydown(event) {
    if (document.body.dataset.screen !== 'quiz') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === 'Enter') {
      // A focused button already handles Enter itself, so skip those.
      const targetIsButton = event.target instanceof Element && event.target.closest('button');
      if (!event.repeat && !targetIsButton) requestNext();
      return;
    }

    const index = KEY_TO_INDEX[String(event.key).toLowerCase()];
    if (index !== undefined && phase === 'answering') {
      event.preventDefault();
      selectOption(index);
    }
  }

  // --- Setup (runs once) ---
  bus.on(EVENTS.BOOSTERS_GRANTED, ({ newBoosters, inventory, grantNumber }) => {
    console.log('BOOSTERS_GRANTED received:', { newBoosters, inventory, grantNumber });
    // Store inventory
    boosterInventory = inventory;
    // Show the grant overlay
    showBoosterGrant(newBoosters, grantNumber);
  });

  bus.on(EVENTS.QUESTION_SHOWN, handleQuestionShown);
  bus.on(EVENTS.ANSWER_LOCKED, handleAnswerLocked);

  // Booster effect events from engine
  bus.on(EVENTS.OPTIONS_ELIMINATED, ({ removedIndexes, remainingOptions }) => {
    console.log('OPTIONS_ELIMINATED received:', { removedIndexes, remainingOptions });
    eliminatedOptions = removedIndexes || [];
    // Re-render options with eliminated ones using the current question
    // The question is stored in the payload from QUESTION_SHOWN
    if (currentQuestion && Array.isArray(currentQuestion.options)) {
      renderOptions(currentQuestion.options, eliminatedOptions);
    }
  });

  bus.on(EVENTS.TIMER_FROZEN, ({ remainingMs }) => {
    console.log('TIMER_FROZEN received:', remainingMs);
    const timerNode = byId('timer');
    if (timerNode) {
      timerNode.dataset.frozen = 'true';
    }
  });

  bus.on(EVENTS.TIMER_RESUMED, ({ remainingMs }) => {
    console.log('TIMER_RESUMED received:', remainingMs);
    const timerNode = byId('timer');
    if (timerNode) {
      timerNode.dataset.frozen = 'false';
    }
  });

  bus.on(EVENTS.TIME_ADDED, ({ addedMs, newDuration }) => {
    console.log('TIME_ADDED received:', { addedMs, newDuration });
    // Timer view will handle the visual update via TIMER_TICK
  });

  bus.on(EVENTS.BOOSTER_ACTIVATED, ({ boosterId, boosterInfo, pointsDelta }) => {
    console.log('BOOSTER_ACTIVATED received:', { boosterId, boosterInfo, pointsDelta });
    // Mark booster as active in UI
    currentlyActiveBooster = boosterId;
    const card = document.querySelector(`.booster-card[data-booster-id="${boosterId}"]`);
    if (card) {
      card.classList.add('booster-card--active');
      card.setAttribute('aria-pressed', 'true');
      // Add active badge
      const badge = document.createElement('span');
      badge.className = 'booster-active-badge';
      badge.textContent = 'ACTIVE';
      card.appendChild(badge);
    }
  });

  bus.on(EVENTS.BOOSTER_CONSUMED, ({ boosterId, newScore }) => {
    console.log('BOOSTER_CONSUMED received:', { boosterId, newScore });
    // Remove active state from booster card
    const card = document.querySelector(`.booster-card[data-booster-id="${boosterId}"]`);
    if (card) {
      card.classList.remove('booster-card--active');
      card.setAttribute('aria-pressed', 'false');
      const badge = card.querySelector('.booster-active-badge');
      if (badge) badge.remove();
    }
    currentlyActiveBooster = null;
    // Update score display
    updateScoreAndStreak(newScore, 0); // streak will be updated on answer lock
    // Rebuild tray to reflect consumed booster
    setupBoosterTray(boosterInventory);
  });

  // One listener on the list covers every option, even after they are rebuilt.
  const optionsList = byId('options-list');
  if (optionsList) optionsList.addEventListener('click', handleOptionsClick);

  const nextButton = byId('next-button');
  if (nextButton) nextButton.addEventListener('click', requestNext);

  document.addEventListener('keydown', handleKeydown);

  return { reset };
}