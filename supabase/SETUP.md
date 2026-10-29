# Quiz Arena: Supabase Setup

Follow these steps to enable the optional global leaderboard. Quiz Arena
works without Supabase, so you can skip this guide if you only need local
high scores.

## 1. Create a Supabase project

1. Visit [Supabase](https://supabase.com/).
2. Sign in or create an account.
3. Create a new project.
4. Choose a project name and database password.
5. Wait until the project has finished setting up.

Keep your database password private. You do not need to put it in the
Quiz Arena source code.

## 2. Create the leaderboard table

1. Open your project in the Supabase dashboard.
2. Open the **SQL Editor**.
3. Create a new SQL query.
4. Open `supabase/schema.sql` from the Quiz Arena project.
5. Copy the entire SQL script into the SQL Editor.
6. Run the script.
7. Check that the query finishes successfully.

The script creates the `high_scores` table, its indexes, and the security
policies. It is safe to run again if you need to recreate the policies.

## 3. Find your project credentials

1. In the Supabase dashboard, open **Project Settings**.
2. Open the **API** section.
3. Find your **Project URL**.
4. Find the public **anon key** (sometimes labelled as a publishable
   public key in newer dashboard interfaces).
5. Copy the values for the URL and public key.

Use the public client key intended for browser applications. Do not use
a secret key or the `service_role` key.

## 4. Configure Quiz Arena

Open `js/config.js` in your project.

Replace the empty `SUPABASE_URL` and `SUPABASE_ANON_KEY` strings with
your own project's URL and public anon key. Keep the table name as
`high_scores` unless you also change the database table and code.

Save the file, then reload Quiz Arena.

The Supabase JavaScript client is loaded dynamically only when valid
credentials have been provided. If the configuration is empty, the
application continues to use local high scores.

## 5. Test the global leaderboard

1. Open Quiz Arena in a browser using a local web server or your normal
   project hosting.
2. Enter a player name and complete a quiz.
3. Open the Supabase dashboard.
4. Select **Table Editor**.
5. Open `public.high_scores`.
6. Check whether the submitted score appears.
7. Open the Quiz Arena leaderboard and select the Global tab.

If no row appears, check the browser console for an error and confirm
that the project URL, public key, table name, and SQL policies are correct.

The app saves the local score first. A remote submission failure should
not prevent you from viewing local high scores.

## Security notes

- The public anon key is designed to be included in browser applications.
  It is not a secret and does not grant unrestricted database access by
  itself.
- Row Level Security (RLS) restricts what public clients can do. This
  schema allows reading and inserting scores but does not provide policies
  for updating or deleting rows.
- The public insert policy means users can submit scores without proving
  that they earned them. Browser-submitted names and scores can be faked.
  This is acceptable for a class project or casual leaderboard, but not
  for money, prizes, or competitive rankings that require trusted results.
- Never put the `service_role` key or any other secret server-side key
  in the browser application.
- If you later need trusted scores, validate quiz results on a server and
  restrict database access accordingly.
