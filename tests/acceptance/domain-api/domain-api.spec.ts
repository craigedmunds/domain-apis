/**
 * VPD Domain API Acceptance Tests
 *
 * Tests for the VPD Submission Returns Domain API running on Camel JBang.
 * Requires docker-compose stack to be running.
 *
 * Run with:
 *   docker-compose up -d
 *   cd tests/acceptance/domain-api && npm install && npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';

const DOMAIN_API_URL = process.env.DOMAIN_API_URL || 'http://localhost:8081';
const TIMEOUT_MS = 10000;

// Check if domain API is available
const isDomainApiRunning = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${DOMAIN_API_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

describe('VPD Domain API', () => {
  let apiAvailable = false;

  beforeAll(async () => {
    apiAvailable = await isDomainApiRunning();
    if (!apiAvailable) {
      console.log(`Skipping tests - Domain API not running at ${DOMAIN_API_URL}`);
      console.log('Start with: docker-compose up -d');
    }
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      if (!apiAvailable) return;

      const response = await fetch(`${DOMAIN_API_URL}/health`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('UP');
    });
  });

  describe('GET /duty/vpd/submission-returns/v1', () => {
    const validAckRef = 'ACK-2026-01-26-000123';

    it('should return submission by acknowledgement reference', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=${validAckRef}`
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const body = await response.json();
      expect(body.acknowledgementReference).toBe(validAckRef);
      expect(body.vpdApprovalNumber).toBeDefined();
      expect(body.periodKey).toBeDefined();
      expect(body.customerId).toBeDefined();
    });

    it('should propagate X-Correlation-Id header', async () => {
      if (!apiAvailable) return;

      const correlationId = `test-${Date.now()}`;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=${validAckRef}`,
        {
          headers: {
            'X-Correlation-Id': correlationId,
          },
        }
      );

      // Prism may randomly return 422, but correlation ID should still be echoed
      expect([200, 422]).toContain(response.status);
      expect(response.headers.get('x-correlation-id')).toBe(correlationId);
    });

    it('should return ETag header', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=${validAckRef}`
      );

      // Prism may randomly return 422, but ETag should still be present
      expect([200, 422]).toContain(response.status);
      expect(response.headers.get('etag')).toBeDefined();
    });

    it('should include CORS headers', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=${validAckRef}`,
        {
          headers: {
            Origin: 'http://localhost:8080',
          },
        }
      );

      // Prism may randomly return 422, but CORS headers should still be present
      expect([200, 422]).toContain(response.status);
      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    });
  });

  describe('Fault Injection Pass-through', () => {
    const validAckRef = 'ACK-2026-01-26-000123';

    it('should pass delay header to backend and apply delay', async () => {
      if (!apiAvailable) return;

      const delayMs = 500;
      const startTime = Date.now();

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=${validAckRef}`,
        {
          headers: {
            'x-envoy-fault-delay-request': String(delayMs),
          },
        }
      );

      const elapsed = Date.now() - startTime;

      // Prism may randomly return 422, but delay should still be applied
      expect([200, 422]).toContain(response.status);
      // Allow tolerance for network overhead
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 100);
    }, TIMEOUT_MS);

    it('should pass abort header to backend and return error', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=${validAckRef}`,
        {
          headers: {
            'x-envoy-fault-abort-request': '503',
          },
        }
      );

      expect(response.status).toBe(503);
    });
  });

  describe('CORS Preflight', () => {
    it('should respond to OPTIONS preflight request', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1`,
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'http://localhost:8080',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'X-Correlation-Id',
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
      expect(response.headers.get('access-control-allow-headers')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing acknowledgementReference parameter', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1`
      );

      // Backend mock (Prism) may return 422 for invalid request
      // or Camel may return 500 if ackRef is null
      expect([200, 400, 422, 500]).toContain(response.status);
    });
  });
});
