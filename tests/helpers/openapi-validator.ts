/**
 * OpenAPI Validation Helper
 * 
 * Provides utilities for validating OpenAPI specifications in tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Load an OpenAPI specification file
 */
export function loadSpec(specPath: string): any {
  const fullPath = path.join(process.cwd(), specPath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Specification file not found: ${fullPath}`);
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  return yaml.load(content);
}

/**
 * Check if a specification has required OpenAPI 3.0+ fields
 */
export function hasRequiredFields(spec: any): ValidationResult {
  const errors: string[] = [];
  
  // Check openapi version
  if (!spec.openapi || !spec.openapi.startsWith('3.')) {
    errors.push('Missing or invalid openapi version (must be 3.x)');
  }
  
  // Check info section
  if (!spec.info) {
    errors.push('Missing info section');
  } else {
    if (!spec.info.title) errors.push('Missing info.title');
    if (!spec.info.version) errors.push('Missing info.version');
    if (!spec.info.description) errors.push('Missing info.description');
  }
  
  // Check paths
  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    errors.push('Missing or empty paths section');
  }
  
  // Check components/schemas
  if (!spec.components || !spec.components.schemas || Object.keys(spec.components.schemas).length === 0) {
    errors.push('Missing or empty components.schemas section');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a specification includes examples
 */
export function hasExamples(spec: any): ValidationResult {
  const errors: string[] = [];
  let exampleCount = 0;
  
  // Check for examples in paths
  if (spec.paths) {
    for (const [pathName, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (typeof operation === 'object' && operation !== null && (operation as any).responses) {
          for (const [statusCode, response] of Object.entries((operation as any).responses)) {
            if (typeof response === 'object' && response !== null && (response as any).content) {
              for (const [mediaType, mediaTypeObj] of Object.entries((response as any).content)) {
                if ((mediaTypeObj as any).example || (mediaTypeObj as any).examples) {
                  exampleCount++;
                }
              }
            }
          }
        }
      }
    }
  }
  
  if (exampleCount === 0) {
    errors.push('No examples found in specification');
  }
  
  return {
    valid: exampleCount > 0,
    errors
  };
}

/**
 * Find all $ref references in a specification
 */
export function findRefs(obj: any, refs: Set<string> = new Set()): Set<string> {
  if (typeof obj !== 'object' || obj === null) {
    return refs;
  }
  
  if (obj.$ref && typeof obj.$ref === 'string') {
    refs.add(obj.$ref);
  }
  
  for (const value of Object.values(obj)) {
    findRefs(value, refs);
  }
  
  return refs;
}

/**
 * Check if all $ref references can be resolved
 */
export function validateRefs(spec: any): ValidationResult {
  const errors: string[] = [];
  const refs = findRefs(spec);
  
  for (const ref of refs) {
    // Skip external file references for now (they need special handling)
    if (ref.includes('.yaml#') || ref.includes('.yml#')) {
      continue;
    }
    
    // Check internal references
    if (ref.startsWith('#/')) {
      const path = ref.substring(2).split('/');
      let current = spec;
      
      for (const segment of path) {
        if (current && typeof current === 'object' && segment in current) {
          current = current[segment];
        } else {
          errors.push(`Cannot resolve reference: ${ref}`);
          break;
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a resource schema includes _links field
 */
export function hasLinksField(schema: any): boolean {
  return schema.properties && '_links' in schema.properties;
}

/**
 * Check if all resource schemas include _links
 */
export function validateResourceLinks(spec: any): ValidationResult {
  const errors: string[] = [];
  
  if (!spec.components || !spec.components.schemas) {
    return { valid: true, errors: [] };
  }
  
  for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
    // Skip non-resource schemas (like shared components)
    if (schemaName.includes('Link') || schemaName.includes('Error') || schemaName.includes('Collection')) {
      continue;
    }
    
    if (typeof schema === 'object' && (schema as any).type === 'object') {
      if (!hasLinksField(schema)) {
        errors.push(`Resource schema ${schemaName} missing _links field`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
