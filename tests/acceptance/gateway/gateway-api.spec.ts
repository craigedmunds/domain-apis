import { describe, test, expect } from 'vitest';

/**
 * Acceptance tests for Gateway API functionality
 * 
 * Requirements validated:
 * - 4.4: Include parameter support for embedding related resources
 * - 5.3: Cross-API resource traversal via URLs
 * - 9.1: Acceptance tests validate critical user journeys
 * - 9.5: Tests validate against running systems
 * - 9.7: All tests pass before POC is considered complete
 * 
 * These tests validate the API Gateway aggregation layer that sits between
 * clients and backend APIs, providing cross-API resource aggregation via
 * the ?include query parameter.
 */

// Gateway configuration
const GATEWAY_BASE_URL = process.env.GATEWAY_URL || 'http://domain-api.execute-api.localhost.localstack.cloud:4566';

describe('Gateway API - Direct Access', () => {
  test('should access Taxpayer API directly without include parameter', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456`);
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    expect(data).toHaveProperty('id', 'TP123456');
    expect(data).toHaveProperty('type', 'taxpayer');
    expect(data).toHaveProperty('nino');
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('_links');
    expect(data._links).toBeDefined();
    expect(data._included).toBeUndefined();
  });

  test('should access Income Tax API directly without include parameter', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/tax-returns/TR20230001`);
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    expect(data).toHaveProperty('id', 'TR20230001');
    expect(data).toHaveProperty('type', 'tax-return');
    expect(data).toHaveProperty('taxpayerId');
    expect(data).toHaveProperty('_links');
    expect(data._included).toBeUndefined();
  });

  test('should access Payment API directly without include parameter', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/payments/PM20230001`);
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    expect(data).toHaveProperty('id', 'PM20230001');
    expect(data).toHaveProperty('type', 'payment');
    expect(data).toHaveProperty('taxpayerId');
    expect(data).toHaveProperty('_links');
    expect(data._included).toBeUndefined();
  });
});

describe('Gateway API - Single Include Parameter', () => {
  test('should include taxReturns when requested', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=taxReturns`);
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    expect(data).toHaveProperty('id', 'TP123456');
    expect(data).toHaveProperty('type', 'taxpayer');
    expect(data).toHaveProperty('_links');
    expect(data).toHaveProperty('_included');
    expect(data._included).toHaveProperty('taxReturns');
    expect(Array.isArray(data._included.taxReturns)).toBeTruthy();
    
    if (data._included.taxReturns.length > 0) {
      const taxReturn = data._included.taxReturns[0];
      expect(taxReturn).toHaveProperty('id');
      expect(taxReturn).toHaveProperty('type', 'tax-return');
      expect(taxReturn).toHaveProperty('taxpayerId', 'TP123456');
    }
  });

  test('should include payments when requested', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=payments`);
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    expect(data).toHaveProperty('id', 'TP123456');
    expect(data).toHaveProperty('_links');
    expect(data).toHaveProperty('_included');
    expect(data._included).toHaveProperty('payments');
    expect(Array.isArray(data._included.payments)).toBeTruthy();
    
    if (data._included.payments.length > 0) {
      const payment = data._included.payments[0];
      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('type', 'payment');
      expect(payment).toHaveProperty('taxpayerId', 'TP123456');
    }
  });
});

describe('Gateway API - Multiple Include Parameters', () => {
  test('should include multiple relationships (taxReturns and payments)', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=taxReturns,payments`);
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    expect(data).toHaveProperty('id', 'TP123456');
    expect(data).toHaveProperty('_links');
    expect(data).toHaveProperty('_included');
    expect(data._included).toHaveProperty('taxReturns');
    expect(data._included).toHaveProperty('payments');
    expect(Array.isArray(data._included.taxReturns)).toBeTruthy();
    expect(Array.isArray(data._included.payments)).toBeTruthy();
  });

  test('should handle include parameter with spaces', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=taxReturns, payments`);
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    expect(data._included).toHaveProperty('taxReturns');
    expect(data._included).toHaveProperty('payments');
  });
});

describe('Gateway API - Cross-API Resource Traversal', () => {
  test('should traverse from Taxpayer to Income Tax API via includes', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=taxReturns`);
    
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    
    expect(data._included).toHaveProperty('taxReturns');
    expect(data._included.taxReturns.length).toBeGreaterThan(0);
    
    const taxReturn = data._included.taxReturns[0];
    expect(taxReturn).toHaveProperty('taxpayerId', 'TP123456');
    expect(taxReturn).toHaveProperty('id');
    expect(taxReturn.type).toBe('tax-return');
  });

  test('should traverse from Taxpayer to Payment API via includes', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=payments`);
    
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    
    expect(data._included).toHaveProperty('payments');
    expect(data._included.payments.length).toBeGreaterThan(0);
    
    const payment = data._included.payments[0];
    expect(payment).toHaveProperty('taxpayerId', 'TP123456');
    expect(payment).toHaveProperty('id');
    expect(payment.type).toBe('payment');
  });

  test('should support multi-hop traversal across all three APIs', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=taxReturns,payments`);
    
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    
    expect(data.type).toBe('taxpayer');
    expect(data._included).toHaveProperty('taxReturns');
    expect(data._included).toHaveProperty('payments');
    expect(Object.keys(data._included).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Gateway API - Error Handling', () => {
  test('should handle invalid include parameter gracefully', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=nonExistentRelationship`);
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('id', 'TP123456');
    
    if (data._included) {
      expect(data._included.nonExistentRelationship).toBeUndefined();
    }
  });

  test('should handle non-existent resource with 404', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/NONEXISTENT`);
    expect(response.status).toBe(404);
  });

  test('should handle partial include failures gracefully', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=taxReturns,invalidRelation`);
    
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    
    expect(data._included).toHaveProperty('taxReturns');
    expect(data).toHaveProperty('id', 'TP123456');
  });

  test('should handle empty include parameter', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=`);
    
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('id', 'TP123456');
    if (data._included) {
      expect(Object.keys(data._included).length).toBe(0);
    }
  });
});

