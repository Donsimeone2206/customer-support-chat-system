'use client'

import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import Pusher from 'pusher-js'

interface Conversation {
  id: string
  title: string
  status: 'ACTIVE' | 'CLOSED' | 'PENDING'
  websiteId: string
  visitorId: string
  ipAddress: string
  country: string
  website: {
    name: string
    domain: string
  }
  messages: Message[]
  lastMessage?: string
  updatedAt: string
}

interface Message {
  id: string
  content: string
  createdAt: string
  senderId?: string
  senderType: 'USER' | 'VISITOR'
  visitorId?: string
  conversationId: string
}

export default function SupportPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastMessageId, setLastMessageId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [visitorTyping, setVisitorTyping] = useState<{[key: string]: boolean}>({})
  const typingTimeoutRef = useRef<{[key: string]: NodeJS.Timeout}>({})
  const lastReadIndexRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastTypingEventRef = useRef<number>(0)
  const TYPING_DEBOUNCE = 1000 // Send typing event at most once per second

  const handleCtrlEnterSubmit = () => {
    if (newMessage.trim() && selectedConversation) {
      handleSendMessage({
        preventDefault: () => {},
      } as React.FormEvent);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Escape to clear selected conversation
      if (e.key === 'Escape' && selectedConversation) {
        setSelectedConversation(null);
        return;
      }

      // Ctrl/Cmd + Enter to send message
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleCtrlEnterSubmit();
        return;
      }

      // Page Up/Down for scrolling
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        const container = messagesContainerRef.current;
        if (!container) return;

        const scrollAmount = container.clientHeight * 0.8;
        container.scrollBy({
          top: e.key === 'PageUp' ? -scrollAmount : scrollAmount,
          behavior: 'smooth'
        });
        e.preventDefault();
      }

      // Alt + N to focus input
      if (e.altKey && e.key.toLowerCase() === 'n' && selectedConversation) {
        inputRef.current?.focus();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [selectedConversation, newMessage]);

  // Handle scroll events and unread count
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !selectedConversation) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
      
      if (!isNearBottom) {
        const unreadMessages = selectedConversation.messages
          .slice(lastReadIndexRef.current)
          .filter(msg => msg.senderType === 'VISITOR').length;
        setUnreadCount(unreadMessages);
      } else {
        setUnreadCount(0);
        lastReadIndexRef.current = selectedConversation.messages.length;
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [selectedConversation]);

  // Track new messages for animation
  useEffect(() => {
    if (selectedConversation?.messages.length) {
      const lastMessage = selectedConversation.messages[selectedConversation.messages.length - 1];
      if (lastMessage?.id !== lastMessageId) {
        setLastMessageId(lastMessage?.id);
      }
    }
  }, [selectedConversation?.messages]);

  // Enhanced scroll to bottom
  const scrollToBottom = (force = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: force ? 'auto' : 'smooth'
      });
    }
  };

  // Auto scroll to bottom on new messages if near bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !selectedConversation?.messages.length) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [selectedConversation?.messages]);

  // Message bubble component with animation
  const MessageBubble = ({ message, children }: { message: Message; children: React.ReactNode }) => {
    const isNew = message.id === lastMessageId;
    const bubbleClass = `max-w-[70%] rounded-lg p-3 ${
      message.senderType === 'USER'
        ? 'bg-blue-500 text-white'
        : 'bg-gray-100'
    } ${isNew ? 'animate-message-appear' : ''}`;

    return (
      <div className={bubbleClass}>
        {children}
      </div>
    );
  };

  // Scroll to bottom button component
  const ScrollButton = () => {
    if (!showScrollButton) return null;

    return (
      <button
        onClick={() => scrollToBottom(true)}
        className="absolute bottom-4 right-4 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors flex items-center space-x-1"
        title={unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'}` : 'Scroll to bottom'}
      >
        {unreadCount > 0 && (
          <span className="text-xs font-medium bg-red-500 px-1.5 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>
    );
  };

  // Fetch conversations
  useEffect(() => {
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
  }, [])

  // Set up Pusher subscriptions
  useEffect(() => {
    if (conversations.length === 0) return

    // Initialize Pusher
    console.log('Initializing Pusher in agent interface with:', {
      key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    });

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })

    // Keep track of subscribed channels and subscription attempts
    const channels = new Map()
    const maxRetries = 3
    const retryDelay = 2000 // 2 seconds

    // Helper function to handle subscription with retries
    const subscribeWithRetry = async (websiteId: string, attempt = 1) => {
      try {
        const channelName = `chat-admin-${websiteId}`
        console.log(`Attempting to subscribe to ${channelName}, attempt ${attempt}`);
        
        const channel = pusher.subscribe(channelName)
        channels.set(websiteId, channel)

        channel.bind('pusher:subscription_succeeded', () => {
          console.log(`Successfully subscribed to ${channelName}`);
        })

        channel.bind('pusher:subscription_error', (error: any) => {
          console.error(`Subscription error for ${channelName}:`, error);
          if (attempt < maxRetries) {
            console.log(`Retrying subscription in ${retryDelay}ms...`);
            setTimeout(() => {
              subscribeWithRetry(websiteId, attempt + 1);
            }, retryDelay);
          }
        })

        // Set up message handler
        channel.bind('message', (data: Message) => {
          // Update conversations with new message
          setConversations((prevConvs) =>
            prevConvs.map((conv) =>
              conv.id === data.conversationId
                ? {
                    ...conv,
                    lastMessage: data.content,
                    updatedAt: new Date().toISOString(),
                  }
                : conv
            )
          )
          
          // Update selected conversation if this message belongs to it
          if (selectedConversation?.id === data.conversationId) {
            setSelectedConversation(prev => 
              prev ? { 
                ...prev, 
                messages: [...prev.messages, data],
                lastMessage: data.content,
                updatedAt: new Date().toISOString(),
              } : null
            )
          }
        })

        // Handle typing events
        channel.bind('typing', (data: { visitorId: string; isTyping: boolean }) => {
          console.log('Received typing event:', data);
          if (data.visitorId !== 'agent') {
            setVisitorTyping(prev => ({
              ...prev,
              [data.visitorId]: data.isTyping
            }));

            // Clear typing indicator after 3 seconds if no updates
            if (data.isTyping) {
              // Clear any existing timeout for this visitor
              if (typingTimeoutRef.current[data.visitorId]) {
                clearTimeout(typingTimeoutRef.current[data.visitorId]);
              }
              
              typingTimeoutRef.current[data.visitorId] = setTimeout(() => {
                setVisitorTyping(prev => ({
                  ...prev,
                  [data.visitorId]: false
                }));
                delete typingTimeoutRef.current[data.visitorId];
              }, 3000);
            }
          }
        });
      } catch (error) {
        console.error('Error subscribing to channel:', error);
      }
    }

    // Subscribe to channels for each conversation's website
    conversations.forEach((conv) => {
      if (conv.websiteId && !channels.has(conv.websiteId)) {
        subscribeWithRetry(conv.websiteId)
      }
    })

    // Cleanup function
    return () => {
      // Clear all typing timeouts
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      typingTimeoutRef.current = {};

      channels.forEach((channel) => {
        channel.unbind_all()
        pusher.unsubscribe(channel.name)
      })
    }
  }, [conversations, selectedConversation])

  const fetchConversationMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`)
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching conversation messages:', error)
      return []
    }
  }

  const handleConversationSelect = async (conversation: Conversation) => {
    setSelectedConversation(conversation)
    const messages = await fetchConversationMessages(conversation.id)
    setSelectedConversation(prev => prev ? { ...prev, messages } : null)
  }

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

  // Send typing event with debouncing and error handling
  const sendTypingEvent = async (websiteId: string, isTyping: boolean) => {
    try {
      const now = Date.now();
      // Don't send typing events too frequently
      if (isTyping && now - lastTypingEventRef.current < TYPING_DEBOUNCE) {
        return;
      }
      lastTypingEventRef.current = now;

      const response = await fetch('/api/widget/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websiteId,
          visitorId: 'agent',
          isTyping,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send typing event');
      }
    } catch (error) {
      console.error('Error sending typing event:', error);
    }
  };

  // Handle agent typing with improved debouncing
  const handleTyping = () => {
    if (!selectedConversation) return;

    // Update local typing state
    if (!isTyping) {
      setIsTyping(true);
      sendTypingEvent(selectedConversation.websiteId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current[selectedConversation.id]) {
      clearTimeout(typingTimeoutRef.current[selectedConversation.id]);
    }

    // Set new timeout to clear typing status
    typingTimeoutRef.current[selectedConversation.id] = setTimeout(() => {
      setIsTyping(false);
      sendTypingEvent(selectedConversation.websiteId, false);
      delete typingTimeoutRef.current[selectedConversation.id];
    }, 2000);
  };

  // Cleanup typing timeouts when conversation changes or component unmounts
  useEffect(() => {
    return () => {
      if (selectedConversation?.id) {
        const timeout = typingTimeoutRef.current[selectedConversation.id];
        if (timeout) {
          clearTimeout(timeout);
          // Send final typing false event
          sendTypingEvent(selectedConversation.websiteId, false);
          delete typingTimeoutRef.current[selectedConversation.id];
        }
      }
    };
  }, [selectedConversation]);

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
          <h2 className="text-lg font-semibold text-slate-900">Conversations</h2>
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
              onClick={() => handleConversationSelect(conversation)}
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
                {conversation.lastMessage || 'No messages'}
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
              <p className="text-sm text-gray-500">
                {selectedConversation.ipAddress}
              </p>
              <p className="text-sm text-gray-500">
                {selectedConversation.country}
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
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 relative"
          >
            {selectedConversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderType === 'USER' ? 'justify-end' : 'justify-start'
                }`}
              >
                <MessageBubble message={message}>
                  <div className="text-xs opacity-75 mb-1">
                    {message.senderType === 'USER' ? 'Agent' : 'Visitor'} •{' '}
                    {format(new Date(message.createdAt), 'h:mm a')}
                  </div>
                  <div>{message.content}</div>
                </MessageBubble>
              </div>
            ))}
            {/* Typing indicator */}
            {selectedConversation && visitorTyping[selectedConversation.visitorId] && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3 flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-500">Visitor is typing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
            <ScrollButton />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
            <div className="flex space-x-4">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onBlur={() => {
                  if (isTyping && selectedConversation) {
                    setIsTyping(false);
                    sendTypingEvent(selectedConversation.websiteId, false);
                  }
                }}
                placeholder="Type your message... (Ctrl+Enter to send)"
                className="flex-1 rounded-lg border p-2 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!newMessage.trim()}
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