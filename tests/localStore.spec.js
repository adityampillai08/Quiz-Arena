/**
 * Local storage unit tests for Quiz Arena.
 * Tests localStore.js functions using isolated storage keys.
 */
const { test, expect } = require('@playwright/test');

// Create a shared mock localStorage
const mockStore = new Map();
const mockLocalStorage = {
  getItem: (key) => mockStore.get(key) ?? null,
  setItem: (key, value) => mockStore.set(key, value),
  removeItem: (key) => mockStore.delete(key),
  clear: () => mockStore.clear(),
};

let originalLocalStorage;

async function importFreshLocalStore() {
  // Clear the mock localStorage at the start of each test
  mockStore.clear();

  // Clear require cache for localStore and constants
  Object.keys(require.cache).forEach(key => {
    const normalizedKey = key.replace(/\\/g, '/');
    if (normalizedKey.includes('localStore') || normalizedKey.includes('constants')) {
      delete require.cache[key];
    }
  });

  // Replace global localStorage
  originalLocalStorage = global.localStorage;
  global.localStorage = mockLocalStorage;

  // Import fresh
  const module = await import('../js/storage/localStore.js');

  // Reset the internal memoryStore for test isolation
  if (module.__resetMemoryStoreForTests) {
    module.__resetMemoryStoreForTests();
  }

  return module;
}

function restoreLocalStorage() {
  if (originalLocalStorage) {
    global.localStorage = originalLocalStorage;
  }
}

