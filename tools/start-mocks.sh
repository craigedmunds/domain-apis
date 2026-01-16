#!/bin/bash

# Mock Server Startup Script
# Starts Prism mock servers for all three APIs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SPECS_DIR="$PROJECT_ROOT/specs"

COLORS_RED='\033[0;31m'
COLORS_GREEN='\033[0;32m'
COLORS_BLUE='\033[0;34m'
COLORS_YELLOW='\033[1;33m'
COLORS_NC='\033[0m' # No Color

log() {
  echo -e "${COLORS_BLUE}$1${COLORS_NC}"
}

success() {
  echo -e "${COLORS_GREEN}✓ $1${COLORS_NC}"
}

error() {
  echo -e "${COLORS_RED}✗ $1${COLORS_NC}"
}

warn() {
  echo -e "${COLORS_YELLOW}⚠ $1${COLORS_NC}"
}

check_port() {
  local port=$1
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

cleanup() {
  log "Shutting down mock servers..."
  jobs -p | xargs -r kill 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

main() {
  log "========================================"
  log "Starting Mock API Servers"
  log "========================================"
  echo ""
  
  # Check if specs exist
  if [ ! -d "$SPECS_DIR" ]; then
    error "Specs directory not found: $SPECS_DIR"
    exit 1
  fi
  
  # Check if ports are available
  if check_port 8081; then
    warn "Port 8081 is already in use (Taxpayer API)"
  fi
  
  if check_port 8082; then
    warn "Port 8082 is already in use (Income Tax API)"
  fi
  
  if check_port 8083; then
    warn "Port 8083 is already in use (Payment API)"
  fi
  
  # Start mock servers
  log "Starting Taxpayer API mock server on port 8081..."
  npx @stoplight/prism-cli mock "$SPECS_DIR/taxpayer/taxpayer-api.yaml" -p 8081 &
  TAXPAYER_PID=$!
  
  log "Starting Income Tax API mock server on port 8082..."
  npx @stoplight/prism-cli mock "$SPECS_DIR/income-tax/income-tax-api.yaml" -p 8082 &
  INCOME_TAX_PID=$!
  
  log "Starting Payment API mock server on port 8083..."
  npx @stoplight/prism-cli mock "$SPECS_DIR/payment/payment-api.yaml" -p 8083 &
  PAYMENT_PID=$!
  
  # Wait a moment for servers to start
  sleep 2
  
  echo ""
  log "========================================"
  success "Mock servers started successfully!"
  echo ""
  log "API Endpoints:"
  echo "  - Taxpayer API:   http://localhost:8081"
  echo "  - Income Tax API: http://localhost:8082"
  echo "  - Payment API:    http://localhost:8083"
  echo ""
  log "Press Ctrl+C to stop all servers"
  log "========================================"
  
  # Wait for all background jobs
  wait
}

main
