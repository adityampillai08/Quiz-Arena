/**
 * The quiz state machine: it knows which question is open, runs the timer,
 * scores answers and announces everything on the event bus.
 * Owned by Engine. No DOM, no storage, no network.
 *
 * States: 'idle' -> 'granting' -> 'answering' -> 'locked' -> ('granting' | 'answering' | 'finished')
 */

import {
  QUESTION_TIME_MS,
  OPTIONS_PER_QUESTION,
  ANY_CATEGORY_ID,
  DEFAULT_DIFFICULTY,
  EVENTS,
  BOOSTER_GRANT_SCHEDULE,
  BOOSTERS_PER_GRANT,
  MAX_INVENTORY,
  MAX_BOOSTERS_PER_QUESTION,
  BASE_POINTS,
  MAX_TIME_BONUS,
  STREAK_BONUS_STEP,
  STREAK_BONUS_MAX_STEPS,
  EXTRA_TIME_MS,
} from '../constants.js';
import { CountdownTimer } from './timer.js';
import { calculatePoints, buildQuizResult, applyBooster } from './scoring.js';
import { drawTwoDistinct, drawTwoFromPool, BOOSTER_DEFINITIONS, getBoosterInfo } from './boosters.js';

export class QuizEngine {
  /**
   * @param {{ bus: { emit: Function, on: Function }, questionTimeMs?: number }} options
   */
  constructor({ bus, questionTimeMs = QUESTION_TIME_MS } = {}) {
    if (!bus || typeof bus.emit !== 'function') {
      throw new Error('QuizEngine needs an event bus with an emit() function.');
    }

    this._bus = bus;
    this._questionTimeMs = Number(questionTimeMs) > 0 ? Number(questionTimeMs) : QUESTION_TIME_MS;

    this._timer = new CountdownTimer({
      durationMs: this._questionTimeMs,
      onTick: (remainingMs) => this._handleTick(remainingMs),
      onExpire: () => this._handleTimeout(),
    });

    this._clearState();

    // Listen for UI to confirm grant reveal is done
    if (typeof bus.on === 'function') {
      this._bus.on(EVENTS.UI_BOOSTERS_REVEAL_DONE, () => this._onGrantRevealDone());
    }
  }

  /**
   * Clears all quiz state.
   */
  _clearState() {
    this._questions = [];
    this._config = {};
    this._index = 0;
    this._status = 'idle';
    this._score = 0;
    this._streak = 0;
    this._bestStreak = 0;
    this._answers = [];
    this._boosterInventory = []; // tracks individual booster items (duplicates allowed)
    this._boosterUsedThisQuestion = false;
    this._pendingGrantCallback = null;
    this._lastBoosterInfo = null;
  }

  /**
   * Starts a new quiz and shows question 1.
   * Grants the first booster bundle before question 1.
   * @param {object[]} questions
   * @param {object} config
   */
  start(questions, config) {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('QuizEngine.start() needs a non-empty array of questions.');
    }

    this.reset();
    this._questions = questions.slice();
    this._config = this._normalizeConfig(config, questions.length);

