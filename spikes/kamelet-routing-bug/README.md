# Kamelet Routing Bug Spike

## Problem

When the same Kamelet is used by multiple routes, control can jump to the wrong route after the Kamelet completes. This occurs intermittently under rapid load.

## Test Files

### Simple Test (no HTTP)
- `shared-echo.kamelet.yaml` - Simple Kamelet that echoes a message
- `routes.yaml` - Two routes (A, B) sharing the Kamelet

### HTTP Test (closer to real use case)
- `shared-http.kamelet.yaml` - Kamelet that makes HTTP call
- `routes-http.yaml` - Two routes sharing the HTTP Kamelet

## Running Tests

### With JBang (suspected buggy)

```bash
# Terminal 1: Start Camel with simple test
camel run routes.yaml shared-echo.kamelet.yaml --dep=org.apache.camel:camel-groovy

# Terminal 2: Run tests
chmod +x test-routing.sh
./test-routing.sh http://localhost:8080 20

# For HTTP test:
# Terminal 1:
camel run routes-http.yaml shared-http.kamelet.yaml --dep=org.apache.camel:camel-groovy

# Terminal 2:
./test-routing.sh http://localhost:8080 20
```

### With Quarkus (to compare)

```bash
# Create Quarkus project
mvn io.quarkus:quarkus-maven-plugin:create \
  -DprojectGroupId=com.example \
  -DprojectArtifactId=kamelet-test \
  -Dextensions="camel-quarkus-rest,camel-quarkus-kamelet,camel-quarkus-groovy"

# Copy routes and kamelets to src/main/resources/camel/
# Run with: mvn quarkus:dev
# Test with: ./test-routing.sh http://localhost:8080 20
```

## Expected Results

- **PASS**: All responses have correct routeId (A returns ROUTE_A, B returns ROUTE_B)
- **FAIL**: Response has wrong routeId (A returns ROUTE_B or vice versa)

## Findings

| Runtime | Simple Test | HTTP Test | Notes |
|---------|-------------|-----------|-------|
| JBang 4.16.0 | PASS | **FAIL** | Bug reproduces with HTTP Kamelets |
| Quarkus | ? | ? | To be tested |

## Bug Evidence (JBang 4.16.0)

**Logs show route jumping:**
```
GET Route A: Starting for customer CUST001
Kamelet: Looking up customer CUST001
Kamelet: Customer response received
GET Route B: After Kamelet, routeMarker=GET_ROUTE_A   <-- BUG!
```

**Response confirms:**
```json
{"route":"B","routeMarker":"GET_ROUTE_A",...}
```
- `route: B` = Route B's code executed (hardcoded)
- `routeMarker: GET_ROUTE_A` = Exchange properties from Route A preserved

**Conclusion:** After the shared Kamelet completes, execution jumps to a DIFFERENT route's code while preserving the original exchange state.

## Root Cause Hypothesis

The bug appears to be in how JBang/Camel handles Kamelet route continuation. When multiple routes share a Kamelet:
1. Kamelet is instantiated once (shared instance)
2. After Kamelet completes, the "sink" route continuation is resolved incorrectly
3. Control flows to a different route's post-Kamelet code

**Why duplicate Kamelets work:** Each Kamelet has a unique route ID, so the sink continuation is unambiguous.
