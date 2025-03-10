import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { corsMiddleware, handleCorsOptions } from '@/lib/cors'
import Pusher from 'pusher'

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

async function getLocationInfo(ip: string) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`)
    const data = await response.json()
    return data.status === 'success' ? data.country : 'Unknown'
  } catch (error) {
    console.error('Error getting location:', error)
    return 'Unknown'
  }
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request)
}

export async function POST(request: NextRequest) {
  try {
    const { content, websiteId, visitorId } = await request.json()
    console.log('POST message - websiteId:', websiteId, 'visitorId:', visitorId)
    
    // Get visitor's IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : request.ip || '127.0.0.1'
    const country = await getLocationInfo(ipAddress)
    
    console.log('Visitor IP:', ipAddress, 'Country:', country)

    // Find active conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        websiteId,
        visitorId,
        status: 'ACTIVE',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    // Create new conversation if needed
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
      console.log('Created new conversation:', conversation.id)
    } else {
      // Update IP and country if they've changed
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { ipAddress, country },
      })
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        content,
        senderType: 'VISITOR',
        visitorId,
        conversation: {
          connect: {
            id: conversation.id,
          },
        },
      },
    })

    // Trigger Pusher events
    const messageData = {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      senderType: message.senderType,
      visitorId: message.visitorId,
      conversationId: conversation.id,
    }

    await Promise.all([
      pusher.trigger(`chat-admin-${websiteId}`, 'message', {
        ...messageData,
        ipAddress,
        country,
      }),
      pusher.trigger(`chat-${websiteId}`, 'message', messageData),
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

    console.log('GET messages - websiteId:', websiteId, 'visitorId:', visitorId)

    if (!websiteId || !visitorId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400, headers: corsMiddleware(request) }
      )
    }

    // Find all conversations for this visitor, ordered by most recent first
    const conversations = await prisma.conversation.findMany({
      where: {
        websiteId,
        visitorId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    // If no conversations exist, return empty array
    if (!conversations.length) {
      return NextResponse.json([], { headers: corsMiddleware(request) })
    }

    // Get the active conversation or the most recent one
    const activeConversation = conversations.find(conv => conv.status === 'ACTIVE') || conversations[0]
    
    console.log('Found conversation:', activeConversation.id, 'Status:', activeConversation.status)
    console.log('Message count:', activeConversation.messages.length)

    return NextResponse.json(activeConversation.messages, { headers: corsMiddleware(request) })
  } catch (error) {
    console.error('Error in widget messages API:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsMiddleware(request) }
    )
  }
} 