describe('Gateway API - URL Rewriting', () => {
  test('should rewrite _links to point through gateway', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456`);
    
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('_links');
    expect(data._links).toBeDefined();
    
    if (data._links.self) {
      const selfHref = typeof data._links.self === 'string' 
        ? data._links.self 
        : data._links.self.href;
      
      expect(selfHref).toContain('execute-api.localhost.localstack.cloud');
      expect(selfHref).not.toContain(':8081');
      expect(selfHref).not.toContain(':8082');
      expect(selfHref).not.toContain(':8083');
    }
  });

  test('should maintain gateway URLs in cross-API relationships', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456?include=taxReturns,payments`);
    
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    
    for (const [key, link] of Object.entries(data._links || {})) {
      const href = typeof link === 'string' ? link : (link as any)?.href;
      
      if (href) {
        expect(href).toContain('execute-api.localhost.localstack.cloud');
        expect(href).not.toContain(':8081');
        expect(href).not.toContain(':8082');
        expect(href).not.toContain(':8083');
      }
    }
  });
});

describe('Gateway API - CORS Support', () => {
  test('should include CORS headers in responses', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456`);
    
    expect(response.ok).toBeTruthy();
    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    expect(response.headers.get('access-control-allow-methods')).toBeDefined();
    expect(response.headers.get('access-control-allow-headers')).toBeDefined();
  });

  test('should handle OPTIONS preflight requests', async () => {
    const response = await fetch(`${GATEWAY_BASE_URL}/taxpayers/TP123456`, {
      method: 'OPTIONS'
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    expect(response.headers.get('access-control-allow-methods')).toBeDefined();
    expect(response.headers.get('access-control-allow-headers')).toBeDefined();
  });
});
