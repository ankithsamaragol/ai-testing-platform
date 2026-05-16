
const { test, expect } = require('@playwright/test');

test('Generated Buttons Test', async ({ page }) => {

  await page.goto('https://www.wikipedia.org');

  const buttons = await page.locator('button').count();

  expect(buttons).toBeGreaterThan(0);

});
