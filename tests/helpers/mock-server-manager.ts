/**
 * Mock Server Manager
 *
 * Provides utilities for spawning and managing Prism mock servers in tests.
 * Handles server startup, health checks, and cleanup.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export interface MockServerConfig {
  name: string;
  specPath: string;
  port: number;
}

export interface MockServerInstance {
  name: string;
  port: number;
  process: ChildProcess;
  baseUrl: string;
}

/**
 * Default configurations for the three Domain APIs
 */
export const API_CONFIGS: Record<string, MockServerConfig> = {
  taxpayer: {
    name: 'Taxpayer API',
    specPath: 'specs/taxpayer/taxpayer-api.yaml',
    port: 8081,
  },
  'income-tax': {
    name: 'Income Tax API',
    specPath: 'specs/income-tax/income-tax-api.yaml',
    port: 8082,
  },
  payment: {
    name: 'Payment API',
    specPath: 'specs/payment/payment-api.yaml',
    port: 8083,
  },
};

/**
 * Spawns a Prism mock server for the given configuration
 *
 * @param config - Server configuration (name, specPath, port)
 * @returns Promise resolving to MockServerInstance when server is healthy
 */
export async function spawnMockServer(config: MockServerConfig): Promise<MockServerInstance> {
  const specFullPath = path.join(process.cwd(), config.specPath);
  const baseUrl = `http://localhost:${config.port}`;

  return new Promise((resolve, reject) => {
    // Note: Not using -d flag so Prism uses examples from spec instead of generating random data
    const serverProcess = spawn('npx', ['prism', 'mock', specFullPath, '-p', config.port.toString()], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      shell: true,
    });

    let startupOutput = '';
    let errorOutput = '';

    serverProcess.stdout?.on('data', (data) => {
      startupOutput += data.toString();
    });

    serverProcess.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    serverProcess.on('error', (error) => {
      reject(new Error(`Failed to spawn ${config.name} mock server: ${error.message}`));
    });

    // Wait for server to be ready by checking health
    const healthCheckInterval = setInterval(async () => {
      try {
        const response = await fetch(baseUrl);
        // Prism returns 404 for root path but that means it's running
        if (response.status === 404 || response.ok) {
          clearInterval(healthCheckInterval);
          resolve({
            name: config.name,
            port: config.port,
            process: serverProcess,
            baseUrl,
          });
        }
      } catch {
        // Server not ready yet, continue waiting
      }
    }, 200);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(healthCheckInterval);
      serverProcess.kill();
      reject(
        new Error(
          `${config.name} mock server failed to start within timeout.\nStdout: ${startupOutput}\nStderr: ${errorOutput}`
        )
      );
    }, 30000);
  });
}

/**
 * Spawns all three Domain API mock servers
 *
 * @returns Promise resolving to an array of MockServerInstance
 */
export async function spawnAllMockServers(): Promise<MockServerInstance[]> {
  const configs = Object.values(API_CONFIGS);
  const servers = await Promise.all(configs.map((config) => spawnMockServer(config)));
  return servers;
}

/**
 * Stops a mock server instance
 *
 * @param server - The server instance to stop
 */
export function stopMockServer(server: MockServerInstance): void {
  if (server.process && !server.process.killed) {
    // Kill the process and all its children
    try {
      // First try SIGTERM
      server.process.kill('SIGTERM');
      // Force kill after a short delay if still running
      setTimeout(() => {
        if (!server.process.killed) {
          server.process.kill('SIGKILL');
        }
      }, 1000);
    } catch {
      // Ignore errors if process already terminated
    }
  }
}

/**
 * Stops all mock server instances
 *
 * @param servers - Array of server instances to stop
 */
export function stopAllMockServers(servers: MockServerInstance[]): void {
  servers.forEach(stopMockServer);
}

/**
 * Performs a health check on a mock server
 *
 * @param server - The server instance to check
 * @returns Promise resolving to true if server is healthy
 */
export async function healthCheck(server: MockServerInstance): Promise<boolean> {
  try {
    const response = await fetch(server.baseUrl);
    // Prism returns 404 for root but that means it's running
    return response.status === 404 || response.ok;
  } catch {
    return false;
  }
}

/**
 * Waits for a server to become healthy with retry logic
 *
 * @param server - The server instance to wait for
 * @param maxRetries - Maximum number of health check retries
 * @param retryDelayMs - Delay between retries in milliseconds
 * @returns Promise resolving to true if server becomes healthy
 */
export async function waitForHealth(
  server: MockServerInstance,
  maxRetries: number = 15,
  retryDelayMs: number = 500
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const isHealthy = await healthCheck(server);
    if (isHealthy) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
  return false;
}

/**
 * Gets the base URL for a specific API
 *
 * @param apiName - The API name (taxpayer, income-tax, payment)
 * @returns The base URL for the API
 */
export function getApiBaseUrl(apiName: string): string {
  const config = API_CONFIGS[apiName];
  if (!config) {
    throw new Error(`Unknown API: ${apiName}`);
  }
  return `http://localhost:${config.port}`;
}

/**
 * Resource ID patterns for validation
 */
export const ID_PATTERNS = {
  taxpayer: /^TP\d{6}$/,
  taxReturn: /^TR\d{8}$/,
  payment: /^PM\d{8}$/,
  assessment: /^AS\d{8}$/,
  allocation: /^AL\d{8}$/,
};

/**
 * Validates a resource ID against its expected pattern
 *
 * @param resourceType - The type of resource (taxpayer, taxReturn, payment, assessment, allocation)
 * @param id - The ID to validate
 * @returns true if the ID matches the expected pattern
 */
export function isValidResourceId(resourceType: keyof typeof ID_PATTERNS, id: string): boolean {
  const pattern = ID_PATTERNS[resourceType];
  return pattern ? pattern.test(id) : false;
}

/**
 * Validates that a link URL follows expected patterns
 *
 * @param linkUrl - The URL to validate
 * @returns true if the URL is a valid path-only URL
 */
export function isValidLinkUrl(linkUrl: string): boolean {
  // Links should be path-only URLs starting with /
  if (!linkUrl.startsWith('/')) {
    return false;
  }

  // Should match one of the known path patterns
  const validPathPatterns = [
    /^\/taxpayers(\/TP\d{6})?$/,
    /^\/taxpayers\?.*$/,
    /^\/tax-returns(\/TR\d{8})?$/,
    /^\/tax-returns\?.*$/,
    /^\/tax-returns\/TR\d{8}\/assessments$/,
    /^\/assessments(\/AS\d{8})?$/,
    /^\/payments(\/PM\d{8})?$/,
    /^\/payments\?.*$/,
    /^\/payments\/PM\d{8}\/allocations$/,
    /^\/allocations(\/AL\d{8})?$/,
    /^\/allocations\?.*$/,
  ];

  return validPathPatterns.some((pattern) => pattern.test(linkUrl));
}
