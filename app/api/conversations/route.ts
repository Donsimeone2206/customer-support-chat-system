import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const conversations = await prisma.conversation.findMany({
      where: {
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
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        website: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    })

    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      status: conv.status,
      updatedAt: conv.updatedAt,
      lastMessage: conv.messages[0]?.content,
      websiteId: conv.website?.id,
      website: conv.website,
      ipAddress: conv.ipAddress,
      country: conv.country,
      visitorId: conv.visitorId,
      messages: [], // Initialize with empty array, will be populated when conversation is selected
    }))

    return NextResponse.json(formattedConversations)
  } catch (error) {
    console.error('Error in GET /api/conversations:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    const { title } = await request.json()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const conversation = await prisma.conversation.create({
      data: {
        title,
        users: {
          connect: {
            id: userId,
          },
        },
      },
    })

    return NextResponse.json(conversation)
  } catch (error) {
    console.error('Error in POST /api/conversations:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 