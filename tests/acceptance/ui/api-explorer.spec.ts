import { test, expect } from '@playwright/test';

/**
 * Acceptance tests for API Explorer functionality
 *
 * Requirements validated:
 * - 7.1: OAS Viewer/Executor provides interactive API exploration
 * - 8.5: APIs can be tested interactively
 * - 9.1: Acceptance tests validate API explorer functionality
 * - 9.2: Tests include spec loading
 * - 9.3: Tests include API selection
 * - 9.4: Tests include interactive execution ("Try it out")
 *
 * Note: Some tests are skipped because Swagger UI rendering is slow and inconsistent
 * in automated tests. These tests validate the page structure and basic functionality,
 * while Swagger UI-specific features should be tested manually or with longer timeouts.
 */

test.describe('API Explorer', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the API explorer
    await page.goto('/explorer.html');
  });

  test('should load the API explorer page', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/API Explorer/);

    // Verify header is present
    await expect(page.locator('.header h1')).toContainText('API Explorer');

    // Verify navigation elements are present
    await expect(page.locator('#api-select')).toBeVisible();
    await expect(page.locator('.info-banner')).toBeVisible();
  });

  test('should have VPD API options in dropdown', async ({ page }) => {
    // Wait for Swagger UI container
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });

    // Verify the API select dropdown has VPD options
    const apiSelect = page.locator('#api-select');
    await expect(apiSelect).toBeVisible();

    // Check for VPD-related options
    const options = apiSelect.locator('option');
    const optionTexts = await options.allTextContents();

    // Should have at least one VPD-related option
    const hasVpdOption = optionTexts.some(
      (text) =>
        text.toLowerCase().includes('vpd') ||
        text.toLowerCase().includes('excise') ||
        text.toLowerCase().includes('customer') ||
        text.toLowerCase().includes('tax-platform') ||
        text.toLowerCase().includes('platform')
    );
    expect(hasVpdOption).toBe(true);
  });

  test('should load VPD Platform API specification', async ({ page }) => {
    // Wait for Swagger UI container
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });

    // Select VPD Platform API if dropdown exists
    const apiSelect = page.locator('#api-select');
    const options = apiSelect.locator('option');
    const optionValues = await options.evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value)
    );

    // Find and select a VPD-related option
    const vpdOption = optionValues.find(
      (v) => v.includes('vpd') || v.includes('platform') || v.includes('excise')
    );

    if (vpdOption) {
      await apiSelect.selectOption(vpdOption);
    }

    // Wait for Swagger UI to render
    await page.waitForSelector('.information-container', { timeout: 30000 });

    // Verify operations/endpoints are displayed
    const operations = page.locator('.opblock');
    await expect(operations.first()).toBeVisible({ timeout: 10000 });
  });

  test('should switch between different API specifications', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });

    // Wait for initial Swagger UI render
    await page.waitForSelector('.information-container', { timeout: 30000 });

    // Get all options
    const apiSelect = page.locator('#api-select');
    const options = apiSelect.locator('option');
    const optionCount = await options.count();

    if (optionCount > 1) {
      // Select second option
      const secondValue = await options.nth(1).getAttribute('value');
      if (secondValue) {
        await apiSelect.selectOption(secondValue);

        // Wait for Swagger UI to reload
        await page.waitForTimeout(3000);

        // Verify the dropdown value changed
        await expect(apiSelect).toHaveValue(secondValue);
      }
    }
  });

  test('should display API endpoints', async ({ page }) => {
    // Wait for Swagger UI container to load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });

    // Wait for Swagger UI to render content
    await page.waitForSelector('.information-container', { timeout: 30000 });

    // Wait for operations/endpoints to render
    await page.waitForSelector('.opblock', { timeout: 10000 });

    // Verify at least one endpoint is displayed
    const endpoints = page.locator('.opblock');
    await expect(endpoints.first()).toBeVisible();

    // Verify endpoint has HTTP method and path
    const firstEndpoint = endpoints.first();
    await expect(firstEndpoint.locator('.opblock-summary-method')).toBeVisible();
    await expect(firstEndpoint.locator('.opblock-summary-path')).toBeVisible();
  });

  test('should expand endpoint details', async ({ page }) => {
    // Wait for Swagger UI to load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });
    await page.waitForSelector('.opblock', { timeout: 30000 });

    // Click on the first endpoint to expand it
    const firstEndpoint = page.locator('.opblock').first();
    await firstEndpoint.locator('.opblock-summary').click();

    // Wait for expansion
    await page.waitForTimeout(500);

    // Verify endpoint details are visible
    await expect(firstEndpoint.locator('.opblock-body')).toBeVisible({ timeout: 5000 });
  });

  test('should execute API and get response', async ({ page }) => {
    // Wait for Swagger UI to fully load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });
    await page.waitForSelector('.information-container', { timeout: 30000 });

    // Select excise mock API (has simple endpoints that don't require parameters)
    const apiSelect = page.locator('#api-select');
    await apiSelect.selectOption('excise');

    // Wait for the new spec to load
    await page.waitForSelector('.opblock', { timeout: 10000 });

    // Find a GET endpoint
    const getEndpoint = page.locator('.opblock-get').first();
    await getEndpoint.locator('.opblock-summary').click();

    // Wait for endpoint body to expand
    await expect(getEndpoint.locator('.opblock-body')).toBeVisible({ timeout: 5000 });

    // tryItOutEnabled: true means Execute button is already visible
    const executeButton = getEndpoint.locator('button:has-text("Execute")');
    await expect(executeButton).toBeVisible({ timeout: 5000 });

    // Click Execute to invoke the API
    await executeButton.click();

    // Verify we get a 200 response
    const responseCode = getEndpoint.getByRole('cell', { name: '200' });
    await expect(responseCode).toBeVisible({ timeout: 10000 });
  });

  test('should display response schemas', async ({ page }) => {
    // Wait for Swagger UI to fully load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });
    await page.waitForSelector('.information-container', { timeout: 30000 });
    await page.waitForSelector('.opblock', { timeout: 10000 });

    // Expand the first endpoint
    const firstEndpoint = page.locator('.opblock').first();
    await firstEndpoint.locator('.opblock-summary').click();

    // Wait for expansion
    await page.waitForTimeout(1000);

    // Look for responses section
    const responsesSection = firstEndpoint.locator('.responses-wrapper');
    await expect(responsesSection).toBeVisible({ timeout: 5000 });

    // Verify response codes are shown (200, 404, etc.)
    const responseCode = firstEndpoint.locator('.response-col_status');
    await expect(responseCode.first()).toBeVisible();
  });

  test('should navigate back to documentation', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.nav', { timeout: 10000 });

    // Click the "Back to Documentation" link
    const backLink = page.locator('.nav a[href="index.html"]');
    await expect(backLink).toBeVisible();
    await expect(backLink).toContainText('Back to Documentation');

    // Click and verify navigation
    await backLink.click();
    await page.waitForLoadState('networkidle');

    // Verify we're on the documentation page
    await expect(page).toHaveURL(/\/(index\.html)?$/);
  });

  test('should preserve API selection in URL', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });

    // Get all options and select the second one (if available)
    const apiSelect = page.locator('#api-select');
    const options = apiSelect.locator('option');
    const optionCount = await options.count();

    if (optionCount > 1) {
      const secondValue = await options.nth(1).getAttribute('value');
      if (secondValue) {
        await apiSelect.selectOption(secondValue);

        // Wait for URL to update
        await page.waitForTimeout(500);

        // Verify URL contains the API parameter
        expect(page.url()).toContain(`api=${secondValue}`);
      }
    }
  });

  test('should load API from URL parameter @slow', async ({ page }) => {
    // Navigate directly to a specific API (excise mock)
    await page.goto('/explorer.html?api=excise');

    // Wait for Swagger UI to load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });
    await page.waitForSelector('.information-container', { timeout: 30000 });

    // Verify excise API is selected
    const apiSelect = page.locator('#api-select');
    await expect(apiSelect).toHaveValue('excise');

    // Verify API title is displayed
    const apiTitle = page.locator('.info .title');
    await expect(apiTitle).toContainText(/Excise/i, { timeout: 10000 });
  });

  test('should display helpful usage instructions', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.info-banner', { timeout: 10000 });

    // Verify info banner is visible
    const infoBanner = page.locator('.info-banner');
    await expect(infoBanner).toBeVisible();

    // Verify it contains usage instructions
    await expect(infoBanner).toContainText('How to use this explorer');
    await expect(infoBanner).toContainText('Try it out');
    await expect(infoBanner).toContainText('Execute');
  });
});

