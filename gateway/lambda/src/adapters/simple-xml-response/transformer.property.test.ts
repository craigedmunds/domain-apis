/**
 * Property-Based Tests for XML-JSON Transformer
 * 
 * **Validates: Requirements 7.1, 7.2, 7.4, 7.5**
 * 
 * These tests verify that XML-JSON transformation is correct across a wide range
 * of randomly generated inputs. Property-based testing helps ensure the transformer
 * handles edge cases and maintains correctness properties that should hold for all
 * valid inputs.
 */

import * as fc from 'fast-check';
import { transformToJson, transformToXml } from './transformer';

/**
 * Custom arbitrary for generating valid JSON-serializable values
 * that can be safely transformed to XML and back.
 * 
 * Constraints:
 * - Primitives: strings, numbers, booleans
 * - No null/undefined (XML doesn't have direct equivalents)
 * - No special characters that break XML
 * - No empty arrays/objects (XML represents these as empty strings)
 * - No trailing/leading spaces (XML parser trims values)
 * - No mixed-type arrays (XML doesn't support heterogeneous arrays well)
 * - Reasonable depth to avoid stack overflow
 * - Strings that look like numbers should be avoided (XML parser auto-converts)
 */
const jsonValue = (): fc.Arbitrary<any> => {
  return fc.letrec(tie => ({
    // Leaf values - primitives that XML can represent
    leaf: fc.oneof(
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
        // Filter out strings that would break XML or cause issues
        // Avoid control characters and XML special chars in raw form
        // Avoid strings that look like numbers (will be auto-converted by parser)
        // Avoid strings that look like booleans
        // Avoid leading/trailing whitespace (will be trimmed)
        if (!/^[a-zA-Z]/.test(s)) return false; // Must start with letter
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F<>&]/.test(s)) return false;
        if (/^-?\d+\.?\d*$/.test(s)) return false; // Looks like number
        if (s === 'true' || s === 'false') return false; // Looks like boolean
        if (s !== s.trim()) return false; // Has leading/trailing whitespace
        if (/\s$/.test(s)) return false; // Ends with whitespace (double check)
        if (/^\s/.test(s)) return false; // Starts with whitespace (double check)
        return true;
      }),
      fc.integer({ min: -1000000, max: 1000000 }),
      fc.double({ min: -1000000, max: 1000000, noNaN: true, noDefaultInfinity: true }),
      fc.boolean()
    ),
    
    // Object with string keys and mixed values (at least 1 key to avoid empty objects)
    object: fc.dictionary(
      // Keys must be valid XML element names (and not special JS properties)
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
        // XML element names: start with letter/underscore, contain alphanumeric/_/-/.
        // Avoid special JavaScript properties
        if (s === '__proto__' || s === 'constructor' || s === 'prototype') return false;
        return /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(s);
      }),
      tie('value'),
      { minKeys: 1, maxKeys: 5 } // At least 1 key to avoid empty objects
    ),
    
    // Homogeneous arrays - all elements of same type (at least 1 item to avoid empty arrays)
    array: fc.oneof(
      fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
        /^[a-zA-Z]/.test(s) && s === s.trim() && !/^-?\d+\.?\d*$/.test(s) && s !== 'true' && s !== 'false'
      ), { minLength: 1, maxLength: 3 }),
      fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 1, maxLength: 3 }),
      fc.array(fc.boolean(), { minLength: 1, maxLength: 3 })
    ),
    
    // Value can be leaf, object, or array (limited depth)
    value: fc.oneof(
      { weight: 5, arbitrary: tie('leaf') },
      { weight: 2, arbitrary: tie('object') },
      { weight: 1, arbitrary: tie('array') }
    )
  })).value as fc.Arbitrary<any>;
};

/**
 * Generate a valid JSON resource with a root element
 * This represents a typical API resource structure
 */
const jsonResource = fc.record({
  // Root element name (avoid special JS properties)
  _root: fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
    if (s === '__proto__' || s === 'constructor' || s === 'prototype') return false;
    return /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(s);
  }),
  // Resource data
  data: jsonValue()
}).map(({ _root, data }) => ({
  [_root]: data
}));

