# VPD Domain API Testing Guide

## Overview

This guide covers testing the VPD Submission Returns Domain API, including:
- Running the stack with docker-compose
- Testing pass-through functionality
- Fault injection for resilience testing
- Observability with LGTM stack

## Quick Start

### Starting the Stack

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View domain-api logs
docker-compose logs -f domain-api
```

### Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| domain-api | 8081 | VPD Domain API (Camel YAML DSL) |
| tax-platform-proxy | 4012 | Tax Platform mock via Envoy |
| customer-proxy | 4011 | Customer mock via Envoy |
| excise-proxy | 4010 | Excise mock (XML) via Envoy |
| Grafana | 3000 | Observability UI (Loki, Tempo, Mimir) |
| docs | 8080 | API documentation and explorer |

## Testing the Domain API

### Health Check

```bash
curl http://localhost:8081/health
# {"status": "UP"}
```

### GET Submission by Acknowledgement Reference

```bash
# Basic request
curl "http://localhost:8081/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123"

# With correlation ID for tracing
curl -H "X-Correlation-Id: my-trace-123" \
  "http://localhost:8081/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123"
```

## Fault Injection

Fault injection allows testing resilience and error handling by injecting delays and errors into backend calls. This is implemented using **Envoy's header-controlled fault injection**.

### Architecture

```
Client → Domain API → Envoy Proxy → Backend Mock
              ↓
        Pass-through fault headers
              ↓
        Envoy applies fault before forwarding to mock
```

**Key Design Decision**: Fault injection is controlled via HTTP headers passed through the Domain API to Envoy proxies. This approach:
- Keeps the Domain API simple (no fault logic in Camel routes)
- Allows per-request fault control for targeted testing
- Uses Envoy's battle-tested fault injection filter
- Works with any backend mock technology (Prism, WireMock, etc.)

### Fault Injection Headers

| Header | Description | Example |
|--------|-------------|---------|
| `x-envoy-fault-delay-request` | Delay in milliseconds | `500` |
| `x-envoy-fault-abort-request` | HTTP status code to return | `503` |

### Testing Delay Injection

```bash
# Normal request (baseline)
time curl -s "http://localhost:8081/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123" > /dev/null
# real    0m0.145s

# With 500ms delay
time curl -s -H "x-envoy-fault-delay-request: 500" \
  "http://localhost:8081/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123" > /dev/null
# real    0m0.530s

# With 2000ms delay (test timeout handling)
time curl -s -H "x-envoy-fault-delay-request: 2000" \
  "http://localhost:8081/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123" > /dev/null
```

### Testing Error Injection

```bash
# Inject 503 Service Unavailable
curl -H "x-envoy-fault-abort-request: 503" \
  "http://localhost:8081/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123"
# HTTP/1.1 503 Service Unavailable

# Inject 500 Internal Server Error
curl -H "x-envoy-fault-abort-request: 500" \
  "http://localhost:8081/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123"
```

### Combining Delay and Error

```bash
# 50% of requests fail with 503 after 200ms delay
# (Make multiple requests to see different outcomes)
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "x-envoy-fault-delay-request: 200" \
    "http://localhost:8081/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123"
done
```

### Direct Envoy Testing

You can also test fault injection directly against Envoy proxies (bypassing the Domain API):

```bash
# Direct to tax-platform proxy with delay
curl -H "x-envoy-fault-delay-request: 500" \
  http://localhost:4012/submissions/vpd/ACK-2026-01-26-000123

# Direct to excise proxy with error
curl -H "x-envoy-fault-abort-request: 503" \
  http://localhost:4010/excise/vpd/registrations/VPD123456
```

## Observability

### Viewing Traces in Grafana

1. Open Grafana: http://localhost:3000
2. Go to **Explore**
3. Select **Tempo** datasource
4. Search by service name or trace ID

### Viewing Logs in Loki

1. Open Grafana: http://localhost:3000
2. Go to **Explore**
3. Select **Loki** datasource
4. Query examples:
   - `{service="tax-platform-proxy"}` - Tax platform proxy logs
   - `{job="envoy"}` - All Envoy proxy logs

### Correlation ID Tracing

Requests include `X-Correlation-Id` header for end-to-end tracing:

```bash
curl -H "X-Correlation-Id: my-trace-456" \
  "http://localhost:8081/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123"
```

Find related logs in Loki:
```
{service="tax-platform-proxy"} |= "my-trace-456"
```

## Load Testing with k6

```bash
# Run k6 load tests
docker-compose run k6 run /tests/smoke-test-mocks.js

# Or with custom script
docker-compose run k6 run /tests/vpd-load-test.js
```

## Troubleshooting

### Domain API Not Starting

```bash
# Check logs
docker-compose logs domain-api

# Verify health endpoint
curl http://localhost:8081/health
```

### Envoy Proxy Issues

```bash
# Check Envoy admin stats
curl http://localhost:9901/stats

# Check Envoy config
curl http://localhost:9901/config_dump
```

### Mock Server Issues

```bash
# Test tax-platform mock directly (internal port via proxy)
curl http://localhost:4012/submissions/vpd/ACK-2026-01-26-000123

# Test excise mock directly (WireMock)
curl http://localhost:4010/excise/vpd/registrations/VPD123456
```

## Reference

- [Envoy Fault Injection Filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/fault_filter)
- [Apache Camel YAML DSL](https://camel.apache.org/manual/yaml-dsl.html)
- [VPD Domain API Specification](/specs/vaping-duty/domain/platform/vpd-submission-returns-api.yaml)
