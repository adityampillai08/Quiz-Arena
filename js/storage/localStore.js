/**
 * Local persistence for Quiz Arena scores and player settings.
 * Uses localStorage when available and falls back to in-memory storage
 * when browser storage is unavailable or fails.
 */

import {
  DEFAULT_DIFFICULTY,
  DEFAULT_PLAYER_NAME,
  DIFFICULTIES,
  MAX_LOCAL_SCORES,
  PLAYER_NAME_MAX_LENGTH,
  STORAGE_KEYS,
} from '../constants.js';

const memoryStore = new Map();
const FALLBACK_SETTINGS = {
  playerName: '',
  lastCategoryId: 0,
  lastDifficulty: DEFAULT_DIFFICULTY,
};

/**
 * Test-only function to reset the in-memory store.
 * Used by unit tests to ensure isolation between test runs.
 *
 * @returns {void}
 */
export function __resetMemoryStoreForTests() {
  memoryStore.clear();
}

/**
 * Reads and parses JSON safely, falling back to memory when storage fails.
 *
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function readJson(key, fallback) {
  let raw;

  try {
    raw = localStorage.getItem(key);
  } catch {
    return cloneValue(memoryStore.has(key) ? memoryStore.get(key) : fallback);
  }

  if (raw === null) {
    return cloneValue(memoryStore.has(key) ? memoryStore.get(key) : fallback);
  }

  try {
    const parsed = JSON.parse(raw);
    memoryStore.set(key, cloneValue(parsed));
    return parsed;
  } catch {
    return cloneValue(memoryStore.has(key) ? memoryStore.get(key) : fallback);
  }
}

/**
 * Writes JSON safely and remembers the value if browser storage fails.
 *
 * @param {string} key
 * @param {*} value
 * @returns {void}
 */
function writeJson(key, value) {
  const copy = cloneValue(value);

  try {
    localStorage.setItem(key, JSON.stringify(copy));
    memoryStore.set(key, copy);
  } catch {
    memoryStore.set(key, copy);
  }
}

/**
 * Creates a defensive copy of a JSON-compatible value.
 *
 * @param {*} value
 * @returns {*}
 */
function cloneValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  const copy = {};

  for (const [key, item] of Object.entries(value)) {
    copy[key] = cloneValue(item);
  }

  return copy;
}

/**
 * Checks whether a value is one of the supported difficulty levels.
 *
 * @param {*} difficulty
 * @returns {boolean}
 */
function isValidDifficulty(difficulty) {
  return DIFFICULTIES.includes(difficulty);
}

/**
 * Converts a value to a finite number, returning a fallback if invalid.
 *
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Normalises a player name to the application's length and fallback rules.
 *
 * @param {*} value
 * @returns {string}
 */
function sanitisePlayerName(value) {
  if (typeof value !== 'string') {
    return DEFAULT_PLAYER_NAME;
  }

  const name = value.trim().slice(0, PLAYER_NAME_MAX_LENGTH);
  return name || DEFAULT_PLAYER_NAME;
}

/**
 * Creates a unique identifier, using the browser crypto API when available.
 *
 * @returns {string}
 */
function createId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Use the fallback when the crypto API is unavailable.
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/**
 * Sanitises one stored score entry.
 *
 * @param {*} entry
 * @returns {import('../constants.js').ScoreEntry|null}
 */
function sanitiseScoreEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  const score = Number(entry.score);

  if (!Number.isFinite(score) || !isValidDifficulty(entry.difficulty)) {
    return null;
  }

  if (typeof entry.playerName !== 'string' || !entry.playerName.trim()) {
    return null;
  }

  const correctCount = toFiniteNumber(entry.correctCount, 0);
  const total = toFiniteNumber(entry.total, 0);
  const categoryId = toFiniteNumber(entry.categoryId, 0);

  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : createId(),
    playerName: sanitisePlayerName(entry.playerName),
    score,
    correctCount,
    total,
    categoryId: Number.isInteger(categoryId) && categoryId >= 0 ? categoryId : 0,
    categoryName:
      typeof entry.categoryName === 'string' ? entry.categoryName : 'Any category',
    difficulty: entry.difficulty,
    createdAt:
      typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
        ? entry.createdAt
        : new Date(0).toISOString(),
    source: 'local',
  };
}

/**
 * Sorts score entries by score, correct answers, and creation time.
 *
 * @param {import('../constants.js').ScoreEntry[]} entries
 * @returns {import('../constants.js').ScoreEntry[]}
 */
function sortScores(entries) {
  return entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.correctCount !== a.correctCount) {
      return b.correctCount - a.correctCount;
    }

    const timeDifference = Date.parse(a.createdAt) - Date.parse(b.createdAt);

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Reads, sanitises, and sorts all saved scores.
 *
 * @returns {import('../constants.js').ScoreEntry[]}
 */
function readScores() {
  const stored = readJson(STORAGE_KEYS.SCORES, []);
  const entries = Array.isArray(stored) ? stored : [];
  const sanitised = [];

  for (const entry of entries) {
    const cleanEntry = sanitiseScoreEntry(entry);

    if (cleanEntry) {
      sanitised.push(cleanEntry);
    }
  }

  return sortScores(sanitised);
}

/**
 * Returns saved high scores sorted from best to worst.
 *
 * @returns {import('../constants.js').ScoreEntry[]}
 */
