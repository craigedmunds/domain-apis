/**
 * Service Configuration Loader
 * 
 * This module provides functionality to load and cache service.yaml configuration files
 * that define adapter requirements and relationship mappings for each API.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ServiceConfig } from '../adapters/registry';

/**
 * In-memory cache for loaded service configurations
 * Key: API name (e.g., "payment", "taxpayer")
 * Value: Parsed ServiceConfig object
 */
const configCache = new Map<string, ServiceConfig>();

/**
 * Get the base path to the specs directory containing service.yaml files
 * This should be set based on the Lambda deployment structure
 */
function getSpecsBasePath(): string {
  return process.env.SPECS_PATH || '/var/task/specs';
}

/**
 * Load service configuration for a specific API
 * 
 * This function reads the service.yaml file for the specified API and parses it
 * into a ServiceConfig object. Configurations are cached in memory to avoid
 * repeated file system reads.
 * 
 * @param apiName - The name of the API (e.g., "payment", "taxpayer")
 * @returns ServiceConfig object if found and valid, null otherwise
 * 
 * @example
 * ```typescript
 * const config = loadServiceConfig('payment');
 * if (config && config.adapters.includes('simple-xml-response')) {
 *   // Use XML adapter for this API
 * }
 * ```
 */
export function loadServiceConfig(apiName: string): ServiceConfig | null {
  // Check cache first
  if (configCache.has(apiName)) {
    return configCache.get(apiName)!;
  }

  try {
    // Construct path to service.yaml file
    const configPath = path.join(getSpecsBasePath(), apiName, 'service.yaml');

    // Check if file exists
    if (!fs.existsSync(configPath)) {
      // No service.yaml means no adapters configured - this is valid
      return null;
    }

    // Read and parse YAML file
    const fileContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContent) as ServiceConfig;

    // Validate configuration structure
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid service configuration: must be an object');
    }

    if (!Array.isArray(config.adapters)) {
      throw new Error('Invalid service configuration: adapters must be an array');
    }

    // Validate relationships if present
    if (config.relationships) {
      if (typeof config.relationships !== 'object') {
        throw new Error('Invalid service configuration: relationships must be an object');
      }

      // Validate each relationship configuration
      for (const [relationshipName, relationshipConfig] of Object.entries(config.relationships)) {
        if (!relationshipConfig.targetApi || typeof relationshipConfig.targetApi !== 'string') {
          throw new Error(`Invalid relationship "${relationshipName}": targetApi is required and must be a string`);
        }
        if (!relationshipConfig.targetResource || typeof relationshipConfig.targetResource !== 'string') {
          throw new Error(`Invalid relationship "${relationshipName}": targetResource is required and must be a string`);
        }
        if (!relationshipConfig.sourceField || typeof relationshipConfig.sourceField !== 'string') {
          throw new Error(`Invalid relationship "${relationshipName}": sourceField is required and must be a string`);
        }
        if (!relationshipConfig.linkType || typeof relationshipConfig.linkType !== 'string') {
          throw new Error(`Invalid relationship "${relationshipName}": linkType is required and must be a string`);
        }
        if (!relationshipConfig.linkTitle || typeof relationshipConfig.linkTitle !== 'string') {
          throw new Error(`Invalid relationship "${relationshipName}": linkTitle is required and must be a string`);
        }
      }
    }

    // Cache the validated configuration
    configCache.set(apiName, config);

    return config;
  } catch (error) {
    // Log error for debugging
    console.error(`Error loading service configuration for API "${apiName}":`, error);

    // Return null to indicate configuration could not be loaded
    // The caller should decide how to handle this (e.g., fall back to no adapter)
    return null;
  }
}

/**
 * Clear the configuration cache
 * 
 * This is primarily useful for testing or when configurations need to be reloaded.
 * In production, configurations are typically loaded once at Lambda initialization.
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Get all cached configurations
 * 
 * This is primarily useful for debugging and testing.
 * 
 * @returns Map of API names to their cached configurations
 */
export function getCachedConfigs(): Map<string, ServiceConfig> {
  return new Map(configCache);
}

/**
 * Set the base path for specs directory
 * 
 * This is primarily useful for testing with different directory structures.
 * 
 * @param basePath - The base path to the specs directory
 */
export function setSpecsBasePath(basePath: string): void {
  // This would require making SPECS_BASE_PATH mutable
  // For now, use the SPECS_PATH environment variable instead
  process.env.SPECS_PATH = basePath;
}
