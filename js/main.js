/**
 * Quiz Arena controller.
 * Connects the quiz engine, the data layer and the views through the event bus.
 * It holds no markup and no scoring rules, only the order things happen in.
 * Owned by the coordinator.
 */
import { EVENTS, SCREENS, QUESTIONS_PER_QUIZ, DEFAULT_PLAYER_NAME } from './constants.js';
import { createEventBus } from './eventBus.js';
import { showScreen, getCurrentScreen, setText } from './dom.js';

import { fetchCategories, fetchQuestions } from './api/triviaApi.js';
import { QuizEngine } from './core/quizEngine.js';
import * as localStore from './storage/localStore.js';
import * as scoreService from './storage/scoreService.js';

import { initStartView } from './ui/startView.js';
import { initQuestionView } from './ui/questionView.js';
import { initTimerView } from './ui/timerView.js';
import { initResultView } from './ui/resultView.js';
import { initLeaderboardView } from './ui/leaderboardView.js';
import { showToast } from './ui/toast.js';
import { launchConfetti } from './ui/confetti.js';

const bus = createEventBus();
const engine = new QuizEngine({ bus });

let activePlayerName = DEFAULT_PLAYER_NAME;
let isStarting = false;
let screenBeforeLeaderboard = SCREENS.START;

// Booster state: track whether boosters are active for this quiz
let quizHasBoosters = true; // Default: on, can be toggled off in settings

// Views are created first so they are subscribed before the engine emits anything.
const startView = initStartView({
  bus,
  loadCategories: fetchCategories,
  getSettings: localStore.getSettings,
  getBestScore: localStore.getBestScore,
});
initQuestionView({ bus });
initTimerView({ bus });
const resultView = initResultView({ bus });
const leaderboardView = initLeaderboardView({
  bus,
  getLocalLeaderboard: scoreService.getLocalLeaderboard,
  getGlobalLeaderboard: scoreService.getGlobalLeaderboard,
  isRemoteEnabled: scoreService.isRemoteEnabled,
  getPlayerName: () => localStore.getSettings().playerName || DEFAULT_PLAYER_NAME,
});

// Start screen -> fetch questions -> quiz
bus.on(EVENTS.UI_START_REQUESTED, async ({ config, playerName }) => {
  if (isStarting) return;
  isStarting = true;
  activePlayerName = playerName || DEFAULT_PLAYER_NAME;

  startView.clearError();
  startView.setBusy(true);
  localStore.saveSettings({
    playerName: activePlayerName,
    lastCategoryId: config.categoryId,
    lastDifficulty: config.difficulty,
  });

  setText('loading-message', 'Fetching your questions…');
  showScreen(SCREENS.LOADING);

  try {
    const questions = await fetchQuestions({
      categoryId: config.categoryId,
      difficulty: config.difficulty,
      amount: config.amount ?? QUESTIONS_PER_QUIZ,
    });
    showScreen(SCREENS.QUIZ);
    engine.start(questions, config);
  } catch (error) {
    console.error(error);
    showScreen(SCREENS.START);
    startView.showError(
      error?.userMessage || 'We could not load questions. Check your connection and try again.'
    );
  } finally {
    isStarting = false;
    startView.setBusy(false);
  }
});

// During the quiz - booster requests
bus.on(EVENTS.UI_BOOSTER_REQUESTED, ({ boosterId }) => {
  engine.requestBooster(boosterId);
});

// During the quiz - option selected
bus.on(EVENTS.UI_OPTION_SELECTED, ({ index }) => {
  engine._lockQuestion(index);
});

// During the quiz - next requested (user clicked "Next question")
bus.on(EVENTS.UI_NEXT_REQUESTED, () => {
  engine._onNextRequested();
});

// Quiz finished -> save the score and celebrate if it earned it
bus.on(EVENTS.QUIZ_FINISHED, async ({ result }) => {
  showScreen(SCREENS.RESULT);
  resultView.setSaveStatus('saving');

  try {
    const saved = await scoreService.saveResult(result, activePlayerName);
    resultView.showPersonalBest(saved.isPersonalBest);
    resultView.setSaveStatus(saved.remoteStatus === 'saved' ? 'saved' : saved.remoteStatus === 'skipped' ? 'local-only' : 'failed');
    if (saved.isPersonalBest || result.accuracy >= 0.8) launchConfetti();
  } catch (error) {
    console.error(error);
    resultView.setSaveStatus('failed');
  }
  startView.refreshBestScore();
});

// View leaderboard from Results or Start screen
bus.on(EVENTS.UI_VIEW_LEADERBOARD, () => {
  screenBeforeLeaderboard = getCurrentScreen();
  showScreen(SCREENS.LEADERBOARD);
  leaderboardView.open();
});

// Back from leaderboard
bus.on(EVENTS.UI_LEADERBOARD_BACK, () => {
  showScreen(screenBeforeLeaderboard);
});

// Start a new quiz from Results screen
bus.on(EVENTS.UI_PLAY_AGAIN, () => {
  // Reset per-game state
  screenBeforeLeaderboard = SCREENS.START;

  // Reset last played category/difficulty in localStorage
  localStore.saveSettings({
    lastCategoryId: 0, // Any Category
    lastDifficulty: DEFAULT_DIFFICULTY,
  });

  // Go back to start screen and show it
  showScreen(SCREENS.START);
});

