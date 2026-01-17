/**
 * Unit tests for Service Configuration Loader
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadServiceConfig, clearConfigCache, getCachedConfigs, setSpecsBasePath } from './service-config';

// Mock fs module
jest.mock('fs');

describe('Service Configuration Loader', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    // Clear cache before each test
    clearConfigCache();
    // Reset all mocks
    jest.clearAllMocks();
    // Set test specs path
    process.env.SPECS_PATH = '/test/specs';
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.SPECS_PATH;
  });

  describe('loadServiceConfig', () => {
    it('should load and parse valid service.yaml file', () => {
      const validConfig = `
adapters:
  - simple-xml-response
relationships:
  taxpayer:
    targetApi: taxpayer
    targetResource: taxpayers
    sourceField: taxpayerId
    linkType: taxpayer
    linkTitle: "Taxpayer who made this payment"
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(validConfig);

      const config = loadServiceConfig('payment');

      expect(config).not.toBeNull();
      expect(config?.adapters).toEqual(['simple-xml-response']);
      expect(config?.relationships).toBeDefined();
      expect(config?.relationships?.taxpayer).toBeDefined();
      expect(config?.relationships?.taxpayer.targetApi).toBe('taxpayer');
      expect(config?.relationships?.taxpayer.sourceField).toBe('taxpayerId');
    });

    it('should return null when service.yaml does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = loadServiceConfig('taxpayer');

      expect(config).toBeNull();
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should cache loaded configurations', () => {
      const validConfig = `
adapters:
  - simple-xml-response
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(validConfig);

      // First call
      const config1 = loadServiceConfig('payment');
      expect(config1).not.toBeNull();
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const config2 = loadServiceConfig('payment');
      expect(config2).toBe(config1);
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should return null for malformed YAML', () => {
      const malformedYaml = `
adapters:
  - simple-xml-response
  invalid yaml structure
    - broken
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(malformedYaml);

      const config = loadServiceConfig('payment');

      expect(config).toBeNull();
    });

    it('should return null when adapters is not an array', () => {
      const invalidConfig = `
adapters: "not-an-array"
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(invalidConfig);

      const config = loadServiceConfig('payment');

      expect(config).toBeNull();
    });

    it('should return null when config is not an object', () => {
      const invalidConfig = `"just a string"`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(invalidConfig);

      const config = loadServiceConfig('payment');

      expect(config).toBeNull();
    });

    it('should validate relationship configuration fields', () => {
      const invalidRelationshipConfig = `
adapters:
  - simple-xml-response
relationships:
  taxpayer:
    targetApi: taxpayer
    # Missing required fields
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(invalidRelationshipConfig);

      const config = loadServiceConfig('payment');

      expect(config).toBeNull();
    });

    it('should accept configuration without relationships', () => {
      const minimalConfig = `
adapters:
  - simple-xml-response
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(minimalConfig);

      const config = loadServiceConfig('payment');

      expect(config).not.toBeNull();
      expect(config?.adapters).toEqual(['simple-xml-response']);
      expect(config?.relationships).toBeUndefined();
    });

    it('should validate all required relationship fields', () => {
      const completeConfig = `
adapters:
  - simple-xml-response
relationships:
  taxpayer:
    targetApi: taxpayer
    targetResource: taxpayers
    sourceField: taxpayerId
    linkType: taxpayer
    linkTitle: "Taxpayer who made this payment"
  allocations:
    targetApi: payment
    targetResource: allocations
    sourceField: id
    urlPattern: "/payments/{id}/allocations"
    linkType: collection
    linkTitle: "Allocations for this payment"
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(completeConfig);

      const config = loadServiceConfig('payment');

      expect(config).not.toBeNull();
      expect(config?.relationships?.taxpayer).toBeDefined();
      expect(config?.relationships?.allocations).toBeDefined();
      expect(config?.relationships?.allocations.urlPattern).toBe('/payments/{id}/allocations');
    });

    it('should handle file system errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const config = loadServiceConfig('payment');

      expect(config).toBeNull();
    });

    it('should construct correct file path', () => {
      mockFs.existsSync.mockReturnValue(false);

      loadServiceConfig('payment');

      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/specs/payment/service.yaml');
    });
  });

  describe('clearConfigCache', () => {
    it('should clear all cached configurations', () => {
      const validConfig = `
adapters:
  - simple-xml-response
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(validConfig);

      // Load a config to populate cache
      loadServiceConfig('payment');
      expect(getCachedConfigs().size).toBe(1);

      // Clear cache
      clearConfigCache();
      expect(getCachedConfigs().size).toBe(0);

      // Next load should read from file again
      loadServiceConfig('payment');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCachedConfigs', () => {
    it('should return a copy of cached configurations', () => {
      const validConfig = `
adapters:
  - simple-xml-response
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(validConfig);

      loadServiceConfig('payment');
      loadServiceConfig('taxpayer');

      const cached = getCachedConfigs();
      expect(cached.size).toBe(2);
      expect(cached.has('payment')).toBe(true);
      expect(cached.has('taxpayer')).toBe(true);
    });

    it('should return empty map when no configs are cached', () => {
      const cached = getCachedConfigs();
      expect(cached.size).toBe(0);
    });
  });
});
