/**
 * Adapter Registry and Interface
 * 
 * This module provides the core adapter infrastructure for the domain API gateway.
 * Adapters enable transformation of requests and responses between different formats
 * (e.g., JSON to XML, XML to JSON) and injection of hypermedia links.
 */

/**
 * ServiceConfig defines the configuration for an API service
 */
export interface ServiceConfig {
  adapters: string[];
  relationships?: Record<string, RelationshipConfig>;
}

/**
 * RelationshipConfig defines how to construct links between resources
 */
export interface RelationshipConfig {
  targetApi: string;
  targetResource: string;
  sourceField: string;
  urlPattern?: string;
  linkType: string;
  linkTitle: string;
}

/**
 * TransformResult contains the transformed body and headers
 */
export interface TransformResult {
  body: any;
  headers: Record<string, string>;
}

/**
 * Adapter interface - all adapters must implement this interface
 * 
 * Adapters are modular components that transform requests/responses and inject links.
 * Each adapter implements only the methods it needs (all methods are optional except name).
 */
export interface Adapter {
  /**
   * Unique name identifying this adapter (e.g., "simple-xml-response")
   */
  name: string;
  
  /**
   * Transform request before sending to backend
   * 
   * @param body - Request body to transform
   * @param headers - Request headers
   * @returns Transformed body and headers
   */
  transformRequest?(body: any, headers: Record<string, string>): TransformResult;
  
  /**
   * Transform response after receiving from backend
   * 
   * @param body - Response body to transform
   * @param headers - Response headers
   * @returns Transformed body and headers
   */
  transformResponse?(body: any, headers: Record<string, string>): TransformResult;
  
  /**
   * Inject hypermedia links into a resource based on configuration
   * 
   * @param resource - The resource to inject links into
   * @param config - Service configuration containing relationship definitions
   * @param stage - Deployment stage (dev, prod, etc.) for URL construction
   * @param apiName - The name of the current API (for self link construction)
   * @param resourceType - The type of resource (for self link construction)
   * @returns Resource with injected _links
   */
  injectLinks?(resource: any, config: ServiceConfig, stage: string, apiName: string, resourceType: string): any;
}

/**
 * AdapterRegistry manages the collection of available adapters
 * 
 * The registry provides a central location to register and retrieve adapters.
 * Adapters are registered at Lambda initialization and retrieved during request processing.
 */
export class AdapterRegistry {
  private adapters: Map<string, Adapter> = new Map();
  
  /**
   * Register an adapter with the registry
   * 
   * @param adapter - The adapter to register
   * @throws Error if an adapter with the same name is already registered
   */
  register(adapter: Adapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter with name "${adapter.name}" is already registered`);
    }
    this.adapters.set(adapter.name, adapter);
  }
  
  /**
   * Get an adapter by name
   * 
   * @param name - The name of the adapter to retrieve
   * @returns The adapter if found, undefined otherwise
   */
  get(name: string): Adapter | undefined {
    return this.adapters.get(name);
  }
  
  /**
   * Get all registered adapters
   * 
   * @returns Array of all registered adapters
   */
  getAll(): Adapter[] {
    return Array.from(this.adapters.values());
  }
}

/**
 * Global adapter registry instance
 * 
 * This singleton instance is used throughout the gateway to access adapters.
 * Adapters should be registered during Lambda initialization.
 */
export const adapterRegistry = new AdapterRegistry();
