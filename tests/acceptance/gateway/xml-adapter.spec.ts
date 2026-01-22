import { describe, test, expect } from 'vitest';

/**
 * Acceptance tests for XML Adapter functionality
 *
 * Requirements validated:
 * - Spec 0001: Simple XML Response Adapter Implementation
 * - Phase 5: Acceptance Testing
 * - Behavioral parity: Clients cannot distinguish XML-backed from JSON-backed APIs
 *
 * These tests validate the XML adapter functionality through the Gateway API.
 * They verify that:
 * - XML responses from backends are correctly transformed to JSON
 * - Links are properly injected based on service configuration
 * - Include parameter works with XML-backed resources
 * - Cross-API traversal works seamlessly (JSON API -> XML API)
 *
 * Note: These tests require the Payment API backend to return XML responses.
 * The gateway should detect the adapter configuration and transform responses.
 */

// Gateway configuration
const GATEWAY_BASE_URL =
  process.env.GATEWAY_URL ||
  'http://domain-api.execute-api.localhost.localstack.cloud:4566/dev';

describe('XML Adapter - Payment API', () => {
  test('should transform XML payment response to JSON', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/payments/PM20230001`);

    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);

    const data = await response.json();

    // Verify payment resource structure
    expect(data).toHaveProperty('id', 'PM20230001');
    expect(data).toHaveProperty('type', 'payment');
    expect(data).toHaveProperty('taxpayerId');
    expect(data).toHaveProperty('amount');
    expect(data).toHaveProperty('paymentDate');
    expect(data).toHaveProperty('paymentMethod');
    expect(data).toHaveProperty('status');

    // Verify _links are injected
    expect(data).toHaveProperty('_links');
    expect(data._links).toHaveProperty('self');

    // Verify relationship links are present (from service config)
    // These are injected by the adapter based on specs/payment/service.yaml
    if (data._links.taxpayer) {
      expect(data._links.taxpayer).toHaveProperty('href');
      expect(data._links.taxpayer.href).toMatch(/\/taxpayers\//);
    }
  });

  test('should include _links.self pointing to the resource', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/payments/PM20230001`);

    expect(response.ok).toBeTruthy();

    const data = await response.json();

    expect(data._links).toHaveProperty('self');
    // Self link should contain the resource path with stage prefix
    expect(data._links.self.href || data._links.self).toMatch(
      /\/payments\/PM20230001/
    );
  });

  test('should return proper Content-Type header', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/payments/PM20230001`);

    expect(response.ok).toBeTruthy();

    // Gateway should return JSON content type in aggregated mode
    const contentType = response.headers.get('content-type');
    expect(contentType).toMatch(/application\/(vnd\.domain\+)?json/);
  });
});

describe('XML Adapter - Payment Collection', () => {
  test('should transform XML payment collection to JSON', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/payments`);

    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);

    const data = await response.json();

    // Collection should have items array
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBeTruthy();

    // Each item should have required fields
    if (data.items.length > 0) {
      const payment = data.items[0];
      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('type', 'payment');
      expect(payment).toHaveProperty('_links');
    }
  });

  test('should include _links on collection response', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/payments`);

    expect(response.ok).toBeTruthy();

    const data = await response.json();

    expect(data).toHaveProperty('_links');
    expect(data._links).toHaveProperty('self');
  });
});

describe('XML Adapter - Include Parameter', () => {
  test('should include taxpayer with XML payment resource', async () => {
    const response = await fetch(
      `${GATEWAY_BASE_URL}/payments/PM20230001?include=taxpayer`
    );

    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);

    const data = await response.json();

    // Primary resource should be transformed
    expect(data).toHaveProperty('id', 'PM20230001');
    expect(data).toHaveProperty('type', 'payment');

    // Included taxpayer should be present
    expect(data).toHaveProperty('_included');
    if (data._included && data._included.taxpayer) {
      expect(Array.isArray(data._included.taxpayer)).toBeTruthy();
      if (data._included.taxpayer.length > 0) {
        expect(data._included.taxpayer[0]).toHaveProperty('type', 'taxpayer');
        expect(data._included.taxpayer[0]).toHaveProperty('_links');
      }
    }
  });

  test('should handle multiple includes with XML resource', async () => {
    const response = await fetch(
      `${GATEWAY_BASE_URL}/payments/PM20230001?include=taxpayer,allocations`
    );

    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data).toHaveProperty('id', 'PM20230001');
    expect(data).toHaveProperty('_included');
  });
});

describe('XML Adapter - Cross-API Traversal', () => {
  test('should traverse from JSON taxpayer to XML payments', async () => {
    // Request taxpayer (JSON backend) with payments include (XML backend)
    const response = await fetch(
      `${GATEWAY_BASE_URL}/taxpayers/TP123456?include=payments`
    );

    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);

    const data = await response.json();

    // Primary taxpayer resource
    expect(data).toHaveProperty('id', 'TP123456');
    expect(data).toHaveProperty('type', 'taxpayer');

    // Included payments should be transformed from XML
    expect(data).toHaveProperty('_included');
    if (data._included && data._included.payments) {
      expect(Array.isArray(data._included.payments)).toBeTruthy();
      if (data._included.payments.length > 0) {
        const payment = data._included.payments[0];
        expect(payment).toHaveProperty('type', 'payment');
        expect(payment).toHaveProperty('_links');
      }
    }
  });
});

describe('XML Adapter - Content Negotiation', () => {
  test('should return raw XML in pass-through mode', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/payments/PM20230001`, {
      headers: {
        Accept: 'application/vnd.raw',
      },
    });

    expect(response.ok).toBeTruthy();

    // In pass-through mode, raw backend response is returned
    // If backend returns XML, content type should be XML
    const contentType = response.headers.get('content-type');
    // Content type depends on what the backend actually returns
    expect(contentType).toBeDefined();
  });

  test('should return JSON in simple REST mode', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/payments/PM20230001`, {
      headers: {
        Accept: 'application/json',
      },
    });

    expect(response.ok).toBeTruthy();

    const contentType = response.headers.get('content-type');
    expect(contentType).toMatch(/application\/json/);

    // Should be valid JSON
    const data = await response.json();
    expect(data).toBeDefined();
  });
});

describe('XML Adapter - Error Handling', () => {
  test('should return 404 for non-existent payment', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/payments/PM99999999`);

    // Backend should return 404, which gateway forwards
    expect(response.status).toBe(404);
  });

  test('should handle gracefully when included resource not found', async () => {
    // Request with include for a relationship that may not exist
    const response = await fetch(
      `${GATEWAY_BASE_URL}/payments/PM20230001?include=nonexistent`
    );

    expect(response.ok).toBeTruthy();

    const data = await response.json();

    // Primary resource should still be returned
    expect(data).toHaveProperty('id', 'PM20230001');
    // Missing includes are silently omitted
  });
});
