# Quiz Arena

A quiz game that pulls fresh multiple-choice questions from the [Open Trivia DB](https://opentdb.com/api_config.php). Pick a category and a difficulty, answer 10 questions against a 15-second clock, and see how you rank.

**Live site:** [https://quiz-arena-lovat.vercel.app](https://quiz-arena-lovat.vercel.app)

## What it does

- Start screen with category and difficulty dropdowns (categories load from the API)
- 10 questions, one at a time, with shuffled options
- Green or red feedback as soon as you answer, then a Next button
- "Question X of 10" progress and a 15-second timer per question (running out counts as wrong)
- Score with a speed bonus and a streak bonus
- Final screen with your score, accuracy and a **Play Again** button
- Review of every question you got wrong, showing your answer and the right one
- High scores saved in `localStorage`
- Optional global leaderboard through Supabase

## Tech

HTML, CSS and vanilla JavaScript (ES modules, no build step). Open Trivia DB for questions, Supabase for the global leaderboard.

## Run it locally

ES modules need a server, so opening `index.html` by double-click won't work.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Turn on the global leaderboard (optional)

The game works without this; scores just stay on your device.

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy the project URL and the **anon** key (Project Settings → API) into `js/config.js`.

Only use the anon key. The row-level-security policies in `schema.sql` allow reading and inserting scores only.

## Project layout

```
index.html
css/        tokens, base, layout, components, screens, animations
js/
  main.js        controller that wires everything together
  constants.js   shared settings and event names
  eventBus.js    tiny publish/subscribe helper
  dom.js         small DOM helpers
  core/          scoring, timer, quiz engine (no DOM code)
  api/           Open Trivia DB client
  storage/       localStorage, Supabase client, score service
  ui/            start, question, timer, result, review, leaderboard views
supabase/   schema.sql and setup notes
```

The engine knows nothing about the page. It emits events (question shown, timer tick, answer locked, quiz finished) and the views listen. That kept the game logic separate from the UI.

## Deploy

GitHub Pages: repo Settings → Pages → deploy from branch `main`, folder `/ (root)`.

## Boosters

The game includes 10 unique boosters:

- **Double Up**: Doubles points on correct answers
- **Double Jeopardy**: Doubles points on correct answers, deducts base points on wrong answers
- **Eraser**: Removes one wrong option
- **50/50**: Removes two wrong options
- **Time Freeze**: Pauses the timer
- **Extra Time**: Adds 10 seconds to the clock
- **Second Chance**: Allows one retry on wrong answers
- **Streak Saver**: Preserves streak on wrong answers
- **Quick Draw**: Triples time bonus on correct answers
- **Pass**: Skips the question

All boosters are activated through the UI and have their effects applied correctly.
