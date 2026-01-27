/**
 * Example Validation Tests
 *
 * Validates that all examples in OpenAPI specifications are valid
 * against their corresponding schemas.
 */

import { loadSpec, hasExamples } from '../helpers/openapi-validator';

describe('Example Validation', () => {
  describe('Excise Duty System API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/vaping-duty/mocks/excise-api.yaml');
    });

    it('should have examples in the specification', () => {
      const result = hasExamples(spec);

      if (!result.valid) {
        console.log('Example validation errors:', result.errors);
      }

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have examples for GET /excise/vpd/registrations/{vpdApprovalNumber}', () => {
      const operation = spec.paths['/excise/vpd/registrations/{vpdApprovalNumber}']?.get;
      expect(operation).toBeDefined();

      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();

      const content = response200.content?.['application/json'];
      expect(content).toBeDefined();
      expect(content.examples || content.example).toBeDefined();
    });

    it('should have examples for GET /excise/vpd/periods/{periodKey}', () => {
      const operation = spec.paths['/excise/vpd/periods/{periodKey}']?.get;
      expect(operation).toBeDefined();

      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();

      const content = response200.content?.['application/json'];
      expect(content).toBeDefined();
      expect(content.examples || content.example).toBeDefined();
    });

    it('should have examples for POST /excise/vpd/validate-and-calculate', () => {
      const operation = spec.paths['/excise/vpd/validate-and-calculate']?.post;
      expect(operation).toBeDefined();

      // Check request body examples
      const requestBody = operation.requestBody;
      expect(requestBody).toBeDefined();

      const requestContent = requestBody.content?.['application/json'];
      expect(requestContent).toBeDefined();
      expect(requestContent.examples || requestContent.example).toBeDefined();

      // Check response examples
      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();

      const responseContent = response200.content?.['application/json'];
      expect(responseContent).toBeDefined();
      expect(responseContent.examples || responseContent.example).toBeDefined();
    });

    it('should have valid VPD approval number format in examples', () => {
      const vpdPattern = /^VPD\d{6}$/;

      // Check registration example in components/examples
      const registrationExamples = spec.components?.examples;

      if (registrationExamples?.ActiveRegistration) {
        const example = registrationExamples.ActiveRegistration.value;
        if (example?.vpdApprovalNumber) {
          expect(example.vpdApprovalNumber).toMatch(vpdPattern);
        }
      }
    });

    it('should have valid registration status in examples', () => {
      const validStatuses = ['ACTIVE', 'SUSPENDED', 'REVOKED'];

      // Check registration example in components/examples
      const registrationExamples = spec.components?.examples;

      if (registrationExamples?.ActiveRegistration) {
        const example = registrationExamples.ActiveRegistration.value;
        if (example?.status) {
          expect(validStatuses).toContain(example.status);
        }
      }
    });

    it('should have valid period state in examples', () => {
      const validStates = ['OPEN', 'FILED', 'CLOSED'];

      // Check period example in components/examples
      const periodExamples = spec.components?.examples;

      if (periodExamples?.OpenPeriod) {
        const example = periodExamples.OpenPeriod.value;
        if (example?.state) {
          expect(validStates).toContain(example.state);
        }
      }
    });
  });

  describe('Customer Master Data API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/vaping-duty/mocks/customer-api.yaml');
    });

    it('should have examples in the specification', () => {
      const result = hasExamples(spec);

      if (!result.valid) {
        console.log('Example validation errors:', result.errors);
      }

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have examples for GET /customers/{customerId}', () => {
      const operation = spec.paths['/customers/{customerId}']?.get;
      expect(operation).toBeDefined();

      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();

      const content = response200.content?.['application/json'];
      expect(content).toBeDefined();
      expect(content.examples || content.example).toBeDefined();
    });

    it('should have valid customer type in examples', () => {
      const validTypes = ['ORG', 'INDIVIDUAL'];

      // Check customer examples in components/examples
      const customerExamples = spec.components?.examples;

      for (const exampleName of ['OrganizationCustomer', 'IndividualCustomer']) {
        if (customerExamples?.[exampleName]) {
          const example = customerExamples[exampleName].value;
          if (example?.type) {
            expect(validTypes).toContain(example.type);
          }
        }
      }
    });

    it('should have valid UK postcode format in examples', () => {
      const postcodePattern = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/;

      // Check customer examples in components/examples
      const customerExamples = spec.components?.examples;

      for (const exampleName of ['OrganizationCustomer', 'IndividualCustomer']) {
        if (customerExamples?.[exampleName]) {
          const example = customerExamples[exampleName].value;
          if (example?.registeredAddress?.postcode) {
            expect(example.registeredAddress.postcode).toMatch(postcodePattern);
          }
        }
      }
    });
  });

  describe('Tax Platform Submissions API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/vaping-duty/mocks/tax-platform-api.yaml');
    });

    it('should have examples in the specification', () => {
      const result = hasExamples(spec);

      if (!result.valid) {
        console.log('Example validation errors:', result.errors);
      }

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have examples for POST /submissions/vpd', () => {
      const operation = spec.paths['/submissions/vpd']?.post;
      expect(operation).toBeDefined();

      // Check request body examples
      const requestBody = operation.requestBody;
      expect(requestBody).toBeDefined();

      const requestContent = requestBody.content?.['application/json'];
      expect(requestContent).toBeDefined();
      expect(requestContent.examples || requestContent.example).toBeDefined();

      // Check response examples
      const response201 = operation.responses['201'];
      expect(response201).toBeDefined();

      const responseContent = response201.content?.['application/json'];
      expect(responseContent).toBeDefined();
      expect(responseContent.examples || responseContent.example).toBeDefined();
    });

    it('should have examples for GET /submissions/vpd', () => {
      const operation = spec.paths['/submissions/vpd']?.get;
      expect(operation).toBeDefined();

      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();

      const content = response200.content?.['application/json'];
      expect(content).toBeDefined();
      expect(content.examples || content.example).toBeDefined();
    });

    it('should have examples for GET /submissions/vpd/{acknowledgementReference}', () => {
      const operation = spec.paths['/submissions/vpd/{acknowledgementReference}']?.get;
      expect(operation).toBeDefined();

      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();

      const content = response200.content?.['application/json'];
      expect(content).toBeDefined();
      expect(content.examples || content.example).toBeDefined();
    });

    it('should have valid submission status in examples', () => {
      const validStatuses = ['RECEIVED', 'VALIDATED', 'REJECTED'];

      // Check submission example in components/examples
      const submissionExamples = spec.components?.examples;

      if (submissionExamples?.StoredSubmission) {
        const example = submissionExamples.StoredSubmission.value;
        if (example?.status) {
          expect(validStatuses).toContain(example.status);
        }
      }
    });

    it('should have valid Money objects in examples', () => {
      // Check store request example in components/examples
      const storeExamples = spec.components?.examples;

      if (storeExamples?.StoreRequest) {
        const example = storeExamples.StoreRequest.value;
        if (example?.calculations?.totalDutyDue) {
          expect(example.calculations.totalDutyDue).toHaveProperty('amount');
          expect(example.calculations.totalDutyDue).toHaveProperty('currency');
          expect(example.calculations.totalDutyDue.currency).toBe('GBP');
          expect(typeof example.calculations.totalDutyDue.amount).toBe('number');
        }
      }
    });
  });

  describe('Cross-API consistency', () => {
    it('should have consistent VPD approval number format across APIs', () => {
      const exciseSpec = loadSpec('specs/vaping-duty/mocks/excise-api.yaml');
      const taxPlatformSpec = loadSpec('specs/vaping-duty/mocks/tax-platform-api.yaml');

      const vpdPattern = /^VPD\d{6}$/;

      // Check excise examples in components/examples
      const exciseExamples = exciseSpec.components?.examples;

      if (exciseExamples?.ActiveRegistration) {
        const example = exciseExamples.ActiveRegistration.value;
        if (example?.vpdApprovalNumber) {
          expect(example.vpdApprovalNumber).toMatch(vpdPattern);
        }
      }

      // Check tax platform examples in components/examples
      const taxPlatformExamples = taxPlatformSpec.components?.examples;

      if (taxPlatformExamples?.StoreRequest) {
        const example = taxPlatformExamples.StoreRequest.value;
        if (example?.vpdApprovalNumber) {
          expect(example.vpdApprovalNumber).toMatch(vpdPattern);
        }
      }
    });

    it('should have consistent customer ID format across APIs', () => {
      const exciseSpec = loadSpec('specs/vaping-duty/mocks/excise-api.yaml');
      const customerSpec = loadSpec('specs/vaping-duty/mocks/customer-api.yaml');
      const taxPlatformSpec = loadSpec('specs/vaping-duty/mocks/tax-platform-api.yaml');

      const customerIdPattern = /^CUST\d{3,}$/;

      // Collect all customer IDs from examples
      const customerIds: string[] = [];

      // From excise registration in components/examples
      const exciseExamples = exciseSpec.components?.examples;
      if (exciseExamples?.ActiveRegistration?.value?.customerId) {
        customerIds.push(exciseExamples.ActiveRegistration.value.customerId);
      }

      // From customer API in components/examples
      const customerExamples = customerSpec.components?.examples;
      for (const exampleName of ['OrganizationCustomer', 'IndividualCustomer']) {
        if (customerExamples?.[exampleName]?.value?.customerId) {
          customerIds.push(customerExamples[exampleName].value.customerId);
        }
      }

      // All customer IDs should match the pattern
      for (const customerId of customerIds) {
        expect(customerId).toMatch(customerIdPattern);
      }
    });
  });
});
