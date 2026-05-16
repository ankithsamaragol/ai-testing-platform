const { test, expect } = require('@playwright/test');

test('Failure Detection Demo', async ({ page }) => {

  await page.goto('https://playwright.dev');

  // Intentional failure
  await expect(page.locator('h1'))
      .toContainText('Playwright');

});