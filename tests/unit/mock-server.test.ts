/**
 * Unit Tests for Mock Server Functionality (Task 8.5)
 *
 * These tests verify that Prism mock servers:
 * 1. Start successfully and become healthy
 * 2. Return valid responses conforming to OpenAPI schemas
 * 3. Generate correctly-formed relationship links
 */

import {
  spawnMockServer,
  stopMockServer,
  healthCheck,
  API_CONFIGS,
  MockServerInstance,
  isValidResourceId,
  isValidLinkUrl,
} from '../helpers/mock-server-manager';
import { loadSpec } from '../helpers/openapi-validator';

describe('Mock Server Unit Tests', () => {
  // Track active servers for cleanup
  let activeServers: MockServerInstance[] = [];

  afterEach(async () => {
    // Clean up any active servers after each test
    activeServers.forEach(stopMockServer);
    activeServers = [];
    // Give processes time to clean up
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('Server Startup', () => {
    describe('Taxpayer API', () => {
      it('should spawn and become healthy', async () => {
        const server = await spawnMockServer(API_CONFIGS.taxpayer);
        activeServers.push(server);

        expect(server).toBeDefined();
        expect(server.name).toBe('Taxpayer API');
        expect(server.port).toBe(8081);
        expect(server.baseUrl).toBe('http://localhost:8081');

        const isHealthy = await healthCheck(server);
        expect(isHealthy).toBe(true);
      }, 35000);

      it('should respond to requests', async () => {
        const server = await spawnMockServer(API_CONFIGS.taxpayer);
        activeServers.push(server);

        const response = await fetch(`${server.baseUrl}/taxpayers`);
        expect(response.status).toBe(200);
      }, 35000);
    });

    describe('Income Tax API', () => {
      it('should spawn and become healthy', async () => {
        const server = await spawnMockServer(API_CONFIGS['income-tax']);
        activeServers.push(server);

        expect(server).toBeDefined();
        expect(server.name).toBe('Income Tax API');
        expect(server.port).toBe(8082);
        expect(server.baseUrl).toBe('http://localhost:8082');

        const isHealthy = await healthCheck(server);
        expect(isHealthy).toBe(true);
      }, 35000);

      it('should respond to requests', async () => {
        const server = await spawnMockServer(API_CONFIGS['income-tax']);
        activeServers.push(server);

        const response = await fetch(`${server.baseUrl}/tax-returns`);
        expect(response.status).toBe(200);
      }, 35000);
    });

    describe('Payment API', () => {
      it('should spawn and become healthy', async () => {
        const server = await spawnMockServer(API_CONFIGS.payment);
        activeServers.push(server);

        expect(server).toBeDefined();
        expect(server.name).toBe('Payment API');
        expect(server.port).toBe(8083);
        expect(server.baseUrl).toBe('http://localhost:8083');

        const isHealthy = await healthCheck(server);
        expect(isHealthy).toBe(true);
      }, 35000);

      it('should respond to requests', async () => {
        const server = await spawnMockServer(API_CONFIGS.payment);
        activeServers.push(server);

        const response = await fetch(`${server.baseUrl}/payments`);
        expect(response.status).toBe(200);
      }, 35000);
    });
  });

  describe('Schema Conformance', () => {
    describe('Taxpayer API Responses', () => {
      let server: MockServerInstance;

      beforeAll(async () => {
        server = await spawnMockServer(API_CONFIGS.taxpayer);
        activeServers.push(server);
      }, 35000);

      afterAll(() => {
        if (server) {
          stopMockServer(server);
          activeServers = activeServers.filter((s) => s !== server);
        }
      });

      it('GET /taxpayers should return a collection with items and _links', async () => {
        const response = await fetch(`${server.baseUrl}/taxpayers`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data).toHaveProperty('items');
        expect(Array.isArray(data.items)).toBe(true);
        expect(data).toHaveProperty('_links');
        expect(data._links).toHaveProperty('self');
      });

      it('GET /taxpayers/{id} should return a valid Taxpayer resource', async () => {
        const response = await fetch(`${server.baseUrl}/taxpayers/TP123456`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('type', 'taxpayer');
        expect(data).toHaveProperty('nino');
        expect(data.nino).toMatch(/^[A-Z]{2}\d{6}[A-Z]$/);
        expect(data).toHaveProperty('name');
        expect(data.name).toHaveProperty('firstName');
        expect(data.name).toHaveProperty('lastName');
        expect(data).toHaveProperty('address');
        expect(data).toHaveProperty('_links');
      });
    });

    describe('Income Tax API Responses', () => {
      let server: MockServerInstance;

      beforeAll(async () => {
        server = await spawnMockServer(API_CONFIGS['income-tax']);
        activeServers.push(server);
      }, 35000);

      afterAll(() => {
        if (server) {
          stopMockServer(server);
          activeServers = activeServers.filter((s) => s !== server);
        }
      });

      it('GET /tax-returns should return a collection with items and _links', async () => {
        const response = await fetch(`${server.baseUrl}/tax-returns`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data).toHaveProperty('items');
        expect(Array.isArray(data.items)).toBe(true);
        expect(data).toHaveProperty('_links');
        expect(data._links).toHaveProperty('self');
      });

      it('GET /tax-returns/{id} should return a valid TaxReturn resource', async () => {
        const response = await fetch(`${server.baseUrl}/tax-returns/TR20230001`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('type', 'tax-return');
        expect(data).toHaveProperty('taxpayerId');
        expect(data).toHaveProperty('taxYear');
        expect(data.taxYear).toMatch(/^\d{4}-\d{2}$/);
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('_links');
      });
    });

    describe('Payment API Responses', () => {
      let server: MockServerInstance;

      beforeAll(async () => {
        server = await spawnMockServer(API_CONFIGS.payment);
        activeServers.push(server);
      }, 35000);

      afterAll(() => {
        if (server) {
          stopMockServer(server);
          activeServers = activeServers.filter((s) => s !== server);
        }
      });

      it('GET /payments should return a collection with items and _links', async () => {
        const response = await fetch(`${server.baseUrl}/payments`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data).toHaveProperty('items');
        expect(Array.isArray(data.items)).toBe(true);
        expect(data).toHaveProperty('_links');
        expect(data._links).toHaveProperty('self');
      });

      it('GET /payments/{id} should return a valid Payment resource', async () => {
        const response = await fetch(`${server.baseUrl}/payments/PM20230001`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('type', 'payment');
        expect(data).toHaveProperty('taxpayerId');
        expect(data).toHaveProperty('amount');
        expect(data.amount).toHaveProperty('amount');
        expect(data.amount).toHaveProperty('currency', 'GBP');
        expect(data).toHaveProperty('paymentMethod');
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('_links');
      });
    });
  });

  describe('Link Format Validation', () => {
    describe('Taxpayer API Links', () => {
      let server: MockServerInstance;

      beforeAll(async () => {
        server = await spawnMockServer(API_CONFIGS.taxpayer);
        activeServers.push(server);
      }, 35000);

      afterAll(() => {
        if (server) {
          stopMockServer(server);
          activeServers = activeServers.filter((s) => s !== server);
        }
      });

      it('should have valid self link for taxpayer resource', async () => {
        const response = await fetch(`${server.baseUrl}/taxpayers/TP123456`);
        const data: any = await response.json();

        expect(data._links.self).toBeDefined();
        const selfLink = typeof data._links.self === 'string' ? data._links.self : data._links.self.href;
        expect(selfLink).toContain('/taxpayers/');
      });

      it('should have valid taxReturns relationship link', async () => {
        const response = await fetch(`${server.baseUrl}/taxpayers/TP123456`);
        const data: any = await response.json();

        if (data._links.taxReturns) {
          const taxReturnsLink = data._links.taxReturns.href || data._links.taxReturns;
          expect(taxReturnsLink).toContain('/tax-returns');
          expect(taxReturnsLink).toContain('taxpayerId=');
        }
      });

      it('should have valid payments relationship link', async () => {
        const response = await fetch(`${server.baseUrl}/taxpayers/TP123456`);
        const data: any = await response.json();

        if (data._links.payments) {
          const paymentsLink = data._links.payments.href || data._links.payments;
          expect(paymentsLink).toContain('/payments');
          expect(paymentsLink).toContain('taxpayerId=');
        }
      });
    });

    describe('Income Tax API Links', () => {
      let server: MockServerInstance;

      beforeAll(async () => {
        server = await spawnMockServer(API_CONFIGS['income-tax']);
        activeServers.push(server);
      }, 35000);

      afterAll(() => {
        if (server) {
          stopMockServer(server);
          activeServers = activeServers.filter((s) => s !== server);
        }
      });

      it('should have valid self link for tax-return resource', async () => {
        const response = await fetch(`${server.baseUrl}/tax-returns/TR20230001`);
        const data: any = await response.json();

        expect(data._links.self).toBeDefined();
        const selfLink = typeof data._links.self === 'string' ? data._links.self : data._links.self.href;
        expect(selfLink).toContain('/tax-returns/');
      });

      it('should have valid taxpayer relationship link', async () => {
        const response = await fetch(`${server.baseUrl}/tax-returns/TR20230001`);
        const data: any = await response.json();

        if (data._links.taxpayer) {
          const taxpayerLink = data._links.taxpayer.href || data._links.taxpayer;
          expect(taxpayerLink).toContain('/taxpayers/');
        }
      });

      it('should have valid assessments relationship link', async () => {
        const response = await fetch(`${server.baseUrl}/tax-returns/TR20230001`);
        const data: any = await response.json();

        if (data._links.assessments) {
          const assessmentsLink = data._links.assessments.href || data._links.assessments;
          expect(assessmentsLink).toContain('/assessments');
        }
      });
    });

    describe('Payment API Links', () => {
      let server: MockServerInstance;

      beforeAll(async () => {
        server = await spawnMockServer(API_CONFIGS.payment);
        activeServers.push(server);
      }, 35000);

      afterAll(() => {
        if (server) {
          stopMockServer(server);
          activeServers = activeServers.filter((s) => s !== server);
        }
      });

      it('should have valid self link for payment resource', async () => {
        const response = await fetch(`${server.baseUrl}/payments/PM20230001`);
        const data: any = await response.json();

        expect(data._links.self).toBeDefined();
        const selfLink = typeof data._links.self === 'string' ? data._links.self : data._links.self.href;
        expect(selfLink).toContain('/payments/');
      });

      it('should have valid taxpayer relationship link', async () => {
        const response = await fetch(`${server.baseUrl}/payments/PM20230001`);
        const data: any = await response.json();

        if (data._links.taxpayer) {
          const taxpayerLink = data._links.taxpayer.href || data._links.taxpayer;
          expect(taxpayerLink).toContain('/taxpayers/');
        }
      });

      it('should have valid allocations relationship link', async () => {
        const response = await fetch(`${server.baseUrl}/payments/PM20230001`);
        const data: any = await response.json();

        if (data._links.allocations) {
          const allocationsLink = data._links.allocations.href || data._links.allocations;
          expect(allocationsLink).toContain('/allocations');
        }
      });
    });
  });

  describe('Helper Function Tests', () => {
    describe('isValidResourceId', () => {
      it('should validate taxpayer IDs correctly', () => {
        expect(isValidResourceId('taxpayer', 'TP123456')).toBe(true);
        expect(isValidResourceId('taxpayer', 'TP999999')).toBe(true);
        expect(isValidResourceId('taxpayer', 'TP12345')).toBe(false); // Too short
        expect(isValidResourceId('taxpayer', 'TP1234567')).toBe(false); // Too long
        expect(isValidResourceId('taxpayer', 'TX123456')).toBe(false); // Wrong prefix
      });

      it('should validate tax return IDs correctly', () => {
        expect(isValidResourceId('taxReturn', 'TR20230001')).toBe(true);
        expect(isValidResourceId('taxReturn', 'TR99999999')).toBe(true);
        expect(isValidResourceId('taxReturn', 'TR2023001')).toBe(false); // Too short
        expect(isValidResourceId('taxReturn', 'TX20230001')).toBe(false); // Wrong prefix
      });

      it('should validate payment IDs correctly', () => {
        expect(isValidResourceId('payment', 'PM20230001')).toBe(true);
        expect(isValidResourceId('payment', 'PM99999999')).toBe(true);
        expect(isValidResourceId('payment', 'PM2023001')).toBe(false); // Too short
        expect(isValidResourceId('payment', 'PY20230001')).toBe(false); // Wrong prefix
      });
    });

    describe('isValidLinkUrl', () => {
      it('should validate taxpayer URLs', () => {
        expect(isValidLinkUrl('/taxpayers')).toBe(true);
        expect(isValidLinkUrl('/taxpayers/TP123456')).toBe(true);
        expect(isValidLinkUrl('/taxpayers?nino=AB123456C')).toBe(true);
      });

      it('should validate tax-return URLs', () => {
        expect(isValidLinkUrl('/tax-returns')).toBe(true);
        expect(isValidLinkUrl('/tax-returns/TR20230001')).toBe(true);
        expect(isValidLinkUrl('/tax-returns?taxpayerId=TP123456')).toBe(true);
        expect(isValidLinkUrl('/tax-returns/TR20230001/assessments')).toBe(true);
      });

      it('should validate payment URLs', () => {
        expect(isValidLinkUrl('/payments')).toBe(true);
        expect(isValidLinkUrl('/payments/PM20230001')).toBe(true);
        expect(isValidLinkUrl('/payments?taxpayerId=TP123456')).toBe(true);
        expect(isValidLinkUrl('/payments/PM20230001/allocations')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(isValidLinkUrl('http://localhost:8081/taxpayers')).toBe(false); // Full URL
        expect(isValidLinkUrl('taxpayers')).toBe(false); // Missing leading slash
      });
    });
  });
});
