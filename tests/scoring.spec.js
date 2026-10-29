/**
 * Scoring unit tests for Quiz Arena.
 * Tests the calculatePoints and applyBooster functions directly.
 */
const { test, expect } = require('@playwright/test');

// ES modules need dynamic import
let calculatePoints, applyBooster;

test.beforeAll(async () => {
  const scoring = await import('../js/core/scoring.js');
  calculatePoints = scoring.calculatePoints;
  applyBooster = scoring.applyBooster;
});

test.describe('Scoring - calculatePoints', () => {

  test('incorrect answer returns 0', () => {
    expect(calculatePoints({
      isCorrect: false,
      difficulty: 'medium',
      remainingMs: 10000,
      questionTimeMs: 15000,
      streak: 1
    })).toBe(0);
  });

  test('unknown difficulty returns 0', () => {
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'impossible',
      remainingMs: 10000,
      questionTimeMs: 15000,
      streak: 1
    })).toBe(0);
  });

  test('easy difficulty base score with no time bonus, no streak', () => {
    // Easy: 100 base, 0 time bonus (0ms remaining), 0 streak bonus
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'easy',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 1
    })).toBe(100);
  });

  test('medium difficulty base score with no time bonus, no streak', () => {
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 1
    })).toBe(150);
  });

  test('hard difficulty base score with no time bonus, no streak', () => {
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'hard',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 1
    })).toBe(200);
  });

  test('maximum time bonus (15000ms remaining)', () => {
    // Medium: 150 base + 50 time bonus = 200
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 15000,
      questionTimeMs: 15000,
      streak: 1
    })).toBe(200);
  });

  test('half time bonus', () => {
    // Medium: 150 base + 25 time bonus = 175
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 7500,
      questionTimeMs: 15000,
      streak: 1
    })).toBe(175);
  });

  test('streak bonus - second correct answer (streak=2)', () => {
    // Medium: 150 base + 0 time + 10 streak = 160
    // difficultyMultiplier = 1.0, streakSteps = (2-1) = 1, streakBonus = 10 * 1.0 * 1 = 10
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 2
    })).toBe(160);
  });

  test('streak bonus - third correct answer (streak=3)', () => {
    // Medium: 150 base + 0 time + 20 streak = 170
    // streakSteps = (3-1) = 2, streakBonus = 10 * 1.0 * 2 = 20
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 3
    })).toBe(170);
  });

  test('streak cap at 5 steps (streak=7, max steps = 5)', () => {
    // Medium: 150 base + 0 time + 50 streak = 200
    // streakSteps = min((7-1), 5) = 5, streakBonus = 10 * 1.0 * 5 = 50
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 7
    })).toBe(200);
  });

  test('hard difficulty streak multiplier 1.5x', () => {
    // Hard: 200 base + 0 time + (10 * 1.5 * 1) = 215
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'hard',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 2
    })).toBe(215);
  });

  test('easy difficulty streak multiplier 0.75x', () => {
    // Easy: 100 base + 0 time + (10 * 0.75 * 1) = 107.5 -> 108 (rounded)
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'easy',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 2
    })).toBe(108);
  });

  test('remainingMs clamped to 0 when negative', () => {
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: -1000,
      questionTimeMs: 15000,
      streak: 1
    })).toBe(150);
  });

  test('remainingMs clamped to totalMs when exceeding', () => {
    // Should be clamped to 15000, giving max time bonus
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 20000,
      questionTimeMs: 15000,
      streak: 1
    })).toBe(200);
  });

  test('pointsDelta added to base score', () => {
    // Medium base 150 + 50 delta = 200
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 1,
      pointsDelta: 50
    })).toBe(200);
  });

  test('negative pointsDelta applied', () => {
    // Medium base 150 - 30 delta = 120
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 1,
      pointsDelta: -30
    })).toBe(120);
  });

  test('final score never below 0', () => {
    // Medium base 150 - 200 delta = -50 -> clamped to 0
    expect(calculatePoints({
      isCorrect: true,
      difficulty: 'medium',
      remainingMs: 0,
      questionTimeMs: 15000,
      streak: 1,
      pointsDelta: -200
    })).toBe(0);
  });
});

