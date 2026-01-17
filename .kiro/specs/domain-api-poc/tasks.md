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
    - Define server URL: /taxpayer/v1
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
    - Define server URL: /income-tax/v1
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
    - Define server URL: /payment/v1
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
  
  - [x] 7.2 Set up LocalStack for local development
    - Create docker-compose.yml with LocalStack service
    - Configure LocalStack for API Gateway and Lambda services
    - Add backend mock API services to docker-compose
    - Create tools/localstack-init.sh initialization script with custom API ID
    - Configure gateway to use execute-api.localhost.localstack.cloud domain format
    - Update OpenAPI specs to include correct gateway server URL
    - Add Taskfile tasks for gateway management (start, stop, init, logs, status)
    - Verify gateway is accessible at clean URL (e.g., http://domain-api.execute-api.localhost.localstack.cloud:4566/dev/taxpayers)
    - _Requirements: 8.3_
  
  - [x] 7.3 Create aggregation Lambda function
    - Set up Lambda project structure (TypeScript/Node.js)
    - Implement request routing to backend APIs
    - Implement include parameter parsing
    - Implement parallel fetching of related resources
    - Implement response merging into _included structure
    - Implement URL rewriting in _links to point through gateway
    - Rewrite backend API URLs (localhost:8081/8082/8083) to gateway URL
    - Add CORS headers to Lambda responses for browser compatibility
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
  
  - [x] 7.6 Write acceptance tests for gateway API
    - Create tests/acceptance/gateway/gateway-api.spec.ts
    - Test direct API invocation (without include parameter)
    - Test API invocation with single include parameter
    - Test API invocation with multiple include parameters
    - Test cross-API resource traversal via includes
    - Test error handling for invalid includes
    - Test URL rewriting in _links field
    - Test that _links always point through gateway
    - _Requirements: 4.4, 5.3, 9.1, 9.5, 9.7_

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
  
  - [x] 11.3 Create acceptance test project
    - Create `tests/acceptance` directory within repository
    - Initialize separate Playwright project with `npm init` in tests/acceptance
    - Install Playwright and dependencies in tests/acceptance (separate from main project)
    - Create playwright.config.js with baseURL pointing to local server
    - Organize tests into subdirectories: ui/ for UI tests, gateway/ for API tests
    - Write acceptance tests for API explorer in tests/acceptance/ui/api-explorer.spec.ts
    - Write acceptance tests for documentation site in tests/acceptance/ui/documentation.spec.ts
    - Add npm scripts for running acceptance tests
    - Update main project documentation with instructions for running acceptance tests
    - _Requirements: 7.1, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

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
  - Run acceptance tests from tests/acceptance
  - Ensure all tests pass (unit + property + integration + acceptance)
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: All, 9.7_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation is OpenAPI-first: specifications are created and validated before implementation
- Mock servers enable testing the API design before writing implementation code
- The OAS Viewer/Executor provides interactive exploration and testing capabilities



- [x] 15. Kubernetes deployment
  - [x] 15.1 Create custom LocalStack gateway image
    - Create gateway/Dockerfile extending localstack/localstack:latest
    - Install Node.js and npm in image
    - Copy Lambda function source to /opt/lambda
    - Build Lambda function (npm install && npm run build)
    - Create aggregation-lambda.zip in image
    - Copy init script to /etc/localstack/init/ready.d/deploy-lambda.sh
    - Set environment variables (LAMBDA_EXECUTOR=local, SERVICES=apigateway,lambda,iam)
    - Test image builds successfully
    - _Requirements: 10.2, 10.3, 10.10, 10.11_
  
  - [x] 15.2 Create custom documentation server image
    - Create docs/Dockerfile extending halverneus/static-file-server:latest
    - Generate documentation (npm run docs)
    - Copy docs/ to /web in image
    - Copy specs/ to /web/specs in image
    - Set environment variables (FOLDER=/web, PORT=8080, SHOW_LISTING=true)
    - Test image builds successfully
    - _Requirements: 10.4, 10.10_
  
  - [x] 15.3 Create namespace manifests
    - Create kustomize/base/gateway/namespace.yaml (domain-api namespace with gh-docker-registry label)
    - Create kustomize/base/taxpayer-api/namespace.yaml (domain-api-taxpayer namespace)
    - Create kustomize/base/income-tax-api/namespace.yaml (domain-api-income-tax namespace)
    - Create kustomize/base/payment-api/namespace.yaml (domain-api-payment namespace)
    - _Requirements: 10.1, 10.8_
  
  - [x] 15.4 Create gateway deployment manifests
    - Create kustomize/base/gateway/deployment.yaml
    - Configure LocalStack container with custom image
    - Set environment variables for backend API URLs (fully qualified: taxpayer-api.domain-api-taxpayer.svc.cluster.local)
    - Configure liveness and readiness probes (/_localstack/health)
    - Add imagePullSecrets for gh-docker-registry-creds
    - Create kustomize/base/gateway/service.yaml (port 80 → targetPort 4566)
    - _Requirements: 10.1, 10.2, 10.9_
  
  - [x] 15.5 Create API service deployment manifests
    - Create kustomize/base/taxpayer-api/deployment.yaml (Prism with -p 80)
    - Create kustomize/base/taxpayer-api/service.yaml (port 80)
    - Create ConfigMap for taxpayer-api.yaml spec
    - Create kustomize/base/income-tax-api/deployment.yaml (Prism with -p 80)
    - Create kustomize/base/income-tax-api/service.yaml (port 80)
    - Create ConfigMap for income-tax-api.yaml spec
    - Create kustomize/base/payment-api/deployment.yaml (Prism with -p 80)
    - Create kustomize/base/payment-api/service.yaml (port 80)
    - Create ConfigMap for payment-api.yaml spec
    - Configure liveness and readiness probes for all APIs
    - _Requirements: 10.1, 10.3, 10.9_
  
  - [x] 15.6 Create documentation service deployment manifests
    - Create kustomize/base/docs/deployment.yaml with custom docs image
    - Add imagePullSecrets for gh-docker-registry-creds
    - Configure liveness and readiness probes
    - Create kustomize/base/docs/service.yaml (port 80 → targetPort 8080)
    - _Requirements: 10.1, 10.4, 10.9_
  
  - [x] 15.7 Create standard ingress configuration
    - Create kustomize/base/ingress/kustomization.yaml
    - Configure traefik-ingress Helm chart from workspace-shared/helm
    - Set helmGlobals.chartHome to ../../libs/workspace-shared/helm (relative to kustomize/base)
    - Configure global values (domains.localDomainSuffix: lab.local.ctoaas.co, tls.enabled: true, tls.issuer: letsencrypt-prod)
    - Add gateway ingress configuration (service: gateway, namespace: domain-api, accessPattern: internal, domains.name: domain-api)
    - Add docs ingress configuration (service: docs, namespace: domain-api, accessPattern: internal, domains.name: domain-api-docs)
    - Remove old IngressRoute CRD files (gateway-ingress.yaml, docs-ingress.yaml)
    - _Requirements: 10.5, 10.6, 10.7, 10.10, 10.11_
  
  - [x] 15.8 Create kustomization.yaml
    - Create kustomize/base/kustomization.yaml
    - Add all namespace resources
    - Add all deployment and service resources
    - Add ingress component (ingress/)
    - Configure configMapGenerator for API specs (with namespace)
    - Configure images for gateway and docs
    - _Requirements: 10.1_
  
  - [x] 15.9 Create ArgoCD Application manifest
    - Create k8s-lab/other-seeds/domain-api.yaml in k8s-lab repo
    - Configure source to point to domain-apis repo (path: kustomize/base)
    - Configure destination namespace (domain-api)
    - Enable automated sync with prune and selfHeal
    - Add CreateNamespace syncOption
    - _Requirements: 10.7_
  
  - [x] 15.10 Create Taskfile tasks for k8s operations
    - Add k8s:build:gateway task (build LocalStack image)
    - Add k8s:build:docs task (generate docs, build docs image)
    - Add k8s:build task (build both images)
    - Add k8s:push:gateway task (push gateway image to GHCR)
    - Add k8s:push:docs task (push docs image to GHCR)
    - Add k8s:push task (push both images)
    - Add k8s:apply task (kubectl apply -k kustomize/base)
    - Add k8s:delete task (kubectl delete -k kustomize/base)
    - Add k8s:status task (show all resources in domain-api namespaces)
    - Add k8s:logs:gateway task (follow gateway logs)
    - Add k8s:logs:taxpayer task (follow taxpayer API logs)
    - Add k8s:port-forward:gateway task (port-forward 4566:80)
    - Add k8s:port-forward:docs task (port-forward 8080:80)
    - Add k8s:test:acceptance task (port-forward and run acceptance tests)
    - Add k8s:restart:gateway task (rollout restart gateway)
    - Add k8s:describe:gateway task (describe gateway deployment and pods)
    - _Requirements: 10.12_
  
  - [x] 15.11 Test k8s deployment locally
    - Build gateway and docs images (task k8s:build)
    - Push images to GHCR (task k8s:push)
    - Apply manifests to k8s cluster (task k8s:apply)
    - Verify all pods are running (task k8s:status)
    - Test gateway via port-forward (task k8s:port-forward:gateway)
    - Test docs via port-forward (task k8s:port-forward:docs)
    - Run acceptance tests against k8s deployment (task k8s:test:acceptance)
    - Verify ingress is accessible at domain-api.lab.local.ctoaas.co
    - Verify docs are accessible at domain-api-docs.lab.local.ctoaas.co
    - _Requirements: 10.11, 10.12_
  
  - [x] 15.12 Deploy via ArgoCD
    - Commit and push all k8s manifests to git
    - Apply ArgoCD Application manifest to k8s-lab
    - Verify ArgoCD syncs successfully
    - Monitor deployment via ArgoCD UI
    - Test gateway via ingress URL
    - Test docs via ingress URL
    - Run acceptance tests against ingress URL (BASE_URL=https://domain-api.lab.local.ctoaas.co)
    - _Requirements: 10.7, 10.11_
  
  - [x] 15.13 Fix deployment issues
    - Add shared-components.yaml to ConfigMaps for all three API services
    - Mount shared components at /shared/shared-components.yaml in all Prism containers
    - Update API spec $ref paths to use /shared/shared-components.yaml
    - Verify gateway image exists in GHCR or build and push it
    - Verify docs image exists in GHCR or build and push it
    - Test all pods start successfully
    - Verify Prism containers can resolve $ref to shared components
    - _Requirements: 10.3, 10.4, 10.9_

