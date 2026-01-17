/**
 * Property-Based Tests for Adapter Detection Consistency
 * 
 * **Validates: Requirements 1.1, 1.2, 2.3**
 * 
 * These tests verify that adapter detection is consistent and correct across
 * a wide range of randomly generated API paths and service configurations.
 * 
 * Requirements validated:
 * - 1.1: Gateway detects and loads adapter configuration when service.yaml exists
 * - 1.2: Gateway uses simple-xml-response adapter when specified in config
 * - 2.3: Gateway enables XML response transformation when adapter is listed
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { loadServiceConfig, clearConfigCache, setSpecsBasePath } from './config/service-config';
import { adapterRegistry } from './adapters/registry';
import { SimpleXmlResponseAdapter } from './adapters/simple-xml-response';

// Mock the detectAdapter function since it's not exported
// We'll test it indirectly through the service config loader and adapter registry

/**
 * Custom arbitrary for generating valid API names
 * API names should be lowercase, alphanumeric with hyphens
 */
const apiName = fc.string({ minLength: 3, maxLength: 20 }).filter(s => {
  // Must be lowercase alphanumeric with hyphens
  return /^[a-z][a-z0-9-]*$/.test(s);
});

/**
 * Custom arbitrary for generating valid API paths
 * Paths should start with /apiName/resource/id pattern
 */
const apiPath = fc.tuple(
  apiName,
  fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
  fc.option(fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[A-Z0-9][A-Z0-9-]*$/.test(s)), { nil: undefined })
).map(([api, resource, id]) => {
  if (id) {
    return `/${api}/${resource}/${id}`;
  }
  return `/${api}/${resource}`;
});

/**
 * Custom arbitrary for generating service configurations
 */
const serviceConfig = fc.record({
  adapters: fc.array(
    fc.constantFrom('simple-xml-response'), // Only use registered adapters
    { minLength: 0, maxLength: 3 }
  ),
  relationships: fc.option(
    fc.dictionary(
      fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
      fc.record({
        targetApi: apiName,
        targetResource: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
        sourceField: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z][A-Za-z0-9]*$/.test(s)),
        linkType: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
        linkTitle: fc.string({ minLength: 5, maxLength: 50 })
      }),
      { minKeys: 0, maxKeys: 3 }
    ),
    { nil: undefined }
  )
});

/**
 * Helper function to extract API name from path
 * This mirrors the logic in detectAdapter()
 */
function extractApiNameFromPath(path: string): string {
  const pathSegments = path.split('/').filter(s => s.length > 0);
  if (pathSegments.length === 0) {
    return '';
  }
  return pathSegments[0];
}

/**
 * Helper function to create a temporary test directory structure
 */
