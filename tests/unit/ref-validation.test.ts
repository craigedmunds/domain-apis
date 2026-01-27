/**
 * $ref Reference Resolution Validation Tests
 *
 * Validates that all $ref references in OpenAPI specifications resolve correctly.
 */

import { loadSpec, findRefs, validateRefs } from '../helpers/openapi-validator';

describe('$ref Reference Resolution', () => {
  describe('Excise Duty System API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/vaping-duty/mocks/excise-api.yaml');
    });

    it('should have all $ref references resolvable', () => {
      const result = validateRefs(spec);

      if (!result.valid) {
        console.log('Reference resolution errors:', result.errors);
      }

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have internal component references', () => {
      const refs = findRefs(spec);
      const internalRefs = Array.from(refs).filter((ref) => ref.startsWith('#/'));

      expect(internalRefs.length).toBeGreaterThan(0);
    });

    it('should reference Registration schema', () => {
      const refs = findRefs(spec);
      const registrationRefs = Array.from(refs).filter((ref) => ref.includes('Registration'));

      expect(registrationRefs.length).toBeGreaterThan(0);
    });

    it('should reference ValidationResponse schema', () => {
      const refs = findRefs(spec);
      const validationRefs = Array.from(refs).filter((ref) => ref.includes('ValidationResponse'));

      expect(validationRefs.length).toBeGreaterThan(0);
    });

    // Note: Excise API uses XML with inline money definitions, no Money schema ref
    it.skip('should reference Money schema', () => {
      const refs = findRefs(spec);
      const moneyRefs = Array.from(refs).filter((ref) => ref.includes('Money'));

      expect(moneyRefs.length).toBeGreaterThan(0);
    });

    it('should reference Error schema', () => {
      const refs = findRefs(spec);
      const errorRefs = Array.from(refs).filter((ref) => ref.includes('Error'));

      expect(errorRefs.length).toBeGreaterThan(0);
    });
  });

  describe('Customer Master Data API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/vaping-duty/mocks/customer-api.yaml');
    });

    it('should have all $ref references resolvable', () => {
      const result = validateRefs(spec);

      if (!result.valid) {
        console.log('Reference resolution errors:', result.errors);
      }

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have internal component references', () => {
      const refs = findRefs(spec);
      const internalRefs = Array.from(refs).filter((ref) => ref.startsWith('#/'));

      expect(internalRefs.length).toBeGreaterThan(0);
    });

    it('should reference Customer schema', () => {
      const refs = findRefs(spec);
      const customerRefs = Array.from(refs).filter((ref) => ref.includes('Customer'));

      expect(customerRefs.length).toBeGreaterThan(0);
    });

    it('should reference Address schema', () => {
      const refs = findRefs(spec);
      const addressRefs = Array.from(refs).filter((ref) => ref.includes('Address'));

      expect(addressRefs.length).toBeGreaterThan(0);
    });
  });

  describe('Tax Platform Submissions API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/vaping-duty/mocks/tax-platform-api.yaml');
    });

    it('should have all $ref references resolvable', () => {
      const result = validateRefs(spec);

      if (!result.valid) {
        console.log('Reference resolution errors:', result.errors);
      }

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have internal component references', () => {
      const refs = findRefs(spec);
      const internalRefs = Array.from(refs).filter((ref) => ref.startsWith('#/'));

      expect(internalRefs.length).toBeGreaterThan(0);
    });

    it('should reference StoreRequest schema', () => {
      const refs = findRefs(spec);
      const storeRequestRefs = Array.from(refs).filter((ref) => ref.includes('StoreRequest'));

      expect(storeRequestRefs.length).toBeGreaterThan(0);
    });

    it('should reference StoreResponse schema', () => {
      const refs = findRefs(spec);
      const storeResponseRefs = Array.from(refs).filter((ref) => ref.includes('StoreResponse'));

      expect(storeResponseRefs.length).toBeGreaterThan(0);
    });

    it('should reference StoredSubmission schema', () => {
      const refs = findRefs(spec);
      const storedSubmissionRefs = Array.from(refs).filter((ref) =>
        ref.includes('StoredSubmission')
      );

      expect(storedSubmissionRefs.length).toBeGreaterThan(0);
    });

    it('should reference Money schema', () => {
      const refs = findRefs(spec);
      const moneyRefs = Array.from(refs).filter((ref) => ref.includes('Money'));

      expect(moneyRefs.length).toBeGreaterThan(0);
    });

    it('should reference Warning schema', () => {
      const refs = findRefs(spec);
      const warningRefs = Array.from(refs).filter((ref) => ref.includes('Warning'));

      expect(warningRefs.length).toBeGreaterThan(0);
    });

    it('should reference parameter components', () => {
      const refs = findRefs(spec);
      const parameterRefs = Array.from(refs).filter((ref) => ref.includes('parameters/'));

      expect(parameterRefs.length).toBeGreaterThan(0);
    });

    it('should reference header components', () => {
      const refs = findRefs(spec);
      const headerRefs = Array.from(refs).filter((ref) => ref.includes('headers/'));

      expect(headerRefs.length).toBeGreaterThan(0);
    });
  });

  // Phase 2: VPD Domain API specs - skipped until files are created
  describe.skip('VPD Domain API - Platform', () => {
    it('should have all $ref references resolvable', () => {
      const spec = loadSpec('specs/vaping-duty/domain/platform/vpd-submission-returns-api.yaml');
      const result = validateRefs(spec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Cross-spec reference consistency', () => {
    it('should use consistent schema naming patterns', () => {
      const exciseSpec = loadSpec('specs/vaping-duty/mocks/excise-api.yaml');
      const customerSpec = loadSpec('specs/vaping-duty/mocks/customer-api.yaml');
      const taxPlatformSpec = loadSpec('specs/vaping-duty/mocks/tax-platform-api.yaml');

      // All specs should have Error schema
      expect(exciseSpec.components.schemas.Error).toBeDefined();
      expect(customerSpec.components.schemas.Error).toBeDefined();
      expect(taxPlatformSpec.components.schemas.Error).toBeDefined();

      // Error schemas should have consistent structure
      for (const spec of [exciseSpec, customerSpec, taxPlatformSpec]) {
        const errorSchema = spec.components.schemas.Error;
        expect(errorSchema.required).toContain('code');
        expect(errorSchema.required).toContain('message');
        expect(errorSchema.properties.code).toBeDefined();
        expect(errorSchema.properties.message).toBeDefined();
      }
    });

    it('should have consistent Money schema where used', () => {
      // Note: Excise API uses XML with inline money definitions, so only check tax-platform
      const taxPlatformSpec = loadSpec('specs/vaping-duty/mocks/tax-platform-api.yaml');

      const moneySchema = taxPlatformSpec.components.schemas.Money;
      expect(moneySchema).toBeDefined();
      expect(moneySchema.required).toContain('amount');
      expect(moneySchema.required).toContain('currency');
      expect(moneySchema.properties.amount.type).toBe('number');
      expect(moneySchema.properties.currency.type).toBe('string');
    });
  });
});
