
const { test, expect } = require('@playwright/test');

test('Generated Homepage Test', async ({ page }) => {

  await page.goto('https://www.wikipedia.org');
  await expect(page.locator('body')).toBeVisible();

});
