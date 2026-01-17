# Implementation Tasks

## Overview

This document outlines the implementation tasks for the simple-xml-response-adapter feature. Tasks are organized into phases that build upon each other, starting with foundational infrastructure and progressing to full feature implementation.

## Task List

### Phase 1: Adapter Infrastructure

- [x] 1.1 Create adapter registry and interface
  - Create `gateway/lambda/src/adapters/registry.ts` with Adapter interface
  - Implement AdapterRegistry class with register/get/getAll methods
  - Export global adapterRegistry instance
  - Add TypeScript types for adapter methods (transformRequest, transformResponse, injectLinks)

- [x] 1.2 Create service configuration loader
  - Create `gateway/lambda/src/config/service-config.ts`
  - Implement loadServiceConfig() function to read service.yaml files
  - Add ServiceConfig and RelationshipConfig TypeScript interfaces
  - Add error handling for missing or malformed configuration files
  - Cache loaded configurations in memory

- [x] 1.3 Write unit tests for adapter registry
  - Test adapter registration
  - Test adapter retrieval by name
  - Test getAll() returns all registered adapters
  - Test handling of duplicate adapter names

- [x] 1.4 Write unit tests for service configuration loader
  - Test loading valid service.yaml files
  - Test handling of missing files
  - Test handling of malformed YAML
  - Test configuration caching

### Phase 2: XML Transformation Module

- [x] 2.1 Create XML-JSON transformer
  - Create `gateway/lambda/src/adapters/simple-xml-response/transformer.ts`
  - Implement transformToJson() using fast-xml-parser
  - Configure parser options (attributes, text nodes, type parsing)
  - Handle XML collections (multiple items)
  - Preserve data types (numbers, booleans, dates)

- [x] 2.2 Create link injector
  - Create `gateway/lambda/src/adapters/simple-xml-response/link-injector.ts`
  - Implement injectLinksFromConfig() function
  - Implement constructUrl() for URL pattern substitution
  - Add self link injection
  - Add relationship link injection based on configuration

- [x] 2.3 Write unit tests for XML-JSON transformer
  - Test simple object transformation
  - Test nested object transformation
  - Test array transformation
  - Test XML collections
  - Test data type preservation (numbers, booleans, dates)
  - Test special character handling
  - Test empty objects and arrays
  - Test null/undefined values

- [x] 2.4 Write unit tests for link injector
  - Test self link injection
  - Test single relationship link injection
  - Test multiple relationship links
  - Test URL pattern substitution with field values
  - Test cross-API link generation
  - Test link metadata (type, title)

- [ ] 2.5 Write property-based test for XML-JSON transformation correctness
  **Validates: Requirements 7.1, 7.2, 7.4, 7.5**
  - Generate random valid JSON resources
  - Transform to XML and back to JSON
  - Assert structural equivalence
  - Run minimum 100 iterations

### Phase 3: SimpleXmlResponseAdapter Implementation

- [ ] 3.1 Implement SimpleXmlResponseAdapter class
  - Create `gateway/lambda/src/adapters/simple-xml-response/index.ts`
  - Implement Adapter interface
  - Implement transformResponse() method
  - Implement injectLinks() method
  - Update Content-Type headers in response

- [ ] 3.2 Register SimpleXmlResponseAdapter in gateway
  - Import SimpleXmlResponseAdapter in main Lambda handler
  - Register adapter with adapterRegistry on initialization
  - Add adapter detection logic in request handler

- [ ] 3.3 Write unit tests for SimpleXmlResponseAdapter
  - Test transformResponse() with XML input
  - Test Content-Type header transformation
  - Test injectLinks() integration
  - Test error handling for invalid XML

- [ ] 3.4 Write property-based test for adapter detection consistency
  **Validates: Requirements 1.1, 1.2, 2.3**
  - Generate random API paths and service configurations
  - Verify consistent adapter detection
  - Run minimum 100 iterations

