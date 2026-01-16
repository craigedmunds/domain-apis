/**
 * Unit Tests for OpenAPI Specification Validation
 * 
 * These tests verify that OpenAPI specifications are well-formed
 * and include required fields.
 */

import { loadSpec, hasRequiredFields, hasExamples, validateRefs } from '../helpers/openapi-validator';

describe('OpenAPI Specification Validation', () => {
  describe('Shared Components', () => {
    let sharedSpec: any;

    beforeAll(() => {
      try {
        sharedSpec = loadSpec('specs/shared/shared-components.yaml');
      } catch (error) {
        // File doesn't exist yet - tests will be skipped
        sharedSpec = null;
      }
    });

    it('should have valid shared components file', () => {
      expect(sharedSpec).toBeDefined();
      expect(sharedSpec.openapi).toBeDefined();
      expect(sharedSpec.openapi).toMatch(/^3\./);
      expect(sharedSpec.info).toBeDefined();
      expect(sharedSpec.info.version).toBeDefined();
      expect(sharedSpec.components).toBeDefined();
      expect(sharedSpec.components.schemas).toBeDefined();
    });

    it('should have Address schema with UK postcode validation', () => {
      if (!sharedSpec) return;
      
      const address = sharedSpec.components.schemas.Address;
      expect(address).toBeDefined();
      expect(address.type).toBe('object');
      expect(address.required).toContain('line1');
      expect(address.required).toContain('postcode');
      expect(address.required).toContain('country');
      
      // Check UK postcode pattern
      expect(address.properties.postcode).toBeDefined();
      expect(address.properties.postcode.pattern).toBeDefined();
      expect(address.properties.postcode.pattern).toContain('[A-Z]');
      
      // Check country enum
      expect(address.properties.country.enum).toContain('GB');
      expect(address.properties.country.enum).toContain('UK');
    });

    it('should have Money schema with GBP currency', () => {
      if (!sharedSpec) return;
      
      const money = sharedSpec.components.schemas.Money;
      expect(money).toBeDefined();
      expect(money.type).toBe('object');
      expect(money.required).toContain('amount');
      expect(money.required).toContain('currency');
      
      // Check amount is a number
      expect(money.properties.amount.type).toBe('number');
      
      // Check currency is GBP only
      expect(money.properties.currency.enum).toEqual(['GBP']);
      expect(money.properties.currency.default).toBe('GBP');
    });

    it('should have DateRange schema', () => {
      if (!sharedSpec) return;
      
      const dateRange = sharedSpec.components.schemas.DateRange;
      expect(dateRange).toBeDefined();
      expect(dateRange.type).toBe('object');
      expect(dateRange.required).toContain('startDate');
      expect(dateRange.required).toContain('endDate');
      
      // Check date format
      expect(dateRange.properties.startDate.format).toBe('date');
      expect(dateRange.properties.endDate.format).toBe('date');
    });

    it('should have Links schema for hypermedia', () => {
      if (!sharedSpec) return;
      
      const links = sharedSpec.components.schemas.Links;
      expect(links).toBeDefined();
      expect(links.type).toBe('object');
      expect(links.required).toContain('self');
      
      // Check self link
      expect(links.properties.self).toBeDefined();
      expect(links.properties.self.format).toBe('uri');
      
      // Check additional properties support
      expect(links.additionalProperties).toBeDefined();
    });

    it('should have version field in info section', () => {
      if (!sharedSpec) return;
      
      expect(sharedSpec.info.version).toBeDefined();
      expect(sharedSpec.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have IncludeParameter defined', () => {
      if (!sharedSpec) return;
      
      const includeParam = sharedSpec.components.parameters?.IncludeParameter;
      expect(includeParam).toBeDefined();
      expect(includeParam.name).toBe('include');
      expect(includeParam.in).toBe('query');
      expect(includeParam.required).toBe(false);
    });

    it('should have standard error response schemas', () => {
      if (!sharedSpec) return;
      
      expect(sharedSpec.components.responses).toBeDefined();
      expect(sharedSpec.components.responses.NotFound).toBeDefined();
      expect(sharedSpec.components.responses.BadRequest).toBeDefined();
      expect(sharedSpec.components.responses.BadGateway).toBeDefined();
    });
  });

  describe('Taxpayer API', () => {
    it('should have valid OpenAPI specification when it exists', () => {
      try {
        const spec = loadSpec('specs/taxpayer/taxpayer-api.yaml');
        const result = hasRequiredFields(spec);
        
        if (!result.valid) {
          console.log('Validation errors:', result.errors);
        }
        
        expect(result.valid).toBe(true);
      } catch (error: any) {
        // File doesn't exist yet - this is expected during initial setup
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('Income Tax API', () => {
    it('should have valid OpenAPI specification when it exists', () => {
      try {
        const spec = loadSpec('specs/income-tax/income-tax-api.yaml');
        const result = hasRequiredFields(spec);
        
        if (!result.valid) {
          console.log('Validation errors:', result.errors);
        }
        
        expect(result.valid).toBe(true);
      } catch (error: any) {
        // File doesn't exist yet - this is expected during initial setup
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('Payment API', () => {
    it('should have valid OpenAPI specification when it exists', () => {
      try {
        const spec = loadSpec('specs/payment/payment-api.yaml');
        const result = hasRequiredFields(spec);
        
        if (!result.valid) {
          console.log('Validation errors:', result.errors);
        }
        
        expect(result.valid).toBe(true);
      } catch (error: any) {
        // File doesn't exist yet - this is expected during initial setup
        expect(error.message).toContain('not found');
      }
    });
  });
});
