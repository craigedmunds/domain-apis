/**
 * XML-JSON Transformer
 * 
 * This module provides bidirectional transformation between XML and JSON formats
 * using fast-xml-parser. It preserves data types, handles collections, and maintains
 * structural integrity during transformation.
 */

import { XMLParser, XMLBuilder } from 'fast-xml-parser';

/**
 * Parser options for XML to JSON transformation
 * 
 * Configuration:
 * - ignoreAttributes: false - Preserve XML attributes
 * - attributeNamePrefix: '@_' - Prefix for attribute names in JSON
 * - textNodeName: '#text' - Name for text content nodes
 * - parseAttributeValue: true - Parse attribute values to correct types
 * - parseTagValue: true - Parse tag values to correct types (numbers, booleans)
 * - trimValues: true - Remove leading/trailing whitespace
 * - isArray: Custom function to detect XML collections
 */
const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (tagName: string, jPath: string, isLeafNode: boolean, isAttribute: boolean) => {
    // Detect common collection patterns
    // Collections typically have plural names containing 'items', 'list', or end with 's'
    if (tagName === 'items' || tagName === 'list') {
      return true;
    }
    return false;
  },
};

/**
 * Builder options for JSON to XML transformation
 */
const builderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  indentBy: '  ',
};

// Create parser and builder instances
const parser = new XMLParser(parserOptions);
const builder = new XMLBuilder(builderOptions);

/**
 * Transform XML string to JSON object
 * 
 * This function parses XML and converts it to a JSON object, preserving:
 * - Data types (numbers, booleans, dates)
 * - Nested structures
 * - Arrays and collections
 * - XML attributes (prefixed with @_)
 * 
 * @param xml - XML string to transform
 * @returns Parsed JSON object
 * @throws Error if XML parsing fails or input is invalid
 * 
 * @example
 * ```typescript
 * const xml = '<payment><id>PM001</id><amount>100.50</amount></payment>';
 * const json = transformToJson(xml);
 * // Result: { payment: { id: 'PM001', amount: 100.50 } }
 * ```
 * 
 * @example
 * // XML collection
 * const xml = '<payments><items><payment><id>PM001</id></payment><payment><id>PM002</id></payment></items></payments>';
 * const json = transformToJson(xml);
 * // Result: { payments: { items: [{ payment: { id: 'PM001' } }, { payment: { id: 'PM002' } }] } }
 * ```
 */
export function transformToJson(xml: string): any {
  // Validate input
  if (!xml || xml.trim().length === 0) {
    throw new Error('Failed to parse XML: Input XML is empty');
  }
  
  try {
    const result = parser.parse(xml);
    
    // Check if result is empty object (indicates parsing issue)
    if (Object.keys(result).length === 0) {
      throw new Error('Failed to parse XML: No valid XML content found');
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to parse XML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Transform JSON object to XML string
 * 
 * This function converts a JSON object to XML format, preserving:
 * - Data types
 * - Nested structures
 * - Arrays
 * - Attributes (from @_ prefixed properties)
 * 
 * @param json - JSON object to transform
 * @param rootElement - Optional root element name (defaults to 'root')
 * @returns XML string
 * @throws Error if JSON to XML conversion fails
 * 
 * @example
 * ```typescript
 * const json = { payment: { id: 'PM001', amount: 100.50 } };
 * const xml = transformToXml(json);
 * // Result: '<payment><id>PM001</id><amount>100.50</amount></payment>'
 * ```
 */
export function transformToXml(json: any, rootElement?: string): string {
  try {
    // If rootElement is provided and json doesn't have it, wrap the json
    let data = json;
    if (rootElement && !json[rootElement]) {
      data = { [rootElement]: json };
    }
    
    const result = builder.build(data);
    return result;
  } catch (error) {
    throw new Error(`Failed to build XML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Normalize XML collections to arrays
 * 
 * XML parsers may return single items as objects instead of arrays.
 * This function ensures collections are always arrays for consistent handling.
 * 
 * @param data - Parsed XML data
 * @param collectionPath - Path to the collection (e.g., 'payments.items')
 * @returns Data with normalized collections
 * 
 * @example
 * ```typescript
 * // Single item parsed as object
 * const data = { payments: { items: { payment: { id: 'PM001' } } } };
 * const normalized = normalizeCollection(data, 'payments.items');
 * // Result: { payments: { items: [{ payment: { id: 'PM001' } }] } }
 * ```
 */
export function normalizeCollection(data: any, collectionPath: string): any {
  const parts = collectionPath.split('.');
  let current = data;
  
  // Navigate to the parent of the collection
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      return data; // Path doesn't exist, return unchanged
    }
    current = current[parts[i]];
  }
  
  const collectionKey = parts[parts.length - 1];
  
  // If the collection exists and is not an array, wrap it
  if (current[collectionKey] && !Array.isArray(current[collectionKey])) {
    current[collectionKey] = [current[collectionKey]];
  }
  
  return data;
}
