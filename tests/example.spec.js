const { test, expect } = require('@playwright/test');

test('AI Search Bot', async ({ page }) => {

  // Open Playwright website
  await page.goto('https://playwright.dev');

  // Wait for page load
  await page.waitForLoadState('networkidle');

  // Verify heading exists
  await expect(
    page.locator('h1')
  ).toContainText('Playwright');

  // Click Get Started
  await page.click('text=Get started');

  // Wait for next page
  await page.waitForLoadState('networkidle');

  // Verify installation text exists
  await expect(page.locator('body'))
     .toContainText('Get started');

  // Take screenshot
  await page.screenshot({
    path: 'playwright-page.png',
    fullPage: true
  });

  console.log('AI automation test successful');

});