# Camel YAML DSL Evaluation

Evaluation of Apache Camel YAML DSL with JBang for the VPD Domain API POC, compared to traditional Java/Quarkus approach.

## Executive Summary

**Recommendation: YAML DSL is suitable for this POC and similar orchestration-focused integrations.**

The YAML DSL approach proved effective for:
- Rapid prototyping and iteration
- Declarative orchestration flows
- Reduced boilerplate code
- Easy-to-understand route definitions

For production, consider team skills and complexity requirements.

## Approach Comparison

| Aspect | Java/Quarkus | JBang + YAML DSL |
|--------|--------------|------------------|
| **Setup complexity** | Maven project, pom.xml, dependencies | Single command, inline `--dep` flags |
| **Lines of code** | ~500+ LOC estimated | ~400 LOC actual (routes + common) |
| **Route readability** | Familiar to Java devs, verbose | Declarative, less boilerplate |
| **Debugging** | Full IDE support, breakpoints | Log-based, `camel run --dev` |
| **Testing** | JUnit, MockEndpoints, full unit tests | Integration tests, limited unit testing |
| **Hot reload** | Quarkus dev mode | `camel run --dev` with file watching |
| **Production readiness** | Proven, widely deployed | Emerging, fewer production references |
| **Container size** | 100-200MB (native) | ~300MB (JBang + dependencies) |
| **Startup time** | <1s (native), 2-5s (JVM) | 5-15s (dependency download + JVM) |

## What Worked Well

### 1. Declarative Route Definitions
Routes read as clear orchestration flows:
```yaml
- to: direct:prepareXmlGetRequest
- toD:
    uri: "http://excise-proxy:4010/excise/vpd/registrations/${exchangeProperty.vpdApprovalNumber}"
- to: direct:parseExciseRegistrationXml
```

### 2. Inline Groovy for Transformations
Complex JSON/XML transformations embedded directly in routes:
```yaml
- setBody:
    groovy: |
      import groovy.xml.XmlSlurper
      def xml = new XmlSlurper().parseText(body)
      // Transform XML to JSON...
```

### 3. Reusable Subroutes
`direct:` routes provide clean reuse without external files:
```yaml
- to: direct:prepareGetRequest
- to: direct:parseExciseRegistrationXml
- to: direct:assembleGetResponse
```

### 4. Fast Iteration
Changes to YAML files are immediately testable without compilation.

### 5. Docker-Compose Integration
Simple volume mounts allow route changes without rebuilding containers:
```yaml
volumes:
  - ./specs/vaping-duty/domain/platform/routes:/routes:ro
```

## Challenges Encountered

### 1. Limited IDE Support
- No autocomplete for Camel YAML syntax
- Error messages can be cryptic
- No breakpoint debugging

### 2. Groovy Script Testing
- Inline Groovy can't be unit tested independently
- Extracted to `lib/` directory for testability
- Still requires integration tests to verify

### 3. XML Handling
- Required `camel-jacksonxml` dependency
- Groovy XML parsing works but verbose
- No schema validation in routes

### 4. Error Handling Verbosity
Exception handling in YAML is more verbose than Java:
```yaml
- choice:
    when:
      - simple: "${exchangeProperty.exciseResponseCode} != 200"
        steps:
          - setHeader:
              name: CamelHttpResponseCode
              simple: "${exchangeProperty.exciseResponseCode}"
          # ... more steps
```

### 5. Property Type Handling
Byte arrays from HTTP responses require explicit conversion:
```groovy
def bodyText = body instanceof byte[] ? new String(body, 'UTF-8') : body.toString()
```

## When to Use YAML DSL

**Best suited for:**
- Orchestration-focused integrations (calling multiple backends)
- POCs and prototypes
- Simple to medium complexity flows
- Teams comfortable with declarative styles
- Rapid iteration requirements

**Consider Java/Quarkus for:**
- Complex business logic
- Extensive unit testing requirements
- Teams with strong Java skills
- Performance-critical paths
- Production systems requiring proven patterns

## Hybrid Approach

The POC demonstrates a viable hybrid pattern:

1. **YAML for orchestration**: Route definitions, flow control
2. **Groovy for transformations**: JSON/XML parsing, data mapping
3. **Groovy classes for complex logic**: `SparseFieldsets.groovy` in `lib/`

This provides:
- Clean route definitions
- Testable business logic
- Flexibility to evolve

## Metrics from POC

| Metric | Value |
|--------|-------|
| Total route files | 5 |
| Total lines (routes) | ~400 |
| Reusable subroutes | 10 |
| External Groovy classes | 1 |
| Dependencies | 4 (jacksonxml, groovy, groovy-json, groovy-xml) |
| Unit tests passing | 57 |
| Integration tests passing | 53 |

## Production Considerations

If moving to production with YAML DSL:

1. **Containerization**: Use official `apache/camel-jbang` image
2. **Configuration**: Externalize URLs, timeouts via environment variables
3. **Monitoring**: Integrate with LGTM stack (already in POC)
4. **Testing**: Expand acceptance test coverage
5. **CI/CD**: Cache Maven dependencies for faster builds

If switching to Java/Quarkus:

1. Routes translate directly to Java DSL
2. Groovy scripts become Java processors
3. Keep the same orchestration patterns
4. Add comprehensive unit tests

## Recommendation

**For this POC**: Continue with YAML DSL approach.
- Sufficient for demonstrating domain API patterns
- Faster iteration than Java equivalent
- Adequate for stakeholder validation

**For production decision**: Evaluate based on:
- Team Java vs YAML preference
- Complexity of future integrations
- Testing requirements
- Operational familiarity

The patterns established (reusable subroutes, Groovy utilities, integration testing) transfer to either approach.

## References

- [Apache Camel YAML DSL](https://camel.apache.org/camel-k/latest/languages/yaml.html)
- [Camel JBang](https://camel.apache.org/manual/camel-jbang.html)
- [Quarkus Camel Extension](https://camel.apache.org/camel-quarkus/latest/)
