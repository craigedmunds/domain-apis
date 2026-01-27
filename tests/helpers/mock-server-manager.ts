/**
 * Mock Server Manager
 *
 * Provides utilities for spawning and managing Prism mock servers in tests.
 * Handles server startup, health checks, and cleanup.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

export interface MockServerConfig {
  name: string;
  specPath: string;
  port: number;
  healthCheckPath?: string;
}

export interface MockServerInstance {
  name: string;
  port: number;
  process: ChildProcess;
  baseUrl: string;
}

/**
 * Default configurations for the VPD backend mock APIs
 */
/**
 * Port offset for unit tests to avoid conflicts with Docker compose
 * Docker uses 4010-4012, unit tests use 5010-5012
 */
const UNIT_TEST_PORT_OFFSET = 1000;

export const API_CONFIGS: Record<string, MockServerConfig> = {
  excise: {
    name: 'Excise Duty System API',
    specPath: 'specs/vaping-duty/mocks/excise-api.yaml',
    port: 4010 + UNIT_TEST_PORT_OFFSET,
    healthCheckPath: '/excise/vpd/registrations/VPD123456',
  },
  customer: {
    name: 'Customer Master Data API',
    specPath: 'specs/vaping-duty/mocks/customer-api.yaml',
    port: 4011 + UNIT_TEST_PORT_OFFSET,
    healthCheckPath: '/customers/CUST789',
  },
  'tax-platform': {
    name: 'Tax Platform Submissions API',
    specPath: 'specs/vaping-duty/mocks/tax-platform-api.yaml',
    port: 4012 + UNIT_TEST_PORT_OFFSET,
    healthCheckPath: '/submissions/vpd?vpdApprovalNumber=VPD123456&periodKey=24A1',
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
        const healthPath = config.healthCheckPath || '/';
        const response = await fetch(`${baseUrl}${healthPath}`);
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
 * Spawns all VPD backend mock servers
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
 * @param apiName - The API name (excise, customer, tax-platform)
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
 * Resource ID patterns for VPD validation
 */
export const ID_PATTERNS = {
  vpdApprovalNumber: /^VPD\d{6}$/,
  customerId: /^CUST\d{3,}$/,
  periodKey: /^\d{2}[A-Z]\d$/,
  acknowledgementReference: /^ACK-\d{4}-\d{2}-\d{2}-\d{6}$/,
};

/**
 * Validates a resource ID against its expected pattern
 *
 * @param resourceType - The type of resource
 * @param id - The ID to validate
 * @returns true if the ID matches the expected pattern
 */
export function isValidResourceId(resourceType: keyof typeof ID_PATTERNS, id: string): boolean {
  const pattern = ID_PATTERNS[resourceType];
  return pattern ? pattern.test(id) : false;
}

/**
 * Validates that a link URL follows expected VPD patterns
 *
 * @param linkUrl - The URL to validate
 * @returns true if the URL is a valid path-only URL
 */
export function isValidLinkUrl(linkUrl: string): boolean {
  // Links should be path-only URLs starting with /
  if (!linkUrl.startsWith('/')) {
    return false;
  }

  // Should match one of the known VPD path patterns
  const validPathPatterns = [
    /^\/excise\/vpd\/registrations(\/VPD\d{6})?$/,
    /^\/excise\/vpd\/periods(\/\d{2}[A-Z]\d)?$/,
    /^\/excise\/vpd\/validate-and-calculate$/,
    /^\/customers(\/CUST\d{3,})?$/,
    /^\/submissions\/vpd$/,
    /^\/submissions\/vpd\?.*$/,
    /^\/submissions\/vpd\/ACK-[\d-]+$/,
  ];

  return validPathPatterns.some((pattern) => pattern.test(linkUrl));
}

/**
 * XML Parser instance configured for VPD API responses
 */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/**
 * Parses XML response body to JavaScript object
 *
 * @param xmlText - Raw XML string
 * @returns Parsed JavaScript object
 */
export function parseXml(xmlText: string): any {
  return xmlParser.parse(xmlText);
}

/**
 * Fetches and parses response - handles both JSON and XML content types
 *
 * @param response - Fetch response object
 * @returns Parsed response body as JavaScript object
 */
export async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('application/xml') || text.trim().startsWith('<?xml')) {
    return parseXml(text);
  }

  return JSON.parse(text);
}
