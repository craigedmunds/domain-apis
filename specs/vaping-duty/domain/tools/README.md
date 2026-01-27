# Platform OAS Generation Tools

Tools for generating platform-enhanced OpenAPI specifications from producer OAS.

## Overview

The platform OAS generator transforms producer-defined API specifications into platform-enhanced versions by:

1. **Preserving fragment references** - Keeps `$ref` to centrally-versioned fragments (NOT inlined)
2. **Injecting sparse fieldsets** - Adds `fields[:resource]=field1,field2` parameter to GET operations
3. **Adding platform metadata** - Documents platform features and capabilities

## Architecture

```
Producer OAS (domain/producer/)
  ↓
  Uses $ref to common fragments (domain/fragments/)
  ↓
Platform OAS Generator (this tool)
  ↓
  1. Preserve $ref to fragments (centrally versioned)
  2. Inject sparse fieldsets
  3. Add platform metadata
  ↓
Platform OAS (domain/platform/)
  ↓
  Used for API portal documentation and Prism mock servers
  (Still references fragments via $ref)
```

## Usage

### Basic Usage

```bash
cd domain/tools
python generate_platform_oas.py ../producer/vpd-submission-returns-api.yaml
```

**Output:** `domain/platform/vpd-submission-returns-api.yaml`

### With Virtual Environment

```bash
# Create venv
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install pyyaml

# Run generator
python generate_platform_oas.py ../producer/vpd-submission-returns-api.yaml
```

## What the Generator Does

### 1. Preserves Fragment References

**Producer OAS:**
```yaml
responses:
  '400':
    $ref: '../fragments/responses/v1/oas.yaml#/BadRequest'
```

**Platform OAS (generated):**
```yaml
responses:
  '400':
    $ref: '../fragments/responses/v1/oas.yaml#/BadRequest'  # Preserved - fragments are centrally versioned
```

**Why preserve $ref?**
- Fragments are centrally versioned and controlled (e.g., `headers/v1/`, `headers/v2/`)
- Changes to fragments propagate to all APIs using that version
- Avoids duplication and version drift
- APIs can migrate to new fragment versions independently
- API portal can resolve refs at runtime

### 2. Injects Sparse Fieldsets

For every GET operation, adds a `fields` parameter:

```yaml
parameters:
  - name: fields
    in: query
    description: |
      Platform-provided sparse fieldsets. Request specific fields from the response.

      Format: fields[:submission]=field1,field2,field3

      Available fields: acknowledgementReference, vpdApprovalNumber, periodKey, ...
    schema:
      type: string
      pattern: '^fields\[:submission\]=([\w]+,?)+$'
    examples:
      singleField:
        value: "fields[:submission]=acknowledgementReference"
      multipleFields:
        value: "fields[:submission]=acknowledgementReference,totalDutyDue,vat"
```

The generator:
- Extracts field names from the response schema
- Lists all available fields in the description
- Provides realistic examples

### 3. Adds Platform Metadata

```yaml
info:
  x-platform-generated: true
  x-platform-features:
    sparseFieldsets: true
    rateLimiting: true
    correlationId: true
    etags: true
```

## Directory Structure

```
domain/
├── fragments/                             # Centrally-versioned fragments
│   ├── headers/v1/oas.yaml                # Common headers (v1)
│   ├── schemas/v1/oas.yaml                # Common schemas (v1)
│   ├── responses/v1/oas.yaml              # Common responses (v1)
│   └── parameters/v1/oas.yaml             # Common parameters (v1)
├── producer/
│   └── vpd-submission-returns-api.yaml    # Source (maintained by producers)
├── platform/
│   └── vpd-submission-returns-api.yaml    # Generated (published to API portal)
└── tools/
    ├── generate_platform_oas.py           # Generator script
    └── README.md                          # This file
```

## Requirements

- Python 3.7+
- PyYAML (`pip install pyyaml`)

## Producer Workflow

1. **Create/update producer OAS** in `domain/producer/`
   - Use `$ref` to platform common fragments
   - Focus on domain logic only
   - No need to mention sparse fieldsets

2. **Generate platform OAS**
   ```bash
   cd domain/tools
   python generate_platform_oas.py ../producer/vpd-submission-returns-api.yaml
   ```

3. **Validate platform OAS**
   ```bash
   cd ../platform/generated
   redocly lint vpd-submission-returns-api.yaml
   ```

4. **Publish platform OAS** to API portal
   - Platform OAS is the consumer-facing specification
   - Shows all platform features and available fields

## Benefits

### For Producers
- Write clean, domain-focused OAS
- Platform features added automatically
- No duplication of common elements

### For Consumers
- Complete documentation including platform features
- All available fields enumerated
- Realistic examples for sparse fieldsets

### For Platform
- Single source of truth for common elements
- Consistent feature injection across all APIs
- Easy to add new platform features

## Troubleshooting

### FileNotFoundError: Referenced file not found

Check that relative paths in `$ref` are correct:
```yaml
# ✅ Correct (relative to producer OAS location)
$ref: '../fragments/headers.yaml#/X-Correlation-Id-Response'

# ❌ Wrong
$ref: './fragments/headers.yaml#/X-Correlation-Id-Response'
```

### Missing fields in sparse fieldsets

Generator extracts fields from the response schema. Ensure:
1. GET operation has a 200 response
2. Response has `application/json` content type
3. Content has a `schema` with `properties`

### Invalid YAML in generated output

Check that all `$ref` targets are valid YAML and resolve correctly.


## Mock Server Tools

Tools for running Prism mock servers with realistic network latency simulation for testing.

### Starting a Mock Server

```bash
cd domain/tools
./prism-mock-server.sh ../platform/vpd-submission-returns-api.yaml 4010
```

Default configuration:
- **Port**: 4010 (or specify as second argument)
- **Delays**: 0-500ms random per request
- **Distribution**: Uniform random

### Making Mock Requests with Delays

The mock client wrapper automatically injects random delays:

```bash
# GET request with random delay
./mock-client.sh http://localhost:4010/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-27-000123

# POST request with random delay
./mock-client.sh http://localhost:4010/duty/vpd/submission-returns/v1 \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-123" \
  -d @examples/submission-request.json
```

The client generates a random delay (0-500ms by default) and injects it as `Prefer: wait=<ms>` header to Prism.

### Manual Delay Control

Use curl directly with specific delays:

```bash
# Fixed 250ms delay
curl -H "Prefer: wait=250" http://localhost:4010/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-123

# No delay
curl http://localhost:4010/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-123
```

### Configuring Delays

Edit the mock-client.sh script to change delay ranges:

```bash
MIN_DELAY=100    # Change from 0
MAX_DELAY=2000   # Change from 500
```

### Requirements

- **Prism CLI**: `npm install -g @stoplight/prism-cli`

