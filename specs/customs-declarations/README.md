# Customs Declarations Domain API

Reference implementation demonstrating Enterprise Integration Patterns (EIPs) in HIP Simple API workflows using Apache Camel YAML DSL.

## EIP Patterns Demonstrated

This domain API implements the patterns defined in [`.ai/projects/hip/simple-api-enhancements/spec.md`](../../../.ai/projects/hip/simple-api-enhancements/spec.md).

### Pipeline Patterns (Producer-configured)

| Pattern | EIP Ref | Route file | Camel DSL |
|---------|---------|-----------|-----------|
| Pipes and Filters | §4.1 | `post-declaration.yaml` | Sequential route steps, `direct:` |
| Process Manager | §4.3 | `post-declaration.yaml` | Nested `choice` + `direct:` sub-routes |
| Content-Based Router | §4.4 | `post-declaration.yaml` | `choice` / `when` / `otherwise` |
| Message Filter | §4.5 | `post-declaration.yaml` | `choice` + `stop` (short-circuit) |
| Content Enricher | §4.6 | `post-declaration.yaml` | Kamelet call + `setProperty` |
| Content Filter | §4.7 | `get-trader-overview.yaml` | `transform` + Groovy field selection |
| Normalizer | §4.8 | `get-trader-overview.yaml` | `transform` + Groovy per-source mapping |
| Splitter | §4.9 | `post-declaration.yaml` | `split` with `jsonpath` |
| Aggregator | §4.10 | `post-declaration.yaml` | `setProperty` accumulator + `transform` |
| Scatter-Gather | §4.11 | `get-trader-overview.yaml` | `multicast` + `parallelProcessing: true` |
| Composed Message Processor | §4.12 | `post-declaration.yaml` | `split` + per-item `choice` |

### Error Handling (Dead Letter Channel equivalent)

Camel's `doTry`/`doCatch` blocks wrap every backend Kamelet call. On failure:
- Classification failures: zero duty, item flagged
- Trader registration failure: 502 returned, no data lost
- Scatter-Gather legs: partial results with `error` field; one registry failure does not fail the whole request

This is the synchronous REST equivalent of the Dead Letter Channel pattern.

## API Endpoints

### POST /customs/declarations

Submits a customs declaration. Demonstrates:
- **Content-Based Router** — `declarationType: simplified` → fast-track path; `declarationType: full` → standard path
- **Message Filter** — invalid/unregistered traders fail fast (422) before any backend calls
- **Content Enricher** — trader name fetched from customs registry
- **Splitter + Aggregator** — each goods item individually classified; duty totalled
- **Composed Message Processor** (full path only) — controlled goods get additional licence check

### GET /customs/traders/{eori}/overview

Returns trader status across three registries. Demonstrates:
- **Scatter-Gather** — excise, customs, and VAT registries queried in parallel
- **Normalizer** — each registry returns a different structure; unified into `TraderOverview`
- **Content Filter** — internal/null fields stripped from response

## Structure

```
specs/customs-declarations/
  domain/
    producer/
      customs-declarations-api.yaml   # OAS 3.1 — consumer-facing contract
    platform/
      routes/
        rest-config.yaml             # REST entry point + routing
        post-declaration.yaml        # Declaration pipeline (CBR, Filter, Split, Aggregate)
        get-trader-overview.yaml     # Trader overview (Scatter-Gather, Normalizer)
        common.yaml                  # Shared: headers, health check
      kamelets/
        tariff-classifyItem.kamelet.yaml
        customs-getTraderRegistration.kamelet.yaml
        customs-checkLicence.kamelet.yaml
        customs-getAuthorisation.kamelet.yaml
        excise-getRegistration.kamelet.yaml
        vat-getRegistration.kamelet.yaml
        tax-platform-storeDeclaration.kamelet.yaml
        tax-platform-getDeclaration.kamelet.yaml
  mocks/
    tariff-api.yaml                  # UK Global Tariff mock (Prism/WireMock)
    customs-api.yaml                 # Customs registry mock
    excise-api.yaml                  # Excise registry mock
    vat-api.yaml                     # VAT registry mock
    tax-platform-api.yaml            # Tax platform storage mock
```

## Running Locally

Start mock servers (using Prism):

```bash
# In separate terminals:
npx @stoplight/prism-cli mock specs/customs-declarations/mocks/tariff-api.yaml -p 4011
npx @stoplight/prism-cli mock specs/customs-declarations/mocks/customs-api.yaml -p 4012
npx @stoplight/prism-cli mock specs/customs-declarations/mocks/excise-api.yaml -p 4013
npx @stoplight/prism-cli mock specs/customs-declarations/mocks/vat-api.yaml -p 4014
npx @stoplight/prism-cli mock specs/customs-declarations/mocks/tax-platform-api.yaml -p 4015
```

Run the domain API:

```bash
camel run \
  specs/customs-declarations/domain/platform/routes/*.yaml \
  specs/customs-declarations/domain/platform/kamelets/*.kamelet.yaml \
  --camel-version=4.8.0
```

Test simplified declaration:

```bash
curl -s -X POST http://localhost:8080/customs/declarations \
  -H 'Content-Type: application/json' \
  -d '{
    "declarationType": "simplified",
    "eori": "GB123456789000",
    "goodsItems": [
      {
        "commodityCode": "2204.21",
        "description": "Wine of fresh grapes",
        "quantity": 100,
        "unit": "LTR",
        "value": 1200.00,
        "currency": "GBP"
      }
    ]
  }'
```

Test trader overview (Scatter-Gather):

```bash
curl -s http://localhost:8080/customs/traders/GB123456789000/overview
```

Test full declaration with controlled goods:

```bash
curl -s -X POST http://localhost:8080/customs/declarations \
  -H 'Content-Type: application/json' \
  -d '{
    "declarationType": "full",
    "eori": "GB123456789000",
    "goodsItems": [
      {
        "commodityCode": "2204.21",
        "description": "Wine of fresh grapes",
        "quantity": 100,
        "unit": "LTR",
        "value": 1200.00,
        "currency": "GBP"
      },
      {
        "commodityCode": "3004.90",
        "description": "Pharmaceuticals",
        "quantity": 10,
        "unit": "KGM",
        "value": 5000.00,
        "currency": "GBP",
        "controlled": true
      }
    ]
  }'
```

## Related

- [EIP Spec](../../../.ai/projects/hip/simple-api-enhancements/spec.md) — full pattern documentation
- [EIP Plan](../../../.ai/projects/hip/simple-api-enhancements/plan.md) — implementation rationale
- [VPD Domain API](../vaping-duty/) — existing POC demonstrating core patterns
- [INTEGRATION_TEMPLATE.md](../../docs/INTEGRATION_TEMPLATE.md) — reusable route patterns
- [REUSE_PATTERNS.md](../../docs/REUSE_PATTERNS.md) — YAML vs Groovy decision guide
