#!/bin/bash
# This script runs when LocalStack is ready and deploys the pre-built Lambda

set -e

echo "Deploying aggregation Lambda..."

# Create Lambda function from pre-built zip
awslocal lambda create-function \
  --function-name aggregation-lambda \
  --runtime nodejs18.x \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --handler index.handler \
  --zip-file fileb:///opt/aggregation-lambda.zip

# Create API Gateway
CUSTOM_API_ID="domain-api"

awslocal apigateway create-rest-api \
  --name domain-api-gateway \
  --rest-api-id $CUSTOM_API_ID

# Get root resource
ROOT_ID=$(awslocal apigateway get-resources \
  --rest-api-id $CUSTOM_API_ID \
  --query 'items[0].id' \
  --output text)

# Create proxy resource
RESOURCE_ID=$(awslocal apigateway create-resource \
  --rest-api-id $CUSTOM_API_ID \
  --parent-id $ROOT_ID \
  --path-part '{proxy+}' \
  --query 'id' \
  --output text)

# Create ANY method
awslocal apigateway put-method \
  --rest-api-id $CUSTOM_API_ID \
  --resource-id $RESOURCE_ID \
  --http-method ANY \
  --authorization-type NONE

# Create Lambda integration
awslocal apigateway put-integration \
  --rest-api-id $CUSTOM_API_ID \
  --resource-id $RESOURCE_ID \
  --http-method ANY \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:aggregation-lambda/invocations

# Deploy API
awslocal apigateway create-deployment \
  --rest-api-id $CUSTOM_API_ID \
  --stage-name dev

echo "✓ Gateway and Lambda deployed successfully"
echo "Gateway available at: http://localhost:4566/restapis/$CUSTOM_API_ID/dev/_user_request_"
