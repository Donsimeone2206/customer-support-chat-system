'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Pusher from 'pusher-js'

interface Conversation {
  id: string
  title: string
  status: 'ACTIVE' | 'CLOSED' | 'PENDING'
  websiteId: string
  visitorId: string
  website: {
    name: string
    domain: string
  }
  messages: Message[]
  updatedAt: string
}

interface Message {
  id: string
  content: string
  createdAt: string
  senderId: string
  senderType: 'USER' | 'VISITOR'
  visitorId?: string
  conversationId: string
}

export default function SupportPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch conversations
    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/conversations')
        const data = await response.json()
        setConversations(data)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching conversations:', error)
        setLoading(false)
      }
    }

    fetchConversations()

    // Initialize Pusher for real-time updates
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })

    // Subscribe to all website channels
    const channels = conversations.map((conv) => {
      const channel = pusher.subscribe(`chat-admin-${conv.websiteId}`)
      channel.bind('message', (data: Message) => {
        // Update conversations with new message
        setConversations((prevConvs) =>
          prevConvs.map((conv) =>
            conv.id === data.conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, data],
                  updatedAt: new Date().toISOString(),
                }
              : conv
          )
        )
      })
      return channel
    })

    return () => {
      channels.forEach((channel) => {
        channel.unbind_all()
        channel.unsubscribe()
      })
    }
  }, [])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConversation || !newMessage.trim()) return

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage,
          conversationId: selectedConversation.id,
          websiteId: selectedConversation.websiteId,
          visitorId: selectedConversation.visitorId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const updateConversationStatus = async (
    conversationId: string,
    status: 'ACTIVE' | 'CLOSED' | 'PENDING'
  ) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      // Update local state
      setConversations((prevConvs) =>
        prevConvs.map((conv) =>
          conv.id === conversationId ? { ...conv, status } : conv
        )
      )
    } catch (error) {
      console.error('Error updating conversation status:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Conversation List */}
      <div className="w-1/3 bg-white border-r overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Conversations</h2>
        </div>
        <div className="divide-y">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-4 cursor-pointer hover:bg-gray-50 ${
                selectedConversation?.id === conversation.id
                  ? 'bg-blue-50'
                  : ''
              }`}
              onClick={() => setSelectedConversation(conversation)}
            >
              <div className="flex justify-between items-start mb-1">
                <div>
                  <h3 className="font-medium">
                    {conversation.website.name} - Visitor
                  </h3>
                  <p className="text-sm text-gray-500">
                    {conversation.website.domain}
                  </p>
                </div>
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
              <p className="text-sm text-gray-600 truncate">
                {conversation.messages[conversation.messages.length - 1]?.content ||
                  'No messages'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {format(new Date(conversation.updatedAt), 'MMM d, h:mm a')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b bg-white flex justify-between items-center">
            <div>
              <h2 className="font-semibold">
                {selectedConversation.website.name} - Visitor Chat
              </h2>
              <p className="text-sm text-gray-500">
                {selectedConversation.website.domain}
              </p>
            </div>
            <div className="space-x-2">
              <button
                onClick={() =>
                  updateConversationStatus(selectedConversation.id, 'ACTIVE')
                }
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedConversation.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Active
              </button>
              <button
                onClick={() =>
                  updateConversationStatus(selectedConversation.id, 'PENDING')
                }
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedConversation.status === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() =>
                  updateConversationStatus(selectedConversation.id, 'CLOSED')
                }
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedConversation.status === 'CLOSED'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedConversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderType === 'USER' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.senderType === 'USER'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  <div className="mb-1 text-xs opacity-75">
                    {message.senderType === 'USER' ? 'Agent' : 'Visitor'} •{' '}
                    {format(new Date(message.createdAt), 'h:mm a')}
                  </div>
                  <div>{message.content}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
            <div className="flex space-x-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 rounded-lg border p-2 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">Select a conversation to start chatting</p>
        </div>
      )}
    </div>
  )
} 