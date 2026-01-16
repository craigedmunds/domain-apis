# Implementation Plan: Domain API POC

## Overview

This implementation plan creates a proof-of-concept for a multi-API domain architecture representing UK tax system components. The approach focuses on OpenAPI-first development: define specifications first, validate them, then implement mock servers and finally real implementations. This ensures the API contracts are solid before writing code.

## Tasks

- [x] 1. Set up project structure and tooling
  - Create directory structure for three APIs (taxpayer, income-tax, payment)
  - Create shared components directory
  - Set up OpenAPI validation tooling (e.g., openapi-generator-cli, spectral)
  - Set up mock server tooling (e.g., Prism)
  - Set up documentation generation tooling (e.g., Redoc, Swagger UI)
  - _Requirements: 2.1, 8.1, 8.3_

- [ ] 2. Create shared OpenAPI components
  - [x] 2.1 Create shared-components.yaml with common schemas
    - Define Address schema with UK postcode validation
    - Define Money schema with GBP currency
    - Define DateRange schema
    - Define Links schema for hypermedia
    - Add version field to shared components file
    - _Requirements: 3.1, 3.4_
  
  - [ ]* 2.2 Write property test for shared component validation
    - **Property 5: Shared Component References**
    - **Validates: Requirements 3.3, 3.5, 8.2**
  
  - [ ]* 2.3 Write unit tests for shared components
    - Test UK postcode pattern validation
    - Test Money schema with GBP currency
    - Test DateRange validation (startDate <= endDate)
    - _Requirements: 3.1_

- [ ] 3. Create Taxpayer API specification
  - [x] 3.1 Create taxpayer-api.yaml OpenAPI specification
    - Define API info (title, version, description)
    - Define server URL: /api/taxpayer/v1
    - Define Taxpayer schema with NINO validation
    - Reference shared Address schema
    - Define all endpoints (GET /taxpayers, GET /taxpayers/{id}, POST /taxpayers, PUT /taxpayers/{id}, DELETE /taxpayers/{id})
    - Include relationship links to Income Tax and Payment APIs
    - Add request/response examples
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.3, 4.5, 5.1, 5.2, 5.5_
  
  - [ ]* 3.2 Write property test for Taxpayer API OAS validation
    - **Property 4: OAS File Completeness and Validity**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  
  - [ ]* 3.3 Write property test for resource structure
    - **Property 6: Resource Structure Format**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 4. Create Income Tax API specification
  - [x] 4.1 Create income-tax-api.yaml OpenAPI specification
    - Define API info (title, version, description)
    - Define server URL: /api/income-tax/v1
    - Define TaxReturn schema with tax year validation
    - Define Assessment schema
    - Reference shared Money and DateRange schemas
    - Define all endpoints (GET /tax-returns, GET /tax-returns/{id}, POST /tax-returns, GET /tax-returns/{id}/assessments, GET /assessments/{id})
    - Include relationship links to Taxpayer and Payment APIs
    - Add request/response examples
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.3, 4.5, 5.1, 5.2, 5.5, 6.1_
  
  - [ ]* 4.2 Write property test for Income Tax API OAS validation
    - **Property 4: OAS File Completeness and Validity**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  
  - [ ]* 4.3 Write property test for cross-API link format
    - **Property 9: Cross-API Link Format**
    - **Validates: Requirements 5.1, 5.2, 5.5**

- [ ] 5. Create Payment API specification
  - [x] 5.1 Create payment-api.yaml OpenAPI specification
    - Define API info (title, version, description)
    - Define server URL: /api/payment/v1
    - Define Payment schema with payment method enum
    - Define PaymentAllocation schema
    - Reference shared Money schema
    - Define all endpoints (GET /payments, GET /payments/{id}, POST /payments, GET /payments/{id}/allocations, POST /allocations)
    - Include relationship links to Taxpayer and Income Tax APIs
    - Add request/response examples
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.3, 4.5, 5.1, 5.2, 5.5, 6.1, 6.5_
  
  - [ ]* 5.2 Write property test for Payment API OAS validation
    - **Property 4: OAS File Completeness and Validity**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  
  - [ ]* 5.3 Write property test for bidirectional relationships
    - **Property 11: Bidirectional Relationships**
    - **Validates: Requirements 5.4**

