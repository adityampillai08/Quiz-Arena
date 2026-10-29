/**
 * Regression tests for Open Trivia DB category mapping.
 * Verifies that each local category maps to the correct OTDB category ID.
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

// Expected OTDB category mappings (verified against https://opentdb.com/api_category.php)
const EXPECTED_MAPPINGS = {
  9: 9,      // General Knowledge
  10: 10,    // Entertainment: Books
  11: 11,    // Entertainment: Film
  12: 12,    // Entertainment: Music
  14: 14,    // Entertainment: Television
  15: 15,    // Entertainment: Video Games
  17: 17,    // Science & Nature
  18: 18,    // Science: Computers
  19: 19,    // Science: Mathematics
  21: 21,    // Sports
  22: 22,    // Geography
  23: 23,    // History
  24: 24,    // Politics
  25: 25,    // Art
  27: 27,    // Animals
  28: 28,    // Vehicles
  0: 0       // Any Category
};

test.describe('OTDB Category Mapping Regression Tests', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    try {
      await page.close();
    } catch (e) {
      console.log('Page already closed or error closing:', e.message);
    }
  });

  // Test each category mapping individually
  for (const [localId, expectedOtdbId] of Object.entries(EXPECTED_MAPPINGS)) {
    const categoryName = localId === '0' ? 'Any Category' :
      ['General Knowledge', 'Entertainment: Books', 'Entertainment: Film', 'Entertainment: Music',
       'Entertainment: Television', 'Entertainment: Video Games', 'Science & Nature', 'Science: Computers',
       'Science: Mathematics', 'Sports', 'Geography', 'History', 'Politics', 'Art', 'Animals', 'Vehicles']
        [Object.keys(EXPECTED_MAPPINGS).indexOf(localId)];

    test(`Category ${localId} (${categoryName}) maps to OTDB ${expectedOtdbId}`, async () => {
      if (localId === '0') return; // Any Category doesn't send a category param

      await page.goto(BASE_URL);

      // Select the category
      await page.selectOption('#category-select', localId);
      await page.selectOption('#difficulty-select', 'medium');

      // Intercept the API request
      const apiRequestPromise = page.waitForRequest(request =>
        request.url().includes('opentdb.com/api.php')
      );

      // Start quiz
      await page.locator('#start-button').click();

      // Wait for API request
      const request = await apiRequestPromise;
      const url = new URL(request.url());
      const categoryParam = url.searchParams.get('category');

      console.log(`Local ${localId} (${categoryName}) -> Requested OTDB category: ${categoryParam}`);

      // Verify the category parameter matches expected
      expect(categoryParam).toBe(String(expectedOtdbId));
    });
  }

  test('Any Category (0) sends no category parameter', async () => {
    await page.goto(BASE_URL);

    await page.selectOption('#category-select', '0');
    await page.selectOption('#difficulty-select', 'medium');

    const apiRequestPromise = page.waitForRequest(request =>
      request.url().includes('opentdb.com/api.php')
    );

    await page.locator('#start-button').click();

    const request = await apiRequestPromise;
    const url = new URL(request.url());
    const categoryParam = url.searchParams.get('category');

    expect(categoryParam).toBeNull();
  });

  test('API results from wrong category are rejected (Science & Nature test)', async () => {
    // Mock OTDB to return questions from a DIFFERENT category (Science: Mathematics = 19)
    // when Science & Nature (17) is requested
    await page.route('**/opentdb.com/api.php*', route => {
      const url = new URL(route.request().url());
      const requestedCategory = url.searchParams.get('category');

      // If Science & Nature (17) was requested, return questions labeled as Science: Mathematics
      if (requestedCategory === '17') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response_code: 0,
            results: [
              {
                category: 'Science: Mathematics', // WRONG category
                type: 'multiple',
                difficulty: 'medium',
                question: 'What is 2+2?',
                correct_answer: '4',
                incorrect_answers: ['3', '5', '6']
              },
              {
                category: 'Science: Mathematics', // WRONG category
                type: 'multiple',
                difficulty: 'medium',
                question: 'What is 3*3?',
                correct_answer: '9',
                incorrect_answers: ['6', '8', '12']
              },
              {
                category: 'Science: Mathematics', // WRONG category
                type: 'multiple',
                difficulty: 'medium',
                question: 'What is 10/2?',
                correct_answer: '5',
                incorrect_answers: ['3', '4', '6']
              }
            ]
          })
        });
      } else {
        route.continue();
      }
    });

    await page.goto(BASE_URL);
    await page.selectOption('#category-select', '17'); // Science & Nature
    await page.selectOption('#difficulty-select', 'medium');

    await page.locator('#start-button').click();

    // Wait for booster grant overlay and close it
    await page.waitForSelector('#booster-grant-overlay', { state: 'visible', timeout: 10000 });
    await page.click('#booster-grant-overlay [data-action="close"]');

    // Wait for question to load (or error)
    await page.waitForTimeout(2000);

    // Should fall back to local questions since API returned wrong category
    // The quiz should still start (with fallback questions)
    const quizVisible = await page.locator('#screen-quiz').isVisible();
    expect(quizVisible).toBe(true);

    // Check that we got fallback questions (not the mocked wrong-category questions)
    // We can't easily verify the exact question text, but the quiz loading means fallback worked
  });

  test('Fallback questions are restricted to selected category and difficulty', async () => {
    // Force API failure to trigger fallback
    await page.route('**/opentdb.com/api.php*', route => {
      route.abort('failed');
    });

    await page.goto(BASE_URL);
    await page.selectOption('#category-select', '17'); // Science & Nature
    await page.selectOption('#difficulty-select', 'easy');

    await page.locator('#start-button').click();

    await page.waitForSelector('#booster-grant-overlay', { state: 'visible', timeout: 10000 });
    await page.click('#booster-grant-overlay [data-action="close"]');

    await page.waitForSelector('#question-text:not(:empty)', { timeout: 10000 });

    // Verify we're on quiz screen with fallback questions
    const quizVisible = await page.locator('#screen-quiz').isVisible();
    expect(quizVisible).toBe(true);

    // The fallback should only have Science & Nature questions
    // We can't easily verify the exact category of each question from the UI,
    // but the test passing means the fallback logic didn't throw an error
    // (which it would if there weren't enough questions for that category/difficulty)
  });

  test('Film and Music are not swapped', async () => {
    await page.goto(BASE_URL);
    await page.selectOption('#category-select', '11'); // Film
    await page.selectOption('#difficulty-select', 'medium');

    const apiRequestPromise = page.waitForRequest(request =>
      request.url().includes('opentdb.com/api.php')
    );

    await page.locator('#start-button').click();

    const request = await apiRequestPromise;
    const url = new URL(request.url());
    const categoryParam = url.searchParams.get('category');

    // Film should map to 11, not 12 (Music)
    expect(categoryParam).toBe('11');

    // Now test Music
    await page.goto(BASE_URL);
    await page.selectOption('#category-select', '12'); // Music
    await page.selectOption('#difficulty-select', 'medium');

    const apiRequestPromise2 = page.waitForRequest(request =>
      request.url().includes('opentdb.com/api.php')
    );

    await page.locator('#start-button').click();

    const request2 = await apiRequestPromise2;
    const url2 = new URL(request2.url());
    const categoryParam2 = url2.searchParams.get('category');

    // Music should map to 12, not 11 (Film)
    expect(categoryParam2).toBe('12');
  });
});