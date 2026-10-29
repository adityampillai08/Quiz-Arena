/**
 * Score service facade for Quiz Arena.
 * Saves scores locally first and treats the global leaderboard as optional.
 */

import * as localStore from './localStore.js';
import { submitScore, fetchTopScores } from './remoteScores.js';
import { isConfigured } from './supabaseClient.js';

const REMOTE_TIMEOUT_MS = 8000;

/**
 * Returns whether remote score storage has been configured.
 *
 * @returns {boolean}
 */
export function isRemoteEnabled() {
  try {
    return isConfigured();
  } catch {
    return false;
  }
}

/**
 * Runs a promise with a timeout and clears the timeout when it settles.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {string} message
 * @returns {Promise<T>}
 */
function withTimeout(promise, timeoutMs, message) {
  let timeoutId;

  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Builds a fallback local score when local storage unexpectedly fails.
 *
 * @param {Object} entry
 * @returns {import('../types.js').ScoreEntry}
 */
function buildFallbackEntry(entry) {
  return {
    id: `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playerName: String(entry.playerName || 'Player').trim().slice(0, 20) || 'Player',
    score: Number(entry.score) || 0,
    correctCount: Number(entry.correctCount) || 0,
    total: Number(entry.total) || 0,
    categoryId: Number(entry.categoryId) || 0,
    categoryName: String(entry.categoryName || 'Any category').slice(0, 80),
    difficulty: ['easy', 'medium', 'hard'].includes(entry.difficulty)
      ? entry.difficulty
      : 'medium',
    createdAt: entry.createdAt || new Date().toISOString(),
    source: 'local',
  };
}

/**
 * Saves a finished quiz locally and attempts to publish it remotely.
 * This function never throws, even if local storage or Supabase fails.
 *
 * @param {import('../types.js').QuizResult} result
 * @param {string} playerName
 * @returns {Promise<{local:import('../types.js').ScoreEntry, remote:import('../types.js').ScoreEntry|null, remoteStatus:'saved'|'skipped'|'failed', isPersonalBest:boolean}>}
 */
export async function saveResult(result, playerName) {
  const config = result && result.config ? result.config : {};
  const safeResult = result && typeof result === 'object' ? result : {};
  const safePlayerName = typeof playerName === 'string'
    ? playerName.trim().slice(0, 20)
    : '';

  const entry = {
    playerName: safePlayerName || 'Player',
    score: Number(safeResult.score) || 0,
    correctCount: Number(safeResult.correctCount) || 0,
    total: Number(safeResult.total) || 0,
    categoryId: Number(config.categoryId) || 0,
    categoryName: String(config.categoryName || 'Any category').slice(0, 80),
    difficulty: ['easy', 'medium', 'hard'].includes(config.difficulty)
      ? config.difficulty
      : 'medium',
    createdAt: safeResult.finishedAt || new Date().toISOString(),
  };

  let isPersonalBest = false;

  try {
    isPersonalBest = Boolean(localStore.isPersonalBest(entry.score));
  } catch {
    isPersonalBest = false;
  }

  let local;

  try {
    local = localStore.addScore(entry);
  } catch {
    local = buildFallbackEntry(entry);
  }

  if (!local || typeof local !== 'object') {
    local = buildFallbackEntry(entry);
  }

  let remoteStatus = 'skipped';
  let remote = null;

  if (isRemoteEnabled()) {
    try {
      remote = await withTimeout(
        submitScore(entry),
        REMOTE_TIMEOUT_MS,
        'Saving the global score timed out.'
      );
      remoteStatus = 'saved';
    } catch (error) {
      remoteStatus = 'failed';
      console.warn('Quiz Arena could not save the global score.', error);
    }
  }

  return {
    local,
    remote,
    remoteStatus,
    isPersonalBest,
  };
}

/**
 * Returns locally saved leaderboard entries.
 *
 * @returns {import('../types.js').ScoreEntry[]}
 */
export function getLocalLeaderboard() {
  try {
    const scores = localStore.getScores();
    return Array.isArray(scores) ? scores : [];
  } catch {
    return [];
  }
}

/**
 * Loads the global leaderboard without allowing remote errors to escape.
 *
 * @param {{limit?:number, difficulty?:'easy'|'medium'|'hard'|'all'}} [options]
 * @returns {Promise<{entries:import('../types.js').ScoreEntry[], status:'ok'|'disabled'|'error', message?:string}>}
 */
export async function getGlobalLeaderboard({ limit = 20, difficulty = 'all' } = {}) {
  if (!isRemoteEnabled()) {
    return {
      entries: [],
      status: 'disabled',
      message: "The global leaderboard isn't set up yet.",
    };
  }

  try {
    const entries = await withTimeout(
      fetchTopScores({ limit, difficulty }),
      REMOTE_TIMEOUT_MS,
      "Couldn't load the global leaderboard. Try again in a moment."
    );

    return {
      entries,
      status: 'ok',
    };
  } catch (error) {
    console.warn('Quiz Arena could not load the global leaderboard.', error);

    return {
      entries: [],
      status: 'error',
      message: "Couldn't load the global leaderboard. Try again in a moment.",
    };
  }
}