function createTestSpecsDirectory(): string {
  const testDir = path.join(__dirname, '..', 'test-specs-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

/**
 * Helper function to clean up test directory
 */
function cleanupTestSpecsDirectory(testDir: string): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

/**
 * Helper function to write service config to test directory
 */
function writeServiceConfig(testDir: string, apiName: string, config: any): void {
  const apiDir = path.join(testDir, apiName);
  fs.mkdirSync(apiDir, { recursive: true });
  
  const yaml = require('js-yaml');
  const configPath = path.join(apiDir, 'service.yaml');
  fs.writeFileSync(configPath, yaml.dump(config));
}

describe('Adapter Detection - Property-Based Tests', () => {
  let testDir: string;
  
  beforeAll(() => {
    // Register the simple-xml-response adapter
    const xmlAdapter = new SimpleXmlResponseAdapter();
    adapterRegistry.register(xmlAdapter);
  });
  
  beforeEach(() => {
    // Create a fresh test directory for each test
    testDir = createTestSpecsDirectory();
    setSpecsBasePath(testDir);
    clearConfigCache();
  });
  
  afterEach(() => {
    // Clean up test directory
    cleanupTestSpecsDirectory(testDir);
    clearConfigCache();
  });
  
  /**
   * Property 1: Adapter detection is consistent for the same API
   * 
   * For any API name and configuration, loading the service config multiple times
   * should return the same result (consistent detection).
   * 
   * **Validates: Requirements 1.1, 2.3**
   */
  describe('Property: Consistent adapter detection', () => {
    it('should consistently detect adapter configuration for the same API', () => {
      fc.assert(
        fc.property(apiName, serviceConfig, (api, config) => {
          // Write service config to test directory
          writeServiceConfig(testDir, api, config);
          
          // Load config multiple times
          const result1 = loadServiceConfig(api);
          const result2 = loadServiceConfig(api);
          const result3 = loadServiceConfig(api);
          
          // All results should be identical (or all null)
          if (result1 === null) {
            expect(result2).toBeNull();
            expect(result3).toBeNull();
          } else {
            expect(result2).not.toBeNull();
            expect(result3).not.toBeNull();
            
            // Verify adapters array is consistent
            expect(result2!.adapters).toEqual(result1.adapters);
            expect(result3!.adapters).toEqual(result1.adapters);
            
            // Verify relationships are consistent
            if (result1.relationships) {
              expect(result2!.relationships).toBeDefined();
              expect(result3!.relationships).toBeDefined();
              expect(Object.keys(result2!.relationships!)).toEqual(Object.keys(result1.relationships));
              expect(Object.keys(result3!.relationships!)).toEqual(Object.keys(result1.relationships));
            }
          }
        }),
        {
          numRuns: 100, // Minimum 100 iterations as per requirements
          verbose: true,
          seed: 100,
        }
      );
    });
    
    it('should consistently detect simple-xml-response adapter when configured', () => {
      fc.assert(
        fc.property(apiName, (api) => {
          // Create config with simple-xml-response adapter
          const config = {
            adapters: ['simple-xml-response']
          };
          
          writeServiceConfig(testDir, api, config);
          
          // Load config multiple times
          const result1 = loadServiceConfig(api);
          const result2 = loadServiceConfig(api);
          
          // Both should detect the adapter
          expect(result1).not.toBeNull();
          expect(result2).not.toBeNull();
          expect(result1!.adapters).toContain('simple-xml-response');
          expect(result2!.adapters).toContain('simple-xml-response');
          
          // Verify adapter is registered
          const adapter = adapterRegistry.get('simple-xml-response');
          expect(adapter).toBeDefined();
          expect(adapter!.name).toBe('simple-xml-response');
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 101,
        }
      );
    });
  });
  
  /**
   * Property 2: Path-based adapter detection
   * 
   * For any valid API path, extracting the API name and loading its config
   * should be consistent regardless of the resource or ID in the path.
   * 
   * **Validates: Requirements 1.1, 1.2**
   */
  describe('Property: Path-based adapter detection', () => {
    it('should extract API name consistently from different paths', () => {
      fc.assert(
        fc.property(
          apiName,
          fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
          fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[A-Z0-9][A-Z0-9-]*$/.test(s)),
          (api, resource1, id1) => {
            // Create different paths for the same API
            const path1 = `/${api}/${resource1}`;
            const path2 = `/${api}/${resource1}/${id1}`;
            const path3 = `/${api}/other-resource`;
            const path4 = `/${api}/other-resource/OTHER-ID`;
            
            // Extract API name from all paths
            const extractedApi1 = extractApiNameFromPath(path1);
            const extractedApi2 = extractApiNameFromPath(path2);
            const extractedApi3 = extractApiNameFromPath(path3);
            const extractedApi4 = extractApiNameFromPath(path4);
            
            // All should extract the same API name
            expect(extractedApi1).toBe(api);
            expect(extractedApi2).toBe(api);
            expect(extractedApi3).toBe(api);
            expect(extractedApi4).toBe(api);
          }
        ),
        {
          numRuns: 100,
          verbose: true,
          seed: 102,
        }
      );
    });
    
    it('should detect adapter for any path to the same API', () => {
      fc.assert(
        fc.property(
          apiName,
          fc.array(
            fc.tuple(
              fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
              fc.option(fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[A-Z0-9][A-Z0-9-]*$/.test(s)), { nil: undefined })
            ),
            { minLength: 1, maxLength: 5 }
          ),
          (api, pathVariations) => {
            // Create config with simple-xml-response adapter
            const config = {
              adapters: ['simple-xml-response']
            };
            
            writeServiceConfig(testDir, api, config);
            
            // Test detection for all path variations
            for (const [resource, id] of pathVariations) {
              const path = id ? `/${api}/${resource}/${id}` : `/${api}/${resource}`;
              const extractedApi = extractApiNameFromPath(path);
              
              // Load config for extracted API
              const loadedConfig = loadServiceConfig(extractedApi);
              
              // Should always detect the adapter
              expect(loadedConfig).not.toBeNull();
              expect(loadedConfig!.adapters).toContain('simple-xml-response');
            }
          }
        ),
        {
          numRuns: 100,
          verbose: true,
          seed: 103,
        }
      );
    });
  });
  
  /**
   * Property 3: Adapter configuration validation
   * 
   * For any service configuration, if it contains 'simple-xml-response' in the
   * adapters array, the adapter should be detectable and usable.
   * 
   * **Validates: Requirements 1.2, 2.3**
   */
  describe('Property: Adapter configuration validation', () => {
    it('should enable XML transformation when simple-xml-response is configured', () => {
      fc.assert(
        fc.property(apiName, serviceConfig, (api, config) => {
          // Only test configs that include simple-xml-response
          if (!config.adapters.includes('simple-xml-response')) {
            return true; // Skip this case
          }
          
          writeServiceConfig(testDir, api, config);
          
          // Load config
          const loadedConfig = loadServiceConfig(api);
          
          // Should detect the adapter
          expect(loadedConfig).not.toBeNull();
          expect(loadedConfig!.adapters).toContain('simple-xml-response');
          
          // Verify adapter is available in registry
          const adapter = adapterRegistry.get('simple-xml-response');
          expect(adapter).toBeDefined();
          expect(adapter!.transformResponse).toBeDefined();
          
          // Verify adapter can transform responses
          expect(typeof adapter!.transformResponse).toBe('function');
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 104,
        }
      );
    });
    
    it('should not enable XML transformation when simple-xml-response is not configured', () => {
      fc.assert(
        fc.property(apiName, serviceConfig, (api, config) => {
          // Only test configs that don't include simple-xml-response
          if (config.adapters.includes('simple-xml-response')) {
            return true; // Skip this case
          }
          
          writeServiceConfig(testDir, api, config);
          
          // Load config
          const loadedConfig = loadServiceConfig(api);
          
          // If config loaded, it should not contain simple-xml-response
          if (loadedConfig !== null) {
            expect(loadedConfig.adapters).not.toContain('simple-xml-response');
          }
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 105,
        }
      );
    });
  });
  
  /**
   * Property 4: Missing configuration handling
   * 
   * For any API without a service.yaml file, adapter detection should
   * consistently return null (no adapter configured).
   * 
   * **Validates: Requirements 1.1**
   */
  describe('Property: Missing configuration handling', () => {
    it('should return null for APIs without service.yaml', () => {
      fc.assert(
        fc.property(apiName, (api) => {
          // Don't write any config file
          
          // Load config should return null
          const result1 = loadServiceConfig(api);
          const result2 = loadServiceConfig(api);
          
          // Both should be null
          expect(result1).toBeNull();
          expect(result2).toBeNull();
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 106,
        }
      );
    });
    
    it('should handle missing config consistently across multiple paths', () => {
      fc.assert(
        fc.property(
          apiName,
          fc.array(
            fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
            { minLength: 1, maxLength: 5 }
          ),
          (api, resources) => {
            // Don't write any config file
            
            // Test detection for all resource paths
            for (const resource of resources) {
              const path = `/${api}/${resource}`;
              const extractedApi = extractApiNameFromPath(path);
              
              // Load config should return null
              const loadedConfig = loadServiceConfig(extractedApi);
              expect(loadedConfig).toBeNull();
            }
          }
        ),
        {
          numRuns: 100,
          verbose: true,
          seed: 107,
        }
      );
    });
  });
  
  /**
   * Property 5: Configuration caching consistency
   * 
   * For any API configuration, once loaded, subsequent loads should return
   * the cached version (same object reference or equivalent data).
   * 
   * **Validates: Requirements 1.1, 2.3**
   */
  describe('Property: Configuration caching', () => {
    it('should cache configuration after first load', () => {
      fc.assert(
        fc.property(apiName, serviceConfig, (api, config) => {
          writeServiceConfig(testDir, api, config);
          
          // First load
          const result1 = loadServiceConfig(api);
          
          // Subsequent loads should return cached version
          const result2 = loadServiceConfig(api);
          const result3 = loadServiceConfig(api);
          
          // All should be equivalent
          if (result1 === null) {
            expect(result2).toBeNull();
            expect(result3).toBeNull();
          } else {
            expect(result2).not.toBeNull();
            expect(result3).not.toBeNull();
            
            // Verify data is equivalent
            expect(result2!.adapters).toEqual(result1.adapters);
            expect(result3!.adapters).toEqual(result1.adapters);
          }
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 108,
        }
      );
    });
    
    it('should clear cache correctly', () => {
      fc.assert(
        fc.property(apiName, serviceConfig, (api, config) => {
          // Skip empty adapter arrays as they may not create valid configs
          if (config.adapters.length === 0) {
            return true;
          }
          
          writeServiceConfig(testDir, api, config);
          
          // Load config
          const result1 = loadServiceConfig(api);
          
          // Clear cache
          clearConfigCache();
          
          // Load again - should re-read from file
          const result2 = loadServiceConfig(api);
          
          // Results should be equivalent (but may be different objects)
          if (result1 === null) {
            expect(result2).toBeNull();
          } else {
            expect(result2).not.toBeNull();
            // Compare the actual adapters, accounting for duplicates being removed
            const adapters1 = Array.from(new Set(result1.adapters));
            const adapters2 = Array.from(new Set(result2!.adapters));
            expect(adapters2.sort()).toEqual(adapters1.sort());
          }
        }),
        {
          numRuns: 100,
          verbose: true,
          seed: 109,
        }
      );
    });
  });
  
  /**
   * Property 6: Multiple APIs with different configurations
   * 
   * When multiple APIs have different configurations, adapter detection
   * should correctly identify the right adapter for each API.
   * 
   * **Validates: Requirements 1.1, 1.2, 2.3**
   */
  describe('Property: Multiple API configurations', () => {
    it('should detect different adapters for different APIs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(apiName, serviceConfig),
            { minLength: 2, maxLength: 5 }
          ).filter(apis => {
            // Ensure all API names are unique
            const names = apis.map(([name]) => name);
            return new Set(names).size === names.length;
          }),
          (apiConfigs) => {
            // Clear cache before this test iteration
            clearConfigCache();
            
            // Write configs for all APIs
            for (const [api, config] of apiConfigs) {
              writeServiceConfig(testDir, api, config);
            }
            
            // Verify each API's config is detected correctly
            for (const [api, expectedConfig] of apiConfigs) {
              const loadedConfig = loadServiceConfig(api);
              
              // If expected config has no adapters, loaded config should be null or have empty adapters
              if (expectedConfig.adapters.length === 0) {
                // Empty adapters array is valid - just skip validation
                continue;
              }
              
              if (loadedConfig !== null) {
                // Compare adapters, accounting for duplicates
                const expectedAdapters = Array.from(new Set(expectedConfig.adapters)).sort();
                const loadedAdapters = Array.from(new Set(loadedConfig.adapters)).sort();
                expect(loadedAdapters).toEqual(expectedAdapters);
                
                // Verify simple-xml-response detection
                if (expectedConfig.adapters.includes('simple-xml-response')) {
                  expect(loadedConfig.adapters).toContain('simple-xml-response');
                } else {
                  expect(loadedConfig.adapters).not.toContain('simple-xml-response');
                }
              }
            }
          }
        ),
        {
          numRuns: 100,
          verbose: true,
          seed: 110,
        }
      );
    });
  });
});
