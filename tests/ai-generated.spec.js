
  
const { test, expect } = require('@playwright/test');

test('AI Generated URL Test', async ({ page }) => {

  await page.goto('https://www.wikipedia.org');

  await expect(page.locator('body')).toBeVisible();

  await page.screenshot({
    path: 'screenshots/generated-test.png',
    fullPage: true
  });

  console.log('AI generated test passed for: https://www.wikipedia.org');

});
