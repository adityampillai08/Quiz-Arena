/**
 * Start screen logic.
 * Fills the category dropdown, remembers the player's last choices,
 * and tells the rest of the app (through the event bus) when the player
 * presses "Start quiz". It never starts the quiz itself.
 */

import {
  EVENTS,
  ANY_CATEGORY_ID,
  DEFAULT_DIFFICULTY,
  DEFAULT_PLAYER_NAME,
  DIFFICULTIES,
  PLAYER_NAME_MAX_LENGTH,
  QUESTIONS_PER_QUIZ,
} from '../constants.js';
import { byId, el, formatNumber, setText } from '../dom.js';

const ANY_CATEGORY_LABEL = 'Any category';
const CATEGORY_ERROR_MESSAGE = "Couldn't load categories. You can still play with any category.";

/**
 * Read the saved settings without ever throwing.
 * @param {() => Settings} getSettings
 * @returns {Settings}
 */
function readSettings(getSettings) {
  try {
    return getSettings() || {};
  } catch (error) {
    console.warn('Could not read settings:', error);
    return {};
  }
}

/**
 * Read the best score without ever throwing.
 * @param {() => number} getBestScore
 * @returns {number}
 */
function readBestScore(getBestScore) {
  try {
    return Number(getBestScore()) || 0;
  } catch (error) {
    console.warn('Could not read best score:', error);
    return 0;
  }
}

/**
 * Cut the name to the allowed length. An empty name becomes the default name.
 * @param {string} rawName
 * @returns {string}
 */
function cleanPlayerName(rawName) {
  const trimmed = String(rawName || '').trim().slice(0, PLAYER_NAME_MAX_LENGTH);
  return trimmed || DEFAULT_PLAYER_NAME;
}

/**
 * Does the select already have an option with this value?
 * @param {HTMLSelectElement} select
 * @param {string} value
 * @returns {boolean}
 */
function hasOption(select, value) {
  return Array.from(select.options).some((option) => option.value === value);
}

/**
 * Set up the start screen.
 * @param {{ bus: EventBus,
 *           loadCategories: () => Promise<Category[]>,
 *           getSettings: () => Settings,
 *           getBestScore: () => number }} deps
 * @returns {{ showError(message: string): void, clearError(): void, setBusy(isBusy: boolean): void, refreshBestScore(): void }}
 */
export function initStartView({ bus, loadCategories, getSettings, getBestScore }) {
  const form = byId('start-form');
  const nameInput = byId('player-name');
  const categorySelect = byId('category-select');
  const difficultySelect = byId('difficulty-select');
  const startButton = byId('start-button');
  const errorNode = byId('start-error');
  const leaderboardButton = byId('open-leaderboard');

  // Stops a second "start" while the first one is still loading questions.
  let isBusy = false;

  function showError(message) {
    if (!errorNode) return;
    errorNode.textContent = String(message || '');
    errorNode.hidden = false;
  }

  function clearError() {
    if (!errorNode) return;
    errorNode.textContent = '';
    errorNode.hidden = true;
  }

  function setBusy(nextBusy) {
    isBusy = Boolean(nextBusy);
    if (startButton) {
      startButton.disabled = isBusy;
      startButton.dataset.busy = isBusy ? 'true' : 'false';
    }
    if (form) form.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  }

  function refreshBestScore() {
    const best = readBestScore(getBestScore);
    setText('best-score-value', best > 0 ? formatNumber(best) : '—');
  }

  /** Add one <option> per category after the existing "Any category" option. */
  function addCategoryOptions(categories) {
    if (!categorySelect || !Array.isArray(categories)) return;
    for (const category of categories) {
      if (!category || category.id === undefined || !category.name) continue;
      categorySelect.append(el('option', { text: String(category.name), attrs: { value: String(category.id) } }));
    }
  }

  /** Select the category the player used last time, if it still exists. */
  function restoreLastCategory(settings) {
    if (!categorySelect) return;
    const lastId = String(settings.lastCategoryId ?? ANY_CATEGORY_ID);
    if (hasOption(categorySelect, lastId)) categorySelect.value = lastId;
  }

  function restoreLastDifficulty(settings) {
    if (!difficultySelect) return;
    if (DIFFICULTIES.includes(settings.lastDifficulty)) {
      difficultySelect.value = settings.lastDifficulty;
    }
  }

  function loadCategoryOptions(settings) {
    // Starting with Promise.resolve() also catches a loadCategories that throws at once.
    Promise.resolve()
      .then(() => loadCategories())
      .then((categories) => {
        addCategoryOptions(categories);
        restoreLastCategory(settings);
      })
      .catch((error) => {
        console.warn('Could not load categories:', error);
        showError(CATEGORY_ERROR_MESSAGE);
      });
  }

  /** Build the QuizConfig from the two dropdowns. */
  function readConfig() {
    let categoryId = categorySelect ? Number(categorySelect.value) : ANY_CATEGORY_ID;
    if (!Number.isInteger(categoryId) || categoryId < 0) categoryId = ANY_CATEGORY_ID;

    let categoryName = ANY_CATEGORY_LABEL;
    if (categoryId !== ANY_CATEGORY_ID && categorySelect) {
      const selected = categorySelect.options[categorySelect.selectedIndex];
      if (selected && selected.textContent) categoryName = selected.textContent;
    }

    const chosenDifficulty = difficultySelect ? difficultySelect.value : DEFAULT_DIFFICULTY;
    const difficulty = DIFFICULTIES.includes(chosenDifficulty) ? chosenDifficulty : DEFAULT_DIFFICULTY;

    return { categoryId, categoryName, difficulty, amount: QUESTIONS_PER_QUIZ };
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (isBusy) return;
    try {
      clearError();
      const playerName = cleanPlayerName(nameInput ? nameInput.value : '');
      const config = readConfig();
      bus.emit(EVENTS.UI_START_REQUESTED, { config, playerName });
    } catch (error) {
      console.error('Start failed:', error);
      showError('Something went wrong. Please try again.');
    }
  }

  // --- Setup (runs once) ---
  const settings = readSettings(getSettings);
  if (nameInput && settings.playerName) nameInput.value = String(settings.playerName);
  restoreLastDifficulty(settings);
  refreshBestScore();
  loadCategoryOptions(settings);

  if (form) form.addEventListener('submit', handleSubmit);
  if (leaderboardButton) {
    leaderboardButton.addEventListener('click', () => bus.emit(EVENTS.UI_VIEW_LEADERBOARD));
  }

  return { showError, clearError, setBusy, refreshBestScore };
}
