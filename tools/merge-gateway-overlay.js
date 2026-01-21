#!/usr/bin/env node

/**
 * Gateway Overlay Merger
 * 
 * This script merges backend API specs with gateway overlay to create
 * user-facing API documentation that includes gateway features like
 * content negotiation and cross-API aggregation.
 * 
 * Usage:
 *   node tools/merge-gateway-overlay.js <backend-spec> <output-spec>
 * 
 * Example:
 *   node tools/merge-gateway-overlay.js \
 *     specs/taxpayer/taxpayer-api.yaml \
 *     docs/specs/taxpayer/taxpayer-api.yaml
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load specs
function loadYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

// Save spec
function saveYaml(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, yaml.dump(data, { lineWidth: -1, noRefs: true }));
}

// Merge gateway overlay into backend spec
function mergeGatewayOverlay(backendSpec, overlaySpec) {
  const merged = JSON.parse(JSON.stringify(backendSpec)); // Deep clone
  
  // 1. Replace servers with gateway servers
  merged.servers = overlaySpec.servers;
  
  // 2. Add gateway-specific components
  if (!merged.components) {
    merged.components = {};
  }
  if (!merged.components.schemas) {
    merged.components.schemas = {};
  }
  
  // Add IncludedSection schema
  merged.components.schemas._IncludedSection = overlaySpec.components.schemas.IncludedSection;
  
  // 3. Enhance each GET operation
  const acceptParam = overlaySpec['x-gateway-parameters']['accept-header'];
  const includeParam = overlaySpec['x-gateway-parameters']['include-parameter'];
  const contentTypes = overlaySpec['x-gateway-content-types'];
  
  for (const [pathKey, pathItem] of Object.entries(merged.paths)) {
    if (pathItem.get) {
      const operation = pathItem.get;
      
      // Add parameters
      if (!operation.parameters) {
        operation.parameters = [];
      }
      
      // Add Accept header parameter
      operation.parameters.push(acceptParam);
      
      // Add include parameter for resource endpoints (not collections without IDs)
      // Include on: /taxpayers/{id}, /taxpayers (collection)
      // Skip on: /taxpayers/{id}/sub-resource (nested resources)
      const pathSegments = pathKey.split('/').filter(s => s);
      const isResourceEndpoint = pathSegments.length <= 2; // /taxpayers or /taxpayers/{id}
      
      if (isResourceEndpoint) {
        operation.parameters.push(includeParam);
      }
      
      // Enhance response content types
      const response200 = operation.responses['200'];
      if (response200 && response200.content && response200.content['application/json']) {
        const originalContent = response200.content['application/json'];
        const originalSchema = originalContent.schema;
        
        // Create aggregated schema (adds _included)
        const aggregatedSchema = JSON.parse(JSON.stringify(originalSchema));
        if (aggregatedSchema.type === 'object') {
          if (!aggregatedSchema.properties) {
            aggregatedSchema.properties = {};
          }
          aggregatedSchema.properties._included = {
            $ref: '#/components/schemas/_IncludedSection'
          };
        }
        
        // Replace content types
        response200.content = {
          'application/vnd.domain+json': {
            description: contentTypes.aggregated.description,
            schema: aggregatedSchema,
            examples: originalContent.examples
          },
          'application/json': {
            description: contentTypes['simple-rest'].description,
            schema: originalSchema,
            examples: originalContent.examples
          },
          'application/vnd.raw': {
            description: contentTypes['pass-through'].description,
            schema: originalSchema,
            examples: originalContent.examples
          }
        };
      }
    }
  }
  
  // 4. Update info to indicate this is gateway-enhanced
  merged.info.description = (merged.info.description || '') + 
    '\n\n**Note:** This API is accessed through the API Gateway, which provides ' +
    'content negotiation and cross-API aggregation features. See the Accept header ' +
    'and include parameter documentation for details.';
  
  return merged;
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Usage: node merge-gateway-overlay.js <backend-spec> <output-spec>');
    console.error('Example: node merge-gateway-overlay.js specs/taxpayer/taxpayer-api.yaml docs/specs/taxpayer/taxpayer-api.yaml');
    process.exit(1);
  }
  
  const [backendSpecPath, outputSpecPath] = args;
  const overlayPath = 'gateway/gateway-overlay.yaml';
  
  console.log(`Loading backend spec: ${backendSpecPath}`);
  const backendSpec = loadYaml(backendSpecPath);
  
  console.log(`Loading gateway overlay: ${overlayPath}`);
  const overlaySpec = loadYaml(overlayPath);
  
  console.log('Merging specs...');
  const merged = mergeGatewayOverlay(backendSpec, overlaySpec);
  
  console.log(`Saving merged spec: ${outputSpecPath}`);
  saveYaml(outputSpecPath, merged);
  
  console.log('✓ Gateway-enhanced spec created successfully');
}

main();
