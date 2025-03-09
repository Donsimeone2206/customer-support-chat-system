import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { userId } = await auth()
    const { status } = await request.json()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const conversation = await prisma.conversation.update({
      where: {
        id: params.conversationId,
      },
      data: {
        status,
      },
    })

    return NextResponse.json(conversation)
  } catch (error) {
    console.error('Error in PATCH /api/conversations/[id]/status:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 