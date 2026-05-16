const { test } = require('@playwright/test');

const { aiHeal } = require('../ai/ai-healer');

test('Real AI Self Healing Test', async ({ page }) => {

  await page.goto('https://playwright.dev');

  const selectors = [

    'text=Wrong Button',
    '.fake-button',
    '[data-test=missing]',
    'text=Get started'

  ];

  const button = await aiHeal(page, selectors);

  await button.click();

  console.log('🚀 AI self-healing successful');

});