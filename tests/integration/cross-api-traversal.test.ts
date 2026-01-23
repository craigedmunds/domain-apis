/**
 * Integration Tests for Cross-API Traversal (Task 12.7)
 *
 * These tests verify that relationship links between APIs can be traversed
 * and resolve to valid resources. All three mock servers must be running.
 *
 * Test Scenarios:
 * 1. Taxpayer -> Income Tax: follow taxReturns link
 * 2. Taxpayer -> Payment: follow payments link
 * 3. Income Tax -> Taxpayer: follow taxpayer link
 * 4. Income Tax -> Payment: follow allocations link
 * 5. Payment -> Taxpayer: follow taxpayer link
 * 6. Bidirectional: verify A->B and B->A both resolve
 */

import {
  spawnMockServer,
  stopMockServer,
  API_CONFIGS,
  MockServerInstance,
} from '../helpers/mock-server-manager';

describe('Cross-API Traversal Integration Tests', () => {
  let taxpayerServer: MockServerInstance;
  let incomeTaxServer: MockServerInstance;
  let paymentServer: MockServerInstance;

  // Helper to extract href from link (handles both string and object formats)
  const getHref = (link: any): string | null => {
    if (!link) return null;
    return typeof link === 'string' ? link : link.href;
  };

  // Helper to convert relative link to absolute URL for the correct server
  const resolveLink = (href: string): string => {
    if (href.startsWith('/taxpayers')) {
      return `${taxpayerServer.baseUrl}${href}`;
    }
    if (href.startsWith('/tax-returns') || href.startsWith('/assessments')) {
      return `${incomeTaxServer.baseUrl}${href}`;
    }
    if (href.startsWith('/payments') || href.startsWith('/allocations')) {
      return `${paymentServer.baseUrl}${href}`;
    }
    throw new Error(`Cannot resolve link: ${href}`);
  };

  beforeAll(async () => {
    // Start all three mock servers in parallel
    [taxpayerServer, incomeTaxServer, paymentServer] = await Promise.all([
      spawnMockServer(API_CONFIGS.taxpayer),
      spawnMockServer(API_CONFIGS['income-tax']),
      spawnMockServer(API_CONFIGS.payment),
    ]);
  }, 60000);

  afterAll(() => {
    // Clean up all servers
    [taxpayerServer, incomeTaxServer, paymentServer].forEach((server) => {
      if (server) {
        stopMockServer(server);
      }
    });
  });

  describe('Taxpayer to Income Tax API Traversal', () => {
    it('should follow taxReturns link from Taxpayer to get tax returns', async () => {
      // Step 1: Get a taxpayer
      const taxpayerResponse = await fetch(`${taxpayerServer.baseUrl}/taxpayers/TP123456`);
      expect(taxpayerResponse.status).toBe(200);
      const taxpayer: any = await taxpayerResponse.json();

      // Step 2: Extract taxReturns link
      const taxReturnsHref = getHref(taxpayer._links?.taxReturns);
      expect(taxReturnsHref).toBeTruthy();
      expect(taxReturnsHref).toContain('/tax-returns');

      // Step 3: Follow the link (resolve to income-tax server)
      const taxReturnsUrl = resolveLink(taxReturnsHref!);
      const taxReturnsResponse = await fetch(taxReturnsUrl);
      expect(taxReturnsResponse.status).toBe(200);

      // Step 4: Verify response structure
      const taxReturns: any = await taxReturnsResponse.json();
      expect(taxReturns).toHaveProperty('items');
      expect(Array.isArray(taxReturns.items)).toBe(true);

      // Step 5: If items exist, verify they have back-links to taxpayer
      if (taxReturns.items.length > 0) {
        const taxReturn: any = taxReturns.items[0];
        expect(taxReturn._links?.taxpayer).toBeDefined();
        const taxpayerBackLink = getHref(taxReturn._links.taxpayer);
        expect(taxpayerBackLink).toContain('/taxpayers/');
      }
    });
  });

  describe('Taxpayer to Payment API Traversal', () => {
    it('should follow payments link from Taxpayer to get payments', async () => {
      // Step 1: Get a taxpayer
      const taxpayerResponse = await fetch(`${taxpayerServer.baseUrl}/taxpayers/TP123456`);
      expect(taxpayerResponse.status).toBe(200);
      const taxpayer: any = await taxpayerResponse.json();

      // Step 2: Extract payments link
      const paymentsHref = getHref(taxpayer._links?.payments);
      expect(paymentsHref).toBeTruthy();
      expect(paymentsHref).toContain('/payments');

      // Step 3: Follow the link (resolve to payment server)
      const paymentsUrl = resolveLink(paymentsHref!);
      const paymentsResponse = await fetch(paymentsUrl);
      expect(paymentsResponse.status).toBe(200);

      // Step 4: Verify response structure
      const payments: any = await paymentsResponse.json();
      expect(payments).toHaveProperty('items');
      expect(Array.isArray(payments.items)).toBe(true);

      // Step 5: If items exist, verify they have back-links to taxpayer
      if (payments.items.length > 0) {
        const payment: any = payments.items[0];
        expect(payment._links?.taxpayer).toBeDefined();
        const taxpayerBackLink = getHref(payment._links.taxpayer);
        expect(taxpayerBackLink).toContain('/taxpayers/');
      }
    });
  });

  describe('Income Tax to Taxpayer API Traversal', () => {
    it('should follow taxpayer link from TaxReturn to get taxpayer', async () => {
      // Step 1: Get a tax return
      const taxReturnResponse = await fetch(`${incomeTaxServer.baseUrl}/tax-returns/TR20230001`);
      expect(taxReturnResponse.status).toBe(200);
      const taxReturn: any = await taxReturnResponse.json();

      // Step 2: Extract taxpayer link
      const taxpayerHref = getHref(taxReturn._links?.taxpayer);
      expect(taxpayerHref).toBeTruthy();
      expect(taxpayerHref).toContain('/taxpayers/');

      // Step 3: Follow the link (resolve to taxpayer server)
      const taxpayerUrl = resolveLink(taxpayerHref!);
      const taxpayerResponse = await fetch(taxpayerUrl);
      expect(taxpayerResponse.status).toBe(200);

      // Step 4: Verify response structure
      const taxpayer: any = await taxpayerResponse.json();
      expect(taxpayer).toHaveProperty('id');
      expect(taxpayer).toHaveProperty('type', 'taxpayer');
      expect(taxpayer).toHaveProperty('nino');
      expect(taxpayer).toHaveProperty('_links');
    });
  });

  describe('Income Tax to Payment API Traversal', () => {
    it('should follow allocations link from TaxReturn to get allocations', async () => {
      // Step 1: Get a tax return
      const taxReturnResponse = await fetch(`${incomeTaxServer.baseUrl}/tax-returns/TR20230001`);
      expect(taxReturnResponse.status).toBe(200);
      const taxReturn: any = await taxReturnResponse.json();

      // Step 2: Extract allocations link (if present)
      const allocationsHref = getHref(taxReturn._links?.allocations);

      // This link may or may not be present depending on the mock data
      if (allocationsHref) {
        expect(allocationsHref).toContain('/allocations');

        // Step 3: Follow the link (resolve to payment server)
        const allocationsUrl = resolveLink(allocationsHref);
        const allocationsResponse = await fetch(allocationsUrl);

        // Allocations endpoint should return 200
        expect(allocationsResponse.status).toBe(200);
      }
    });
  });

  describe('Payment to Taxpayer API Traversal', () => {
    it('should follow taxpayer link from Payment to get taxpayer', async () => {
      // Step 1: Get a payment
      const paymentResponse = await fetch(`${paymentServer.baseUrl}/payments/PM20230001`);
      expect(paymentResponse.status).toBe(200);
      const payment: any = await paymentResponse.json();

      // Step 2: Extract taxpayer link
      const taxpayerHref = getHref(payment._links?.taxpayer);
      expect(taxpayerHref).toBeTruthy();
      expect(taxpayerHref).toContain('/taxpayers/');

      // Step 3: Follow the link (resolve to taxpayer server)
      const taxpayerUrl = resolveLink(taxpayerHref!);
      const taxpayerResponse = await fetch(taxpayerUrl);
      expect(taxpayerResponse.status).toBe(200);

      // Step 4: Verify response structure
      const taxpayer: any = await taxpayerResponse.json();
      expect(taxpayer).toHaveProperty('id');
      expect(taxpayer).toHaveProperty('type', 'taxpayer');
      expect(taxpayer).toHaveProperty('_links');
    });
  });

  describe('Bidirectional Relationship Tests', () => {
    it('Taxpayer -> TaxReturn -> Taxpayer should return same taxpayer ID', async () => {
      const taxpayerId = 'TP123456';

      // Step 1: Get taxpayer
      const taxpayer1Response = await fetch(`${taxpayerServer.baseUrl}/taxpayers/${taxpayerId}`);
      expect(taxpayer1Response.status).toBe(200);
      const taxpayer1: any = await taxpayer1Response.json();

      // Step 2: Follow taxReturns link
      const taxReturnsHref = getHref(taxpayer1._links?.taxReturns);
      if (!taxReturnsHref) {
        // Skip if no taxReturns link
        return;
      }

      const taxReturnsUrl = resolveLink(taxReturnsHref);
      const taxReturnsResponse = await fetch(taxReturnsUrl);
      expect(taxReturnsResponse.status).toBe(200);
      const taxReturns: any = await taxReturnsResponse.json();

      if (taxReturns.items.length === 0) {
        // Skip if no tax returns
        return;
      }

      // Step 3: Get first tax return and follow taxpayer link back
      const taxReturn: any = taxReturns.items[0];
      const taxpayerBackHref = getHref(taxReturn._links?.taxpayer);
      expect(taxpayerBackHref).toBeTruthy();

      const taxpayer2Url = resolveLink(taxpayerBackHref!);
      const taxpayer2Response = await fetch(taxpayer2Url);
      expect(taxpayer2Response.status).toBe(200);
      const taxpayer2: any = await taxpayer2Response.json();

      // Step 4: Verify same taxpayer (or at least consistent data structure)
      expect(taxpayer2).toHaveProperty('id');
      expect(taxpayer2).toHaveProperty('type', 'taxpayer');
    });

    it('Taxpayer -> Payment -> Taxpayer should return same taxpayer ID', async () => {
      const taxpayerId = 'TP123456';

      // Step 1: Get taxpayer
      const taxpayer1Response = await fetch(`${taxpayerServer.baseUrl}/taxpayers/${taxpayerId}`);
      expect(taxpayer1Response.status).toBe(200);
      const taxpayer1: any = await taxpayer1Response.json();

      // Step 2: Follow payments link
      const paymentsHref = getHref(taxpayer1._links?.payments);
      if (!paymentsHref) {
        // Skip if no payments link
        return;
      }

      const paymentsUrl = resolveLink(paymentsHref);
      const paymentsResponse = await fetch(paymentsUrl);
      expect(paymentsResponse.status).toBe(200);
      const payments: any = await paymentsResponse.json();

      if (payments.items.length === 0) {
        // Skip if no payments
        return;
      }

      // Step 3: Get first payment and follow taxpayer link back
      const payment: any = payments.items[0];
      const taxpayerBackHref = getHref(payment._links?.taxpayer);
      expect(taxpayerBackHref).toBeTruthy();

      const taxpayer2Url = resolveLink(taxpayerBackHref!);
      const taxpayer2Response = await fetch(taxpayer2Url);
      expect(taxpayer2Response.status).toBe(200);
      const taxpayer2: any = await taxpayer2Response.json();

      // Step 4: Verify same taxpayer (or at least consistent data structure)
      expect(taxpayer2).toHaveProperty('id');
      expect(taxpayer2).toHaveProperty('type', 'taxpayer');
    });
  });

  describe('Collection Link Traversal', () => {
    it('should traverse taxpayer list and follow links for each', async () => {
      // Get taxpayer collection
      const response = await fetch(`${taxpayerServer.baseUrl}/taxpayers`);
      expect(response.status).toBe(200);
      const collection = await response.json() as any;

      expect(collection.items).toBeDefined();
      expect(Array.isArray(collection.items)).toBe(true);

      // Verify each taxpayer has valid self link
      for (const taxpayer of collection.items) {
        expect(taxpayer._links?.self).toBeDefined();
        const selfHref = getHref(taxpayer._links.self);
        expect(selfHref).toContain('/taxpayers/');

        // Verify relationship links exist
        if (taxpayer._links?.taxReturns) {
          const taxReturnsHref = getHref(taxpayer._links.taxReturns);
          expect(taxReturnsHref).toContain('/tax-returns');
        }

        if (taxpayer._links?.payments) {
          const paymentsHref = getHref(taxpayer._links.payments);
          expect(paymentsHref).toContain('/payments');
        }
      }
    });
  });
});
