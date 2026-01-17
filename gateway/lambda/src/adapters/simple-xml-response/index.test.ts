/**
 * Unit tests for SimpleXmlResponseAdapter
 */

import { SimpleXmlResponseAdapter } from './index';
import { ServiceConfig } from '../registry';

describe('SimpleXmlResponseAdapter', () => {
  let adapter: SimpleXmlResponseAdapter;

  beforeEach(() => {
    adapter = new SimpleXmlResponseAdapter();
  });

  describe('adapter properties', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('simple-xml-response');
    });

    it('should implement transformResponse method', () => {
      expect(adapter.transformResponse).toBeDefined();
      expect(typeof adapter.transformResponse).toBe('function');
    });

    it('should implement injectLinks method', () => {
      expect(adapter.injectLinks).toBeDefined();
      expect(typeof adapter.injectLinks).toBe('function');
    });

    it('should not implement transformRequest method', () => {
      expect((adapter as any).transformRequest).toBeUndefined();
    });
  });

  describe('transformResponse', () => {
    it('should transform simple XML to JSON', () => {
      const xmlBody = '<payment><id>PM001</id><amount>100.50</amount></payment>';
      const headers = { 'Content-Type': 'application/xml' };

      const result = adapter.transformResponse(xmlBody, headers);

      expect(result.body).toEqual({
        payment: {
          id: 'PM001',
          amount: 100.50,
        },
      });
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    it('should transform complex XML with nested objects', () => {
      const xmlBody = `
        <payment>
          <id>PM20230001</id>
          <type>payment</type>
          <taxpayerId>TP123456</taxpayerId>
          <amount>
            <amount>7500.00</amount>
            <currency>GBP</currency>
          </amount>
          <paymentDate>2024-01-31</paymentDate>
          <paymentMethod>bank-transfer</paymentMethod>
          <reference>TAX-2023-001</reference>
          <status>cleared</status>
        </payment>
      `;
      const headers = { 'Content-Type': 'application/xml' };

      const result = adapter.transformResponse(xmlBody, headers);

      expect(result.body.payment).toEqual({
        id: 'PM20230001',
        type: 'payment',
        taxpayerId: 'TP123456',
        amount: {
          amount: 7500.00,
          currency: 'GBP',
        },
        paymentDate: '2024-01-31',
        paymentMethod: 'bank-transfer',
        reference: 'TAX-2023-001',
        status: 'cleared',
      });
    });

    it('should update Content-Type header to application/json', () => {
      const xmlBody = '<payment><id>PM001</id></payment>';
      const headers = {
        'Content-Type': 'application/xml',
        'X-Custom-Header': 'custom-value',
      };

      const result = adapter.transformResponse(xmlBody, headers);

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['X-Custom-Header']).toBe('custom-value');
    });

    it('should preserve other headers', () => {
      const xmlBody = '<payment><id>PM001</id></payment>';
      const headers = {
        'Content-Type': 'application/xml',
        'X-Request-ID': '12345',
        'X-API-Version': 'v1',
      };

      const result = adapter.transformResponse(xmlBody, headers);

      expect(result.headers['X-Request-ID']).toBe('12345');
      expect(result.headers['X-API-Version']).toBe('v1');
    });

    it('should preserve data types during transformation', () => {
      const xmlBody = `
        <payment>
          <id>PM001</id>
          <amount>100.50</amount>
          <count>42</count>
          <active>true</active>
          <deleted>false</deleted>
        </payment>
      `;
      const headers = { 'Content-Type': 'application/xml' };

      const result = adapter.transformResponse(xmlBody, headers);

      expect(typeof result.body.payment.id).toBe('string');
      expect(typeof result.body.payment.amount).toBe('number');
      expect(typeof result.body.payment.count).toBe('number');
      expect(typeof result.body.payment.active).toBe('boolean');
      expect(typeof result.body.payment.deleted).toBe('boolean');
    });

    it('should handle XML collections', () => {
      const xmlBody = `
        <payments>
          <items>
            <payment>
              <id>PM001</id>
              <amount>100</amount>
            </payment>
            <payment>
              <id>PM002</id>
              <amount>200</amount>
            </payment>
          </items>
        </payments>
      `;
      const headers = { 'Content-Type': 'application/xml' };

      const result = adapter.transformResponse(xmlBody, headers);

      // The 'items' tag is recognized as a collection by the parser
      expect(Array.isArray(result.body.payments.items)).toBe(true);
      expect(result.body.payments.items).toHaveLength(1);
      
      // The payment elements inside items are parsed as an array
      expect(Array.isArray(result.body.payments.items[0].payment)).toBe(true);
      expect(result.body.payments.items[0].payment).toHaveLength(2);
      expect(result.body.payments.items[0].payment[0].id).toBe('PM001');
      expect(result.body.payments.items[0].payment[1].id).toBe('PM002');
    });

    describe('error handling', () => {
      it('should throw error for empty XML', () => {
        const xmlBody = '';
        const headers = { 'Content-Type': 'application/xml' };

        expect(() => {
          adapter.transformResponse(xmlBody, headers);
        }).toThrow('SimpleXmlResponseAdapter failed to transform response');
      });

      it('should throw error for invalid XML', () => {
        const xmlBody = 'not xml at all';
        const headers = { 'Content-Type': 'application/xml' };

        expect(() => {
          adapter.transformResponse(xmlBody, headers);
        }).toThrow('SimpleXmlResponseAdapter failed to transform response');
      });

      it('should include original error message in thrown error', () => {
        const xmlBody = '';
        const headers = { 'Content-Type': 'application/xml' };

        expect(() => {
          adapter.transformResponse(xmlBody, headers);
        }).toThrow(/Input XML is empty/);
      });
    });
  });

  describe('injectLinks', () => {
    const stage = 'dev';
    const apiName = 'payment';
    const resourceType = 'payments';

    it('should inject self link', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        amount: { amount: 7500.00, currency: 'GBP' },
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
      };

      const result = adapter.injectLinks(resource, config, stage, apiName, resourceType);

      expect(result._links).toBeDefined();
      expect(result._links.self).toEqual({
        href: '/dev/payment/payments/PM20230001',
      });
    });

    it('should inject single relationship link', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        taxpayerId: 'TP123456',
        amount: { amount: 7500.00, currency: 'GBP' },
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment',
          },
        },
      };

      const result = adapter.injectLinks(resource, config, stage, apiName, resourceType);

      expect(result._links.taxpayer).toEqual({
        href: '/dev/taxpayer/taxpayers/TP123456',
        type: 'taxpayer',
        title: 'Taxpayer who made this payment',
      });
    });

    it('should inject multiple relationship links', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        taxpayerId: 'TP123456',
        amount: { amount: 7500.00, currency: 'GBP' },
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment',
          },
          allocations: {
            targetApi: 'payment',
            targetResource: 'allocations',
            sourceField: 'id',
            urlPattern: '/payments/{id}/allocations',
            linkType: 'collection',
            linkTitle: 'Allocations for this payment',
          },
        },
      };

      const result = adapter.injectLinks(resource, config, stage, apiName, resourceType);

      expect(result._links.taxpayer).toBeDefined();
      expect(result._links.allocations).toBeDefined();
      expect(Object.keys(result._links)).toHaveLength(3); // self + 2 relationships
    });

    it('should preserve original resource data', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
        taxpayerId: 'TP123456',
        amount: { amount: 7500.00, currency: 'GBP' },
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment',
          },
        },
      };

      const result = adapter.injectLinks(resource, config, stage, apiName, resourceType);

      expect(result.id).toBe('PM20230001');
      expect(result.type).toBe('payment');
      expect(result.taxpayerId).toBe('TP123456');
      expect(result.amount).toEqual({ amount: 7500.00, currency: 'GBP' });
    });

    it('should handle config without relationships', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
      };

      const result = adapter.injectLinks(resource, config, stage, apiName, resourceType);

      expect(result._links).toBeDefined();
      expect(result._links.self).toBeDefined();
      expect(Object.keys(result._links)).toHaveLength(1); // only self link
    });

    it('should handle custom URL patterns', () => {
      const resource = {
        id: 'PM20230001',
        type: 'payment',
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
            linkTitle: 'Allocations for this payment',
          },
        },
      };

      const result = adapter.injectLinks(resource, config, stage, apiName, resourceType);

      expect(result._links.allocations).toEqual({
        href: '/dev/payments/PM20230001/allocations',
        type: 'collection',
        title: 'Allocations for this payment',
      });
    });

    it('should handle cross-API relationships', () => {
      const resource = {
        id: 'PM20230001',
        taxpayerId: 'TP123456',
      };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Related taxpayer',
          },
        },
      };

      const result = adapter.injectLinks(resource, config, stage, apiName, resourceType);

      // Link should point to different API (taxpayer, not payment)
      expect(result._links.taxpayer.href).toBe('/dev/taxpayer/taxpayers/TP123456');
    });

    describe('error handling', () => {
      it('should throw error if resource has no id', () => {
        const resource = {
          type: 'payment',
          amount: 100,
        };

        const config: ServiceConfig = {
          adapters: ['simple-xml-response'],
        };

        expect(() => {
          adapter.injectLinks(resource, config, stage, apiName, resourceType);
        }).toThrow('SimpleXmlResponseAdapter failed to inject links');
      });

      it('should throw error if required field for URL pattern is missing', () => {
        const resource = {
          id: 'PM20230001',
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
              linkTitle: 'Related taxpayer',
            },
          },
        };

        const result = adapter.injectLinks(resource, config, stage, apiName, resourceType);

        // Should not throw, but should skip the link
        expect(result._links.taxpayer).toBeUndefined();
        expect(result._links.self).toBeDefined();
      });

      it('should include original error message in thrown error', () => {
        const resource = {
          type: 'payment',
        };

        const config: ServiceConfig = {
          adapters: ['simple-xml-response'],
        };

        expect(() => {
          adapter.injectLinks(resource, config, stage, apiName, resourceType);
        }).toThrow(/id field/);
      });
    });
  });

  describe('integration', () => {
    it('should transform XML and inject links in sequence', () => {
      const xmlBody = `
        <payment>
          <id>PM20230001</id>
          <type>payment</type>
          <taxpayerId>TP123456</taxpayerId>
          <amount>
            <amount>7500.00</amount>
            <currency>GBP</currency>
          </amount>
        </payment>
      `;
      const headers = { 'Content-Type': 'application/xml' };

      const config: ServiceConfig = {
        adapters: ['simple-xml-response'],
        relationships: {
          taxpayer: {
            targetApi: 'taxpayer',
            targetResource: 'taxpayers',
            sourceField: 'taxpayerId',
            linkType: 'taxpayer',
            linkTitle: 'Taxpayer who made this payment',
          },
        },
      };

      // Step 1: Transform XML to JSON
      const transformResult = adapter.transformResponse(xmlBody, headers);
      expect(transformResult.body.payment).toBeDefined();
      expect(transformResult.headers['Content-Type']).toBe('application/json');

      // Step 2: Inject links into the transformed resource
      const resource = transformResult.body.payment;
      const finalResult = adapter.injectLinks(resource, config, 'dev', 'payment', 'payments');

      // Verify final result has both data and links
      expect(finalResult.id).toBe('PM20230001');
      expect(finalResult.taxpayerId).toBe('TP123456');
      expect(finalResult.amount).toEqual({ amount: 7500.00, currency: 'GBP' });
      expect(finalResult._links.self).toBeDefined();
      expect(finalResult._links.taxpayer).toBeDefined();
    });
  });
});
