import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import fetch from 'node-fetch';

/**
 * Aggregation Lambda Handler
 * 
 * This Lambda function handles cross-API aggregation for the Domain API Gateway.
 * It routes requests to backend APIs and optionally fetches related resources
 * based on the `include` query parameter.
 */

interface LinkObject {
  href: string;
  type?: string;
  title?: string;
}

interface ResourceResponse {
  id?: string;
  type?: string;
  _links?: Record<string, LinkObject | string>;
  items?: any[];
  [key: string]: any;
}

/**
 * Main Lambda handler function
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const { path, httpMethod, queryStringParameters, body, headers } = event;
  const includeParam = queryStringParameters?.include;

  // CORS headers for browser compatibility
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS preflight requests
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // 1. Route to appropriate backend API
    const backendUrl = routeToBackend(path);
    console.log(`Routing ${httpMethod} ${path} to ${backendUrl}`);

    // 2. Fetch primary resource from backend API
    const primaryResponse = await fetch(backendUrl, {
      method: httpMethod,
      body: body || undefined,
      headers: {
        'Content-Type': 'application/json',
        ...extractForwardHeaders(headers),
      },
    });

    if (!primaryResponse.ok) {
      // Forward error responses from backend
      const errorBody = await primaryResponse.text();
      return {
        statusCode: primaryResponse.status,
        headers: corsHeaders,
        body: errorBody,
      };
    }

    const primaryData: ResourceResponse = await primaryResponse.json();

    // Rewrite URLs in _links to point through gateway (always, not just with includes)
    const rewrittenData = rewriteLinksToGateway(primaryData);

    // 3. If no include parameter, return rewritten response
    if (!includeParam) {
      return {
        statusCode: primaryResponse.status,
        headers: corsHeaders,
        body: JSON.stringify(rewrittenData),
      };
    }

    // 4. Parse include parameter and fetch related resources
    const includes = includeParam.split(',').map(s => s.trim()).filter(s => s.length > 0);
    console.log(`Fetching included resources: ${includes.join(', ')}`);

    const includedData = await fetchIncludedResources(rewrittenData, includes);

    // 5. Merge and return aggregated response
    const aggregatedResponse = {
      ...rewrittenData,
      _included: includedData,
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(aggregatedResponse),
    };

  } catch (error) {
    console.error('Gateway error:', error);
    
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: {
          code: 'GATEWAY_ERROR',
          message: 'Failed to aggregate resources',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      }),
    };
  }
}

/**
 * Route request path to appropriate backend API
 */
function routeToBackend(path: string): string {
  // Backend API URLs from environment variables
  const backends: Record<string, string> = {
    '/taxpayer': process.env.TAXPAYER_API_URL || 'http://taxpayer-api:4010',
    '/income-tax': process.env.INCOME_TAX_API_URL || 'http://income-tax-api:4010',
    '/payment': process.env.PAYMENT_API_URL || 'http://payment-api:4010',
  };

  // Check for exact matches or paths starting with the prefix
  for (const [prefix, url] of Object.entries(backends)) {
    if (path === prefix || path.startsWith(prefix + '/')) {
      return `${url}${path}`;
    }
  }

  // Also check for plural forms (taxpayers, tax-returns, payments, allocations, assessments)
  if (path.startsWith('/taxpayers')) {
    return `${process.env.TAXPAYER_API_URL || 'http://taxpayer-api:4010'}${path}`;
  }
  if (path.startsWith('/tax-returns') || path.startsWith('/assessments')) {
    return `${process.env.INCOME_TAX_API_URL || 'http://income-tax-api:4010'}${path}`;
  }
  if (path.startsWith('/payments') || path.startsWith('/allocations')) {
    return `${process.env.PAYMENT_API_URL || 'http://payment-api:4010'}${path}`;
  }

  throw new Error(`No backend found for path: ${path}`);
}

/**
 * Extract headers to forward to backend APIs
 */
function extractForwardHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const forwardHeaders: Record<string, string> = {};
  
  // Forward specific headers if present
  const headersToForward = ['authorization', 'x-request-id', 'x-correlation-id'];
  
  for (const header of headersToForward) {
    const value = headers[header] || headers[header.toLowerCase()];
    if (value) {
      forwardHeaders[header] = value;
    }
  }
  
  return forwardHeaders;
}

/**
 * Fetch included resources based on _links in primary resource
 */
async function fetchIncludedResources(
  primaryData: ResourceResponse,
  includes: string[]
): Promise<Record<string, any[]>> {
  const links = primaryData._links || {};
  const includedData: Record<string, any[]> = {};

  // Fetch each requested relationship in parallel
  const fetchPromises = includes.map(async (relationshipName) => {
    const link = links[relationshipName];
    
    // Handle both string and object link formats
    const href = typeof link === 'string' ? link : link?.href;
    
    if (!href) {
      console.log(`Skipping ${relationshipName}: no href found`);
      return;
    }

    try {
      console.log(`Fetching ${relationshipName} from ${href}`);
      const response = await fetch(href);
      
      if (response.ok) {
        const data: ResourceResponse = await response.json();
        
        // Handle both single resources and collections
        if (Array.isArray(data.items)) {
          includedData[relationshipName] = data.items;
        } else if (data.id) {
          includedData[relationshipName] = [data];
        } else {
          console.log(`Unexpected response format for ${relationshipName}`);
        }
      } else {
        console.log(`Failed to fetch ${relationshipName}: ${response.status}`);
        // Continue with partial results - don't fail the entire request
      }
    } catch (error) {
      console.error(`Error fetching ${relationshipName}:`, error);
      // Continue with partial results - graceful degradation
    }
  });

  await Promise.all(fetchPromises);
  return includedData;
}

/**
 * Rewrite backend API URLs in _links to point through gateway
 */
function rewriteLinksToGateway(data: ResourceResponse): ResourceResponse {
  if (!data._links) {
    return data;
  }

  const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:4566';
  const rewrittenLinks: Record<string, LinkObject | string> = {};

  for (const [key, link] of Object.entries(data._links)) {
    if (typeof link === 'string') {
      rewrittenLinks[key] = rewriteUrl(link, gatewayUrl);
    } else if (link && typeof link === 'object' && link.href) {
      rewrittenLinks[key] = {
        ...link,
        href: rewriteUrl(link.href, gatewayUrl),
      };
    } else {
      rewrittenLinks[key] = link;
    }
  }

  return {
    ...data,
    _links: rewrittenLinks,
  };
}

/**
 * Rewrite a single URL from backend to gateway
 */
function rewriteUrl(url: string, gatewayUrl: string): string {
  // Replace backend API URLs with gateway URL
  const backendUrls = [
    'http://taxpayer-api:4010',
    'http://income-tax-api:4010',
    'http://payment-api:4010',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083',
  ];

  for (const backendUrl of backendUrls) {
    if (url.startsWith(backendUrl)) {
      return url.replace(backendUrl, gatewayUrl);
    }
  }

  return url;
}
