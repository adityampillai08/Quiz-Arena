const { test, expect } = require('@playwright/test');

test.describe('Capture submission screenshots', () => {
  test('1. Start screen', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await expect(page).toHaveTitle(/Quiz Arena/);
    await expect(page.locator('#screen-start')).toBeVisible();
    await page.screenshot({ path: 'screenshots/start-screen.png', fullPage: true });
  });

  test('2. Question screen', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.locator('#start-button').click();
    await page.waitForSelector('#screen-quiz', { state: 'visible' });
    await expect(page.locator('#timer')).toBeVisible();
    await expect(page.locator('#question-text')).toBeVisible();
    await expect(page.locator('.option')).toHaveCount(4);
    await page.screenshot({ path: 'screenshots/question-screen.png', fullPage: true });
  });

  test('3. Booster grant overlay', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.locator('#start-button').click();
    await page.waitForSelector('#screen-quiz', { state: 'visible' });
    await page.waitForSelector('#booster-grant-overlay', { state: 'visible' });
    await page.screenshot({ path: 'screenshots/booster-grant-overlay.png', fullPage: true });
  });

  test('4. Results with review', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.locator('#start-button').click();
    // Answer first 5 wrong, last 5 correct to get review items
    for (let i = 0; i < 5; i++) {
      await page.locator('.option').first().click();
      await page.waitForTimeout(300);
    }
    for (let i = 0; i < 5; i++) {
      await page.locator('.option').last().click();
      await page.waitForTimeout(300);
    }
    await page.waitForSelector('#screen-result', { state: 'visible' });
    await expect(page.locator('#review-list')).not.toBeHidden();
    await page.screenshot({ path: 'screenshots/results-review.png', fullPage: true });
  });

  test('5. Leaderboard', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.locator('#open-leaderboard').click();
    await page.waitForSelector('#screen-leaderboard', { state: 'visible' });
    await page.screenshot({ path: 'screenshots/leaderboard.png', fullPage: true });
  });
});
