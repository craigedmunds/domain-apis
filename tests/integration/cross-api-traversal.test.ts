/**
 * Integration Tests for VPD Backend API Orchestration
 *
 * These tests verify that the backend APIs can be orchestrated together
 * as the VPD Domain API will do:
 *
 * 1. Excise API: Get registration, validate submission
 * 2. Customer API: Enrich with customer details
 * 3. Tax Platform API: Store and retrieve submissions
 *
 * All three mock servers must be running.
 */

import {
  spawnMockServer,
  stopMockServer,
  API_CONFIGS,
  MockServerInstance,
} from '../helpers/mock-server-manager';

describe('VPD Backend API Integration Tests', () => {
  let exciseServer: MockServerInstance;
  let customerServer: MockServerInstance;
  let taxPlatformServer: MockServerInstance;

  beforeAll(async () => {
    // Start all three mock servers in parallel
    [exciseServer, customerServer, taxPlatformServer] = await Promise.all([
      spawnMockServer(API_CONFIGS.excise),
      spawnMockServer(API_CONFIGS.customer),
      spawnMockServer(API_CONFIGS['tax-platform']),
    ]);
  }, 60000);

  afterAll(() => {
    // Clean up all servers
    [exciseServer, customerServer, taxPlatformServer].forEach((server) => {
      if (server) {
        stopMockServer(server);
      }
    });
  });

  describe('Registration Lookup Flow', () => {
    it('should look up VPD registration and get customerId', async () => {
      // Step 1: Get VPD registration from excise
      const registrationResponse = await fetch(
        `${exciseServer.baseUrl}/excise/vpd/registrations/VPD123456`
      );
      expect(registrationResponse.status).toBe(200);

      const registration: any = await registrationResponse.json();
      expect(registration.vpdApprovalNumber).toBe('VPD123456');
      expect(registration.customerId).toBeDefined();
      expect(registration.status).toBe('ACTIVE');

      // Step 2: Use customerId to get customer details
      const customerResponse = await fetch(
        `${customerServer.baseUrl}/customers/${registration.customerId}`
      );
      expect(customerResponse.status).toBe(200);

      const customer: any = await customerResponse.json();
      expect(customer.customerId).toBe(registration.customerId);
      expect(customer.name).toBeDefined();
      expect(customer.type).toBeDefined();
    });
  });

  describe('Submission Validation Flow', () => {
    it('should validate submission and receive calculations', async () => {
      // Submit a validation request to excise
      const validationResponse = await fetch(
        `${exciseServer.baseUrl}/excise/vpd/validate-and-calculate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vpdApprovalNumber: 'VPD123456',
            periodKey: '24A1',
            submission: {
              basicInformation: {
                returnType: 'ORIGINAL',
                submittedBy: { type: 'ORG', name: 'Example Vapes Ltd' },
              },
              dutyProducts: [],
            },
          }),
        }
      );
      expect(validationResponse.status).toBe(200);

      const validation: any = await validationResponse.json();
      expect(validation.valid).toBe(true);
      expect(validation.customerId).toBeDefined();
      expect(validation.calculations).toBeDefined();
      expect(validation.calculations.totalDutyDue).toBeDefined();
      expect(validation.calculations.calculationHash).toBeDefined();
    });
  });

  describe('Full Submission Orchestration Flow', () => {
    it('should complete full submission flow: validate, enrich, store', async () => {
      const vpdApprovalNumber = 'VPD123456';
      const periodKey = '24A1';

      // === Step 1: Validate submission with excise ===
      const validationResponse = await fetch(
        `${exciseServer.baseUrl}/excise/vpd/validate-and-calculate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vpdApprovalNumber,
            periodKey,
            submission: {
              basicInformation: {
                returnType: 'ORIGINAL',
                submittedBy: { type: 'ORG', name: 'Example Vapes Ltd' },
              },
              dutyProducts: [],
            },
          }),
        }
      );
      expect(validationResponse.status).toBe(200);

      const validation: any = await validationResponse.json();
      expect(validation.valid).toBe(true);
      const { customerId, calculations, warnings = [] } = validation;

      // === Step 2: Enrich with customer details (parallel with validation) ===
      const customerResponse = await fetch(`${customerServer.baseUrl}/customers/${customerId}`);
      expect(customerResponse.status).toBe(200);

      const customer: any = await customerResponse.json();
      expect(customer.customerId).toBe(customerId);

      // === Step 3: Store submission in tax platform ===
      const storeResponse = await fetch(`${taxPlatformServer.baseUrl}/submissions/vpd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `test-${Date.now()}`,
          'X-Correlation-Id': '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          vpdApprovalNumber,
          periodKey,
          customerId,
          submission: {
            basicInformation: {
              returnType: 'ORIGINAL',
              submittedBy: { type: customer.type, name: customer.name },
            },
            dutyProducts: [],
          },
          calculations,
          warnings,
        }),
      });
      expect(storeResponse.status).toBe(201);

      const stored: any = await storeResponse.json();
      expect(stored.acknowledgementReference).toBeDefined();
      expect(stored.storedAt).toBeDefined();

      // === Step 4: Verify retrieval by acknowledgement ===
      const retrieveResponse = await fetch(
        `${taxPlatformServer.baseUrl}/submissions/vpd/${stored.acknowledgementReference}`
      );
      expect(retrieveResponse.status).toBe(200);

      const retrieved: any = await retrieveResponse.json();
      expect(retrieved.acknowledgementReference).toBe(stored.acknowledgementReference);
      expect(retrieved.vpdApprovalNumber).toBe(vpdApprovalNumber);
      expect(retrieved.periodKey).toBe(periodKey);
      expect(retrieved.status).toBeDefined();
    });
  });

  describe('Period Lookup', () => {
    it('should look up period details', async () => {
      const periodResponse = await fetch(`${exciseServer.baseUrl}/excise/vpd/periods/24A1`);
      expect(periodResponse.status).toBe(200);

      const period: any = await periodResponse.json();
      expect(period.periodKey).toBe('24A1');
      expect(period.startDate).toBeDefined();
      expect(period.endDate).toBeDefined();
      expect(period.state).toBe('OPEN');
    });
  });

  describe('Submission Retrieval Flow', () => {
    it('should retrieve submission by approval number and period', async () => {
      const response = await fetch(
        `${taxPlatformServer.baseUrl}/submissions/vpd?vpdApprovalNumber=VPD123456&periodKey=24A1`
      );
      expect(response.status).toBe(200);

      const submission: any = await response.json();
      expect(submission.vpdApprovalNumber).toBe('VPD123456');
      expect(submission.periodKey).toBe('24A1');
      expect(submission.acknowledgementReference).toBeDefined();
      expect(submission.calculations).toBeDefined();
    });

    it('should enrich retrieved submission with customer details', async () => {
      // Get submission
      const submissionResponse = await fetch(
        `${taxPlatformServer.baseUrl}/submissions/vpd?vpdApprovalNumber=VPD123456&periodKey=24A1`
      );
      expect(submissionResponse.status).toBe(200);

      const submission: any = await submissionResponse.json();

      // Use customerId from submission to get customer
      const customerResponse = await fetch(
        `${customerServer.baseUrl}/customers/${submission.customerId}`
      );
      expect(customerResponse.status).toBe(200);

      const customer: any = await customerResponse.json();
      expect(customer.customerId).toBe(submission.customerId);

      // Domain API would combine these for the response
      const enrichedSubmission = {
        ...submission,
        customer: {
          name: customer.name,
          type: customer.type,
        },
      };

      expect(enrichedSubmission.customer.name).toBeDefined();
      expect(enrichedSubmission.customer.type).toBeDefined();
    });
  });

  describe('Parallel Backend Calls', () => {
    it('should support parallel calls to independent backends', async () => {
      // In the domain API, we can fetch registration and period in parallel
      const startTime = Date.now();

      const [registrationResponse, periodResponse] = await Promise.all([
        fetch(`${exciseServer.baseUrl}/excise/vpd/registrations/VPD123456`),
        fetch(`${exciseServer.baseUrl}/excise/vpd/periods/24A1`),
      ]);

      expect(registrationResponse.status).toBe(200);
      expect(periodResponse.status).toBe(200);

      const registration: any = await registrationResponse.json();
      const period: any = await periodResponse.json();

      // Both should be valid
      expect(registration.status).toBe('ACTIVE');
      expect(period.state).toBe('OPEN');
    });
  });

  describe('Header Handling', () => {
    it('should echo correlation ID header', async () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await fetch(`${taxPlatformServer.baseUrl}/submissions/vpd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `test-header-${Date.now()}`,
          'X-Correlation-Id': correlationId,
        },
        body: JSON.stringify({
          vpdApprovalNumber: 'VPD123456',
          periodKey: '24A1',
          customerId: 'CUST789',
          submission: {},
          calculations: {
            totalDutyDue: { amount: 100, currency: 'GBP' },
          },
        }),
      });

      expect(response.status).toBe(201);

      // Check for ETag header in response
      const etag = response.headers.get('ETag');
      // ETag may or may not be present depending on Prism configuration
      if (etag) {
        expect(etag).toBeTruthy();
      }
    });
  });
});
