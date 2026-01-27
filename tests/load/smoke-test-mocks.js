/**
 * VPD POC - Smoke Test for Backend Mocks
 *
 * This k6 script tests connectivity and basic responses from the backend mocks.
 *
 * **Content Types:**
 * - excise: Returns XML (legacy system simulation)
 * - customer: Returns JSON
 * - tax-platform: Returns JSON
 *
 * Run with: k6 run smoke-test-mocks.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
    },
  },
  thresholds: {
    'errors': ['rate<0.1'],
    'http_req_duration': ['p(95)<1000'],
  },
};

// Base URLs for mocks
const EXCISE_URL = __ENV.EXCISE_URL || 'http://localhost:4010';
const CUSTOMER_URL = __ENV.CUSTOMER_URL || 'http://localhost:4011';
const TAX_PLATFORM_URL = __ENV.TAX_PLATFORM_URL || 'http://localhost:4012';

/**
 * Simple XML element extraction
 * Extracts the text content between <tag>content</tag>
 * Note: This is a basic implementation for testing purposes
 */
function extractXmlElement(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Check if XML contains an element
 */
function xmlContains(xml, tagName) {
  return xml.includes(`<${tagName}>`) && xml.includes(`</${tagName}>`);
}

export default function () {
  group('Excise Mock (XML)', () => {
    // Test GET registration - expects XML response
    const regRes = http.get(`${EXCISE_URL}/excise/vpd/registrations/VPD123456`, {
      headers: { 'Accept': 'application/xml' },
    });
    const regOk = check(regRes, {
      'excise registration status 200': (r) => r.status === 200,
      'excise registration content-type is XML': (r) => {
        const contentType = r.headers['Content-Type'] || '';
        return contentType.includes('application/xml') || contentType.includes('text/xml');
      },
      'excise registration has customerId element': (r) => {
        return xmlContains(r.body, 'customerId');
      },
      'excise registration customerId is CUST789': (r) => {
        return extractXmlElement(r.body, 'customerId') === 'CUST789';
      },
      'excise registration has status element': (r) => {
        return xmlContains(r.body, 'status');
      },
      'excise registration status is ACTIVE': (r) => {
        return extractXmlElement(r.body, 'status') === 'ACTIVE';
      },
    });
    errorRate.add(!regOk);

    // Test GET period - expects XML response
    const periodRes = http.get(`${EXCISE_URL}/excise/vpd/periods/24A1`, {
      headers: { 'Accept': 'application/xml' },
    });
    const periodOk = check(periodRes, {
      'excise period status 200': (r) => r.status === 200,
      'excise period content-type is XML': (r) => {
        const contentType = r.headers['Content-Type'] || '';
        return contentType.includes('application/xml') || contentType.includes('text/xml');
      },
      'excise period has state element': (r) => {
        return xmlContains(r.body, 'state');
      },
      'excise period state is OPEN': (r) => {
        return extractXmlElement(r.body, 'state') === 'OPEN';
      },
      'excise period has periodKey element': (r) => {
        return xmlContains(r.body, 'periodKey');
      },
    });
    errorRate.add(!periodOk);

    // Test POST validate-and-calculate - JSON request, XML response
    const validatePayload = JSON.stringify({
      vpdApprovalNumber: 'VPD123456',
      periodKey: '24A1',
      submission: {
        basicInformation: {
          returnType: 'ORIGINAL',
          submittedBy: { type: 'ORG', name: 'Example Vapes Ltd' },
        },
        dutyProducts: [],
      },
    });
    const validateRes = http.post(
      `${EXCISE_URL}/excise/vpd/validate-and-calculate`,
      validatePayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/xml',
        },
      }
    );
    const validateOk = check(validateRes, {
      'excise validate status 200': (r) => r.status === 200,
      'excise validate content-type is XML': (r) => {
        const contentType = r.headers['Content-Type'] || '';
        return contentType.includes('application/xml') || contentType.includes('text/xml');
      },
      'excise validate has valid element': (r) => {
        return xmlContains(r.body, 'valid');
      },
      'excise validate returns valid=true': (r) => {
        return extractXmlElement(r.body, 'valid') === 'true';
      },
      'excise validate has customerId element': (r) => {
        return xmlContains(r.body, 'customerId');
      },
      'excise validate has calculations element': (r) => {
        return xmlContains(r.body, 'calculations');
      },
    });
    errorRate.add(!validateOk);
  });

  group('Customer Mock (JSON)', () => {
    const res = http.get(`${CUSTOMER_URL}/customers/CUST789`);
    const ok = check(res, {
      'customer status 200': (r) => r.status === 200,
      'customer content-type is JSON': (r) => {
        const contentType = r.headers['Content-Type'] || '';
        return contentType.includes('application/json');
      },
      'customer has name': (r) => {
        const body = JSON.parse(r.body);
        return body.name === 'Example Vapes Ltd';
      },
    });
    errorRate.add(!ok);
  });

  group('Tax Platform Mock (JSON)', () => {
    // Test POST submission
    const storePayload = JSON.stringify({
      vpdApprovalNumber: 'VPD123456',
      periodKey: '24A1',
      customerId: 'CUST789',
      submission: {
        basicInformation: {
          returnType: 'ORIGINAL',
          submittedBy: { type: 'ORG', name: 'Example Vapes Ltd' },
        },
        dutyProducts: [],
      },
      calculations: {
        totalDutyDue: { amount: 12345.67, currency: 'GBP' },
        vat: { amount: 2469.13, currency: 'GBP' },
        calculationHash: 'sha256:abc123def456',
      },
      warnings: [],
    });
    const storeRes = http.post(`${TAX_PLATFORM_URL}/submissions/vpd`, storePayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `test-${__VU}-${__ITER}`,
      },
    });
    const storeOk = check(storeRes, {
      'tax-platform store status 201': (r) => r.status === 201,
      'tax-platform store content-type is JSON': (r) => {
        const contentType = r.headers['Content-Type'] || '';
        return contentType.includes('application/json');
      },
      'tax-platform store has ack ref': (r) => {
        const body = JSON.parse(r.body);
        return body.acknowledgementReference !== undefined;
      },
    });
    errorRate.add(!storeOk);

    // Test GET by acknowledgement
    const getRes = http.get(
      `${TAX_PLATFORM_URL}/submissions/vpd/ACK-2026-01-26-000123`
    );
    const getOk = check(getRes, {
      'tax-platform get status 200': (r) => r.status === 200,
      'tax-platform get content-type is JSON': (r) => {
        const contentType = r.headers['Content-Type'] || '';
        return contentType.includes('application/json');
      },
      'tax-platform get has vpdApprovalNumber': (r) => {
        const body = JSON.parse(r.body);
        return body.vpdApprovalNumber === 'VPD123456';
      },
    });
    errorRate.add(!getOk);
  });

  sleep(1);
}
