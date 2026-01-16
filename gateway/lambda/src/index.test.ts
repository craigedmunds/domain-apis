import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './index';

// Mock node-fetch
jest.mock('node-fetch');
import fetch from 'node-fetch';
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Aggregation Lambda Handler', () => {
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

  describe('CORS Handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const event = createMockEvent({ httpMethod: 'OPTIONS' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      expect(result.body).toBe('');
    });

    it('should include CORS headers in all responses', async () => {
      const event = createMockEvent();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'TP123456', type: 'taxpayer' }),
      } as any);

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });
  });

  describe('Request Routing', () => {
    it('should route taxpayer requests to taxpayer API', async () => {
      const event = createMockEvent({ path: '/taxpayers/TP123456' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'TP123456', type: 'taxpayer' }),
      } as any);

      await handler(event);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://taxpayer-api:4010/taxpayers/TP123456',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should route income-tax requests to income-tax API', async () => {
      const event = createMockEvent({ path: '/income-tax/tax-returns/TR123' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'TR123', type: 'tax-return' }),
      } as any);

      await handler(event);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://income-tax-api:4010/income-tax/tax-returns/TR123',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should route payment requests to payment API', async () => {
      const event = createMockEvent({ path: '/payment/payments/PM123' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'PM123', type: 'payment' }),
      } as any);

      await handler(event);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://payment-api:4010/payment/payments/PM123',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should return 502 for unknown paths', async () => {
      const event = createMockEvent({ path: '/unknown/path' });

      const result = await handler(event);

      expect(result.statusCode).toBe(502);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('GATEWAY_ERROR');
      expect(body.error.message).toBe('Failed to aggregate resources');
    });
  });

  describe('Basic Response Handling', () => {
    it('should return primary resource without include parameter', async () => {
      const event = createMockEvent();
      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        nino: 'AB123456C',
        _links: {
          self: { href: 'http://taxpayer-api:4010/taxpayers/TP123456' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => primaryData,
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.id).toBe('TP123456');
      expect(body._included).toBeUndefined();
    });

    it('should forward backend error responses', async () => {
      const event = createMockEvent();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: 'Not found' }),
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      expect(result.body).toBe(JSON.stringify({ error: 'Not found' }));
    });
  });

  describe('Include Parameter Processing', () => {
    it('should fetch and include related resources', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: 'taxReturns' },
      });

      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          self: { href: 'http://taxpayer-api:4010/taxpayers/TP123456' },
          taxReturns: { href: 'http://income-tax-api:4010/tax-returns?taxpayerId=TP123456' },
        },
      };

      const taxReturnsData = {
        items: [
          { id: 'TR001', type: 'tax-return', taxpayerId: 'TP123456' },
          { id: 'TR002', type: 'tax-return', taxpayerId: 'TP123456' },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => primaryData,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => taxReturnsData,
        } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._included).toBeDefined();
      expect(body._included.taxReturns).toHaveLength(2);
      expect(body._included.taxReturns[0].id).toBe('TR001');
    });

    it('should handle multiple includes', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: 'taxReturns,payments' },
      });

      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          self: { href: 'http://taxpayer-api:4010/taxpayers/TP123456' },
          taxReturns: { href: 'http://income-tax-api:4010/tax-returns?taxpayerId=TP123456' },
          payments: { href: 'http://payment-api:4010/payments?taxpayerId=TP123456' },
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => primaryData,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [{ id: 'TR001' }] }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [{ id: 'PM001' }] }),
        } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._included.taxReturns).toBeDefined();
      expect(body._included.payments).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(3); // Primary + 2 includes
    });

    it('should handle single resource includes', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: 'taxpayer' },
      });

      const primaryData = {
        id: 'TR001',
        type: 'tax-return',
        _links: {
          self: { href: 'http://income-tax-api:4010/tax-returns/TR001' },
          taxpayer: { href: 'http://taxpayer-api:4010/taxpayers/TP123456' },
        },
      };

      const taxpayerData = {
        id: 'TP123456',
        type: 'taxpayer',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => primaryData,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => taxpayerData,
        } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._included.taxpayer).toHaveLength(1);
      expect(body._included.taxpayer[0].id).toBe('TP123456');
    });

    it('should skip includes with no href', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: 'missing' },
      });

      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          self: { href: 'http://taxpayer-api:4010/taxpayers/TP123456' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => primaryData,
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._included).toEqual({});
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only primary resource
    });

    it('should handle partial failures gracefully', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: 'taxReturns,payments' },
      });

      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          self: { href: 'http://taxpayer-api:4010/taxpayers/TP123456' },
          taxReturns: { href: 'http://income-tax-api:4010/tax-returns?taxpayerId=TP123456' },
          payments: { href: 'http://payment-api:4010/payments?taxpayerId=TP123456' },
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => primaryData,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [{ id: 'TR001' }] }),
        } as any)
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._included.taxReturns).toBeDefined();
      expect(body._included.payments).toBeUndefined(); // Failed include is omitted
    });

    it('should handle string link format', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: 'related' },
      });

      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          self: { href: 'http://taxpayer-api:4010/taxpayers/TP123456' },
          related: 'http://income-tax-api:4010/tax-returns/TR001', // String format
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => primaryData,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'TR001', type: 'tax-return' }),
        } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._included.related).toHaveLength(1);
    });
  });

  describe('URL Rewriting', () => {
    it('should add stage prefix to path-only URLs', async () => {
      const event = createMockEvent();
      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          self: { href: '/taxpayers/TP123456' },
          taxReturns: { href: '/tax-returns?taxpayerId=TP123456' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => primaryData,
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._links.self.href).toBe('/dev/taxpayers/TP123456');
      expect(body._links.taxReturns.href).toBe('/dev/tax-returns?taxpayerId=TP123456');
    });

    it('should convert backend URLs to path-only with stage prefix', async () => {
      const event = createMockEvent();
      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          self: { href: 'http://taxpayer-api:4010/taxpayers/TP123456' },
          taxReturns: { href: 'http://income-tax-api:4010/tax-returns?taxpayerId=TP123456' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => primaryData,
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._links.self.href).toBe('/dev/taxpayers/TP123456');
      expect(body._links.taxReturns.href).toBe('/dev/tax-returns?taxpayerId=TP123456');
    });

    it('should convert localhost URLs to path-only with stage prefix', async () => {
      const event = createMockEvent();
      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          self: { href: 'http://localhost:8081/taxpayers/TP123456' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => primaryData,
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._links.self.href).toBe('/dev/taxpayers/TP123456');
    });

    it('should preserve string links during rewriting', async () => {
      const event = createMockEvent();
      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          self: 'http://taxpayer-api:4010/taxpayers/TP123456',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => primaryData,
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._links.self).toBe('/dev/taxpayers/TP123456');
    });
  });

  describe('HTTP Methods', () => {
    it('should handle POST requests', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ nino: 'AB123456C', name: 'John Smith' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'TP123456', type: 'taxpayer' }),
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ nino: 'AB123456C', name: 'John Smith' }),
        })
      );
    });

    it('should handle PUT requests', async () => {
      const event = createMockEvent({
        httpMethod: 'PUT',
        body: JSON.stringify({ name: 'Jane Smith' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'TP123456', type: 'taxpayer' }),
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should handle DELETE requests', async () => {
      const event = createMockEvent({ httpMethod: 'DELETE' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(204);
    });
  });

  describe('Header Forwarding', () => {
    it('should forward authorization headers', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer token123' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'TP123456' }),
      } as any);

      await handler(event);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'Bearer token123',
          }),
        })
      );
    });

    it('should forward x-request-id headers', async () => {
      const event = createMockEvent({
        headers: { 'x-request-id': 'req-123' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'TP123456' }),
      } as any);

      await handler(event);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-request-id': 'req-123',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 502 on fetch errors', async () => {
      const event = createMockEvent();
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await handler(event);

      expect(result.statusCode).toBe(502);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('GATEWAY_ERROR');
      expect(body.error.message).toBe('Failed to aggregate resources');
      expect(body.error.details).toContain('Connection refused');
    });

    it('should include CORS headers in error responses', async () => {
      const event = createMockEvent();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty include parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: '' },
      });

      const primaryData = { id: 'TP123456', type: 'taxpayer', _links: {} };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => primaryData,
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._included).toBeUndefined();
    });

    it('should handle whitespace in include parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: ' taxReturns , payments ' },
      });

      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          taxReturns: { href: 'http://income-tax-api:4010/tax-returns' },
          payments: { href: 'http://payment-api:4010/payments' },
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => primaryData,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
        } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle resources without _links', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: 'something' },
      });

      const primaryData = { id: 'TP123456', type: 'taxpayer' }; // No _links

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => primaryData,
      } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._included).toEqual({});
    });

    it('should handle non-ok responses from included resources', async () => {
      const event = createMockEvent({
        queryStringParameters: { include: 'taxReturns' },
      });

      const primaryData = {
        id: 'TP123456',
        type: 'taxpayer',
        _links: {
          taxReturns: { href: 'http://income-tax-api:4010/tax-returns' },
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => primaryData,
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body._included).toEqual({}); // Failed include is omitted
    });
  });
});
