/**
 * Regression tests for Results screen navigation:
 * - Global Leaderboard button
 * - Play Again button
 */
const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const net = require('net');

function getFreePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

let PORT, BASE_URL, server;

test.beforeAll(async () => {
  PORT = await getFreePort();
  BASE_URL = `http://localhost:${PORT}`;
  server = exec(`python -m http.server ${PORT}`, { cwd: process.cwd() });
  await new Promise(resolve => setTimeout(resolve, 1000));
});

test.afterAll(() => {
  if (server && !server.killed) server.kill();
});

// Mock Open Trivia DB responses
const mockCategories = {
  trivia_categories: [
    { id: 9, name: 'General Knowledge' },
    { id: 10, name: 'Entertainment: Books' },
    { id: 11, name: 'Entertainment: Film' }
  ]
};

const mockQuestions = {
  response_code: 0,
  results: [
    { category: 'General Knowledge', type: 'multiple', difficulty: 'medium', question: 'What is the capital of France?', correct_answer: 'Paris', incorrect_answers: ['London', 'Berlin', 'Madrid'] },
    { category: 'Entertainment: Books', type: 'multiple', difficulty: 'hard', question: 'Who wrote "1984"?', correct_answer: 'George Orwell', incorrect_answers: ['Aldous Huxley', 'Ray Bradbury', 'J.R.R. Tolkien'] },
    { category: 'Entertainment: Film', type: 'multiple', difficulty: 'medium', question: 'Which movie won the first Academy Award for Best Picture?', correct_answer: 'Wings', incorrect_answers: ['Sunrise', 'The Jazz Singer', 'The Crowd'] },
    { category: 'General Knowledge', type: 'multiple', difficulty: 'easy', question: 'What is 2 + 2?', correct_answer: '4', incorrect_answers: ['3', '5', '6'] },
    { category: 'Entertainment: Books', type: 'multiple', difficulty: 'medium', question: 'In "Harry Potter", what is the name of the train station?', correct_answer: 'King\'s Cross', incorrect_answers: ['Victoria', 'Paddington', 'Euston'] },
    { category: 'General Knowledge', type: 'multiple', difficulty: 'hard', question: 'What is the chemical symbol for gold?', correct_answer: 'Au', incorrect_answers: ['Ag', 'Fe', 'Cu'] },
    { category: 'Entertainment: Film', type: 'multiple', difficulty: 'medium', question: 'Who directed "Pulp Fiction"?', correct_answer: 'Quentin Tarantino', incorrect_answers: ['Martin Scorsese', 'Steven Spielberg', 'Christopher Nolan'] },
    { category: 'General Knowledge', type: 'multiple', difficulty: 'easy', question: 'What is the largest planet in our solar system?', correct_answer: 'Jupiter', incorrect_answers: ['Saturn', 'Neptune', 'Uranus'] },
    { category: 'Entertainment: Books', type: 'multiple', difficulty: 'hard', question: 'Who wrote "Pride and Prejudice"?', correct_answer: 'Jane Austen', incorrect_answers: ['Charlotte Bronte', 'Emily Bronte', 'Mary Shelley'] },
    { category: 'General Knowledge', type: 'multiple', difficulty: 'medium', question: 'What year did World War II end?', correct_answer: '1945', incorrect_answers: ['1944', '1946', '1939'] }
  ]
};

async function dismissBoosterOverlay(page) {
  // Wait for and dismiss the booster grant overlay
  try {
    const overlayBtn = page.locator('#booster-grant-overlay [data-action="close"]');
    await overlayBtn.waitFor({ state: 'visible', timeout: 8000 });
    await overlayBtn.click();
  } catch (e) {
    // Overlay may not appear (e.g. if boosters disabled)
  }
}

async function startQuizAndDismissOverlay(page) {
  await page.locator('#start-button').click();
  await dismissBoosterOverlay(page);
  // Wait for options to be ready
  await page.waitForSelector('.option[data-index="0"]:not([disabled])', { timeout: 5000 });
}

test.describe('Leaderboard Navigation Regression', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Mock API calls
    await page.route('**/api_category.php', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCategories)
      });
    });

    await page.route('**/opentdb.com/api.php?**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQuestions)
      });
    });

    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    try {
      await page.close();
    } catch (e) {
      console.log('Page already closed or error closing:', e.message);
    }
  });

  test('Leaderboard opens from Results screen after completing quiz', async () => {
    await startQuizAndDismissOverlay(page);

    for (let q = 1; q <= 10; q++) {
      await page.waitForSelector('.option[data-index="0"]:not([disabled])', { timeout: 5000 });
      await page.locator('.option[data-index="0"]').click();
      await page.waitForSelector('#next-button:not([hidden])', { timeout: 5000 });
      await page.locator('#next-button').click();
      await page.waitForTimeout(200);
      // Check for second booster grant before Q6
      if (q === 5) {
        await dismissBoosterOverlay(page);
      }
    }

    await page.locator('#view-leaderboard-button').click();
    await expect(page.locator('#screen-leaderboard')).toBeVisible({ timeout: 5000 });
  });

  test('Play Again from Results screen returns to Start screen', async () => {
    await startQuizAndDismissOverlay(page);

    for (let q = 1; q <= 10; q++) {
      await page.waitForSelector('.option[data-index="0"]:not([disabled])', { timeout: 5000 });
      await page.locator('.option[data-index="0"]').click();
      await page.waitForSelector('#next-button:not([hidden])', { timeout: 5000 });
      await page.locator('#next-button').click();
      await page.waitForTimeout(200);
      // Check for second booster grant before Q6
      if (q === 5) {
        await dismissBoosterOverlay(page);
      }
    }

    await page.locator('#play-again-button').click();
    await expect(page.locator('#screen-start')).toBeVisible({ timeout: 5000 });
  });

  test('Global Leaderboard navigation still works from Results', async () => {
    await startQuizAndDismissOverlay(page);

    for (let q = 1; q <= 10; q++) {
      await page.waitForSelector('.option[data-index="0"]:not([disabled])', { timeout: 5000 });
      await page.locator('.option[data-index="0"]').click();
      await page.waitForSelector('#next-button:not([hidden])', { timeout: 5000 });
      await page.locator('#next-button').click();
      await page.waitForTimeout(200);
      // Check for second booster grant before Q6
      if (q === 5) {
        await dismissBoosterOverlay(page);
      }
    }

    // Click Leaderboard button
    await page.locator('#view-leaderboard-button').click();
    await expect(page.locator('#screen-leaderboard')).toBeVisible({ timeout: 5000 });

    // Click Back button - should return to Results screen (where we came from)
    await page.locator('#leaderboard-back').click();
    await expect(page.locator('#screen-result')).toBeVisible({ timeout: 5000 });
  });
});