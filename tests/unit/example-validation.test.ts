/**
 * Example Validation Tests
 * 
 * Validates that all examples in OpenAPI specifications are valid
 * against their corresponding schemas.
 * 
 * Validates: Requirements 8.1, 8.2
 */

import { loadSpec, hasExamples } from '../helpers/openapi-validator';

describe('Example Validation', () => {
  describe('Taxpayer API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/taxpayer/taxpayer-api.yaml');
    });

    it('should have examples in the specification', () => {
      const result = hasExamples(spec);
      
      if (!result.valid) {
        console.log('Example validation errors:', result.errors);
      }
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have examples for GET /taxpayers endpoint', () => {
      const operation = spec.paths['/taxpayers']?.get;
      expect(operation).toBeDefined();
      
      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();
      
      const content = response200.content?.['application/json'];
      expect(content).toBeDefined();
      expect(content.examples || content.example).toBeDefined();
    });

    it('should have examples for POST /taxpayers endpoint', () => {
      const operation = spec.paths['/taxpayers']?.post;
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

    it('should have examples for GET /taxpayers/{id} endpoint', () => {
      const operation = spec.paths['/taxpayers/{id}']?.get;
      expect(operation).toBeDefined();
      
      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();
      
      const content = response200.content?.['application/json'];
      expect(content).toBeDefined();
      expect(content.examples || content.example).toBeDefined();
    });

    it('should have valid NINO format in examples', () => {
      const ninoPattern = /^[A-Z]{2}[0-9]{6}[A-Z]$/;
      
      // Check GET /taxpayers examples
      const listOperation = spec.paths['/taxpayers']?.get;
      const listExamples = listOperation?.responses['200']?.content?.['application/json']?.examples;
      
      if (listExamples) {
        for (const [exampleName, exampleObj] of Object.entries(listExamples)) {
          const example = (exampleObj as any).value;
          if (example.items) {
            for (const taxpayer of example.items) {
              if (taxpayer.nino) {
                expect(taxpayer.nino).toMatch(ninoPattern);
              }
            }
          }
        }
      }
    });

    it('should have valid UK postcode format in examples', () => {
      const postcodePattern = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/;
      
      // Check GET /taxpayers examples
      const listOperation = spec.paths['/taxpayers']?.get;
      const listExamples = listOperation?.responses['200']?.content?.['application/json']?.examples;
      
      if (listExamples) {
        for (const [exampleName, exampleObj] of Object.entries(listExamples)) {
          const example = (exampleObj as any).value;
          if (example.items) {
            for (const taxpayer of example.items) {
              if (taxpayer.address?.postcode) {
                expect(taxpayer.address.postcode).toMatch(postcodePattern);
              }
            }
          }
        }
      }
    });
  });

  describe('Income Tax API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/income-tax/income-tax-api.yaml');
    });

    it('should have examples in the specification', () => {
      const result = hasExamples(spec);
      
      if (!result.valid) {
        console.log('Example validation errors:', result.errors);
      }
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have examples for GET /tax-returns endpoint', () => {
      const operation = spec.paths['/tax-returns']?.get;
      expect(operation).toBeDefined();
      
      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();
      
      const content = response200.content?.['application/json'];
      expect(content).toBeDefined();
      expect(content.examples || content.example).toBeDefined();
    });

    it('should have examples for POST /tax-returns endpoint', () => {
      const operation = spec.paths['/tax-returns']?.post;
      expect(operation).toBeDefined();
      
      // Check request body examples
      const requestBody = operation.requestBody;
      expect(requestBody).toBeDefined();
      
      const requestContent = requestBody.content?.['application/json'];
      expect(requestContent).toBeDefined();
      expect(requestContent.examples || requestContent.example).toBeDefined();
    });

    it('should have valid tax year format in examples', () => {
      const taxYearPattern = /^\d{4}-\d{2}$/;
      
      // Check GET /tax-returns examples
      const listOperation = spec.paths['/tax-returns']?.get;
      const listExamples = listOperation?.responses['200']?.content?.['application/json']?.examples;
      
      if (listExamples) {
        for (const [exampleName, exampleObj] of Object.entries(listExamples)) {
          const example = (exampleObj as any).value;
          if (example.items) {
            for (const taxReturn of example.items) {
              if (taxReturn.taxYear) {
                expect(taxReturn.taxYear).toMatch(taxYearPattern);
              }
            }
          }
        }
      }
    });

    it('should have valid Money objects in examples', () => {
      // Check GET /tax-returns examples
      const listOperation = spec.paths['/tax-returns']?.get;
      const listExamples = listOperation?.responses['200']?.content?.['application/json']?.examples;
      
      if (listExamples) {
        for (const [exampleName, exampleObj] of Object.entries(listExamples)) {
          const example = (exampleObj as any).value;
          if (example.items) {
            for (const taxReturn of example.items) {
              if (taxReturn.totalIncome) {
                expect(taxReturn.totalIncome).toHaveProperty('amount');
                expect(taxReturn.totalIncome).toHaveProperty('currency');
                expect(taxReturn.totalIncome.currency).toBe('GBP');
                expect(typeof taxReturn.totalIncome.amount).toBe('number');
              }
            }
          }
        }
      }
    });
  });

  describe('Payment API', () => {
    let spec: any;

    beforeAll(() => {
      spec = loadSpec('specs/payment/payment-api.yaml');
    });

    it('should have examples in the specification', () => {
      const result = hasExamples(spec);
      
      if (!result.valid) {
        console.log('Example validation errors:', result.errors);
      }
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have examples for GET /payments endpoint', () => {
      const operation = spec.paths['/payments']?.get;
      expect(operation).toBeDefined();
      
      const response200 = operation.responses['200'];
      expect(response200).toBeDefined();
      
      const content = response200.content?.['application/json'];
      expect(content).toBeDefined();
      expect(content.examples || content.example).toBeDefined();
    });

    it('should have examples for POST /payments endpoint', () => {
      const operation = spec.paths['/payments']?.post;
      expect(operation).toBeDefined();
      
      // Check request body examples
      const requestBody = operation.requestBody;
      expect(requestBody).toBeDefined();
      
      const requestContent = requestBody.content?.['application/json'];
      expect(requestContent).toBeDefined();
      expect(requestContent.examples || requestContent.example).toBeDefined();
    });

    it('should have valid payment method values in examples', () => {
      const validMethods = ['bank-transfer', 'debit-card', 'cheque'];
      
      // Check GET /payments examples
      const listOperation = spec.paths['/payments']?.get;
      const listExamples = listOperation?.responses['200']?.content?.['application/json']?.examples;
      
      if (listExamples) {
        for (const [exampleName, exampleObj] of Object.entries(listExamples)) {
          const example = (exampleObj as any).value;
          if (example.items) {
            for (const payment of example.items) {
              if (payment.paymentMethod) {
                expect(validMethods).toContain(payment.paymentMethod);
              }
            }
          }
        }
      }
    });

    it('should have valid payment status values in examples', () => {
      const validStatuses = ['pending', 'cleared', 'failed', 'refunded'];
      
      // Check GET /payments examples
      const listOperation = spec.paths['/payments']?.get;
      const listExamples = listOperation?.responses['200']?.content?.['application/json']?.examples;
      
      if (listExamples) {
        for (const [exampleName, exampleObj] of Object.entries(listExamples)) {
          const example = (exampleObj as any).value;
          if (example.items) {
            for (const payment of example.items) {
              if (payment.status) {
                expect(validStatuses).toContain(payment.status);
              }
            }
          }
        }
      }
    });
  });

  describe('Cross-API relationship examples', () => {
    it('should have consistent taxpayer IDs across APIs', () => {
      const taxpayerSpec = loadSpec('specs/taxpayer/taxpayer-api.yaml');
      const incomeTaxSpec = loadSpec('specs/income-tax/income-tax-api.yaml');
      const paymentSpec = loadSpec('specs/payment/payment-api.yaml');
      
      const taxpayerIdPattern = /^TP[0-9]{6}$/;
      
      // Check taxpayer API examples
      const taxpayerExamples = taxpayerSpec.paths['/taxpayers']?.get?.responses['200']?.content?.['application/json']?.examples;
      if (taxpayerExamples) {
        for (const [name, exampleObj] of Object.entries(taxpayerExamples)) {
          const example = (exampleObj as any).value;
          if (example.items) {
            for (const taxpayer of example.items) {
              expect(taxpayer.id).toMatch(taxpayerIdPattern);
            }
          }
        }
      }
      
      // Check income tax API examples reference valid taxpayer IDs
      const taxReturnExamples = incomeTaxSpec.paths['/tax-returns']?.get?.responses['200']?.content?.['application/json']?.examples;
      if (taxReturnExamples) {
        for (const [name, exampleObj] of Object.entries(taxReturnExamples)) {
          const example = (exampleObj as any).value;
          if (example.items) {
            for (const taxReturn of example.items) {
              if (taxReturn.taxpayerId) {
                expect(taxReturn.taxpayerId).toMatch(taxpayerIdPattern);
              }
            }
          }
        }
      }
      
      // Check payment API examples reference valid taxpayer IDs
      const paymentExamples = paymentSpec.paths['/payments']?.get?.responses['200']?.content?.['application/json']?.examples;
      if (paymentExamples) {
        for (const [name, exampleObj] of Object.entries(paymentExamples)) {
          const example = (exampleObj as any).value;
          if (example.items) {
            for (const payment of example.items) {
              if (payment.taxpayerId) {
                expect(payment.taxpayerId).toMatch(taxpayerIdPattern);
              }
            }
          }
        }
      }
    });

    it('should have _links field in all resource examples', () => {
      const specs = [
        { name: 'Taxpayer', spec: loadSpec('specs/taxpayer/taxpayer-api.yaml') },
        { name: 'Income Tax', spec: loadSpec('specs/income-tax/income-tax-api.yaml') },
        { name: 'Payment', spec: loadSpec('specs/payment/payment-api.yaml') }
      ];
      
      for (const { name, spec } of specs) {
        for (const [pathName, pathItem] of Object.entries(spec.paths)) {
          for (const [method, operation] of Object.entries(pathItem as any)) {
            if (typeof operation === 'object' && operation !== null && (operation as any).responses) {
              for (const [statusCode, response] of Object.entries((operation as any).responses)) {
                if (statusCode.startsWith('2')) { // Success responses
                  const content = (response as any).content?.['application/json'];
                  if (content?.examples) {
                    for (const [exampleName, exampleObj] of Object.entries(content.examples)) {
                      const example = (exampleObj as any).value;
                      
                      // Check single resource responses
                      if (example.id && example.type) {
                        expect(example._links).toBeDefined();
                        expect(example._links.self).toBeDefined();
                      }
                      
                      // Check collection responses
                      if (example.items) {
                        for (const item of example.items) {
                          if (item.id && item.type) {
                            expect(item._links).toBeDefined();
                            expect(item._links.self).toBeDefined();
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  });
});