    // Enter granting state for first grant
    this._status = 'granting';
    this._grantBoosters(0, () => this._showQuestion());
  }

  /**
   * Resets the quiz to initial state.
   */
  reset() {
    this._clearState();
    this._timer.reset();
  }

  /**
   * Grants boosters according to the grant schedule.
   * Enters 'granting' state and waits for UI to confirm reveal is done.
   * @param {number} questionsAnswered number of questions already answered
   * @param {Function} onGrantDone callback called when grant reveal is complete
   */
  _grantBoosters(questionsAnswered, onGrantDone) {
    const grantIndex = BOOSTER_GRANT_SCHEDULE.indexOf(questionsAnswered);
    if (grantIndex === -1) {
      // No grant at this point, proceed immediately
      if (onGrantDone) onGrantDone();
      return;
    }

    // Store callback to call after UI confirms reveal
    this._pendingGrantCallback = onGrantDone;

    // Determine which grant this is (first or second)
    const grantNumber = questionsAnswered > 0 ? 2 : 1;

    // Draw boosters
    let newBoosters;
    if (grantIndex === 1) {
      // Second grant: drawn from full pool of 10 again (can overlap with first grant)
      newBoosters = drawTwoFromPool();
    } else {
      // First grant: from full pool, 2 distinct
      newBoosters = drawTwoDistinct();
    }

    // Merge with existing inventory (cap at MAX_INVENTORY = 4)
    // Duplicates ARE allowed - track each instance separately
    const currentInventory = this._boosterInventory || [];
    const mergedInventory = [...currentInventory, ...newBoosters].slice(0, MAX_INVENTORY);

    // Emit boosters-granted event with the new boosters and current inventory
    this._bus.emit(EVENTS.BOOSTERS_GRANTED, {
      newBoosters,
      inventory: mergedInventory,
      grantNumber,
      questionsAnswered,
    });

    // Keep the inventory
    this._boosterInventory = mergedInventory;

    // The engine waits in 'granting' state until UI calls _onGrantRevealDone()
  }

  /**
   * Called by the UI event listener when the grant reveal overlay is closed.
   */
  _onGrantRevealDone() {
    if (this._pendingGrantCallback) {
      const callback = this._pendingGrantCallback;
      this._pendingGrantCallback = null;
      callback();
    }
  }

  /**
   * Called when user clicks "Next question" after seeing feedback.
   * This triggers the next question or booster grant.
   */
  _onNextRequested() {
    // Advance to next question or finish
    if (this._status === 'locked') {
      const questionsAnswered = this._index + 1;
      const isLast = this._index >= this._questions.length - 1;

      if (!isLast) {
        this._index += 1;
        // Check for booster grant before next question
        this._grantBoosters(questionsAnswered, () => this._showQuestion());
      } else {
        this._finish();
      }
    }
  }

  /**
   * Request to use a booster from the inventory.
   * @param {string} boosterId
   */
  requestBooster(boosterId) {
    // Can only use a booster while in 'answering' state (question waiting for answer)
    if (this._status !== 'answering') return;

    // Check inventory
    const inventory = this._boosterInventory || [];
    const idx = inventory.indexOf(boosterId);
    if (idx === -1) return;

    // Check: only one booster per question
    if (this._boosterUsedThisQuestion) return;

    // Consume the booster (remove one instance)
    inventory.splice(idx, 1);
    this._boosterInventory = inventory;

    // Evaluate the booster against the current question
    const question = this._questions[this._index];
    if (!question) return;

    const difficulty = question.difficulty || this._config.difficulty;
    const basePoints = BASE_POINTS[difficulty] || 0;

    // Calculate time bonus at the moment of activation
    const totalMs = this._questionTimeMs;
    const remainingMs = this._timer.remainingMs;
    const safeRemainingMs = Math.max(0, Math.min(remainingMs, totalMs));
    const timeBonus = totalMs > 0 ? Math.round((MAX_TIME_BONUS * safeRemainingMs) / totalMs) : 0;

    // Calculate streak bonus from current streak
    const streakSteps = Math.max(0, (this._streak || 0) - 1);
    const difficultyMultiplier = { easy: 0.75, medium: 1, hard: 1.5 }[difficulty] || 1;
    const streakBonus = STREAK_BONUS_STEP * difficultyMultiplier * streakSteps;

    // Apply the booster using the scoring helper
    const { pointsAwarded, streakChange, description } = applyBooster({
      boosterId,
      isCorrect: false, // Will be corrected after answer lock
      skipped: false,
      basePoints,
      timeBonus,
      streakBonus,
      difficulty,
    });

    // Emit booster-activated event
    this._bus.emit(EVENTS.BOOSTER_ACTIVATED, {
      boosterId,
      boosterInfo: getBoosterInfo(boosterId),
      pointsDelta: pointsAwarded - (basePoints + timeBonus + streakBonus), // delta from base
    });

    // Emit booster-consumed event
    this._bus.emit(EVENTS.BOOSTER_CONSUMED, {
      boosterId,
      newScore: this._score,
    });

    // Mark that a booster was used this question
    this._boosterUsedThisQuestion = true;

    // Store the booster info for later use during answer locking
    this._lastBoosterInfo = {
      boosterId,
      pointsAwarded,
      streakChange,
      description,
    };

    // For some boosters, we need special handling
    this._handleBoosterEffect(boosterId, question, difficulty);
  }

  /**
   * Handles the specific effect of each booster.
   * @param {string} boosterId
   * @param {object} question
   * @param {string} difficulty
   */
  _handleBoosterEffect(boosterId, question, difficulty) {
    switch (boosterId) {
      case 'eraser': {
        // Remove one random wrong option
        const options = question.options || [];
        const correctIndex = question.correctIndex;
        if (options && options.length >= 3) {
          // Get indices of wrong options
          const wrongIndices = options.map((_, i) => i).filter(i => i !== correctIndex);
          if (wrongIndices.length >= 1) {
            const removeIdx = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
            // Emit options-eliminated event
            this._bus.emit(EVENTS.OPTIONS_ELIMINATED, {
              removedIndexes: [removeIdx],
              remainingOptions: options.filter((_, i) => i !== removeIdx),
            });
          }
        }
        break;
      }

      case 'fifty-fifty': {
        // Remove two random wrong options
        const options = question.options || [];
        const correctIndex = question.correctIndex;
        if (options && options.length >= 3) {
          const wrongIndices = options.map((_, i) => i).filter(i => i !== correctIndex);
          if (wrongIndices.length >= 2) {
            // Pick 2 distinct wrong indices
            const shuffled = wrongIndices.sort(() => Math.random() - 0.5);
            const removeIndexes = shuffled.slice(0, 2);
            const remaining = options.filter((_, i) => !removeIndexes.includes(i));
            this._bus.emit(EVENTS.OPTIONS_ELIMINATED, {
              removedIndexes,
              remainingOptions: remaining,
            });
          }
        }
        break;
      }

      case 'time-freeze': {
        // Pause the timer
        this._timer.freeze();
        this._bus.emit(EVENTS.TIMER_FROZEN, {
          remainingMs: this._timer.remainingMs,
        });
        break;
      }

      case 'time-freeze-resume': {
        // Resume the timer after time freeze
        this._timer.resume();
        this._bus.emit(EVENTS.TIMER_RESUMED, {
          remainingMs: this._timer.remainingMs,
        });
        break;
      }

      case 'extra-time': {
        // Add 10 seconds to the timer
        this._timer.addTime(EXTRA_TIME_MS);
        this._bus.emit(EVENTS.TIME_ADDED, {
          addedMs: EXTRA_TIME_MS,
          newDuration: this._timer._durationMs,
        });
        break;
      }

      case 'quick-draw': {
        // Time bonus will be tripled when scoring is calculated
        // We just need to mark the record
        break;
      }

      case 'second-chance': {
        // Second Chance is handled in the UI/engine flow:
        // When the answer is locked and it was wrong, check if second-chance is available
        // and offer a retry. For now, we just note it.
        break;
      }

      case 'streak-saver': {
        // Streak Saver: the streak was already protected in _lockQuestion logic
        // We just need to ensure it's marked in the record
        break;
      }

      case 'double-up':
      case 'double-jeopardy':
        // Points already handled via applyBooster
        break;

      case 'pass': {
        // Pass: record as skipped, 0 points
        // The question will be locked immediately
        break;
      }

      default:
        break;
    }
  }

  /**
   * Starts a new quiz question and its timer.
   * Called after a booster grant overlay closes.
   */
  _showQuestion() {
    this._status = 'answering';
    this._questionStartedAt = performance.now();
    this._boosterUsedThisQuestion = false;
    this._lastBoosterInfo = null;

    this._timer.reset();
    this._timer.start();

    this._bus.emit(EVENTS.QUESTION_SHOWN, {
      question: this._questions[this._index],
      index: this._index,
      total: this._questions.length,
      questionNumber: this._index + 1,
      score: this._score,
      streak: this._streak,
      boosterInventory: this._boosterInventory || [],
    });
  }

  /**
   * Locks the current question exactly once, for a click or for a timeout.
   * Handles booster effects where needed.
   * @param {number|null} selectedIndex null means the timer ran out
   * @returns {object|null} the AnswerRecord, or null if the click was ignored
   */
  _lockQuestion(selectedIndex) {
    // This check is what stops a click and a timeout from both locking.
    if (this._status !== 'answering') return null;

    // Capture the remaining time BEFORE resuming, so time-freeze preserves the freeze moment
    const wasFrozen = this._timer._frozen;
    const frozenRemainingMs = wasFrozen ? this._timer._frozenRemainingMs : null;

    // If timer was frozen (time-freeze), resume it before stopping
    this._timer.resume();
    if (wasFrozen) {
      this._bus.emit(EVENTS.TIMER_RESUMED, {
        remainingMs: frozenRemainingMs,
      });
    } else {
      this._bus.emit(EVENTS.TIMER_RESUMED, {
        remainingMs: this._timer.remainingMs,
      });
    }
    this._timer.stop();
    this._status = 'locked';

    const question = this._questions[this._index];
    const totalMs = this._questionTimeMs;
    const timedOut = selectedIndex === null;
    const remainingMs = timedOut ? 0 : Math.min(Math.max(this._timer.remainingMs, 0), totalMs);

    // Determine correctness BEFORE booster effects
    const isCorrectBefore = !timedOut && selectedIndex === question.correctIndex;

    let isCorrect = isCorrectBefore;
    let streakChange = 0;
    let pointsAwarded = 0;
    let boosterUsed = null;
    let pointsDelta = 0;
    let skipped = false;
    let usedSecondChance = false;

    // Handle booster-specific logic if one was used
    if (this._boosterUsedThisQuestion && this._lastBoosterInfo) {
      const { boosterId, pointsAwarded: boostedPoints, streakChange: boostedStreakChange } = this._lastBoosterInfo;
      boosterUsed = boosterId;

      switch (boosterId) {
        case 'second-chance':
          if (!isCorrectBefore) {
            // Wrong answer - offer retry
            // For now, treat as a second chance retry
            isCorrect = true; // Retry counts as correct for streak/accuracy
            pointsAwarded = boostedPoints; // Base points only
            streakChange = boostedStreakChange;
            usedSecondChance = true;
          } else {
            // Already correct
            isCorrect = true;
            pointsAwarded = boostedPoints;
            streakChange = boostedStreakChange;
          }
          break;

        case 'streak-saver':
          if (!isCorrectBefore) {
            // Streak Saver: wrong answer, streak stays as-is (not reset), no points awarded
            isCorrect = false;
            streakChange = 0; // no change to streak
            pointsAwarded = 0;
          } else {
            // Correct: streak goes up normally, booster consumed
            isCorrect = true;
            pointsAwarded = boostedPoints;
            streakChange = boostedStreakChange;
          }
          break;

        case 'pass':
          skipped = true;
          isCorrect = false;
          pointsAwarded = 0;
          streakChange = 0;
          break;

        case 'double-jeopardy':
          if (isCorrectBefore) {
            isCorrect = true;
            pointsAwarded = boostedPoints;
            streakChange = boostedStreakChange;
          } else {
            isCorrect = false;
            pointsAwarded = boostedPoints; // Already includes penalty (never below 0)
            streakChange = -1; // streak resets
          }
          break;

        case 'quick-draw':
          if (isCorrectBefore) {
            isCorrect = true;
            pointsAwarded = boostedPoints;
            streakChange = boostedStreakChange;
          } else {
            isCorrect = false;
            pointsAwarded = 0;
            streakChange = -1; // streak resets
          }
          break;

        default:
          // For eraser, fifty-fifty, time-freeze, extra-time, double-up
          if (isCorrectBefore) {
            isCorrect = true;
            pointsAwarded = boostedPoints;
            streakChange = boostedStreakChange;
          } else {
            isCorrect = false;
            pointsAwarded = 0;
            streakChange = -1; // streak resets
          }
      }
    } else {
      // No booster used
      if (isCorrect) {
        this._streak += 1;
        this._bestStreak = Math.max(this._bestStreak, this._streak);
        streakChange = 1;
        pointsAwarded = calculatePoints({
          isCorrect: true,
          difficulty: question.difficulty || this._config.difficulty,
          remainingMs,
          questionTimeMs: totalMs,
          streak: this._streak,
        });
      } else {
        this._streak = 0;
        streakChange = -1;
        pointsAwarded = 0;
      }
    }

    // Update score
    this._score += pointsAwarded;

    // Calculate pointsDelta for the record
    const basePoints = BASE_POINTS[question.difficulty || this._config.difficulty] || 0;
    const safeRemainingMs = Math.max(0, Math.min(remainingMs, totalMs));
    const timeBonus = totalMs > 0 ? Math.round((MAX_TIME_BONUS * safeRemainingMs) / totalMs) : 0;
    const streakSteps = Math.max(0, (isCorrect ? (this._streak || 0) : 0) - 1);
    const difficultyMultiplier = { easy: 0.75, medium: 1, hard: 1.5 }[question.difficulty || this._config.difficulty] || 1;
    const streakBonus = STREAK_BONUS_STEP * difficultyMultiplier * streakSteps;
    const baseScore = basePoints + timeBonus + streakBonus;
    pointsDelta = pointsAwarded - baseScore;

    // Emit answer locked with full record
    const record = {
      question,
      selectedIndex: timedOut ? null : selectedIndex,
      isCorrect,
      timedOut,
      timeTakenMs: timedOut ? totalMs : totalMs - remainingMs,
      pointsAwarded,
      boosterUsed,
      pointsDelta,
      skipped,
      usedSecondChance,
    };
    this._answers.push(record);

    // Check for grant after this question
    const questionsAnswered = this._index + 1;
    const isLast = this._index >= this._questions.length - 1;

    this._bus.emit(EVENTS.ANSWER_LOCKED, {
      record,
      correctIndex: question.correctIndex,
      isLast,
      runningScore: this._score,
      streak: this._streak,
    });

    // Do NOT advance to next question here - wait for UI_NEXT_REQUESTED
    // The UI will show feedback and user must click "Next question"

    return record;
  }

  /**
   * Makes sure we always have a complete config, even if the caller sent a bad one.
   * @param {object} config
   * @param {number} amount
   * @returns {object}
   */
  _normalizeConfig(config, amount) {
    const given = config && typeof config === 'object' ? config : {};
    return {
      categoryId: Number.isFinite(given.categoryId) ? given.categoryId : ANY_CATEGORY_ID,
      categoryName: given.categoryName || 'Any category',
      difficulty: given.difficulty || DEFAULT_DIFFICULTY,
      amount: Number.isFinite(given.amount) ? given.amount : amount,
    };
  }

  /**
   * Forwards the timer ticks to the views.
   * @param {number} remainingMs
   */
  _handleTick(remainingMs) {
    // A late tick after the question was locked must not reach the views.
    if (this._status !== 'answering') return;

    const totalMs = this._questionTimeMs;
    const safeRemaining = Math.min(Math.max(remainingMs, 0), totalMs);
    this._bus.emit(EVENTS.TIMER_TICK, {
      remainingMs: safeRemaining,
      totalMs,
      fraction: safeRemaining / totalMs,
    });
  }

  /** Called by the timer when time runs out. */
  _handleTimeout() {
    this._lockQuestion(null);
  }

  /** Ends the quiz and announces the final result. */
  _finish() {
    this._timer.stop();
    this._status = 'finished';

    // Build the final result with booster information
    const boostersUsed = [];
    let boosterNetPoints = 0;

    for (let i = 0; i < this._answers.length; i++) {
      const answer = this._answers[i];
      if (answer.boosterUsed && answer.boosterUsed !== 'none') {
        boostersUsed.push({
          questionIndex: i,
          boosterId: answer.boosterUsed,
          pointsDelta: answer.pointsDelta,
        });
        boosterNetPoints += (answer.pointsDelta || 0);
      }
    }

    const result = buildQuizResult({
      config: this._config,
      answers: this._answers.slice(),
    });
    result.boostersUsed = boostersUsed;
    result.boosterNetPoints = boosterNetPoints;

    this._bus.emit(EVENTS.QUIZ_FINISHED, { result });
  }
}