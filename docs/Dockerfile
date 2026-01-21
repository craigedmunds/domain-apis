FROM halverneus/static-file-server:latest

# Install yq for YAML processing
RUN apk add --no-cache yq

# Copy generated documentation to /web (root)
COPY docs /web

# Copy OpenAPI specs to /web/specs
COPY specs /web/specs

# Copy entrypoint script
COPY docs/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set environment variables
ENV FOLDER=/web
ENV PORT=8080
ENV SHOW_LISTING=true
ENV GATEWAY_HOST=domain-api.lab.local.ctoaas.co

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
