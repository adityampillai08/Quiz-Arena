/**
 * Scoring rules for Quiz Arena.
 * Owned by Engine. Pure functions only: no DOM, no storage, no network.
 *
 * For a correct answer without boosters:
 *   points = BASE_POINTS[difficulty] + timeBonus + streakBonus
 *
 * With boosters, the pointsDelta from applyBooster() is added to the base score.
 * The no-booster case scores exactly as before.
 */

/**
 * Clamp a value between min and max (inclusive).
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Works out the points for ONE answer, potentially including booster modifications.
 * @param {{ isCorrect: boolean, difficulty: string, remainingMs: number, questionTimeMs: number, streak: number, pointsDelta?: number }} input
 *   streak is the number of consecutive correct answers INCLUDING this one.
 *   pointsDelta: optional booster points delta (from applyBooster). If undefined, no booster maths applied.
 * @returns {number} a whole number of points, 0 when the answer is not correct
 */
export function calculatePoints({ isCorrect, difficulty, remainingMs, questionTimeMs, streak, pointsDelta } = {}) {
  if (!isCorrect) return 0;

  // Define BASE_POINTS, MAX_TIME_BONUS, STREAK_BONUS_STEP, STREAK_BONUS_MAX_STEPS locally
  const BASE_POINTS = { easy: 100, medium: 150, hard: 200 };
  const MAX_TIME_BONUS = 50;
  const STREAK_BONUS_STEP = 10;
  const STREAK_BONUS_MAX_STEPS = 5;
  // An unknown difficulty gives no points rather than a made-up value.
  if (!Object.prototype.hasOwnProperty.call(BASE_POINTS, difficulty)) return 0;
  const basePoints = BASE_POINTS[difficulty];

  const totalMs = Number(questionTimeMs) > 0 ? Number(questionTimeMs) : 15000;
  const safeRemainingMs = clamp(Number(remainingMs) || 0, 0, totalMs);
  // Guard against dividing by zero if the question time is invalid.
  const timeBonus = totalMs > 0 ? Math.round((50 * safeRemainingMs) / totalMs) : 0;

  // Difficulty multiplier: hard questions reward streaks more, easy less.
  // easy: 0.75, medium: 1.0, hard: 1.5
  const difficultyMultiplier = { easy: 0.75, medium: 1, hard: 1.5 }[difficulty] || 1;

  // The first correct answer of a streak earns no bonus, so we subtract 1.
  const streakSteps = clamp((Number(streak) || 0) - 1, 0, STREAK_BONUS_MAX_STEPS);
  const streakBonus = STREAK_BONUS_STEP * difficultyMultiplier * streakSteps;

  // Base points without any booster maths
  const baseScore = basePoints + timeBonus + streakBonus;

  // Apply booster points delta if provided (e.g. Double Up doubles, Double Jeopardy penalizes, etc.)
  let finalScore = baseScore;
  if (pointsDelta !== undefined && pointsDelta !== 0) {
    finalScore = baseScore + pointsDelta;
  }

  // Ensure whole number and never below 0
  return Math.max(0, Math.round(finalScore));
}

/**
 * Apply a booster's effect to the scoring parts (base, timeBonus, streakBonus).
 * Returns an object with the new pointsAwarded, the streak change, and a description of what happened.
 * @param {{ boosterId: string, isCorrect: boolean, skipped: boolean, basePoints: number, timeBonus: number, streakBonus: number, difficulty: string }} input
 * @returns {{ pointsAwarded: number, streakChange: number, description: string }}
 */
