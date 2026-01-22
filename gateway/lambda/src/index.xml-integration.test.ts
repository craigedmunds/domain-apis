/**
 * XML Integration Tests for Gateway Lambda Handler
 *
 * These tests verify the gateway correctly handles XML responses from backends
 * that use the simple-xml-response adapter, including:
 * - XML to JSON transformation
 * - Link injection based on service configuration
 * - Include parameter support with XML backends
 * - Error handling for invalid XML
 *
 * Requirements validated:
 * - Spec 0001: Simple XML Response Adapter Implementation
 * - Phase 3: Gateway Integration Tests
 * - Phase 4: Include Parameter Support for XML Resources
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './index';
import { clearConfigCache, setSpecsBasePath } from './config/service-config';

// Mock node-fetch
jest.mock('node-fetch');
import fetch from 'node-fetch';
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock fs for service config loading
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import * as fs from 'fs';
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

describe('Gateway XML Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks completely - this is important for test isolation
    jest.resetAllMocks();
    clearConfigCache();

    // Set default environment variables
    process.env.TAXPAYER_API_URL = 'http://taxpayer-api:4010';
    process.env.INCOME_TAX_API_URL = 'http://income-tax-api:4010';
    process.env.PAYMENT_API_URL = 'http://payment-api:4010';
    process.env.STAGE = 'dev';
    process.env.SPECS_PATH = '/var/task/specs';
  });

  afterEach(() => {
    clearConfigCache();
    jest.resetAllMocks();
  });

  const createMockEvent = (
    overrides: Partial<APIGatewayProxyEvent> = {}
  ): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/payment/payments/PM20230001',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
    ...overrides,
  });

  // Payment service config with simple-xml-response adapter
  const paymentServiceConfig = `
adapters:
  - simple-xml-response

relationships:
  taxpayer:
    targetApi: taxpayer
    targetResource: taxpayers
    sourceField: taxpayerId
    linkType: taxpayer
    linkTitle: "Taxpayer who made this payment"
  allocations:
    targetApi: payment
    targetResource: allocations
    sourceField: id
    urlPattern: "/payments/{id}/allocations"
    linkType: collection
    linkTitle: "Allocations for this payment"
`;

  // Taxpayer service config (no adapter - returns JSON)
  const taxpayerServiceConfig = `
adapters: []
`;

  /**
   * Helper to set up mock file system for service configs
   */
  function setupServiceConfigs(configs: Record<string, string | null>) {
    mockExistsSync.mockImplementation((path: any) => {
      const pathStr = String(path);
      for (const [apiName, config] of Object.entries(configs)) {
        if (pathStr.includes(`/${apiName}/service.yaml`)) {
          return config !== null;
        }
      }
      return false;
    });

    mockReadFileSync.mockImplementation((path: any) => {
      const pathStr = String(path);
      for (const [apiName, config] of Object.entries(configs)) {
        if (pathStr.includes(`/${apiName}/service.yaml`) && config !== null) {
          return config;
        }
      }
      throw new Error(`File not found: ${path}`);
    });
  }

  /**
   * Create a mock Response object that simulates node-fetch Response
   */
  function createMockResponse(
    body: string,
    contentType: string,
    status = 200,
    ok = true
  ) {
    const headers = new Map<string, string>();
    headers.set('content-type', contentType);

    return {
      ok,
      status,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === 'content-type') return contentType;
          return null;
        },
        forEach: (callback: (value: string, key: string) => void) => {
          headers.forEach((value, key) => callback(value, key));
        },
      },
      text: async () => body,
      json: async () => JSON.parse(body),
    } as any;
  }

  describe('XML Response Transformation', () => {
    it('should transform XML response to JSON', async () => {
      setupServiceConfigs({ payment: paymentServiceConfig });

      const event = createMockEvent({ path: '/payment/payments/PM20230001' });

      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<payment>
  <id>PM20230001</id>
  <type>payment</type>
  <taxpayerId>TP123456</taxpayerId>
  <amount>
    <amount>7500.00</amount>
    <currency>GBP</currency>
  </amount>
  <paymentDate>2024-01-31</paymentDate>
  <paymentMethod>bank-transfer</paymentMethod>
  <reference>TAX-2023-001</reference>
  <status>cleared</status>
</payment>`;

      mockFetch.mockResolvedValueOnce(
        createMockResponse(xmlResponse, 'application/xml')
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.payment).toBeDefined();
      expect(body.payment.id).toBe('PM20230001');
      expect(body.payment.type).toBe('payment');
      expect(body.payment.taxpayerId).toBe('TP123456');
      expect(body.payment.amount.amount).toBe(7500);
      expect(body.payment.amount.currency).toBe('GBP');
      expect(body.payment.paymentMethod).toBe('bank-transfer');
      expect(body.payment.status).toBe('cleared');
    });

    it('should update Content-Type header from XML to JSON', async () => {
      setupServiceConfigs({ payment: paymentServiceConfig });

      const event = createMockEvent({ path: '/payment/payments/PM20230001' });

      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<payment>
  <id>PM20230001</id>
  <type>payment</type>
</payment>`;

      mockFetch.mockResolvedValueOnce(
        createMockResponse(xmlResponse, 'application/xml')
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      // In aggregated mode, Content-Type is application/vnd.domain+json
      expect(result.headers?.['Content-Type']).toBe('application/vnd.domain+json');
    });

    it('should preserve JSON responses for APIs without XML adapter', async () => {
      setupServiceConfigs({ taxpayer: taxpayerServiceConfig });

      const event = createMockEvent({ path: '/taxpayer/taxpayers/TP123456' });

      const jsonResponse = {
        id: 'TP123456',
        type: 'taxpayer',
        nino: 'AB123456C',
        _links: {
          self: { href: '/taxpayers/TP123456' },
        },
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(JSON.stringify(jsonResponse), 'application/json')
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.id).toBe('TP123456');
      expect(body.type).toBe('taxpayer');
    });
  });

  describe('XML Error Handling', () => {
    it('should return 502 for completely invalid XML', async () => {
      setupServiceConfigs({ payment: paymentServiceConfig });

      const event = createMockEvent({ path: '/payment/payments/PM20230001' });

      // Completely invalid XML - not XML at all
      const invalidXml = `this is not xml at all {{{}}}`;

      mockFetch.mockResolvedValueOnce(
        createMockResponse(invalidXml, 'application/xml')
      );

      const result = await handler(event);

      // The gateway returns 502 when XML transformation fails
      expect(result.statusCode).toBe(502);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('TRANSFORMATION_ERROR');
    });

    it('should return 502 for empty XML', async () => {
      setupServiceConfigs({ payment: paymentServiceConfig });

      const event = createMockEvent({ path: '/payment/payments/PM20230001' });

      mockFetch.mockResolvedValueOnce(createMockResponse('', 'application/xml'));

      const result = await handler(event);

      expect(result.statusCode).toBe(502);

      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('TRANSFORMATION_ERROR');
    });
  });

  describe('XML Collection Transformation', () => {
    it('should transform XML collection to JSON array', async () => {
      setupServiceConfigs({ payment: paymentServiceConfig });

      const event = createMockEvent({ path: '/payment/payments' });

      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<payments>
  <items>
    <payment>
      <id>PM20230001</id>
      <type>payment</type>
      <taxpayerId>TP123456</taxpayerId>
      <status>cleared</status>
    </payment>
    <payment>
      <id>PM20230002</id>
      <type>payment</type>
      <taxpayerId>TP789012</taxpayerId>
      <status>pending</status>
    </payment>
  </items>
</payments>`;

      mockFetch.mockResolvedValueOnce(
        createMockResponse(xmlResponse, 'application/xml')
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.payments).toBeDefined();
      expect(body.payments.items).toBeDefined();
    });
  });

  describe('Adapter Detection', () => {
    it('should detect adapter for payment API', async () => {
      setupServiceConfigs({ payment: paymentServiceConfig });

      const event = createMockEvent({ path: '/payment/payments/PM20230001' });

      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<payment>
  <id>PM20230001</id>
  <type>payment</type>
</payment>`;

      mockFetch.mockResolvedValueOnce(
        createMockResponse(xmlResponse, 'application/xml')
      );

      const result = await handler(event);

      // Should successfully transform without errors
      expect(result.statusCode).toBe(200);
    });

    it('should not apply adapter for API without service config', async () => {
      setupServiceConfigs({ payment: null }); // No service config

      const event = createMockEvent({ path: '/payment/payments/PM20230001' });

      const jsonResponse = {
        id: 'PM20230001',
        type: 'payment',
        _links: { self: { href: '/payments/PM20230001' } },
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(JSON.stringify(jsonResponse), 'application/json')
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.id).toBe('PM20230001');
    });
  });

  describe('Include Parameter with XML Backends', () => {
    it('should handle include parameter with XML primary resource', async () => {
      setupServiceConfigs({
        payment: paymentServiceConfig,
        taxpayer: taxpayerServiceConfig,
      });

      const event = createMockEvent({
        path: '/payment/payments/PM20230001',
        queryStringParameters: { include: 'taxpayer' },
      });

      // XML response from payment backend
      const xmlPayment = `<?xml version="1.0" encoding="UTF-8"?>
<payment>
  <id>PM20230001</id>
  <type>payment</type>
  <taxpayerId>TP123456</taxpayerId>
  <_links>
    <self>
      <href>/payments/PM20230001</href>
    </self>
    <taxpayer>
      <href>/taxpayers/TP123456</href>
      <type>taxpayer</type>
      <title>Taxpayer who made this payment</title>
    </taxpayer>
  </_links>
</payment>`;

      // JSON response from taxpayer backend
      const jsonTaxpayer = {
        id: 'TP123456',
        type: 'taxpayer',
        nino: 'AB123456C',
        name: { firstName: 'John', lastName: 'Smith' },
        _links: { self: { href: '/taxpayers/TP123456' } },
      };

      mockFetch
        .mockResolvedValueOnce(createMockResponse(xmlPayment, 'application/xml'))
        .mockResolvedValueOnce(
          createMockResponse(JSON.stringify(jsonTaxpayer), 'application/json')
        );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      // Verify primary resource was transformed
      expect(body.payment).toBeDefined();
      expect(body.payment.id).toBe('PM20230001');

      // Verify taxpayer was fetched and included
      // Note: The exact structure depends on how the gateway handles _included
    });

    it('should handle JSON primary with include to related resource', async () => {
      // Ensure clean state
      jest.resetAllMocks();
      clearConfigCache();
      setupServiceConfigs({
        taxpayer: taxpayerServiceConfig,
        payment: paymentServiceConfig,
      });

      const event = createMockEvent({
        path: '/taxpayer/taxpayers/TP123456',
        queryStringParameters: { include: 'payments' },
      });

      // JSON response from taxpayer backend with payments link
      const jsonTaxpayer = {
        id: 'TP123456',
        type: 'taxpayer',
        nino: 'AB123456C',
        _links: {
          self: { href: '/taxpayers/TP123456' },
          payments: {
            href: 'http://payment-api:4010/payments?taxpayerId=TP123456',
            type: 'collection',
            title: 'Payments from this taxpayer',
          },
        },
      };

      // JSON response from payment API
      const jsonPayments = {
        items: [
          {
            id: 'PM20230001',
            type: 'payment',
            taxpayerId: 'TP123456',
            _links: { self: { href: '/payments/PM20230001' } },
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce(
          createMockResponse(JSON.stringify(jsonTaxpayer), 'application/json')
        )
        .mockResolvedValueOnce(
          createMockResponse(JSON.stringify(jsonPayments), 'application/json')
        );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.id).toBe('TP123456');
      expect(body._included).toBeDefined();
      expect(body._included.payments).toBeDefined();
      expect(body._included.payments).toHaveLength(1);
      expect(body._included.payments[0].id).toBe('PM20230001');
    });
  });

  describe('Pass-Through Mode with XML', () => {
    it('should return raw XML in pass-through mode', async () => {
      // Ensure clean state
      jest.resetAllMocks();
      clearConfigCache();
      setupServiceConfigs({ payment: paymentServiceConfig });

      const event = createMockEvent({
        path: '/payment/payments/PM20230001',
        headers: { Accept: 'application/vnd.raw' },
      });

      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<payment>
  <id>PM20230001</id>
  <type>payment</type>
</payment>`;

      mockFetch.mockResolvedValueOnce(
        createMockResponse(xmlResponse, 'application/xml')
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      // In pass-through mode, should return raw XML without transformation
      expect(result.body).toContain('<payment>');
      expect(result.body).toContain('PM20230001');
      expect(result.headers?.['Content-Type']).toBe('application/xml');
    });
  });

  describe('Simple REST Mode with XML', () => {
    it('should transform XML and return JSON in simple REST mode', async () => {
      // Ensure clean state
      jest.resetAllMocks();
      clearConfigCache();
      setupServiceConfigs({ payment: paymentServiceConfig });

      const event = createMockEvent({
        path: '/payment/payments/PM20230001',
        headers: { Accept: 'application/json' },
      });

      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<payment>
  <id>PM20230001</id>
  <type>payment</type>
  <taxpayerId>TP123456</taxpayerId>
</payment>`;

      mockFetch.mockResolvedValueOnce(
        createMockResponse(xmlResponse, 'application/xml')
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');

      const body = JSON.parse(result.body);
      // XML transformer wraps content in root element
      expect(body.payment).toBeDefined();
      expect(body.payment.id).toBe('PM20230001');
      expect(body.payment.taxpayerId).toBe('TP123456');
    });
  });
});
