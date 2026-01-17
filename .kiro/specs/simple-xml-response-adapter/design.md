# Design Document: Simple XML Response Adapter

## Overview

The simple-xml-response-adapter feature extends the domain API gateway to support legacy XML-based backend services while maintaining a consistent JSON API interface for clients. This adapter enables seamless integration of HODs who cannot provide modern REST APIs, ensuring they can participate in the domain API architecture without requiring clients to handle XML or change their integration patterns.

The adapter operates transparently at the gateway layer, transforming requests and responses between JSON (client-facing) and XML (backend-facing) formats while injecting hypermedia links and relationship metadata that XML backends cannot provide.

## Architecture

### Architectural Decision: Modular Adapter Architecture

**Decision**: Implement adapters as separate, focused modules within the gateway Lambda, with clear interfaces and minimal coupling.

**Rationale**:
1. **Extensibility**: Easy to add new adapters (SOAP, CSV, GraphQL) without modifying existing code
2. **Maintainability**: Each adapter is self-contained and can be tested independently
3. **Single Responsibility**: Each adapter handles one transformation concern
4. **Composition**: Multiple adapters can be chained if needed (future enhancement)
5. **Performance**: All adapters in same Lambda avoids network latency while keeping code modular

**Architecture Pattern**: Strategy Pattern with Adapter Registry

```typescript
// Adapter interface - all adapters implement this
interface Adapter {
  name: string;
  
  // Transform request before sending to backend
  transformRequest?(body: any, headers: Record<string, string>): {
    body: any;
    headers: Record<string, string>;
  };
  
  // Transform response after receiving from backend
  transformResponse?(body: any, headers: Record<string, string>): {
    body: any;
    headers: Record<string, string>;
  };
  
  // Inject links based on configuration
  injectLinks?(resource: any, config: ServiceConfig, stage: string): any;
}

// Adapter registry - dynamically loads adapters
class AdapterRegistry {
  private adapters: Map<string, Adapter> = new Map();
  
  register(adapter: Adapter): void {
    this.adapters.set(adapter.name, adapter);
  }
  
  get(name: string): Adapter | undefined {
    return this.adapters.get(name);
  }
}
```

**Module Structure**:
```
gateway/lambda/src/
├── index.ts                      # Main Lambda handler
├── adapters/
│   ├── registry.ts               # Adapter registry and interface
│   ├── simple-xml-response/
│   │   ├── index.ts             # SimpleXmlResponseAdapter implementation
│   │   ├── transformer.ts       # XML<->JSON transformation
│   │   ├── link-injector.ts     # Link injection logic
│   │   └── types.ts             # XML adapter types
│   ├── future-soap/             # Future SOAP adapter
│   │   └── index.ts
│   └── future-csv/              # Future CSV adapter
│       └── index.ts
└── config/
    └── service-config.ts         # Service configuration loading
```

**Benefits of This Approach**:
- **Small Modules**: Each adapter is ~100-200 lines, easy to understand
- **Independent Testing**: Test each adapter in isolation
- **No Monolith**: Gateway remains thin orchestration layer
- **Clear Boundaries**: Adapters don't depend on each other
- **Easy to Add**: New adapter = new directory + register in registry

**Trade-offs**:
- Slightly more boilerplate (adapter interface, registry)
- Need to maintain adapter interface stability
- All adapters bundled in Lambda (but total size still small)

**Alternative Considered**: Separate Lambda per adapter
- **Pros**: Complete isolation, independent deployment
- **Cons**: Network latency (~100-200ms per hop), more complex orchestration, harder to share context
- **Verdict**: Modular approach gives 80% of benefits without latency cost

**Future Consideration**: If Lambda size becomes issue (>50MB), use Lambda layers to separate adapter code from core gateway code.

### Naming Decision: simple-xml-response-adapter

**Decision**: Use "simple-xml-response-adapter" (not "simple-xml-adapter")

**Rationale**:
1. **Precise Scope**: This adapter only transforms XML responses to JSON, not requests
2. **Composability**: Different APIs may need different combinations of adapters (request vs response)
3. **Clarity**: Name explicitly states what it does - transforms responses
4. **Future-proof**: Leaves room for "simple-xml-request-adapter" if needed
5. **Current Use Case**: Payment API backend returns XML but accepts JSON (no request transformation needed)