export function applyBooster({
  boosterId,
  isCorrect,
  skipped = false,
  basePoints,
  timeBonus,
  streakBonus,
  difficulty,
}) {
  if (skipped) {
    return { pointsAwarded: 0, streakChange: 0, description: 'skipped' };
  }

  if (!boosterId) {
    // No booster - return the original values
    return { pointsAwarded: basePoints + timeBonus + streakBonus, streakChange: 0, description: 'no booster' };
  }

  // Import BOOSTER_DEFINITIONS from boosters.js
  const BOOSTER_DEFINITIONS = {
    'double-up': { name: 'Double Up', description: 'if the answer is correct, the points for that question are doubled (base + time bonus + streak bonus, all of it). A wrong answer has no extra effect.' },
    'double-jeopardy': { name: 'Double Jeopardy', description: 'if correct, points are doubled. If wrong or time runs out, the player LOSES points equal to BASE_POINTS[difficulty] (easy 100, medium 150, hard 200). The total score can never go below 0. The streak resets as normal on a wrong answer.' },
    eraser: { name: 'Eraser', description: 'removes ONE random wrong option from the current question.' },
    'fifty-fifty': { name: '50/50', description: 'removes TWO random wrong options, leaving the correct answer and one wrong one.' },
    'time-freeze': { name: 'Time Freeze', description: 'pauses the timer for this question. The timer ring freezes and turns an icy blue colour. The time bonus for this question is calculated from the time that was left at the moment of freezing, so freezing early does not give a free maximum bonus unless the player was fast.' },
    'extra-time': { name: 'Extra Time', description: 'adds 10 seconds to this question\'s clock. The time bonus is still capped at MAX_TIME_BONUS (the ratio remaining/15000 must be clamped to 1).' },
    'second-chance': { name: 'Second Chance', description: 'if the first answer is wrong, the player gets one retry. The wrong option gets disabled and marked, the banner says \"Second chance, pick again\", and the timer keeps running. A correct retry earns base points only (no time bonus), counts as correct for accuracy and the streak, and is flagged in the answer record. A wrong retry is a normal wrong answer. If time runs out instead of a wrong click, the booster is wasted (a timeout is final).' },
    'streak-saver': { name: 'Streak Saver', description: 'if the answer is wrong or time runs out, the streak is NOT reset (it also does not go up). If the answer is correct it does nothing special, the streak goes up as normal and the booster is still consumed.' },
    'quick-draw': { name: 'Quick Draw', description: 'a correct answer gets the time bonus tripled (so up to 150 instead of 50). Rewards speed. Nothing happens on a wrong answer.' },
    pass: { name: 'Pass', description: 'skips the question safely. The question is recorded as skipped: 0 points, the streak is untouched, it does not count as correct, and it appears in the review as \"Skipped with Pass\" rather than as a wrong answer. After using it the question locks immediately and the Next button appears as usual.' }
  };

  const def = BOOSTER_DEFINITIONS[boosterId];
  if (!def) {
    return { pointsAwarded: basePoints + timeBonus + streakBonus, streakChange: 0, description: 'unknown booster' };
  }

  let finalPoints = basePoints + timeBonus + streakBonus;
  let streakChange = 0;
  let description = def.description;

  switch (boosterId) {
    case 'double-up':
      if (isCorrect) {
        finalPoints = finalPoints * 2;
        streakChange = isCorrect ? 1 : 0;
      } else {
        streakChange = -1; // streak resets on wrong answer
        finalPoints = 0;
      }
      break;

    case 'double-jeopardy':
      if (isCorrect) {
        finalPoints = finalPoints * 2;
        streakChange = 1;
      } else {
        // Lose base points, but never go below 0
        const lost = basePoints;
        finalPoints = Math.max(0, finalPoints - lost);
        streakChange = -1; // streak resets on wrong answer
      }
      break;

    case 'eraser':
      // Eraser doesn't change points directly, but options are removed
      streakChange = isCorrect ? 1 : 0;
      break;

    case 'fifty-fifty':
      // 50/50 doesn't change points directly
      streakChange = isCorrect ? 1 : 0;
      break;

    case 'time-freeze':
      // Time freezes: points unchanged, but time bonus uses time at freeze moment
      streakChange = isCorrect ? 1 : 0;
      break;

    case 'extra-time':
      // Extra Time: points are calculated with original time bonus,
      // but the timer has 10 more seconds. The actual time bonus is computed
      // by the engine/timer when scoring. For now keep points as-is.
      streakChange = isCorrect ? 1 : 0;
      break;

    case 'second-chance':
      if (!isCorrect) {
        // On retry: base points only (no time bonus), counts as correct
        finalPoints = basePoints;
        streakChange = 1;
        description = 'second chance retry';
      } else {
        // Already correct, booster has no extra effect but is consumed
        streakChange = 1;
      }
      break;

    case 'streak-saver':
      if (!isCorrect) {
        // Streak Saver: streak stays as-is, treated as correct for streak purposes
        streakChange = 0; // no change
        finalPoints = basePoints + timeBonus + streakBonus;
        description = 'streak saved';
      } else {
        // Correct: streak goes up normally
        streakChange = 1;
      }
      break;

    case 'quick-draw':
      if (isCorrect) {
        // Triple the time bonus, capped at MAX_TIME_BONUS * 3 but we cap at 150
        const tripledTimeBonus = Math.min(timeBonus * 3, 150);
        finalPoints = basePoints + tripledTimeBonus + streakBonus;
        streakChange = 1;
      } else {
        streakChange = 0;
      }
      break;

    case 'pass':
      // Pass: 0 points, streak untouched
      finalPoints = 0;
      streakChange = 0;
      description = 'passed';
      break;

    default:
      streakChange = isCorrect ? 1 : 0;
  }

  return { pointsAwarded: Math.round(finalPoints), streakChange, description };
}

/**
 * Finds the longest run of consecutive correct answers.
 * @param {Array<{isCorrect: boolean}>} answers
 * @returns {number}
 */
function findBestStreak(answers) {
  let best = 0;
  let current = 0;
  for (const answer of answers) {
    current = answer && answer.isCorrect ? current + 1 : 0;
    if (current > best) best = current;
  }
  return best;
}

/**
 * Builds the final result object shown on the result screen.
 * @param {{ config: object, answers: object[], finishedAt?: string }} input
 * @returns {object} a QuizResult with booster information
 */
export function buildQuizResult({ config, answers, finishedAt }) {
  const safeAnswers = Array.isArray(answers) ? answers : [];
  const total = safeAnswers.length;

  const correctCount = safeAnswers.filter((answer) => answer && answer.isCorrect).length;
  const score = safeAnswers.reduce((sum, answer) => sum + ((answer && answer.pointsAwarded) || 0), 0);
  const totalTimeMs = safeAnswers.reduce((sum, answer) => sum + ((answer && answer.timeTakenMs) || 0), 0);

  // Booster information
  const boostersUsed = [];
  let boosterNetPoints = 0;

  for (let i = 0; i < safeAnswers.length; i++) {
    const answer = safeAnswers[i];
    if (answer && answer.boosterUsed && answer.boosterUsed !== 'none' && answer.pointsDelta !== undefined) {
      boostersUsed.push({
        questionIndex: i,
        boosterId: answer.boosterUsed,
        pointsDelta: answer.pointsDelta,
      });
      boosterNetPoints += answer.pointsDelta || 0;
    }
  }

  // Accuracy: count only correct answers (not boosters or skips)
  const answeredCorrectly = safeAnswers.filter((answer) => answer && answer.isCorrect).length;
  const accuracy = total > 0 ? answeredCorrectly / total : 0;

  return {
    config,
    total,
    correctCount,
    score,
    accuracy,
    bestStreak: findBestStreak(safeAnswers),
    totalTimeMs,
    answers: safeAnswers,
    finishedAt: finishedAt || new Date().toISOString(),
    // Booster information
    boostersUsed,
    boosterNetPoints,
  };
}
