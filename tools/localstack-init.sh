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
echo "=== Preparing Lambda Function ==="

# Check if the built Lambda package exists
LAMBDA_PACKAGE="/tools/../gateway/lambda/aggregation-lambda.zip"

if [ ! -f "$LAMBDA_PACKAGE" ]; then
  echo "✗ Lambda package not found at $LAMBDA_PACKAGE"
  echo "  Please run 'task lambda:package' to build the Lambda function first"
  exit 1
fi

echo "✓ Found Lambda package at $LAMBDA_PACKAGE"

# Copy Lambda package to /tmp for deployment
cp "$LAMBDA_PACKAGE" /tmp/aggregation-lambda.zip

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
  --zip-file fileb:///tmp/aggregation-lambda.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{TAXPAYER_API_URL=http://taxpayer-api:4010,INCOME_TAX_API_URL=http://income-tax-api:4010,PAYMENT_API_URL=http://payment-api:4010,GATEWAY_URL=http://domain-api.execute-api.localhost.localstack.cloud:4566}" \
  >/dev/null 2>&1 || {
    echo "  Function exists, updating code..."
    awslocal lambda update-function-code \
      --function-name aggregation-lambda \
      --zip-file fileb:///tmp/aggregation-lambda.zip \
      >/dev/null 2>&1
    awslocal lambda update-function-configuration \
      --function-name aggregation-lambda \
      --timeout 30 \
      --memory-size 256 \
      --environment Variables="{TAXPAYER_API_URL=http://taxpayer-api:4010,INCOME_TAX_API_URL=http://income-tax-api:4010,PAYMENT_API_URL=http://payment-api:4010,GATEWAY_URL=http://domain-api.execute-api.localhost.localstack.cloud:4566}" \
      >/dev/null 2>&1
  }

echo "✓ Lambda function created/updated"

# Create API Gateway
echo ""
echo "=== Creating API Gateway ==="

# Use a custom API ID for cleaner URLs via tags
CUSTOM_API_ID="domain-api"

# Check if API already exists
API_ID=$(awslocal apigateway get-rest-apis --query "items[?name=='domain-api-gateway'].id" --output text 2>/dev/null)

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
  echo "  Creating new API Gateway with custom ID: $CUSTOM_API_ID"
  # Use tags to set custom ID (LocalStack-specific feature)
  API_ID=$(awslocal apigateway create-rest-api \
    --name domain-api-gateway \
    --description "Domain API Gateway for POC" \
    --tags "{\"_custom_id_\":\"$CUSTOM_API_ID\"}" \
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
echo "API Gateway URLs:"
echo "  LocalStack format: http://localhost:4566/restapis/$API_ID/dev/_user_request_"
echo "  Custom domain:     http://$API_ID.execute-api.localhost.localstack.cloud:4566"
echo ""
echo "Example usage:"
echo "  Direct API access:"
echo "    curl http://localhost:8081/taxpayers/TP123456"
echo ""
echo "  Gateway with custom domain:"
echo "    curl \"http://$API_ID.execute-api.localhost.localstack.cloud:4566/taxpayers/TP123456\""
echo ""
echo "  Gateway with aggregation:"
echo "    curl \"http://$API_ID.execute-api.localhost.localstack.cloud:4566/taxpayers/TP123456?include=taxReturns\""
echo ""
