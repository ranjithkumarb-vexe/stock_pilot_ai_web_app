import { expect, test } from '@playwright/test';
import { installMockApi } from './support/mockApi';

/** Shell smoke against a mocked API (no backend needed). Real cross-repo journeys live in INT-02 / FE-11. */
test.describe('app shell', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
  });

  test('sign in with a demo account, navigate, toggle theme, open the palette', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);
    await page.getByTestId('signin-priya').click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('page-title')).toHaveText('Dashboard');

    await page.getByTestId('nav-portfolio').click();
    await expect(page).toHaveURL(/\/portfolio$/);

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');

    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByTestId('palette')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('palette')).toBeHidden();
  });

  test('footer carries the disclaimer and 404 works', async ({ page }) => {
    await page.goto('/signin');
    await page.getByTestId('signin-priya').click();
    await expect(page.getByTestId('disclaimer-text')).toContainText(
      'educational research and decision-support tool',
    );
    await page.goto('/nope');
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('mobile: navigation opens as a drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/signin');
    await page.getByTestId('signin-priya').click();
    await page.getByTestId('nav-toggle').click();
    await page.getByTestId('nav-alerts').click();
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(page.getByTestId('mobile-nav')).toBeHidden();
  });
});
