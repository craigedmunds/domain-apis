/**
 * Unit tests for Adapter Registry
 */

import { AdapterRegistry, Adapter, adapterRegistry } from './registry';

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('register', () => {
    it('should register an adapter successfully', () => {
      const mockAdapter: Adapter = {
        name: 'test-adapter',
      };

      registry.register(mockAdapter);
      
      const retrieved = registry.get('test-adapter');
      expect(retrieved).toBe(mockAdapter);
    });

    it('should throw error when registering duplicate adapter name', () => {
      const adapter1: Adapter = {
        name: 'duplicate-adapter',
      };
      const adapter2: Adapter = {
        name: 'duplicate-adapter',
      };

      registry.register(adapter1);
      
      expect(() => {
        registry.register(adapter2);
      }).toThrow('Adapter with name "duplicate-adapter" is already registered');
    });

    it('should register multiple adapters with different names', () => {
      const adapter1: Adapter = {
        name: 'adapter-1',
      };
      const adapter2: Adapter = {
        name: 'adapter-2',
      };

      registry.register(adapter1);
      registry.register(adapter2);
      
      expect(registry.get('adapter-1')).toBe(adapter1);
      expect(registry.get('adapter-2')).toBe(adapter2);
    });
  });

  describe('get', () => {
    it('should return adapter by name', () => {
      const mockAdapter: Adapter = {
        name: 'test-adapter',
      };

      registry.register(mockAdapter);
      
      const retrieved = registry.get('test-adapter');
      expect(retrieved).toBe(mockAdapter);
    });

    it('should return undefined for non-existent adapter', () => {
      const retrieved = registry.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no adapters registered', () => {
      const adapters = registry.getAll();
      expect(adapters).toEqual([]);
    });

    it('should return all registered adapters', () => {
      const adapter1: Adapter = {
        name: 'adapter-1',
      };
      const adapter2: Adapter = {
        name: 'adapter-2',
      };
      const adapter3: Adapter = {
        name: 'adapter-3',
      };

      registry.register(adapter1);
      registry.register(adapter2);
      registry.register(adapter3);
      
      const adapters = registry.getAll();
      expect(adapters).toHaveLength(3);
      expect(adapters).toContain(adapter1);
      expect(adapters).toContain(adapter2);
      expect(adapters).toContain(adapter3);
    });
  });

  describe('adapter with optional methods', () => {
    it('should register adapter with transformRequest method', () => {
      const mockAdapter: Adapter = {
        name: 'request-adapter',
        transformRequest: (body, headers) => ({
          body: { transformed: true, ...body },
          headers: { ...headers, 'X-Transformed': 'true' },
        }),
      };

      registry.register(mockAdapter);
      
      const retrieved = registry.get('request-adapter');
      expect(retrieved).toBe(mockAdapter);
      expect(retrieved?.transformRequest).toBeDefined();
    });

    it('should register adapter with transformResponse method', () => {
      const mockAdapter: Adapter = {
        name: 'response-adapter',
        transformResponse: (body, headers) => ({
          body: { transformed: true, ...body },
          headers: { ...headers, 'Content-Type': 'application/json' },
        }),
      };

      registry.register(mockAdapter);
      
      const retrieved = registry.get('response-adapter');
      expect(retrieved).toBe(mockAdapter);
      expect(retrieved?.transformResponse).toBeDefined();
    });

    it('should register adapter with injectLinks method', () => {
      const mockAdapter: Adapter = {
        name: 'link-adapter',
        injectLinks: (resource, config, stage) => ({
          ...resource,
          _links: {
            self: { href: `/${stage}/resource/${resource.id}` },
          },
        }),
      };

      registry.register(mockAdapter);
      
      const retrieved = registry.get('link-adapter');
      expect(retrieved).toBe(mockAdapter);
      expect(retrieved?.injectLinks).toBeDefined();
    });

    it('should register adapter with all optional methods', () => {
      const mockAdapter: Adapter = {
        name: 'full-adapter',
        transformRequest: (body, headers) => ({ body, headers }),
        transformResponse: (body, headers) => ({ body, headers }),
        injectLinks: (resource, config, stage) => resource,
      };

      registry.register(mockAdapter);
      
      const retrieved = registry.get('full-adapter');
      expect(retrieved).toBe(mockAdapter);
      expect(retrieved?.transformRequest).toBeDefined();
      expect(retrieved?.transformResponse).toBeDefined();
      expect(retrieved?.injectLinks).toBeDefined();
    });
  });

  describe('global adapterRegistry instance', () => {
    it('should be an instance of AdapterRegistry', () => {
      expect(adapterRegistry).toBeInstanceOf(AdapterRegistry);
    });

    it('should be a singleton', () => {
      // The global instance should be the same across imports
      expect(adapterRegistry).toBeDefined();
      
      // Register an adapter
      const mockAdapter: Adapter = {
        name: 'global-test-adapter',
      };
      
      adapterRegistry.register(mockAdapter);
      
      // Should be retrievable
      const retrieved = adapterRegistry.get('global-test-adapter');
      expect(retrieved).toBe(mockAdapter);
    });
  });
});
