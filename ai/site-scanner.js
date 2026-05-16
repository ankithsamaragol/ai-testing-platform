const { chromium } = require('playwright');

async function scanWebsite(url) {

  const browser = await chromium.launch();

  const page = await browser.newPage();

  await page.goto(url);

  const links = await page.locator('a').allTextContents();

  const buttons = await page.locator('button').allTextContents();

  const inputs = await page.locator('input').count();

  await browser.close();

  return {
    links: links.filter(text => text.trim() !== ''),
    buttons: buttons.filter(text => text.trim() !== ''),
    inputs
  };

}

module.exports = { scanWebsite };