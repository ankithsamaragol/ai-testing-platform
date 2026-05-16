const { test, expect } = require('@playwright/test');

test('Intentional Failure Demo', async ({ page }) => {

  await page.goto('https://www.wikipedia.org');

  await expect(page.locator('text=This Text Does Not Exist')).toBeVisible({
    timeout: 3000
  });

});