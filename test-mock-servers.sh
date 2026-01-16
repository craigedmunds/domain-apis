#!/bin/bash

# Test script for mock servers
# Tests that all three mock servers are running and returning valid responses

set -e

echo "=== Testing Mock Servers ==="
echo ""

# Test Taxpayer API on port 8081
echo "1. Testing Taxpayer API (port 8081)..."
TAXPAYER_RESPONSE=$(curl -s http://127.0.0.1:8081/taxpayers/TP123456)
if echo "$TAXPAYER_RESPONSE" | jq -e '.id == "TP123456" and .type == "taxpayer"' > /dev/null; then
    echo "   ✓ Taxpayer API is working correctly"
else
    echo "   ✗ Taxpayer API failed"
    exit 1
fi

# Test Income Tax API on port 8082
echo "2. Testing Income Tax API (port 8082)..."
TAX_RETURN_RESPONSE=$(curl -s http://127.0.0.1:8082/tax-returns/TR20230001)
if echo "$TAX_RETURN_RESPONSE" | jq -e '.id == "TR20230001" and .type == "tax-return"' > /dev/null; then
    echo "   ✓ Income Tax API is working correctly"
else
    echo "   ✗ Income Tax API failed"
    exit 1
fi

# Test Payment API on port 8083
echo "3. Testing Payment API (port 8083)..."
PAYMENT_RESPONSE=$(curl -s http://127.0.0.1:8083/payments/PM20230001)
if echo "$PAYMENT_RESPONSE" | jq -e '.id == "PM20230001" and .type == "payment"' > /dev/null; then
    echo "   ✓ Payment API is working correctly"
else
    echo "   ✗ Payment API failed"
    exit 1
fi

# Test cross-API links
echo "4. Testing cross-API relationship links..."
TAXPAYER_LINKS=$(echo "$TAXPAYER_RESPONSE" | jq -r '._links.taxReturns.href')
if [[ "$TAXPAYER_LINKS" == *"income-tax"* ]]; then
    echo "   ✓ Cross-API links are present"
else
    echo "   ✗ Cross-API links missing"
    exit 1
fi

# Test collection endpoints
echo "5. Testing collection endpoints..."
TAXPAYERS_COLLECTION=$(curl -s http://127.0.0.1:8081/taxpayers)
if echo "$TAXPAYERS_COLLECTION" | jq -e '.items | length > 0' > /dev/null; then
    echo "   ✓ Collection endpoints working"
else
    echo "   ✗ Collection endpoints failed"
    exit 1
fi

echo ""
echo "=== All Mock Server Tests Passed! ==="
echo ""
echo "Mock servers are running on:"
echo "  - Taxpayer API:    http://127.0.0.1:8081"
echo "  - Income Tax API:  http://127.0.0.1:8082"
echo "  - Payment API:     http://127.0.0.1:8083"
