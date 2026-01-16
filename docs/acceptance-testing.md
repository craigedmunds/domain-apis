# Acceptance Testing Guide

## Overview

Acceptance tests for the Domain API POC are maintained in a **separate Playwright project** within this repository at `tests/acceptance/`. This keeps the acceptance tests isolated with their own dependencies while remaining part of the main codebase.

## Quick Start

### Install Dependencies

From the main project directory:

```bash
# Install acceptance test dependencies
task test:acceptance:install
```

This will:
1. Install Playwright and dependencies in `tests/acceptance/`
2. Install Playwright browsers

### Run Tests

```bash
# Run all acceptance tests (excludes slow tests by default)
task test:acceptance

# Run tests in headed mode (see browser)
task test:acceptance:headed

# Run tests in UI mode (interactive)
task test:acceptance:ui

# Run only the slow tests (Swagger UI rendering tests)
task test:acceptance:skipped

# Run slow tests in headed mode (recommended)
task test:acceptance:skipped:headed

# View test report
task test:acceptance:report
```

## Project Structure

```
domain-apis/
├── tests/
│   └── acceptance/              # Separate Playwright project
│       ├── tests/
│       │   ├── api-explorer.spec.ts      # API explorer tests
│       │   └── documentation.spec.ts     # Documentation site tests
│       ├── playwright.config.ts          # Playwright configuration
│       ├── package.json                  # Separate dependencies
│       └── README.md                     # Detailed test documentation
├── docs/                        # Documentation site
│   ├── index.html              # Homepage
│   ├── explorer.html           # API explorer
│   └── ...
└── package.json                # Main project dependencies
```

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

## Running Tests Locally

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

1. **Install main project dependencies** (if not already done):
   ```bash
   task install
   ```

2. **Install acceptance test dependencies**:
   ```bash
   task test:acceptance:install
   ```

### Run Tests

The tests will automatically start the documentation server before running:

```bash
# Run all acceptance tests (fast tests only)
task test:acceptance

# Run tests in headed mode (see browser)
task test:acceptance:headed

# Run tests in UI mode (interactive debugging)
task test:acceptance:ui

# Run only the slow tests (Swagger UI rendering)
task test:acceptance:skipped

# Run slow tests in headed mode (recommended to see what's happening)
task test:acceptance:skipped:headed

# View test report
task test:acceptance:report
```

**About Slow Tests**: Some tests depend on Swagger UI fully rendering from CDN, which can be slow and inconsistent. These tests are tagged with `@slow` and excluded by default. Run them separately with `task test:acceptance:skipped` when you want to validate Swagger UI functionality.

### Manual Server Start

If you prefer to start the server manually:

```bash
# Terminal 1: Start documentation server using docker-compose
docker-compose up docs

# Terminal 2: Run tests
cd tests/acceptance
npm test
```

## Detailed Test Documentation

For detailed information about the acceptance tests, including:
- Configuration options
- Writing new tests
- Debugging tests
- CI/CD integration
- Troubleshooting

See the [Acceptance Tests README](../tests/acceptance/README.md).

## Test Configuration

The tests are configured in `tests/acceptance/playwright.config.ts`:

- **Base URL**: `http://localhost:8080` (configurable via `BASE_URL` env var)
- **Browsers**: Chromium, Firefox, WebKit
- **Parallel execution**: Enabled (except on CI)
- **Retries**: 2 on CI, 0 locally
- **Screenshots**: On failure only
- **Videos**: Retained on failure
- **Traces**: On first retry

### Automatic Server Start

The configuration includes a `webServer` section that automatically starts the documentation server using docker-compose:

```typescript
webServer: {
  command: 'docker-compose up -d docs && echo "Waiting for docs server..." && sleep 2',
  url: 'http://localhost:8080',
  reuseExistingServer: !process.env.CI,
}
```

This starts the `docs` service from `docker-compose.yml`, which uses a lightweight static file server to serve the documentation on port 8080. You don't need to manually start the server before running tests.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Acceptance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  acceptance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install main project dependencies
        run: npm ci
      
      - name: Install acceptance test dependencies
        working-directory: tests/acceptance
        run: npm ci
      
      - name: Install Playwright browsers
        working-directory: tests/acceptance
        run: npx playwright install --with-deps
      
      - name: Run acceptance tests
        run: task test:acceptance
        env:
          CI: true
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: tests/acceptance/playwright-report/
```

## Benefits of In-Repo Separate Project

1. **Independent Dependencies**: Acceptance tests have their own `package.json` and dependencies
2. **Version Control**: Tests are versioned with the code they validate
3. **Easy Discovery**: Tests are part of the main repository
4. **Isolated Execution**: Tests run in their own context
5. **Clear Separation**: Testing concerns are separated from implementation
6. **Flexible Testing**: Can test against different environments

## Debugging Tests

### Visual Debugging

```bash
# Run in headed mode to see the browser
npm run test:acceptance:headed

# Run in UI mode for interactive debugging
npm run test:acceptance:ui
```

### From Acceptance Test Directory

```bash
cd tests/acceptance

# Run specific test file
npm test tests/api-explorer.spec.ts

# Run in debug mode
npm run test:debug

# Generate test code
npm run codegen
```

## Success Criteria

Acceptance tests are the final validation before considering work complete. All acceptance tests must pass before:

- Merging pull requests
- Deploying to production
- Marking features as complete

**Remember**: Unit tests + Integration tests + Acceptance tests = Complete validation

## Troubleshooting

### Tests fail with "baseURL not accessible"

Ensure the documentation server can start:

```bash
npm run serve:docs
```

If port 8080 is in use, set a different port:

```bash
BASE_URL=http://localhost:3000 npm run test:acceptance
```

### Browser installation issues

Install browsers manually:

```bash
cd tests/acceptance
npx playwright install --with-deps
```

### Tests are flaky

- Check network conditions
- Increase timeouts in `playwright.config.ts`
- Use proper waits instead of fixed timeouts
- Run tests in headed mode to observe behavior

## Next Steps

1. ✅ Acceptance test project created at `tests/acceptance/`
2. ✅ API explorer tests implemented
3. ✅ Documentation site tests implemented
4. ⏳ Set up CI/CD pipeline for automated testing
5. ⏳ Add more test scenarios as features are added