- [x] 6. Checkpoint - Validate all OpenAPI specifications
  - Run OpenAPI validator against all three API specs
  - Verify all $ref references resolve correctly
  - Verify all examples are valid against schemas
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 8.1, 8.2_

- [ ] 7. Implement include parameter support (Gateway Layer)
  - [x] 7.1 Add include parameter to OpenAPI specifications
    - Add `IncludeParameter` definition to shared-components.yaml
    - Reference include parameter in all GET endpoints across all three APIs
    - Document `_included` field in response schemas
    - Add examples showing include parameter usage
    - _Requirements: 4.4, 5.3_
  
  - [ ] 7.2 Set up LocalStack for local development
    - Create docker-compose.yml with LocalStack service
    - Configure LocalStack for API Gateway and Lambda services
    - Add backend mock API services to docker-compose
    - Create tools/localstack-init.sh initialization script
    - Add Taskfile tasks for gateway management (start, stop, init, logs, status)
    - _Requirements: 8.3_
  
  - [ ] 7.3 Create aggregation Lambda function
    - Set up Lambda project structure (TypeScript/Node.js)
    - Implement request routing to backend APIs
    - Implement include parameter parsing
    - Implement parallel fetching of related resources
    - Implement response merging into _included structure
    - Handle partial failures gracefully
    - Add error handling for gateway-level issues
    - _Requirements: 4.4, 5.3_
  
  - [ ] 7.4 Configure API Gateway
    - Create API Gateway OpenAPI specification (gateway-api.yaml)
    - Configure proxy resource (/{proxy+}) to Lambda
    - Set up Lambda integration with AWS_PROXY type
    - Deploy API Gateway to LocalStack
    - Test gateway routing to backend APIs
    - _Requirements: 4.4, 5.3_
  
  - [ ]* 7.5 Write property test for include parameter
    - **Property 15: Include Parameter Embedding**
    - **Validates: Requirements 4.4, 5.3**
  
  - [ ]* 7.6 Write integration tests for gateway aggregation
    - Test single relationship include via gateway
    - Test multiple relationship includes via gateway
    - Test cross-API includes via gateway
    - Test invalid relationship names
    - Test unavailable related resources
    - Test direct API access (without gateway) still works
    - _Requirements: 4.4, 5.3_

- [ ] 8. Generate and test mock servers
  - [x] 8.1 Generate mock servers from OpenAPI specs
    - Generate Taxpayer API mock server (e.g., using Prism)
    - Generate Income Tax API mock server
    - Generate Payment API mock server
    - Configure mock servers to run on different ports
    - _Requirements: 8.3, 8.4_
  
  - [x] 8.2 Create example data demonstrating cross-API relationships
    - Create example taxpayer with NINO and address
    - Create example tax returns linked to taxpayer
    - Create example payments linked to taxpayer and tax returns
    - Ensure all relationship URLs are correctly formed
    - _Requirements: 6.1, 6.5, 8.4_
  
  - [ ]* 8.3 Write property test for link resolution
    - **Property 10: Link Resolution**
    - **Validates: Requirements 5.3**
  
  - [ ]* 8.4 Write property test for relationship URL validity
    - **Property 14: Relationship URL Validity**
    - **Validates: Requirements 8.5**
  
  - [ ]* 8.5 Write unit tests for mock server functionality
    - Test that mock servers start successfully
    - Test that mock servers return valid responses
    - Test that relationship links are resolvable
    - _Requirements: 8.3_

- [x] 9. Checkpoint - Test mock servers and cross-API traversal
  - Start all three mock servers
  - Test GET /taxpayers/{id} returns valid response
  - Follow taxReturns link and verify response
  - Follow payments link and verify response
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 5.3, 8.3_

