# VPD Submission Returns Domain API POC

Proof-of-concept Domain API for Vaping Products Duty (VPD) Submission Returns that orchestrates three backend services through a unified interface.

## Quick Start

```bash
# Start all services (from repos/domain-apis/)
docker-compose up -d

# Verify excise mock returns XML
curl http://localhost:4010/excise/vpd/registrations/VPD123456

# Verify JSON mocks
curl http://localhost:4011/customers/CUST789 | jq .
curl http://localhost:4012/submissions/vpd/ACK-2026-01-26-000123 | jq .

# Run smoke tests
docker-compose run k6 run /tests/smoke-test-mocks.js

# Open Grafana (observability)
open http://localhost:3000  # admin/admin
```

## Architecture

```
                        ┌──────────────────────────────────────────────────────┐
                        │                   External Ports                     │
                        │     :4010 (excise)   :4011 (customer)   :4012 (tax)  │
                        └──────────────────────────────────────────────────────┘
                                            │
                        ┌───────────────────┼───────────────────┐
                        │                   │                   │
                        ▼                   ▼                   ▼
                ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
                │ excise-proxy  │   │customer-proxy │   │tax-platform-  │
                │   (Envoy)     │   │   (Envoy)     │   │   proxy       │
                │ tracing/CORS  │   │ tracing/CORS  │   │   (Envoy)     │
                └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
                        │                   │                   │
                        ▼                   ▼                   ▼
                ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
                │ excise-mock   │   │ customer-mock │   │tax-platform-  │
                │  (WireMock)   │   │   (Prism)     │   │   mock        │
                │   **XML**     │   │   JSON        │   │   (Prism)     │
                └───────────────┘   └───────────────┘   └───────────────┘
                        │                   │                   │
                        └───────────────────┴───────────────────┘
                                            │
                                    ┌───────┴───────┐
                                    │     LGTM     │
                                    │   (Grafana)  │
                                    │    :3000     │
                                    │ traces/logs  │
                                    └──────────────┘
```

## Services

| Service | Port | Content-Type | Technology |
|---------|------|--------------|------------|
| excise-proxy | 4010 | **XML** | Envoy → WireMock |
| customer-proxy | 4011 | JSON | Envoy → Prism |
| tax-platform-proxy | 4012 | JSON | Envoy → Prism |
| lgtm | 3000 | - | Grafana + Loki + Tempo + Mimir |
| k6 | - | - | Load testing (on-demand) |

## Content Types

The excise backend returns **XML** to simulate a legacy system. The Domain API (Phase 3) transforms XML→JSON for unified responses.

| Backend | Request | Response |
|---------|---------|----------|
| excise | JSON | **XML** |
| customer | - | JSON |
| tax-platform | JSON | JSON |

## Backend Mocks

### Excise Service (XML via WireMock)

System of record for VPD registrations, periods, and duty calculation rules.

```bash
# Get registration (XML response)
curl http://localhost:4010/excise/vpd/registrations/VPD123456

# Get period (XML response)
curl http://localhost:4010/excise/vpd/periods/24A1

# Validate and calculate (JSON request, XML response)
curl -X POST http://localhost:4010/excise/vpd/validate-and-calculate \
  -H "Content-Type: application/json" \
  -d '{"vpdApprovalNumber":"VPD123456","periodKey":"24A1","submission":{}}'
```

### Customer Service (JSON via Prism)

```bash
curl http://localhost:4011/customers/CUST789 | jq .
```

### Tax Platform Service (JSON via Prism)

```bash
# Store submission
curl -X POST http://localhost:4012/submissions/vpd \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-123" \
  -d '{
    "vpdApprovalNumber": "VPD123456",
    "periodKey": "24A1",
    "customerId": "CUST789",
    "submission": {},
    "calculations": {
      "totalDutyDue": {"amount": 12345.67, "currency": "GBP"},
      "vat": {"amount": 2469.13, "currency": "GBP"}
    },
    "warnings": []
  }' | jq .

# Get by acknowledgement reference
curl http://localhost:4012/submissions/vpd/ACK-2026-01-26-000123 | jq .
```

## Observability

Access Grafana at http://localhost:3000 (admin/admin).

**Available datasources:**
- **Tempo** - Distributed tracing (traces from Envoy proxies)
- **Loki** - Log aggregation
- **Mimir** - Metrics (Prometheus-compatible)

**Viewing traces:**
1. Open Grafana → Explore → Select Tempo datasource
2. Search for traces by service name (excise-proxy, customer-proxy, tax-platform-proxy)

## Testing

```bash
# Run smoke tests (in docker)
docker-compose run k6 run /tests/smoke-test-mocks.js

# Run locally (if k6 installed)
k6 run specs/vaping-duty/tests/load/smoke-test-mocks.js
```

## Test Data

| Resource | Example |
|----------|---------|
| VPD Approval Number | `VPD123456` |
| Period Key (OPEN) | `24A1` |
| Period Key (FILED) | `24A2` |
| Customer ID | `CUST789` |
| Acknowledgement Reference | `ACK-2026-01-26-000123` |

## Directory Structure

```
specs/vaping-duty/
├── README.md
├── domain/                      # Domain API specifications
│   ├── producer/                # Producer OAS (source of truth)
│   ├── platform/                # Platform OAS (generated)
│   ├── fragments/               # Reusable OAS fragments
│   └── tools/                   # Platform OAS generator
├── mocks/
│   ├── excise-api.yaml          # Excise OAS (XML responses)
│   ├── customer-api.yaml        # Customer OAS (JSON)
│   ├── tax-platform-api.yaml    # Tax Platform OAS (JSON)
│   └── wiremock/                # WireMock stubs for excise
│       └── mappings/            # Request/response mappings
├── proxies/                     # Envoy proxy configurations
│   ├── envoy-excise.yaml
│   ├── envoy-customer.yaml
│   └── envoy-tax-platform.yaml
tests/load/                     # Load tests (repo root)
└── smoke-test-mocks.js
```
