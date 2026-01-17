# Requirements Document

## Introduction

The simple-xml-response-adapter feature enables the domain API gateway to integrate with legacy XML-based backend services while maintaining a consistent JSON API interface for clients. This adapter transforms XML responses from backends to JSON format, injecting hypermedia links and relationship metadata that XML backends cannot provide. This allows HODs (Head of Departments) who cannot provide modern REST APIs to participate in the domain API architecture without requiring clients to handle XML or change their integration patterns.

## Glossary

- **Gateway**: The Lambda function that routes requests and aggregates responses across domain APIs
- **Backend_Service**: The upstream XML-based service that provides the actual data
- **Response_Adapter**: A component that transforms XML responses to JSON format
- **OAS**: OpenAPI Specification that defines the JSON API contract presented to clients
- **Service_Config**: YAML configuration file that specifies adapter settings and relationship mappings
- **Resource**: A domain entity (e.g., Payment, Taxpayer) exposed through the API
- **Relationship**: A link between resources that enables traversal (e.g., Payment → Taxpayer)
- **Include_Parameter**: Query parameter that allows clients to embed related resources in a single response
- **Hypermedia_Link**: A URL reference in the _links section that enables resource discovery and traversal

## Requirements

### Requirement 1: XML Backend Integration

**User Story:** As a gateway operator, I want to configure specific APIs to use XML backends, so that legacy systems can participate in the domain API architecture without requiring modernization.

#### Acceptance Criteria

1. WHEN a service configuration file exists alongside an OAS, THE Gateway SHALL detect and load the adapter configuration
2. WHEN the service config specifies "simple-xml-response" adapter, THE Gateway SHALL use the adapter for response transformation
3. WHEN calling an XML backend, THE Gateway SHALL accept responses with Content-Type "application/xml"
4. WHEN receiving an XML response from a backend, THE Gateway SHALL transform it to JSON format
5. THE Gateway SHALL transform XML responses to JSON format matching the OAS schema

### Requirement 2: Service Configuration Management

**User Story:** As an API producer, I want to declare adapter requirements in a configuration file, so that the gateway knows how to communicate with my backend service.

#### Acceptance Criteria

1. THE Service_Config SHALL be located at `specs/{api-name}/service.yaml` alongside the OAS
2. THE Service_Config SHALL specify which adapters are required using an "adapters" array
3. WHEN "simple-xml-response" is listed in adapters, THE Gateway SHALL enable XML response transformation for that API
4. THE Service_Config SHALL define relationship mappings between resources
5. THE Service_Config SHALL specify which fields drive resource relationships

### Requirement 3: Relationship Configuration

**User Story:** As an API producer, I want to configure resource relationships in the service config, so that the gateway can inject hypermedia links that my XML backend cannot provide.

#### Acceptance Criteria

1. THE Service_Config SHALL define relationships between resources using a "relationships" section
2. WHEN a relationship is configured, THE Gateway SHALL inject corresponding _links entries in JSON responses
3. THE Gateway SHALL use configured field mappings to construct relationship URLs
4. WHEN a resource has multiple relationships, THE Gateway SHALL inject all configured links
5. THE Gateway SHALL support bidirectional relationship traversal through link injection

### Requirement 4: External API Consistency

**User Story:** As an API consumer, I want XML-backed APIs to behave identically to JSON-backed APIs, so that I don't need to know or care about backend implementation details.

#### Acceptance Criteria

1. THE Gateway SHALL present the same JSON structure for XML-backed and JSON-backed APIs
2. WHEN accessing an XML-backed resource, THE response SHALL conform to the OAS schema
3. THE Gateway SHALL include _links sections in all XML-backed resource responses
4. THE Gateway SHALL support the include parameter for XML-backed APIs
5. WHEN comparing responses, XML-backed and JSON-backed APIs SHALL be indistinguishable to clients

### Requirement 5: Include Parameter Support

**User Story:** As an API consumer, I want to use the include parameter with XML-backed APIs, so that I can reduce round trips regardless of backend implementation.

#### Acceptance Criteria

1. WHEN the include parameter is provided, THE Gateway SHALL fetch related resources from XML backends
2. THE Gateway SHALL transform all included XML resources to JSON format
3. THE Gateway SHALL aggregate included resources in the _included section
4. WHEN including cross-API relationships, THE Gateway SHALL fetch from appropriate backends
5. THE Gateway SHALL handle partial failures gracefully when fetching included resources

### Requirement 6: Hypermedia Link Injection

**User Story:** As a gateway operator, I want the gateway to inject hypermedia links based on configuration, so that XML backends don't need to understand or generate HATEOAS links.

#### Acceptance Criteria

1. WHEN transforming an XML response, THE Gateway SHALL inject _links based on service configuration
2. THE Gateway SHALL construct link URLs using configured field mappings
3. WHEN a relationship points to another API, THE Gateway SHALL generate correct cross-API links
4. THE Gateway SHALL include link metadata (type, title) as specified in configuration
5. THE Gateway SHALL inject self links for all resources

### Requirement 7: XML-JSON Response Transformation

**User Story:** As a gateway operator, I want XML responses transformed to JSON, so that clients receive consistent JSON responses regardless of backend implementation.

#### Acceptance Criteria

1. WHEN receiving an XML response from a backend, THE Gateway SHALL transform it to JSON
2. THE Gateway SHALL preserve data types during transformation (numbers, booleans, dates)
3. WHEN transformation fails, THE Gateway SHALL return a descriptive error to the client
4. THE Gateway SHALL handle nested objects and arrays in XML responses
5. THE Gateway SHALL handle XML collections (multiple items) correctly

### Requirement 8: Payment API XML Backend Example

**User Story:** As a developer, I want the Payment API configured as an XML backend example, so that I can understand how to configure other APIs.

#### Acceptance Criteria

1. THE Payment API SHALL have a service.yaml configuration file
2. THE service.yaml SHALL specify "simple-xml-response" as an adapter
3. THE service.yaml SHALL define relationships to Taxpayer and PaymentAllocation resources
4. THE Payment API OAS SHALL remain unchanged from the JSON backend version
5. THE Gateway SHALL successfully route Payment API requests to an XML backend

### Requirement 9: Acceptance Test Coverage

**User Story:** As a developer, I want comprehensive acceptance tests for XML backends, so that I can verify the feature works correctly before implementation.

#### Acceptance Criteria

1. WHEN acceptance tests run, THEY SHALL verify XML backend integration works correctly
2. THE tests SHALL confirm JSON responses match the OAS schema
3. THE tests SHALL validate all relationship traversal patterns work with XML backends
4. THE tests SHALL verify include parameter functionality with XML backends
5. THE tests SHALL confirm XML-backed and JSON-backed APIs are indistinguishable to clients
