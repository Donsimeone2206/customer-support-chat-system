'use client'

import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import Pusher from 'pusher-js'

interface Message {
  id: string
  content: string
  createdAt: string
  senderId?: string
  senderType: 'USER' | 'VISITOR'
  visitorId?: string
  conversationId: string
}

interface ChatWidgetProps {
  websiteId: string
  pusherKey?: string
  pusherCluster?: string
}

export default function ChatWidget({ websiteId, pusherKey, pusherCluster }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [visitorId, setVisitorId] = useState('')
  const [isAgentTyping, setIsAgentTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Load initial messages and set up visitor ID
  useEffect(() => {
    const initializeChat = async () => {
      // Try to get existing visitorId from localStorage
      const storedVisitorId = localStorage.getItem(`chat_visitor_${websiteId}`)
      const vid = storedVisitorId || Math.random().toString(36).substring(7)
      
      if (!storedVisitorId) {
        localStorage.setItem(`chat_visitor_${websiteId}`, vid)
      }
      
      setVisitorId(vid)

      try {
        const response = await fetch(`/api/widget/messages?websiteId=${websiteId}&visitorId=${vid}`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data)
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeChat()
  }, [websiteId])

  // Set up Pusher subscription
  useEffect(() => {
    console.log('Stage 1: Setting up Pusher subscription for visitor:', visitorId);
    if (!visitorId || !websiteId) {
      console.log('Missing required IDs:', { visitorId, websiteId });
      return;
    } 

    console.log('Stage 2: Checking Pusher configuration:', {
      pusherKey,
      pusherCluster,
    });

    if (!pusherKey || !pusherCluster) {
      console.error('Missing Pusher configuration');
      return;
    }

    let pusher: Pusher;
    try {
      pusher = new Pusher(pusherKey, {
        cluster: pusherCluster,
      })

      console.log('Stage 3: Pusher initialized successfully');

      // Subscribe to the correct channel that matches the agent's channel
      const channel = pusher.subscribe(`chat-${websiteId}`)
      console.log('Stage 4: Attempting to subscribe to channel:', `chat-${websiteId}`);
      
      // Debug subscription status
      channel.bind('pusher:subscription_succeeded', () => {
        console.log('Stage 4a: Successfully subscribed to channel:', `chat-${websiteId}`);
      });

      channel.bind('pusher:subscription_error', (error: any) => {
        console.error('Stage 4b: Subscription error:', error);
      });
      
      // Handle incoming messages
      channel.bind('message', (data: Message) => {
        console.log('Stage 5: Received message:', data);
        if (data.senderType === 'USER' || data.visitorId === visitorId) {
          setMessages(prev => [...prev, data]);
          // Scroll to bottom on new message
          setTimeout(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);
          
          // Clear typing indicator when receiving agent message
          if (data.senderType === 'USER') {
            setIsAgentTyping(false);
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
          }
        }
      });

      // Handle typing events
      channel.bind('typing', (data: { visitorId: string; isTyping: boolean }) => {
        console.log('Stage 6: Received typing event:', data);
        // Only show typing indicator if it's from the agent
        if (data.visitorId === 'agent') {
          console.log('Setting agent typing state:', data.isTyping);
          setIsAgentTyping(data.isTyping);
          
          // Clear previous timeout if it exists
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          
          // Set a timeout to clear the typing indicator after 3 seconds
          if (data.isTyping) {
            typingTimeoutRef.current = setTimeout(() => {
              setIsAgentTyping(false);
            }, 3000);
          }
        }
      });

      return () => {
        console.log('Cleaning up Pusher subscription');
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        channel.unbind_all();
        pusher.unsubscribe(`chat-${websiteId}`);
        pusher.disconnect();
      }
    } catch (error) {
      console.error('Error setting up Pusher:', error);
    }
  }, [websiteId, visitorId, pusherKey, pusherCluster]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Handle visitor message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const messageContent = newMessage
    setNewMessage('') // Clear input immediately for better UX

    try {
      const response = await fetch('/api/widget/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: messageContent,
          websiteId,
          visitorId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // No need to manually add the message here as it will come through Pusher
    } catch (error) {
      console.error('Error sending message:', error)
      // Optionally show an error message to the user
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-500 text-white rounded-full p-4 shadow-lg hover:bg-blue-600 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white rounded-lg shadow-xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-blue-500 text-white rounded-t-lg flex justify-between items-center">
        <h3 className="font-semibold">Chat Support</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:text-gray-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderType === 'VISITOR' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.senderType === 'VISITOR'
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
        {isAgentTyping && (
          <div className="flex justify-start mt-4">
            <div className="bg-gray-100 rounded-lg p-3 h-10 flex items-center">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex space-x-2">
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
  )
} 