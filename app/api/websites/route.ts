import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const websites = await prisma.website.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(websites)
  } catch (error) {
    console.error('Error in GET /api/websites:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    const { name, domain } = await request.json()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const website = await prisma.website.create({
      data: {
        name,
        domain,
        owner: {
          connect: {
            id: userId,
          },
        },
      },
    })

    return NextResponse.json(website)
  } catch (error) {
    console.error('Error in POST /api/websites:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 