- [ ] 10. Generate API documentation
  - [x] 10.1 Generate documentation for each API
    - Generate Taxpayer API documentation (e.g., using Redoc)
    - Generate Income Tax API documentation
    - Generate Payment API documentation
    - Verify all endpoints, parameters, and schemas are documented
    - _Requirements: 7.1, 7.2_
  
  - [x] 10.2 Create getting started guide
    - Document the multi-API architecture
    - Explain the relationship structure and link format
    - Provide examples of cross-API traversal
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [ ]* 10.3 Write property test for documentation completeness
    - **Property 12: Documentation Completeness**
    - **Validates: Requirements 7.2**

- [ ] 11. Set up OAS Viewer/Executor
  - [x] 11.1 Configure Swagger UI or similar tool
    - Set up Swagger UI to load all three API specifications
    - Configure "Try it out" functionality
    - Enable cross-API navigation through relationship links
    - _Requirements: 7.1_
  
  - [x] 11.2 Test interactive API exploration
    - Test executing requests from Swagger UI
    - Test following relationship links interactively
    - Verify responses match OAS schemas
    - _Requirements: 7.1, 8.5_

- [ ] 12. Implement API servers (language-specific)
  - [x] 12.1 Choose implementation language and framework
    - Determine programming language (Python/TypeScript/Go/etc.)
    - Select web framework (FastAPI/Express/Gin/etc.)
    - Set up project structure for chosen stack
    - _Requirements: 1.1_
  
  - [x] 12.2 Implement Taxpayer API server
    - Implement all endpoints from taxpayer-api.yaml
    - Implement relationship link generation
    - Add in-memory data storage for POC
    - _Requirements: 1.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.5_
  
  - [ ]* 12.3 Write property test for Taxpayer API implementation
    - **Property 1: Domain API Uniqueness**
    - **Property 3: API Resource Isolation**
    - **Validates: Requirements 1.2, 1.3, 1.5**
  
  - [x] 12.4 Implement Income Tax API server
    - Implement all endpoints from income-tax-api.yaml
    - Implement relationship link generation
    - Add in-memory data storage for POC
    - _Requirements: 1.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.5_
  
  - [x] 12.5 Implement Payment API server
    - Implement all endpoints from payment-api.yaml
    - Implement relationship link generation
    - Add in-memory data storage for POC
    - _Requirements: 1.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.5_
  
  - [ ]* 12.6 Write property test for HTTP method support
    - **Property 8: HTTP Method Support**
    - **Validates: Requirements 4.5**
  
  - [ ]* 12.7 Write integration tests for cross-API traversal
    - Test following links from Taxpayer to Income Tax API
    - Test following links from Taxpayer to Payment API
    - Test following links from Income Tax to Payment API
    - Test bidirectional relationship links
    - _Requirements: 5.3, 5.4_

- [ ] 13. Implement error handling
  - [x] 13.1 Add error responses to all APIs
    - Implement 404 Not Found responses
    - Implement 400 Bad Request responses with validation details
    - Implement 502 Bad Gateway for cross-API errors
    - Ensure error responses match OAS specifications
    - _Requirements: 2.3_
  
  - [ ]* 13.2 Write unit tests for error handling
    - Test 404 for non-existent resources
    - Test 400 for invalid request data
    - Test 502 for unavailable upstream APIs
    - _Requirements: 2.3_

- [x] 14. Final checkpoint - End-to-end testing
  - Start all three API servers
  - Run full test suite (unit + property + integration)
  - Test complete cross-API traversal scenarios
  - Verify all relationship links resolve correctly
  - Test OAS Viewer/Executor with real APIs
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation is OpenAPI-first: specifications are created and validated before implementation
- Mock servers enable testing the API design before writing implementation code
- The OAS Viewer/Executor provides interactive exploration and testing capabilities

