# API Consumer Guide

This guide is for developers who want to **consume** the Domain APIs - whether you're building a frontend application, integrating with another system, or exploring the API capabilities.

## Table of Contents

- [Quick Start](#quick-start)
- [Understanding the Response Structure](#understanding-the-response-structure)
- [Navigating Relationships](#navigating-relationships)
- [Using the Include Parameter](#using-the-include-parameter)
- [Nested Includes](#nested-includes)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)

## Quick Start

### Available APIs

The Domain API system consists of three separate APIs:

| API | Base URL | Purpose |
|-----|----------|---------|
| **Taxpayer API** | `/taxpayer/v1` | Taxpayer identity and registration |
| **Income Tax API** | `/income-tax/v1` | Tax returns and assessments |
| **Payment API** | `/payment/v1` | Payments and allocations |

### Your First Request

Get a taxpayer by ID:

```bash
curl http://localhost:8081/taxpayer/v1/taxpayers/TP123456
```

Response:
```json
{
  "id": "TP123456",
  "type": "taxpayer",
  "nino": "AB123456C",
  "name": {
    "firstName": "John",
    "lastName": "Smith"
  },
  "address": {
    "line1": "10 Downing Street",
    "postcode": "SW1A 2AA",
    "country": "GB"
  },
  "_links": {
    "self": {
      "href": "/taxpayer/v1/taxpayers/TP123456"
    },
    "taxReturns": {
      "href": "/income-tax/v1/tax-returns?taxpayerId=TP123456",
      "type": "collection",
      "title": "Tax returns for this taxpayer"
    },
    "payments": {
      "href": "/payment/v1/payments?taxpayerId=TP123456",
      "type": "collection",
      "title": "Payments made by this taxpayer"
    }
  }
}
```

## Understanding the Response Structure

Every resource in the Domain APIs follows a consistent structure:

### Core Fields

```json
{
  "id": "TP123456",           // Unique identifier
  "type": "taxpayer",         // Resource type
  // ... resource-specific fields ...
  "_links": { /* ... */ }     // Relationships (always present)
}
```

### The `_links` Field

The `_links` field shows **what relationships are available** for this resource:

```json
"_links": {
  "self": {
    "href": "/taxpayer/v1/taxpayers/TP123456"
  },
  "taxReturns": {
    "href": "/income-tax/v1/tax-returns?taxpayerId=TP123456",
    "type": "collection",
    "title": "Tax returns for this taxpayer"
  }
}
```

**Key points:**
- `self` always points to the current resource
- Other links point to related resources (may be in different APIs)
- `type: "collection"` indicates the link returns multiple items
- Links are always present, even if you use the `include` parameter

### The `_includes` Field (Optional)

When you use the `include` parameter, resources gain an `_includes` field showing **which specific related resources are embedded** in this response:

```json
"_includes": {
  "taxReturns": ["TR20230001", "TR20230002"]
}
```

This tells you to look for these IDs in the `_included` section.

### The `_included` Field (Optional)

When you use the `include` parameter, the response gains an `_included` field containing the **actual embedded resources**:

```json
"_included": {
  "taxReturns": [
    {
      "id": "TR20230001",
      "type": "tax-return",
      "taxpayerId": "TP123456",
      "taxYear": "2023-24",
      "_links": { /* ... */ }
    }
  ]
}
```

**Key points:**
- Resources are grouped by type
- Each resource is complete with its own `_links`
- Resources are deduplicated by type and ID

## Navigating Relationships

There are two ways to navigate relationships between resources:

### Option 1: Follow Links Manually (Multiple Requests)

**Step 1:** Get the taxpayer
```bash
curl http://localhost:8081/taxpayer/v1/taxpayers/TP123456
```

**Step 2:** Extract the `taxReturns` link from `_links`
```json
"taxReturns": {
  "href": "/income-tax/v1/tax-returns?taxpayerId=TP123456"
}
```

**Step 3:** Follow the link
```bash
curl http://localhost:8082/income-tax/v1/tax-returns?taxpayerId=TP123456
```

**When to use:**
- You only need the primary resource initially
- You want to paginate through large collections
- You need fresh data for relationships

### Option 2: Use the Include Parameter (Single Request)

Get the taxpayer with tax returns included:

```bash
curl "http://localhost:8081/taxpayer/v1/taxpayers/TP123456?include=taxReturns"
```

Response includes both:
```json
{
  "id": "TP123456",
  "type": "taxpayer",
  "_links": {
    "taxReturns": {
      "href": "/income-tax/v1/tax-returns?taxpayerId=TP123456"
    }
  },
  "_includes": {
    "taxReturns": ["TR20230001", "TR20230002"]
  },
  "_included": {
    "taxReturns": [
      { "id": "TR20230001", /* ... */ },
      { "id": "TR20230002", /* ... */ }
    ]
  }
}
```

**When to use:**
- You know you'll need the related resources
- You want to minimize network requests
- You're building a UI that displays related data together

## Using the Include Parameter

### Basic Syntax

Include one relationship:
```bash
?include=taxReturns
```

Include multiple relationships:
```bash
?include=taxReturns,payments
```

### Understanding the Response

When you use `include`, you get three pieces of information:

1. **`_links`** - Shows all available relationships (for navigation/refresh)
2. **`_includes`** - Lists which specific resources are embedded (by ID)
3. **`_included`** - Contains the actual embedded resources

**Example:**

Request:
```bash
GET /taxpayers/TP123456?include=taxReturns
```

Response structure:
```json
{
  "id": "TP123456",
  // ... taxpayer fields ...
  
  "_links": {
    "taxReturns": {
      "href": "/tax-returns?taxpayerId=TP123456",
      "type": "collection"
    }
  },
  
  "_includes": {
    "taxReturns": ["TR20230001", "TR20230002"]
  },
  
  "_included": {
    "taxReturns": [
      {
        "id": "TR20230001",
        "taxpayerId": "TP123456",
        "taxYear": "2023-24",
        "_links": { /* ... */ }
      },
      {
        "id": "TR20230002",
        "taxpayerId": "TP123456",
        "taxYear": "2022-23",
        "_links": { /* ... */ }
      }
    ]
  }
}
```

### Why Both `_links` and `_includes`?

**`_links`** is for **capability** - what you *can* do:
- Navigate to the full collection
- Refresh the data
- Paginate through all items
- Filter or sort the collection

**`_includes`** is for **state** - what's *currently* embedded:
- Shows which specific items are in this response
- Provides the "join key" to find them in `_included`
- May be a subset of the full collection

**Example scenario:**
A taxpayer has 100 tax returns, but you only include the 10 most recent:
- `_links.taxReturns` shows where to get all 100
- `_includes.taxReturns` lists the 10 IDs that are embedded
- `_included.taxReturns` contains those 10 resources

## Nested Includes

You can include relationships of included resources using **dot notation**.

### Syntax

```bash
?include=relationshipName.nestedRelationshipName
```

### Examples

**Include tax returns and their assessments:**
```bash
GET /taxpayers/TP123456?include=taxReturns.assessments
```

**Include multiple nested relationships:**
```bash
GET /taxpayers/TP123456?include=taxReturns.assessments,taxReturns.allocations
```

**Include multiple levels deep:**
```bash
GET /taxpayers/TP123456?include=taxReturns.assessments.payments
```

### Understanding Nested Include Responses

Request:
```bash
GET /taxpayers/TP123456?include=taxReturns.assessments
```

Response:
```json
{
  "id": "TP123456",
  "type": "taxpayer",
  "_links": {
    "taxReturns": {"href": "/tax-returns?taxpayerId=TP123456"}
  },
  "_includes": {
    "taxReturns": ["TR20230001", "TR20230002"]
  },
  "_included": {
    "taxReturns": [
      {
        "id": "TR20230001",
        "taxpayerId": "TP123456",
        "_links": {
          "assessments": {"href": "/assessments?taxReturnId=TR20230001"}
        },
        "_includes": {
          "assessments": ["AS20230001"]
        }
      },
      {
        "id": "TR20230002",
        "taxpayerId": "TP123456",
        "_links": {
          "assessments": {"href": "/assessments?taxReturnId=TR20230002"}
        },
        "_includes": {
          "assessments": ["AS20220001"]
        }
      }
    ],
    "assessments": [
      {
        "id": "AS20230001",
        "taxReturnId": "TR20230001",
        "assessmentDate": "2024-01-15T10:30:00Z",
        "_links": { /* ... */ }
      },
      {
        "id": "AS20220001",
        "taxReturnId": "TR20230002",
        "assessmentDate": "2023-01-15T10:30:00Z",
        "_links": { /* ... */ }
      }
    ]
  }
}
```

**Key points:**
- Parent resources (taxReturns) are automatically included
- All resources remain in the flat `_included` structure
- Each level has its own `_includes` field showing what's embedded
- Resources are deduplicated across all levels

### Nested Include Rules

1. **Implicit Parent Inclusion**: `?include=taxReturns.assessments` automatically includes both tax returns AND assessments
2. **Depth Limit**: Maximum 5 levels deep (configurable)
3. **Flat Structure**: All resources are in the flat `_included` object, grouped by type
4. **Deduplication**: Same resource appearing multiple times is only included once

## Best Practices

### 1. Use Includes Wisely

**✅ Good:**
```bash
# You know you need both taxpayer and tax returns
GET /taxpayers/TP123456?include=taxReturns
```

**❌ Avoid:**
```bash
# Including everything "just in case"
GET /taxpayers/TP123456?include=taxReturns,payments,taxReturns.assessments,taxReturns.allocations
```

**Why:** Each include level requires additional API calls on the backend. Only include what you actually need.

### 2. Cache Relationship URLs

The URLs in `_links` are stable - cache them to avoid parsing responses repeatedly.

```javascript
// Good: Cache the relationship URL
const taxReturnsUrl = taxpayer._links.taxReturns.href;
// Use taxReturnsUrl for pagination, filtering, etc.
```

### 3. Handle Missing Relationships

Not all resources have all relationships:

```javascript
// Always check if a relationship exists
if (taxpayer._links.taxReturns) {
  // Fetch tax returns
} else {
  // Handle case where taxpayer has no tax returns
}
```

### 4. Use `_includes` to Find Embedded Resources

```javascript
// Get the taxpayer with included tax returns
const response = await fetch('/taxpayers/TP123456?include=taxReturns');
const data = await response.json();

// Use _includes to find the embedded resources
const taxReturnIds = data._includes.taxReturns || [];
const taxReturns = taxReturnIds.map(id => 
  data._included.taxReturns.find(tr => tr.id === id)
);
```

### 5. Respect Depth Limits

Don't exceed the maximum nesting depth (default: 5 levels):

**✅ Good:**
```bash
?include=taxReturns.assessments.payments
```

**❌ Will fail:**
```bash
?include=a.b.c.d.e.f  # 6 levels - exceeds limit
```

## Common Patterns

### Pattern 1: Master-Detail View

Display a taxpayer with their tax returns:

```javascript
// Single request with includes
const response = await fetch(
  '/taxpayers/TP123456?include=taxReturns'
);
const data = await response.json();

// Display taxpayer
displayTaxpayer(data);

// Display tax returns from _included
const taxReturns = data._included.taxReturns || [];
displayTaxReturns(taxReturns);
```

### Pattern 2: Lazy Loading

Load the main resource first, then load relationships on demand:

```javascript
// Load taxpayer
const taxpayer = await fetch('/taxpayers/TP123456').then(r => r.json());
displayTaxpayer(taxpayer);

// Later: User clicks "Show Tax Returns"
const taxReturnsUrl = taxpayer._links.taxReturns.href;
const taxReturns = await fetch(taxReturnsUrl).then(r => r.json());
displayTaxReturns(taxReturns.items);
```

### Pattern 3: Deep Data Fetching

Get a complete view of taxpayer, returns, and assessments:

```javascript
const response = await fetch(
  '/taxpayers/TP123456?include=taxReturns.assessments'
);
const data = await response.json();

// All data is available in one response
const taxpayer = data;
const taxReturns = data._included.taxReturns || [];
const assessments = data._included.assessments || [];

// Build the complete view
displayCompleteView(taxpayer, taxReturns, assessments);
```

### Pattern 4: Pagination with Includes

When paginating, you can still use includes:

```javascript
// Get first page of taxpayers with their tax returns
const page1 = await fetch(
  '/taxpayers?page=1&limit=10&include=taxReturns'
).then(r => r.json());

// Each taxpayer has their tax returns included
page1.items.forEach(taxpayer => {
  const taxReturnIds = taxpayer._includes.taxReturns || [];
  const taxReturns = taxReturnIds.map(id =>
    page1._included.taxReturns.find(tr => tr.id === id)
  );
  displayTaxpayerWithReturns(taxpayer, taxReturns);
});
```

## Error Handling

### Invalid Include Relationship

**Request:**
```bash
GET /taxpayers/TP123456?include=invalidRelationship
```

**Response:** 400 Bad Request
```json
{
  "error": {
    "code": "INVALID_INCLUDE_RELATIONSHIP",
    "message": "Invalid relationship 'invalidRelationship' for resource type 'taxpayer'",
    "status": 400,
    "details": {
      "relationship": "invalidRelationship",
      "resourceType": "taxpayer",
      "availableRelationships": ["taxReturns", "payments"]
    }
  }
}
```

### Depth Limit Exceeded

**Request:**
```bash
GET /taxpayers/TP123456?include=a.b.c.d.e.f
```

**Response:** 400 Bad Request
```json
{
  "error": {
    "code": "INCLUDE_DEPTH_EXCEEDED",
    "message": "Include depth of 6 exceeds maximum allowed depth of 5",
    "status": 400,
    "details": {
      "requestedDepth": 6,
      "maxDepth": 5
    }
  }
}
```

### Resource Not Found

**Request:**
```bash
GET /taxpayers/INVALID
```

**Response:** 404 Not Found
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Taxpayer INVALID not found",
    "status": 404
  }
}
```

## Quick Reference

### Include Parameter Syntax

| Pattern | Example | Description |
|---------|---------|-------------|
| Single | `?include=taxReturns` | Include one relationship |
| Multiple | `?include=taxReturns,payments` | Include multiple relationships |
| Nested | `?include=taxReturns.assessments` | Include nested relationships |
| Deep | `?include=taxReturns.assessments.payments` | Include multiple levels |
| Mixed | `?include=taxReturns,taxReturns.assessments,payments` | Mix of levels |

### Response Fields

| Field | Always Present? | Purpose |
|-------|----------------|---------|
| `id` | Yes | Unique identifier |
| `type` | Yes | Resource type |
| `_links` | Yes | Available relationships |
| `_includes` | Only with `include` | IDs of embedded resources |
| `_included` | Only with `include` | Embedded resources |

### Common Relationship Names

| From | Relationship | To | Type |
|------|--------------|-----|------|
| Taxpayer | `taxReturns` | Tax Returns | Collection |
| Taxpayer | `payments` | Payments | Collection |
| Tax Return | `taxpayer` | Taxpayer | Single |
| Tax Return | `assessments` | Assessments | Collection |
| Tax Return | `allocations` | Payment Allocations | Collection |
| Assessment | `taxReturn` | Tax Return | Single |
| Payment | `taxpayer` | Taxpayer | Single |
| Payment | `allocations` | Payment Allocations | Collection |

## Next Steps

- Read the [API Producer Guide](api-producer-guide.md) to understand how to build APIs
- Explore the [OpenAPI specifications](../specs/) for detailed endpoint documentation
- Try the [interactive API explorer](explorer.html)
- Review [common integration patterns](integration-patterns.md)

## Support

For questions or issues:
- Review the [OpenAPI specifications](../specs/)
- Check the [design document](../.kiro/specs/domain-api-poc/design.md)
- Consult the [troubleshooting guide](troubleshooting.md)
