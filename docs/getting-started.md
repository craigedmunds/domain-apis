# Getting Started with Domain API POC

This guide will help you get started with the Domain API POC, a multi-API architecture representing portions of the UK tax system.

## Choose Your Path

**Are you building or consuming APIs?**

- **[API Consumer Guide](api-consumer-guide.md)** - For developers consuming the APIs (frontend, integrations, etc.)
- **[API Producer Guide](api-producer-guide.md)** - For developers building the APIs (backend, new endpoints, etc.)

## Overview

The Domain API POC demonstrates how to model complex domains across multiple RESTful APIs while maintaining:
- Clear domain boundaries
- Shared components for common types
- Cross-API resource traversal via hypermedia links
- Lightweight JSON structure inspired by JSON API

## Architecture

The system consists of three separate Domain APIs:

### 1. Taxpayer API (`/taxpayer/v1`)
Manages taxpayer identity and registration information.

**Key Resources:**
- `Taxpayer` - Taxpayer identity with NINO, name, and address
- Relationships to tax returns and payments

### 2. Income Tax API (`/income-tax/v1`)
Handles income tax returns, assessments, and calculations.

**Key Resources:**
- `TaxReturn` - Tax return for a specific tax year
- `Assessment` - Tax assessment with calculated amounts
- Relationships to taxpayers and payment allocations

### 3. Payment API (`/payment/v1`)
Manages tax payments and payment allocations.

**Key Resources:**
- `Payment` - Payment made by a taxpayer
- `PaymentAllocation` - Allocation of payment to a tax return
- Relationships to taxpayers and tax returns

## Installation

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Install Dependencies

```bash
npm install
```

## Working with OpenAPI Specifications

### Validate Specifications

Validate all OpenAPI specification files:

```bash
npm run validate
```

Validate individual APIs:

```bash
npm run validate:taxpayer
npm run validate:income-tax
npm run validate:payment
```

### Lint Specifications

Run Spectral linting on all specifications:

```bash
npm run lint
```

Lint individual APIs:

```bash
npm run lint:taxpayer
npm run lint:income-tax
npm run lint:payment
```

## Mock Servers

Mock servers allow you to test the API design without implementing the full backend.

### Start All Mock Servers

```bash
npm run mock
```

This starts three mock servers:
- Taxpayer API: http://localhost:8081
- Income Tax API: http://localhost:8082
- Payment API: http://localhost:8083

### Start Individual Mock Servers

```bash
npm run mock:taxpayer    # Port 8081
npm run mock:income-tax  # Port 8082
npm run mock:payment     # Port 8083
```

### Testing Mock Servers

Once the mock servers are running, you can test them with curl:

```bash
# Get a taxpayer
curl http://localhost:8081/taxpayer/v1/taxpayers/TP123456

# Get tax returns for a taxpayer
curl http://localhost:8082/income-tax/v1/tax-returns?taxpayerId=TP123456

# Get payments for a taxpayer
curl http://localhost:8083/payment/v1/payments?taxpayerId=TP123456
```

## Documentation

### Generate Documentation

Generate HTML documentation for all APIs:

```bash
npm run docs
```

This creates documentation in the `docs/` directory:
- `docs/taxpayer/index.html`
- `docs/income-tax/index.html`
- `docs/payment/index.html`

Open these files in your browser to view the interactive documentation.

### View Interactive API Documentation

Start Swagger UI to view and test all APIs interactively:

```bash
npm run swagger
```

This opens Swagger UI in your browser where you can:
- Browse all API endpoints
- View request/response schemas
- Execute API requests using "Try it out"
- Test cross-API traversal by following relationship links

## Cross-API Traversal

One of the key features of this architecture is the ability to navigate between related resources across different APIs.

### Example: Following Relationship Links

1. **Get a taxpayer:**
   ```bash
   curl http://localhost:8081/taxpayer/v1/taxpayers/TP123456
   ```

   Response includes `_links` with URLs to related resources:
   ```json
   {
     "id": "TP123456",
     "type": "taxpayer",
     "nino": "AB123456C",
     "_links": {
       "self": {
         "href": "http://localhost:8081/taxpayer/v1/taxpayers/TP123456"
       },
       "taxReturns": {
         "href": "http://localhost:8082/income-tax/v1/tax-returns?taxpayerId=TP123456",
         "type": "collection"
       },
       "payments": {
         "href": "http://localhost:8083/payment/v1/payments?taxpayerId=TP123456",
         "type": "collection"
       }
     }
   }
   ```

2. **Follow the taxReturns link:**
   ```bash
   curl http://localhost:8082/income-tax/v1/tax-returns?taxpayerId=TP123456
   ```

3. **Follow links from tax returns to payments:**
   Each tax return includes links to payment allocations in the Payment API.

### Using the Include Parameter

To reduce the number of API calls, use the `include` parameter to embed related resources:

```bash
# Get taxpayer with tax returns included
curl "http://localhost:8081/taxpayer/v1/taxpayers/TP123456?include=taxReturns"
```

Response includes both the taxpayer and related tax returns:
```json
{
  "id": "TP123456",
  "type": "taxpayer",
  "nino": "AB123456C",
  "_links": {
    "self": {"href": "..."},
    "taxReturns": {"href": "..."}
  },
  "_includes": {
    "taxReturns": ["TR20230001"]
  },
  "_included": {
    "taxReturns": [
      {
        "id": "TR20230001",
        "type": "tax-return",
        "taxpayerId": "TP123456",
        "taxYear": "2023-24"
      }
    ]
  }
}
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
npm run test:unit         # Unit tests
npm run test:property     # Property-based tests
npm run test:integration  # Integration tests
```

### Watch Mode

Run tests in watch mode for development:

```bash
npm run test:watch
```

## Development Workflow

1. **Define OpenAPI specifications** in `specs/` directory
2. **Validate specifications** using `npm run validate`
3. **Generate mock servers** using `npm run mock`
4. **Test cross-API traversal** using curl or Swagger UI
5. **Write tests** for specifications and behavior
6. **Generate documentation** using `npm run docs`
7. **Implement real APIs** based on validated specifications

## Next Steps

- Read the [API Architecture](architecture.md) document
- Learn about [Cross-API Traversal](cross-api-traversal.md) patterns
- Explore the OpenAPI specifications in the `specs/` directory
- View the generated documentation in the `docs/` directory
- Start the mock servers and test the APIs

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors when starting mock servers:

```bash
# Find and kill processes using the ports
lsof -ti:8081 | xargs kill
lsof -ti:8082 | xargs kill
lsof -ti:8083 | xargs kill
```

### Validation Errors

If OpenAPI validation fails:
1. Check the error message for the specific issue
2. Review the OpenAPI 3.0 specification
3. Ensure all `$ref` references resolve correctly
4. Verify examples match their schemas

### Mock Server Not Responding

If mock servers don't respond:
1. Check that the OpenAPI specifications are valid
2. Ensure the specifications include example responses
3. Verify the server URLs in the specifications match the mock server ports

## Resources

- [OpenAPI Specification 3.0](https://swagger.io/specification/)
- [Prism Mock Server](https://stoplight.io/open-source/prism)
- [Redocly Documentation](https://redocly.com/docs/)
- [Spectral Linting](https://stoplight.io/open-source/spectral)
