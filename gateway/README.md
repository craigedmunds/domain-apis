# API Gateway and Overlay Pattern

This directory contains the API Gateway implementation and the overlay pattern for generating user-facing API documentation.

## Architecture

### Backend APIs (Source of Truth)
- `specs/taxpayer/taxpayer-api.yaml`
- `specs/income-tax/income-tax-api.yaml`
- `specs/payment/payment-api.yaml`

These specs define the **pure backend APIs** without any gateway knowledge. They:
- Document the backend API contract
- Are used by Prism mock servers
- Remain decoupled from gateway implementation
- Return `application/json` responses

### Gateway Overlay
- `gateway/gateway-overlay.yaml`

Defines gateway-specific features that are **merged** with backend specs:
- Gateway server URLs
- Content negotiation (Accept header)
- Include parameter for aggregation
- Three response content types:
  - `application/vnd.domain+json` - Aggregated mode with `_included`
  - `application/json` - Simple REST mode
  - `application/vnd.raw` - Pass-through mode

### Gateway-Enhanced Specs (Generated)
- `docs/specs/taxpayer/taxpayer-api.yaml`
- `docs/specs/income-tax/income-tax-api.yaml`
- `docs/specs/payment/payment-api.yaml`

These are **generated** by merging backend specs with the gateway overlay. They:
- Document the complete user-facing API (via gateway)
- Include content negotiation features
- Are served to Swagger UI for interactive documentation
- Are used to generate static HTML documentation

## Workflow

### 1. Edit Backend Specs
When adding or modifying API endpoints, edit the backend specs:

```bash
# Edit the source of truth
vim specs/taxpayer/taxpayer-api.yaml
```

### 2. Regenerate Gateway-Enhanced Specs
Run the merge task to apply the gateway overlay:

```bash
task docs:merge-gateway-overlay
```

This runs `tools/merge-gateway-overlay.js` which:
1. Loads each backend spec
2. Loads the gateway overlay
3. Merges them together:
   - Replaces servers with gateway URLs
   - Adds Accept header parameter to GET operations
   - Adds include parameter to resource endpoints
   - Expands response content types (3 media types)
   - Adds `_included` schema for aggregated responses
4. Saves gateway-enhanced specs to `docs/specs/`

### 3. Generate Documentation
Generate HTML documentation from gateway-enhanced specs:

```bash
task docs
```

This:
1. Merges gateway overlay (if not already done)
2. Generates Redoc HTML from gateway-enhanced specs
3. Copies specs to docs folder for Swagger UI

## Content Negotiation

The gateway supports three modes via the `Accept` header:

### Aggregated Mode (Default)
```bash
curl -H "Accept: application/vnd.domain+json" \
  "http://gateway/taxpayers/TP123456?include=taxReturns"
```

Response includes `_included` section with related resources.

### Simple REST Mode
```bash
curl -H "Accept: application/json" \
  "http://gateway/taxpayers/TP123456"
```

Standard JSON response, `include` parameter ignored.

### Pass-Through Mode
```bash
curl -H "Accept: application/vnd.raw" \
  "http://gateway/taxpayers/TP123456"
```

Raw backend response, no URL rewriting or transformation.

## Benefits of This Approach

1. **Decoupling**: Backend specs remain pure, no gateway knowledge
2. **Single Source of Truth**: Backend specs are authoritative
3. **Automated**: Gateway features added programmatically
4. **Maintainable**: Changes to backend specs automatically flow to docs
5. **Flexible**: Can serve different specs for different audiences
6. **User-Focused**: Documentation shows complete user-facing API

## File Structure

```
domain-apis/
├── specs/                          # Backend specs (source of truth)
│   ├── taxpayer/
│   │   └── taxpayer-api.yaml      # Pure backend spec
│   ├── income-tax/
│   │   └── income-tax-api.yaml
│   └── payment/
│       └── payment-api.yaml
│
├── gateway/
│   ├── gateway-overlay.yaml        # Gateway features to merge
│   ├── gateway-api.yaml            # Pure gateway proxy spec
│   └── lambda/                     # Gateway implementation
│       └── src/
│           └── index.ts            # Content negotiation logic
│
├── tools/
│   └── merge-gateway-overlay.js    # Merge script
│
└── docs/
    └── specs/                      # Generated gateway-enhanced specs
        ├── taxpayer/
        │   └── taxpayer-api.yaml  # Backend + gateway overlay
        ├── income-tax/
        │   └── income-tax-api.yaml
        └── payment/
            └── payment-api.yaml
```

## Modifying Gateway Features

To change gateway features (e.g., add new content type):

1. Edit `gateway/gateway-overlay.yaml`
2. Update `tools/merge-gateway-overlay.js` if needed
3. Regenerate: `task docs:merge-gateway-overlay`
4. Test in Swagger UI

## Testing

The gateway implementation is tested at multiple levels:

- **Unit tests**: `gateway/lambda/src/index.content-negotiation.test.ts`
- **Acceptance tests**: `tests/acceptance/gateway/gateway-api.spec.ts`
- **Manual testing**: Swagger UI with media type dropdown

All tests validate the three content negotiation modes work correctly.
