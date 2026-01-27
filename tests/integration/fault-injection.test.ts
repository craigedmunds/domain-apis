/**
 * Fault Injection Tests
 *
 * Tests for header-controlled fault injection via Envoy proxies.
 * These tests require Docker Compose to be running with Envoy proxies.
 *
 * Run with: docker-compose up -d && npm run test:integration -- fault-injection
 *
 * NOTE: These tests are skipped in CI because CI runs Prism directly without Envoy.
 * They only run when the full Docker Compose stack (with Envoy proxies) is available.
 */

// Envoy proxy ports (not direct Prism ports)
const ENVOY_PORTS = {
  excise: 4010,
  customer: 4011,
  'tax-platform': 4012,
};

// Skip in CI - fault injection requires Envoy which isn't available in CI
const isCI = process.env.CI === 'true';

// Check if Envoy is running by testing if fault injection actually works
const isEnvoyRunning = async (): Promise<boolean> => {
  if (isCI) return false;

  try {
    // Try to inject a fault - if Envoy is running, this will return 503
    const response = await fetch(`http://localhost:${ENVOY_PORTS.customer}/customers/CUST789`, {
      headers: { 'x-envoy-fault-abort-request': '503' },
      signal: AbortSignal.timeout(2000),
    });
    // If we get 503, Envoy is processing our fault injection header
    return response.status === 503;
  } catch {
    return false;
  }
};

describe('Fault Injection via Envoy Headers', () => {
  let envoyAvailable = false;

  beforeAll(async () => {
    envoyAvailable = await isEnvoyRunning();
    if (!envoyAvailable) {
      console.log('Skipping fault injection tests - Envoy not running (CI or Docker not started)');
    }
  });

  describe('Delay Injection', () => {
    it('should inject delay when x-envoy-fault-delay-request header is set', async () => {
      if (!envoyAvailable) return;

      const delayMs = 500;
      const startTime = Date.now();

      const response = await fetch(
        `http://localhost:${ENVOY_PORTS.customer}/customers/CUST789`,
        {
          headers: {
            'x-envoy-fault-delay-request': String(delayMs),
          },
        }
      );

      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      // Allow some tolerance for network overhead
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 50);
      expect(elapsed).toBeLessThan(delayMs + 500);
    }, 10000);

    it('should not delay when header is absent', async () => {
      if (!envoyAvailable) return;

      const startTime = Date.now();

      const response = await fetch(
        `http://localhost:${ENVOY_PORTS.customer}/customers/CUST789`
      );

      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      // Should complete quickly without injected delay
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('Error Injection', () => {
    it('should return 503 when x-envoy-fault-abort-request header is set to 503', async () => {
      if (!envoyAvailable) return;

      const response = await fetch(
        `http://localhost:${ENVOY_PORTS.customer}/customers/CUST789`,
        {
          headers: {
            'x-envoy-fault-abort-request': '503',
          },
        }
      );

      expect(response.status).toBe(503);
    });

    it('should return 500 when x-envoy-fault-abort-request header is set to 500', async () => {
      if (!envoyAvailable) return;

      const response = await fetch(
        `http://localhost:${ENVOY_PORTS.customer}/customers/CUST789`,
        {
          headers: {
            'x-envoy-fault-abort-request': '500',
          },
        }
      );

      expect(response.status).toBe(500);
    });

    it('should not error when header is absent', async () => {
      if (!envoyAvailable) return;

      const response = await fetch(
        `http://localhost:${ENVOY_PORTS.customer}/customers/CUST789`
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Combined Delay and Error', () => {
    it('should inject both delay and error when both headers are set', async () => {
      if (!envoyAvailable) return;

      const delayMs = 300;
      const startTime = Date.now();

      const response = await fetch(
        `http://localhost:${ENVOY_PORTS.customer}/customers/CUST789`,
        {
          headers: {
            'x-envoy-fault-delay-request': String(delayMs),
            'x-envoy-fault-abort-request': '503',
          },
        }
      );

      const elapsed = Date.now() - startTime;

      // Should have delay AND error
      expect(response.status).toBe(503);
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 50);
    }, 10000);
  });

  describe('All Backends Support Fault Injection', () => {
    const backends = [
      { name: 'excise', port: ENVOY_PORTS.excise, path: '/excise/vpd/registrations/VPD123456' },
      { name: 'customer', port: ENVOY_PORTS.customer, path: '/customers/CUST789' },
      { name: 'tax-platform', port: ENVOY_PORTS['tax-platform'], path: '/submissions/vpd?vpdApprovalNumber=VPD123456&periodKey=24A1' },
    ];

    backends.forEach(({ name, port, path }) => {
      it(`should inject error on ${name} backend`, async () => {
        if (!envoyAvailable) return;

        const response = await fetch(`http://localhost:${port}${path}`, {
          headers: {
            'x-envoy-fault-abort-request': '503',
          },
        });

        expect(response.status).toBe(503);
      });
    });
  });
});
