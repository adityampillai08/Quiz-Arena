/**
 * Reads and writes Quiz Arena scores in the Supabase leaderboard.
 * Database rows are converted to the shared camelCase ScoreEntry shape.
 */

import { SUPABASE_TABLE } from '../config.js';
import { getSupabase as realGetSupabase } from './supabaseClient.js';

// Test-only override for getSupabase; undefined in production.
let getSupabaseOverride = undefined;

/**
 * Test-only function to override the Supabase client getter.
 * @param {(() => Promise<import('@supabase/supabase-js').SupabaseClient|null>)|undefined} fn
 * @returns {void}
 */
export function __setMockGetSupabaseForTests(fn) {
  getSupabaseOverride = fn;
}

/**
 * Internal getter that uses the override when set, otherwise the real function.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient|null>}
 */
async function getSupabase() {
  if (getSupabaseOverride !== undefined) {
    return getSupabaseOverride();
  }
  return realGetSupabase();
}

/**
 * Converts a database row into the shared ScoreEntry shape.
 *
 * @param {Object} row Supabase database row.
 * @returns {import('../types.js').ScoreEntry}
 */
export function mapRowToEntry(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('The leaderboard returned an invalid score row.');
  }

  return {
    id: String(row.id ?? ''),
    playerName: String(row.player_name ?? ''),
    score: Number(row.score),
    correctCount: Number(row.correct_count),
    total: Number(row.total),
    categoryId: Number(row.category_id ?? 0),
    categoryName: String(row.category_name ?? ''),
    difficulty: row.difficulty,
    createdAt: String(row.created_at ?? ''),
    source: 'remote',
  };
}

/**
 * Inserts a score and returns the inserted database row.
 *
 * @param {{playerName:string, score:number, correctCount:number, total:number, categoryId:number, categoryName:string, difficulty:'easy'|'medium'|'hard'}} entry
 * @returns {Promise<import('../types.js').ScoreEntry>}
 */
export async function submitScore(entry) {
  const client = await getSupabase();

  if (!client) {
    throw new Error(
      'The global leaderboard is not configured or the Supabase client is unavailable.'
    );
  }

  if (!entry || typeof entry !== 'object') {
    throw new Error('Cannot submit an invalid score.');
  }

  const playerName = typeof entry.playerName === 'string'
    ? entry.playerName.trim().slice(0, 20)
    : '';

  if (!playerName) {
    throw new Error('Enter a player name before submitting a global score.');
  }

  const payload = {
    player_name: playerName,
    score: Number(entry.score),
    correct_count: Number(entry.correctCount),
    total: Number(entry.total),
    category_id: Number(entry.categoryId),
    category_name: String(entry.categoryName ?? '').slice(0, 80),
    difficulty: entry.difficulty,
  };

  const { data, error } = await client
    .from(SUPABASE_TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Could not save the global score: ${error.message}`);
  }

  if (!data) {
    throw new Error('Supabase did not return the saved score.');
  }

  return mapRowToEntry(data);
}

/**
 * Fetches the highest scores, optionally filtered by difficulty.
 *
 * @param {{limit?:number, difficulty?:'easy'|'medium'|'hard'|'all'}} [options]
 * @returns {Promise<import('../types.js').ScoreEntry[]>}
 */
export async function fetchTopScores({ limit = 20, difficulty = 'all' } = {}) {
  const client = await getSupabase();

  if (!client) {
    throw new Error(
      'The global leaderboard is not configured or the Supabase client is unavailable.'
    );
  }

  const safeLimit = Number.isFinite(Number(limit))
    ? Math.min(100, Math.max(1, Math.trunc(Number(limit))))
    : 20;

  const validDifficulties = ['easy', 'medium', 'hard', 'all'];
  const safeDifficulty = validDifficulties.includes(difficulty)
    ? difficulty
    : 'all';

  let query = client
    .from(SUPABASE_TABLE)
    .select(
      'id, player_name, score, correct_count, total, category_id, category_name, difficulty, created_at'
    )
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(safeLimit);

  if (safeDifficulty !== 'all') {
    query = query.eq('difficulty', safeDifficulty);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not load the global leaderboard: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error('Supabase returned an invalid leaderboard response.');
  }

  return data.map(mapRowToEntry);
}
