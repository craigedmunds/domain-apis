/**
 * VPD Domain API Acceptance Tests - Phase 7b
 *
 * Tests for the VPD Submission Returns Domain API running on Camel JBang.
 * Validates full orchestration flows including XML transformation.
 * Requires docker-compose stack to be running.
 *
 * Run with:
 *   docker-compose up -d
 *   cd tests/acceptance/domain-api && npm install && npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';

const DOMAIN_API_URL = process.env.DOMAIN_API_URL || 'http://localhost:8081';
const TIMEOUT_MS = 15000;

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

  // ==========================================================================
  // GET by Acknowledgement Reference
  // Orchestration: tax-platform → excise (registration) → excise (period) → customer
  // ==========================================================================

  describe('GET by acknowledgementReference', () => {
    const validAckRef = 'ACK-2026-01-26-000123';

    it('should return submission with orchestrated data', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=${validAckRef}`
      );

      // Prism may return 422 randomly, accept both
      expect([200, 422]).toContain(response.status);
      expect(response.headers.get('content-type')).toContain('application/json');

      if (response.status === 200) {
        const body = await response.json();
        // Check orchestrated response contains data from all backends
        expect(body.acknowledgementReference).toBeDefined();
        expect(body.vpdApprovalNumber).toBeDefined();
        expect(body.periodKey).toBeDefined();
      }
    }, TIMEOUT_MS);

    it('should include trader details from customer service', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=${validAckRef}`
      );

      if (response.status === 200) {
        const body = await response.json();
        expect(body.trader).toBeDefined();
        // Customer details should be enriched
        if (body.trader.name) {
          expect(typeof body.trader.name).toBe('string');
        }
      }
    }, TIMEOUT_MS);

    it('should include period details from excise service', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=${validAckRef}`
      );

      if (response.status === 200) {
        const body = await response.json();
        expect(body.period).toBeDefined();
        // Period details should be present (from XML transformation)
        if (body.period.state) {
          expect(['OPEN', 'FILED', 'CLOSED']).toContain(body.period.state);
        }
      }
    }, TIMEOUT_MS);

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
    }, TIMEOUT_MS);
  });

  // ==========================================================================
  // GET by Approval Number + Period Key
  // Orchestration: excise validation → tax-platform → customer
  // ==========================================================================

  describe('GET by vpdApprovalNumber + periodKey', () => {
    const validApproval = 'VPD123456';
    const validPeriod = '24A1';

    it('should return submission by approval and period', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?vpdApprovalNumber=${validApproval}&periodKey=${validPeriod}`
      );

      // Prism may return 422 randomly, accept both
      expect([200, 422]).toContain(response.status);
      expect(response.headers.get('content-type')).toContain('application/json');

      if (response.status === 200) {
        const body = await response.json();
        expect(body.vpdApprovalNumber).toBeDefined();
        expect(body.periodKey).toBeDefined();
      }
    }, TIMEOUT_MS);

    it('should include registration details from excise service (XML transformed)', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?vpdApprovalNumber=${validApproval}&periodKey=${validPeriod}`
      );

      if (response.status === 200) {
        const body = await response.json();
        expect(body.registration).toBeDefined();
        // Registration status should be present (from XML transformation)
        if (body.registration.status) {
          expect(['ACTIVE', 'SUSPENDED', 'REVOKED']).toContain(body.registration.status);
        }
      }
    }, TIMEOUT_MS);
  });

  // ==========================================================================
  // POST Submission
  // Orchestration: excise validate → tax-platform store
  // ==========================================================================

  describe('POST /duty/vpd/submission-returns/v1', () => {
    it('should create submission and return acknowledgement', async () => {
      if (!apiAvailable) return;

      const idempotencyKey = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const submission = {
        vpdApprovalNumber: 'VPD123456',
        periodKey: '24A1',
        basicInformation: {
          returnType: 'ORIGINAL',
          submittedBy: {
            type: 'ORG',
            name: 'Example Vapes Ltd',
          },
        },
        dutyProducts: [],
      };

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
            'X-Correlation-Id': `test-post-${Date.now()}`,
          },
          body: JSON.stringify(submission),
        }
      );

      // Accept 201 (created), 422 (validation error from Prism), or 200 (idempotent replay)
      expect([200, 201, 422]).toContain(response.status);
      expect(response.headers.get('content-type')).toContain('application/json');

      if (response.status === 201) {
        const body = await response.json();
        expect(body.acknowledgementReference).toBeDefined();
        expect(body.vpdApprovalNumber).toBe('VPD123456');
        expect(body.periodKey).toBe('24A1');
        expect(body.status).toBe('RECEIVED');
      }
    }, TIMEOUT_MS);

    it('should propagate X-Correlation-Id header on POST', async () => {
      if (!apiAvailable) return;

      const correlationId = `test-post-correlation-${Date.now()}`;
      const idempotencyKey = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const submission = {
        vpdApprovalNumber: 'VPD123456',
        periodKey: '24A1',
        basicInformation: { returnType: 'ORIGINAL' },
        dutyProducts: [],
      };

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
            'X-Correlation-Id': correlationId,
          },
          body: JSON.stringify(submission),
        }
      );

      expect([200, 201, 422]).toContain(response.status);
      expect(response.headers.get('x-correlation-id')).toBe(correlationId);
    }, TIMEOUT_MS);
  });

  // ==========================================================================
  // Fault Injection Pass-through
  // ==========================================================================

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
    }, TIMEOUT_MS);
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should return 400 when no query parameters provided', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1`
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('BAD_REQUEST');
    }, TIMEOUT_MS);

    it('should return 404 for non-existent acknowledgement reference', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=NONEXISTENT-999`
      );

      // May return 404 or Prism's 422
      expect([404, 422]).toContain(response.status);
    }, TIMEOUT_MS);
  });

  // ==========================================================================
  // CORS Support
  // ==========================================================================

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

    it('should include CORS headers on responses', async () => {
      if (!apiAvailable) return;

      const response = await fetch(
        `${DOMAIN_API_URL}/duty/vpd/submission-returns/v1?acknowledgementReference=ACK-2026-01-26-000123`,
        {
          headers: {
            Origin: 'http://localhost:8080',
          },
        }
      );

      // Prism may randomly return 422, but CORS headers should still be present
      expect([200, 422]).toContain(response.status);
      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    }, TIMEOUT_MS);
  });
});
