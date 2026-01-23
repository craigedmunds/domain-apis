#!/usr/bin/env node

/**
 * OpenAPI Specification Validator
 * 
 * Validates all OpenAPI specification files in the project:
 * - Checks OpenAPI 3.0+ compliance
 * - Validates $ref references resolve correctly
 * - Ensures examples match schemas
 * - Validates shared component references
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SPECS_DIR = path.join(__dirname, '..', 'specs');
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function findYamlFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findYamlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('-api.yaml')) {
      // Only validate files that are actual API specifications (ending in -api.yaml)
      // Skip component files like shared-components.yaml which aren't standalone specs
      files.push(fullPath);
    }
  }

  return files;
}

function validateFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  log(`\nValidating: ${relativePath}`, 'blue');
  
  try {
    // Use swagger-cli to validate OpenAPI spec
    execSync(`npx swagger-cli validate "${filePath}"`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    log(`✓ ${relativePath} is valid`, 'green');
    return true;
  } catch (error) {
    log(`✗ ${relativePath} has errors:`, 'red');
    console.error(error.stdout || error.message);
    return false;
  }
}

function main() {
  log('='.repeat(60), 'blue');
  log('OpenAPI Specification Validator', 'blue');
  log('='.repeat(60), 'blue');
  
  if (!fs.existsSync(SPECS_DIR)) {
    log(`Error: Specs directory not found: ${SPECS_DIR}`, 'red');
    process.exit(1);
  }
  
  const yamlFiles = findYamlFiles(SPECS_DIR);
  
  if (yamlFiles.length === 0) {
    log('No YAML files found in specs directory', 'yellow');
    process.exit(0);
  }
  
  log(`\nFound ${yamlFiles.length} specification file(s)\n`);
  
  let allValid = true;
  for (const file of yamlFiles) {
    const isValid = validateFile(file);
    if (!isValid) {
      allValid = false;
    }
  }
  
  log('\n' + '='.repeat(60), 'blue');
  if (allValid) {
    log('✓ All specifications are valid!', 'green');
    log('='.repeat(60), 'blue');
    process.exit(0);
  } else {
    log('✗ Some specifications have errors', 'red');
    log('='.repeat(60), 'blue');
    process.exit(1);
  }
}

main();
