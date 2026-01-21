#!/bin/bash
set -e

# Update server URLs in OpenAPI specs for Kubernetes deployment
# This script adds server URLs pointing to the ingress endpoints

DOMAIN_SUFFIX="${DOMAIN_SUFFIX:-lab.local.ctoaas.co}"

# Function to add servers section to an OpenAPI spec
add_servers() {
  local spec_file=$1
  local server_url=$2
  local description=$3
  
  # Use yq to add servers section if it doesn't exist
  # If servers already exist, prepend the new server
  yq eval -i "
    .servers = [
      {\"url\": \"${server_url}\", \"description\": \"${description}\"}
    ] + (.servers // [])
  " "$spec_file"
}

# Update taxpayer API spec
add_servers \
  "/web/specs/taxpayer-api.yaml" \
  "https://domain-api-taxpayer.${DOMAIN_SUFFIX}" \
  "Kubernetes deployment - Direct API access"

# Update income tax API spec
add_servers \
  "/web/specs/income-tax-api.yaml" \
  "https://domain-api-income-tax.${DOMAIN_SUFFIX}" \
  "Kubernetes deployment - Direct API access"

# Update payment API spec
add_servers \
  "/web/specs/payment-api.yaml" \
  "https://domain-api-payment.${DOMAIN_SUFFIX}" \
  "Kubernetes deployment - Direct API access"

echo "Server URLs updated successfully"
