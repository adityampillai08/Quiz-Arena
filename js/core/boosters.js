/**
 * Booster definitions for Quiz Arena.
 * Data-driven list of all 10 boosters. Add an eleventh later by appending to this file.
 * Owned by the coordinator. No DOM, no storage, no network.
 */

// The 10 booster ids (used as unique keys)
const BOOSTER_IDS = [
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
];

// Booster display data: name, description, and per-question rules
const BOOSTER_DEFINITIONS = {
  'double-up': {
    name: 'Double Up',
    description: 'if the answer is correct, the points for that question are doubled (base + time bonus + streak bonus, all of it). A wrong answer has no extra effect.'
  },
  'double-jeopardy': {
    name: 'Double Jeopardy',
    description: 'if correct, points are doubled. If wrong or time runs out, the player LOSES points equal to BASE_POINTS[difficulty] (easy 100, medium 150, hard 200). The total score can never go below 0. The streak resets as normal on a wrong answer.'
  },
  eraser: {
    name: 'Eraser',
    description: 'removes ONE random wrong option from the current question.'
  },
  'fifty-fifty': {
    name: '50/50',
    description: 'removes TWO random wrong options, leaving the correct answer and one wrong one.'
  },
  'time-freeze': {
    name: 'Time Freeze',
    description: 'pauses the timer for this question. The timer ring freezes and turns an icy blue colour. The time bonus for this question is calculated from the time that was left at the moment of freezing, so freezing early does not give a free maximum bonus unless the player was fast.'
  },
  'extra-time': {
    name: 'Extra Time',
    description: 'adds 10 seconds to this question\'s clock. The time bonus is still capped at MAX_TIME_BONUS (the ratio remaining/15000 must be clamped to 1).'
  },
  'second-chance': {
    name: 'Second Chance',
    description: 'if the first answer is wrong, the player gets one retry. The wrong option gets disabled and marked, the banner says "Second chance, pick again", and the timer keeps running. A correct retry earns base points only (no time bonus), counts as correct for accuracy and the streak, and is flagged in the answer record. A wrong retry is a normal wrong answer. If time runs out instead of a wrong click, the booster is wasted (a timeout is final).'
  },
  'streak-saver': {
    name: 'Streak Saver',
    description: 'if the answer is wrong or time runs out, the streak is NOT reset (it also does not go up). If the answer is correct it does nothing special, the streak goes up as normal and the booster is still consumed.'
  },
  'quick-draw': {
    name: 'Quick Draw',
    description: 'a correct answer gets the time bonus tripled (so up to 150 instead of 50). Rewards speed. Nothing happens on a wrong answer.'
  },
  pass: {
    name: 'Pass',
    description: 'skips the question safely. The question is recorded as skipped: 0 points, the streak is untouched, it does not count as correct, and it appears in the review as "Skipped with Pass" rather than as a wrong answer. After using it the question locks immediately and the Next button appears as usual.'
  }
};

// Draw 2 distinct boosters from all 10 (the pool), allowing duplicates across grants
export function drawBoosters(pool, count = 2, random = Math.random) {
  // Fisher-Yates shuffle to pick count distinct items
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// Draw 2 distinct boosters from all 10 (the pool), allowing duplicates across grants
export function drawTwoDistinct(random = Math.random) {
  return drawBoosters(BOOSTER_IDS, 2, random);
}

// Draw 2 boosters from the pool (may include ones already held)
// The second grant is drawn from the full pool of 10 again
export function drawTwoFromPool(random = Math.random) {
  return drawBoosters(BOOSTER_IDS, 2, random);
}

// Get the visual description for a booster (for UI)
export function getBoosterInfo(boosterId) {
  const def = BOOSTER_DEFINITIONS[boosterId];
  if (!def) return { name: boosterId, description: '' };
  return { name: def.name, description: def.description };
}

// Check if a booster can be used on the current question given the option count
export function canUseBooster(boosterId, optionCount) {
  const def = BOOSTER_DEFINITIONS[boosterId];
  if (!def) return false;

  // Eraser and 50/50 need at least 2 non-correct options
  if (boosterId === 'eraser' || boosterId === 'fifty-fifty') {
    return optionCount >= 3; // at least 3 options so we can remove 1 and leave 2
  }

  if (optionCount < 4) {
    return false;
  }

  return true;
}

// Re-export BOOSTER_DEFINITIONS for consumers that import from this module
export { BOOSTER_DEFINITIONS };