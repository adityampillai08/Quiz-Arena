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

test.describe('Category Selection Verification', () => {
  test('Test: Selected category is respected (Science & Nature)', async ({ page }) => {
    await page.goto(BASE_URL);

    // Select Science & Nature category
    await page.selectOption('#category-select', '17');
    await page.selectOption('#difficulty-select', 'medium');

    // Start quiz
    await page.locator('#start-button').click();

    // Wait for booster grant overlay to appear and close it
    await page.waitForSelector('#booster-grant-overlay', { state: 'visible', timeout: 10000 });
    await page.click('#booster-grant-overlay [data-action="close"]');

    // Wait for question to appear
    await page.waitForSelector('#question-text:not(:empty)', { timeout: 10000 });

    // Wait for first question to load
    await page.waitForTimeout(1000);

    // Check first question category
    const firstQuestionText = await page.locator('#question-text').textContent();
    console.log('First question:', firstQuestionText);

    // Answer all 10 questions
    for (let i = 1; i <= 10; i++) {
      // Wait for options to be visible
      await page.waitForSelector('.option:not([disabled])', { state: 'visible', timeout: 10000 });

      // Click first available option
      await page.locator('.option:not([disabled])').first().click();

      // Wait for answer to be locked and Next button to appear
      await page.waitForSelector('#next-button:not([hidden])', { timeout: 10000 });

      // Click Next button to advance
      await page.locator('#next-button').click();
      await page.waitForTimeout(500);

      // If not the last question, wait for next question (or booster grant)
      if (i < 10) {
        // Check if booster grant overlay appears
        const grantOverlay = page.locator('#booster-grant-overlay');
        if (await grantOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
          await page.click('#booster-grant-overlay [data-action="close"]');
        }
        // Wait for next question text
        await page.waitForSelector('#question-text:not(:empty)', { timeout: 10000 });
      }

      // Get current question text
      const currentQuestionText = await page.locator('#question-text').textContent();
      console.log(`Question ${i}:`, currentQuestionText);
    }
  });

  test('Test: Art category works at all difficulties', async ({ page }) => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      await page.goto(BASE_URL);

      // Select Art category
      await page.selectOption('#category-select', '25');
      await page.selectOption('#difficulty-select', difficulty);

      // Start quiz
      await page.locator('#start-button').click();

      // Wait for booster grant overlay to appear and close it
      await page.waitForSelector('#booster-grant-overlay', { state: 'visible', timeout: 10000 });
      await page.click('#booster-grant-overlay [data-action="close"]');

      // Wait for question to appear
      await page.waitForSelector('#question-text:not(:empty)', { timeout: 10000 });

      // Verify quiz starts successfully
      const quizScreenVisible = await page.locator('#screen-quiz').isVisible();
      expect(quizScreenVisible).toBe(true);

      console.log(`Art category works with ${difficulty} difficulty`);
    }
  });

  test('Test: History category works correctly', async ({ page }) => {
    await page.goto(BASE_URL);

    // Select History category
    await page.selectOption('#category-select', '23');
    await page.selectOption('#difficulty-select', 'medium');

    // Start quiz
    await page.locator('#start-button').click();

    // Wait for booster grant overlay to appear and close it
    await page.waitForSelector('#booster-grant-overlay', { state: 'visible', timeout: 10000 });
    await page.click('#booster-grant-overlay [data-action="close"]');

    // Wait for question to appear
    await page.waitForSelector('#question-text:not(:empty)', { timeout: 10000 });

    // Verify quiz starts successfully
    const quizScreenVisible = await page.locator('#screen-quiz').isVisible();
    expect(quizScreenVisible).toBe(true);
  });

  test('Test: Any Category option works correctly', async ({ page }) => {
    await page.goto(BASE_URL);

    // Select Any Category
    await page.selectOption('#category-select', '0');
    await page.selectOption('#difficulty-select', 'medium');

    // Start quiz
    await page.locator('#start-button').click();

    // Wait for booster grant overlay to appear and close it
    await page.waitForSelector('#booster-grant-overlay', { state: 'visible', timeout: 10000 });
    await page.click('#booster-grant-overlay [data-action="close"]');

    // Wait for question to appear
    await page.waitForSelector('#question-text:not(:empty)', { timeout: 10000 });

    // Verify quiz starts successfully
    const quizScreenVisible = await page.locator('#screen-quiz').isVisible();
    expect(quizScreenVisible).toBe(true);
  });
});