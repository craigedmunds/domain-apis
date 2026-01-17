/**
 * Link Injector
 * 
 * This module provides functionality to inject hypermedia links into resources
 * based on service configuration. It constructs URLs using field values from
 * resources and relationship configurations.
 */

import { ServiceConfig, RelationshipConfig } from '../registry';

/**
 * Inject hypermedia links into a resource based on service configuration
 * 
 * This function adds a _links section to the resource containing:
 * - A self link pointing to the resource itself
 * - Relationship links based on the service configuration
 * 
 * Links are constructed using the relationship configuration and field values
 * from the resource. The stage parameter is used to construct the correct
 * base URL for the deployment environment.
 * 
 * @param resource - The resource to inject links into
 * @param config - Service configuration containing relationship definitions
 * @param stage - Deployment stage (dev, prod, etc.) for URL construction
 * @param apiName - The name of the current API (for self link construction)
 * @param resourceType - The type of resource (for self link construction)
 * @returns Resource with injected _links section
 * 
 * @example
 * ```typescript
 * const payment = {
 *   id: 'PM20230001',
 *   type: 'payment',
 *   taxpayerId: 'TP123456',
 *   amount: { amount: 7500.00, currency: 'GBP' }
 * };
 * 
 * const config = {
 *   adapters: ['simple-xml-response'],
 *   relationships: {
 *     taxpayer: {
 *       targetApi: 'taxpayer',
 *       targetResource: 'taxpayers',
 *       sourceField: 'taxpayerId',
 *       linkType: 'taxpayer',
 *       linkTitle: 'Taxpayer who made this payment'
 *     }
 *   }
 * };
 * 
 * const result = injectLinksFromConfig(payment, config, 'dev', 'payment', 'payments');
 * // Result includes:
 * // {
 * //   ...payment,
 * //   _links: {
 * //     self: { href: '/dev/payment/payments/PM20230001' },
 * //     taxpayer: {
 * //       href: '/dev/taxpayer/taxpayers/TP123456',
 * //       type: 'taxpayer',
 * //       title: 'Taxpayer who made this payment'
 * //     }
 * //   }
 * // }
 * ```
 */
export function injectLinksFromConfig(
  resource: any,
  config: ServiceConfig,
  stage: string,
  apiName: string,
  resourceType: string
): any {
  // Don't modify the original resource
  const result = { ...resource };
  
  // Initialize _links object
  result._links = result._links || {};
  
  // Inject self link
  result._links.self = {
    href: constructSelfUrl(resource, stage, apiName, resourceType)
  };
  
  // Inject relationship links if configured
  if (config.relationships) {
    for (const [relationshipName, relationshipConfig] of Object.entries(config.relationships)) {
      // Construct the link for this relationship
      const link = constructRelationshipLink(resource, relationshipConfig, stage);
      
      if (link) {
        result._links[relationshipName] = link;
      }
    }
  }
  
  return result;
}

/**
 * Construct a self link URL for a resource
 * 
 * The self link points to the resource itself using the pattern:
 * /{stage}/{apiName}/{resourceType}/{id}
 * 
 * @param resource - The resource to construct a self link for
 * @param stage - Deployment stage (dev, prod, etc.)
 * @param apiName - The name of the current API
 * @param resourceType - The type of resource (plural form)
 * @returns Self link URL
 * 
 * @example
 * ```typescript
 * const url = constructSelfUrl({ id: 'PM001' }, 'dev', 'payment', 'payments');
 * // Result: '/dev/payment/payments/PM001'
 * ```
 */
function constructSelfUrl(
  resource: any,
  stage: string,
  apiName: string,
  resourceType: string
): string {
  const id = resource.id;
  if (!id) {
    throw new Error('Resource must have an id field for self link construction');
  }
  
  return `/${stage}/${apiName}/${resourceType}/${id}`;
}

