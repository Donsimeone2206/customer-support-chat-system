import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import Pusher from 'pusher'

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const messages = await prisma.message.findMany({
      where: {
        conversation: {
          users: {
            some: {
              id: userId,
            },
          },
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      senderId: msg.senderId,
      senderName: msg.sender.name,
    }))

    return NextResponse.json(formattedMessages)
  } catch (error) {
    console.error('Error in GET /api/messages:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    const { content, conversationId, websiteId } = await request.json()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        content,
        senderType: 'USER',
        sender: {
          connect: {
            id: userId,
          },
        },
        conversation: {
          connect: {
            id: conversationId,
          },
        },
      },
      include: {
        sender: {
          select: {
            name: true,
          },
        },
        conversation: true,
      },
    })

    // Trigger Pusher events for both admin and visitor channels
    const messageData = {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      senderId: userId,
      senderType: 'USER',
      conversationId: message.conversationId,
      visitorId: message.visitorId,
    };

    console.log('Triggering Pusher events for websiteId:', websiteId);
    console.log('Message data:', messageData);

    await Promise.all([
      // Trigger for admin channel
      pusher.trigger(`chat-admin-${websiteId}`, 'message', messageData),
      // Trigger for visitor channel
      pusher.trigger(`chat-${websiteId}`, 'message', messageData),
    ])

    console.log('Pusher events triggered successfully');

    return NextResponse.json(message)
  } catch (error) {
    console.error('Error in POST /api/messages:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 