export function getScores() {
  return readScores().map((entry) => ({ ...entry }));
}

/**
 * Adds a high score, retains the top scores, and returns the saved entry.
 *
 * @param {{playerName:string, score:number, correctCount:number, total:number, categoryId:number, categoryName:string, difficulty:import('../constants.js').Difficulty, createdAt?:string}} entry
 * @returns {import('../constants.js').ScoreEntry}
 */
export function addScore(entry) {
  const input = entry && typeof entry === 'object' ? entry : {};
  const now = new Date().toISOString();
  const createdAt =
    typeof input.createdAt === 'string' && !Number.isNaN(Date.parse(input.createdAt))
      ? input.createdAt
      : now;

  const candidate = sanitiseScoreEntry({
    id: createId(),
    playerName: input.playerName,
    score: input.score,
    correctCount: input.correctCount,
    total: input.total,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    difficulty: input.difficulty,
    createdAt,
    source: 'local',
  });

  if (!candidate) {
    const safeEntry = {
      id: createId(),
      playerName: sanitisePlayerName(input.playerName),
      score: toFiniteNumber(input.score, 0),
      correctCount: toFiniteNumber(input.correctCount, 0),
      total: toFiniteNumber(input.total, 0),
      categoryId: Math.max(0, Math.floor(toFiniteNumber(input.categoryId, 0))),
      categoryName:
        typeof input.categoryName === 'string' ? input.categoryName : 'Any category',
      difficulty: isValidDifficulty(input.difficulty)
        ? input.difficulty
        : DEFAULT_DIFFICULTY,
      createdAt,
      source: 'local',
    };

    const scores = readScores();
    scores.push(safeEntry);
    sortScores(scores);
    writeJson(STORAGE_KEYS.SCORES, scores.slice(0, MAX_LOCAL_SCORES));

    return { ...safeEntry };
  }

  const scores = readScores();
  scores.push(candidate);
  sortScores(scores);
  writeJson(STORAGE_KEYS.SCORES, scores.slice(0, MAX_LOCAL_SCORES));

  return { ...candidate };
}

/**
 * Returns the highest score matching the optional difficulty and category.
 *
 * @param {{difficulty?: import('../constants.js').Difficulty, categoryId?: number}} [filter]
 * @returns {number}
 */
export function getBestScore(filter = {}) {
  const options = filter && typeof filter === 'object' ? filter : {};
  const scores = readScores();

  let best = 0;

  for (const entry of scores) {
    if (
      options.difficulty !== undefined &&
      entry.difficulty !== options.difficulty
    ) {
      continue;
    }

    const categoryId = Number(options.categoryId);

    if (
      options.categoryId !== undefined &&
      Number.isFinite(categoryId) &&
      categoryId !== 0 &&
      entry.categoryId !== categoryId
    ) {
      continue;
    }

    if (entry.score > best) {
      best = entry.score;
    }
  }

  return best;
}

/**
 * Checks whether a positive score exceeds every previously saved score.
 *
 * @param {number} score
 * @returns {boolean}
 */
export function isPersonalBest(score) {
  const candidate = Number(score);

  if (!Number.isFinite(candidate) || candidate <= 0) {
    return false;
  }

  return readScores().every((entry) => candidate > entry.score);
}

/**
 * Removes all saved high scores.
 *
 * @returns {void}
 */
export function clearScores() {
  writeJson(STORAGE_KEYS.SCORES, []);
}

/**
 * Returns complete player settings with safe defaults and validated values.
 *
 * @returns {import('../constants.js').Settings}
 */
export function getSettings() {
  const stored = readJson(STORAGE_KEYS.SETTINGS, {});
  const source =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};

  const playerName =
    typeof source.playerName === 'string'
      ? source.playerName.trim().slice(0, PLAYER_NAME_MAX_LENGTH)
      : FALLBACK_SETTINGS.playerName;

  const categoryId = Number(source.lastCategoryId);
  const lastCategoryId =
    Number.isInteger(categoryId) && categoryId >= 0
      ? categoryId
      : FALLBACK_SETTINGS.lastCategoryId;

  const lastDifficulty = isValidDifficulty(source.lastDifficulty)
    ? source.lastDifficulty
    : FALLBACK_SETTINGS.lastDifficulty;

  return {
    playerName,
    lastCategoryId,
    lastDifficulty,
  };
}

/**
 * Merges, validates, and saves player settings.
 *
 * @param {Partial<import('../constants.js').Settings>} partial
 * @returns {void}
 */
export function saveSettings(partial) {
  const updates =
    partial && typeof partial === 'object' && !Array.isArray(partial) ? partial : {};

  const current = getSettings();
  const merged = { ...current, ...updates };

  const playerName =
    typeof merged.playerName === 'string'
      ? merged.playerName.trim().slice(0, PLAYER_NAME_MAX_LENGTH)
      : current.playerName;

  const categoryId = Number(merged.lastCategoryId);
  const lastCategoryId =
    Number.isInteger(categoryId) && categoryId >= 0
      ? categoryId
      : current.lastCategoryId;

  const lastDifficulty = isValidDifficulty(merged.lastDifficulty)
    ? merged.lastDifficulty
    : current.lastDifficulty;

  writeJson(STORAGE_KEYS.SETTINGS, {
    playerName,
    lastCategoryId,
    lastDifficulty,
  });
}