test.describe('Scoring - applyBooster', () => {

  const baseParams = {
    basePoints: 150,
    timeBonus: 25,
    streakBonus: 10,
    difficulty: 'medium',
    skipped: false
  };

  test('no booster returns base score', () => {
    const result = applyBooster({ ...baseParams, boosterId: null, isCorrect: true });
    expect(result.pointsAwarded).toBe(185); // 150 + 25 + 10
    expect(result.streakChange).toBe(0);
  });

  test('Double Up - correct answer doubles points', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'double-up', isCorrect: true });
    expect(result.pointsAwarded).toBe(370); // (150+25+10) * 2
    expect(result.streakChange).toBe(1);
  });

  test('Double Up - wrong answer gives 0', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'double-up', isCorrect: false });
    expect(result.pointsAwarded).toBe(0);
    expect(result.streakChange).toBe(-1);
  });

  test('Double Jeopardy - correct answer doubles points', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'double-jeopardy', isCorrect: true });
    expect(result.pointsAwarded).toBe(370); // (150+25+10) * 2
    expect(result.streakChange).toBe(1);
  });

  test('Double Jeopardy - wrong answer loses base points, score floored at 0', () => {
    // baseScore = 185, lost = 150, final = max(0, 185-150) = 35
    const result = applyBooster({ ...baseParams, boosterId: 'double-jeopardy', isCorrect: false });
    expect(result.pointsAwarded).toBe(35);
    expect(result.streakChange).toBe(-1);
  });

  test('Eraser - correct answer gives base score', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'eraser', isCorrect: true });
    expect(result.pointsAwarded).toBe(185);
    expect(result.streakChange).toBe(1);
  });

  test('50/50 - correct answer gives base score', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'fifty-fifty', isCorrect: true });
    expect(result.pointsAwarded).toBe(185);
    expect(result.streakChange).toBe(1);
  });

  test('Time Freeze - correct answer gives base score', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'time-freeze', isCorrect: true });
    expect(result.pointsAwarded).toBe(185);
    expect(result.streakChange).toBe(1);
  });

  test('Extra Time - correct answer gives base score', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'extra-time', isCorrect: true });
    expect(result.pointsAwarded).toBe(185);
    expect(result.streakChange).toBe(1);
  });

  test('Second Chance - retry (wrong then correct) gives base points only, no time bonus', () => {
    // For retry: basePoints only = 150
    const result = applyBooster({
      ...baseParams,
      boosterId: 'second-chance',
      isCorrect: false // this simulates the retry being correct
    });
    expect(result.pointsAwarded).toBe(150);
    expect(result.streakChange).toBe(1);
    expect(result.description).toBe('second chance retry');
  });

  test('Second Chance - already correct answer gives base score', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'second-chance', isCorrect: true });
    expect(result.pointsAwarded).toBe(185);
    expect(result.streakChange).toBe(1);
  });

  test('Streak Saver - wrong answer preserves streak, gives base score', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'streak-saver', isCorrect: false });
    expect(result.pointsAwarded).toBe(185);
    expect(result.streakChange).toBe(0); // streak unchanged
    expect(result.description).toBe('streak saved');
  });

  test('Streak Saver - correct answer increases streak normally', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'streak-saver', isCorrect: true });
    expect(result.pointsAwarded).toBe(185);
    expect(result.streakChange).toBe(1);
  });

  test('Quick Draw - correct answer triples time bonus (capped at 150)', () => {
    // basePoints=150, timeBonus=25, streakBonus=10
    // tripledTimeBonus = min(25*3, 150) = 75
    // total = 150 + 75 + 10 = 235
    const result = applyBooster({ ...baseParams, boosterId: 'quick-draw', isCorrect: true });
    expect(result.pointsAwarded).toBe(235);
    expect(result.streakChange).toBe(1);
  });

  test('Quick Draw - time bonus capped at 150', () => {
    // basePoints=150, timeBonus=50, streakBonus=10
    // tripledTimeBonus = min(50*3, 150) = 150
    // total = 150 + 150 + 10 = 310
    const params = { ...baseParams, timeBonus: 50 };
    const result = applyBooster({ ...params, boosterId: 'quick-draw', isCorrect: true });
    expect(result.pointsAwarded).toBe(310);
  });

  test('Quick Draw - wrong answer gives 0 streak change', () => {
    const result = applyBooster({ ...baseParams, boosterId: 'quick-draw', isCorrect: false });
    expect(result.pointsAwarded).toBe(185);
    expect(result.streakChange).toBe(0);
  });

  test('Pass - skips question, 0 points, streak untouched', () => {
    // When skipped=true, the early return at line 83-85 triggers with 'skipped' description
    // This is correct behavior - a Pass booster marks the question as skipped
    const result = applyBooster({ ...baseParams, boosterId: 'pass', isCorrect: true, skipped: true });
    expect(result.pointsAwarded).toBe(0);
    expect(result.streakChange).toBe(0);
    expect(result.description).toBe('skipped');
  });
});

test.describe('Scoring - integer results', () => {
  test('all results are integers', () => {
    const testCases = [
      { isCorrect: true, difficulty: 'easy', remainingMs: 1234, questionTimeMs: 15000, streak: 1 },
      { isCorrect: true, difficulty: 'medium', remainingMs: 7890, questionTimeMs: 15000, streak: 3 },
      { isCorrect: true, difficulty: 'hard', remainingMs: 1, questionTimeMs: 15000, streak: 5 },
    ];

    for (const tc of testCases) {
      const result = calculatePoints(tc);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });
});