### Phase 4: Gateway Integration

- [ ] 4.1 Add adapter detection to gateway request handler
  - Implement detectAdapter() function
  - Load service configuration for requested API
  - Check if simple-xml-response adapter is configured
  - Return AdapterContext with configuration

- [ ] 4.2 Integrate adapter in backend request flow
  - Get adapter from registry based on configuration
  - Call transformRequest() if adapter provides it (not needed for simple-xml-response)
  - Update request headers for XML backends

- [ ] 4.3 Integrate adapter in backend response flow
  - Call transformResponse() after receiving backend response
  - Call injectLinks() after transformation
  - Update response headers

- [ ] 4.4 Write integration tests for gateway adapter flow
  - Test request routing to XML backend
  - Test response transformation end-to-end
  - Test link injection with real responses
  - Test error handling for transformation failures

- [ ] 4.5 Write property-based test for HTTP Content-Type handling
  **Validates: Requirements 1.3, 1.4**
  - Generate random requests to XML-backed APIs
  - Verify backend receives correct Accept header
  - Verify client receives application/json Content-Type
  - Run minimum 100 iterations

### Phase 5: Payment API Configuration

- [ ] 5.1 Create Payment API service configuration
  - Create `specs/payment/service.yaml`
  - Add simple-xml-response to adapters array
  - Define taxpayer relationship configuration
  - Define allocations relationship configuration

- [ ] 5.2 Update Payment API mock backend for XML
  - Modify mock server to return XML responses
  - Ensure XML structure matches OAS schema
  - Test XML response format manually

- [ ] 5.3 Write property-based test for OAS schema conformance
  **Validates: Requirements 1.5, 4.2**
  - Generate random XML backend responses
  - Transform to JSON and inject links
  - Validate against Payment API OAS schema
  - Run minimum 100 iterations

- [ ] 5.4 Write property-based test for link injection completeness
  **Validates: Requirements 3.2, 3.4, 6.1, 6.5**
  - Generate random resources with N configured relationships
  - Verify exactly N+1 links (N relationships + self)
  - Run minimum 100 iterations

### Phase 6: Include Parameter Support

- [ ] 6.1 Extend include parameter handler for XML backends
  - Detect if included resource comes from XML backend
  - Apply XML transformation to included resources
  - Inject links for included resources
  - Aggregate in _included section

- [ ] 6.2 Write integration tests for include parameter with XML
  - Test single include with XML backend
  - Test multiple includes with XML backend
  - Test cross-API includes (JSON → XML)
  - Test cross-API includes (XML → JSON)

- [ ] 6.3 Write property-based test for include parameter parity
  **Validates: Requirements 4.4, 5.1, 5.2, 5.3**
  - Generate random include parameter values
  - Compare XML-backed vs JSON-backed responses
  - Verify identical structure and content
  - Run minimum 100 iterations

- [ ] 6.4 Write property-based test for cross-API include routing
  **Validates: Requirements 5.4**
  - Generate random cross-API include parameters
  - Verify correct backend API is called
  - Verify correct transformation is applied
  - Run minimum 100 iterations

### Phase 7: Error Handling

- [ ] 7.1 Implement transformation error handling
  - Catch XML parsing errors
  - Return 502 Bad Gateway with descriptive error
  - Log transformation errors with context
  - Include error details in response body

- [ ] 7.2 Implement configuration error handling
  - Detect malformed service.yaml at load time
  - Log configuration errors
  - Return 502 if transformation required but config invalid
  - Fall back to pass-through if possible

- [ ] 7.3 Implement backend error handling
  - Transform XML error responses to JSON
  - Preserve HTTP status codes from backend
  - Forward error details to client

- [ ] 7.4 Write unit tests for error handling
  - Test transformation error responses
  - Test configuration error handling
  - Test backend error transformation
  - Test partial include failures

### Phase 8: Acceptance Testing

