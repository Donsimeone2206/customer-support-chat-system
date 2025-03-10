// Wait for React and ReactDOM to be available
function waitForDependencies() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds with 100ms interval

    const check = () => {
      attempts++;
      console.log('Checking dependencies...', {
        react: !!window.React,
        reactDom: !!window.ReactDOM,
        pusher: !!window.Pusher
      });

      if (window.React && window.ReactDOM && window.Pusher) {
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error('Dependencies failed to load'));
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

async function createWidget(config) {
  const { websiteId, pusherKey, pusherCluster, baseUrl } = config;

  if (!websiteId) {
    throw new Error('Website ID is required');
  }

  if (!pusherKey || !pusherCluster) {
    throw new Error('Pusher configuration is required');
  }

  if (!baseUrl) {
    throw new Error('Base URL is required');
  }

  console.log('Creating widget for website:', websiteId);
  console.log('Using base URL:', baseUrl);

  // Add CSS link if not already present
  if (!document.querySelector('link[href*="/widget.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${baseUrl}/widget.css`;
    document.head.appendChild(link);
    console.log('Added widget CSS from:', link.href);
  }

  // Initialize audio with the correct URL
  const initAudio = () => {
    const audio = new Audio(`${baseUrl}/notification.mp3`);
    audio.volume = 0.5;
    return audio;
  };

  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const ReactDOM = window.ReactDOM;
  const Pusher = window.Pusher;

  // Create API helper
  const api = {
    async get(endpoint, params = {}) {
      try {
        const queryString = new URLSearchParams(params).toString();
        const url = `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;
        
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
        });
        
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return response.json();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    },
    
    async post(endpoint, data) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          body: JSON.stringify(data),
        });
        
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return response.json();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    },
    
    async upload(endpoint, formData) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          mode: 'cors',
          body: formData,
        });
        
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return response.json();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    },
  };

  function Widget({ websiteId, pusherKey, pusherCluster }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasUnread, setHasUnread] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [agentTyping, setAgentTyping] = useState(false);
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastMessageId, setLastMessageId] = useState(null);
    const lastReadIndexRef = useRef(0);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const audioRef = useRef(null);
    const emojiButtonRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const fileInputRef = useRef(null);

    // Handle keyboard shortcuts
    useEffect(() => {
      const handleKeyPress = (e) => {
        // Only handle shortcuts when chat is open
        if (!isOpen) return;

        // Escape to close chat
        if (e.key === 'Escape') {
          setIsOpen(false);
          return;
        }

        // Ctrl/Cmd + Enter to send message
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          if (newMessage.trim()) {
            handleSubmit(new Event('submit'));
          }
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
        if (e.altKey && e.key.toLowerCase() === 'n') {
          inputRef.current?.focus();
          e.preventDefault();
        }
      };

      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }, [isOpen, newMessage]);

    // Add animation class to new messages
    useEffect(() => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.id !== lastMessageId) {
        setLastMessageId(lastMessage?.id);
      }
    }, [messages]);

    // Close emoji picker when clicking outside
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          showEmojiPicker &&
          emojiPickerRef.current &&
          !emojiPickerRef.current.contains(event.target) &&
          !emojiButtonRef.current.contains(event.target)
        ) {
          setShowEmojiPicker(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [showEmojiPicker]);

    // Load emoji-mart dynamically
    useEffect(() => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/emoji-mart@latest/dist/browser.js';
      script.async = true;
      document.body.appendChild(script);

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/emoji-mart@latest/css/emoji-mart.css';
      document.head.appendChild(link);

      return () => {
        document.body.removeChild(script);
        document.head.removeChild(link);
      };
    }, []);

    // Handle emoji selection
    const handleEmojiSelect = (emoji) => {
      setNewMessage((prev) => prev + emoji.native);
      setShowEmojiPicker(false);
    };

    // Update audio initialization
    useEffect(() => {
      audioRef.current = initAudio();
    }, []);

    const [visitorId] = useState(() => {
      // Use the same localStorage key format as the main app
      const stored = localStorage.getItem(`chat_visitor_${websiteId}`);
      if (stored) return stored;
      const newId = Math.random().toString(36).substring(7);
      localStorage.setItem(`chat_visitor_${websiteId}`, newId);
      return newId;
    });

    // Set up Pusher subscription
    useEffect(() => {
      console.log('Setting up Pusher subscription with:', {
        pusherKey,
        pusherCluster,
        websiteId,
        visitorId
      });

      if (!pusherKey || !pusherCluster || !websiteId || !visitorId) {
        console.error('Missing required configuration for Pusher');
        return;
      }

      try {
        const pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
        });

        console.log('Pusher initialized successfully');

        const channel = pusher.subscribe(`chat-${websiteId}`);
        console.log('Subscribing to channel:', `chat-${websiteId}`);

        channel.bind('pusher:subscription_succeeded', () => {
          console.log('Successfully subscribed to channel:', `chat-${websiteId}`);
        });

        channel.bind('pusher:subscription_error', (error) => {
          console.error('Subscription error:', error);
        });

        // Handle incoming messages
        channel.bind('message', (data) => {
          console.log('Received message:', data);
          setMessages(prev => {
            // Check if we already have this message
            if (prev.some(m => m.id === data.id)) {
              return prev;
            }
            
            // Only add messages that are:
            // 1. From the agent (senderType === 'USER') OR
            // 2. From this visitor (visitorId matches) AND it's a new message
            if (data.senderType === 'USER' || data.visitorId === visitorId) {
              if (data.senderType === 'USER') {
                setHasUnread(true);
                if (isSoundEnabled && audioRef.current) {
                  audioRef.current.play().catch(console.error);
                }
              }
              return [...prev, data];
            }
            return prev;
          });
        });

        // Handle typing events
        channel.bind('typing', (data) => {
          console.log('Received typing event:', data);
          if (data.visitorId === 'agent') {
            setAgentTyping(data.isTyping);
            if (data.isTyping) {
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              typingTimeoutRef.current = setTimeout(() => {
                setAgentTyping(false);
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
        };
      } catch (error) {
        console.error('Error setting up Pusher:', error);
      }
    }, [websiteId, visitorId, pusherKey, pusherCluster, isSoundEnabled]);

    // Enhanced scroll to bottom with smooth behavior
    const scrollToBottom = (force = false) => {
      if (messagesEndRef.current) {
        if (force) {
          messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        } else {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    // Enhanced scroll event handler
    useEffect(() => {
      const container = messagesContainerRef.current;
      if (!container) return;

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
        
        // Update unread count when scrolling up
        if (!isNearBottom) {
          const unreadMessages = messages.slice(lastReadIndexRef.current).filter(
            msg => msg.senderType === 'USER'
          ).length;
          setUnreadCount(unreadMessages);
        } else {
          setUnreadCount(0);
          lastReadIndexRef.current = messages.length;
        }
      };

      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }, [messages]);

    // Reset unread count when reaching bottom
    useEffect(() => {
      const container = messagesContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (isNearBottom) {
        setUnreadCount(0);
        lastReadIndexRef.current = messages.length;
      }
    }, [messages]);

    // Auto scroll to bottom on new messages only if already at bottom
    useEffect(() => {
      const container = messagesContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (isNearBottom) {
        scrollToBottom();
      }
    }, [messages]);

    // Clear unread messages when opening chat
    useEffect(() => {
      if (isOpen) {
        setHasUnread(false);
      }
    }, [isOpen]);

    // Mark messages as read when chat is opened
    useEffect(() => {
      if (isOpen && messages.length > 0) {
        const unreadMessages = messages.filter(
          msg => msg.senderType === 'USER' && !msg.readAt
        );

        if (unreadMessages.length > 0) {
          api.post('/api/widget/messages/read', {
            websiteId,
            visitorId,
            messageIds: unreadMessages.map(msg => msg.id),
          });
        }
      }
    }, [isOpen, messages, websiteId, visitorId]);

    // Update API calls to use the api helper
    useEffect(() => {
      if (!isOpen) return;

      setIsLoading(true);
      setError(null);

      api.get('/api/widget/messages', { websiteId, visitorId })
        .then((data) => {
          console.log('Loaded messages:', data);
          setMessages(data);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Error loading messages:', error);
          setError('Failed to load messages. Please try again.');
          setIsLoading(false);
        });
    }, [isOpen, websiteId, visitorId]);

    // Update handleTyping to use api helper
    const handleTyping = () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (!isTyping) {
        setIsTyping(true);
        api.post('/api/widget/typing', {
          websiteId,
          visitorId,
          isTyping: true,
        }).catch(error => console.error('Error sending typing event:', error));
      }

      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        api.post('/api/widget/typing', {
          websiteId,
          visitorId,
          isTyping: false,
        }).catch(console.error);
      }, 2000);
    };

    // Update handleSubmit to avoid duplicate messages
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!newMessage.trim()) return;

      const messageContent = newMessage;
      setNewMessage('');
      setError(null);

      try {
        const message = await api.post('/api/widget/messages', {
          content: messageContent,
          websiteId,
          visitorId,
        });

        // Don't add the message here, it will come through Pusher
        // setMessages((prev) => [...prev, message]);
      } catch (error) {
        console.error('Error sending message:', error);
        setError('Failed to send message. Please try again.');
        setNewMessage(messageContent);
      }
    };

    // Update handleFileUpload to use api helper
    const handleFileUpload = async (file) => {
      if (!file) return;

      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('websiteId', websiteId);
      formData.append('visitorId', visitorId);

      try {
        const attachment = await api.upload('/api/widget/upload', formData);
        const message = await api.post('/api/widget/messages', {
          content: '',
          websiteId,
          visitorId,
          attachment,
        });

        setMessages((prev) => [...prev, message]);
      } catch (error) {
        console.error('Error uploading file:', error);
        setError(error.message || 'Failed to upload file');
      } finally {
        setIsUploading(false);
      }
    };

    // Update message display to handle attachments
    const MessageContent = ({ message }) => {
      if (message.attachment) {
        const { contentType, url, filename } = message.attachment;
        
        if (contentType.startsWith('image/')) {
          return React.createElement(
            'div',
            { className: 'space-y-2' },
            [
              React.createElement('img', {
                key: 'image',
                src: url,
                alt: filename,
                className: 'max-w-full rounded',
                style: { maxHeight: '200px' },
              }),
              React.createElement(
                'div',
                { key: 'filename', className: 'text-xs opacity-75' },
                filename
              ),
            ]
          );
        }

        return React.createElement(
          'a',
          {
            href: url,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'flex items-center space-x-2 hover:opacity-75',
          },
          [
            React.createElement(
              'svg',
              {
                key: 'icon',
                className: 'w-5 h-5',
                fill: 'none',
                stroke: 'currentColor',
                viewBox: '0 0 24 24',
              },
              React.createElement('path', {
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                strokeWidth: 2,
                d: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
              })
            ),
            React.createElement(
              'span',
              { key: 'filename', className: 'truncate max-w-[200px]' },
              filename
            ),
          ]
        );
      }

      return React.createElement(
        'div',
        { className: 'break-words' },
        message.content
      );
    };

    // Update message component to include status indicators
    const MessageStatus = ({ message }) => {
      if (message.senderType !== 'VISITOR') return null;

      return React.createElement(
        'div',
        {
          className: 'text-xs text-right mt-1',
        },
        message.readAt
          ? React.createElement(
              'span',
              {
                className: 'text-blue-400',
                title: `Read at ${new Date(message.readAt).toLocaleTimeString()}`,
              },
              '✓✓'
            )
          : React.createElement(
              'span',
              {
                className: 'text-gray-400',
                title: 'Sent',
              },
              '✓'
            )
      );
    };

    // Update scroll button with unread count
    const ScrollButton = () => {
      if (!showScrollButton) return null;

      return React.createElement(
        'button',
        {
          key: 'scroll-button',
          onClick: () => scrollToBottom(true),
          className: 'absolute bottom-4 right-4 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors flex items-center space-x-1',
          title: unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'}` : 'Scroll to bottom',
        },
        [
          unreadCount > 0 && React.createElement(
            'span',
            {
              key: 'count',
              className: 'text-xs font-medium bg-red-500 px-1.5 py-0.5 rounded-full',
            },
            unreadCount
          ),
          React.createElement(
            'svg',
            {
              key: 'icon',
              className: 'w-5 h-5',
              fill: 'none',
              stroke: 'currentColor',
              viewBox: '0 0 24 24',
            },
            React.createElement('path', {
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeWidth: 2,
              d: 'M19 14l-7 7m0 0l-7-7m7 7V3',
            })
          ),
        ]
      );
    };

    // Update message component to include animation
    const MessageBubble = ({ message, children }) => {
      const isNew = message.id === lastMessageId;
      const bubbleClass = `max-w-[70%] rounded-lg p-3 ${
        message.senderType === 'VISITOR'
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100'
      } ${isNew ? 'animate-message-appear' : ''}`;

      return React.createElement(
        'div',
        { className: bubbleClass },
        children
      );
    };

    return React.createElement(
      'div',
      { className: 'fixed bottom-4 right-4 z-50' },
      !isOpen
        ? React.createElement(
            'button',
            {
              onClick: () => setIsOpen(true),
              className:
                'relative bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors',
            },
            [
            React.createElement(
              'svg',
              {
                  key: 'icon',
                className: 'w-6 h-6',
                fill: 'none',
                stroke: 'currentColor',
                viewBox: '0 0 24 24',
              },
              React.createElement('path', {
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                strokeWidth: 2,
                d: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z',
              })
              ),
              hasUnread && React.createElement(
                'div',
                {
                  key: 'unread',
                  className: 'absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3',
                }
              ),
            ]
          )
        : React.createElement(
            'div',
            {
              className: 'bg-white rounded-lg shadow-xl w-96 flex flex-col',
              style: { height: '500px' },
            },
            [
              // Header
              React.createElement(
                'div',
                {
                  key: 'header',
                  className:
                    'p-4 border-b bg-blue-500 text-white rounded-t-lg flex justify-between items-center shrink-0',
                },
                [
                  React.createElement(
                    'h3',
                    { key: 'title', className: 'font-medium flex items-center space-x-2' },
                    [
                      React.createElement(
                        'span',
                        { key: 'text' },
                    'Chat Support'
                      ),
                      React.createElement(
                        'button',
                        {
                          key: 'sound',
                          onClick: () => setIsSoundEnabled(!isSoundEnabled),
                          className: 'ml-2 p-1 hover:bg-blue-600 rounded transition-colors',
                          title: isSoundEnabled ? 'Mute notifications' : 'Unmute notifications',
                        },
                        React.createElement(
                          'svg',
                          {
                            className: 'w-4 h-4',
                            fill: 'none',
                            stroke: 'currentColor',
                            viewBox: '0 0 24 24',
                          },
                          isSoundEnabled
                            ? React.createElement('path', {
                                strokeLinecap: 'round',
                                strokeLinejoin: 'round',
                                strokeWidth: 2,
                                d: 'M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.788l-1.79-1.789a1 1 0 00-1.414 1.414l1.789 1.79-1.79 1.788a1 1 0 001.415 1.414l1.789-1.789 1.788 1.789a1 1 0 001.414-1.414L8.914 10.2l1.789-1.789a1 1 0 00-1.414-1.414L7.5 8.786 6.5 7.786v1.002z',
                              })
                            : React.createElement('path', {
                                strokeLinecap: 'round',
                                strokeLinejoin: 'round',
                                strokeWidth: 2,
                                d: 'M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z',
                              })
                        )
                      ),
                    ]
                  ),
                  React.createElement(
                    'button',
                    {
                      key: 'close',
                      onClick: () => setIsOpen(false),
                      className: 'text-white hover:text-gray-200',
                    },
                    React.createElement(
                      'svg',
                      {
                        className: 'w-6 h-6',
                        fill: 'none',
                        stroke: 'currentColor',
                        viewBox: '0 0 24 24',
                      },
                      React.createElement('path', {
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        strokeWidth: 2,
                        d: 'M6 18L18 6M6 6l12 12',
                      })
                    )
                  ),
                ]
              ),
              // Messages container with ref
              React.createElement(
                'div',
                {
                  key: 'messages',
                  ref: messagesContainerRef,
                  className: 'flex-1 overflow-y-auto relative',
                  style: { minHeight: 0 },
                },
                React.createElement(
                  'div',
                  {
                    className: 'p-4 space-y-4',
                  },
                  [
                    // Loading state
                    isLoading && React.createElement(
                      'div',
                      {
                        key: 'loading',
                        className: 'flex justify-center items-center py-4',
                      },
                      React.createElement(
                        'div',
                        {
                          className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500',
                        }
                      )
                    ),
                    // Error message
                    error && React.createElement(
                      'div',
                      {
                        key: 'error',
                        className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative',
                      },
                      error
                    ),
                    // Messages
                    ...messages.map((message) =>
                  React.createElement(
                    'div',
                    {
                      key: message.id,
                          className: `flex flex-col ${
                        message.senderType === 'VISITOR'
                              ? 'items-end'
                              : 'items-start'
                      }`,
                    },
                        [
                          React.createElement(
                            MessageBubble,
                            { message },
                            [
                    React.createElement(
                                'div',
                                {
                                  key: 'header',
                                  className: 'text-xs opacity-75 mb-1',
                                },
                                `${message.senderType === 'USER' ? 'Agent' : 'You'} • ${
                                  new Date(message.createdAt).toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })
                                }`
                              ),
                              React.createElement(MessageContent, {
                                key: 'content',
                                message,
                              }),
                            ]
                          ),
                          React.createElement(MessageStatus, { key: 'status', message }),
                        ]
                      )
                    ),
                    // Agent typing indicator
                    agentTyping && React.createElement(
                      'div',
                      {
                        key: 'agent-typing',
                        className: 'flex justify-start',
                      },
                      React.createElement(
                        'div',
                        {
                          className: 'bg-gray-100 rounded-lg p-3 flex items-center space-x-2',
                        },
                        [
                          React.createElement(
                            'div',
                            {
                              className: 'flex space-x-1',
                            },
                            [
                              React.createElement('div', {
                                className: 'w-2 h-2 bg-gray-400 rounded-full animate-bounce',
                                style: { animationDelay: '0ms' },
                              }),
                              React.createElement('div', {
                                className: 'w-2 h-2 bg-gray-400 rounded-full animate-bounce',
                                style: { animationDelay: '150ms' },
                              }),
                              React.createElement('div', {
                                className: 'w-2 h-2 bg-gray-400 rounded-full animate-bounce',
                                style: { animationDelay: '300ms' },
                              }),
                            ]
                          ),
                          React.createElement(
                            'span',
                            {
                              className: 'text-sm text-gray-500',
                            },
                            'Agent is typing...'
                          ),
                        ]
                      )
                    ),
                    // Scroll anchor
                    React.createElement('div', { key: 'scroll-anchor', ref: messagesEndRef })
                  ]
                ),
                React.createElement(ScrollButton),
              ),
              // Input form
              React.createElement(
                'form',
                {
                  key: 'form',
                  onSubmit: handleSubmit,
                  className: 'p-4 border-t relative shrink-0',
                },
                [
                React.createElement(
                  'div',
                  { className: 'flex space-x-2' },
                  [
                      React.createElement(
                        'button',
                        {
                          key: 'emoji',
                          type: 'button',
                          ref: emojiButtonRef,
                          onClick: () => setShowEmojiPicker(!showEmojiPicker),
                          className:
                            'p-2 text-gray-500 hover:text-gray-700 focus:outline-none',
                        },
                        React.createElement(
                          'svg',
                          {
                            className: 'w-5 h-5',
                            fill: 'none',
                            stroke: 'currentColor',
                            viewBox: '0 0 24 24',
                          },
                          React.createElement('path', {
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                            strokeWidth: 2,
                            d: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                          })
                        )
                      ),
                      React.createElement(
                        'button',
                        {
                          key: 'attachment',
                          type: 'button',
                          onClick: () => fileInputRef.current?.click(),
                          disabled: isUploading,
                          className:
                            'p-2 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
                          title: 'Attach file',
                        },
                        React.createElement(
                          'svg',
                          {
                            className: 'w-5 h-5',
                            fill: 'none',
                            stroke: 'currentColor',
                            viewBox: '0 0 24 24',
                          },
                          React.createElement('path', {
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                            strokeWidth: 2,
                            d: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13',
                          })
                        )
                      ),
                    React.createElement('input', {
                      key: 'input',
                        ref: inputRef,
                      type: 'text',
                      value: newMessage,
                        onChange: (e) => {
                          setNewMessage(e.target.value);
                          handleTyping();
                        },
                        placeholder: 'Type a message... (Ctrl+Enter to send)',
                      className:
                        'flex-1 rounded-lg border p-2 focus:outline-none focus:border-blue-500',
                    }),
                    React.createElement(
                      'button',
                      {
                        key: 'submit',
                        type: 'submit',
                          disabled: !newMessage.trim(),
                        className:
                            'bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                      },
                      'Send'
                    ),
                  ]
                  ),
                  showEmojiPicker &&
                    React.createElement(
                      'div',
                      {
                        key: 'emoji-picker',
                        ref: emojiPickerRef,
                        className: 'absolute bottom-full mb-2',
                        style: { zIndex: 1000 },
                      },
                      React.createElement('emoji-picker', {
                        onEmojiSelect: (emoji) => handleEmojiSelect(emoji),
                      })
                    ),
                  React.createElement(
                    'input',
                    {
                      key: 'file-input',
                      ref: fileInputRef,
                      type: 'file',
                      className: 'hidden',
                      onChange: (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file);
                          e.target.value = ''; // Reset input
                        }
                      },
                      accept: '.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt',
                    },
                  ),
                ]
              ),
            ]
          )
    );
  }

  // Create container
  const container = document.createElement('div');
  container.id = 'chat-widget-container';
  document.body.appendChild(container);

  // Render the Widget component directly
  ReactDOM.render(
    React.createElement(Widget, {
      websiteId,
      pusherKey,
      pusherCluster,
    }),
    container
  );

  console.log('Widget created successfully');
  return container;
}

