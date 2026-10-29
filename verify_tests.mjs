// Verify scoring tests by actually executing them
import { calculatePoints } from './js/core/scoring.js';

let pass = 0, fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('PASS:', name);
  } catch(e) {
    fail++;
    console.log('FAIL:', name, '-', e.message);
  }
}

// Test 1: medium, streak 1, correct, full time: 200
test('1. medium streak 1 correct full time', () => {
  const pts = calculatePoints({ isCorrect: true, difficulty: 'medium', remainingMs: 15000, questionTimeMs: 15000, streak: 1 });
  if (pts !== 200) throw new Error('Expected 200, got ' + pts);
});

// Test 2: medium, streak 1, correct, remainingMs 7500: 175
test('2. medium streak 1 correct 7500ms', () => {
  const pts = calculatePoints({ isCorrect: true, difficulty: 'medium', remainingMs: 7500, questionTimeMs: 15000, streak: 1 });
  if (pts !== 175) throw new Error('Expected 175, got ' + pts);
});

// Test 3: easy, streak 2, correct, full time: 158
test('3. easy streak 2 correct full time', () => {
  const pts = calculatePoints({ isCorrect: true, difficulty: 'easy', remainingMs: 15000, questionTimeMs: 15000, streak: 2 });
  if (pts !== 158) throw new Error('Expected 158, got ' + pts);
});

// Test 4: easy, streak 3, correct, full time: 165
test('4. easy streak 3 correct full time', () => {
  const pts = calculatePoints({ isCorrect: true, difficulty: 'easy', remainingMs: 15000, questionTimeMs: 15000, streak: 3 });
  if (pts !== 165) throw new Error('Expected 165, got ' + pts);
});

// Test 5: hard, streak 6, correct, full time: 325
test('5. hard streak 6 correct full time', () => {
  const pts = calculatePoints({ isCorrect: true, difficulty: 'hard', remainingMs: 15000, questionTimeMs: 15000, streak: 6 });
  if (pts !== 325) throw new Error('Expected 325, got ' + pts);
});

// Test 6: hard, streak 10, correct, full time: 325 (capped at 5 steps)
test('6. hard streak 10 correct full time', () => {
  const pts = calculatePoints({ isCorrect: true, difficulty: 'hard', remainingMs: 15000, questionTimeMs: 15000, streak: 10 });
  if (pts !== 325) throw new Error('Expected 325, got ' + pts);
});

// Test 7: any difficulty, wrong or timeout: 0
test('7. wrong answer 0 points', () => {
  [['easy', false], ['medium', false], ['hard', false]].forEach(([d, corr]) => {
    const pts = calculatePoints({ isCorrect: corr, difficulty: d, remainingMs: 7500, questionTimeMs: 15000, streak: 1 });
    if (pts !== 0) throw new Error('Expected 0 for ' + d + ' wrong, got ' + pts);
  });
});

// Test 8: loop over difficulties, streaks 1-12, remainingMs 0 to 15000 in steps of 500: all integers
test('8. All scores are integers', () => {
  const diffs = ['easy', 'medium', 'hard'];
  for (const d of diffs) {
    for (let s = 1; s <= 12; s++) {
      for (let r = 0; r <= 15000; r += 500) {
        const pts = calculatePoints({ isCorrect: true, difficulty: d, remainingMs: r, questionTimeMs: 15000, streak: s });
        if (!Number.isInteger(pts)) throw new Error('Non-integer: ' + d + ' streak=' + s + ' remaining=' + r + ' = ' + pts);
      }
    }
  }
});

console.log('');
console.log('Scoring tests: pass=' + pass + ' fail=' + fail);
console.log(pass + '/' + (pass + fail) + ' tests passed');