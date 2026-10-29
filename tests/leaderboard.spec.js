/**
 * Regression test for Global Leaderboard bug.
 * Verifies that clicking the Leaderboard button from Results screen
 * actually shows the leaderboard screen.
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
    // Q1
    {
      category: 'General Knowledge',
      type: 'multiple',
      difficulty: 'medium',
      question: 'What is the capital of France?',
      correct_answer: 'Paris',
      incorrect_answers: ['London', 'Berlin', 'Madrid']
    },
    // Q2
    {
      category: 'Entertainment: Books',
      type: 'multiple',
      difficulty: 'hard',
      question: 'Who wrote "1984"?',
      correct_answer: 'George Orwell',
      incorrect_answers: ['Aldous Huxley', 'Ray Bradbury', 'J.R.R. Tolkien']
    },
    // Q3
    {
      category: 'Entertainment: Film',
      type: 'multiple',
      difficulty: 'medium',
      question: 'Which movie won the first Academy Award for Best Picture?',
      correct_answer: 'Wings',
      incorrect_answers: ['Sunrise', 'The Jazz Singer', 'The Crowd']
    },
    // Q4
    {
      category: 'General Knowledge',
      type: 'multiple',
      difficulty: 'easy',
      question: 'What is 2 + 2?',
      correct_answer: '4',
      incorrect_answers: ['3', '5', '6']
    },
    // Q5
    {
      category: 'Entertainment: Books',
      type: 'multiple',
      difficulty: 'medium',
      question: 'In "Harry Potter", what is the name of the train station?',
      correct_answer: 'King\'s Cross',
      incorrect_answers: ['Victoria', 'Paddington', 'Euston']
    },
    // Q6
    {
      category: 'General Knowledge',
      type: 'multiple',
      difficulty: 'hard',
      question: 'What is the chemical symbol for gold?',
      correct_answer: 'Au',
      incorrect_answers: ['Ag', 'Fe', 'Cu']
    },
    // Q7
    {
      category: 'Entertainment: Film',
      type: 'multiple',
      difficulty: 'medium',
      question: 'Who directed "Pulp Fiction"?',
      correct_answer: 'Quentin Tarantino',
      incorrect_answers: ['Martin Scorsese', 'Steven Spielberg', 'Christopher Nolan']
    },
    // Q8
    {
      category: 'General Knowledge',
      type: 'multiple',
      difficulty: 'easy',
      question: 'What is the largest planet in our solar system?',
      correct_answer: 'Jupiter',
      incorrect_answers: ['Saturn', 'Neptune', 'Uranus']
    },
    // Q9
    {
      category: 'Entertainment: Books',
      type: 'multiple',
      difficulty: 'hard',
      question: 'Who wrote "Pride and Prejudice"?',
      correct_answer: 'Jane Austen',
      incorrect_answers: ['Charlotte Bronte', 'Emily Bronte', 'Mary Shelley']
    },
    // Q10
    {
      category: 'General Knowledge',
      type: 'multiple',
      difficulty: 'medium',
      question: 'What year did World War II end?',
      correct_answer: '1945',
      incorrect_answers: ['1944', '1946', '1939']
    }
  ]
};

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

    await page.route('**/opentdb.com/api.php?*amount=10*', route => {
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
    // Start quiz
    await page.locator('#start-button').click();

    // Dismiss booster grant overlay
    await page.waitForTimeout(1500);
    const firstOverlay = page.locator('#booster-grant-overlay');
    const firstOverlayVisible = await firstOverlay.isVisible().catch(() => false);
    if (firstOverlayVisible) {
      await page.locator('[data-action="close"]').click();
    }

    // Wait for first question
    await page.waitForTimeout(2000);
    await expect(page.locator('#screen-quiz')).toBeVisible();

    // Answer all 10 questions
    for (let q = 1; q <= 10; q++) {
      // Wait for option to be enabled
      await page.waitForFunction((idx) => {
        const opt = document.querySelector(`.option[data-index="${idx}"]`);
        return opt && !opt.disabled;
      }, 0, { timeout: 10000 });

      // Click option 0
      const option = page.locator('.option[data-index="0"]');
      await option.click({ timeout: 10000 });

      // Wait for feedback and next button
      await page.waitForSelector('#next-button:not([hidden])', { timeout: 10000 });

      if (q < 10) {
        await page.locator('#next-button').click();

        // Check for second booster grant before Q6
        if (q === 5) {
          await page.waitForTimeout(1500);
          const secondOverlay = page.locator('#booster-grant-overlay');
          const secondOverlayVisible = await secondOverlay.isVisible().catch(() => false);
          if (secondOverlayVisible) {
            await page.locator('[data-action="close"]').click();
          }
        }

        // Wait for next question to load
        await page.waitForTimeout(1500);
      } else {
        // Last question - click "See results"
        await page.locator('#next-button').click();
      }
    }

    // Verify results screen is visible
    await expect(page.locator('#screen-result')).toBeVisible({ timeout: 10000 });
    console.log('Results screen visible');

    // Click the Leaderboard button on Results screen
    const leaderboardButton = page.locator('#view-leaderboard-button');
    await expect(leaderboardButton).toBeVisible();
    await leaderboardButton.click();
    console.log('Clicked Leaderboard button');

    // Verify leaderboard screen becomes visible
    await expect(page.locator('#screen-leaderboard')).toBeVisible({ timeout: 5000 });
    console.log('Leaderboard screen visible - PASS');

    // Verify leaderboard tabs are present
    await expect(page.locator('#tab-local')).toBeVisible();
    await expect(page.locator('#tab-global')).toBeVisible();
  });

  test('Leaderboard opens from Start screen', async () => {
    await page.goto(BASE_URL);

    // Click Leaderboard button on Start screen
    const leaderboardButton = page.locator('#open-leaderboard');
    await expect(leaderboardButton).toBeVisible();
    await leaderboardButton.click();
    console.log('Clicked Leaderboard button from Start');

    // Verify leaderboard screen becomes visible
    await expect(page.locator('#screen-leaderboard')).toBeVisible({ timeout: 5000 });
    console.log('Leaderboard screen visible from Start - PASS');
  });

  test('Back button returns to previous screen', async () => {
    await page.goto(BASE_URL);

    // Click Leaderboard button on Start screen
    await page.locator('#open-leaderboard').click();

    // Verify leaderboard screen is visible
    await expect(page.locator('#screen-leaderboard')).toBeVisible({ timeout: 5000 });

    // Click Back button
    await page.locator('#leaderboard-back').click();
    console.log('Clicked Back button');

    // Verify we return to Start screen
    await expect(page.locator('#screen-start')).toBeVisible({ timeout: 5000 });
    console.log('Returned to Start screen - PASS');
  });

  test('Back button from leaderboard after Results returns to Results', async () => {
    // Start quiz
    await page.locator('#start-button').click();

    // Dismiss booster grant overlay
    await page.waitForTimeout(1500);
    const firstOverlay = page.locator('#booster-grant-overlay');
    const firstOverlayVisible = await firstOverlay.isVisible().catch(() => false);
    if (firstOverlayVisible) {
      await page.locator('[data-action="close"]').click();
    }

    // Wait for first question
    await page.waitForTimeout(2000);
    await expect(page.locator('#screen-quiz')).toBeVisible();

    // Answer all 10 questions
    for (let q = 1; q <= 10; q++) {
      // Wait for option to be enabled
      await page.waitForFunction((idx) => {
        const opt = document.querySelector(`.option[data-index="${idx}"]`);
        return opt && !opt.disabled;
      }, 0, { timeout: 10000 });

      // Click option 0
      const option = page.locator('.option[data-index="0"]');
      await option.click({ timeout: 10000 });

      // Wait for feedback and next button
      await page.waitForSelector('#next-button:not([hidden])', { timeout: 10000 });

      if (q < 10) {
        await page.locator('#next-button').click();

        // Check for second booster grant before Q6
        if (q === 5) {
          await page.waitForTimeout(1500);
          const secondOverlay = page.locator('#booster-grant-overlay');
          const secondOverlayVisible = await secondOverlay.isVisible().catch(() => false);
          if (secondOverlayVisible) {
            await page.locator('[data-action="close"]').click();
          }
        }

        // Wait for next question to load
        await page.waitForTimeout(1500);
      } else {
        // Last question - click "See results"
        await page.locator('#next-button').click();
      }
    }

    // Verify results screen
    await expect(page.locator('#screen-result')).toBeVisible({ timeout: 10000 });

    // Click Leaderboard
    await page.locator('#view-leaderboard-button').click();
    await expect(page.locator('#screen-leaderboard')).toBeVisible({ timeout: 5000 });

    // Click Back
    await page.locator('#leaderboard-back').click();

    // Should return to Results screen
    await expect(page.locator('#screen-result')).toBeVisible({ timeout: 5000 });
    console.log('Returned to Results screen - PASS');
  });
});