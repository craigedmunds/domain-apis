# Mock Server Setup and Usage

## Overview

This project uses [Prism](https://stoplight.io/open-source/prism) to generate mock servers from OpenAPI specifications. Mock servers allow you to test API designs before implementing the actual backend services.

## Available Mock Servers

Three mock servers are configured, one for each domain API:

| API | Port | Base URL | Task Command |
|-----|------|----------|--------------|
| Taxpayer API | 8081 | http://127.0.0.1:8081 | `task mock:taxpayer` |
| Income Tax API | 8082 | http://127.0.0.1:8082 | `task mock:income-tax` |
| Payment API | 8083 | http://127.0.0.1:8083 | `task mock:payment` |

## Starting Mock Servers

### Start All Servers Concurrently

```bash
task mock
```

This starts all three mock servers in parallel using `concurrently`.

### Start Individual Servers

```bash
# Taxpayer API only
task mock:taxpayer

# Income Tax API only
task mock:income-tax

# Payment API only
task mock:payment
```

## Testing Mock Servers

### Automated Test Script

Run the comprehensive test script to verify all mock servers are working:

```bash
./test-mock-servers.sh
```

This script tests:
- ✓ Each API returns valid responses
- ✓ Resource schemas match specifications
- ✓ Cross-API relationship links are present
- ✓ Collection endpoints work correctly

### Manual Testing

#### Taxpayer API Examples

```bash
# Get a specific taxpayer
curl http://127.0.0.1:8081/taxpayers/TP123456 | jq '.'

# List all taxpayers
curl http://127.0.0.1:8081/taxpayers | jq '.'

# Create a new taxpayer (POST)
curl -X POST http://127.0.0.1:8081/taxpayers \
  -H "Content-Type: application/json" \
  -d '{
    "nino": "AB123456C",
    "name": {
      "firstName": "Jane",
      "lastName": "Doe"
    }
  }' | jq '.'
```

#### Income Tax API Examples

```bash
# Get a specific tax return
curl http://127.0.0.1:8082/tax-returns/TR20230001 | jq '.'

# List all tax returns
curl http://127.0.0.1:8082/tax-returns | jq '.'

# Get assessments for a tax return
curl http://127.0.0.1:8082/tax-returns/TR20230001/assessments | jq '.'
```

#### Payment API Examples

```bash
# Get a specific payment
curl http://127.0.0.1:8083/payments/PM20230001 | jq '.'

# List all payments
curl http://127.0.0.1:8083/payments | jq '.'

# Get allocations for a payment
curl http://127.0.0.1:8083/payments/PM20230001/allocations | jq '.'
```

## Mock Server Features

### Dynamic Response Generation

Prism automatically generates responses based on:
- **Examples**: Uses examples defined in OpenAPI specs
- **Schemas**: Generates data matching schema definitions
- **Validation**: Validates requests against OpenAPI specs

### Request Validation

Mock servers validate:
- ✓ Request path parameters
- ✓ Query parameters
- ✓ Request body schemas
- ✓ Content-Type headers
- ✓ Required fields

Invalid requests return appropriate error responses.

### Cross-API Relationships

Mock responses include relationship links to other APIs:

```json
{
  "id": "TP123456",
  "type": "taxpayer",
  "_links": {
    "self": "http://localhost:8080/taxpayer/v1/taxpayers/TP123456",
    "taxReturns": {
      "href": "http://localhost:8080/income-tax/v1/tax-returns?taxpayerId=TP123456",
      "type": "collection",
      "title": "Tax returns for this taxpayer"
    },
    "payments": {
      "href": "http://localhost:8080/payment/v1/payments?taxpayerId=TP123456",
      "type": "collection",
      "title": "Payments made by this taxpayer"
    }
  }
}
```

## Configuration

### Port Configuration

Ports are configured in `Taskfile.yaml`:

```yaml
mock:taxpayer:
  desc: Start Taxpayer API mock server on port 8081
  cmds:
    - npx prism mock specs/taxpayer/taxpayer-api.yaml -p 8081
```

To change ports, update the `-p` flag in the Taskfile.

### Prism Options

Common Prism options you can add to tasks:

```bash
# Enable dynamic response generation
npx prism mock spec.yaml -p 8081 --dynamic

# Enable CORS
npx prism mock spec.yaml -p 8081 --cors

# Validate requests strictly
npx prism mock spec.yaml -p 8081 --errors

# Use specific host
npx prism mock spec.yaml -p 8081 --host 0.0.0.0
```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```bash
# Find process using the port
lsof -i :8081

# Kill the process
kill -9 <PID>

# Or use a different port
npx prism mock specs/taxpayer/taxpayer-api.yaml -p 8091
```

### Mock Server Not Responding

1. **Check if server is running**:
   ```bash
   curl http://127.0.0.1:8081/taxpayers
   ```

2. **Check Prism logs** for validation errors

3. **Verify OpenAPI spec is valid**:
   ```bash
   task validate:taxpayer
   ```

### Invalid Responses

If mock responses don't match expectations:

1. **Check OpenAPI examples** in spec files
2. **Verify schema definitions** are correct
3. **Update examples** in OpenAPI specs
4. **Restart mock servers** to pick up changes

## Development Workflow

### Typical Workflow

1. **Update OpenAPI specification**
   ```bash
   # Edit specs/taxpayer/taxpayer-api.yaml
   ```

2. **Validate changes**
   ```bash
   task validate:taxpayer
   ```

3. **Restart mock server**
   ```bash
   # Stop existing server (Ctrl+C)
   task mock:taxpayer
   ```

4. **Test changes**
   ```bash
   curl http://127.0.0.1:8081/taxpayers/TP123456 | jq '.'
   ```

### Integration with Development

Mock servers are useful for:
- **Frontend development**: Test UI without backend
- **API design validation**: Verify API contracts
- **Documentation**: Generate interactive examples
- **Contract testing**: Validate client implementations

## Next Steps

After validating mock servers:

1. **Generate documentation**: `task docs`
2. **Set up Swagger UI**: `task swagger`
3. **Implement real servers**: See `docs/getting-started.md`
4. **Write integration tests**: Test cross-API traversal

## References

- [Prism Documentation](https://docs.stoplight.io/docs/prism)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0)
- [Project Getting Started Guide](./getting-started.md)
