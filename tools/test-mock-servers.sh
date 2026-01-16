#!/bin/bash

# Test script to verify mock servers can be generated from OpenAPI specs
# This script tests each API mock server individually

set -e

echo "============================================================"
echo "Mock Server Generation Test"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test function
test_mock_server() {
    local api_name=$1
    local spec_path=$2
    local port=$3
    
    echo "Testing ${api_name} mock server..."
    
    # Start mock server in background
    npx prism mock "${spec_path}" -p "${port}" > /dev/null 2>&1 &
    local pid=$!
    
    # Wait for server to start
    sleep 2
    
    # Check if process is still running
    if ps -p $pid > /dev/null; then
        echo -e "${GREEN}✓${NC} ${api_name} mock server started successfully on port ${port}"
        # Kill the server
        kill $pid 2>/dev/null || true
        wait $pid 2>/dev/null || true
        return 0
    else
        echo -e "${RED}✗${NC} ${api_name} mock server failed to start"
        return 1
    fi
}

# Test each API
echo "1. Testing Taxpayer API mock server..."
test_mock_server "Taxpayer API" "specs/taxpayer/taxpayer-api.yaml" 8081
echo ""

echo "2. Testing Income Tax API mock server..."
test_mock_server "Income Tax API" "specs/income-tax/income-tax-api.yaml" 8082
echo ""

echo "3. Testing Payment API mock server..."
test_mock_server "Payment API" "specs/payment/payment-api.yaml" 8083
echo ""

echo "============================================================"
echo -e "${GREEN}✓${NC} All mock servers can be generated successfully"
echo "============================================================"
echo ""
echo "To start all mock servers, run: npm run mock"
echo "Individual servers:"
echo "  - Taxpayer API:   npm run mock:taxpayer   (port 8081)"
echo "  - Income Tax API: npm run mock:income-tax (port 8082)"
echo "  - Payment API:    npm run mock:payment    (port 8083)"
