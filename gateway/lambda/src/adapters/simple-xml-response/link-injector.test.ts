/**
 * Unit tests for Link Injector
 */

import { injectLinksFromConfig, constructUrl } from './link-injector';
import { ServiceConfig } from '../registry';

describe('Link Injector', () => {
  describe('injectLinksFromConfig', () => {
    it('should inject self link', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        amount: { amount: 7500.00, currency: 'GBP' }
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response']
      };

      const result = injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');

      expect(result._links).toBeDefined();
      expect(result._links.self).toEqual({
        href: '/dev/payment/payments/PM20230001'
      });
    });

    it('should inject single relationship link', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        taxpayerId: 'TP123456',
        amount: { amount: 7500.00, currency: 'GBP' }
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment'
          }
        }
      };

      const result = injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');

      expect(result._links.taxpayer).toEqual({
        href: '/dev/taxpayer/taxpayers/TP123456',
        type: 'taxpayer',
        title: 'Taxpayer who made this payment'
      });
    });

    it('should inject multiple relationship links', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        taxpayerId: 'TP123456',
        amount: { amount: 7500.00, currency: 'GBP' }
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment'
          },
          allocations: {
            targetApi: 'payment',
            targetResource: 'allocations',
            sourceField: 'id',
            urlPattern: '/payments/{id}/allocations',
            linkType: 'collection',
            linkTitle: 'Allocations for this payment'
          }
        }
      };

      const result = injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');

      expect(result._links.taxpayer).toBeDefined();
      expect(result._links.allocations).toBeDefined();
      expect(Object.keys(result._links)).toHaveLength(3); // self + 2 relationships
    });

    it('should use URL pattern for link construction when provided', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment'
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          allocations: {
            targetApi: 'payment',
            targetResource: 'allocations',
            sourceField: 'id',
            urlPattern: '/payments/{id}/allocations',
            linkType: 'collection',
            linkTitle: 'Allocations for this payment'
          }
        }
      };

      const result = injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');

      expect(result._links.allocations).toEqual({
        href: '/dev/payments/PM20230001/allocations',
        type: 'collection',
        title: 'Allocations for this payment'
      });
    });

    it('should skip relationship link if source field is missing', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment'
        // taxpayerId is missing
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment'
          }
        }
      };

      const result = injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');

      expect(result._links.self).toBeDefined();
      expect(result._links.taxpayer).toBeUndefined();
    });

    it('should skip relationship link if source field is null', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        taxpayerId: null
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment'
          }
        }
      };

      const result = injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');

      expect(result._links.self).toBeDefined();
      expect(result._links.taxpayer).toBeUndefined();
    });

    it('should not modify original resource', () => {
      const resource: any = {
        id: 'PM20230001',
        type: 'payment'
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response']
      };

      const result = injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');

      expect(resource._links).toBeUndefined();
      expect(result._links).toBeDefined();
      expect(result).not.toBe(resource);
    });

    it('should generate cross-API links correctly', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        taxpayerId: 'TP123456'
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment'
          }
        }
      };

      const result = injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');

      // Link should point to taxpayer API, not payment API
      expect(result._links.taxpayer.href).toBe('/dev/taxpayer/taxpayers/TP123456');
    });

    it('should include link metadata (type and title)', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        taxpayerId: 'TP123456'
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment'
          }
        }
      };

      const result = injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');

      expect(result._links.taxpayer.type).toBe('taxpayer');
      expect(result._links.taxpayer.title).toBe('Taxpayer who made this payment');
    });

    it('should throw error if resource has no id for self link', () => {
      const resource = {
        type: 'payment'
        // id is missing
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response']
      };

      expect(() => {
        injectLinksFromConfig(resource, config, 'dev', 'payment', 'payments');
      }).toThrow('Resource must have an id field for self link construction');
    });
  });

  describe('constructUrl', () => {
    it('should substitute single field placeholder', () => {
      const resource = { id: 'PM001' };
      const url = constructUrl('/payments/{id}', resource, 'dev');
      expect(url).toBe('/dev/payments/PM001');
    });

    it('should substitute multiple field placeholders', () => {
      const resource = { id: 'PM001', taxpayerId: 'TP123' };
      const url = constructUrl('/payments/{id}/taxpayer/{taxpayerId}', resource, 'dev');
      expect(url).toBe('/dev/payments/PM001/taxpayer/TP123');
    });

    it('should prepend stage to URL', () => {
      const resource = { id: 'PM001' };
      const url = constructUrl('/payments/{id}', resource, 'prod');
      expect(url).toBe('/prod/payments/PM001');
    });

    it('should not duplicate stage if already present', () => {
      const resource = { id: 'PM001' };
      const url = constructUrl('/dev/payments/{id}', resource, 'dev');
      expect(url).toBe('/dev/payments/PM001');
    });

    it('should handle numeric field values', () => {
      const resource = { id: 123 };
      const url = constructUrl('/payments/{id}', resource, 'dev');
      expect(url).toBe('/dev/payments/123');
    });

    it('should throw error if required field is missing', () => {
      const resource = { id: 'PM001' };
      expect(() => {
        constructUrl('/payments/{id}/taxpayer/{taxpayerId}', resource, 'dev');
      }).toThrow('Field "taxpayerId" required for URL construction is missing from resource');
    });

    it('should throw error if required field is null', () => {
      const resource = { id: 'PM001', taxpayerId: null };
      expect(() => {
        constructUrl('/payments/{id}/taxpayer/{taxpayerId}', resource, 'dev');
      }).toThrow('Field "taxpayerId" required for URL construction is missing from resource');
    });

    it('should handle complex URL patterns', () => {
      const resource = { 
        paymentId: 'PM001', 
        allocationId: 'AL001',
        year: 2023
      };
      const url = constructUrl('/payments/{paymentId}/allocations/{allocationId}/year/{year}', resource, 'dev');
      expect(url).toBe('/dev/payments/PM001/allocations/AL001/year/2023');
    });

    it('should handle URL patterns with no placeholders', () => {
      const resource = { id: 'PM001' };
      const url = constructUrl('/payments/summary', resource, 'dev');
      expect(url).toBe('/dev/payments/summary');
    });
  });
});
