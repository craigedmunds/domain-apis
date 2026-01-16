#!/bin/bash
# LocalStack initialization script for API Gateway and Lambda setup
# This script is called by the Taskfile during gateway setup

set -e

echo "=== LocalStack Initialization Script ==="
echo ""

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if awslocal apigateway get-rest-apis >/dev/null 2>&1; then
    echo "✓ LocalStack is ready"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "  Attempt $RETRY_COUNT/$MAX_RETRIES - waiting..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "✗ LocalStack failed to start after $MAX_RETRIES attempts"
  exit 1
fi

echo ""
echo "=== Creating Lambda Function ==="

# Create a simple aggregation Lambda function
LAMBDA_DIR="/tmp/lambda"
mkdir -p $LAMBDA_DIR

cat > $LAMBDA_DIR/index.js << 'EOF'
// Simple aggregation Lambda for Domain API Gateway
const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { path, httpMethod, queryStringParameters, body } = event;
  const includeParam = queryStringParameters?.include;
  
  try {
    // Route to appropriate backend API
    const backendUrl = routeToBackend(path);
    console.log('Routing to:', backendUrl);
    
    // Fetch primary resource
    const primaryResponse = await fetchUrl(backendUrl, httpMethod, body);
    const primaryData = JSON.parse(primaryResponse);
    
    // If no include parameter, return as-is
    if (!includeParam) {
      return {
        statusCode: 200,
        body: JSON.stringify(primaryData),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    // Parse include parameter and fetch related resources
    const includes = includeParam.split(',').map(s => s.trim());
    const includedData = await fetchIncludedResources(primaryData, includes);
    
    // Merge and return
    const aggregatedResponse = {
      ...primaryData,
      _included: includedData
    };
    
    return {
      statusCode: 200,
      body: JSON.stringify(aggregatedResponse),
      headers: { 'Content-Type': 'application/json' }
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: {
          code: 'GATEWAY_ERROR',
          message: 'Failed to aggregate resources',
          details: error.message
        }
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

function routeToBackend(path) {
  const backends = {
    '/taxpayers': process.env.TAXPAYER_API_URL || 'http://taxpayer-api:4010',
    '/tax-returns': process.env.INCOME_TAX_API_URL || 'http://income-tax-api:4010',
    '/assessments': process.env.INCOME_TAX_API_URL || 'http://income-tax-api:4010',
    '/payments': process.env.PAYMENT_API_URL || 'http://payment-api:4010',
    '/allocations': process.env.PAYMENT_API_URL || 'http://payment-api:4010'
  };
  
  for (const [prefix, url] of Object.entries(backends)) {
    if (path.startsWith(prefix)) {
      return `${url}${path}`;
    }
  }
  
  throw new Error(`No backend found for path: ${path}`);
}

async function fetchUrl(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

async function fetchIncludedResources(primaryData, includes) {
  const links = primaryData._links || {};
  const includedData = {};
  
  const fetchPromises = includes.map(async (relationshipName) => {
    const link = links[relationshipName];
    if (!link || !link.href) {
      return;
    }
    
    try {
      const response = await fetchUrl(link.href);
      const data = JSON.parse(response);
      includedData[relationshipName] = Array.isArray(data.items) ? data.items : [data];
    } catch (error) {
      console.error(`Failed to fetch ${relationshipName}:`, error);
    }
  });
  
  await Promise.all(fetchPromises);
  return includedData;
}
EOF

# Create Lambda deployment package
cd $LAMBDA_DIR
zip -q aggregation-lambda.zip index.js

echo "✓ Lambda function code created"

# Create IAM role for Lambda (LocalStack doesn't enforce IAM, but needs the structure)
echo ""
echo "=== Creating IAM Role ==="
awslocal iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  >/dev/null 2>&1 || echo "  Role already exists, continuing..."

echo "✓ IAM role ready"

# Create Lambda function
echo ""
echo "=== Creating Lambda Function ==="
awslocal lambda create-function \
  --function-name aggregation-lambda \
  --runtime nodejs18.x \
  --role arn:aws:iam::000000000000:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://aggregation-lambda.zip \
  --environment Variables="{TAXPAYER_API_URL=http://taxpayer-api:4010,INCOME_TAX_API_URL=http://income-tax-api:4010,PAYMENT_API_URL=http://payment-api:4010}" \
  >/dev/null 2>&1 || {
    echo "  Function exists, updating code..."
    awslocal lambda update-function-code \
      --function-name aggregation-lambda \
      --zip-file fileb://aggregation-lambda.zip \
      >/dev/null 2>&1
  }

echo "✓ Lambda function created/updated"

# Create API Gateway
echo ""
echo "=== Creating API Gateway ==="

# Check if API already exists
API_ID=$(awslocal apigateway get-rest-apis --query "items[?name=='domain-api-gateway'].id" --output text 2>/dev/null)

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
  echo "  Creating new API Gateway..."
  API_ID=$(awslocal apigateway create-rest-api \
    --name domain-api-gateway \
    --description "Domain API Gateway for POC" \
    --query 'id' \
    --output text)
  echo "  API ID: $API_ID"
else
  echo "  Using existing API Gateway: $API_ID"
fi

# Get root resource
ROOT_ID=$(awslocal apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[0].id' \
  --output text)

echo "  Root resource ID: $ROOT_ID"

# Check if proxy resource exists
RESOURCE_ID=$(awslocal apigateway get-resources \
  --rest-api-id $API_ID \
  --query "items[?pathPart=='{proxy+}'].id" \
  --output text 2>/dev/null)

if [ -z "$RESOURCE_ID" ] || [ "$RESOURCE_ID" == "None" ]; then
  echo "  Creating proxy resource..."
  RESOURCE_ID=$(awslocal apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_ID \
    --path-part '{proxy+}' \
    --query 'id' \
    --output text)
else
  echo "  Using existing proxy resource: $RESOURCE_ID"
fi

# Create ANY method
echo "  Setting up ANY method..."
awslocal apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method ANY \
  --authorization-type NONE \
  >/dev/null 2>&1 || echo "    Method already exists"

# Create Lambda integration
echo "  Setting up Lambda integration..."
awslocal apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method ANY \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:aggregation-lambda/invocations" \
  >/dev/null 2>&1 || echo "    Integration already exists"

# Deploy API
echo "  Deploying API to 'dev' stage..."
awslocal apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name dev \
  >/dev/null 2>&1

echo "✓ API Gateway setup complete"

# Save API ID for later use
echo $API_ID > /tmp/api-gateway-id.txt

echo ""
echo "=== Setup Complete ==="
echo ""
echo "API Gateway URL: http://localhost:4566/restapis/$API_ID/dev/_user_request_"
echo ""
echo "Example usage:"
echo "  Direct API access:"
echo "    curl http://localhost:8081/taxpayers/TP123456"
echo ""
echo "  Gateway with aggregation:"
echo "    curl \"http://localhost:4566/restapis/$API_ID/dev/_user_request_/taxpayers/TP123456?include=taxReturns\""
echo ""
