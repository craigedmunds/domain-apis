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

  # VPD Domain API (Producer - source of truth)
  generate_api_docs "VPD Domain API (Producer)" \
    "$SPECS_DIR/vaping-duty/domain/producer/vpd-submission-returns-api.yaml" \
    "$DOCS_DIR/vpd-domain-api" || all_success=false

  # VPD Platform API (enhanced for platform)
  generate_api_docs "VPD Platform API" \
    "$SPECS_DIR/vaping-duty/domain/platform/vpd-submission-returns-api.yaml" \
    "$DOCS_DIR/vpd-platform-api" || all_success=false

  # VPD Backend Mocks
  generate_api_docs "Excise Mock" \
    "$SPECS_DIR/vaping-duty/mocks/excise-api.yaml" \
    "$DOCS_DIR/excise-mock" || all_success=false

  generate_api_docs "Customer Mock" \
    "$SPECS_DIR/vaping-duty/mocks/customer-api.yaml" \
    "$DOCS_DIR/customer-mock" || all_success=false

  generate_api_docs "Tax Platform Mock" \
    "$SPECS_DIR/vaping-duty/mocks/tax-platform-api.yaml" \
    "$DOCS_DIR/tax-platform-mock" || all_success=false

  echo ""
  log "========================================"

  if [ "$all_success" = true ]; then
    success "All documentation generated successfully!"
    echo ""
    log "View documentation:"
    echo "  - VPD Domain API (Producer): file://$DOCS_DIR/vpd-domain-api/index.html"
    echo "  - VPD Platform API: file://$DOCS_DIR/vpd-platform-api/index.html"
    echo "  - Excise Mock: file://$DOCS_DIR/excise-mock/index.html"
    echo "  - Customer Mock: file://$DOCS_DIR/customer-mock/index.html"
    echo "  - Tax Platform Mock: file://$DOCS_DIR/tax-platform-mock/index.html"
    log "========================================"
    exit 0
  else
    error "Some documentation generation failed"
    log "========================================"
    exit 1
  fi
}

main
