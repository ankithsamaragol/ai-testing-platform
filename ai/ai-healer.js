async function aiHeal(page, selectors) {

  for (const selector of selectors) {

    try {

      const element = page.locator(selector);

      await element.waitFor({
        timeout: 2000
      });

      console.log(`✅ AI found working selector: ${selector}`);

      return element;

    } catch {

      console.log(`❌ Failed selector: ${selector}`);

    }

  }

  throw new Error('AI could not heal selector');

}

module.exports = { aiHeal };