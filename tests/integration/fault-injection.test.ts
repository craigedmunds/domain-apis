/**
 * Fault Injection Tests
 *
 * Tests for header-controlled fault injection via Envoy proxies.
 * These tests require Docker Compose to be running with Envoy proxies.
 *
 * Run with: docker-compose up -d && npm run test:integration -- fault-injection
 */

// Envoy proxy ports (not direct Prism ports)
const ENVOY_PORTS = {
  excise: 4010,
  customer: 4011,
  'tax-platform': 4012,
};

// Skip these tests if not running against Docker (Envoy proxies)
const isDockerRunning = async (): Promise<boolean> => {
  try {
    const response = await fetch(`http://localhost:${ENVOY_PORTS.excise}/excise/vpd/registrations/VPD123456`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
};

describe('Fault Injection via Envoy Headers', () => {
  let dockerAvailable = false;

  beforeAll(async () => {
    dockerAvailable = await isDockerRunning();
    if (!dockerAvailable) {
      console.log('Skipping fault injection tests - Docker/Envoy not running');
    }
  });

  describe('Delay Injection', () => {
    it('should inject delay when x-envoy-fault-delay-request header is set', async () => {
      if (!dockerAvailable) return;

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
      if (!dockerAvailable) return;

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
      if (!dockerAvailable) return;

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
      if (!dockerAvailable) return;

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
      if (!dockerAvailable) return;

      const response = await fetch(
        `http://localhost:${ENVOY_PORTS.customer}/customers/CUST789`
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Combined Delay and Error', () => {
    it('should inject both delay and error when both headers are set', async () => {
      if (!dockerAvailable) return;

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
        if (!dockerAvailable) return;

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
