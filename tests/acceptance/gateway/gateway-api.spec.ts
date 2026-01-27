import { describe, test, expect } from 'vitest';

/**
 * Acceptance tests for VPD Domain API functionality
 *
 * Requirements validated:
 * - Submission endpoint orchestration
 * - Returns endpoint orchestration with customer enrichment
 * - Sparse fieldsets support
 *
 * These tests validate the VPD Domain API that orchestrates between
 * backend services (excise, customer, tax-platform).
 *
 * NOTE: These tests are placeholders pending domain API implementation.
 * They currently test against the backend mocks directly to validate
 * the test infrastructure.
 */

// Domain API configuration (will be the Camel service when implemented)
const DOMAIN_API_BASE_URL = process.env.DOMAIN_API_URL || 'http://localhost:8080';

// Backend mock URLs for infrastructure validation
const EXCISE_MOCK_URL = process.env.EXCISE_URL || 'http://localhost:4010';
const CUSTOMER_MOCK_URL = process.env.CUSTOMER_URL || 'http://localhost:4011';
const TAX_PLATFORM_MOCK_URL = process.env.TAX_PLATFORM_URL || 'http://localhost:4012';

describe('VPD Backend Mocks - Infrastructure Validation', () => {
  describe('Excise Mock', () => {
    test('should return registration details', async () => {
      const response = await fetch(`${EXCISE_MOCK_URL}/excise/vpd/registrations/VPD123456`);

      expect(response.ok).toBeTruthy();
      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('vpdApprovalNumber');
      expect(data).toHaveProperty('customerId');
      expect(data).toHaveProperty('status');
    });

    test('should return period details', async () => {
      const response = await fetch(`${EXCISE_MOCK_URL}/excise/vpd/periods/24A1`);

      expect(response.ok).toBeTruthy();
      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('periodKey');
      expect(data).toHaveProperty('startDate');
      expect(data).toHaveProperty('endDate');
      expect(data).toHaveProperty('state');
    });

    test('should validate and calculate submission', async () => {
      const response = await fetch(`${EXCISE_MOCK_URL}/excise/vpd/validate-and-calculate`, {
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

      expect(response.ok).toBeTruthy();
      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('valid');
      expect(data).toHaveProperty('customerId');
      if (data.valid) {
        expect(data).toHaveProperty('calculations');
      }
    });
  });

  describe('Customer Mock', () => {
    test('should return customer details', async () => {
      const response = await fetch(`${CUSTOMER_MOCK_URL}/customers/CUST789`);

      expect(response.ok).toBeTruthy();
      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('customerId');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('type');
    });
  });

  describe('Tax Platform Mock', () => {
    test('should store submission', async () => {
      const response = await fetch(`${TAX_PLATFORM_MOCK_URL}/submissions/vpd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `test-${Date.now()}`,
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

      const data = await response.json();

      expect(data).toHaveProperty('acknowledgementReference');
      expect(data).toHaveProperty('storedAt');
    });

    test('should retrieve submission by acknowledgement', async () => {
      const response = await fetch(
        `${TAX_PLATFORM_MOCK_URL}/submissions/vpd/ACK-2026-01-26-000123`
      );

      expect(response.ok).toBeTruthy();
      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('acknowledgementReference');
      expect(data).toHaveProperty('vpdApprovalNumber');
      expect(data).toHaveProperty('status');
    });

    test('should find submission by approval number and period', async () => {
      const response = await fetch(
        `${TAX_PLATFORM_MOCK_URL}/submissions/vpd?vpdApprovalNumber=VPD123456&periodKey=24A1`
      );

      expect(response.ok).toBeTruthy();
      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('vpdApprovalNumber');
      expect(data).toHaveProperty('periodKey');
    });
  });
});

describe.skip('VPD Domain API - Submission Endpoint', () => {
  // TODO: Implement when domain API is ready

  test('should submit a VPD return', async () => {
    const response = await fetch(`${DOMAIN_API_BASE_URL}/vpd/returns/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({
        vpdApprovalNumber: 'VPD123456',
        periodKey: '24A1',
        submission: {
          basicInformation: {
            returnType: 'ORIGINAL',
          },
          dutyProducts: [],
        },
      }),
    });

    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(201);

    const data = await response.json();

    expect(data).toHaveProperty('acknowledgementReference');
    expect(data).toHaveProperty('calculations');
    expect(data).toHaveProperty('customer');
  });

  test('should validate submission before storing', async () => {
    // Invalid submission should return validation errors
    const response = await fetch(`${DOMAIN_API_BASE_URL}/vpd/returns/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vpdApprovalNumber: 'VPD999999', // Non-existent
        periodKey: '24A1',
        submission: {},
      }),
    });

    // Should return validation error, not 500
    expect(response.status).toBeLessThan(500);
  });
});

describe.skip('VPD Domain API - Returns Endpoint', () => {
  // TODO: Implement when domain API is ready

  test('should retrieve return by acknowledgement', async () => {
    const response = await fetch(
      `${DOMAIN_API_BASE_URL}/vpd/returns/ACK-2026-01-26-000123`
    );

    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data).toHaveProperty('acknowledgementReference');
    expect(data).toHaveProperty('submission');
    expect(data).toHaveProperty('calculations');
    expect(data).toHaveProperty('customer');
    expect(data.customer).toHaveProperty('name');
  });

  test('should retrieve return by approval number and period', async () => {
    const response = await fetch(
      `${DOMAIN_API_BASE_URL}/vpd/returns?vpdApprovalNumber=VPD123456&periodKey=24A1`
    );

    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data).toHaveProperty('vpdApprovalNumber');
    expect(data).toHaveProperty('customer');
  });
});

describe.skip('VPD Domain API - Sparse Fieldsets', () => {
  // TODO: Implement when domain API is ready

  test('should support fields parameter to limit response fields', async () => {
    const response = await fetch(
      `${DOMAIN_API_BASE_URL}/vpd/returns/ACK-2026-01-26-000123?fields=acknowledgementReference,calculations.totalDutyDue`
    );

    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);

    const data = await response.json();

    // Only requested fields should be present
    expect(data).toHaveProperty('acknowledgementReference');
    expect(data).toHaveProperty('calculations');
    expect(data.calculations).toHaveProperty('totalDutyDue');

    // Non-requested fields should be absent
    expect(data.submission).toBeUndefined();
    expect(data.customer).toBeUndefined();
  });
});
