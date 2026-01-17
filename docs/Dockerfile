FROM halverneus/static-file-server:latest

# Copy generated documentation to /web (root)
COPY docs /web

# Copy OpenAPI specs to /web/specs
COPY specs /web/specs

# Set environment variables
ENV FOLDER=/web
ENV PORT=8080
ENV SHOW_LISTING=true

EXPOSE 8080