/**
 * Construct a relationship link from a resource and relationship configuration
 * 
 * This function creates a link object containing:
 * - href: The URL to the related resource
 * - type: The link type from configuration
 * - title: The link title from configuration
 * 
 * The URL is constructed using either:
 * - A custom urlPattern with field substitution
 * - The default pattern: /{stage}/{targetApi}/{targetResource}/{sourceFieldValue}
 * 
 * @param resource - The source resource containing field values
 * @param config - Relationship configuration
 * @param stage - Deployment stage for URL construction
 * @returns Link object with href, type, and title, or null if source field is missing
 * 
 * @example
 * ```typescript
 * const payment = { id: 'PM001', taxpayerId: 'TP123' };
 * const config = {
 *   targetApi: 'taxpayer',
 *   targetResource: 'taxpayers',
 *   sourceField: 'taxpayerId',
 *   linkType: 'taxpayer',
 *   linkTitle: 'Related taxpayer'
 * };
 * 
 * const link = constructRelationshipLink(payment, config, 'dev');
 * // Result: {
 * //   href: '/dev/taxpayer/taxpayers/TP123',
 * //   type: 'taxpayer',
 * //   title: 'Related taxpayer'
 * // }
 * ```
 */
function constructRelationshipLink(
  resource: any,
  config: RelationshipConfig,
  stage: string
): { href: string; type: string; title: string } | null {
  // Get the source field value
  const sourceValue = resource[config.sourceField];
  
  // If source field is missing or null, skip this link
  if (sourceValue === undefined || sourceValue === null) {
    return null;
  }
  
  // Construct the URL
  let href: string;
  
  if (config.urlPattern) {
    // Use custom URL pattern with field substitution
    href = constructUrl(config.urlPattern, resource, stage);
  } else {
    // Use default pattern: /{stage}/{targetApi}/{targetResource}/{sourceFieldValue}
    href = `/${stage}/${config.targetApi}/${config.targetResource}/${sourceValue}`;
  }
  
  // Return link object with metadata
  return {
    href,
    type: config.linkType,
    title: config.linkTitle
  };
}

/**
 * Construct a URL from a pattern by substituting field values from a resource
 * 
 * This function replaces placeholders in the URL pattern with actual field values
 * from the resource. Placeholders use the format {fieldName}.
 * 
 * The stage is automatically prepended to the URL if not already present in the pattern.
 * 
 * @param pattern - URL pattern with {fieldName} placeholders
 * @param resource - Resource containing field values for substitution
 * @param stage - Deployment stage to prepend to the URL
 * @returns Constructed URL with substituted values
 * @throws Error if a required field is missing from the resource
 * 
 * @example
 * ```typescript
 * const resource = { id: 'PM001', taxpayerId: 'TP123' };
 * const url = constructUrl('/payments/{id}/allocations', resource, 'dev');
 * // Result: '/dev/payments/PM001/allocations'
 * ```
 * 
 * @example
 * ```typescript
 * const resource = { id: 'PM001', taxpayerId: 'TP123' };
 * const url = constructUrl('/taxpayer/taxpayers/{taxpayerId}', resource, 'dev');
 * // Result: '/dev/taxpayer/taxpayers/TP123'
 * ```
 */
export function constructUrl(
  pattern: string,
  resource: any,
  stage: string
): string {
  // Find all placeholders in the pattern
  const placeholderRegex = /\{([^}]+)\}/g;
  let result = pattern;
  let match;
  
  // Replace each placeholder with the corresponding field value
  while ((match = placeholderRegex.exec(pattern)) !== null) {
    const fieldName = match[1];
    const fieldValue = resource[fieldName];
    
    // Check if field exists in resource
    if (fieldValue === undefined || fieldValue === null) {
      throw new Error(`Field "${fieldName}" required for URL construction is missing from resource`);
    }
    
    // Replace the placeholder with the field value
    result = result.replace(`{${fieldName}}`, String(fieldValue));
  }
  
  // Prepend stage if not already present
  if (!result.startsWith(`/${stage}/`)) {
    result = `/${stage}${result}`;
  }
  
  return result;
}
