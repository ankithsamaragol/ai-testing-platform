const { test, expect } = require('@playwright/test');

test('AI Search Bot', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('https://playwright.dev', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await expect(page.locator('h1')).toContainText('Playwright', {
    timeout: 15000
  });

  await page.getByRole('link', { name: /get started/i }).first().click();

  await expect(page).toHaveURL(/.*intro.*/, {
    timeout: 15000
  });

  await expect(page.locator('body')).toContainText('Installation', {
    timeout: 15000
  });

  try {
    await page.screenshot({
      path: 'playwright-page.png',
      fullPage: false,
      timeout: 10000
    });
  } catch (err) {
    console.log('Screenshot skipped:', err.message);
  }

  console.log('AI automation test successful');
});