import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Pusher from 'pusher'
import { corsMiddleware, handleCorsOptions } from '@/lib/cors'
import { NextRequest } from 'next/server'

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
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401, headers: corsMiddleware(request) }
      )
    }

    // Verify auth with Clerk
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid session' },
        { status: 401, headers: corsMiddleware(request) }
      )
    }

    const data = await request.json()
    const socketId = data.socket_id
    const channel = data.channel_name

    if (!socketId || !channel) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400, headers: corsMiddleware(request) }
      )
    }

    // Only authenticate for private channels
    if (!channel.startsWith('private-')) {
      return NextResponse.json(
        { error: 'Invalid channel - Must be a private channel' },
        { status: 400, headers: corsMiddleware(request) }
      )
    }

    // Authorize the channel
    try {
      const authResponse = pusher.authorizeChannel(socketId, channel)
      return NextResponse.json(authResponse, { 
        headers: corsMiddleware(request)
      })
    } catch (authError) {
      console.error('Pusher authorization error:', authError)
      return NextResponse.json(
        { error: 'Failed to authorize channel' },
        { status: 500, headers: corsMiddleware(request) }
      )
    }
  } catch (error) {
    console.error('Error in Pusher auth:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsMiddleware(request) }
    )
  }
} 