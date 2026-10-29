/**
 * Shared constants for Quiz Arena.
 * Owned by the coordinator. Every other file imports from here, nobody edits it.
 */

export const APP_NAME = 'Quiz Arena';

// Quiz rules
export const QUESTION_TIME_MS = 15000;
export const QUESTIONS_PER_QUIZ = 10;
export const OPTIONS_PER_QUESTION = 4;
export const URGENT_THRESHOLD_MS = 5000;

// Player
export const PLAYER_NAME_MAX_LENGTH = 20;
export const DEFAULT_PLAYER_NAME = 'Player';

// Difficulty and category
export const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
export const DEFAULT_DIFFICULTY = 'medium';
export const ANY_CATEGORY_ID = 0;

// Scoring. See calculatePoints() in core/scoring.js for the formula:
// points = BASE_POINTS[difficulty] + timeBonus + streakBonus
export const BASE_POINTS = Object.freeze({ easy: 100, medium: 150, hard: 200 });
export const MAX_TIME_BONUS = 50;
export const STREAK_BONUS_STEP = 10;
export const STREAK_BONUS_MAX_STEPS = 5;

// Boosters
export const BOOSTER_GRANT_SCHEDULE = Object.freeze([0, 5]); // questions answered before each grant
export const BOOSTERS_PER_GRANT = 2;
export const MAX_INVENTORY = 4;
export const MAX_BOOSTERS_PER_QUESTION = 1;
export const EXTRA_TIME_MS = 10000;
export const QUICK_DRAW_MULTIPLIER = 3;

// The 10 booster ids — defined in js/core/boosters.js
export const BOOSTER_IDS = Object.freeze([
  'double-up',
  'double-jeopardy',
  'eraser',
  'fifty-fifty',
  'time-freeze',
  'extra-time',
  'second-chance',
  'streak-saver',
  'quick-draw',
  'pass',
]);

// Storage
export const STORAGE_KEYS = Object.freeze({
  SCORES: 'quizArena.scores.v1',
  SETTINGS: 'quizArena.settings.v1',
  CATEGORIES: 'quizArena.categories.v1',
  TOKEN: 'quizArena.otdbToken.v1',
});
export const MAX_LOCAL_SCORES = 50;
export const LEADERBOARD_PAGE_SIZE = 20;

// Screens. Each one is a <section class="screen" data-screen="..."> in index.html.
export const SCREENS = Object.freeze({
  START: 'start',
  LOADING: 'loading',
  QUIZ: 'quiz',
  RESULT: 'result',
  LEADERBOARD: 'leaderboard',
});

// Event names used on the event bus.
// engine -> views
export const EVENTS = Object.freeze({
  QUESTION_SHOWN: 'quiz:question-shown',
  TIMER_TICK: 'quiz:timer-tick',
  ANSWER_LOCKED: 'quiz:answer-locked',
  QUIZ_FINISHED: 'quiz:finished',
  // New booster events: engine -> views
  BOOSTERS_GRANTED: 'quiz:boosters-granted',
  BOOSTER_ACTIVATED: 'quiz:booster-activated',
  BOOSTER_CONSUMED: 'quiz:booster-consumed',
  OPTIONS_ELIMINATED: 'quiz:options-eliminated',
  TIMER_FROZEN: 'quiz:timer-frozen',
  TIMER_RESUMED: 'quiz:timer-resumed',
  TIME_ADDED: 'quiz:time-added',
  // views -> controller
  UI_START_REQUESTED: 'ui:start-requested',
  UI_OPTION_SELECTED: 'ui:option-selected',
  UI_NEXT_REQUESTED: 'ui:next-requested',
  UI_PLAY_AGAIN: 'ui:play-again',
  UI_VIEW_LEADERBOARD: 'ui:view-leaderboard',
  UI_LEADERBOARD_BACK: 'ui:leaderboard-back',
  // New booster events: views -> controller
  UI_BOOSTER_REQUESTED: 'ui:booster-requested',
  UI_BOOSTERS_REVEAL_DONE: 'ui:boosters-reveal-done',
});

/**
 * @typedef {Object} AnswerRecord
 * @property {object} question
 * @property {number|null} selectedIndex
 * @property {boolean} isCorrect
 * @property {boolean} timedOut
 * @property {number} timeTakenMs
 * @property {number} pointsAwarded
 * @property {string|null} boosterUsed
 * @property {number} pointsDelta
 * @property {boolean} skipped
 * @property {boolean} usedSecondChance
 */

/**
 * @typedef {Object} QuizResult
 * @property {object} config
 * @property {number} total
 * @property {number} correctCount
 * @property {number} score
 * @property {number} accuracy
 * @property {number} bestStreak
 * @property {number} totalTimeMs
 * @property {AnswerRecord[]} answers
 * @property {string} finishedAt
 * @property {Array<{ questionIndex: number; boosterId: string; pointsDelta: number }>} boostersUsed
 * @property {number} boosterNetPoints
 */
