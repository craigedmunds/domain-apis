FROM localstack/localstack:latest

# Install build dependencies
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    zip \
    && rm -rf /var/lib/apt/lists/*

# Copy Lambda function source
COPY lambda /opt/lambda
WORKDIR /opt/lambda

# Build Lambda function
RUN npm install && \
    npm run build && \
    zip -r /opt/aggregation-lambda.zip dist/ node_modules/

# Copy initialization script
COPY init-scripts/deploy-lambda.sh /etc/localstack/init/ready.d/
RUN chmod +x /etc/localstack/init/ready.d/deploy-lambda.sh

# Set environment variables
ENV LAMBDA_EXECUTOR=local
ENV SERVICES=apigateway,lambda,iam
ENV DEBUG=1

WORKDIR /opt/code/localstack
