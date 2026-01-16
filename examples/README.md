# Example Data for Domain API POC

This directory contains example data demonstrating cross-API relationships in the UK Tax Domain API system.

## Overview

The example data demonstrates how resources from three separate APIs (Taxpayer, Income Tax, and Payment) relate to each other through hypermedia links. Each resource includes `_links` fields that contain URLs to related resources, enabling cross-API traversal.

## Individual Resource Examples

### Single Resource Files

These files show individual resources with their complete structure and relationship links:

- **`taxpayer-example.json`**: A taxpayer resource (TP123456) with links to tax returns and payments
- **`tax-return-example.json`**: A tax return resource (TR20230001) with links to taxpayer, assessments, and payment allocations
- **`assessment-example.json`**: An assessment resource (AS20230001) linked to a tax return
- **`payment-example.json`**: A payment resource (PM20230001) with links to taxpayer and allocations
- **`payment-allocation-example.json`**: A payment allocation (PA20230001) linking a payment to a tax return

## Complete Scenario Examples

### `cross-api-scenario.json`

A complete journey through the tax system showing:
- One taxpayer (John Smith, TP123456)
- One tax return for 2023-24 (TR20230001)
- One assessment (AS20230001)
- One payment (PM20230001)
- One payment allocation (PA20230001)

**Key Features:**
- Shows all five resource types
- Demonstrates bidirectional relationships
- Includes relationship graph visualization
- Provides traversal examples
- Validates URL correctness

**Use Cases:**
- Understanding the complete flow from taxpayer to payment
- Testing cross-API navigation
- Validating relationship link formats
- Demonstrating the `include` parameter

### `multi-taxpayer-scenario.json`

A more complex scenario with multiple taxpayers and relationships:
- Two taxpayers (TP123456 and TP789012)
- Three tax returns across two tax years
- Three payments
- Three payment allocations

**Key Features:**
- Multiple taxpayers with different numbers of returns
- Historical data (2022-23 and 2023-24 tax years)
- Different payment methods (bank transfer, debit card)
- Relationship summary showing totals
- Cross-API validation checks

**Use Cases:**
- Testing collection endpoints with multiple items
- Validating filtering by taxpayer ID
- Testing historical data queries
- Demonstrating multiple relationships per taxpayer

## Relationship Structure

All resources follow a consistent pattern for relationships:

```json
{
  "_links": {
    "self": "http://localhost:8080/api/{domain}/v1/{resource}/{id}",
    "relatedResource": {
      "href": "http://localhost:8080/api/{other-domain}/v1/{resource}/{id}",
      "type": "resource-type",
      "title": "Human-readable description"
    }
  }
}
```

### Key Relationship Patterns

1. **Taxpayer → Tax Returns** (Cross-API)
   - From: Taxpayer API
   - To: Income Tax API
   - Link: `_links.taxReturns.href`

2. **Tax Return → Taxpayer** (Cross-API, Bidirectional)
   - From: Income Tax API
   - To: Taxpayer API
   - Link: `_links.taxpayer.href`

3. **Taxpayer → Payments** (Cross-API)
   - From: Taxpayer API
   - To: Payment API
   - Link: `_links.payments.href`

4. **Payment → Taxpayer** (Cross-API, Bidirectional)
   - From: Payment API
   - To: Taxpayer API
   - Link: `_links.taxpayer.href`

5. **Tax Return → Payment Allocations** (Cross-API)
   - From: Income Tax API
   - To: Payment API
   - Link: `_links.allocations.href`

6. **Payment Allocation → Tax Return** (Cross-API, Bidirectional)
   - From: Payment API
   - To: Income Tax API
   - Link: `_links.taxReturn.href`

## URL Format Validation

All relationship URLs in the example data follow these rules:

✓ **Absolute URLs**: Include scheme and host (http://localhost:8080)
✓ **Correct base paths**: Each API uses its designated path
  - Taxpayer API: `/api/taxpayer/v1`
  - Income Tax API: `/api/income-tax/v1`
  - Payment API: `/api/payment/v1`
✓ **Link metadata**: All links include `type` and `title` fields
✓ **Bidirectional**: Resources link back to their related resources
✓ **Collection indicators**: Links specify if they point to a collection or single resource

## Using the Example Data

### With Mock Servers

The example data can be used to configure mock servers (e.g., Prism):

```bash
# Start mock servers for each API
prism mock specs/taxpayer/taxpayer-api.yaml --port 8081
prism mock specs/income-tax/income-tax-api.yaml --port 8082
prism mock specs/payment/payment-api.yaml --port 8083
```

### Testing Cross-API Traversal

1. **Start with a taxpayer**:
   ```bash
   curl http://localhost:8080/api/taxpayer/v1/taxpayers/TP123456
   ```

2. **Follow the taxReturns link**:
   ```bash
   curl http://localhost:8080/api/income-tax/v1/tax-returns?taxpayerId=TP123456
   ```

3. **Follow the allocations link from a tax return**:
   ```bash
   curl http://localhost:8080/api/payment/v1/allocations?taxReturnId=TR20230001
   ```

### Using the Include Parameter

Reduce API calls by including related resources:

```bash
# Get taxpayer with embedded tax returns
curl "http://localhost:8080/api/taxpayer/v1/taxpayers/TP123456?include=taxReturns"
```

The response will include both the taxpayer and their tax returns in a single response.

## Validation Checks

The example data has been validated against the following requirements:

- ✓ Requirement 6.1: Models realistic UK tax system concepts
- ✓ Requirement 6.3: Includes realistic attributes (NINO, tax years, amounts)
- ✓ Requirement 6.4: Models relationships reflecting UK tax dependencies
- ✓ Requirement 6.5: Includes cross-API relationships
- ✓ Requirement 8.4: Provides example data demonstrating relationships
- ✓ Requirement 8.5: All relationship URLs are correctly formed

## Resource ID Patterns

All resources follow consistent ID patterns:

- **Taxpayer**: `TP` + 6 digits (e.g., TP123456)
- **Tax Return**: `TR` + 8 digits (e.g., TR20230001)
- **Assessment**: `AS` + 8 digits (e.g., AS20230001)
- **Payment**: `PM` + 8 digits (e.g., PM20230001)
- **Payment Allocation**: `PA` + 8 digits (e.g., PA20230001)

## UK Tax Domain Details

The example data uses realistic UK tax system values:

- **NINO Format**: 2 letters + 6 digits + 1 letter (e.g., AB123456C)
- **Tax Years**: Format YYYY-YY (e.g., 2023-24)
- **Tax Periods**: 6 April to 5 April (UK tax year)
- **Postcodes**: Valid UK postcode formats (e.g., SW1A 2AA)
- **Currency**: GBP (British Pounds)
- **Payment Methods**: bank-transfer, debit-card, cheque
- **Return Statuses**: draft, submitted, assessed, closed
- **Payment Statuses**: pending, cleared, failed, refunded

## Next Steps

After reviewing the example data:

1. Use it to configure mock servers for testing
2. Validate the OpenAPI specifications against the examples
3. Test cross-API traversal patterns
4. Implement property-based tests using the relationship patterns
5. Generate API documentation showing the examples
