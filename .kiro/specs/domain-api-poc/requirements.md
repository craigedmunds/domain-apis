# Requirements Document

## Introduction

This specification defines a proof-of-concept for a domain API architecture representing a portion of the UK tax system. The POC demonstrates multi-API domain modeling with shared components, lightweight JSON API-inspired relationship handling, and cross-API resource traversal capabilities.

The system will consist of 2-3 separate RESTful APIs, each representing a distinct part of the tax domain, with shared OpenAPI specification fragments for common elements. The APIs will support resource relationships and traversal without requiring full JSON API compliance.

## Glossary

- **Domain_API**: A RESTful API representing a specific subdomain within the UK tax system
- **OAS**: OpenAPI Specification - a standard format for describing REST APIs
- **Shared_Fragment**: Reusable OpenAPI specification components referenced by multiple APIs
- **Resource**: A domain entity exposed through the API (e.g., TaxPayer, TaxReturn, Payment)
- **Relationship**: A link between resources that may span across different APIs
- **Cross_API_Traversal**: The ability to navigate from a resource in one API to related resources in another API via URLs
- **JSON_API_Lite**: A lightweight approach inspired by JSON API specification without full compliance

## Requirements

### Requirement 1: Multi-API Architecture

**User Story:** As a domain architect, I want to model the UK tax system as multiple separate APIs, so that each API can represent a distinct subdomain with clear boundaries.

#### Acceptance Criteria

1. THE System SHALL provide between 2 and 3 separate Domain_APIs
2. WHEN defining the domain model, THE System SHALL assign each subdomain to exactly one Domain_API
3. THE System SHALL ensure each Domain_API has a distinct base URL path
4. THE System SHALL maintain independent versioning for each Domain_API
5. WHEN a client accesses a Domain_API, THE System SHALL serve only resources belonging to that API's subdomain

### Requirement 2: OpenAPI Specification Management

**User Story:** As an API developer, I want each API to have its own OpenAPI specification file, so that the API contract is clearly defined and can be used for code generation and documentation.

#### Acceptance Criteria

1. THE System SHALL provide one OAS file for each Domain_API
2. WHEN an OAS file is created, THE System SHALL include all endpoints, schemas, and operations for that Domain_API
3. THE System SHALL ensure each OAS file is valid according to OpenAPI 3.0 or later specification
4. THE System SHALL include example requests and responses in each OAS file
5. WHEN an OAS file is updated, THE System SHALL maintain backward compatibility or increment the API version

### Requirement 3: Shared Component Management

**User Story:** As an API developer, I want to define common elements as shared fragments, so that I can reuse schemas and components across multiple APIs without duplication.

#### Acceptance Criteria

1. THE System SHALL provide Shared_Fragments for common domain elements
2. WHEN a common element is identified, THE System SHALL extract it into a Shared_Fragment
3. THE System SHALL allow Domain_APIs to reference Shared_Fragments using OpenAPI $ref syntax
4. THE System SHALL ensure Shared_Fragments are independently versioned
5. WHEN a Shared_Fragment is updated, THE System SHALL validate that all referencing APIs remain compatible

### Requirement 4: Lightweight JSON API-Inspired Structure

**User Story:** As an API consumer, I want resources to include relationship links without requiring full JSON API compliance, so that I can navigate between related resources while keeping the response structure simple.

#### Acceptance Criteria

1. THE System SHALL NOT wrap resource data in a root-level "data" object
2. WHEN returning a Resource, THE System SHALL include the resource attributes at the top level of the response
3. THE System SHALL include a "_links" or similar field within each Resource to represent relationships
4. WHEN a Resource has relationships, THE System SHALL include URLs to related resources in the links field
5. THE System SHALL support standard HTTP methods (GET, POST, PUT, PATCH, DELETE) for resource operations

### Requirement 5: Cross-API Resource Traversal

**User Story:** As an API consumer, I want to traverse from a resource in one API to related resources in another API, so that I can explore the complete domain model across API boundaries.

#### Acceptance Criteria

1. WHEN a Resource in one Domain_API relates to a Resource in another Domain_API, THE System SHALL include a relationship link with the full URL to the related resource
2. THE System SHALL ensure relationship URLs are absolute and include the target API's base URL
3. WHEN a client follows a relationship link, THE System SHALL return the related Resource from the target Domain_API
4. THE System SHALL support bidirectional relationships where both resources link to each other
5. THE System SHALL include relationship metadata (e.g., relationship type, cardinality) in the links structure

### Requirement 6: UK Tax Domain Modeling

**User Story:** As a domain expert, I want the APIs to represent realistic UK tax system concepts, so that the POC demonstrates practical domain modeling.

#### Acceptance Criteria

1. THE System SHALL model at least two distinct UK tax subdomains (e.g., Income Tax, National Insurance, VAT)
2. WHEN defining Resources, THE System SHALL use terminology consistent with UK tax legislation
3. THE System SHALL include realistic attributes for each Resource based on UK tax requirements
4. THE System SHALL model relationships between Resources that reflect actual UK tax system dependencies
5. THE System SHALL include at least one cross-API relationship representing a real-world tax scenario

### Requirement 7: API Documentation and Discoverability

**User Story:** As an API consumer, I want comprehensive documentation for each API, so that I can understand how to use the APIs and navigate between them.

#### Acceptance Criteria

1. THE System SHALL generate human-readable documentation from each OAS file
2. WHEN documentation is generated, THE System SHALL include descriptions for all endpoints, parameters, and schemas
3. THE System SHALL provide examples showing cross-API traversal patterns
4. THE System SHALL document the relationship structure and link format
5. THE System SHALL include a getting started guide explaining the multi-API architecture

### Requirement 8: Development and Testing Support

**User Story:** As a developer, I want tooling to validate and test the API specifications, so that I can ensure the APIs are correctly defined and functional.

#### Acceptance Criteria

1. THE System SHALL validate all OAS files against the OpenAPI specification
2. WHEN Shared_Fragments are referenced, THE System SHALL validate that references resolve correctly
3. THE System SHALL provide mock servers or stubs for each Domain_API based on the OAS files
4. THE System SHALL include example data that demonstrates cross-API relationships
5. THE System SHALL validate that all relationship URLs are correctly formed and resolvable