- [ ] 8.1 Write acceptance test for Payment API with XML backend
  - Fetch payment resource
  - Verify JSON response matches OAS
  - Verify _links are present and correct
  - Follow taxpayer link
  - Use include parameter
  - Compare with JSON backend behavior

- [ ] 8.2 Write acceptance test for cross-API traversal
  - Start at Taxpayer API (JSON backend)
  - Follow payment link to Payment API (XML backend)
  - Verify seamless traversal
  - Verify response structure

- [ ] 8.3 Write acceptance test for include parameter with XML
  - Request payment with include=taxpayer
  - Verify taxpayer is fetched and included
  - Verify response structure matches JSON backend
  - Test collection endpoints with include

- [ ] 8.4 Write acceptance test for collection endpoints
  - List payments from XML backend
  - Verify collection structure
  - Use include parameter on collection
  - Verify _included at collection level

- [ ] 8.5 Write property-based test for backend indistinguishability
  **Validates: Requirements 4.1, 4.5**
  - Generate equivalent data for XML and JSON backends
  - Fetch from both backends
  - Verify responses are structurally identical
  - Run minimum 100 iterations

- [ ] 8.6 Write property-based test for URL construction correctness
  **Validates: Requirements 3.3, 6.2**
  - Generate random field values and URL patterns
  - Verify correct URL construction with stage prefix
  - Verify field substitution works correctly
  - Run minimum 100 iterations

- [ ] 8.7 Write property-based test for cross-API link routing
  **Validates: Requirements 3.5, 6.3**
  - Generate random cross-API relationships
  - Verify links route to correct API base path
  - Run minimum 100 iterations

- [ ] 8.8 Write property-based test for link metadata preservation
  **Validates: Requirements 6.4**
  - Generate random relationship configurations with metadata
  - Verify linkType and linkTitle are present in injected links
  - Run minimum 100 iterations

- [ ] 8.9 Write property-based test for bidirectional relationship traversal
  **Validates: Requirements 3.5**
  - Generate random bidirectional relationships (A→B, B→A)
  - Verify both link directions work with XML backends
  - Run minimum 100 iterations

### Phase 9: Documentation and Cleanup

- [ ] 9.1 Add adapter development guide
  - Create `gateway/lambda/src/adapters/README.md`
  - Document adapter interface
  - Provide examples for creating new adapters
  - Document adapter registration process

- [ ] 9.2 Update gateway documentation
  - Document XML backend support
  - Document service.yaml configuration format
  - Add examples for common scenarios
  - Document error responses

- [ ] 9.3 Add inline code documentation
  - Add JSDoc comments to adapter interface
  - Add JSDoc comments to public functions
  - Document configuration schema
  - Document transformation behavior

- [ ] 9.4 Performance testing and optimization
  - Measure transformation overhead
  - Profile XML parsing performance
  - Optimize hot paths if needed
  - Document performance characteristics

## Task Dependencies

```
Phase 1 (Infrastructure)
  ↓
Phase 2 (XML Transformation)
  ↓
Phase 3 (Adapter Implementation)
  ↓
Phase 4 (Gateway Integration)
  ↓
Phase 5 (Payment API Config) + Phase 6 (Include Support)
  ↓
Phase 7 (Error Handling)
  ↓
Phase 8 (Acceptance Testing)
  ↓
Phase 9 (Documentation)
```

## Testing Strategy Summary

- **Unit Tests**: Test individual functions and modules in isolation
- **Property-Based Tests**: Verify correctness properties hold across random inputs (minimum 100 iterations each)
- **Integration Tests**: Test component interactions with mock backends
- **Acceptance Tests**: End-to-end validation from client perspective

## Notes

- All property-based tests must run minimum 100 iterations
- Each property test validates specific requirements (noted in task descriptions)
- Tests should be written before implementation (TDD approach)
- All tests must pass before moving to next phase