**Adapter Composition Examples**:
- **Payment API**: `simple-xml-response-adapter` only (backend accepts JSON, returns XML)
- **Future SOAP API**: `soap-request-adapter` + `soap-response-adapter` (both directions need transformation)
- **Future CSV API**: `csv-response-adapter` only (backend returns CSV, accepts JSON)

**Interface Design**: Adapters implement only the methods they need
```typescript
interface Adapter {
  name: string;
  transformRequest?: (body: any, headers: Record<string, string>) => TransformResult;
  transformResponse?: (body: any, headers: Record<string, string>) => TransformResult;
  injectLinks?: (resource: any, config: ServiceConfig, stage: string) => any;
}
```

This allows adapters to be focused and composable - an API can use multiple adapters that each handle one concern.

### High-Level Architecture

```
┌─────────────┐
│   Client    │
│  (JSON)     │
└──────┬──────┘
       │ HTTP/JSON
       │
┌──────▼──────────────────────────────────────────┐
│          API Gateway (Lambda)                    │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │  1. Detect Adapter from service.yaml   │    │
│  └────────────┬───────────────────────────┘    │
│               │                                  │
│  ┌────────────▼───────────────────────────┐    │
│  │  2. Transform JSON → XML (if needed)   │    │
│  │     [XML Adapter Module]               │    │
│  └────────────┬───────────────────────────┘    │
│               │                                  │
└───────────────┼──────────────────────────────────┘
                │ HTTP/XML
                │
┌───────────────▼──────────────────────────────────┐
│          Backend Service (XML)                    │
│                                                   │
│  ┌────────────────────────────────────────┐     │
│  │  Process Request, Return XML Response  │     │
│  └────────────┬───────────────────────────┘     │
└───────────────┼───────────────────────────────────┘
                │ HTTP/XML
                │
┌───────────────▼──────────────────────────────────┐
│          API Gateway (Lambda)                     │
│                                                   │
│  ┌────────────────────────────────────────┐     │
│  │  3. Transform XML → JSON               │     │
│  │     [XML Adapter Module]               │     │
│  └────────────┬───────────────────────────┘     │
│               │                                   │
│  ┌────────────▼───────────────────────────┐     │
│  │  4. Inject _links from config          │     │
│  │     [XML Adapter Module]               │     │
│  └────────────┬───────────────────────────┘     │
│               │                                   │
│  ┌────────────▼───────────────────────────┐     │
│  │  5. Handle include parameter           │     │
│  │     [Existing Gateway Logic]           │     │
│  └────────────┬───────────────────────────┘     │
└───────────────┼───────────────────────────────────┘
                │ HTTP/JSON
                │
┌───────────────▼──────────────────────────────────┐
│          Client (JSON)                            │
└───────────────────────────────────────────────────┘
```

### Component Interaction

The gateway Lambda function is enhanced with an XML adapter module that provides transformation capabilities:

1. **Configuration Loading**: On Lambda initialization, load service.yaml files for each API
2. **Adapter Detection**: Check if the target API uses the simple-xml adapter
3. **Request Transformation**: XML adapter converts JSON requests to XML when calling XML backends
4. **Response Transformation**: XML adapter converts XML responses to JSON matching the OAS
5. **Link Injection**: XML adapter adds _links sections based on service.yaml relationship configuration
6. **Include Handling**: Existing gateway logic fetches related resources, XML adapter transforms them

### Module Structure

```
gateway/lambda/src/
├── index.ts                      # Main Lambda handler (existing)
├── adapters/
│   ├── registry.ts               # Adapter registry and interface
│   ├── simple-xml-response/
│   │   ├── index.ts             # SimpleXmlResponseAdapter implementation
│   │   ├── transformer.ts       # XML->JSON transformation
│   │   ├── link-injector.ts     # Link injection logic
│   │   └── types.ts             # XML adapter types
│   └── README.md                # Guide for adding new adapters
└── config/
    └── service-config.ts         # Service configuration loading
```

**Adapter Interface**:
```typescript
// adapters/registry.ts
export interface Adapter {
  name: string;
  
  // Transform request before sending to backend
  transformRequest?(body: any, headers: Record<string, string>): {
    body: any;
    headers: Record<string, string>;
  };
  
  // Transform response after receiving from backend
  transformResponse?(body: any, headers: Record<string, string>): {
    body: any;
    headers: Record<string, string>;
  };
  
  // Inject links based on configuration
  injectLinks?(resource: any, config: ServiceConfig, stage: string): any;
}

export class AdapterRegistry {
  private adapters: Map<string, Adapter> = new Map();
  
  register(adapter: Adapter): void {
    this.adapters.set(adapter.name, adapter);
  }
  
  get(name: string): Adapter | undefined {
    return this.adapters.get(name);
  }
  
  getAll(): Adapter[] {
    return Array.from(this.adapters.values());
  }
}

// Global registry instance
export const adapterRegistry = new AdapterRegistry();
```

