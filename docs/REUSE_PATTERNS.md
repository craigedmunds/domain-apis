# Reuse Patterns for Domain API Routes

This document describes when to use different approaches for implementing reusable logic in Camel YAML DSL routes.

## Pattern Comparison

| Approach | Best For | Example | Testability |
|----------|----------|---------|-------------|
| **YAML Direct Routes** | HTTP setup, header manipulation, simple flows | prepareGetRequest, injectResponseHeaders | Integration tests |
| **Inline Groovy** | JSON/XML transformations, data extraction | parseExciseRegistrationXml | Part of route tests |
| **Groovy Class (lib/)** | Complex reusable logic, unit testing needed | SparseFieldsets | Standalone unit tests |

## When to Use Each Approach

### YAML Direct Routes (`direct:*`)

**Use when:**
- Logic is purely declarative (set header, remove header)
- Pattern is reused across multiple routes
- No complex processing needed

**Example: HTTP Request Preparation**
```yaml
- route:
    id: prepareGetRequest
    from:
      uri: direct:prepareGetRequest
      steps:
        - removeHeaders:
            pattern: "CamelHttp*"
        - setHeader:
            name: CamelHttpMethod
            constant: "GET"
        - setHeader:
            name: Accept
            constant: "application/json"
        - setHeader:
            name: X-Correlation-Id
            simple: "${exchangeProperty.correlationId}"
```

**Benefits:**
- Easy to read and understand
- No external dependencies
- Testable as part of integration tests

### Inline Groovy Scripts

**Use when:**
- XML/JSON transformation needed
- Data extraction and property setting
- Logic is specific to one route or backend

**Example: XML Parsing with Property Extraction**
```yaml
- setBody:
    groovy: |
      import groovy.xml.XmlSlurper
      import groovy.json.JsonOutput

      def xml = new XmlSlurper().parseText(body)

      // Set property for subsequent calls
      exchange.setProperty('customerId', xml.customerId.text())

      def parsed = [
        status: xml.status.text(),
        customerId: xml.customerId.text()
      ]
      return JsonOutput.toJson(parsed)
```

**Benefits:**
- Full language capabilities
- Direct access to exchange properties
- No external files needed

### Standalone Groovy Classes (lib/)

**Use when:**
- Logic is complex enough to warrant unit testing
- Same logic used across multiple routes
- Need independent test coverage

**Example: SparseFieldsets.groovy**
```groovy
class SparseFieldsets {
    static Map apply(String jsonBody, String fieldsParam) {
        if (!fieldsParam) {
            return [filtered: false, body: jsonBody]
        }
        // Complex filtering logic...
        return [filtered: true, body: filteredJson]
    }
}
```

**Usage in route:**
```yaml
- setBody:
    groovy: |
      def result = SparseFieldsets.apply(body, exchange.getProperty('fieldsParam'))
      if (result.error) {
        exchange.setProperty('sparseFieldsetError', true)
        exchange.setProperty('invalidFields', result.invalidFields)
      }
      return result.body
```

**Benefits:**
- Full unit test coverage
- IDE support for development
- Reusable across routes

## Implemented Reusable Routes

### HTTP Preparation

| Route | Purpose |
|-------|---------|
| `prepareGetRequest` | GET with JSON Accept |
| `prepareXmlGetRequest` | GET with XML Accept |
| `preparePostRequest` | POST with JSON Accept + idempotency |
| `preparePostXmlRequest` | POST expecting XML response |

### XML Transformation

| Route | Purpose | Properties Set |
|-------|---------|----------------|
| `parseExciseRegistrationXml` | Registration XML → JSON | `customerId`, `exciseRegistrationResponse` |
| `parseExcisePeriodXml` | Period XML → JSON | `excisePeriodResponse` |
| `parseExciseValidationXml` | Validation XML → JSON | `validationValid`, `customerId`, `exciseValidationResponse` |

### Response Handling

| Route | Purpose |
|-------|---------|
| `extractStandardHeaders` | Extract X-Correlation-Id to property |
| `injectResponseHeaders` | Set Content-Type and X-Correlation-Id |
| `assembleGetResponse` | Combine backend responses |
| `applySparseFieldsets` | Filter response fields |

## Decision Guide

1. **Need to reuse HTTP setup pattern?** → YAML Direct Route
2. **Need to parse XML/JSON one time?** → Inline Groovy
3. **Need unit testable complex logic?** → Groovy Class in lib/
4. **Need to extract data for subsequent calls?** → Inline Groovy with `exchange.setProperty()`
5. **Need simple header manipulation?** → YAML Direct Route

## Migration Path

To migrate existing routes to use reusable patterns:

1. **Identify duplicated code** - Look for repeated header setup, parsing, etc.
2. **Choose the right approach** - YAML for declarative, Groovy for complex
3. **Extract to common.yaml** - Create new `direct:` route or add inline Groovy
4. **Update calling routes** - Replace inline code with `- to: direct:newRoute`
5. **Test** - Verify all acceptance tests still pass

## Results

By applying these patterns to the VPD Domain API routes:

| Metric | Before | After |
|--------|--------|-------|
| Lines per route | ~220 | ~75 |
| Duplicated HTTP setup | 4-5 blocks per route | 0 (use subroutes) |
| XML parsing code | Duplicated | Shared subroutes |
| Maintenance effort | High | Low |
