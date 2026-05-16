const { test, expect } = require('@playwright/test');

test('AI Visual Testing', async ({ page }) => {

  await page.goto('https://playwright.dev');

  // Compare screenshot automatically
  await expect(page).toHaveScreenshot('playwright-homepage.png');

  console.log('Visual AI test completed');

});