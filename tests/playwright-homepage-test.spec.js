const { test, expect } = require('@playwright/test');

test('Playwright Homepage Test', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('https://playwright.dev', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await expect(page.locator('body')).toContainText('Playwright', {
    timeout: 15000
  });

  try {
    await page.screenshot({
      path: 'screenshots/playwright-homepage-test.png',
      fullPage: false,
      timeout: 10000
    });
  } catch (err) {
    console.log('Screenshot skipped:', err.message);
  }

  console.log('AI generated test executed');
});