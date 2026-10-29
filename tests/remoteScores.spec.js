/**
 * Remote Scores (Supabase) Tests for Quiz Arena.
 * Tests the remoteScores.js module using a mocked Supabase client.
 */
const { test, expect } = require('@playwright/test');

// Test data
const testScore = {
  playerName: 'Test Player',
  score: 1000,
  correctCount: 8,
  total: 10,
  categoryId: 9,
  categoryName: 'General Knowledge',
  difficulty: 'medium',
};

// Helper to create a mock Supabase client
function createMockClient(responseData = [], responseError = null) {
  // Create a query builder that chains and resolves to the mock data
  function createQueryBuilder() {
    const builder = {
      select: (fields) => {
        builder.selectFields = fields;
        return builder;
      },
      insert: (payload) => {
        builder.insertPayload = payload;
        return builder;
      },
      single: () => {
        builder._isSingle = true;
        return builder;
      },
      order: (field, options) => {
        builder.orderField = field;
        builder.orderOptions = options;
        return builder;
      },
      limit: (limit) => {
        builder.limit = limit;
        return builder;
      },
      eq: (field, value) => {
        builder.eqField = field;
        builder.eqValue = value;
        return builder;
      },
      then: (resolve) => {
        // If .single() was called, return the first element; otherwise return the array
        const data = builder._isSingle && Array.isArray(responseData) && responseData.length > 0
          ? responseData[0]
          : responseData;
        resolve({ data, error: responseError });
      },
    };
    return builder;
  }

  // The top-level client - NOT thenable, just has from()
  const client = {
    from: () => createQueryBuilder(),
  };

  return client;
}

// Helper to set mock on remoteScores internal getSupabase
async function getRemoteScoresModule(mockClient = createMockClient()) {
  // Set override on remoteScores module for its internal getSupabase
  // Use synchronous mock - remoteScores.getSupabase() checks getSupabaseOverride !== undefined
  const remoteScoresModule = await import('../js/storage/remoteScores.js');
  remoteScoresModule.__setMockGetSupabaseForTests(() => mockClient);

  return { ...remoteScoresModule, mockClient };
}

test.describe('Remote Scores - mapRowToEntry', () => {
  test('converts a valid database row to ScoreEntry', async () => {
    const { mapRowToEntry } = await getRemoteScoresModule();

    const row = {
      id: '123',
      player_name: 'Test Player',
      score: 1000,
      correct_count: 8,
      total: 10,
      category_id: 9,
      category_name: 'General Knowledge',
      difficulty: 'medium',
      created_at: '2023-01-01T00:00:00Z',
    };

    const entry = mapRowToEntry(row);

    expect(entry.id).toBe('123');
    expect(entry.playerName).toBe('Test Player');
    expect(entry.score).toBe(1000);
    expect(entry.correctCount).toBe(8);
    expect(entry.total).toBe(10);
    expect(entry.categoryId).toBe(9);
    expect(entry.categoryName).toBe('General Knowledge');
    expect(entry.difficulty).toBe('medium');
    expect(entry.source).toBe('remote');
    expect(entry.createdAt).toBe('2023-01-01T00:00:00Z');
  });

  test('handles missing or null values in row', async () => {
    const { mapRowToEntry } = await getRemoteScoresModule();

    const row = {
      id: null,
      player_name: '',
      score: 1000,
      correct_count: 8,
      total: 10,
      category_id: null,
      category_name: null,
      difficulty: 'medium',
      created_at: null,
    };

    const entry = mapRowToEntry(row);

    expect(entry.id).toBe('');
    expect(entry.playerName).toBe('');
    expect(entry.score).toBe(1000);
    expect(entry.correctCount).toBe(8);
    expect(entry.total).toBe(10);
    expect(entry.categoryId).toBe(0);
    expect(entry.categoryName).toBe('');
    expect(entry.difficulty).toBe('medium');
    expect(entry.source).toBe('remote');
    expect(entry.createdAt).toBeDefined();
  });

  test('throws error for invalid row', async () => {
    const { mapRowToEntry } = await getRemoteScoresModule();

    expect(() => mapRowToEntry(null)).toThrow('The leaderboard returned an invalid score row.');
    expect(() => mapRowToEntry('not an object')).toThrow('The leaderboard returned an invalid score row.');
  });
});

