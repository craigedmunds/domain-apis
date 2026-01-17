/**
 * Type definitions for Simple XML Response Adapter
 */

/**
 * XML transformation options
 */
export interface XmlTransformOptions {
  /**
   * Whether to preserve XML attributes
   */
  preserveAttributes?: boolean;
  
  /**
   * Prefix for attribute names in JSON
   */
  attributePrefix?: string;
  
  /**
   * Name for text content nodes
   */
  textNodeName?: string;
  
  /**
   * Whether to parse values to correct types
   */
  parseValues?: boolean;
  
  /**
   * Whether to trim whitespace from values
   */
  trimValues?: boolean;
}

/**
 * Collection normalization result
 */
export interface NormalizedCollection {
  /**
   * The normalized data with collections as arrays
   */
  data: any;
  
  /**
   * Whether any normalization was performed
   */
  normalized: boolean;
}
