const { test, expect } = require('@playwright/test');

test('loads the map page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Leagues|Map|OSRS/i);
});
