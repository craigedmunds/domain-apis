# Domain API Gateway Lambda

This Lambda function provides cross-API aggregation capabilities for the Domain API Gateway. It handles routing requests to backend APIs and optionally fetches related resources based on the `include` query parameter.

## Features

- **Request Routing**: Routes requests to appropriate backend APIs based on path
- **Include Parameter**: Fetches related resources from multiple APIs in parallel
- **Response Merging**: Merges related resources into `_included` structure
- **URL Rewriting**: Rewrites backend API URLs to point through gateway
- **CORS Support**: Adds CORS headers for browser compatibility
- **Partial Failure Handling**: Continues with partial results if some includes fail
- **Error Handling**: Returns standard error responses for gateway-level issues

## Environment Variables

- `TAXPAYER_API_URL`: URL for Taxpayer API backend (default: `http://taxpayer-api:4010`)
- `INCOME_TAX_API_URL`: URL for Income Tax API backend (default: `http://income-tax-api:4010`)
- `PAYMENT_API_URL`: URL for Payment API backend (default: `http://payment-api:4010`)
- `STAGE`: API Gateway stage name (default: `dev`) - used to prefix URLs

## Building

```bash
npm install
npm run build
```

## Packaging for Lambda

```bash
npm run package
```

This creates `aggregation-lambda.zip` containing the compiled code and dependencies.

## Testing

```bash
npm test
```

## Usage Examples

### Direct API Access (no aggregation)

```bash
curl http://gateway-url/taxpayer/v1/taxpayers/TP123456
```

### With Include Parameter (aggregation)

```bash
curl "http://gateway-url/taxpayer/v1/taxpayers/TP123456?include=taxReturns,payments"
```

## Response Format

### Without Include

```json
{
  "id": "TP123456",
  "type": "taxpayer",
  "nino": "AB123456C",
  "_links": {
    "self": {"href": "http://gateway-url/taxpayer/v1/taxpayers/TP123456"},
    "taxReturns": {"href": "http://gateway-url/income-tax/v1/tax-returns?taxpayerId=TP123456"}
  }
}
```

### With Include

```json
{
  "id": "TP123456",
  "type": "taxpayer",
  "nino": "AB123456C",
  "_links": {
    "self": {"href": "http://gateway-url/taxpayer/v1/taxpayers/TP123456"},
    "taxReturns": {"href": "http://gateway-url/income-tax/v1/tax-returns?taxpayerId=TP123456"}
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

## Error Handling

### Backend API Unavailable (502)

```json
{
  "error": {
    "code": "GATEWAY_ERROR",
    "message": "Failed to aggregate resources",
    "details": "Unable to reach backend API"
  }
}
```

### Partial Include Failure

If some includes fail, the Lambda continues with partial results and logs errors. The primary resource is always returned successfully.

## Architecture

```
Client Request with ?include
         ↓
   AWS API Gateway
         ↓
   Aggregation Lambda
         ↓
    ┌────┴────┬────────┐
    ↓         ↓        ↓
Taxpayer  Income Tax  Payment
   API       API       API
    ↓         ↓        ↓
    └────┬────┴────────┘
         ↓
   Merged Response
```

## Implementation Details

### Request Routing

The Lambda routes requests based on path prefixes:
- `/taxpayer/*` → Taxpayer API
- `/income-tax/*` → Income Tax API
- `/payment/*` → Payment API

### Include Parameter Processing

1. Parse comma-separated relationship names from `include` parameter
2. Extract relationship URLs from `_links` in primary response
3. Fetch related resources in parallel using `Promise.all`
4. Handle both single resources and collections
5. Merge results into `_included` field

### URL Rewriting

Backend API URLs in `_links` are rewritten to point through the gateway:
- `http://taxpayer-api:4010/...` → `http://gateway-url/...`
- `http://localhost:8081/...` → `http://gateway-url/...`

This ensures clients can follow links through the gateway for consistent aggregation.

### CORS Support

The Lambda adds CORS headers to all responses:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

### Graceful Degradation

If fetching an included resource fails:
- The error is logged
- The include is omitted from `_included`
- The primary resource is still returned successfully
- Other includes continue to be fetched

This ensures partial failures don't break the entire request.
