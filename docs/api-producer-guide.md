# API Producer Guide

This guide is for developers who want to **build** Domain APIs - whether you're creating a new API, adding endpoints to an existing API, or implementing the backend services.

## Table of Contents

- [Quick Start](#quick-start)
- [API Design Principles](#api-design-principles)
- [Creating a New API](#creating-a-new-api)
- [Resource Structure](#resource-structure)
- [Defining Relationships](#defining-relationships)
- [Using Shared Components](#using-shared-components)
- [OpenAPI Best Practices](#openapi-best-practices)
- [Testing Your API](#testing-your-api)
- [Implementation Guidelines](#implementation-guidelines)

## Quick Start

### Prerequisites

- Node.js 18 or later
- Understanding of REST APIs and OpenAPI 3.0
- Familiarity with JSON and HTTP

### Project Structure

```
domain-apis/
├── specs/
│   ├── shared/
│   │   └── shared-components.yaml    # Shared types and parameters
│   ├── taxpayer/
│   │   └── taxpayer-api.yaml         # Taxpayer API spec
│   ├── income-tax/
│   │   └── income-tax-api.yaml       # Income Tax API spec
│   └── payment/
│       └── payment-api.yaml          # Payment API spec
├── tests/
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   └── acceptance/                   # Acceptance tests
└── docs/                             # Generated documentation
```

### Your First API Endpoint

1. **Define the resource schema** in your OpenAPI spec
2. **Add relationship links** to related resources
3. **Validate the specification**
4. **Test with mock server**
5. **Implement the backend**

## API Design Principles

### 1. Domain Boundaries

Each API represents a distinct domain with clear responsibilities:

- **Taxpayer API**: Identity and registration
- **Income Tax API**: Tax returns and assessments
- **Payment API**: Payments and allocations

**Rule:** Don't mix concerns across domains. If you need data from another domain, use relationships.

### 2. Resource-Oriented Design

Design around resources (nouns), not actions (verbs):

**✅ Good:**
```
GET /taxpayers/{id}
POST /taxpayers
GET /tax-returns/{id}
```

**❌ Avoid:**
```
GET /getTaxpayer?id=123
POST /createTaxpayer
GET /fetchTaxReturn?id=456
```

### 3. Hypermedia Links

Every resource MUST include `_links` to related resources:

```json
{
  "id": "TP123456",
  "type": "taxpayer",
  "_links": {
    "self": {"href": "/taxpayers/TP123456"},
    "taxReturns": {
      "href": "/tax-returns?taxpayerId=TP123456",
      "type": "collection"
    }
  }
}
```

### 4. Consistent Structure

All resources follow the same pattern:

```json
{
  "id": "...",              // Required: Unique identifier
  "type": "...",            // Required: Resource type
  // ... resource fields ...
  "_links": { /* ... */ }   // Required: Relationships
}
```

### 5. Path-Only URLs

Use path-only URLs in `_links` for flexibility:

**✅ Good:**
```json
"_links": {
  "self": {"href": "/taxpayers/TP123456"}
}
```

**❌ Avoid:**
```json
"_links": {
  "self": {"href": "http://api.example.com/taxpayers/TP123456"}
}
```

**Why:** Path-only URLs work across different environments (dev, staging, prod) without modification.

## Creating a New API

### Step 1: Define Your Domain

Identify:
- What resources does this API manage?
- What are the key entities and their attributes?
- How do these resources relate to other domains?

**Example:** Payment API
- Resources: Payment, PaymentAllocation
- Relationships: To Taxpayer (who made payment), To TaxReturn (what payment is for)

### Step 2: Create the OpenAPI Specification

Create a new file: `specs/your-api/your-api.yaml`

```yaml
openapi: 3.0.3
info:
  title: Your API
  version: 1.0.0
  description: |
    Description of your API's purpose and capabilities.

servers:
  - url: http://localhost:8084
    description: Local mock server

paths:
  /your-resources:
    get:
      summary: List resources
      operationId: listResources
      parameters:
        - $ref: '../shared/shared-components.yaml#/components/parameters/IncludeParameter'
      responses:
        '200':
          description: List of resources
          content:
            application/json:
              schema:
                type: object
                required:
                  - items
                  - _links
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/YourResource'
                  _links:
                    $ref: '../shared/shared-components.yaml#/components/schemas/Links'

components:
  schemas:
    YourResource:
      type: object
      required:
        - id
        - type
        - _links
      properties:
        id:
          type: string
          description: Unique identifier
        type:
          type: string
          enum: [your-resource]
        _links:
          allOf:
            - $ref: '../shared/shared-components.yaml#/components/schemas/Links'
            - type: object
              properties:
                relatedResource:
                  type: object
                  required: [href]
                  properties:
                    href:
                      type: string
                      format: uri-reference
                    type:
                      type: string
                    title:
                      type: string
```

### Step 3: Validate Your Specification

```bash
npm run validate
```

Fix any validation errors before proceeding.

### Step 4: Test with Mock Server

```bash
# Add to package.json scripts:
"mock:your-api": "prism mock specs/your-api/your-api.yaml -p 8084"

# Start the mock server
npm run mock:your-api

# Test it
curl http://localhost:8084/your-resources
```

## Resource Structure

### Required Fields

Every resource MUST have:

```yaml
YourResource:
  type: object
  required:
    - id        # Unique identifier
    - type      # Resource type
    - _links    # Relationships
  properties:
    id:
      type: string
      pattern: '^[A-Z]{2}[0-9]+$'  # Define your ID format
      example: "YR123456"
    type:
      type: string
      enum: [your-resource]
      example: "your-resource"
    _links:
      $ref: '../shared/shared-components.yaml#/components/schemas/Links'
```

### Resource-Specific Fields

Add your domain-specific fields:

```yaml
properties:
  # ... required fields above ...
  
  # Your domain fields
  name:
    type: string
    description: Resource name
    example: "Example Resource"
  
  amount:
    $ref: '../shared/shared-components.yaml#/components/schemas/Money'
  
  date:
    type: string
    format: date
    example: "2024-01-15"
  
  status:
    type: string
    enum: [draft, active, closed]
    example: "active"
```

### Examples

Always provide examples:

```yaml
YourResource:
  type: object
  # ... properties ...
  example:
    id: "YR123456"
    type: "your-resource"
    name: "Example Resource"
    amount:
      amount: 1000.00
      currency: "GBP"
    _links:
      self:
        href: "/your-resources/YR123456"
```

## Defining Relationships

### Single Resource Relationship

Link to one related resource:

```yaml
_links:
  allOf:
    - $ref: '../shared/shared-components.yaml#/components/schemas/Links'
    - type: object
      properties:
        taxpayer:
          type: object
          required: [href]
          properties:
            href:
              type: string
              format: uri-reference
              description: URL to the taxpayer
              example: "/taxpayers/TP123456"
            type:
              type: string
              enum: [taxpayer]
            title:
              type: string
              example: "Taxpayer who owns this resource"
```

### Collection Relationship

Link to multiple related resources:

```yaml
_links:
  allOf:
    - $ref: '../shared/shared-components.yaml#/components/schemas/Links'
    - type: object
      properties:
        taxReturns:
          type: object
          required: [href]
          properties:
            href:
              type: string
              format: uri-reference
              description: URL to tax returns collection
              example: "/tax-returns?taxpayerId=TP123456"
            type:
              type: string
              enum: [collection]
            title:
              type: string
              example: "Tax returns for this taxpayer"
```

### Cross-API Relationships

Relationships can point to other APIs:

```yaml
# In Taxpayer API, link to Income Tax API
_links:
  taxReturns:
    href: "/income-tax/v1/tax-returns?taxpayerId=TP123456"
    type: "collection"
```

**Important:** Use path-only URLs. The gateway will handle routing to the correct API.

### Bidirectional Relationships

Ensure relationships work both ways:

**Taxpayer → Tax Returns:**
```yaml
# In Taxpayer resource
_links:
  taxReturns:
    href: "/tax-returns?taxpayerId=TP123456"
    type: "collection"
```

**Tax Return → Taxpayer:**
```yaml
# In TaxReturn resource
_links:
  taxpayer:
    href: "/taxpayers/TP123456"
    type: "taxpayer"
```

## Using Shared Components

### Available Shared Components

Located in `specs/shared/shared-components.yaml`:

#### Schemas

- **`Address`**: UK postal address with postcode validation
- **`Money`**: Monetary amount in GBP
- **`DateRange`**: Start and end dates
- **`Links`**: Hypermedia links structure

#### Parameters

- **`IncludeParameter`**: Query parameter for including related resources

#### Responses

- **`NotFound`**: 404 error response
- **`BadRequest`**: 400 error response
- **`BadGateway`**: 502 error response

### Using Shared Schemas

Reference shared schemas with `$ref`:

```yaml
YourResource:
  properties:
    address:
      $ref: '../shared/shared-components.yaml#/components/schemas/Address'
    
    amount:
      $ref: '../shared/shared-components.yaml#/components/schemas/Money'
    
    period:
      $ref: '../shared/shared-components.yaml#/components/schemas/DateRange'
    
    _links:
      $ref: '../shared/shared-components.yaml#/components/schemas/Links'
```

### Using Shared Parameters

```yaml
paths:
  /your-resources:
    get:
      parameters:
        - $ref: '../shared/shared-components.yaml#/components/parameters/IncludeParameter'
```

### Using Shared Responses

```yaml
paths:
  /your-resources/{id}:
    get:
      responses:
        '200':
          # ... success response ...
        '404':
          $ref: '../shared/shared-components.yaml#/components/responses/NotFound'
```

### Adding New Shared Components

If you create a component that multiple APIs will use:

1. Add it to `specs/shared/shared-components.yaml`
2. Document its purpose and usage
3. Provide examples
4. Update this guide

## OpenAPI Best Practices

### 1. Use Descriptive Operation IDs

```yaml
paths:
  /taxpayers:
    get:
      operationId: listTaxpayers  # Clear and unique
```

### 2. Provide Comprehensive Descriptions

```yaml
paths:
  /taxpayers/{id}:
    get:
      summary: Get taxpayer details
      description: |
        Retrieve detailed information about a specific taxpayer.
        
        Supports including related resources using the `include` parameter.
        Available relationships: taxReturns, payments
```

### 3. Define All Response Codes

```yaml
responses:
  '200':
    description: Success
  '400':
    $ref: '../shared/shared-components.yaml#/components/responses/BadRequest'
  '404':
    $ref: '../shared/shared-components.yaml#/components/responses/NotFound'
  '500':
    description: Internal server error
```

### 4. Use Enums for Fixed Values

```yaml
status:
  type: string
  enum: [draft, submitted, assessed, closed]
  description: |
    Current status:
    - draft: Being prepared
    - submitted: Awaiting assessment
    - assessed: Tax calculated
    - closed: Finalized
```

### 5. Validate with Patterns

```yaml
nino:
  type: string
  pattern: '^[A-Z]{2}[0-9]{6}[A-Z]$'
  description: National Insurance Number
  example: "AB123456C"
```

### 6. Provide Multiple Examples

```yaml
examples:
  minimal:
    summary: Minimal required fields
    value:
      taxpayerId: "TP123456"
      taxYear: "2023-24"
  
  complete:
    summary: Complete with all optional fields
    value:
      taxpayerId: "TP123456"
      taxYear: "2023-24"
      totalIncome:
        amount: 50000.00
        currency: "GBP"
```

## Testing Your API

### Validation Tests

Ensure your OpenAPI spec is valid:

```bash
npm run validate
npm run lint
```

### Mock Server Tests

Test your API design before implementation:

```bash
# Start mock server
npm run mock:your-api

# Test endpoints
curl http://localhost:8084/your-resources
curl http://localhost:8084/your-resources/YR123456
```

### Property-Based Tests

Write tests that verify correctness properties:

```javascript
// tests/property/your-api.test.js
describe('Your API - Property Tests', () => {
  test('All resources have required fields', () => {
    const spec = loadOpenAPISpec('specs/your-api/your-api.yaml');
    
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      if (isResourceSchema(schema)) {
        expect(schema.required).toContain('id');
        expect(schema.required).toContain('type');
        expect(schema.required).toContain('_links');
      }
    }
  });
  
  test('All relationship links use path-only URLs', () => {
    const spec = loadOpenAPISpec('specs/your-api/your-api.yaml');
    
    for (const example of extractExamples(spec)) {
      if (example._links) {
        for (const [rel, link] of Object.entries(example._links)) {
          if (rel !== 'self' && link.href) {
            expect(link.href).toMatch(/^\/[^/]/);  // Starts with / but not //
            expect(link.href).not.toMatch(/^https?:\/\//);
          }
        }
      }
    }
  });
});
```

### Integration Tests

Test cross-API relationships:

```javascript
// tests/integration/cross-api.test.js
describe('Cross-API Integration', () => {
  test('Can traverse from taxpayer to tax returns', async () => {
    // Get taxpayer
    const taxpayer = await fetch('/taxpayers/TP123456').then(r => r.json());
    
    // Extract tax returns link
    const taxReturnsUrl = taxpayer._links.taxReturns.href;
    expect(taxReturnsUrl).toBeDefined();
    
    // Follow link
    const taxReturns = await fetch(taxReturnsUrl).then(r => r.json());
    expect(taxReturns.items).toBeInstanceOf(Array);
  });
});
```

## Implementation Guidelines

### Backend Implementation Checklist

When implementing the backend for your API:

- [ ] **Implement all endpoints** defined in the OpenAPI spec
- [ ] **Return correct status codes** (200, 201, 400, 404, etc.)
- [ ] **Include `_links` in all responses** with correct relationship URLs
- [ ] **Support the `include` parameter** (or let the gateway handle it)
- [ ] **Validate request data** against the schema
- [ ] **Handle errors gracefully** with proper error responses
- [ ] **Add logging and monitoring**
- [ ] **Write unit tests** for business logic
- [ ] **Write integration tests** for API endpoints
- [ ] **Document any deviations** from the spec

### Include Parameter Implementation

You have two options for implementing the `include` parameter:

#### Option 1: Let the Gateway Handle It (Recommended)

Your API doesn't need to know about `include`:

```javascript
// Your API just returns the resource with _links
app.get('/taxpayers/:id', async (req, res) => {
  const taxpayer = await db.getTaxpayer(req.params.id);
  
  res.json({
    id: taxpayer.id,
    type: 'taxpayer',
    nino: taxpayer.nino,
    name: taxpayer.name,
    _links: {
      self: { href: `/taxpayers/${taxpayer.id}` },
      taxReturns: {
        href: `/tax-returns?taxpayerId=${taxpayer.id}`,
        type: 'collection'
      }
    }
  });
});
```

The gateway will:
1. Receive the request with `?include=taxReturns`
2. Call your API to get the taxpayer
3. Extract the `taxReturns` link
4. Call the Income Tax API
5. Merge the responses
6. Return the combined result

#### Option 2: Implement It Yourself

If you want to handle includes in your API:

```javascript
app.get('/taxpayers/:id', async (req, res) => {
  const taxpayer = await db.getTaxpayer(req.params.id);
  
  const response = {
    id: taxpayer.id,
    type: 'taxpayer',
    nino: taxpayer.nino,
    name: taxpayer.name,
    _links: {
      self: { href: `/taxpayers/${taxpayer.id}` },
      taxReturns: {
        href: `/tax-returns?taxpayerId=${taxpayer.id}`,
        type: 'collection'
      }
    }
  };
  
  // Handle include parameter
  const includes = req.query.include?.split(',') || [];
  
  if (includes.includes('taxReturns')) {
    const taxReturns = await fetchTaxReturns(taxpayer.id);
    
    response._includes = {
      taxReturns: taxReturns.map(tr => tr.id)
    };
    
    response._included = {
      taxReturns: taxReturns
    };
  }
  
  res.json(response);
});
```

### Error Response Format

Always use the standard error format:

```javascript
// 404 Not Found
res.status(404).json({
  error: {
    code: 'RESOURCE_NOT_FOUND',
    message: 'Taxpayer TP123456 not found',
    status: 404
  }
});

// 400 Bad Request with validation details
res.status(400).json({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request data',
    status: 400,
    details: [
      {
        field: 'nino',
        message: 'Must match pattern ^[A-Z]{2}[0-9]{6}[A-Z]$'
      }
    ]
  }
});
```

## Common Patterns

### Pattern 1: Paginated Collections

```yaml
paths:
  /your-resources:
    get:
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/YourResource'
                  _links:
                    type: object
                    properties:
                      self:
                        type: string
                      next:
                        type: string
                      prev:
                        type: string
```

### Pattern 2: Filtered Collections

```yaml
paths:
  /tax-returns:
    get:
      parameters:
        - name: taxpayerId
          in: query
          schema:
            type: string
        - name: taxYear
          in: query
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, submitted, assessed, closed]
```

### Pattern 3: Sub-Resources

```yaml
paths:
  /tax-returns/{id}/assessments:
    get:
      summary: Get assessments for a tax return
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
```

## Checklist for New APIs

Before considering your API complete:

### Design Phase
- [ ] Domain boundaries are clear
- [ ] Resources are well-defined
- [ ] Relationships are identified
- [ ] OpenAPI spec is created
- [ ] Shared components are used where appropriate
- [ ] Examples are provided for all schemas

### Validation Phase
- [ ] OpenAPI spec validates successfully
- [ ] Spectral linting passes
- [ ] Mock server runs without errors
- [ ] All endpoints are testable via mock server

### Testing Phase
- [ ] Property-based tests written and passing
- [ ] Integration tests cover cross-API relationships
- [ ] Error cases are tested
- [ ] Include parameter behavior is tested

### Documentation Phase
- [ ] API purpose is documented
- [ ] All endpoints have descriptions
- [ ] Relationship semantics are clear
- [ ] Examples are comprehensive
- [ ] Generated docs are reviewed

### Implementation Phase
- [ ] Backend implements all endpoints
- [ ] Responses match OpenAPI spec
- [ ] Error handling is consistent
- [ ] Logging and monitoring are in place
- [ ] Performance is acceptable

## Next Steps

- Read the [API Consumer Guide](api-consumer-guide.md) to understand the consumer perspective
- Review existing APIs in `specs/` for examples
- Check the [design document](../.kiro/specs/domain-api-poc/design.md) for architecture details
- Explore [testing strategies](testing-strategies.md)

## Support

For questions or issues:
- Review the [OpenAPI 3.0 specification](https://swagger.io/specification/)
- Check the [design document](../.kiro/specs/domain-api-poc/design.md)
- Consult existing API specs for patterns
- Ask the team for guidance
