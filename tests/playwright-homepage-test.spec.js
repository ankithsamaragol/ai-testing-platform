
const { test, expect } = require('@playwright/test');

test('Playwright Homepage Test', async ({ page }) => {

  await page.goto('https://playwright.dev');

  await expect(page.locator('body'))
    .toContainText('Playwright');

  await page.screenshot({
    path: 'screenshots/playwright-homepage-test.png',
    fullPage: true
  });

  console.log('AI generated test executed');

});
