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

// Get notifications for the current user
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        website: {
          select: {
            name: true,
            domain: true,
          },
        },
      },
    })

    return NextResponse.json(notifications)
  } catch (error) {
    console.error('Error in GET /api/notifications:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// Mark notifications as read
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()
    const { notificationIds } = await request.json()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    await prisma.notification.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
        userId,
      },
      data: {
        read: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/notifications:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 