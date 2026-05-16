const fs = require('fs');
const path = require('path');

function generateMultipleTests(url, scanResults) {

  url = url.trim();

  const homepageTest = `
const { test, expect } = require('@playwright/test');

test('Generated Homepage Test', async ({ page }) => {

  await page.goto('${url}');
  await expect(page.locator('body')).toBeVisible();

});
`;

  const buttonsTest = `
const { test, expect } = require('@playwright/test');

test('Generated Buttons Test', async ({ page }) => {

  await page.goto('${url}');

  const buttons = await page.locator('button').count();

  expect(buttons).toBeGreaterThan(0);

});
`;

  const linksTest = `
const { test, expect } = require('@playwright/test');

test('Generated Links Test', async ({ page }) => {

  await page.goto('${url}');

  const links = await page.locator('a').count();

  expect(links).toBeGreaterThan(0);

});
`;

  fs.writeFileSync(
    path.join(__dirname, '../tests/generated-homepage.spec.js'),
    homepageTest
  );

  fs.writeFileSync(
    path.join(__dirname, '../tests/generated-buttons.spec.js'),
    buttonsTest
  );

  fs.writeFileSync(
    path.join(__dirname, '../tests/generated-links.spec.js'),
    linksTest
  );

  return {
    generated: 3
  };

}

module.exports = { generateMultipleTests };