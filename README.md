# Quiz Arena

A browser-based quiz game that fetches multiple-choice questions from the [Open Trivia DB](https://opentdb.com/api_config.php). Choose a category and difficulty, answer 10 questions against a 15-second timer, use boosters strategically, and compete for a high score.

**Live site:** [https://quiz-arena-lovat.vercel.app](https://quiz-arena-lovat.vercel.app)

**Repository:** [GitHub – Quiz Arena](https://github.com/adityampillai08/Quiz-Arena)

## Features

- Start screen with category and difficulty selection.
- 10 multiple-choice questions per game, with shuffled answer options.
- Immediate feedback for submitted answers.
- A 15-second timer for each question.
- Scoring system with speed and streak bonuses.
- Final results showing score and accuracy, with a Play Again option.
- Review of incorrect answers.
- Local high scores saved using `localStorage`.
- Optional global leaderboard powered by Supabase.
- 10 strategic boosters that add extra choices and scoring effects to gameplay.

## Boosters

- **Double Up:** Doubles points on a correct answer.
- **Double Jeopardy:** Doubles points on a correct answer and deducts base points for a wrong answer.
- **Eraser:** Removes one incorrect option.
- **50/50:** Removes two incorrect options.
- **Time Freeze:** Pauses the current question's timer.
- **Extra Time:** Adds 10 seconds to the timer.
- **Second Chance:** Allows one retry after a wrong answer.
- **Streak Saver:** Preserves the current streak after a wrong answer.
- **Quick Draw:** Triples the time bonus on a correct answer.
- **Pass:** Skips the current question without scoring.

## Technology

- HTML5
- CSS3
- Vanilla JavaScript using ES modules
- Open Trivia DB API
- `localStorage` for local high scores
- Supabase for the optional global leaderboard
- Playwright for automated testing

The project requires no frontend build step.

## Run Locally

Opening `index.html` directly using `file://` will not work because the application uses JavaScript ES modules. Start a local HTTP server from the project root instead.

Using Python:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Run Tests

Install the project's development dependencies if they are not already installed:

```bash
npm install
```

Run the automated test suite:

```bash
npm test
```

## Optional: Enable the Global Leaderboard

The game can run without Supabase. Without it, high scores remain on the user's device.

1. Create a project at [Supabase](https://supabase.com/).
2. Open the SQL Editor and run `supabase/schema.sql`.
3. Configure the Supabase project URL and public anon key in `js/config.js`.
4. Verify that the configured Row Level Security policies restrict database access as intended.

**Security:** Never put a Supabase service-role key in client-side code.

## Project Structure

```text
index.html
css/
  tokens.css
  base.css
  layout.css
  components.css
  screens.css
  animations.css
js/
  main.js
  constants.js
  eventBus.js
  dom.js
  core/
  api/
  storage/
  ui/
supabase/
  schema.sql
  SETUP.md
tests/
package.json
```

The quiz engine is separated from the UI. It manages quiz state and emits events, while UI modules respond to those events and update the page. This separation keeps core game logic independent of DOM rendering.

## Deployment

The live application is hosted on Vercel:

[https://quiz-arena-lovat.vercel.app](https://quiz-arena-lovat.vercel.app)

## Future Improvements

- Additional question sources and categories.
- More detailed performance statistics.
- Further improvements to leaderboard and gameplay testing.
