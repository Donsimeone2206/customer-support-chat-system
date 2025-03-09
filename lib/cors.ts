import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define the headers type
type CorsHeaders = {
  'Access-Control-Allow-Origin': string
  'Access-Control-Allow-Methods': string
  'Access-Control-Allow-Headers': string
  'Access-Control-Max-Age': string
}

export function corsMiddleware(request: NextRequest): CorsHeaders {
  // Get the origin from the request headers
  const origin = request.headers.get('origin') || '*'
  
  // Define response headers for CORS
  const headers: CorsHeaders = {
    'Access-Control-Allow-Origin': '*', // Allow all origins for the widget
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  }

  return headers
}

export function handleCorsOptions(request: NextRequest) {
  // For preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { 
      status: 204, // No content for OPTIONS
      headers: corsMiddleware(request)
    })
  }
  return new NextResponse(null, { headers: corsMiddleware(request) })
} 