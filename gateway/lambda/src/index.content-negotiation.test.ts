import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './index';

// Mock node-fetch
jest.mock('node-fetch');
import fetch from 'node-fetch';
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Content Negotiation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default environment variables
    process.env.TAXPAYER_API_URL = 'http://taxpayer-api:4010';
    process.env.INCOME_TAX_API_URL = 'http://income-tax-api:4010';
    process.env.PAYMENT_API_URL = 'http://payment-api:4010';
    process.env.STAGE = 'dev';
  });

  const createMockEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/taxpayers/TP123456',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
    ...overrides,
  });

  const mockTaxpayerResponse = {
    id: 'TP123456',
    type: 'taxpayer',
    nino: 'AB123456C',
    name: {
      firstName: 'John',
      lastName: 'Smith',
    },
    _links: {
      self: { href: '/taxpayers/TP123456' },
      taxReturns: { href: '/tax-returns?taxpayerId=TP123456', type: 'collection' },
    },
  };

  const mockTaxReturnsResponse = {
    items: [
      {
        id: 'TR20230001',
        type: 'tax-return',
        taxpayerId: 'TP123456',
        taxYear: '2023-24',
        status: 'assessed',
        _links: {
          self: { href: '/tax-returns/TR20230001' },
        },
      },
    ],
  };

  describe('Aggregated Mode (Default)', () => {
    it('should return application/vnd.domain+json when no Accept header is provided', async () => {
      const event = createMockEvent();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTaxpayerResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/vnd.domain+json');
      
      const body = JSON.parse(result.body);
      expect(body.id).toBe('TP123456');
      expect(body._links.self.href).toBe('/dev/taxpayers/TP123456');
    });

    it('should return application/vnd.domain+json when Accept: application/vnd.domain+json', async () => {
      const event = createMockEvent({
        headers: { Accept: 'application/vnd.domain+json' },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTaxpayerResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/vnd.domain+json');
    });

    it('should process include parameter in aggregated mode', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: 'taxReturns' },
      });

      // Mock primary resource fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTaxpayerResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      // Mock included resource fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTaxReturnsResponse,
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/vnd.domain+json');
      
      const body = JSON.parse(result.body);
      expect(body._included).toBeDefined();
      expect(body._included.taxReturns).toBeDefined();
      expect(body._included.taxReturns).toHaveLength(1);
      expect(body._included.taxReturns[0].id).toBe('TR20230001');
    });
  });

  describe('Simple REST Mode', () => {
    it('should return application/json when Accept: application/json', async () => {
      const event = createMockEvent({
        headers: { Accept: 'application/json' },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTaxpayerResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(result.body);
      expect(body.id).toBe('TP123456');
      expect(body._links.self.href).toBe('/dev/taxpayers/TP123456');
    });

    it('should ignore include parameter in simple REST mode', async () => {
      const event = createMockEvent({
        headers: { Accept: 'application/json' },
        queryStringParameters: { include: 'taxReturns' },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTaxpayerResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(result.body);
      expect(body._included).toBeUndefined();
      
      // Should only call fetch once (no included resources)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should rewrite URLs in simple REST mode', async () => {
      const event = createMockEvent({
        headers: { Accept: 'application/json' },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTaxpayerResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body._links.self.href).toBe('/dev/taxpayers/TP123456');
      expect(body._links.taxReturns.href).toBe('/dev/tax-returns?taxpayerId=TP123456');
    });
  });

  describe('Pass-Through Mode', () => {
    it('should return raw backend response when Accept: application/vnd.raw', async () => {
      const event = createMockEvent({
        headers: { Accept: 'application/vnd.raw' },
      });
      
      const rawBackendResponse = JSON.stringify(mockTaxpayerResponse);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => rawBackendResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');
      expect(result.body).toBe(rawBackendResponse);
      
      // Verify no URL rewriting occurred
      const body = JSON.parse(result.body);
      expect(body._links.self.href).toBe('/taxpayers/TP123456');
      expect(body._links.taxReturns.href).toBe('/tax-returns?taxpayerId=TP123456');
    });

    it('should ignore include parameter in pass-through mode', async () => {
      const event = createMockEvent({
        headers: { Accept: 'application/vnd.raw' },
        queryStringParameters: { include: 'taxReturns' },
      });
      
      const rawBackendResponse = JSON.stringify(mockTaxpayerResponse);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => rawBackendResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body._included).toBeUndefined();
      
      // Should only call fetch once (no included resources)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should preserve backend Content-Type in pass-through mode', async () => {
      const event = createMockEvent({
        headers: { Accept: 'application/vnd.raw' },
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<xml>data</xml>',
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/xml' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/xml', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/xml');
      expect(result.body).toBe('<xml>data</xml>');
    });
  });

  describe('CORS Headers in All Modes', () => {
    it('should include Accept in CORS headers', async () => {
      const event = createMockEvent({ httpMethod: 'OPTIONS' });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Headers']).toContain('Accept');
    });

    it('should include CORS headers in aggregated mode', async () => {
      const event = createMockEvent();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTaxpayerResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Access-Control-Allow-Methods']).toContain('GET');
    });

    it('should include CORS headers in simple REST mode', async () => {
      const event = createMockEvent({
        headers: { Accept: 'application/json' },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTaxpayerResponse,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should include CORS headers in pass-through mode', async () => {
      const event = createMockEvent({
        headers: { Accept: 'application/vnd.raw' },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockTaxpayerResponse),
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/json', 'content-type');
          },
        },
      } as any);

      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
