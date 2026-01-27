/**
 * Unit Tests for Mock Server Functionality
 *
 * These tests verify that Prism mock servers:
 * 1. Start successfully and become healthy
 * 2. Return valid responses conforming to OpenAPI schemas
 * 3. Support VPD backend operations
 */

import {
  spawnMockServer,
  stopMockServer,
  healthCheck,
  API_CONFIGS,
  MockServerInstance,
  isValidResourceId,
  isValidLinkUrl,
  parseResponse,
} from '../helpers/mock-server-manager';

describe('Mock Server Unit Tests', () => {
  // Track active servers for cleanup
  let activeServers: MockServerInstance[] = [];

  // Final cleanup - each nested describe manages its own server lifecycle
  afterAll(async () => {
    // Clean up any remaining servers as a safety net
    activeServers.forEach(stopMockServer);
    activeServers = [];
    // Give processes time to clean up
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('Server Startup', () => {
    describe('Excise Duty System API', () => {
      it('should spawn and become healthy', async () => {
        const server = await spawnMockServer(API_CONFIGS.excise);
        activeServers.push(server);

        expect(server).toBeDefined();
        expect(server.name).toBe('Excise Duty System API');
        expect(server.port).toBe(5010);
        expect(server.baseUrl).toBe('http://localhost:5010');

        const isHealthy = await healthCheck(server);
        expect(isHealthy).toBe(true);
      }, 35000);

      it('should respond to registration requests', async () => {
        const server = await spawnMockServer(API_CONFIGS.excise);
        activeServers.push(server);

        const response = await fetch(`${server.baseUrl}/excise/vpd/registrations/VPD123456`);
        expect(response.status).toBe(200);
      }, 35000);
    });

    describe('Customer Master Data API', () => {
      it('should spawn and become healthy', async () => {
        const server = await spawnMockServer(API_CONFIGS.customer);
        activeServers.push(server);

        expect(server).toBeDefined();
        expect(server.name).toBe('Customer Master Data API');
        expect(server.port).toBe(5011);
        expect(server.baseUrl).toBe('http://localhost:5011');

        const isHealthy = await healthCheck(server);
        expect(isHealthy).toBe(true);
      }, 35000);

      it('should respond to customer requests', async () => {
        const server = await spawnMockServer(API_CONFIGS.customer);
        activeServers.push(server);

        const response = await fetch(`${server.baseUrl}/customers/CUST789`);
        expect(response.status).toBe(200);
      }, 35000);
    });

    describe('Tax Platform Submissions API', () => {
      it('should spawn and become healthy', async () => {
        const server = await spawnMockServer(API_CONFIGS['tax-platform']);
        activeServers.push(server);

        expect(server).toBeDefined();
        expect(server.name).toBe('Tax Platform Submissions API');
        expect(server.port).toBe(5012);
        expect(server.baseUrl).toBe('http://localhost:5012');

        const isHealthy = await healthCheck(server);
        expect(isHealthy).toBe(true);
      }, 35000);

      it('should respond to submission query requests', async () => {
        const server = await spawnMockServer(API_CONFIGS['tax-platform']);
        activeServers.push(server);

        const response = await fetch(
          `${server.baseUrl}/submissions/vpd?vpdApprovalNumber=VPD123456&periodKey=24A1`
        );
        expect(response.status).toBe(200);
      }, 35000);
    });
  });

  describe('Schema Conformance', () => {
    describe('Excise API Responses', () => {
      let server: MockServerInstance;

      beforeAll(async () => {
        server = await spawnMockServer(API_CONFIGS.excise);
        activeServers.push(server);
      }, 35000);

      afterAll(() => {
        if (server) {
          stopMockServer(server);
          activeServers = activeServers.filter((s) => s !== server);
        }
      });

      // Excise API returns XML - parse with parseResponse helper
      it('GET /excise/vpd/registrations/{vpdApprovalNumber} should return a valid Registration', async () => {
        const response = await fetch(`${server.baseUrl}/excise/vpd/registrations/VPD123456`);
        expect(response.status).toBe(200);

        const parsed = await parseResponse(response);
        const registration = parsed.registration || parsed;
        expect(registration).toHaveProperty('vpdApprovalNumber');
        expect(registration).toHaveProperty('customerId');
        expect(registration).toHaveProperty('status');
        expect(['ACTIVE', 'SUSPENDED', 'REVOKED']).toContain(registration.status);
      });

      it('GET /excise/vpd/periods/{periodKey} should return a valid Period', async () => {
        const response = await fetch(`${server.baseUrl}/excise/vpd/periods/24A1`);
        expect(response.status).toBe(200);

        const parsed = await parseResponse(response);
        const period = parsed.period || parsed;
        expect(period).toHaveProperty('periodKey');
        expect(period).toHaveProperty('startDate');
        expect(period).toHaveProperty('endDate');
        expect(period).toHaveProperty('state');
        expect(['OPEN', 'FILED', 'CLOSED']).toContain(period.state);
      });

      it('POST /excise/vpd/validate-and-calculate should return ValidationResponse', async () => {
        const response = await fetch(`${server.baseUrl}/excise/vpd/validate-and-calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vpdApprovalNumber: 'VPD123456',
            periodKey: '24A1',
            submission: {
              basicInformation: { returnType: 'ORIGINAL' },
              dutyProducts: [],
            },
          }),
        });
        expect(response.status).toBe(200);

        const parsed = await parseResponse(response);
        const validation = parsed.validationResult || parsed;
        expect(validation).toHaveProperty('valid');
        expect(validation).toHaveProperty('customerId');
      });
    });

    describe('Customer API Responses', () => {
      let server: MockServerInstance;

      beforeAll(async () => {
        server = await spawnMockServer(API_CONFIGS.customer);
        activeServers.push(server);
      }, 35000);

      afterAll(() => {
        if (server) {
          stopMockServer(server);
          activeServers = activeServers.filter((s) => s !== server);
        }
      });

      it('GET /customers/{customerId} should return a valid Customer', async () => {
        const response = await fetch(`${server.baseUrl}/customers/CUST789`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data).toHaveProperty('customerId');
        expect(data).toHaveProperty('name');
        expect(data).toHaveProperty('type');
        expect(['ORG', 'INDIVIDUAL']).toContain(data.type);
      });

      it('should return customer with address when available', async () => {
        const response = await fetch(`${server.baseUrl}/customers/CUST789`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        if (data.registeredAddress) {
          expect(data.registeredAddress).toHaveProperty('line1');
          expect(data.registeredAddress).toHaveProperty('postcode');
          expect(data.registeredAddress).toHaveProperty('country');
        }
      });
    });

    describe('Tax Platform API Responses', () => {
      let server: MockServerInstance;

      beforeAll(async () => {
        server = await spawnMockServer(API_CONFIGS['tax-platform']);
        activeServers.push(server);
      }, 35000);

      afterAll(() => {
        if (server) {
          stopMockServer(server);
          activeServers = activeServers.filter((s) => s !== server);
        }
      });

      it('GET /submissions/vpd should return a StoredSubmission', async () => {
        const response = await fetch(
          `${server.baseUrl}/submissions/vpd?vpdApprovalNumber=VPD123456&periodKey=24A1`
        );
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data).toHaveProperty('acknowledgementReference');
        expect(data).toHaveProperty('vpdApprovalNumber');
        expect(data).toHaveProperty('periodKey');
        expect(data).toHaveProperty('status');
        expect(['RECEIVED', 'VALIDATED', 'REJECTED']).toContain(data.status);
      });

      it('GET /submissions/vpd/{acknowledgementReference} should return a StoredSubmission', async () => {
        const response = await fetch(`${server.baseUrl}/submissions/vpd/ACK-2026-01-26-000123`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data).toHaveProperty('acknowledgementReference');
        expect(data).toHaveProperty('submittedAt');
        expect(data).toHaveProperty('calculations');
      });

      it('POST /submissions/vpd should return a StoreResponse', async () => {
        const response = await fetch(`${server.baseUrl}/submissions/vpd`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': 'test-key-123',
          },
          body: JSON.stringify({
            vpdApprovalNumber: 'VPD123456',
            periodKey: '24A1',
            customerId: 'CUST789',
            submission: {
              basicInformation: { returnType: 'ORIGINAL' },
              dutyProducts: [],
            },
            calculations: {
              totalDutyDue: { amount: 12345.67, currency: 'GBP' },
              vat: { amount: 2469.13, currency: 'GBP' },
              calculationHash: 'sha256:abc123',
            },
            warnings: [],
          }),
        });
        expect(response.status).toBe(201);

        const data: any = await response.json();
        expect(data).toHaveProperty('acknowledgementReference');
        expect(data).toHaveProperty('storedAt');
      });
    });
  });

  describe('Helper Function Tests', () => {
    describe('isValidResourceId', () => {
      it('should validate VPD approval numbers correctly', () => {
        expect(isValidResourceId('vpdApprovalNumber', 'VPD123456')).toBe(true);
        expect(isValidResourceId('vpdApprovalNumber', 'VPD999999')).toBe(true);
        expect(isValidResourceId('vpdApprovalNumber', 'VPD12345')).toBe(false); // Too short
        expect(isValidResourceId('vpdApprovalNumber', 'VPD1234567')).toBe(false); // Too long
        expect(isValidResourceId('vpdApprovalNumber', 'ABC123456')).toBe(false); // Wrong prefix
      });

      it('should validate customer IDs correctly', () => {
        expect(isValidResourceId('customerId', 'CUST789')).toBe(true);
        expect(isValidResourceId('customerId', 'CUST1234567')).toBe(true);
        expect(isValidResourceId('customerId', 'CUST12')).toBe(false); // Too short
        expect(isValidResourceId('customerId', 'ABC789')).toBe(false); // Wrong prefix
      });

      it('should validate period keys correctly', () => {
        expect(isValidResourceId('periodKey', '24A1')).toBe(true);
        expect(isValidResourceId('periodKey', '25B2')).toBe(true);
        expect(isValidResourceId('periodKey', '2024A1')).toBe(false); // Too long
        expect(isValidResourceId('periodKey', 'A1')).toBe(false); // Too short
      });

      it('should validate acknowledgement references correctly', () => {
        expect(isValidResourceId('acknowledgementReference', 'ACK-2026-01-26-000123')).toBe(true);
        expect(isValidResourceId('acknowledgementReference', 'ACK-2025-12-31-999999')).toBe(true);
        expect(isValidResourceId('acknowledgementReference', 'ACK123')).toBe(false); // Wrong format
      });
    });

    describe('isValidLinkUrl', () => {
      it('should validate excise URLs', () => {
        expect(isValidLinkUrl('/excise/vpd/registrations')).toBe(true);
        expect(isValidLinkUrl('/excise/vpd/registrations/VPD123456')).toBe(true);
        expect(isValidLinkUrl('/excise/vpd/periods')).toBe(true);
        expect(isValidLinkUrl('/excise/vpd/periods/24A1')).toBe(true);
        expect(isValidLinkUrl('/excise/vpd/validate-and-calculate')).toBe(true);
      });

      it('should validate customer URLs', () => {
        expect(isValidLinkUrl('/customers')).toBe(true);
        expect(isValidLinkUrl('/customers/CUST789')).toBe(true);
      });

      it('should validate submission URLs', () => {
        expect(isValidLinkUrl('/submissions/vpd')).toBe(true);
        expect(isValidLinkUrl('/submissions/vpd?vpdApprovalNumber=VPD123456&periodKey=24A1')).toBe(true);
        expect(isValidLinkUrl('/submissions/vpd/ACK-2026-01-26-000123')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(isValidLinkUrl('http://localhost:4010/excise/vpd/registrations')).toBe(false); // Full URL
        expect(isValidLinkUrl('excise/vpd/registrations')).toBe(false); // Missing leading slash
      });
    });
  });
});