test.describe('Local Store - Scores', () => {
  test('getScores returns empty array when storage is empty', async () => {
    const localStore = await importFreshLocalStore();
    try {
      const scores = localStore.getScores();
      expect(Array.isArray(scores)).toBe(true);
      expect(scores.length).toBe(0);
    } finally {
      restoreLocalStorage();
    }
  });

  test('addScore stores a valid score and getScores returns it', async () => {
    const localStore = await importFreshLocalStore();
    try {
      const entry = {
        playerName: 'Alice',
        score: 1000,
        correctCount: 8,
        total: 10,
        categoryId: 9,
        categoryName: 'General Knowledge',
        difficulty: 'medium',
      };

      const saved = localStore.addScore(entry);

      expect(saved).toBeDefined();
      expect(saved.playerName).toBe('Alice');
      expect(saved.score).toBe(1000);
      expect(saved.correctCount).toBe(8);
      expect(saved.total).toBe(10);
      expect(saved.categoryId).toBe(9);
      expect(saved.difficulty).toBe('medium');
      expect(saved.source).toBe('local');
      expect(saved.id).toBeDefined();
      expect(saved.createdAt).toBeDefined();

      const scores = localStore.getScores();
      expect(scores.length).toBe(1);
      expect(scores[0].score).toBe(1000);
    } finally {
      restoreLocalStorage();
    }
  });

  test('addScore trims player name to max length', async () => {
    const localStore = await importFreshLocalStore();
    try {
      const entry = {
        playerName: 'A'.repeat(50), // Over 20 char limit
        score: 500,
        correctCount: 5,
        total: 10,
        categoryId: 0,
        categoryName: 'Any category',
        difficulty: 'easy',
      };

      const saved = localStore.addScore(entry);
      expect(saved.playerName.length).toBeLessThanOrEqual(20);
    } finally {
      restoreLocalStorage();
    }
  });

  test('addScore uses fallback for invalid input', async () => {
    const localStore = await importFreshLocalStore();
    try {
      const entry = {
        playerName: '', // Invalid - empty
        score: 'invalid', // Invalid
        correctCount: 'bad',
        total: 'bad',
        categoryId: -1, // Invalid
        categoryName: null,
        difficulty: 'impossible', // Invalid
      };

      const saved = localStore.addScore(entry);

      // Should use fallbacks and not throw
      expect(saved).toBeDefined();
      expect(saved.score).toBe(0);
      expect(saved.correctCount).toBe(0);
      expect(saved.total).toBe(0);
      expect(saved.categoryId).toBe(0);
      expect(saved.difficulty).toBe('medium'); // DEFAULT_DIFFICULTY
      expect(saved.playerName).toBe('Player'); // DEFAULT_PLAYER_NAME
    } finally {
      restoreLocalStorage();
    }
  });

  test('getScores returns scores sorted by score desc, then correctCount desc, then createdAt asc', async () => {
    const localStore = await importFreshLocalStore();
    try {
      // Add scores out of order
      localStore.addScore({ playerName: 'Low', score: 100, correctCount: 5, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'medium' });
      localStore.addScore({ playerName: 'High', score: 1000, correctCount: 8, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'medium' });
      localStore.addScore({ playerName: 'Mid', score: 500, correctCount: 7, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'medium' });
      localStore.addScore({ playerName: 'Tie1', score: 500, correctCount: 8, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'medium' });
      localStore.addScore({ playerName: 'Tie2', score: 500, correctCount: 6, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'medium' });

      const scores = localStore.getScores();

      expect(scores[0].playerName).toBe('High');
      expect(scores[1].playerName).toBe('Tie1'); // Same score, more correct
      expect(scores[2].playerName).toBe('Mid'); // Same score, fewer correct
      expect(scores[3].playerName).toBe('Tie2'); // Same score, fewer correct
      expect(scores[4].playerName).toBe('Low');
    } finally {
      restoreLocalStorage();
    }
  });

  test('MAX_LOCAL_SCORES limit is enforced', async () => {
    const localStore = await importFreshLocalStore();
    try {
      const constants = await import('../js/constants.js');
      const MAX = constants.MAX_LOCAL_SCORES;

      // Add MAX + 5 scores
      for (let i = 0; i < MAX + 5; i++) {
        localStore.addScore({
          playerName: `Player${i}`,
          score: 100 + i,
          correctCount: 5,
          total: 10,
          categoryId: 0,
          categoryName: 'Any',
          difficulty: 'medium'
        });
      }

      const scores = localStore.getScores();
      expect(scores.length).toBe(MAX);
      // Lowest score should have been dropped
      expect(scores[scores.length - 1].score).toBeGreaterThan(100);
    } finally {
      restoreLocalStorage();
    }
  });

  test('isPersonalBest returns true for new high score', async () => {
    const localStore = await importFreshLocalStore();
    try {
      // No scores yet - first score is personal best
      expect(localStore.isPersonalBest(100)).toBe(true);
      expect(localStore.isPersonalBest(0)).toBe(false);
      expect(localStore.isPersonalBest(-10)).toBe(false);
      expect(localStore.isPersonalBest(NaN)).toBe(false);

      // Add a score
      localStore.addScore({ playerName: 'Test', score: 500, correctCount: 5, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'medium' });

      // Higher is personal best
      expect(localStore.isPersonalBest(600)).toBe(true);
      // Equal is NOT personal best (must exceed)
      expect(localStore.isPersonalBest(500)).toBe(false);
      // Lower is NOT personal best
      expect(localStore.isPersonalBest(400)).toBe(false);
    } finally {
      restoreLocalStorage();
    }
  });

  test('getBestScore returns highest score with optional filters', async () => {
    const localStore = await importFreshLocalStore();
    try {
      expect(localStore.getBestScore()).toBe(0);
      expect(localStore.getBestScore({ difficulty: 'medium' })).toBe(0);
      expect(localStore.getBestScore({ categoryId: 9 })).toBe(0);

      localStore.addScore({ playerName: 'A', score: 300, correctCount: 3, total: 10, categoryId: 9, categoryName: 'GK', difficulty: 'easy' });
      localStore.addScore({ playerName: 'B', score: 500, correctCount: 5, total: 10, categoryId: 9, categoryName: 'GK', difficulty: 'medium' });
      localStore.addScore({ playerName: 'C', score: 700, correctCount: 7, total: 10, categoryId: 10, categoryName: 'Books', difficulty: 'hard' });

      expect(localStore.getBestScore()).toBe(700);
      expect(localStore.getBestScore({ difficulty: 'easy' })).toBe(300);
      expect(localStore.getBestScore({ difficulty: 'medium' })).toBe(500);
      expect(localStore.getBestScore({ difficulty: 'hard' })).toBe(700);
      expect(localStore.getBestScore({ categoryId: 9 })).toBe(500);
      expect(localStore.getBestScore({ categoryId: 10 })).toBe(700);
      expect(localStore.getBestScore({ categoryId: 99 })).toBe(0);
      expect(localStore.getBestScore({ difficulty: 'medium', categoryId: 9 })).toBe(500);
    } finally {
      restoreLocalStorage();
    }
  });

  test('clearScores removes all scores', async () => {
    const localStore = await importFreshLocalStore();
    try {
      localStore.addScore({ playerName: 'Test', score: 500, correctCount: 5, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'medium' });
      expect(localStore.getScores().length).toBe(1);

      localStore.clearScores();
      expect(localStore.getScores().length).toBe(0);
    } finally {
      restoreLocalStorage();
    }
  });

  test('malformed JSON in storage is handled gracefully', async () => {
    const localStore = await importFreshLocalStore();
    try {
      // Pre-populate localStorage with bad data
      mockLocalStorage.setItem('quizArena.scores.v1', 'not valid json {');

      // Should not throw, returns empty array
      const scores = localStore.getScores();
      expect(Array.isArray(scores)).toBe(true);
      expect(scores.length).toBe(0);
    } finally {
      restoreLocalStorage();
    }
  });

  test('invalid score entries in storage are filtered out', async () => {
    const localStore = await importFreshLocalStore();
    try {
      // Pre-populate with mix of valid and invalid entries
      const badData = [
        { playerName: 'Valid', score: 100, correctCount: 5, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'medium', createdAt: new Date().toISOString() },
        { invalid: 'entry' }, // Invalid
        { playerName: '', score: 200 }, // Invalid - empty name
        { playerName: 'AlsoValid', score: 300, correctCount: 8, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'hard', createdAt: new Date().toISOString() },
      ];
      mockLocalStorage.setItem('quizArena.scores.v1', JSON.stringify(badData));

      const scores = localStore.getScores();

      expect(scores.length).toBe(2);
      expect(scores[0].playerName).toBe('AlsoValid');
      expect(scores[1].playerName).toBe('Valid');
    } finally {
      restoreLocalStorage();
    }
  });

  test('persistence across simulated page reload', async () => {
    // Use the mockStore directly without clearing between imports
    const localStore = await importFreshLocalStore();
    try {
      localStore.addScore({ playerName: 'Persist', score: 999, correctCount: 9, total: 10, categoryId: 0, categoryName: 'Any', difficulty: 'medium' });
    } finally {
      restoreLocalStorage();
    }

    // Simulate page reload by re-importing the module (same mock localStorage)
    // Don't clear mockStore - we want data to persist
    const module = await import('../js/storage/localStore.js');
    const reloadedStore = module;
    try {
      const scores = reloadedStore.getScores();

      expect(scores.length).toBe(1);
      expect(scores[0].score).toBe(999);
      expect(scores[0].playerName).toBe('Persist');
    } finally {
      restoreLocalStorage();
    }
  });
});

