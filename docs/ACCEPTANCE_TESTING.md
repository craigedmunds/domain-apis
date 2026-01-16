# Acceptance Testing Guide

## Overview

Acceptance tests for the Domain API POC are maintained in a **separate project** with its own dependencies. This keeps the main project focused on API specifications and implementation while allowing the acceptance test suite to evolve independently.

## Setting Up Acceptance Tests

### 1. Create Separate Project

Create a new directory outside this repository:

```bash
mkdir ../domain-api-acceptance-tests
cd ../domain-api-acceptance-tests
```

### 2. Initialize Node.js Project

```bash
npm init -y
```

### 3. Install Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

### 4. Create Test Structure

```bash
mkdir -p tests
```

### 5. Create Playwright Configuration

Create `playwright.config.js`:

```javascript
// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

## Test Scenarios to Cover

### API Explorer Tests

1. **Spec File Loading**
   - Verify all three API specs load successfully
   - Verify shared components file loads
   - Test 404 handling for missing specs

2. **API Selection**
   - Test default API loads (Taxpayer)
   - Test switching between APIs via dropdown
   - Test URL parameter loading (e.g., `?api=income-tax`)

3. **Interactive Functionality**
   - Test "Try it out" buttons are present
   - Test executing API requests
   - Test response display

4. **Navigation**
   - Test navigation back to homepage
   - Test links between documentation and explorer

### Documentation Site Tests

1. **Homepage**
   - Verify all three API cards are displayed
   - Test "View docs" links
   - Test "Try it out" links
   - Verify GOV.UK styling is applied

2. **API Documentation Pages**
   - Verify each API's Redoc documentation loads
   - Test navigation between API docs

## Running Tests

### Prerequisites

Ensure the Domain API POC is running:

```bash
cd ../domain-apis
task start
```

### Run Tests

```bash
# Run all tests
npx playwright test

# Run tests in UI mode
npx playwright test --ui

# Run specific test file
npx playwright test tests/api-explorer.spec.js

# View test report
npx playwright show-report
```

## Example Test

Create `tests/api-explorer.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('API Explorer', () => {
  test('should load Taxpayer API by default', async ({ page }) => {
    await page.goto('http://localhost:8080/docs/explorer.html');
    
    // Wait for Swagger UI to load
    await page.waitForSelector('.swagger-ui', { timeout: 10000 });
    
    // Verify the API title
    await expect(page.locator('.info .title')).toContainText('Taxpayer API');
  });

  test('should load spec files successfully', async ({ page }) => {
    const response = await page.goto('http://localhost:8080/docs/specs/taxpayer/taxpayer-api.yaml');
    expect(response.status()).toBe(200);
  });
});
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/acceptance-tests.yml` in the acceptance test project:

```yaml
name: Acceptance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Checkout Domain API POC
        uses: actions/checkout@v4
        with:
          repository: your-org/domain-apis
          path: domain-apis
      
      - name: Start Domain API POC
        run: |
          cd domain-apis
          npm install
          task start &
          sleep 10
      
      - name: Run acceptance tests
        run: npx playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## Benefits of Separate Project

1. **Independent Dependencies**: Acceptance tests can use different versions of tools without affecting the main project
2. **Focused Scope**: Main project stays focused on API specifications and implementation
3. **Flexible Testing**: Can test against different environments (local, staging, production)
4. **Clear Separation**: Testing concerns are separated from implementation concerns
5. **Easier Maintenance**: Test suite can evolve independently of the API implementation

## Next Steps

1. Create the separate acceptance test project
2. Implement the test scenarios listed above
3. Set up CI/CD pipeline for automated testing
4. Document any environment-specific configuration needed
