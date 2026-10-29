/**
 * Lazy Supabase client for Quiz Arena.
 * Remote functionality is optional so the application works without credentials.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

let clientPromise = null;
let mockClientForTests = undefined;

/**
 * Test-only function to supply a mock Supabase client or null.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient|null|undefined} mock
 * @returns {void}
 */
export function __setMockSupabaseClientForTests(mock) {
  mockClientForTests = mock;
}

/**
 * Returns true when the Supabase URL and public key are configured.
 *
 * @returns {boolean}
 */
export function isConfigured() {
  if (mockClientForTests !== undefined) {
    return mockClientForTests !== null;
  }
  return (
    typeof SUPABASE_URL === 'string' &&
    SUPABASE_URL.startsWith('https://') &&
    typeof SUPABASE_ANON_KEY === 'string' &&
    SUPABASE_ANON_KEY.trim().length > 0
  );
}

/**
 * Loads and returns one shared Supabase client, or null when unavailable.
 *
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient|null>}
 */
export async function getSupabase() {
  if (mockClientForTests !== undefined) {
    return mockClientForTests;
  }

  if (!isConfigured()) {
    return null;
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const module = await import(
          'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm'
        );

        if (typeof module.createClient !== 'function') {
          throw new Error('The Supabase module did not provide createClient.');
        }

        return module.createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          }
        );
      } catch (error) {
        console.warn(
          'Quiz Arena could not load the Supabase client. Remote scores are unavailable.',
          error
        );
        return null;
      }
    })();
  }

  try {
    return await clientPromise;
  } catch (error) {
    // Keep this defensive path in case client creation changes later.
    console.warn('Quiz Arena could not initialize Supabase.', error);
    clientPromise = null;
    return null;
  }
}
