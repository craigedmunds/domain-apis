/**
 * Unit Tests for OpenAPI Specification Validation
 *
 * These tests verify that OpenAPI specifications are well-formed
 * and include required fields.
 */

import { loadSpec, hasRequiredFields, hasExamples, validateRefs } from '../helpers/openapi-validator';

describe('OpenAPI Specification Validation', () => {
  // Phase 2: VPD Domain API specs - skipped until files are created
  describe.skip('VPD Domain API - Platform', () => {
    const platformSpec = loadSpec('specs/vaping-duty/domain/platform/vpd-submission-returns-api.yaml');

    it('should have valid OpenAPI specification', () => {
      const result = hasRequiredFields(platformSpec);
      expect(result.valid).toBe(true);
    });

    it('should have OpenAPI 3.0+ version', () => {
      expect(platformSpec.openapi).toMatch(/^3\./);
    });

    it('should have info section with title and version', () => {
      expect(platformSpec.info.title).toBeDefined();
      expect(platformSpec.info.version).toBeDefined();
    });
  });

  describe.skip('VPD Domain API - Producer', () => {
    const producerSpec = loadSpec('specs/vaping-duty/domain/producer/vpd-submission-returns-api.yaml');

    it('should have valid OpenAPI specification', () => {
      const result = hasRequiredFields(producerSpec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Excise Duty System API (Mock)', () => {
    let exciseSpec: any;

    beforeAll(() => {
      exciseSpec = loadSpec('specs/vaping-duty/mocks/excise-api.yaml');
    });

    it('should have valid OpenAPI specification', () => {
      const result = hasRequiredFields(exciseSpec);

      if (!result.valid) {
        console.log('Validation errors:', result.errors);
      }

      expect(result.valid).toBe(true);
    });

    it('should have registration endpoint', () => {
      expect(exciseSpec.paths['/excise/vpd/registrations/{vpdApprovalNumber}']).toBeDefined();
      expect(exciseSpec.paths['/excise/vpd/registrations/{vpdApprovalNumber}'].get).toBeDefined();
    });

    it('should have period endpoint', () => {
      expect(exciseSpec.paths['/excise/vpd/periods/{periodKey}']).toBeDefined();
      expect(exciseSpec.paths['/excise/vpd/periods/{periodKey}'].get).toBeDefined();
    });

    it('should have validate-and-calculate endpoint', () => {
      expect(exciseSpec.paths['/excise/vpd/validate-and-calculate']).toBeDefined();
      expect(exciseSpec.paths['/excise/vpd/validate-and-calculate'].post).toBeDefined();
    });

    it('should have Registration schema with required fields', () => {
      const registration = exciseSpec.components.schemas.Registration;
      expect(registration).toBeDefined();
      expect(registration.required).toContain('vpdApprovalNumber');
      expect(registration.required).toContain('customerId');
      expect(registration.required).toContain('status');
    });

    it('should have ValidationResponse schema', () => {
      const validationResponse = exciseSpec.components.schemas.ValidationResponse;
      expect(validationResponse).toBeDefined();
      expect(validationResponse.required).toContain('valid');
      expect(validationResponse.required).toContain('customerId');
    });
  });

  describe('Customer Master Data API (Mock)', () => {
    let customerSpec: any;

    beforeAll(() => {
      customerSpec = loadSpec('specs/vaping-duty/mocks/customer-api.yaml');
    });

    it('should have valid OpenAPI specification', () => {
      const result = hasRequiredFields(customerSpec);

      if (!result.valid) {
        console.log('Validation errors:', result.errors);
      }

      expect(result.valid).toBe(true);
    });

    it('should have customer endpoint', () => {
      expect(customerSpec.paths['/customers/{customerId}']).toBeDefined();
      expect(customerSpec.paths['/customers/{customerId}'].get).toBeDefined();
    });

    it('should have Customer schema with required fields', () => {
      const customer = customerSpec.components.schemas.Customer;
      expect(customer).toBeDefined();
      expect(customer.required).toContain('customerId');
      expect(customer.required).toContain('name');
      expect(customer.required).toContain('type');
    });

    it('should have customer type enum', () => {
      const customer = customerSpec.components.schemas.Customer;
      expect(customer.properties.type.enum).toContain('ORG');
      expect(customer.properties.type.enum).toContain('INDIVIDUAL');
    });
  });

  describe('Tax Platform Submissions API (Mock)', () => {
    let taxPlatformSpec: any;

    beforeAll(() => {
      taxPlatformSpec = loadSpec('specs/vaping-duty/mocks/tax-platform-api.yaml');
    });

    it('should have valid OpenAPI specification', () => {
      const result = hasRequiredFields(taxPlatformSpec);

      if (!result.valid) {
        console.log('Validation errors:', result.errors);
      }

      expect(result.valid).toBe(true);
    });

    it('should have POST submission endpoint', () => {
      expect(taxPlatformSpec.paths['/submissions/vpd']).toBeDefined();
      expect(taxPlatformSpec.paths['/submissions/vpd'].post).toBeDefined();
    });

    it('should have GET submission by query endpoint', () => {
      expect(taxPlatformSpec.paths['/submissions/vpd'].get).toBeDefined();
    });

    it('should have GET submission by acknowledgement endpoint', () => {
      expect(taxPlatformSpec.paths['/submissions/vpd/{acknowledgementReference}']).toBeDefined();
      expect(taxPlatformSpec.paths['/submissions/vpd/{acknowledgementReference}'].get).toBeDefined();
    });

    it('should have StoreRequest schema with required fields', () => {
      const storeRequest = taxPlatformSpec.components.schemas.StoreRequest;
      expect(storeRequest).toBeDefined();
      expect(storeRequest.required).toContain('vpdApprovalNumber');
      expect(storeRequest.required).toContain('periodKey');
      expect(storeRequest.required).toContain('customerId');
      expect(storeRequest.required).toContain('submission');
      expect(storeRequest.required).toContain('calculations');
    });

    it('should have StoreResponse schema', () => {
      const storeResponse = taxPlatformSpec.components.schemas.StoreResponse;
      expect(storeResponse).toBeDefined();
      expect(storeResponse.required).toContain('acknowledgementReference');
      expect(storeResponse.required).toContain('storedAt');
    });

    it('should have StoredSubmission schema', () => {
      const storedSubmission = taxPlatformSpec.components.schemas.StoredSubmission;
      expect(storedSubmission).toBeDefined();
      expect(storedSubmission.required).toContain('acknowledgementReference');
      expect(storedSubmission.required).toContain('status');
    });

    it('should have X-Idempotency-Key parameter', () => {
      const idempotencyKey = taxPlatformSpec.components.parameters['X-Idempotency-Key'];
      expect(idempotencyKey).toBeDefined();
      expect(idempotencyKey.in).toBe('header');
      expect(idempotencyKey.required).toBe(true);
    });
  });
});
