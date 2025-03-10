import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { corsMiddleware, handleCorsOptions } from '@/lib/cors'
import { put } from '@vercel/blob'
import { nanoid } from 'nanoid'

export const runtime = 'edge'

export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const websiteId = formData.get('websiteId') as string
    const visitorId = formData.get('visitorId') as string

    if (!file || !websiteId || !visitorId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400, headers: corsMiddleware(request) }
      )
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400, headers: corsMiddleware(request) }
      )
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400, headers: corsMiddleware(request) }
      )
    }

    // Generate a unique filename
    const extension = file.name.split('.').pop()
    const filename = `${websiteId}/${visitorId}/${nanoid()}.${extension}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
    })

    return NextResponse.json(
      {
        url: blob.url,
        filename: file.name,
        contentType: file.type,
        size: file.size,
      },
      { headers: corsMiddleware(request) }
    )
  } catch (error) {
    console.error('Error in file upload API:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsMiddleware(request) }
    )
  }
} 