**SimpleXmlResponseAdapter Implementation**:
```typescript
// adapters/simple-xml-response/index.ts
import { Adapter } from '../registry';
import { transformToJson } from './transformer';
import { injectLinksFromConfig } from './link-injector';

export class SimpleXmlResponseAdapter implements Adapter {
  name = 'simple-xml-response';
  
  // No transformRequest - this adapter only handles responses
  
  transformResponse(body: string, headers: Record<string, string>) {
    const json = transformToJson(body);
    return {
      body: json,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    };
  }
  
  injectLinks(resource: any, config: ServiceConfig, stage: string) {
    return injectLinksFromConfig(resource, config, stage);
  }
}
```

## Components and Interfaces

### Service Configuration File

**Location**: `specs/{api-name}/service.yaml`

**Structure**:
```yaml
adapters:
  - simple-xml-response

relationships:
  # Define relationships for link injection
  taxpayer:
    targetApi: taxpayer
    targetResource: taxpayers
    sourceField: taxpayerId
    linkType: taxpayer
    linkTitle: "Taxpayer who made this payment"
  
  allocations:
    targetApi: payment
    targetResource: allocations
    sourceField: id
    urlPattern: "/payments/{id}/allocations"
    linkType: collection
    linkTitle: "Allocations for this payment"
```

**Fields**:
- `adapters`: Array of adapter names (e.g., ["simple-xml-response"])
- `relationships`: Object mapping relationship names to configuration
  - `targetApi`: Which API provides the related resource
  - `targetResource`: Resource type in the target API
  - `sourceField`: Field in source resource used to construct URL
  - `urlPattern`: Optional custom URL pattern (supports {field} placeholders)
  - `linkType`: Type metadata for the link (e.g., "taxpayer", "collection")
  - `linkTitle`: Human-readable title for the link

### Gateway Lambda Enhancements

**New Interfaces**:

```typescript
interface ServiceConfig {
  adapters: string[];
  relationships?: Record<string, RelationshipConfig>;
}

interface RelationshipConfig {
  targetApi: string;
  targetResource: string;
  sourceField: string;
  urlPattern?: string;
  linkType: string;
  linkTitle: string;
}

interface AdapterContext {
  apiName: string;
  config: ServiceConfig;
  usesXml: boolean;
}
```

**New Functions**:

```typescript
// Load service configuration for an API
function loadServiceConfig(apiName: string): ServiceConfig | null

// Detect if a path uses XML adapter
function detectAdapter(path: string): AdapterContext

// Transform JSON to XML
function jsonToXml(json: any, rootElement: string): string

// Transform XML to JSON
function xmlToJson(xml: string): any

// Inject links based on configuration
function injectLinks(
  resource: any, 
  config: ServiceConfig, 
  stage: string
): any

// Construct URL from pattern and resource fields
function constructUrl(
  pattern: string, 
  resource: any, 
  stage: string
): string
```

### XML Transformation Library

Use `fast-xml-parser` library for bidirectional XML-JSON transformation:

```typescript
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
};

const parser = new XMLParser(parserOptions);
const builder = new XMLBuilder(parserOptions);
```

## Data Models

### Service Configuration Schema

```yaml
type: object
required:
  - adapters
properties:
  adapters:
    type: array
    items:
      type: string
      enum: [simple-xml-response]
  relationships:
    type: object
    additionalProperties:
      type: object
      required:
        - targetApi
        - targetResource
        - sourceField
        - linkType
        - linkTitle
      properties:
        targetApi:
          type: string
        targetResource:
          type: string
        sourceField:
          type: string
        urlPattern:
          type: string
        linkType:
          type: string
        linkTitle:
          type: string
```

### XML Message Format

Payment resource in XML:
```xml
<payment>
  <id>PM20230001</id>
  <type>payment</type>
  <taxpayerId>TP123456</taxpayerId>
  <amount>
    <amount>7500.00</amount>
    <currency>GBP</currency>
  </amount>
  <paymentDate>2024-01-31</paymentDate>
  <paymentMethod>bank-transfer</paymentMethod>
  <reference>TAX-2023-001</reference>
  <status>cleared</status>
</payment>
```

