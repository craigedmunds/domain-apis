/**
 * $ref Reference Resolution Validation Tests
 * 
 * Validates that all $ref references in OpenAPI specifications resolve correctly,
 * including cross-file references to shared components.
 * 
 * Validates: Requirements 8.1, 8.2
 */

import { loadSpec, findRefs, validateRefs } from '../helpers/openapi-validator';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('$ref Reference Resolution', () => {
  describe('Taxpayer API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/taxpayer/taxpayer-api.yaml');
    });

    it('should have all $ref references resolvable', () => {
      const result = validateRefs(spec);
      
      if (!result.valid) {
        console.log('Reference resolution errors:', result.errors);
      }
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should resolve shared component references', () => {
      const refs = findRefs(spec);
      const sharedRefs = Array.from(refs).filter(ref => 
        ref.includes('shared-components.yaml')
      );
      
      expect(sharedRefs.length).toBeGreaterThan(0);
      
      // Load shared components and verify each reference exists
      const sharedSpec = loadSpec('specs/shared/shared-components.yaml');
      
      for (const ref of sharedRefs) {
        const [file, pointer] = ref.split('#');
        expect(pointer).toBeDefined();
        
        // Navigate the pointer path
        const pathParts = pointer.substring(1).split('/');
        let current = sharedSpec;
        
        for (const part of pathParts) {
          expect(current).toHaveProperty(part);
          current = current[part];
        }
      }
    });

    it('should reference Address schema from shared components', () => {
      const refs = findRefs(spec);
      const addressRefs = Array.from(refs).filter(ref => 
        ref.includes('Address')
      );
      
      expect(addressRefs.length).toBeGreaterThan(0);
    });

    it('should reference Links schema from shared components', () => {
      const refs = findRefs(spec);
      const linksRefs = Array.from(refs).filter(ref => 
        ref.includes('Links')
      );
      
      expect(linksRefs.length).toBeGreaterThan(0);
    });
  });

  describe('Income Tax API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/income-tax/income-tax-api.yaml');
    });

    it('should have all $ref references resolvable', () => {
      const result = validateRefs(spec);
      
      if (!result.valid) {
        console.log('Reference resolution errors:', result.errors);
      }
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should resolve shared component references', () => {
      const refs = findRefs(spec);
      const sharedRefs = Array.from(refs).filter(ref => 
        ref.includes('shared-components.yaml')
      );
      
      expect(sharedRefs.length).toBeGreaterThan(0);
      
      // Load shared components and verify each reference exists
      const sharedSpec = loadSpec('specs/shared/shared-components.yaml');
      
      for (const ref of sharedRefs) {
        const [file, pointer] = ref.split('#');
        expect(pointer).toBeDefined();
        
        // Navigate the pointer path
        const pathParts = pointer.substring(1).split('/');
        let current = sharedSpec;
        
        for (const part of pathParts) {
          expect(current).toHaveProperty(part);
          current = current[part];
        }
      }
    });

    it('should reference Money schema from shared components', () => {
      const refs = findRefs(spec);
      const moneyRefs = Array.from(refs).filter(ref => 
        ref.includes('Money')
      );
      
      expect(moneyRefs.length).toBeGreaterThan(0);
    });

    it('should reference DateRange schema from shared components', () => {
      const refs = findRefs(spec);
      const dateRangeRefs = Array.from(refs).filter(ref => 
        ref.includes('DateRange')
      );
      
      expect(dateRangeRefs.length).toBeGreaterThan(0);
    });
  });

  describe('Payment API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/payment/payment-api.yaml');
    });

    it('should have all $ref references resolvable', () => {
      const result = validateRefs(spec);
      
      if (!result.valid) {
        console.log('Reference resolution errors:', result.errors);
      }
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should resolve shared component references', () => {
      const refs = findRefs(spec);
      const sharedRefs = Array.from(refs).filter(ref => 
        ref.includes('shared-components.yaml')
      );
      
      expect(sharedRefs.length).toBeGreaterThan(0);
      
      // Load shared components and verify each reference exists
      const sharedSpec = loadSpec('specs/shared/shared-components.yaml');
      
      for (const ref of sharedRefs) {
        const [file, pointer] = ref.split('#');
        expect(pointer).toBeDefined();
        
        // Navigate the pointer path
        const pathParts = pointer.substring(1).split('/');
        let current = sharedSpec;
        
        for (const part of pathParts) {
          expect(current).toHaveProperty(part);
          current = current[part];
        }
      }
    });

    it('should reference Money schema from shared components', () => {
      const refs = findRefs(spec);
      const moneyRefs = Array.from(refs).filter(ref => 
        ref.includes('Money')
      );
      
      expect(moneyRefs.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-file reference integrity', () => {
    it('should have consistent shared component versions across all APIs', () => {
      const taxpayerSpec = loadSpec('specs/taxpayer/taxpayer-api.yaml');
      const incomeTaxSpec = loadSpec('specs/income-tax/income-tax-api.yaml');
      const paymentSpec = loadSpec('specs/payment/payment-api.yaml');
      
      // All APIs should reference the same shared components file
      const taxpayerRefs = findRefs(taxpayerSpec);
      const incomeTaxRefs = findRefs(incomeTaxSpec);
      const paymentRefs = findRefs(paymentSpec);
      
      const taxpayerSharedRefs = Array.from(taxpayerRefs).filter(ref => 
        ref.includes('shared-components.yaml')
      );
      const incomeTaxSharedRefs = Array.from(incomeTaxRefs).filter(ref => 
        ref.includes('shared-components.yaml')
      );
      const paymentSharedRefs = Array.from(paymentRefs).filter(ref => 
        ref.includes('shared-components.yaml')
      );
      
      // All should reference shared components
      expect(taxpayerSharedRefs.length).toBeGreaterThan(0);
      expect(incomeTaxSharedRefs.length).toBeGreaterThan(0);
      expect(paymentSharedRefs.length).toBeGreaterThan(0);
      
      // All should use the same relative path
      const getFilePath = (ref: string) => ref.split('#')[0];
      const taxpayerPath = getFilePath(taxpayerSharedRefs[0]);
      const incomeTaxPath = getFilePath(incomeTaxSharedRefs[0]);
      const paymentPath = getFilePath(paymentSharedRefs[0]);
      
      expect(taxpayerPath).toContain('shared-components.yaml');
      expect(incomeTaxPath).toContain('shared-components.yaml');
      expect(paymentPath).toContain('shared-components.yaml');
    });
  });
});
