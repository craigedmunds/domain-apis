#!/bin/bash

# Documentation Generation Script
# Generates HTML documentation from OpenAPI specifications using Redocly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SPECS_DIR="$PROJECT_ROOT/specs"
DOCS_DIR="$PROJECT_ROOT/docs"

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

generate_api_docs() {
  local api_name=$1
  local spec_file=$2
  local output_dir=$3
  
  log "Generating documentation for $api_name API..."
  
  if [ ! -f "$spec_file" ]; then
    warn "Specification file not found: $spec_file"
    return 1
  fi
  
  mkdir -p "$output_dir"
  
  # Generate Redoc documentation
  npx @redocly/cli build-docs "$spec_file" -o "$output_dir/index.html"
  
  if [ $? -eq 0 ]; then
    success "$api_name API documentation generated: $output_dir/index.html"
    return 0
  else
    error "Failed to generate $api_name API documentation"
    return 1
  fi
}

main() {
  log "========================================"
  log "API Documentation Generator"
  log "========================================"
  echo ""
  
  # Check if specs directory exists
  if [ ! -d "$SPECS_DIR" ]; then
    error "Specs directory not found: $SPECS_DIR"
    exit 1
  fi
  
  # Create docs directory if it doesn't exist
  mkdir -p "$DOCS_DIR"
  
  # Generate documentation for each API
  local all_success=true
  
  generate_api_docs "Taxpayer" \
    "$SPECS_DIR/taxpayer/taxpayer-api.yaml" \
    "$DOCS_DIR/taxpayer" || all_success=false
  
  generate_api_docs "Income Tax" \
    "$SPECS_DIR/income-tax/income-tax-api.yaml" \
    "$DOCS_DIR/income-tax" || all_success=false
  
  generate_api_docs "Payment" \
    "$SPECS_DIR/payment/payment-api.yaml" \
    "$DOCS_DIR/payment" || all_success=false
  
  echo ""
  log "========================================"
  
  if [ "$all_success" = true ]; then
    success "All documentation generated successfully!"
    echo ""
    log "View documentation:"
    echo "  - Taxpayer API: file://$DOCS_DIR/taxpayer/index.html"
    echo "  - Income Tax API: file://$DOCS_DIR/income-tax/index.html"
    echo "  - Payment API: file://$DOCS_DIR/payment/index.html"
    log "========================================"
    exit 0
  else
    error "Some documentation generation failed"
    log "========================================"
    exit 1
  fi
}

main
