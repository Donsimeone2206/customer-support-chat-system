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
    const { content, conversationId } = await request.json()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const message = await prisma.message.create({
      data: {
        content,
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
      },
    })

    // Trigger Pusher event
    await pusher.trigger('chat', 'message', {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      senderId: userId,
      senderName: message.sender?.name,
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error('Error in POST /api/messages:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 