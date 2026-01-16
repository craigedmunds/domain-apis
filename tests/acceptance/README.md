# Acceptance Tests

This directory contains acceptance tests for the Domain API POC using Playwright. These tests validate critical user journeys and ensure the system meets requirements before considering work complete.

## Overview

The acceptance tests are maintained as a **separate Playwright project** with its own dependencies, independent of the main project. This separation ensures:

- Clean dependency management
- Isolated test execution
- Clear separation between unit/integration tests and acceptance tests
- Ability to run acceptance tests against any environment

## Test Coverage

### API Explorer Tests (`tests/api-explorer.spec.ts`)

Validates the interactive API explorer functionality:

- ✅ Page loads correctly with Swagger UI
- ✅ Default API specification loads (Taxpayer API)
- ✅ API selection dropdown works
- ✅ Switching between API specifications
- ✅ Endpoints are displayed
- ✅ Endpoint details can be expanded
- ✅ "Try it out" functionality is available
- ✅ Response schemas are displayed
- ✅ Navigation back to documentation works
- ✅ URL parameters preserve API selection
- ✅ Usage instructions are displayed

**Requirements validated:** 7.1, 8.5, 9.1, 9.2, 9.3, 9.4

### Documentation Site Tests (`tests/documentation.spec.ts`)

Validates the documentation site functionality:

- ✅ Homepage loads with correct branding
- ✅ GOV.UK styled header and phase banner
- ✅ All three API cards are displayed
- ✅ Each API card has correct information
- ✅ Navigation to API explorer works
- ✅ Navigation to API documentation works
- ✅ Additional resources section is present
- ✅ Key features section is present
- ✅ Footer is displayed
- ✅ GOV.UK styling is consistent
- ✅ Responsive design on mobile
- ✅ Navigation between all API docs

**Requirements validated:** 7.1, 7.2, 9.1, 9.5, 9.6

## Prerequisites

- Node.js 18+ (for Playwright)
- npm or yarn

## Installation

From the `tests/acceptance` directory:

```bash
npm install
```

This will install Playwright and all required dependencies in this directory only.

### Install Playwright Browsers

After installing dependencies, install the Playwright browsers:

```bash
npx playwright install
```

## Running Tests

### From the acceptance test directory

```bash
cd tests/acceptance

# Run all acceptance tests (fast tests only)
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run tests in UI mode (interactive)
npm run test:ui

# Run tests in debug mode
npm run test:debug

# Run only API explorer tests
npm run test:explorer

# Run only documentation tests
npm run test:docs

# Run only slow tests (Swagger UI rendering)
npm run test:skipped

# Run slow tests in headed mode
npm run test:skipped:headed

# View test report
npm run report
```

### From the main project directory

The main project includes convenience scripts:

```bash
# From domain-apis/ directory
task test:acceptance                    # Fast tests only
task test:acceptance:headed             # Fast tests in headed mode
task test:acceptance:ui                 # Interactive UI mode
task test:acceptance:skipped            # Run slow tests only
task test:acceptance:skipped:headed     # Run slow tests in headed mode
task test:acceptance:report             # View test report
```

## Test Categories

### Fast Tests (Default)

These tests run quickly and validate core functionality:
- Page loading and structure
- Navigation between pages
- Form elements and dropdowns
- Basic styling and responsiveness

**Run with**: `task test:acceptance`

### Slow Tests (@slow tag)

These tests depend on Swagger UI rendering from CDN, which can take 10-30 seconds:
- Swagger UI spec title display
- Endpoint list rendering
- "Try it out" button functionality
- Response schema display
- Loading API from URL parameter

**Run with**: `task test:acceptance:skipped` or `task test:acceptance:skipped:headed`

**Why separate?** Swagger UI loads JavaScript from CDN and renders complex OpenAPI specs, which is slow and can be inconsistent in automated tests. These tests use longer timeouts (30s) and are best run in headed mode to observe the rendering process.

## Configuration

The tests are configured in `playwright.config.ts`:

- **Base URL**: `http://localhost:8080` (configurable via `BASE_URL` env var)
- **Browsers**: Chromium, Firefox, WebKit
- **Parallel execution**: Enabled (except on CI)
- **Retries**: 2 on CI, 0 locally
- **Screenshots**: On failure only
- **Videos**: Retained on failure
- **Traces**: On first retry

### Web Server

The configuration includes a `webServer` section that automatically starts the documentation server using docker-compose before running tests:

```typescript
webServer: {
  command: 'docker-compose up -d docs && echo "Waiting for docs server..." && sleep 2',
  url: 'http://localhost:8080',
  reuseExistingServer: !process.env.CI,
}
```

This starts the `docs` service from `docker-compose.yml`, which serves the static documentation files on port 8080. You don't need to manually start the server before running tests.

## Test Structure

```
tests/acceptance/
├── tests/
│   ├── api-explorer.spec.ts      # API explorer functionality tests
│   └── documentation.spec.ts     # Documentation site tests
├── playwright.config.ts           # Playwright configuration
├── package.json                   # Separate dependencies
└── README.md                      # This file
```

## Writing New Tests

When adding new acceptance tests:

1. Create a new `.spec.ts` file in the `tests/` directory
2. Import test utilities: `import { test, expect } from '@playwright/test';`
3. Use descriptive test names that explain the user journey
4. Add comments linking tests to requirements
5. Follow the existing test patterns

Example:

```typescript
import { test, expect } from '@playwright/test';

test.describe('New Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docs/new-feature.html');
  });

  test('should validate critical user journey', async ({ page }) => {
    // Test implementation
    await expect(page.locator('.feature')).toBeVisible();
  });
});
```

## Debugging Tests

### Visual Debugging

```bash
# Run in headed mode to see the browser
npm run test:headed

# Run in UI mode for interactive debugging
npm run test:ui

# Run in debug mode with Playwright Inspector
npm run test:debug
```

### Generating Tests

Use Playwright's codegen to generate test code:

```bash
npm run codegen
```

This opens a browser where you can interact with the application, and Playwright will generate test code for you.

## CI/CD Integration

The tests are designed to run in CI/CD pipelines:

- Set `CI=true` environment variable
- Tests will run in headless mode
- Retries are enabled (2 attempts)
- Tests run sequentially (not parallel)
- Screenshots and videos are captured on failure

Example GitHub Actions workflow:

```yaml
- name: Install dependencies
  working-directory: tests/acceptance
  run: npm ci

- name: Install Playwright browsers
  working-directory: tests/acceptance
  run: npx playwright install --with-deps

- name: Run acceptance tests
  working-directory: tests/acceptance
  run: npm test
  env:
    CI: true

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: tests/acceptance/playwright-report/
```

## Troubleshooting

### Tests fail with "baseURL not accessible"

Ensure Docker is running and the documentation server can start:

```bash
# Start the docs server manually
docker-compose up docs

# Or start all services
docker-compose up -d
```

Or let Playwright start it automatically (configured in `playwright.config.ts`).

### Browser installation issues

Install browsers manually:

```bash
npx playwright install --with-deps
```

### Port already in use

If port 8080 is already in use, stop the conflicting service:

```bash
# Check what's using port 8080
lsof -i :8080

# Stop docker-compose services
docker-compose down
```

Or change the port in `docker-compose.yml` and update the `BASE_URL` environment variable:

```bash
BASE_URL=http://localhost:3000 npm test
```

## Best Practices

1. **Keep tests focused**: Each test should validate one specific user journey
2. **Use descriptive names**: Test names should explain what is being validated
3. **Add comments**: Link tests to requirements for traceability
4. **Avoid flaky tests**: Use proper waits and assertions
5. **Clean up**: Tests should not depend on each other
6. **Test real scenarios**: Validate actual user workflows, not implementation details

## Success Criteria

Acceptance tests are the final validation before considering work complete. All acceptance tests must pass before:

- Merging pull requests
- Deploying to production
- Marking features as complete

**Remember**: Unit tests + Integration tests + Acceptance tests = Complete validation
