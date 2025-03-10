import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Verify user has access to this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.conversationId,
        OR: [
          {
            users: {
              some: {
                id: userId,
              },
            },
          },
          {
            website: {
              ownerId: userId,
            },
          },
        ],
      },
    })

    if (!conversation) {
      return new NextResponse('Not found', { status: 404 })
    }

    // Fetch all messages for the conversation
    const messages = await prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error in GET /api/conversations/[id]/messages:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 