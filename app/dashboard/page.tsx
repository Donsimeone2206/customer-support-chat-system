import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import ChatList from '../components/ChatList'
import ChatWindow from '../components/ChatWindow'
import { ensureUserExists } from '@/lib/auth'
import prisma from '@/lib/prisma'

export default async function Dashboard() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Ensure user exists in our database
  const dbUser = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!dbUser) {
    await prisma.user.create({
      data: {
        id: userId,
        email: 'pending@example.com', // Will be updated on first action
        name: 'New User',
      }
    })
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar with chat list */}
      <div className="w-1/4 bg-white border-r">
        <ChatList userId={userId} />
      </div>

      {/* Main chat window */}
      <div className="flex-1">
        <ChatWindow userId={userId} />
      </div>
    </div>
  )
} 