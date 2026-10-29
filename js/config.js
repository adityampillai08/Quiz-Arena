/**
 * Supabase configuration for Quiz Arena.
 * Find the Project URL and public anon key in your Supabase dashboard
 * under Project Settings > API, then replace the empty strings below.
 */

/** @type {string} Supabase project URL; fill this in to enable remote scores. */
export const SUPABASE_URL = 'https://jeebvvckujmwkmjfuarr.supabase.co';

/** @type {string} Public anon key; never put a service_role key here. */
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZWJ2dmNrdWptd2ttamZ1YXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNjQ2NDEsImV4cCI6MjEwODc0MDY0MX0.7HfxQ6BYEpe0Wv5dlPBaLWSRGfS2-C2MijQBOaH3l9Q';

/** @type {string} Name of the table used for global high scores. */
export const SUPABASE_TABLE = 'high_scores';
