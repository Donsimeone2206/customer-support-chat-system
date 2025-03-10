import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { corsMiddleware, handleCorsOptions } from '@/lib/cors'
import Pusher from 'pusher'

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request)
}

export async function POST(request: NextRequest) {
  try {
    const { websiteId, visitorId, isTyping } = await request.json()

    if (!websiteId || !visitorId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400, headers: corsMiddleware(request) }
      )
    }

    // Trigger typing event on both admin and visitor channels
    await Promise.all([
      pusher.trigger(`chat-admin-${websiteId}`, 'typing', {
        visitorId,
        isTyping,
      }),
      pusher.trigger(`chat-${websiteId}`, 'typing', {
        visitorId,
        isTyping,
      }),
    ])

    return NextResponse.json({ success: true }, { headers: corsMiddleware(request) })
  } catch (error) {
    console.error('Error in typing API:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsMiddleware(request) }
    )
  }
} 