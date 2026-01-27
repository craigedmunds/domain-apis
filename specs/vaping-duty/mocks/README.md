# VPD Backend Mock Specifications

OpenAPI specifications for the three backend systems that the VPD Submission Returns Domain API orchestrates.

## Backend Systems

### excise-api.yaml
**System:** Excise Duty System
**System of Record For:** VPD registrations, periods, duty calculation rules

**Key Endpoints:**
- `GET /excise/vpd/registrations/{vpdApprovalNumber}` - Returns customerId + approval status
- `GET /excise/vpd/periods/{periodKey}` - Returns period state and dates
- `POST /excise/vpd/validate-and-calculate` - Validates submission, calculates duty/VAT, returns customerId

**Mock Implementation:** Prism (stateless)

### customer-api.yaml
**System:** Customer Master Data
**System of Record For:** Trader/organization information

**Key Endpoints:**
- `GET /customers/{customerId}` - Returns trader name, type, address

**Mock Implementation:** Prism (stateless)

### tax-platform-api.yaml
**System:** Tax Platform Submissions
**System of Record For:** Submission records, acknowledgement references

**Key Endpoints:**
- `POST /submissions/vpd` - Stores submission idempotently (X-Idempotency-Key)
- `GET /submissions/vpd/{acknowledgementReference}` - Retrieves by ack ref
- `GET /submissions/vpd?vpdApprovalNumber=X&periodKey=Y` - Finds by approval+period

**Mock Implementation:** Custom stateful service (Node.js/Go) - requires idempotency tracking

## Mock Data Seed

### excise
- **VPD123456** (ACTIVE, maps to CUST789)
  - Period 24A1: OPEN
  - Period 24A2: FILED

### customer
- **CUST789** → "Example Vapes Ltd" (ORG)
  - Address: 123 High Street, London, AB1 2CD

### tax-platform
- One existing submission for (VPD123456, 24A2) to test GET/409 scenarios

## Running Mocks

```bash
# excise and customer - Prism
prism mock excise-api.yaml --port 8081
prism mock customer-api.yaml --port 8082

# tax-platform - custom mock (see ../../../repos/vaping-duty-poc/mocks/tax-platform-mock/)
cd repos/vaping-duty-poc/mocks/tax-platform-mock
npm install
npm start
```

## Deployment Location

These specs will be deployed to the project repository at:

```
repos/vaping-duty-poc/
└── mocks/
    └── specs/
        ├── excise-api.yaml
        ├── customer-api.yaml
        └── tax-platform-api.yaml
```

## Validation

```bash
# Validate all specs
redocly lint excise-api.yaml
redocly lint customer-api.yaml
redocly lint tax-platform-api.yaml
```