test.describe('API Explorer - Execute APIs', () => {
  test('should execute Domain API via Swagger UI', async ({ page }) => {
    // Navigate directly to domain API
    await page.goto('/explorer.html?api=domain-api');

    // Wait for Swagger UI to fully load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });
    await page.waitForSelector('.information-container', { timeout: 30000 });
    await page.waitForSelector('.opblock-get', { timeout: 10000 });

    // Expand the GET endpoint
    const getEndpoint = page.locator('.opblock-get').first();
    await getEndpoint.locator('.opblock-summary').click();
    await expect(getEndpoint.locator('.opblock-body')).toBeVisible({ timeout: 5000 });

    // tryItOutEnabled: true means Execute button should already be visible
    const executeButton = getEndpoint.locator('button:has-text("Execute")');
    await expect(executeButton).toBeVisible({ timeout: 5000 });

    // Fill in the acknowledgementReference input (has example pre-filled but we confirm it)
    const ackRefInput = getEndpoint.locator('input[placeholder="acknowledgementReference"]');
    if (await ackRefInput.isVisible()) {
      await ackRefInput.fill('ACK-2026-01-26-000123');
    }

    // Click Execute
    await executeButton.click();

    // Verify we get a live response (look for the live response section)
    const liveResponse = getEndpoint.locator('.live-responses-table');
    await expect(liveResponse).toBeVisible({ timeout: 30000 });
  });

  test('should execute Excise API via Swagger UI (WireMock)', async ({ page }) => {
    // Navigate directly to excise API
    await page.goto('/explorer.html?api=excise');

    // Wait for Swagger UI to fully load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });
    await page.waitForSelector('.information-container', { timeout: 30000 });
    await page.waitForSelector('.opblock-get', { timeout: 10000 });

    // Expand the first GET endpoint
    const getEndpoint = page.locator('.opblock-get').first();
    await getEndpoint.locator('.opblock-summary').click();
    await expect(getEndpoint.locator('.opblock-body')).toBeVisible({ timeout: 5000 });

    // Swagger UI pre-fills path params with examples - click Execute
    const executeButton = getEndpoint.locator('button.execute');
    await expect(executeButton).toBeVisible({ timeout: 5000 });
    await executeButton.click();

    // Wait for response - Firefox can be slower, use longer timeout
    const liveResponse = getEndpoint.locator('.live-responses-table');
    await expect(liveResponse).toBeVisible({ timeout: 30000 });
  });

  test('should execute Customer API via Swagger UI (Prism)', async ({ page }) => {
    // Navigate directly to customer API
    await page.goto('/explorer.html?api=customer');

    // Wait for Swagger UI to fully load
    await page.waitForSelector('#swagger-ui', { timeout: 10000 });
    await page.waitForSelector('.information-container', { timeout: 30000 });
    await page.waitForSelector('.opblock-get', { timeout: 10000 });

    // Expand the GET endpoint
    const getEndpoint = page.locator('.opblock-get').first();
    await getEndpoint.locator('.opblock-summary').click();
    await expect(getEndpoint.locator('.opblock-body')).toBeVisible({ timeout: 5000 });

    // Swagger UI pre-fills path params with examples - click Execute
    const executeButton = getEndpoint.locator('button.execute');
    await expect(executeButton).toBeVisible({ timeout: 5000 });
    await executeButton.click();

    // Wait for response - Firefox can be slower, use longer timeout
    const liveResponse = getEndpoint.locator('.live-responses-table');
    await expect(liveResponse).toBeVisible({ timeout: 30000 });
  });
});
