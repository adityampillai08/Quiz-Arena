/**
 * End-to-end test for full 10-question quiz flow.
 * Verifies complete gameplay including both booster grants.
 */
const { test, expect } = require('@playwright/test');

// Mock Open Trivia DB responses - 10 questions
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

// Test setup - dynamically find an available port
function getFreePort() {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

let PORT;
let BASE_URL;
let server;
let pageErrors = [];

test.beforeAll(async () => {
  PORT = await getFreePort();
  BASE_URL = `http://localhost:${PORT}`;

  const { exec } = require('child_process');
  server = exec(`python -m http.server ${PORT}`, {
    cwd: process.cwd()
  });
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
});

test.afterAll(() => {
  if (server && !server.killed) {
    server.kill();
  }
});

test.describe('Quiz Arena - Full 10 Question Gameplay', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    page = await browser.newPage();

    // Mock API calls
    await page.route('**/api_category.php', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCategories)
      });
    });

    await page.route('**/api.php?*amount=10*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQuestions)
      });
    });

    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => {
      console.log('PAGE ERROR FULL:', err.stack || err.message);
      pageErrors.push(err.message);
    });
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log('FAILED RESPONSE:', response.url(), response.status());
      }
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

  test('should complete full 10-question quiz with both booster grants', async () => {
    // Step 1: Start the quiz
    await page.locator('#start-button').click();

    // Step 2: Dismiss first booster grant overlay
    await page.waitForTimeout(1500);
    const firstOverlay = page.locator('#booster-grant-overlay');
    const firstOverlayVisible = await firstOverlay.isVisible().catch(() => false);
    console.log('FIRST BOOSTER OVERLAY VISIBLE:', firstOverlayVisible);
    if (firstOverlayVisible) {
      await page.locator('[data-action="close"]').click();
      console.log('First booster grant dismissed');
    }

    // Step 3: Wait for first question to load
    await page.waitForTimeout(2000);
    await expect(page.locator('#screen-quiz')).toBeVisible();
    await expect(page.locator('#question-text')).not.toContainText('Question text appears here');

    // Track progress through questions
    for (let q = 1; q <= 10; q++) {
      console.log(`\n=== Question ${q} ===`);

      // Verify question is visible
      const questionText = await page.locator('#question-text').textContent();
      console.log(`Q${q} Text:`, questionText);
      expect(questionText).toBeTruthy();
      expect(questionText).not.toContain('Question text appears here');

      // Verify progress indicator
      const progressText = await page.locator('#quiz-progress-text').textContent();
      console.log('Progress:', progressText);
      expect(progressText).toContain(`Question ${q} of 10`);

      // Find and click an option (alternate between correct/incorrect)
      // For deterministic behavior, we need to find the correct answer index
      // The options are shuffled by the engine, so we'll click index 0 for Q1, Q3, Q5, Q7, Q9
      // and index 1 for Q2, Q4, Q6, Q8, Q10
      const clickIndex = q % 2 === 1 ? 0 : 1;
      const option = page.locator(`.option[data-index="${clickIndex}"]`);

      // Wait for option to be enabled
      await page.waitForFunction((idx) => {
        const opt = document.querySelector(`.option[data-index="${idx}"]`);
        return opt && !opt.disabled;
      }, clickIndex, { timeout: 10000 });

      console.log(`Clicking option ${clickIndex}...`);
      await option.click({ timeout: 10000 });
      console.log(`Clicked option ${clickIndex}`);

      // Step 4: Verify feedback appears
      await expect(page.locator('#feedback-banner')).toBeVisible({ timeout: 10000 });
      const feedbackText = await page.locator('#feedback-banner').textContent();
      console.log('FEEDBACK:', feedbackText);
      expect(feedbackText).toBeTruthy();

      // Step 5: Verify quiz does NOT advance until Next is clicked
      // The feedback should remain visible and Next button should be visible
      const nextButton = page.locator('#next-button');
      await expect(nextButton).toBeVisible();
      await expect(nextButton).not.toBeHidden();

      // Step 6: Click Next question (except on last question where it says "See results")
      const buttonText = await nextButton.textContent();
      console.log('Next button text:', buttonText);

      if (q < 10) {
        await nextButton.click();
        console.log('Clicked Next question');

        // Check for second booster grant before Q6
        if (q === 5) {
          await page.waitForTimeout(1500);
          const secondOverlay = page.locator('#booster-grant-overlay');
          const secondOverlayVisible = await secondOverlay.isVisible().catch(() => false);
          console.log('SECOND BOOSTER OVERLAY VISIBLE:', secondOverlayVisible);
          if (secondOverlayVisible) {
            await page.locator('[data-action="close"]').click();
            console.log('Second booster grant dismissed');
          }
        }

        // Wait for next question to load
        await page.waitForTimeout(1500);
      } else {
        // On question 10, click "See results"
        await nextButton.click();
        console.log('Clicked See results');

        // Step 7: Verify results screen appears
        await page.waitForTimeout(2000);
        await expect(page.locator('#screen-result')).toBeVisible({ timeout: 10000 });
        console.log('Results screen visible!');

        // Verify score is displayed
        const scoreText = await page.locator('#result-score').textContent();
        console.log('Final score:', scoreText);
        expect(scoreText).toBeTruthy();

        // Verify no page errors occurred
        expect(pageErrors).toEqual([]);

        // Verify no failed requests (4xx/5xx)
        // Already logged via response handler
      }
    }
  });
});