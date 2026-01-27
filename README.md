# Domain APIs POC

Proof-of-concept Domain APIs demonstrating orchestration patterns for UK tax services.

## Current: VPD Submission Returns

The VPD (Vaping Products Duty) Submission Returns Domain API orchestrates three backend services through a unified interface:

- **excise** - VPD registrations, periods, duty calculations
- **customer** - Trader/customer master data
- **tax-platform** - Submission storage and retrieval

## Quick Start

```bash
# Start all services
docker-compose up -d

# Verify mocks are running
curl http://localhost:4010/excise/vpd/registrations/VPD123456 | jq .
curl http://localhost:4011/customers/CUST789 | jq .
curl http://localhost:4012/submissions/vpd/ACK-2026-01-26-000123 | jq .

# Open API Explorer (via docs site)
open http://localhost:8080/explorer.html

# Open Grafana (observability)
open http://localhost:3000  # admin/admin

# Open Docs
open http://localhost:8080
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| excise-mock | 4010 | VPD registrations, periods, duty calculations |
| customer-mock | 4011 | Trader/customer master data |
| tax-platform-mock | 4012 | Submission storage and retrieval |
| docs | 8080 | Documentation + API Explorer |
| lgtm | 3000 | Grafana + Loki + Tempo + Mimir |
| localstack | 4566 | AWS LocalStack (API Gateway) |

## Directory Structure

```
domain-apis/
├── docker-compose.yml           # Full stack definition
├── specs/
│   └── vaping-duty/
│       ├── domain/              # Domain API specifications
│       │   ├── producer/        # Producer OAS (source of truth)
│       │   ├── platform/        # Platform OAS (generated)
│       │   └── fragments/       # Reusable OAS fragments
│       ├── mocks/               # Backend mock specifications
│       │   ├── excise-api.yaml
│       │   ├── customer-api.yaml
│       │   └── tax-platform-api.yaml
│       ├── tests/load/          # k6 load test scripts
│       └── README.md
├── docs/                        # Documentation site
├── tests/                       # Integration tests
└── tools/                       # Utility scripts
```

## Backend Mock APIs

### Excise Service (4010)

```bash
# Get registration
curl http://localhost:4010/excise/vpd/registrations/VPD123456

# Get period
curl http://localhost:4010/excise/vpd/periods/24A1

# Validate and calculate
curl -X POST http://localhost:4010/excise/vpd/validate-and-calculate \
  -H "Content-Type: application/json" \
  -d '{"vpdApprovalNumber":"VPD123456","periodKey":"24A1","submission":{}}'
```

### Customer Service (4011)

```bash
curl http://localhost:4011/customers/CUST789
```

### Tax Platform Service (4012)

```bash
# Store submission
curl -X POST http://localhost:4012/submissions/vpd \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-123" \
  -d '{"vpdApprovalNumber":"VPD123456","periodKey":"24A1","customerId":"CUST789","submission":{},"calculations":{},"warnings":[]}'

# Get by acknowledgement
curl http://localhost:4012/submissions/vpd/ACK-2026-01-26-000123
```

## Test Data

| Resource | Pattern | Example |
|----------|---------|---------|
| VPD Approval Number | `VPD[0-9]{6}` | `VPD123456` |
| Period Key | `[0-9]{2}[A-Z][0-9]` | `24A1` |
| Customer ID | `CUST[0-9]+` | `CUST789` |
| Acknowledgement | `ACK-YYYY-MM-DD-NNNNNN` | `ACK-2026-01-26-000123` |

## Load Testing

```bash
# Install k6
brew install k6

# Run smoke test against mocks
k6 run specs/vaping-duty/tests/load/smoke-test-mocks.js
```

## Generate Documentation

```bash
# Install dependencies (first time)
npm install

# Generate Redoc documentation
./tools/generate-docs.sh
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [Mock Servers](docs/mock-servers.md)
- [API Producer Guide](docs/api-producer-guide.md)
- [API Consumer Guide](docs/api-consumer-guide.md)
