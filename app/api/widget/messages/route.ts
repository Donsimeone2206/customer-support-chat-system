import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { corsMiddleware, handleCorsOptions } from '@/lib/cors'
import Pusher from 'pusher'
import geoip from 'geoip-lite'

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
    const { content, websiteId, visitorId } = await request.json()
    
    // Get visitor's IP address and country
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : request.ip || '127.0.0.1'
    const geo = geoip.lookup(ipAddress)
    const country = geo?.country || 'Unknown'

    // Create or get conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        websiteId,
        ipAddress,
        status: 'ACTIVE',
      },
    })

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          websiteId,
          visitorId,
          ipAddress,
          country,
          status: 'ACTIVE',
          title: 'New Conversation',
        },
      })
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        content,
        senderType: 'VISITOR',
        visitorId,
        senderId: undefined,
        conversation: {
          connect: {
            id: conversation.id,
          },
        },
      },
      include: {
        conversation: true,
      },
    })

    // Trigger Pusher events for both channels
    await Promise.all([
      // Trigger for the website's admin channel
      pusher.trigger(`chat-admin-${websiteId}`, 'message', {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        senderType: message.senderType,
        visitorId: message.visitorId,
        conversationId: conversation.id,
      }),
      // Trigger for the visitor's channel
      pusher.trigger(`chat-${websiteId}`, 'message', {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        senderType: message.senderType,
        visitorId: message.visitorId,
      }),
    ])

    return NextResponse.json(message, { headers: corsMiddleware(request) })
  } catch (error) {
    console.error('Error in widget messages API:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsMiddleware(request) }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const websiteId = url.searchParams.get('websiteId')
    const visitorId = url.searchParams.get('visitorId')

    if (!websiteId || !visitorId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400, headers: corsMiddleware(request) }
      )
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        websiteId,
        visitorId,
        status: 'ACTIVE',
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    return NextResponse.json(conversation?.messages || [], { headers: corsMiddleware(request) })
  } catch (error) {
    console.error('Error in widget messages API:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsMiddleware(request) }
    )
  }
} 