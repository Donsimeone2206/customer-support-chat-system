import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { corsMiddleware, handleCorsOptions } from '@/lib/cors'
import prisma from '@/lib/prisma'
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
    const { websiteId, visitorId, messageIds } = await request.json()

    if (!websiteId || !visitorId || !messageIds?.length) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400, headers: corsMiddleware(request) }
      )
    }

    // Update messages with read timestamp
    const now = new Date()
    const updatedMessages = await prisma.message.updateMany({
      where: {
        id: {
          in: messageIds,
        },
        conversation: {
          websiteId,
        },
        senderType: 'USER',
        readAt: {
          equals: null
        }
      },
      data: {
        readAt: now,
      },
    })

    // Notify admin channel about read messages
    if (updatedMessages.count > 0) {
      await pusher.trigger(`chat-admin-${websiteId}`, 'messages-read', {
        messageIds,
        readAt: now.toISOString(),
        visitorId,
      })
    }

    return NextResponse.json(
      { success: true, count: updatedMessages.count },
      { headers: corsMiddleware(request) }
    )
  } catch (error) {
    console.error('Error in read messages API:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsMiddleware(request) }
    )
  }
} 