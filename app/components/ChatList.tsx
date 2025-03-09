'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'

interface Conversation {
  id: string
  title: string
  status: 'ACTIVE' | 'CLOSED' | 'PENDING'
  updatedAt: string
  lastMessage?: string
}

interface ChatListProps {
  userId: string
}

export default function ChatList({ userId }: ChatListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/conversations')
        const data = await response.json()
        setConversations(data)
      } catch (error) {
        console.error('Error fetching conversations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Conversations</h2>
      </div>
      <div className="divide-y">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className="p-4 hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-medium">
                {conversation.title || 'Untitled Conversation'}
              </h3>
              <span className="text-xs text-gray-500">
                {format(new Date(conversation.updatedAt), 'MMM d, h:mm a')}
              </span>
            </div>
            <p className="text-sm text-gray-600 truncate">
              {conversation.lastMessage || 'No messages yet'}
            </p>
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                  conversation.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : conversation.status === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {conversation.status.toLowerCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 