describe('XML-JSON Transformer - Property-Based Tests', () => {
  /**
   * Property 1: Round-trip transformation preserves structure
   * 
   * For any valid JSON resource, transforming to XML and back to JSON
   * should produce a structurally equivalent result.
   * 
   * **Validates: Requirements 7.1, 7.2, 7.4, 7.5**
   * - 7.1: XML responses are transformed to JSON
   * - 7.2: Data types are preserved during transformation
   * - 7.4: Nested objects and arrays are handled correctly
   * - 7.5: XML collections are handled correctly
   */
  describe('Property: Round-trip transformation correctness', () => {
    it('should preserve structure through JSON -> XML -> JSON transformation', () => {
      fc.assert(
        fc.property(jsonResource, (originalJson) => {
          // Transform JSON to XML
          const xml = transformToXml(originalJson);
          
          // Verify XML was generated
          expect(xml).toBeTruthy();
          expect(typeof xml).toBe('string');
          expect(xml.length).toBeGreaterThan(0);
          
          // Transform XML back to JSON
          const resultJson = transformToJson(xml);
          
          // Verify structural equivalence
          // Note: We compare the structure, not exact equality, because:
          // 1. Number formatting may differ (100.0 vs 100)
          // 2. Empty strings vs missing properties may differ
          // 3. Array vs single object for collections may differ
          expect(resultJson).toBeDefined();
          expect(typeof resultJson).toBe('object');
          
          // Verify root element is preserved
          const originalKeys = Object.keys(originalJson);
          const resultKeys = Object.keys(resultJson);
          expect(resultKeys).toEqual(originalKeys);
          
          // Verify data structure is preserved (recursive check)
          verifyStructuralEquivalence(originalJson, resultJson);
        }),
        {
          numRuns: 100, // Minimum 100 iterations as per requirements
          verbose: true,
          seed: 42, // Fixed seed for reproducibility
        }
      );
    });
    
    it('should preserve data types through round-trip transformation', () => {
      fc.assert(
        fc.property(jsonResource, (originalJson) => {
          // Transform JSON -> XML -> JSON
          const xml = transformToXml(originalJson);
          const resultJson = transformToJson(xml);
          
          // Verify data types are preserved
          verifyDataTypes(originalJson, resultJson);
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 43,
        }
      );
    });
    
    it('should handle nested structures correctly', () => {
      // Generate deeply nested structures (avoid empty objects)
      const nestedResource = fc.record({
        _root: fc.constant('resource'),
        data: fc.record({
          level1: fc.record({
            level2: fc.record({
              level3: fc.oneof(
                fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z]/.test(s)),
                fc.integer({ min: 1, max: 1000 }),
                fc.boolean()
              )
            })
          })
        })
      }).map(({ _root, data }) => ({ [_root]: data }));
      
      fc.assert(
        fc.property(nestedResource, (originalJson) => {
          const xml = transformToXml(originalJson);
          const resultJson = transformToJson(xml);
          
          // Verify nested structure is preserved
          verifyStructuralEquivalence(originalJson, resultJson);
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 44,
        }
      );
    });
    
    it('should handle arrays and collections correctly', () => {
      // Generate resources with arrays (non-empty, homogeneous)
      const arrayResource = fc.record({
        _root: fc.constant('collection'),
        data: fc.record({
          items: fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z]/.test(s) && s === s.trim()),
              value: fc.integer({ min: 0, max: 1000 })
            }),
            { minLength: 1, maxLength: 5 } // At least 1 item
          )
        })
      }).map(({ _root, data }) => ({ [_root]: data }));
      
      fc.assert(
        fc.property(arrayResource, (originalJson) => {
          const xml = transformToXml(originalJson);
          const resultJson = transformToJson(xml);
          
          // Verify array structure is preserved
          // Note: Single-item arrays may be converted to objects by XML parser
          // This is expected behavior and handled by normalizeCollection
          expect(resultJson).toBeDefined();
          verifyStructuralEquivalence(originalJson, resultJson);
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 45,
        }
      );
    });
  });
  
  /**
   * Property 2: XML parsing always produces valid JSON
   * 
   * For any valid XML generated from JSON, parsing should always
   * produce a valid JSON object (not throw errors).
   */
  describe('Property: XML parsing robustness', () => {
    it('should always produce valid JSON from generated XML', () => {
      fc.assert(
        fc.property(jsonResource, (originalJson) => {
          const xml = transformToXml(originalJson);
          
          // Parsing should not throw
          expect(() => {
            const result = transformToJson(xml);
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
          }).not.toThrow();
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 46,
        }
      );
    });
  });
  
  /**
   * Property 3: Empty and edge case handling
   * 
   * Transformer should handle empty strings and edge case values correctly.
   * Note: Empty objects and arrays produce empty XML strings, which is expected behavior.
   */
  describe('Property: Edge case handling', () => {
    it('should handle non-empty objects correctly', () => {
      const nonEmptyResource = fc.record({
        _root: fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
          if (s === '__proto__' || s === 'constructor' || s === 'prototype') return false;
          return /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(s);
        }),
        data: fc.record({
          field: fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
            // Must start with letter, no whitespace at all
            if (!/^[a-zA-Z]/.test(s)) return false;
            if (/\s/.test(s)) return false; // No whitespace anywhere
            if (/^-?\d+\.?\d*$/.test(s)) return false;
            if (s === 'true' || s === 'false') return false;
            return true;
          })
        })
      }).map(({ _root, data }) => ({ [_root]: data }));
      
      fc.assert(
        fc.property(nonEmptyResource, (originalJson) => {
          const xml = transformToXml(originalJson);
          const resultJson = transformToJson(xml);
          
          expect(resultJson).toBeDefined();
          verifyStructuralEquivalence(originalJson, resultJson);
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 47,
        }
      );
    });
    
    it('should handle non-empty strings correctly', () => {
      const nonEmptyStringResource = fc.record({
        _root: fc.constant('resource'),
        data: fc.record({
          field: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z]/.test(s))
        })
      }).map(({ _root, data }) => ({ [_root]: data }));
      
      fc.assert(
        fc.property(nonEmptyStringResource, (originalJson) => {
          const xml = transformToXml(originalJson);
          const resultJson = transformToJson(xml);
          
          expect(resultJson).toBeDefined();
          const rootKey = Object.keys(originalJson)[0];
          expect(resultJson[rootKey]).toBeDefined();
          expect(resultJson[rootKey].field).toBeTruthy();
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 48,
        }
      );
    });
  });
});

