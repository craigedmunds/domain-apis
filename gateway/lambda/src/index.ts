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

    // 3. If no include parameter, rewrite URLs and return
    if (!includeParam) {
      const rewrittenData = rewriteLinksToGateway(primaryData);
      
      // Also rewrite links in items array if present
      if (rewrittenData.items && Array.isArray(rewrittenData.items)) {
        rewrittenData.items = rewrittenData.items.map(item => rewriteLinksToGateway(item));
      }
      
      return {
        statusCode: primaryResponse.status,
        headers: corsHeaders,
        body: JSON.stringify(rewrittenData),
      };
    }

    // 4. Parse include parameter and fetch related resources (using backend URLs)
    const includes = includeParam.split(',').map(s => s.trim()).filter(s => s.length > 0);
    console.log(`Fetching included resources: ${includes.join(', ')}`);

    // Check if this is a collection response
    if (primaryData.items && Array.isArray(primaryData.items)) {
      console.log(`Processing collection with ${primaryData.items.length} items and includes: ${includes.join(', ')}`);
      
      // Fetch includes for all items and aggregate at collection level
      const allIncludedData: Record<string, any[]> = {};
      
      // Process each item to fetch its includes
      await Promise.all(
        primaryData.items.map(async (item, index) => {
          console.log(`Processing item ${index}: ${item.id}`);
          const includedData = await fetchIncludedResources(item, includes);
          console.log(`Fetched included data for item ${index}:`, Object.keys(includedData));
          
          // Aggregate included resources at collection level
          for (const [relationshipName, resources] of Object.entries(includedData)) {
            if (Array.isArray(resources)) {
              if (!allIncludedData[relationshipName]) {
                allIncludedData[relationshipName] = [];
              }
              // Add resources, avoiding duplicates by ID
              for (const resource of resources) {
                if (resource.id && !allIncludedData[relationshipName].some(r => r.id === resource.id)) {
                  allIncludedData[relationshipName].push(resource);
                }
              }
            }
          }
        })
      );

      // Rewrite items (without _included in each item)
      const rewrittenItems = primaryData.items.map(item => rewriteLinksToGateway(item));
      
      const rewrittenPrimaryData = rewriteLinksToGateway(primaryData);
      delete rewrittenPrimaryData._included;
      
      // Rewrite links in all included resources
      const rewrittenIncludedData: Record<string, any[]> = {};
      for (const [relationshipName, resources] of Object.entries(allIncludedData)) {
        if (Array.isArray(resources)) {
          console.log(`Rewriting ${resources.length} resources for ${relationshipName}`);
          rewrittenIncludedData[relationshipName] = resources.map(resource => 
            rewriteLinksToGateway(resource)
          );
        }
      }
      
      const response: any = {
        ...rewrittenPrimaryData,
        items: rewrittenItems,
      };
      
      // Only add _included if we have included data
      if (Object.keys(rewrittenIncludedData).length > 0) {
        response._included = rewrittenIncludedData;
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(response),
      };
    }

    // Handle single resource with includes
    const includedData = await fetchIncludedResources(primaryData, includes);

    // 5. Rewrite URLs in primary data and included resources, then return
    const rewrittenPrimaryData = rewriteLinksToGateway(primaryData);
    
    // Also rewrite links in items array if present
    if (rewrittenPrimaryData.items && Array.isArray(rewrittenPrimaryData.items)) {
      rewrittenPrimaryData.items = rewrittenPrimaryData.items.map(item => rewriteLinksToGateway(item));
    }
    
    const rewrittenIncludedData: Record<string, any[]> = {};
    
    for (const [relationshipName, resources] of Object.entries(includedData)) {
      if (Array.isArray(resources)) {
        rewrittenIncludedData[relationshipName] = resources.map(resource => 
          rewriteLinksToGateway(resource)
        );
      }
    }

    const aggregatedResponse = {
      ...rewrittenPrimaryData,
      _included: rewrittenIncludedData,
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
 * Convert path-only or localhost URLs to backend container URLs for Lambda to fetch
 */
function convertToBackendUrl(url: string): string {
  // If it's a path-only URL (starts with /), determine which backend based on the path
  if (url.startsWith('/')) {
    if (url.startsWith('/taxpayers') || url.startsWith('/taxpayer')) {
      return (process.env.TAXPAYER_API_URL || 'http://domain-api-taxpayer:4010') + url;
    }
    if (url.startsWith('/tax-returns') || url.startsWith('/assessments') || url.startsWith('/income-tax')) {
      return (process.env.INCOME_TAX_API_URL || 'http://domain-api-income-tax:4010') + url;
    }
    if (url.startsWith('/payments') || url.startsWith('/allocations') || url.startsWith('/payment')) {
      return (process.env.PAYMENT_API_URL || 'http://domain-api-payment:4010') + url;
    }
  }

  // Map localhost ports to backend container URLs
  const localhostMappings: Record<string, string> = {
    'http://localhost:8081': process.env.TAXPAYER_API_URL || 'http://domain-api-taxpayer:4010',
    'http://localhost:8082': process.env.INCOME_TAX_API_URL || 'http://domain-api-income-tax:4010',
    'http://localhost:8083': process.env.PAYMENT_API_URL || 'http://domain-api-payment:4010',
  };

  for (const [localhostUrl, backendUrl] of Object.entries(localhostMappings)) {
    if (url.startsWith(localhostUrl)) {
      return url.replace(localhostUrl, backendUrl);
    }
  }

  // If already a backend URL, return as-is
  return url;
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
      // Convert localhost URLs to container names for Lambda to fetch
      const backendHref = convertToBackendUrl(href);
      console.log(`Fetching ${relationshipName} from ${backendHref}`);
      const response = await fetch(backendHref);
      
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
 * Rewrite backend API URLs in _links to add stage prefix
 */
function rewriteLinksToGateway(data: ResourceResponse): ResourceResponse {
  if (!data._links) {
    return data;
  }

  const stage = process.env.STAGE || 'dev';
  const rewrittenLinks: Record<string, LinkObject | string> = {};

  for (const [key, link] of Object.entries(data._links)) {
    if (typeof link === 'string') {
      rewrittenLinks[key] = addStagePrefix(link, stage);
    } else if (link && typeof link === 'object' && link.href) {
      rewrittenLinks[key] = {
        ...link,
        href: addStagePrefix(link.href, stage),
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
 * Add stage prefix to path-only URLs
 * 
 * Backend APIs MUST return path-only URLs (e.g., /taxpayers/TP123456).
 * This function adds the stage prefix (e.g., /dev/taxpayers/TP123456).
 */
function addStagePrefix(url: string, stage: string): string {
  // All URLs from backend APIs should be path-only
  if (!url.startsWith('/')) {
    console.warn(`Expected path-only URL but received: ${url}`);
    // If it's a full URL, this is a backend API bug - log and try to extract path
    try {
      const urlObj = new URL(url);
      url = urlObj.pathname;
    } catch (error) {
      // If we can't parse it, return as-is and let it fail visibly
      return url;
    }
  }

  // Remove existing stage prefix if present (e.g., /dev/taxpayers -> /taxpayers)
  const stagePattern = /^\/(dev|prod|staging)\//;
  if (stagePattern.test(url)) {
    url = url.replace(stagePattern, '/');
  }
  
  return `/${stage}${url}`;
}
