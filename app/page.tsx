import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'

export default async function Home() {
  const { userId } = await auth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="mb-8 text-4xl font-bold text-slate-900">Welcome to Chat Support System</h1>
      
      <div className="space-y-4">
        {!userId ? (
          <div className="space-x-4">
            <Link
              href="/sign-in"
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
            >
              Sign Up
            </Link>
          </div>
        ) : (
          <Link
            href="/dashboard"
            className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            Go to Dashboard
          </Link>
        )}
      </div>
    </div>
  )
}
