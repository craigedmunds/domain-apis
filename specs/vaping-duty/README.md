# VPD Submission Returns Domain API POC

Proof-of-concept Domain API for Vaping Products Duty (VPD) Submission Returns that orchestrates three backend services through a unified interface.

## Quick Start

```bash
# Start all services
docker-compose up -d

# Verify mocks are running
curl http://localhost:4010/excise/vpd/registrations/VPD123456 | jq .
curl http://localhost:4011/customers/CUST789 | jq .
curl http://localhost:4012/submissions/vpd/ACK-2026-01-26-000123 | jq .

# Open API Explorer
open http://localhost:8090

# Open Grafana (observability)
open http://localhost:3000  # admin/admin
```

## Architecture

```
                                    ┌─────────────────┐
                                    │   API Explorer  │
                                    │  (Swagger UI)   │
                                    │   :8090         │
                                    └────────┬────────┘
                                             │
        ┌────────────────────────────────────┼────────────────────────────────────┐
        │                                    │                                    │
        ▼                                    ▼                                    ▼
┌───────────────┐                  ┌───────────────┐                  ┌───────────────┐
│  excise-mock  │                  │ customer-mock │                  │tax-platform-  │
│   (Prism)     │                  │   (Prism)     │                  │   mock        │
│   :4010       │                  │   :4011       │                  │   :4012       │
└───────────────┘                  └───────────────┘                  └───────────────┘
        │                                    │                                    │
        └────────────────────────────────────┴────────────────────────────────────┘
                                             │
                                    ┌────────┴────────┐
                                    │      LGTM      │
                                    │   (Grafana)    │
                                    │    :3000       │
                                    └─────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| excise-mock | 4010 | VPD registrations, periods, duty calculations |
| customer-mock | 4011 | Trader/customer master data |
| tax-platform-mock | 4012 | Submission storage and retrieval |
| swagger-ui | 8090 | Interactive API explorer |
| lgtm | 3000 | Grafana + Loki + Tempo + Mimir |

## Backend Mocks

### Excise Service

System of record for VPD registrations, periods, and duty calculation rules.

```bash
# Get registration
curl http://localhost:4010/excise/vpd/registrations/VPD123456 | jq .

# Get period
curl http://localhost:4010/excise/vpd/periods/24A1 | jq .

# Validate and calculate
curl -X POST http://localhost:4010/excise/vpd/validate-and-calculate \
  -H "Content-Type: application/json" \
  -d '{
    "vpdApprovalNumber": "VPD123456",
    "periodKey": "24A1",
    "submission": {
      "basicInformation": {
        "returnType": "ORIGINAL",
        "submittedBy": {"type": "ORG", "name": "Example Vapes Ltd"}
      },
      "dutyProducts": []
    }
  }' | jq .
```

### Customer Service

System of record for trader/organization master data.

```bash
# Get customer
curl http://localhost:4011/customers/CUST789 | jq .
```

### Tax Platform Service

System of record for submission storage and acknowledgements.

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

# Find by approval + period
curl "http://localhost:4012/submissions/vpd?vpdApprovalNumber=VPD123456&periodKey=24A1" | jq .
```

## Test Data

| Resource | Pattern | Example |
|----------|---------|---------|
| VPD Approval Number | `VPD[0-9]{6}` | `VPD123456` |
| Period Key | `[0-9]{2}[A-Z][0-9]` | `24A1` |
| Customer ID | `CUST[0-9]+` | `CUST789` |
| Acknowledgement Reference | `ACK-YYYY-MM-DD-NNNNNN` | `ACK-2026-01-26-000123` |

## Load Testing

```bash
# Install k6
brew install k6

# Run smoke test against mocks
k6 run tests/load/smoke-test-mocks.js

# Run with custom URLs
k6 run -e EXCISE_URL=http://localhost:4010 tests/load/smoke-test-mocks.js
```

## Observability

Access Grafana at http://localhost:3000 (admin/admin).

**Available datasources:**
- **Loki** - Log aggregation
- **Tempo** - Distributed tracing
- **Mimir** - Metrics (Prometheus-compatible)

## Directory Structure

```
specs/vaping-duty/
├── docker-compose.yaml          # Full stack definition
├── README.md                    # This file
├── domain/                      # Domain API specifications
│   ├── producer/                # Producer OAS (source of truth)
│   ├── platform/                # Platform OAS (generated)
│   ├── fragments/               # Reusable OAS fragments
│   └── tools/                   # Platform OAS generator
├── mocks/                       # Backend mock specifications
│   ├── excise-api.yaml
│   ├── customer-api.yaml
│   └── tax-platform-api.yaml
└── tests/
    └── load/                    # k6 load test scripts
```

## Next Steps

1. **Phase 2**: Create Quarkus/Camel domain service
2. **Phase 3**: Implement orchestration logic
3. **Phase 4**: Add sparse fieldsets support
4. **Phase 5**: Kong gateway integration
5. **Phase 6**: Kubernetes deployment
