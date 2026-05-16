const fs = require('fs');
const path = require('path');

function generateTest(url) {
  url = url.trim();
  const testCode = `
  
const { test, expect } = require('@playwright/test');

test('AI Generated URL Test', async ({ page }) => {

  await page.goto('${url}');

  await expect(page.locator('body')).toBeVisible();

  await page.screenshot({
    path: 'screenshots/generated-test.png',
    fullPage: true
  });

  console.log('AI generated test passed for: ${url}');

});
`;

  const filePath = path.join(
    __dirname,
    '../tests/ai-generated.spec.js'
  );

  fs.writeFileSync(filePath, testCode);

  return testCode;

}

module.exports = { generateTest };