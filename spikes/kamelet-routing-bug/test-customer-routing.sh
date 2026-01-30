#!/bin/bash
# Test for Kamelet routing bug with real HTTP backend calls

BASE_URL="${1:-http://localhost:8091}"
ROUNDS="${2:-20}"
CUSTOMER_ID="${3:-CUST001}"
FAILURES=0

echo "Testing Kamelet routing bug with HTTP backend..."
echo "Base URL: $BASE_URL"
echo "Rounds: $ROUNDS"
echo "Customer ID: $CUSTOMER_ID"
echo ""

# Test 1: Single calls
echo "=== Test 1: Single calls ==="
A_RESULT=$(curl -s "$BASE_URL/test/get-a/$CUSTOMER_ID")
B_RESULT=$(curl -s "$BASE_URL/test/get-b/$CUSTOMER_ID")
echo "Route A: $A_RESULT"
echo "Route B: $B_RESULT"

if echo "$A_RESULT" | grep -qE 'routeMarker.*GET_ROUTE_A'; then
    echo "Single A: PASS"
else
    echo "Single A: FAIL"
    ((FAILURES++))
fi

if echo "$B_RESULT" | grep -qE 'routeMarker.*GET_ROUTE_B'; then
    echo "Single B: PASS"
else
    echo "Single B: FAIL"
    ((FAILURES++))
fi
echo ""

# Test 2: Rapid sequential calls
echo "=== Test 2: Rapid sequential calls ==="
for i in $(seq 1 $ROUNDS); do
    A_RESULT=$(curl -s "$BASE_URL/test/get-a/$CUSTOMER_ID")
    B_RESULT=$(curl -s "$BASE_URL/test/get-b/$CUSTOMER_ID")

    A_OK=true
    B_OK=true

    if ! echo "$A_RESULT" | grep -qE 'routeMarker.*GET_ROUTE_A'; then
        A_OK=false
        ((FAILURES++))
    fi

    if ! echo "$B_RESULT" | grep -qE 'routeMarker.*GET_ROUTE_B'; then
        B_OK=false
        ((FAILURES++))
    fi

    if [ "$A_OK" = true ] && [ "$B_OK" = true ]; then
        echo "Round $i: PASS"
    else
        echo "Round $i: FAIL (A=$A_OK, B=$B_OK)"
        echo "  A: $A_RESULT"
        echo "  B: $B_RESULT"
    fi
done
echo ""

# Test 3: Concurrent calls with xargs
echo "=== Test 3: Concurrent calls (10 parallel) ==="
for i in $(seq 1 $ROUNDS); do
    # Run 10 concurrent requests to each route
    A_RESULTS=$(seq 1 10 | xargs -P10 -I{} curl -s "$BASE_URL/test/get-a/$CUSTOMER_ID")
    B_RESULTS=$(seq 1 10 | xargs -P10 -I{} curl -s "$BASE_URL/test/get-b/$CUSTOMER_ID")

    A_FAILS=$(echo "$A_RESULTS" | grep -vcE 'routeMarker.*GET_ROUTE_A' || true)
    B_FAILS=$(echo "$B_RESULTS" | grep -vcE 'routeMarker.*GET_ROUTE_B' || true)

    if [ "$A_FAILS" -eq 0 ] && [ "$B_FAILS" -eq 0 ]; then
        echo "Round $i: PASS (10 concurrent each)"
    else
        echo "Round $i: FAIL (A failures: $A_FAILS, B failures: $B_FAILS)"
        ((FAILURES += A_FAILS + B_FAILS))
    fi
done
echo ""

echo "=== Summary ==="
echo "Total failures: $FAILURES"
if [ $FAILURES -eq 0 ]; then
    echo "All tests PASSED"
    exit 0
else
    echo "Some tests FAILED"
    exit 1
fi