Payment collection in XML:
```xml
<payments>
  <items>
    <payment>
      <id>PM20230001</id>
      <!-- ... -->
    </payment>
    <payment>
      <id>PM20230002</id>
      <!-- ... -->
    </payment>
  </items>
</payments>
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: XML-JSON Response Transformation Correctness

*For any* valid XML response from a backend, transforming to JSON should produce a valid JSON object that preserves all data values, types, and structure.

**Validates: Requirements 7.1, 7.2, 7.4, 7.5**

### Property 2: Adapter Detection Consistency

*For any* API path, if a service.yaml exists with "simple-xml-response" in the adapters array, the gateway should consistently detect and enable XML response transformation for all requests to that API.

**Validates: Requirements 1.1, 1.2, 2.3**

### Property 3: HTTP Content-Type Handling

*For any* response from an XML-backed API, the gateway should accept "application/xml" Content-Type from the backend and return "application/json" Content-Type to the client.

**Validates: Requirements 1.3, 1.4**

### Property 4: OAS Schema Conformance

*For any* XML backend response, after transformation to JSON and link injection, the resulting JSON should validate against the corresponding OAS schema.

**Validates: Requirements 1.5, 4.2**

### Property 5: Link Injection Completeness

*For any* resource with N configured relationships in service.yaml, the transformed JSON response should contain exactly N relationship links in the _links section, plus a self link.

**Validates: Requirements 3.2, 3.4, 6.1, 6.5**

### Property 6: URL Construction Correctness

*For any* relationship configuration with a sourceField or urlPattern, the constructed link URL should correctly substitute field values from the source resource and include the appropriate stage prefix.

**Validates: Requirements 3.3, 6.2**

### Property 7: Cross-API Link Routing

*For any* relationship that points to a different API (targetApi ≠ current API), the generated link should route to the correct API's base path.

**Validates: Requirements 3.5, 6.3**

### Property 8: Backend Indistinguishability

*For any* equivalent resource data, responses from XML-backed and JSON-backed APIs should be structurally identical (same JSON structure, same _links, same field names and types).

**Validates: Requirements 4.1, 4.5**

### Property 9: Include Parameter Parity

*For any* valid include parameter value, XML-backed APIs should fetch, transform, and aggregate related resources in the _included section identically to JSON-backed APIs.

**Validates: Requirements 4.4, 5.1, 5.2, 5.3**

### Property 10: Cross-API Include Routing

*For any* include parameter that references a relationship to another API, the gateway should fetch from the correct backend API regardless of whether it's XML or JSON-backed.

**Validates: Requirements 5.4**

### Property 11: Link Metadata Preservation

*For any* relationship configuration that specifies linkType and linkTitle, the injected link should include these metadata fields.

**Validates: Requirements 6.4**

### Property 12: Bidirectional Relationship Traversal

*For any* pair of resources A and B where A links to B and B links to A (bidirectional relationship), both link directions should work correctly with XML backends.

**Validates: Requirements 3.5**

## Error Handling

### Transformation Errors

**Scenario**: XML parsing fails or JSON-to-XML conversion fails

**Handling**:
- Return 502 Bad Gateway with descriptive error
- Log the transformation error with request context
- Include error details in response body

**Example Response**:
```json
{
  "error": {
    "code": "TRANSFORMATION_ERROR",
    "message": "Failed to transform XML response to JSON",
    "details": "Invalid XML structure at line 42"
  }
}
```

### Configuration Errors

**Scenario**: service.yaml is malformed or missing required fields

**Handling**:
- Log configuration error at startup/request time
- Fall back to direct pass-through (no transformation)
- Return 502 if transformation is required but config is invalid

### Backend Errors

**Scenario**: XML backend returns error response

**Handling**:
- Transform error response to JSON if possible
- Preserve HTTP status code from backend
- Forward error details to client

### Partial Include Failures

**Scenario**: Some included resources fail to fetch

**Handling**:
- Return primary resource successfully
- Include successfully fetched resources in _included
- Log failures but don't fail entire request
- Graceful degradation for better user experience

## Testing Strategy

### Unit Tests

**Focus**: Individual transformation functions and configuration parsing

**Examples**:
- Test `jsonToXml()` with various JSON structures
- Test `xmlToJson()` with various XML documents
- Test `loadServiceConfig()` with valid and invalid YAML
- Test `injectLinks()` with different relationship configurations
- Test `constructUrl()` with various URL patterns and field values

**Edge Cases**:
- Empty objects and arrays
- Null and undefined values
- Special characters in XML (escaping)
- Deeply nested structures
- Large payloads

### Property-Based Tests

**Configuration**: Minimum 100 iterations per property test

**Property Tests**:

1. **XML-JSON Round Trip** (Property 1)
   - Generate random valid JSON resources
   - Transform to XML and back
   - Assert equivalence

2. **Adapter Detection** (Property 2)
   - Generate random API paths and configs
   - Verify consistent adapter detection

3. **HTTP Headers** (Property 3)
   - Generate random requests to XML APIs
   - Verify Content-Type headers

4. **Schema Validation** (Property 4)
   - Generate random XML responses
   - Transform and validate against OAS

5. **Link Injection** (Property 5)
   - Generate random resources with N relationships
   - Verify N+1 links (N relationships + self)

6. **URL Construction** (Property 6)
   - Generate random field values and patterns
   - Verify correct URL construction

7. **Cross-API Routing** (Property 7)
   - Generate random cross-API relationships
   - Verify correct API routing

8. **Backend Indistinguishability** (Property 8)
   - Generate equivalent data for XML and JSON backends
   - Verify identical responses

9. **Include Parameter** (Property 9)
   - Generate random include parameters
   - Verify identical behavior for XML and JSON backends

10. **Cross-API Includes** (Property 10)
    - Generate random cross-API includes
    - Verify correct backend routing

11. **Link Metadata** (Property 11)
    - Generate random link configurations
    - Verify metadata presence

12. **Bidirectional Traversal** (Property 12)
    - Generate random bidirectional relationships
    - Verify both directions work

### Integration Tests

**Focus**: Gateway interaction with mock XML backends

**Test Cases**:
- Gateway routes to XML backend correctly
- Request transformation works end-to-end
- Response transformation works end-to-end
- Link injection works with real responses
- Include parameter fetches from XML backends
- Error responses are handled correctly

### Acceptance Tests

**Focus**: End-to-end validation from client perspective

**Critical Scenarios**:

1. **Payment API with XML Backend**
   - Fetch payment resource
   - Verify JSON response matches OAS
   - Verify _links are present
   - Follow taxpayer link
   - Use include parameter
   - Verify indistinguishable from JSON backend

2. **Cross-API Traversal**
   - Start at Taxpayer API (JSON backend)
   - Follow payment link to Payment API (XML backend)
   - Verify seamless traversal

3. **Include Parameter with XML Backend**
   - Request payment with include=taxpayer
   - Verify taxpayer is fetched and included
   - Verify response structure matches JSON backend

4. **Collection Endpoints**
   - List payments from XML backend
   - Verify collection structure
   - Use include parameter on collection
   - Verify _included at collection level

**Test Implementation**:
- Extend existing `gateway-api.spec.ts` acceptance tests
- Add XML-specific test cases
- Verify all existing tests pass with XML backend
- Add comparison tests (XML vs JSON backends)

## Implementation Notes

### Library Selection

**XML Parsing**: Use `fast-xml-parser` (already in dependencies)
- Bidirectional transformation
- Preserves data types
- Handles attributes and text nodes
- Good performance

### Configuration Loading

**Approach**: Load service.yaml files at Lambda initialization
- Cache configurations in memory
- Reload on Lambda cold start
- Consider environment variable for config location

### Performance Considerations

**Transformation Overhead**:
- XML parsing adds ~5-10ms per request
- JSON serialization adds ~2-5ms per request
- Acceptable for POC, monitor in production

**Caching**:
- Cache parsed service configurations
- Consider caching transformed responses (future enhancement)

### Backward Compatibility

**Existing APIs**: No changes required
- JSON-backed APIs continue to work unchanged
- Only APIs with service.yaml are affected
- Gradual migration path for HODs

### Future Enhancements

**Additional Adapters**:
- SOAP adapter for SOAP/XML services
- CSV adapter for flat file backends
- GraphQL adapter for GraphQL backends

**Advanced Features**:
- Field mapping (rename fields during transformation)
- Data type coercion (custom type conversions)
- Conditional link injection (based on field values)
- Response caching for XML backends
