/**
 * Tests for adapter registration in the gateway Lambda handler
 * 
 * These tests verify that adapters are properly registered and can be
 * retrieved from the adapter registry.
 */

// Import the index module to trigger adapter registration
import './index';
import { adapterRegistry } from './adapters/registry';

describe('Adapter Registration', () => {
  it('should register SimpleXmlResponseAdapter on module load', () => {
    // The adapter should be registered when the module loads
    const adapter = adapterRegistry.get('simple-xml-response');
    
    expect(adapter).toBeDefined();
    expect(adapter?.name).toBe('simple-xml-response');
  });

  it('should have transformResponse method', () => {
    const adapter = adapterRegistry.get('simple-xml-response');
    
    expect(adapter?.transformResponse).toBeDefined();
    expect(typeof adapter?.transformResponse).toBe('function');
  });

  it('should have injectLinks method', () => {
    const adapter = adapterRegistry.get('simple-xml-response');
    
    expect(adapter?.injectLinks).toBeDefined();
    expect(typeof adapter?.injectLinks).toBe('function');
  });

  it('should not have transformRequest method', () => {
    const adapter = adapterRegistry.get('simple-xml-response');
    
    // SimpleXmlResponseAdapter only handles responses, not requests
    expect(adapter?.transformRequest).toBeUndefined();
  });

  it('should list all registered adapters', () => {
    const adapters = adapterRegistry.getAll();
    
    expect(adapters.length).toBeGreaterThan(0);
    expect(adapters.some(a => a.name === 'simple-xml-response')).toBe(true);
  });
});
