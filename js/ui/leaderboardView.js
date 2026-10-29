/**
 * Displays local and global leaderboard scores with difficulty filtering.
 */

import { EVENTS, LEADERBOARD_PAGE_SIZE } from '../constants.js';
import { byId, clearChildren, el, formatNumber, capitalize } from '../dom.js';

/**
 * Initializes leaderboard interactions and rendering.
 * @param {{ bus: EventBus,
 *   getLocalLeaderboard: () => ScoreEntry[],
 *   getGlobalLeaderboard: (options?: {limit?: number, difficulty?: Difficulty|'all'}) => Promise<{entries: ScoreEntry[], status: 'ok'|'disabled'|'error', message?: string}>,
 *   isRemoteEnabled: () => boolean,
 *   getPlayerName: () => string }} deps
 * @returns {{ open(): void }}
 */
export function initLeaderboardView({
  bus,
  getLocalLeaderboard,
  getGlobalLeaderboard,
  isRemoteEnabled,
  getPlayerName
}) {
  const localTab = byId('tab-local');
  const globalTab = byId('tab-global');
  const difficultySelect = byId('leaderboard-difficulty');
  const loadingMessage = byId('leaderboard-loading');
  const errorMessage = byId('leaderboard-error');
  const emptyMessage = byId('leaderboard-empty');
  const list = byId('leaderboard-list');
  const backButton = byId('leaderboard-back');

  let activeTab = 'local';
  let requestId = 0;

  /**
   * Updates the selected tab's accessible state.
   */
  function updateTabs() {
    if (localTab) {
      localTab.setAttribute(
        'aria-selected',
        String(activeTab === 'local')
      );
    }

    if (globalTab) {
      globalTab.setAttribute(
        'aria-selected',
        String(activeTab === 'global')
      );
    }
  }

  /**
   * Reads the selected difficulty, falling back to all difficulties.
   * @returns {Difficulty|'all'}
   */
  function getDifficulty() {
    const value = difficultySelect?.value || 'all';

    return ['all', 'easy', 'medium', 'hard'].includes(value)
      ? value
      : 'all';
  }

  /**
   * Shows one leaderboard state and hides the others.
   * @param {'loading'|'error'|'empty'|'list'} state
   */
  function showState(state) {
    if (loadingMessage) loadingMessage.hidden = state !== 'loading';
    if (errorMessage) errorMessage.hidden = state !== 'error';
    if (emptyMessage) emptyMessage.hidden = state !== 'empty';
    if (list) list.hidden = state !== 'list';
  }

  /**
   * Displays an error message.
   * @param {string} message
   */
  function showError(message) {
    if (errorMessage) {
      errorMessage.textContent = message;
    }

    showState('error');
  }

  /**
   * Builds leaderboard rows using text-only DOM operations.
   * @param {ScoreEntry[]} entries
   */
  function renderEntries(entries) {
    if (!list) return;

    clearChildren(list);

    const playerName = String(getPlayerName() || '').trim().toLocaleLowerCase();

    entries.slice(0, LEADERBOARD_PAGE_SIZE).forEach((entry, index) => {
      const isYou =
        playerName !== '' &&
        String(entry.playerName || '').trim().toLocaleLowerCase() === playerName;

      const row = el('li', {
        className: isYou
          ? 'leaderboard-row leaderboard-row--you'
          : 'leaderboard-row'
      });

      row.append(
        el('span', {
          className: 'leaderboard-row__rank',
          text: String(index + 1)
        }),
        el('span', {
          className: 'leaderboard-row__name',
          text: String(entry.playerName || 'Player')
        }),
        el('span', {
          className: 'leaderboard-row__meta',
          text: `${capitalize(entry.difficulty)} · ${String(entry.categoryName || 'Any category')} · ${Number(entry.correctCount) || 0}/${Number(entry.total) || 0}`
        }),
        el('span', {
          className: 'leaderboard-row__score',
          text: formatNumber(entry.score)
        })
      );

      list.append(row);
    });

    showState(entries.length ? 'list' : 'empty');
  }

  /**
   * Loads the selected leaderboard and ignores stale responses.
   */
  async function loadLeaderboard() {
    const currentRequest = ++requestId;
    const difficulty = getDifficulty();

    clearChildren(list);
    showState('loading');

    if (activeTab === 'local') {
      try {
        const storedEntries = getLocalLeaderboard();
        const entries = Array.isArray(storedEntries)
          ? storedEntries.filter((entry) => {
              if (!entry) return false;
              return difficulty === 'all' || entry.difficulty === difficulty;
            })
          : [];

        if (currentRequest !== requestId) return;
        renderEntries(entries);
      } catch {
        if (currentRequest !== requestId) return;
        showError('Could not load local scores. Please try again.');
      }

      return;
    }

    try {
      if (!isRemoteEnabled()) {
        if (currentRequest !== requestId) return;
        showError("The global leaderboard isn't set up yet.");
        return;
      }

      const response = await getGlobalLeaderboard({
        limit: LEADERBOARD_PAGE_SIZE,
        difficulty
      });

      if (currentRequest !== requestId) return;

      if (!response || response.status === 'error' || response.status === 'disabled') {
        showError(
          String(response?.message || 'Could not load the global leaderboard.')
        );
        return;
      }

      renderEntries(Array.isArray(response.entries) ? response.entries : []);
    } catch {
      if (currentRequest !== requestId) return;
      showError('Could not load the global leaderboard. Please try again.');
    }
  }

  /**
   * Selects the local tab and resets the difficulty filter.
   */
  function open() {
    activeTab = 'local';
    requestId++;

    if (difficultySelect) {
      difficultySelect.value = 'all';
    }

    updateTabs();
    loadLeaderboard();
  }

  if (localTab) {
    localTab.addEventListener('click', () => {
      if (activeTab === 'local') return;

      activeTab = 'local';
      updateTabs();
      loadLeaderboard();
    });
  }

  if (globalTab) {
    globalTab.addEventListener('click', () => {
      if (activeTab === 'global') return;

      activeTab = 'global';
      updateTabs();
      loadLeaderboard();
    });
  }

  if (difficultySelect) {
    difficultySelect.addEventListener('change', () => {
      loadLeaderboard();
    });
  }

  if (backButton) {
    backButton.addEventListener('click', () => {
      bus.emit(EVENTS.UI_LEADERBOARD_BACK);
    });
  }

  updateTabs();

  return { open };
}
