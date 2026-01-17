/**
 * Unit tests for XML-JSON Transformer
 */

import { transformToJson, transformToXml, normalizeCollection } from './transformer';

describe('XML-JSON Transformer', () => {
  describe('transformToJson', () => {
    describe('simple object transformation', () => {
      it('should transform simple XML to JSON', () => {
        const xml = '<payment><id>PM001</id><amount>100.50</amount></payment>';
        const result = transformToJson(xml);
        
        expect(result).toEqual({
          payment: {
            id: 'PM001',
            amount: 100.50,
          },
        });
      });

      it('should transform XML with multiple fields', () => {
        const xml = `
          <payment>
            <id>PM20230001</id>
            <type>payment</type>
            <taxpayerId>TP123456</taxpayerId>
            <reference>TAX-2023-001</reference>
            <status>cleared</status>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment).toEqual({
          id: 'PM20230001',
          type: 'payment',
          taxpayerId: 'TP123456',
          reference: 'TAX-2023-001',
          status: 'cleared',
        });
      });
    });

    describe('nested object transformation', () => {
      it('should transform nested XML objects', () => {
        const xml = `
          <payment>
            <id>PM001</id>
            <amount>
              <amount>7500.00</amount>
              <currency>GBP</currency>
            </amount>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment).toEqual({
          id: 'PM001',
          amount: {
            amount: 7500.00,
            currency: 'GBP',
          },
        });
      });

      it('should transform deeply nested structures', () => {
        const xml = `
          <payment>
            <id>PM001</id>
            <details>
              <amount>
                <value>100</value>
                <currency>GBP</currency>
              </amount>
              <metadata>
                <source>online</source>
              </metadata>
            </details>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.details).toEqual({
          amount: {
            value: 100,
            currency: 'GBP',
          },
          metadata: {
            source: 'online',
          },
        });
      });
    });

    describe('array transformation', () => {
      it('should transform XML with multiple child elements as array', () => {
        const xml = `
          <payments>
            <payment>
              <id>PM001</id>
            </payment>
            <payment>
              <id>PM002</id>
            </payment>
          </payments>
        `;
        const result = transformToJson(xml);
        
        expect(Array.isArray(result.payments.payment)).toBe(true);
        expect(result.payments.payment).toHaveLength(2);
        expect(result.payments.payment[0].id).toBe('PM001');
        expect(result.payments.payment[1].id).toBe('PM002');
      });

      it('should handle single element (not as array by default)', () => {
        const xml = `
          <payments>
            <payment>
              <id>PM001</id>
            </payment>
          </payments>
        `;
        const result = transformToJson(xml);
        
        // Single element is parsed as object, not array
        expect(result.payments.payment).toEqual({ id: 'PM001' });
      });
    });

    describe('XML collections', () => {
      it('should handle items collection pattern', () => {
        const xml = `
          <payments>
            <items>
              <payment>
                <id>PM001</id>
              </payment>
              <payment>
                <id>PM002</id>
              </payment>
            </items>
          </payments>
        `;
        const result = transformToJson(xml);
        
        // 'items' is recognized as collection by isArray function
        expect(Array.isArray(result.payments.items)).toBe(true);
      });

      it('should handle list collection pattern', () => {
        const xml = `
          <response>
            <list>
              <item>
                <id>1</id>
              </item>
              <item>
                <id>2</id>
              </item>
            </list>
          </response>
        `;
        const result = transformToJson(xml);
        
        // 'list' is recognized as collection by isArray function
        expect(Array.isArray(result.response.list)).toBe(true);
      });
    });

    describe('data type preservation', () => {
      it('should preserve numbers', () => {
        const xml = `
          <payment>
            <amount>7500.00</amount>
            <count>42</count>
            <negative>-100</negative>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.amount).toBe(7500.00);
        expect(typeof result.payment.amount).toBe('number');
        expect(result.payment.count).toBe(42);
        expect(typeof result.payment.count).toBe('number');
        expect(result.payment.negative).toBe(-100);
        expect(typeof result.payment.negative).toBe('number');
      });

      it('should preserve booleans', () => {
        const xml = `
          <payment>
            <active>true</active>
            <deleted>false</deleted>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.active).toBe(true);
        expect(typeof result.payment.active).toBe('boolean');
        expect(result.payment.deleted).toBe(false);
        expect(typeof result.payment.deleted).toBe('boolean');
      });

      it('should preserve strings', () => {
        const xml = `
          <payment>
            <id>PM001</id>
            <reference>TAX-2023-001</reference>
            <date>2024-01-31</date>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.id).toBe('PM001');
        expect(typeof result.payment.id).toBe('string');
        expect(result.payment.reference).toBe('TAX-2023-001');
        expect(typeof result.payment.reference).toBe('string');
        expect(result.payment.date).toBe('2024-01-31');
        expect(typeof result.payment.date).toBe('string');
      });

      it('should handle mixed types in nested structures', () => {
        const xml = `
          <payment>
            <id>PM001</id>
            <amount>100.50</amount>
            <active>true</active>
            <details>
              <count>5</count>
              <verified>false</verified>
              <note>Test payment</note>
            </details>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(typeof result.payment.id).toBe('string');
        expect(typeof result.payment.amount).toBe('number');
        expect(typeof result.payment.active).toBe('boolean');
        expect(typeof result.payment.details.count).toBe('number');
        expect(typeof result.payment.details.verified).toBe('boolean');
        expect(typeof result.payment.details.note).toBe('string');
      });
    });

    describe('special character handling', () => {
      it('should handle XML entities', () => {
        const xml = `
          <payment>
            <description>Payment &amp; Transfer</description>
            <note>Amount &lt; 1000</note>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.description).toBe('Payment & Transfer');
        expect(result.payment.note).toBe('Amount < 1000');
      });

      it('should handle special characters in values', () => {
        const xml = `
          <payment>
            <reference>REF-2023/001</reference>
            <note>Test: payment (verified)</note>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.reference).toBe('REF-2023/001');
        expect(result.payment.note).toBe('Test: payment (verified)');
      });

      it('should trim whitespace from values', () => {
        const xml = `
          <payment>
            <id>  PM001  </id>
            <reference>
              TAX-2023-001
            </reference>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.id).toBe('PM001');
        expect(result.payment.reference).toBe('TAX-2023-001');
      });
    });

    describe('empty objects and arrays', () => {
      it('should handle empty elements', () => {
        const xml = `
          <payment>
            <id>PM001</id>
            <note></note>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.id).toBe('PM001');
        expect(result.payment.note).toBe('');
      });

      it('should handle self-closing tags', () => {
        const xml = `
          <payment>
            <id>PM001</id>
            <note/>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.id).toBe('PM001');
        expect(result.payment.note).toBe('');
      });

      it('should handle empty parent elements', () => {
        const xml = `
          <payment>
            <details></details>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.details).toBe('');
      });
    });

    describe('null and undefined values', () => {
      it('should handle missing optional elements', () => {
        const xml = `
          <payment>
            <id>PM001</id>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment.id).toBe('PM001');
        expect(result.payment.note).toBeUndefined();
      });
    });

    describe('XML attributes', () => {
      it('should preserve XML attributes with @_ prefix', () => {
        const xml = `
          <payment id="PM001" type="online">
            <amount currency="GBP">100.50</amount>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment['@_id']).toBe('PM001');
        expect(result.payment['@_type']).toBe('online');
        expect(result.payment.amount['@_currency']).toBe('GBP');
        expect(result.payment.amount['#text']).toBe(100.50);
      });

      it('should parse attribute values to correct types', () => {
        const xml = `
          <payment count="5" active="true" amount="100.50">
            <id>PM001</id>
          </payment>
        `;
        const result = transformToJson(xml);
        
        expect(result.payment['@_count']).toBe(5);
        expect(typeof result.payment['@_count']).toBe('number');
        expect(result.payment['@_active']).toBe(true);
        expect(typeof result.payment['@_active']).toBe('boolean');
        expect(result.payment['@_amount']).toBe(100.50);
        expect(typeof result.payment['@_amount']).toBe('number');
      });
    });

    describe('error handling', () => {
      it('should throw error for empty string', () => {
        expect(() => {
          transformToJson('');
        }).toThrow('Failed to parse XML: Input XML is empty');
      });

      it('should throw error for whitespace-only string', () => {
        expect(() => {
          transformToJson('   ');
        }).toThrow('Failed to parse XML: Input XML is empty');
      });

      it('should handle malformed XML gracefully', () => {
        // fast-xml-parser is lenient and will parse even malformed XML
        // It will do its best to extract data
        const malformedXml = '<payment><id>PM001</payment>';
        const result = transformToJson(malformedXml);
        
        // Parser extracts what it can
        expect(result.payment).toBeDefined();
        expect(result.payment.id).toBe('PM001');
      });
    });
  });

  describe('transformToXml', () => {
    it('should transform simple JSON to XML', () => {
      const json = {
        payment: {
          id: 'PM001',
          amount: 100.50,
        },
      };
      const result = transformToXml(json);
      
      expect(result).toContain('<payment>');
      expect(result).toContain('<id>PM001</id>');
      expect(result).toContain('<amount>100.5</amount>');
      expect(result).toContain('</payment>');
    });

    it('should transform nested JSON to XML', () => {
      const json = {
        payment: {
          id: 'PM001',
          amount: {
            value: 100,
            currency: 'GBP',
          },
        },
      };
      const result = transformToXml(json);
      
      expect(result).toContain('<payment>');
      expect(result).toContain('<amount>');
      expect(result).toContain('<value>100</value>');
      expect(result).toContain('<currency>GBP</currency>');
      expect(result).toContain('</amount>');
      expect(result).toContain('</payment>');
    });

    it('should transform arrays to repeated elements', () => {
      const json = {
        payments: {
          payment: [
            { id: 'PM001' },
            { id: 'PM002' },
          ],
        },
      };
      const result = transformToXml(json);
      
      expect(result).toContain('<payments>');
      expect(result).toContain('<payment>');
      expect(result).toContain('<id>PM001</id>');
      expect(result).toContain('<id>PM002</id>');
      expect(result).toContain('</payments>');
    });

    it('should handle rootElement parameter', () => {
      const json = {
        id: 'PM001',
        amount: 100,
      };
      const result = transformToXml(json, 'payment');
      
      expect(result).toContain('<payment>');
      expect(result).toContain('<id>PM001</id>');
      expect(result).toContain('<amount>100</amount>');
      expect(result).toContain('</payment>');
    });

    it('should preserve attributes from @_ prefix', () => {
      const json = {
        payment: {
          '@_id': 'PM001',
          '@_type': 'online',
          amount: {
            '@_currency': 'GBP',
            '#text': 100.50,
          },
        },
      };
      const result = transformToXml(json);
      
      expect(result).toContain('id="PM001"');
      expect(result).toContain('type="online"');
      expect(result).toContain('currency="GBP"');
    });
  });

  describe('normalizeCollection', () => {
    it('should convert single object to array', () => {
      const data = {
        payments: {
          items: {
            payment: { id: 'PM001' },
          },
        },
      };
      const result = normalizeCollection(data, 'payments.items');
      
      expect(Array.isArray(result.payments.items)).toBe(true);
      expect(result.payments.items).toHaveLength(1);
      expect(result.payments.items[0]).toEqual({ payment: { id: 'PM001' } });
    });

    it('should leave arrays unchanged', () => {
      const data = {
        payments: {
          items: [
            { payment: { id: 'PM001' } },
            { payment: { id: 'PM002' } },
          ],
        },
      };
      const result = normalizeCollection(data, 'payments.items');
      
      expect(Array.isArray(result.payments.items)).toBe(true);
      expect(result.payments.items).toHaveLength(2);
    });

    it('should handle non-existent paths', () => {
      const data = {
        payments: {
          items: { payment: { id: 'PM001' } },
        },
      };
      const result = normalizeCollection(data, 'nonexistent.path');
      
      // Should return data unchanged
      expect(result).toEqual(data);
    });

    it('should handle nested paths', () => {
      const data = {
        response: {
          data: {
            payments: {
              items: { payment: { id: 'PM001' } },
            },
          },
        },
      };
      const result = normalizeCollection(data, 'response.data.payments.items');
      
      expect(Array.isArray(result.response.data.payments.items)).toBe(true);
      expect(result.response.data.payments.items).toHaveLength(1);
    });

    it('should handle root level collections', () => {
      const data = {
        items: { payment: { id: 'PM001' } },
      };
      const result = normalizeCollection(data, 'items');
      
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('round-trip transformation', () => {
    it('should preserve data through XML -> JSON -> XML', () => {
      const originalXml = `
        <payment>
          <id>PM001</id>
          <amount>100.50</amount>
          <active>true</active>
        </payment>
      `;
      
      const json = transformToJson(originalXml);
      const newXml = transformToXml(json);
      const finalJson = transformToJson(newXml);
      
      expect(finalJson).toEqual(json);
    });

    it('should preserve nested structures through round-trip', () => {
      const originalXml = `
        <payment>
          <id>PM001</id>
          <amount>
            <value>100</value>
            <currency>GBP</currency>
          </amount>
        </payment>
      `;
      
      const json = transformToJson(originalXml);
      const newXml = transformToXml(json);
      const finalJson = transformToJson(newXml);
      
      expect(finalJson).toEqual(json);
    });
  });
});
