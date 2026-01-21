#!/bin/sh
set -e

# Default gateway host if not provided
GATEWAY_HOST="${GATEWAY_HOST:-domain-api.lab.local.ctoaas.co}"

echo "Updating OpenAPI specs with gateway host: ${GATEWAY_HOST}"

# Update server URLs in all OpenAPI specs (preserving descriptions)
for spec in /web/specs/*.yaml; do
  if [ -f "$spec" ]; then
    echo "Processing: $spec"
    # Update all server URLs to use the gateway host, preserving descriptions
    yq eval -i '.servers[] |= .url = "https://'${GATEWAY_HOST}'"' "$spec"
  fi
done

echo "Server URLs updated successfully"

# Start the static file server
exec /serve