test.describe('Local Store - Settings', () => {
  test('getSettings returns defaults when storage empty', async () => {
    const localStore = await importFreshLocalStore();
    try {
      const settings = localStore.getSettings();

      expect(settings.playerName).toBe('');
      expect(settings.lastCategoryId).toBe(0);
      expect(settings.lastDifficulty).toBe('medium'); // DEFAULT_DIFFICULTY
    } finally {
      restoreLocalStorage();
    }
  });

  test('saveSettings persists and getSettings retrieves', async () => {
    const localStore = await importFreshLocalStore();
    try {
      localStore.saveSettings({ playerName: 'Bob', lastCategoryId: 11, lastDifficulty: 'hard' });

      const settings = localStore.getSettings();
      expect(settings.playerName).toBe('Bob');
      expect(settings.lastCategoryId).toBe(11);
      expect(settings.lastDifficulty).toBe('hard');
    } finally {
      restoreLocalStorage();
    }
  });

  test('saveSettings trims player name and validates difficulty/category', async () => {
    const localStore = await importFreshLocalStore();
    try {
      localStore.saveSettings({
        playerName: '  Long Name That Exceeds Limit  ',
        lastCategoryId: 'invalid',
        lastDifficulty: 'impossible'
      });

      const settings = localStore.getSettings();
      expect(settings.playerName.length).toBeLessThanOrEqual(20);
      expect(settings.lastCategoryId).toBe(0); // Invalid -> fallback
      expect(settings.lastDifficulty).toBe('medium'); // Invalid -> fallback
    } finally {
      restoreLocalStorage();
    }
  });

  test('saveSettings merges with existing settings', async () => {
    const localStore = await importFreshLocalStore();
    try {
      localStore.saveSettings({ playerName: 'First', lastDifficulty: 'easy' });
      localStore.saveSettings({ lastCategoryId: 9 }); // Only update category

      const settings = localStore.getSettings();
      expect(settings.playerName).toBe('First');
      expect(settings.lastDifficulty).toBe('easy');
      expect(settings.lastCategoryId).toBe(9);
    } finally {
      restoreLocalStorage();
    }
  });
});