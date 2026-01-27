/**
 * VPD POC - Smoke Test for Backend Mocks
 *
 * This k6 script tests connectivity and basic responses from the backend mocks.
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

export default function () {
  group('Excise Mock', () => {
    // Test GET registration
    const regRes = http.get(`${EXCISE_URL}/excise/vpd/registrations/VPD123456`);
    const regOk = check(regRes, {
      'excise registration status 200': (r) => r.status === 200,
      'excise registration has customerId': (r) => {
        const body = JSON.parse(r.body);
        return body.customerId === 'CUST789';
      },
    });
    errorRate.add(!regOk);

    // Test GET period
    const periodRes = http.get(`${EXCISE_URL}/excise/vpd/periods/24A1`);
    const periodOk = check(periodRes, {
      'excise period status 200': (r) => r.status === 200,
      'excise period has state': (r) => {
        const body = JSON.parse(r.body);
        return body.state === 'OPEN';
      },
    });
    errorRate.add(!periodOk);

    // Test POST validate-and-calculate
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
      { headers: { 'Content-Type': 'application/json' } }
    );
    const validateOk = check(validateRes, {
      'excise validate status 200': (r) => r.status === 200,
      'excise validate returns valid': (r) => {
        const body = JSON.parse(r.body);
        return body.valid === true;
      },
    });
    errorRate.add(!validateOk);
  });

  group('Customer Mock', () => {
    const res = http.get(`${CUSTOMER_URL}/customers/CUST789`);
    const ok = check(res, {
      'customer status 200': (r) => r.status === 200,
      'customer has name': (r) => {
        const body = JSON.parse(r.body);
        return body.name === 'Example Vapes Ltd';
      },
    });
    errorRate.add(!ok);
  });

  group('Tax Platform Mock', () => {
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
      'tax-platform get has vpdApprovalNumber': (r) => {
        const body = JSON.parse(r.body);
        return body.vpdApprovalNumber === 'VPD123456';
      },
    });
    errorRate.add(!getOk);
  });

  sleep(1);
}
