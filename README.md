# Domain API POC

This is a proof-of-concept for a multi-API domain architecture representing portions of the UK tax system.

## Architecture

The system consists of three separate Domain APIs:

1. **Taxpayer API** (`/api/taxpayer/v1`) - Manages taxpayer identity and registration information
2. **Income Tax API** (`/api/income-tax/v1`) - Handles income tax returns, assessments, and calculations
3. **Payment API** (`/api/payment/v1`) - Manages tax payments and payment allocations

Each API has its own OpenAPI specification but shares common components through reusable specification fragments.

## Directory Structure

```
domain-apis/
├── specs/                      # OpenAPI specifications
│   ├── shared/                 # Shared component definitions
│   │   └── shared-components.yaml
│   ├── taxpayer/               # Taxpayer API specification
│   │   └── taxpayer-api.yaml
│   ├── income-tax/             # Income Tax API specification
│   │   └── income-tax-api.yaml
│   └── payment/                # Payment API specification
│       └── payment-api.yaml
├── docs/                       # Generated documentation
│   ├── taxpayer/
│   ├── income-tax/
│   └── payment/
├── tests/                      # Test suites
│   ├── unit/                   # Unit tests
│   ├── property/               # Property-based tests
│   └── integration/            # Integration tests
├── tools/                      # Tooling scripts and configuration
│   ├── validate.sh             # OpenAPI validation script
│   ├── generate-docs.sh        # Documentation generation script
│   └── start-mocks.sh          # Mock server startup script
└── package.json                # Node.js dependencies for tooling
```

## Getting Started

### Prerequisites

- Node.js 18+ (for tooling)
- npm or yarn

### Installation

```bash
npm install
```

### Validate OpenAPI Specifications

```bash
npm run validate
```

### Generate Documentation

```bash
npm run docs
```

### Start Mock Servers

```bash
# Start all mock servers concurrently
task mock

# Or start individual servers
task mock:taxpayer    # Port 8081
task mock:income-tax  # Port 8082
task mock:payment     # Port 8083
```

This will start three mock servers:
- Taxpayer API: http://127.0.0.1:8081
- Income Tax API: http://127.0.0.1:8082
- Payment API: http://127.0.0.1:8083

**Test the mock servers:**
```bash
./test-mock-servers.sh
```

See [Mock Server Documentation](docs/mock-servers.md) for detailed usage.

### View Interactive API Documentation

```bash
npm run swagger
```

This opens Swagger UI with all three API specifications loaded.

## Development Workflow

1. **Define OpenAPI specifications** in the `specs/` directory
2. **Validate specifications** using `npm run validate`
3. **Generate mock servers** using `npm run mock`
4. **Test cross-API traversal** using the mock servers
5. **Generate documentation** using `npm run docs`
6. **Implement real APIs** based on validated specifications

## Key Features

- **Multi-API Architecture**: Clear domain boundaries with independent versioning
- **Shared Components**: Reusable schemas for common types (Address, Money, etc.)
- **Hypermedia Navigation**: Resources include links to related resources across APIs
- **Include Parameter**: Reduce API calls by embedding related resources
- **OpenAPI-First**: Specifications drive implementation, documentation, and testing

## Testing

```bash
# Run all tests (unit, property, integration)
task test

# Run unit tests only
task test:unit

# Run property-based tests only
task test:property

# Run integration tests only
task test:integration

# Run acceptance tests (separate Playwright project)
task test:acceptance

# Run acceptance tests in headed mode (see browser)
task test:acceptance:headed

# Run acceptance tests in UI mode (interactive)
task test:acceptance:ui

# Install acceptance test dependencies
task test:acceptance:install

# View acceptance test report
task test:acceptance:report
```

**Note**: Acceptance tests are maintained in a separate Playwright project at `tests/acceptance/`. See [Acceptance Testing Guide](docs/acceptance-testing.md) for details.

## Documentation

- [Getting Started Guide](docs/getting-started.md)
- [Mock Server Setup](docs/mock-servers.md)
- [API Architecture](docs/architecture.md)
- [Cross-API Traversal](docs/cross-api-traversal.md)
- [Acceptance Testing Guide](docs/acceptance-testing.md)
- [Taxpayer API Documentation](docs/taxpayer/)
- [Income Tax API Documentation](docs/income-tax/)
- [Payment API Documentation](docs/payment/)
