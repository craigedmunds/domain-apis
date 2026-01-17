/**
 * Simple XML Response Adapter
 * 
 * This adapter transforms XML responses from backend services to JSON format
 * while injecting hypermedia links based on service configuration. It enables
 * legacy XML-based backends to participate in the domain API architecture
 * without requiring clients to handle XML.
 * 
 * The adapter:
 * - Transforms XML responses to JSON matching the OAS schema
 * - Injects _links sections with self and relationship links
 * - Updates Content-Type headers from application/xml to application/json
 * - Preserves data types during transformation
 */

import { Adapter, ServiceConfig, TransformResult } from '../registry';
import { transformToJson } from './transformer';
import { injectLinksFromConfig } from './link-injector';

/**
 * SimpleXmlResponseAdapter implements the Adapter interface for XML response transformation
 * 
 * This adapter only handles response transformation (not request transformation).
 * It is designed for backends that accept JSON requests but return XML responses.
 * 
 * @example
 * ```typescript
 * // Register the adapter
 * import { adapterRegistry } from './adapters/registry';
 * import { SimpleXmlResponseAdapter } from './adapters/simple-xml-response';
 * 
 * const adapter = new SimpleXmlResponseAdapter();
 * adapterRegistry.register(adapter);
 * 
 * // Use the adapter
 * const adapter = adapterRegistry.get('simple-xml-response');
 * if (adapter && adapter.transformResponse) {
 *   const result = adapter.transformResponse(xmlBody, headers);
 *   // result.body is now JSON
 *   // result.headers['Content-Type'] is 'application/json'
 * }
 * ```
 */
export class SimpleXmlResponseAdapter implements Adapter {
  /**
   * Unique identifier for this adapter
   */
  name = 'simple-xml-response';
  
  /**
   * Transform XML response to JSON format
   * 
   * This method:
   * 1. Parses the XML response body to JSON
   * 2. Updates the Content-Type header to application/json
   * 3. Preserves all other headers
   * 
   * @param body - XML response body as string
   * @param headers - Response headers from backend
   * @returns Transformed JSON body and updated headers
   * @throws Error if XML parsing fails
   * 
   * @example
   * ```typescript
   * const xmlBody = '<payment><id>PM001</id><amount>100.50</amount></payment>';
   * const headers = { 'Content-Type': 'application/xml' };
   * 
   * const result = adapter.transformResponse(xmlBody, headers);
   * // result.body = { payment: { id: 'PM001', amount: 100.50 } }
   * // result.headers = { 'Content-Type': 'application/json' }
   * ```
   */
  transformResponse(body: any, headers: Record<string, string>): TransformResult {
    try {
      // Transform XML string to JSON object
      const json = transformToJson(body);
      
      // Update Content-Type header to application/json
      const updatedHeaders = {
        ...headers,
        'Content-Type': 'application/json',
      };
      
      return {
        body: json,
        headers: updatedHeaders,
      };
    } catch (error) {
      // Re-throw with context for better error handling upstream
      throw new Error(
        `SimpleXmlResponseAdapter failed to transform response: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  
  /**
   * Inject hypermedia links into a resource based on service configuration
   * 
   * This method adds a _links section to the resource containing:
   * - A self link pointing to the resource itself
   * - Relationship links based on the service configuration
   * 
   * The links enable HATEOAS (Hypermedia as the Engine of Application State)
   * for XML backends that cannot generate links themselves.
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
   * const result = adapter.injectLinks(payment, config, 'dev', 'payment', 'payments');
   * // result._links = {
   * //   self: { href: '/dev/payment/payments/PM20230001' },
   * //   taxpayer: {
   * //     href: '/dev/taxpayer/taxpayers/TP123456',
   * //     type: 'taxpayer',
   * //     title: 'Taxpayer who made this payment'
   * //   }
   * // }
   * ```
   */
  injectLinks(
    resource: any,
    config: ServiceConfig,
    stage: string,
    apiName: string,
    resourceType: string
  ): any {
    try {
      return injectLinksFromConfig(resource, config, stage, apiName, resourceType);
    } catch (error) {
      // Re-throw with context for better error handling upstream
      throw new Error(
        `SimpleXmlResponseAdapter failed to inject links: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
