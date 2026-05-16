
const { test, expect } = require('@playwright/test');

test('Generated Links Test', async ({ page }) => {

  await page.goto('https://www.wikipedia.org');

  const links = await page.locator('a').count();

  expect(links).toBeGreaterThan(0);

});