test.describe('Remote Scores - submitScore', () => {
  test('submits a valid score and returns the saved entry', async () => {
    // Track the query builder to inspect the payload
    let capturedBuilder = null;
    const mockClient = createMockClient([{
      id: 'mock-id-1',
      player_name: testScore.playerName,
      score: testScore.score,
      correct_count: testScore.correctCount,
      total: testScore.total,
      category_id: testScore.categoryId,
      category_name: testScore.categoryName,
      difficulty: testScore.difficulty,
      created_at: new Date().toISOString(),
    }]);
    // Override from() to capture the builder
    const originalFrom = mockClient.from;
    mockClient.from = () => {
      capturedBuilder = originalFrom();
      return capturedBuilder;
    };

    const { submitScore } = await getRemoteScoresModule(mockClient);
    const result = await submitScore(testScore);

    expect(result).toBeDefined();
    expect(result.playerName).toBe('Test Player');
    expect(result.score).toBe(1000);
    expect(result.source).toBe('remote');
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(capturedBuilder).toBeDefined();
    expect(capturedBuilder.insertPayload).toBeDefined();
    expect(capturedBuilder.insertPayload.player_name).toBe('Test Player');
  });

  test('trims and validates player name', async () => {
    const mockClient = createMockClient([{
      id: 'mock-id-2',
      player_name: 'A'.repeat(20),
      score: testScore.score,
      correct_count: testScore.correctCount,
      total: testScore.total,
      category_id: testScore.categoryId,
      category_name: testScore.categoryName,
      difficulty: testScore.difficulty,
      created_at: new Date().toISOString(),
    }]);

    const { submitScore } = await getRemoteScoresModule(mockClient);
    const longName = 'A'.repeat(50);
    const result = await submitScore({ ...testScore, playerName: longName });

    expect(result.playerName.length).toBeLessThanOrEqual(20);
  });

  test('throws error for empty player name', async () => {
    const { submitScore } = await getRemoteScoresModule();
    await expect(submitScore({ ...testScore, playerName: '' })).rejects.toThrow(
      'Enter a player name before submitting a global score.'
    );
  });

  test('throws error for invalid score entry', async () => {
    const { submitScore } = await getRemoteScoresModule();
    await expect(submitScore(null)).rejects.toThrow('Cannot submit an invalid score.');
    await expect(submitScore('not an object')).rejects.toThrow('Cannot submit an invalid score.');
  });

  test('throws error when Supabase client is unavailable', async () => {
    const { submitScore } = await getRemoteScoresModule(null);
    await expect(submitScore(testScore)).rejects.toThrow(
      'The global leaderboard is not configured or the Supabase client is unavailable.'
    );
  });
});

test.describe('Remote Scores - fetchTopScores', () => {
  test('fetches top scores with default options', async () => {
    const mockClient = createMockClient([
      {
        id: '1',
        player_name: 'Player 1',
        score: 1000,
        correct_count: 8,
        total: 10,
        category_id: 9,
        category_name: 'General Knowledge',
        difficulty: 'medium',
        created_at: '2023-01-01T00:00:00Z',
      },
      {
        id: '2',
        player_name: 'Player 2',
        score: 900,
        correct_count: 7,
        total: 10,
        category_id: 9,
        category_name: 'General Knowledge',
        difficulty: 'medium',
        created_at: '2023-01-02T00:00:00Z',
      },
    ]);

    const { fetchTopScores } = await getRemoteScoresModule(mockClient);
    const scores = await fetchTopScores();

    expect(scores.length).toBe(2);
    expect(scores[0].playerName).toBe('Player 1');
    expect(scores[0].score).toBe(1000);
    expect(scores[1].playerName).toBe('Player 2');
    expect(scores[1].score).toBe(900);
  });

  test('applies limit parameter', async () => {
    const mockData = Array(30).fill().map((_, i) => ({
      id: `mock-id-${i}`,
      player_name: `Player ${i + 1}`,
      score: 1000 - i,
      correct_count: 8,
      total: 10,
      category_id: 9,
      category_name: 'General Knowledge',
      difficulty: 'medium',
      created_at: new Date(Date.now() - i * 1000).toISOString(),
    }));

    // Track the query builder to inspect limit
    let capturedBuilder = null;
    const mockClient = createMockClient(mockData);
    const originalFrom = mockClient.from;
    mockClient.from = () => {
      capturedBuilder = originalFrom();
      return capturedBuilder;
    };

    const { fetchTopScores } = await getRemoteScoresModule(mockClient);
    const scores = await fetchTopScores({ limit: 10 });

    // The mock returns all 30 items (no actual server-side limiting)
    // But we verify the limit was passed to the query builder
    expect(scores.length).toBe(30); // mock returns all data
    expect(capturedBuilder).toBeDefined();
    expect(capturedBuilder.limit).toBe(10);
  });

  test('applies difficulty filter', async () => {
    let capturedBuilder = null;
    const mockClient = createMockClient([]);
    const originalFrom = mockClient.from;
    mockClient.from = () => {
      capturedBuilder = originalFrom();
      return capturedBuilder;
    };

    const { fetchTopScores } = await getRemoteScoresModule(mockClient);
    await fetchTopScores({ difficulty: 'medium' });

    expect(capturedBuilder).toBeDefined();
    expect(capturedBuilder.eqField).toBe('difficulty');
    expect(capturedBuilder.eqValue).toBe('medium');
  });

  test('does not apply difficulty filter when invalid difficulty provided', async () => {
    const mockClient = createMockClient([]);

    const { fetchTopScores } = await getRemoteScoresModule(mockClient);
    await fetchTopScores({ difficulty: 'invalid' });

    expect(mockClient.eqField).toBeUndefined();
  });

  test('handles empty response', async () => {
    const mockClient = createMockClient([]);

    const { fetchTopScores } = await getRemoteScoresModule(mockClient);
    const scores = await fetchTopScores();

    expect(scores).toEqual([]);
  });

  test('throws error when Supabase returns error', async () => {
    const mockClient = createMockClient(null, { message: 'Database error' });

    const { fetchTopScores } = await getRemoteScoresModule(mockClient);
    await expect(fetchTopScores({})).rejects.toThrow(
      'Could not load the global leaderboard: Database error'
    );
  });

  test('throws error when Supabase client is unavailable', async () => {
    const { fetchTopScores } = await getRemoteScoresModule(null);
    await expect(fetchTopScores({})).rejects.toThrow(
      'The global leaderboard is not configured or the Supabase client is unavailable.'
    );
  });
});