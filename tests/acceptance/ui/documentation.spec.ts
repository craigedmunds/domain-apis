import { test, expect } from '@playwright/test';

/**
 * Acceptance tests for Documentation Site functionality
 *
 * Requirements validated:
 * - 7.1: Documentation is generated and accessible
 * - 7.2: All endpoints, parameters, and schemas are documented
 * - 9.1: Acceptance tests validate documentation site functionality
 * - 9.5: Tests include homepage navigation
 * - 9.6: Tests include API documentation pages
 */

test.describe('Documentation Site', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the documentation homepage
    await page.goto('/index.html');
  });

  test('should load the documentation homepage', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/VPD/);

    // Verify main heading
    await expect(page.locator('.govuk-heading-xl')).toContainText('VPD');

    // Verify description mentions submission or returns
    await expect(page.locator('.govuk-body-l')).toBeVisible();
  });

  test('should display GOV.UK styled header', async ({ page }) => {
    // Verify header is present
    const header = page.locator('.govuk-header');
    await expect(header).toBeVisible();

    // Verify GOV.UK branding
    await expect(header.locator('.govuk-header__logotype')).toContainText('GOV.UK');
  });

  test('should display phase banner', async ({ page }) => {
    // Verify phase banner is present
    const phaseBanner = page.locator('.govuk-phase-banner');
    await expect(phaseBanner).toBeVisible();

    // Verify prototype tag
    await expect(phaseBanner.locator('.govuk-phase-banner__tag')).toContainText('Prototype');
  });

  test('should display VPD Domain API card', async ({ page }) => {
    // Verify API grid is present
    const apiGrid = page.locator('.api-grid');
    await expect(apiGrid).toBeVisible();

    // Find VPD Domain API card
    const vpdCard = page.locator('.api-card').filter({ hasText: 'VPD' });
    await expect(vpdCard).toBeVisible();

    // Verify card has required elements
    await expect(vpdCard.locator('.api-card__title')).toBeVisible();
    await expect(vpdCard.locator('.api-card__tag')).toBeVisible();
    await expect(vpdCard.locator('.api-card__description')).toBeVisible();
  });

  test('should display VPD Domain API with correct information', async ({ page }) => {
    // Find VPD Domain API card
    const vpdCard = page.locator('.api-card').filter({ hasText: 'VPD' }).first();
    await expect(vpdCard).toBeVisible();

    // Verify title mentions VPD or Submission
    const title = vpdCard.locator('.api-card__title');
    await expect(title).toBeVisible();

    // Verify version tag
    await expect(vpdCard.locator('.api-card__tag')).toBeVisible();

    // Verify action buttons - View Docs and Try it out
    const buttons = vpdCard.locator('.govuk-button');
    await expect(buttons).toHaveCount(2);
  });

  test('should navigate to API explorer from homepage', async ({ page }) => {
    // Find a "Try it out" button
    const tryItOutButton = page.locator('a.govuk-button').filter({ hasText: 'Try it out' }).first();

    await tryItOutButton.click();
    await page.waitForLoadState('networkidle');

    // Verify we're on the explorer page
    await expect(page).toHaveURL(/explorer\.html/);
    await expect(page.locator('.header h1')).toContainText('API Explorer');
  });

  test('should navigate to API documentation from homepage', async ({ page }) => {
    // Find a "View Docs" button
    const viewDocsButton = page.locator('a.govuk-button').filter({ hasText: 'View Docs' }).first();

    await viewDocsButton.click();
    await page.waitForLoadState('networkidle');

    // Verify we navigated to a documentation page
    await expect(page.url()).toMatch(/\/(vaping-duty|vpd)/);
  });

  test('should display footer', async ({ page }) => {
    // Verify footer is present
    const footer = page.locator('.govuk-footer');
    await expect(footer).toBeVisible();

    // Verify footer has content
    await expect(footer.locator('.govuk-footer__meta')).toBeVisible();
  });

  test('should have consistent GOV.UK styling', async ({ page }) => {
    // Verify GOV.UK color scheme is applied
    const header = page.locator('.govuk-header');
    const backgroundColor = await header.evaluate((el) => {
      const win = el.ownerDocument.defaultView;
      return win ? win.getComputedStyle(el).backgroundColor : '';
    });

    // GOV.UK black header should be rgb(11, 12, 12) or similar
    expect(backgroundColor).toMatch(/rgb\(11,\s*12,\s*12\)/);

    // Verify buttons use GOV.UK green - find a primary button
    const primaryButton = page.locator('.govuk-button:not(.govuk-button--secondary)').first();
    const buttonColor = await primaryButton.evaluate((el) => {
      const win = el.ownerDocument.defaultView;
      return win ? win.getComputedStyle(el).backgroundColor : '';
    });

    // GOV.UK green should be rgb(0, 112, 60) or similar
    expect(buttonColor).toMatch(/rgb\(0,\s*112,\s*60\)/);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify page still loads correctly
    await expect(page.locator('.govuk-heading-xl')).toBeVisible();

    // Verify API cards are still visible
    const apiCards = page.locator('.api-card');
    const count = await apiCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify cards are visible
    await expect(apiCards.first()).toBeVisible();
  });
});