// Define ChatWidget class for better method exposure
class ChatWidgetClass {
  constructor() {
    this.isInitialized = false;
  }

  async init(config) {
    try {
      if (!config) {
        throw new Error('Widget: Configuration is required');
      }

      // Prevent multiple initializations
      if (this.isInitialized) {
        console.log('Chat widget already initialized');
        return;
      }

      console.log('Initializing chat widget with config:', config);
      
      const websiteId = config.websiteId;
      const baseUrl = config.baseUrl || window.location.origin;
      const pusherKey = config.pusherKey;
      const pusherCluster = config.pusherCluster;

      if (!websiteId) {
        throw new Error('Widget: Missing website ID');
      }

      if (!pusherKey || !pusherCluster) {
        throw new Error('Widget: Missing Pusher configuration');
      }

      console.log('Using configuration:', {
        websiteId,
        baseUrl,
        pusherKey,
        pusherCluster
      });

      await waitForDependencies();
      console.log('Dependencies loaded successfully');
      
      await createWidget({
        websiteId,
        baseUrl,
        pusherKey,
        pusherCluster
      });
      
      console.log('Widget created successfully');
      this.isInitialized = true;
    } catch (error) {
      console.error('Widget initialization error:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const ChatWidget = new ChatWidgetClass();

// Export the ChatWidget object for bundling
export default ChatWidget;

// Make ChatWidget available globally - this is now handled by esbuild footer
// if (typeof window !== 'undefined') {
//   window.ChatWidget = ChatWidget;
// } 