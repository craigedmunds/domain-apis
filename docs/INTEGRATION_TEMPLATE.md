# Domain API Integration Template

This document describes the template structure for creating new Domain API integrations using Camel YAML DSL with reusable direct routes.

## Directory Structure

```
specs/{domain}/domain/platform/
├── routes/
│   ├── rest-config.yaml      # REST endpoints → direct routes
│   ├── get-{resource}.yaml   # One file per GET variant
│   ├── post-{resource}.yaml  # POST route
│   └── common.yaml           # Shared subroutes (headers, parsers, response assembly)
├── lib/                      # Optional: standalone Groovy classes
│   └── SparseFieldsets.groovy
└── tests/
    └── integration/          # Per-route integration tests
```

## Route Pattern

Each route should follow this pattern:

```yaml
- route:
    id: {routeName}
    from:
      uri: direct:{routeName}
      steps:
        # 1. Prepare HTTP call using shared subroute
        - to: direct:prepareGetRequest  # or prepareXmlGetRequest, preparePostRequest

        # 2. Make the HTTP call
        - toD:
            uri: "http://{service}-proxy:4010/{path}?bridgeEndpoint=true&throwExceptionOnFailure=false"

        # 3. Parse/transform response if needed
        - to: direct:parseExciseRegistrationXml  # for XML responses

        # 4. Store response for later use
        - setProperty:
            name: {service}Response
            simple: "${body}"

        # Repeat for other backend calls...

        # 5. Assemble final response
        - to: direct:assembleGetResponse

        # 6. Apply sparse fieldsets if requested
        - to: direct:applySparseFieldsets

        # 7. Inject response headers
        - to: direct:injectResponseHeaders
```

## Common Subroutes (in common.yaml)

### HTTP Preparation Subroutes

| Subroute | Purpose |
|----------|---------|
| `direct:prepareGetRequest` | Prepare GET with JSON Accept |
| `direct:prepareXmlGetRequest` | Prepare GET with XML Accept |
| `direct:preparePostRequest` | Prepare POST with JSON |
| `direct:preparePostXmlRequest` | Prepare POST expecting XML response |

Each sets:
- `CamelHttpMethod`
- `Accept` header
- `Content-Type` header (for POST)
- `X-Correlation-Id` header
- `X-Idempotency-Key` header (for POST)

### XML Transformation Subroutes

| Subroute | Purpose |
|----------|---------|
| `direct:parseExciseRegistrationXml` | Parse registration XML, set `customerId` property |
| `direct:parseExcisePeriodXml` | Parse period XML |
| `direct:parseExciseValidationXml` | Parse validation XML, set `validationValid` property |

### Response Subroutes

| Subroute | Purpose |
|----------|---------|
| `direct:assembleGetResponse` | Combine backend responses into unified response |
| `direct:applySparseFieldsets` | Filter fields if `fieldsParam` is set |
| `direct:injectResponseHeaders` | Set Content-Type and X-Correlation-Id |
| `direct:extractStandardHeaders` | Extract correlation ID and idempotency key |

## Creating a New Integration

1. **Define OAS specs** for backend services in `mocks/`
2. **Add XML parser subroutes** (if backend returns XML)
3. **Create route files** for each operation (GET, POST, etc.)
4. **Add response assembly** in common.yaml or inline
5. **Update rest-config.yaml** to add new endpoints
6. **Write acceptance tests** in `tests/acceptance/`

## Example: Adding XML Parser Subroute

```yaml
# In common.yaml
- route:
    id: parseNewServiceXml
    from:
      uri: direct:parseNewServiceXml
      steps:
        - setProperty:
            name: newServiceXml
            simple: "${body}"
        - setBody:
            groovy: |
              import groovy.xml.XmlSlurper
              import groovy.json.JsonOutput

              def xmlText = exchange.getProperty('newServiceXml', String)
              def xml = new XmlSlurper().parseText(xmlText)

              // Extract key field for subsequent calls
              def resourceId = xml.resourceId.text()
              exchange.setProperty('resourceId', resourceId)

              def parsed = [
                resourceId: resourceId,
                status: xml.status.text(),
                // ... other fields
              ]

              return JsonOutput.toJson(parsed)
        - setProperty:
            name: newServiceResponse
            simple: "${body}"
```

## Benefits of This Pattern

1. **Routes are concise** - Focus on orchestration, not HTTP mechanics
2. **Consistent patterns** - All routes use same subroutes
3. **DRY** - Header setup, XML parsing, response assembly reused
4. **Testable** - Subroutes can be tested independently
5. **Maintainable** - Changes to patterns in one place

## Comparison: Before vs After

### Before (inline everything)
```yaml
- removeHeaders:
    pattern: "CamelHttp*"
- setHeader:
    name: CamelHttpMethod
    constant: "GET"
- setHeader:
    name: Accept
    constant: "application/xml"
- setHeader:
    name: X-Correlation-Id
    simple: "${exchangeProperty.correlationId}"
- toD:
    uri: "http://excise-proxy:4010/..."
- setProperty:
    name: exciseXml
    simple: "${body}"
- setBody:
    groovy: |
      // 30 lines of XML parsing...
```

### After (using subroutes)
```yaml
- to: direct:prepareXmlGetRequest
- toD:
    uri: "http://excise-proxy:4010/..."
- to: direct:parseExciseRegistrationXml
```

**Result:** Routes reduced from ~220 lines to ~75 lines each.
