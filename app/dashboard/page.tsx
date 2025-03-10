import { auth, clerkClient } from '@clerk/nextjs/server'
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
    // update with clerk user details 
    const clerk = await clerkClient()
    const clerkUser = await clerk.users.getUser(userId)
    await prisma.user.create({
      data: {
        id: userId,
        email: clerkUser.emailAddresses[0].emailAddress,
        name: clerkUser.fullName,
      }
    })
  }

  return (
    <div className="flex h-screen bg-gray-100">
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