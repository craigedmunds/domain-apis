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
    await expect(page).toHaveTitle(/Domain API POC/);
    
    // Verify main heading
    await expect(page.locator('.govuk-heading-xl')).toContainText('Domain API Documentation');
    
    // Verify description
    await expect(page.locator('.govuk-body-l')).toContainText('Multi-API architecture');
  });

  test('should display GOV.UK styled header', async ({ page }) => {
    // Verify header is present
    const header = page.locator('.govuk-header');
    await expect(header).toBeVisible();
    
    // Verify GOV.UK branding
    await expect(header.locator('.govuk-header__logotype')).toContainText('GOV.UK');
    
    // Verify service name
    await expect(header.locator('.govuk-header__service-name')).toContainText('Domain API POC');
  });

  test('should display phase banner', async ({ page }) => {
    // Verify phase banner is present
    const phaseBanner = page.locator('.govuk-phase-banner');
    await expect(phaseBanner).toBeVisible();
    
    // Verify prototype tag
    await expect(phaseBanner.locator('.govuk-phase-banner__tag')).toContainText('Prototype');
    
    // Verify banner text
    await expect(phaseBanner.locator('.govuk-phase-banner__text')).toContainText('proof-of-concept');
  });

  test('should display all three API cards', async ({ page }) => {
    // Verify API grid is present
    const apiGrid = page.locator('.api-grid');
    await expect(apiGrid).toBeVisible();
    
    // Verify all three API cards are present
    const apiCards = page.locator('.api-card');
    await expect(apiCards).toHaveCount(3);
    
    // Verify each API card has required elements
    for (let i = 0; i < 3; i++) {
      const card = apiCards.nth(i);
      await expect(card.locator('.api-card__title')).toBeVisible();
      await expect(card.locator('.api-card__tag')).toBeVisible();
      await expect(card.locator('.api-card__description')).toBeVisible();
      await expect(card.locator('.api-card__endpoint')).toBeVisible();
      await expect(card.locator('.api-card__features')).toBeVisible();
    }
  });

  test('should display Taxpayer API card with correct information', async ({ page }) => {
    // Find Taxpayer API card
    const taxpayerCard = page.locator('.api-card').filter({ hasText: 'Taxpayer API' });
    await expect(taxpayerCard).toBeVisible();
    
    // Verify title
    await expect(taxpayerCard.locator('.api-card__title')).toContainText('Taxpayer API');
    
    // Verify version
    await expect(taxpayerCard.locator('.api-card__tag')).toContainText('v1.0.0');
    
    // Verify endpoint
    await expect(taxpayerCard.locator('.api-card__endpoint')).toContainText('/taxpayer/v1');
    
    // Verify features
    const features = taxpayerCard.locator('.api-card__features li');
    await expect(features).toHaveCount(4);
    await expect(features.nth(0)).toContainText('Taxpayer registration');
    await expect(features.nth(1)).toContainText('NINO validation');
    
    // Verify action buttons
    await expect(taxpayerCard.locator('a[href="taxpayer/index.html"]')).toBeVisible();
    await expect(taxpayerCard.locator('a[href="explorer.html?api=taxpayer"]')).toBeVisible();
  });

  test('should display Income Tax API card with correct information', async ({ page }) => {
    // Find Income Tax API card
    const incomeTaxCard = page.locator('.api-card').filter({ hasText: 'Income Tax API' });
    await expect(incomeTaxCard).toBeVisible();
    
    // Verify title
    await expect(incomeTaxCard.locator('.api-card__title')).toContainText('Income Tax API');
    
    // Verify endpoint
    await expect(incomeTaxCard.locator('.api-card__endpoint')).toContainText('/income-tax/v1');
    
    // Verify features
    const features = incomeTaxCard.locator('.api-card__features li');
    await expect(features).toHaveCount(4);
    
    // Verify action buttons
    await expect(incomeTaxCard.locator('a[href="income-tax/index.html"]')).toBeVisible();
    await expect(incomeTaxCard.locator('a[href="explorer.html?api=income-tax"]')).toBeVisible();
  });

  test('should display Payment API card with correct information', async ({ page }) => {
    // Find Payment API card
    const paymentCard = page.locator('.api-card').filter({ hasText: 'Payment API' });
    await expect(paymentCard).toBeVisible();
    
    // Verify title
    await expect(paymentCard.locator('.api-card__title')).toContainText('Payment API');
    
    // Verify endpoint
    await expect(paymentCard.locator('.api-card__endpoint')).toContainText('/payment/v1');
    
    // Verify features
    const features = paymentCard.locator('.api-card__features li');
    await expect(features).toHaveCount(4);
    
    // Verify action buttons
    await expect(paymentCard.locator('a[href="payment/index.html"]')).toBeVisible();
    await expect(paymentCard.locator('a[href="explorer.html?api=payment"]')).toBeVisible();
  });

  test('should navigate to API explorer from homepage', async ({ page }) => {
    // Click "Try it out" button for Taxpayer API
    const taxpayerCard = page.locator('.api-card').filter({ hasText: 'Taxpayer API' });
    const tryItOutButton = taxpayerCard.locator('a[href="explorer.html?api=taxpayer"]');
    
    await tryItOutButton.click();
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the explorer page
    await expect(page).toHaveURL(/explorer\.html\?api=taxpayer/);
    await expect(page.locator('.header h1')).toContainText('API Explorer');
  });

  test('should navigate to API documentation from homepage', async ({ page }) => {
    // Click "View docs" button for Taxpayer API
    const taxpayerCard = page.locator('.api-card').filter({ hasText: 'Taxpayer API' });
    const viewDocsButton = taxpayerCard.locator('a[href="taxpayer/index.html"]');
    
    await viewDocsButton.click();
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the Taxpayer API documentation page
    await expect(page).toHaveURL(/taxpayer\/(index\.html)?$/);
  });

  test('should display additional resources section', async ({ page }) => {
    // Find the info section
    const infoSection = page.locator('.info-section').first();
    await expect(infoSection).toBeVisible();
    
    // Verify heading
    await expect(infoSection.locator('.info-section__heading').first()).toContainText('Additional resources');
    
    // Verify resource links are present
    const resourceLinks = infoSection.locator('ul').first().locator('li');
    await expect(resourceLinks).toHaveCount(4);
    
    // Verify specific links
    await expect(infoSection.locator('a[href="getting-started.md"]')).toBeVisible();
    await expect(infoSection.locator('a[href="mock-servers.md"]')).toBeVisible();
    await expect(infoSection.locator('a[href="acceptance-testing.md"]')).toBeVisible();
    await expect(infoSection.locator('a[href="../specs/shared/shared-components.yaml"]')).toBeVisible();
  });

  test('should display key features section', async ({ page }) => {
    // Find the key features section
    const keyFeaturesHeading = page.locator('.info-section__heading').filter({ hasText: 'Key features' });
    await expect(keyFeaturesHeading).toBeVisible();
    
    // Get the parent info section
    const keyFeaturesSection = keyFeaturesHeading.locator('..').locator('ul').last();
    
    // Verify features are listed
    const features = keyFeaturesSection.locator('li');
    await expect(features).toHaveCount(5);
    
    // Verify specific features
    await expect(features.nth(0)).toContainText('Domain boundaries');
    await expect(features.nth(1)).toContainText('Shared components');
    await expect(features.nth(2)).toContainText('Hypermedia navigation');
    await expect(features.nth(3)).toContainText('Include parameter');
    await expect(features.nth(4)).toContainText('OpenAPI-first');
  });

  test('should display footer', async ({ page }) => {
    // Verify footer is present
    const footer = page.locator('.govuk-footer');
    await expect(footer).toBeVisible();
    
    // Verify footer content
    await expect(footer.locator('.govuk-footer__meta')).toContainText('Domain API POC');
    await expect(footer.locator('.govuk-footer__meta')).toContainText('UK Tax System');
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
    
    // Verify buttons use GOV.UK green - find a primary button (not secondary)
    // Primary buttons have class 'govuk-button' but NOT 'govuk-button--secondary'
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
    
    // Verify API cards are still visible (may stack vertically)
    const apiCards = page.locator('.api-card');
    await expect(apiCards).toHaveCount(3);
    
    // Verify all cards are visible
    for (let i = 0; i < 3; i++) {
      await expect(apiCards.nth(i)).toBeVisible();
    }
  });

  test('should navigate between all three API documentation pages', async ({ page }) => {
    // Navigate to Taxpayer API docs
    const taxpayerCard = page.locator('.api-card').filter({ hasText: 'Taxpayer API' });
    await taxpayerCard.locator('a[href="taxpayer/index.html"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/taxpayer\/(index\.html)?$/);
    
    // Go back to homepage
    await page.goto('/index.html');
    
    // Navigate to Income Tax API docs
    const incomeTaxCard = page.locator('.api-card').filter({ hasText: 'Income Tax API' });
    await incomeTaxCard.locator('a[href="income-tax/index.html"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/income-tax\/(index\.html)?$/);
    
    // Go back to homepage
    await page.goto('/index.html');
    
    // Navigate to Payment API docs
    const paymentCard = page.locator('.api-card').filter({ hasText: 'Payment API' });
    await paymentCard.locator('a[href="payment/index.html"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/payment\/(index\.html)?$/);
  });
});