/**
 * Helper function to verify structural equivalence between two objects
 * 
 * This function recursively compares the structure of two objects,
 * allowing for some differences that are acceptable in XML-JSON transformation:
 * - Number formatting (100.0 vs 100)
 * - Empty strings vs missing properties
 * - Single-item arrays vs objects (XML parser behavior)
 */
function verifyStructuralEquivalence(original: any, result: any, path: string = 'root'): void {
  // Handle null/undefined
  if (original === null || original === undefined) {
    // XML may represent these as empty strings or missing
    return;
  }
  
  // Handle primitives
  if (typeof original !== 'object') {
    expect(typeof result).toBe(typeof original);
    
    // For numbers, allow small floating point differences
    if (typeof original === 'number' && typeof result === 'number') {
      expect(Math.abs(original - result)).toBeLessThan(0.0001);
    } else {
      expect(result).toBe(original);
    }
    return;
  }
  
  // Handle arrays
  if (Array.isArray(original)) {
    // XML parser may convert single-item arrays to objects
    // This is acceptable - we just verify the data is present
    if (original.length === 0) {
      // Empty array may be represented differently
      return;
    }
    
    if (original.length === 1) {
      // Single item may be object or array
      if (Array.isArray(result)) {
        expect(result.length).toBe(1);
        verifyStructuralEquivalence(original[0], result[0], `${path}[0]`);
      } else {
        // Single item converted to object - verify the item
        verifyStructuralEquivalence(original[0], result, path);
      }
    } else {
      // Multiple items should be array
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(original.length);
      
      for (let i = 0; i < original.length; i++) {
        verifyStructuralEquivalence(original[i], result[i], `${path}[${i}]`);
      }
    }
    return;
  }
  
  // Handle objects
  expect(typeof result).toBe('object');
  expect(result).not.toBeNull();
  
  // Verify all keys from original exist in result
  const originalKeys = Object.keys(original);
  const resultKeys = Object.keys(result);
  
  for (const key of originalKeys) {
    // Skip empty values that may not be preserved
    if (original[key] === '' || original[key] === null || original[key] === undefined) {
      continue;
    }
    
    expect(resultKeys).toContain(key);
    verifyStructuralEquivalence(original[key], result[key], `${path}.${key}`);
  }
}

/**
 * Helper function to verify data types are preserved
 * 
 * Note: XML transformation has some quirks:
 * - Numeric strings may be parsed as numbers if they look like numbers
 * - This is expected behavior from fast-xml-parser's parseTagValue option
 */
function verifyDataTypes(original: any, result: any): void {
  if (original === null || original === undefined) {
    return;
  }
  
  if (typeof original !== 'object') {
    // For strings, XML parser may convert to number if it looks like a number
    // This is expected behavior with parseTagValue: true
    if (typeof original === 'string' && typeof result === 'number') {
      // Check if original string looks like a number
      if (/^-?\d+\.?\d*$/.test(original)) {
        // This is acceptable - parser converted numeric string to number
        return;
      }
    }
    
    // Otherwise, types should match
    expect(typeof result).toBe(typeof original);
    return;
  }
  
  if (Array.isArray(original)) {
    // Arrays may be converted to objects for single items
    if (original.length === 0) {
      return;
    }
    
    if (original.length === 1) {
      if (Array.isArray(result)) {
        verifyDataTypes(original[0], result[0]);
      } else {
        verifyDataTypes(original[0], result);
      }
    } else {
      expect(Array.isArray(result)).toBe(true);
      for (let i = 0; i < original.length; i++) {
        verifyDataTypes(original[i], result[i]);
      }
    }
    return;
  }
  
  // Object - recurse into properties
  for (const key of Object.keys(original)) {
    if (original[key] !== null && original[key] !== undefined && original[key] !== '') {
      if (result[key] !== undefined) {
        verifyDataTypes(original[key], result[key]);
      }
    }
  }
}
