#!/bin/bash
# Test for Kamelet routing bug
# Run with: ./test-routing.sh
# Expects camel-jbang to be running on port 8080

BASE_URL="${1:-http://localhost:8080}"
ROUNDS="${2:-10}"
FAILURES=0

echo "Testing Kamelet routing bug..."
echo "Base URL: $BASE_URL"
echo "Rounds: $ROUNDS"
echo ""

# Test 1: Single calls (should always work)
echo "=== Test 1: Single calls ==="
A_RESULT=$(curl -s "$BASE_URL/test/route-a")
B_RESULT=$(curl -s "$BASE_URL/test/route-b")
echo "Route A: $A_RESULT"
echo "Route B: $B_RESULT"

# Handle both escaped and unescaped JSON
if echo "$A_RESULT" | grep -qE 'routeId.*ROUTE_A'; then
    echo "Single A: PASS"
else
    echo "Single A: FAIL"
    ((FAILURES++))
fi

if echo "$B_RESULT" | grep -qE 'routeId.*ROUTE_B'; then
    echo "Single B: PASS"
else
    echo "Single B: FAIL"
    ((FAILURES++))
fi
echo ""

# Test 2: Rapid sequential calls
echo "=== Test 2: Rapid sequential calls ==="
for i in $(seq 1 $ROUNDS); do
    A_RESULT=$(curl -s "$BASE_URL/test/route-a")
    B_RESULT=$(curl -s "$BASE_URL/test/route-b")

    A_OK=true
    B_OK=true

    if ! echo "$A_RESULT" | grep -qE 'routeId.*ROUTE_A'; then
        A_OK=false
        ((FAILURES++))
    fi

    if ! echo "$B_RESULT" | grep -qE 'routeId.*ROUTE_B'; then
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

# Test 3: Parallel calls
echo "=== Test 3: Parallel calls ==="
for i in $(seq 1 $ROUNDS); do
    A_RESULT=$(curl -s "$BASE_URL/test/route-a" &)
    B_RESULT=$(curl -s "$BASE_URL/test/route-b" &)
    wait

    # Re-fetch since backgrounding loses output
    A_RESULT=$(curl -s "$BASE_URL/test/route-a")
    B_RESULT=$(curl -s "$BASE_URL/test/route-b")

    A_OK=true
    B_OK=true

    if ! echo "$A_RESULT" | grep -qE 'routeId.*ROUTE_A'; then
        A_OK=false
        ((FAILURES++))
    fi

    if ! echo "$B_RESULT" | grep -qE 'routeId.*ROUTE_B'; then
        B_OK=false
        ((FAILURES++))
    fi

    if [ "$A_OK" = true ] && [ "$B_OK" = true ]; then
        echo "Round $i: PASS"
    else
        echo "Round $i: FAIL"
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
