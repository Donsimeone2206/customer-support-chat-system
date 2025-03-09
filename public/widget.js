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

async function createWidget(websiteId, baseUrl) {
  if (!websiteId) {
    throw new Error('Website ID is required');
  }

  console.log('Creating widget for website:', websiteId);

  const React = window.React;
  const { useState, useEffect } = React;
  const ReactDOM = window.ReactDOM;
  const Pusher = window.Pusher;

  function Widget({ websiteId, baseUrl }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [visitorId] = useState(() => {
      const stored = localStorage.getItem('visitorId');
      if (stored) return stored;
      const newId = Math.random().toString(36).substring(7);
      localStorage.setItem('visitorId', newId);
      return newId;
    });

    useEffect(() => {
      if (!isOpen) return;

      // Load existing messages when chat is opened
      fetch(`${baseUrl}/api/widget/messages?websiteId=${websiteId}&visitorId=${visitorId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      })
        .then((response) => response.json())
        .then((data) => {
          setMessages(data);
        })
        .catch((error) => {
          console.error('Error loading messages:', error);
        });

      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      });

      const channel = pusher.subscribe(`chat-${websiteId}`);
      channel.bind('message', (data) => {
        if (data.visitorId !== visitorId) {
          setMessages((prev) => [...prev, data]);
        }
      });

      return () => {
        channel.unbind_all();
        channel.unsubscribe();
      };
    }, [isOpen, websiteId, visitorId, baseUrl]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!newMessage.trim()) return;

      try {
        const response = await fetch(`${baseUrl}/api/widget/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors',
          body: JSON.stringify({
            content: newMessage,
            websiteId,
            visitorId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const message = await response.json();
        setMessages((prev) => [...prev, message]);
        setNewMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
      }
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
                'bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors',
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
                d: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z',
              })
            )
          )
        : React.createElement(
            'div',
            {
              className: 'bg-white rounded-lg shadow-xl w-96 h-[500px] flex flex-col',
            },
            [
              // Header
              React.createElement(
                'div',
                {
                  key: 'header',
                  className:
                    'p-4 border-b bg-blue-500 text-white rounded-t-lg flex justify-between items-center',
                },
                [
                  React.createElement(
                    'h3',
                    { key: 'title', className: 'font-medium' },
                    'Chat Support'
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
              // Messages
              React.createElement(
                'div',
                {
                  key: 'messages',
                  className: 'flex-1 p-4 overflow-y-auto space-y-4',
                },
                messages.map((message) =>
                  React.createElement(
                    'div',
                    {
                      key: message.id,
                      className: `flex ${
                        message.senderType === 'VISITOR'
                          ? 'justify-end'
                          : 'justify-start'
                      }`,
                    },
                    React.createElement(
                      'div',
                      {
                        className: `max-w-[70%] rounded-lg p-3 ${
                          message.senderType === 'VISITOR'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100'
                        }`,
                      },
                      message.content
                    )
                  )
                )
              ),
              // Input form
              React.createElement(
                'form',
                {
                  key: 'form',
                  onSubmit: handleSubmit,
                  className: 'p-4 border-t',
                },
                React.createElement(
                  'div',
                  { className: 'flex space-x-2' },
                  [
                    React.createElement('input', {
                      key: 'input',
                      type: 'text',
                      value: newMessage,
                      onChange: (e) => setNewMessage(e.target.value),
                      placeholder: 'Type a message...',
                      className:
                        'flex-1 rounded-lg border p-2 focus:outline-none focus:border-blue-500',
                    }),
                    React.createElement(
                      'button',
                      {
                        key: 'submit',
                        type: 'submit',
                        className:
                          'bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600',
                      },
                      'Send'
                    ),
                  ]
                )
              ),
            ]
          )
    )
  }

  // Create container for widget
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Add styles
  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = `${baseUrl}/widget.css`;
  document.head.appendChild(styles);

  // Render widget
  ReactDOM.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(Widget, { websiteId, baseUrl })
    ),
    container
  );
}

// Define ChatWidget class for better method exposure
class ChatWidgetClass {
  constructor() {
    this.isInitialized = false;
  }

  async init() {
    try {
      // Prevent multiple initializations
      if (this.isInitialized) {
        console.log('Chat widget already initialized');
        return;
      }

      console.log('Initializing chat widget...');
      const script = document.currentScript || document.querySelector('script[data-website-id]');
      const websiteId = script?.getAttribute('data-website-id');
      const baseUrl = script?.src ? new URL(script.src).origin : '';

      if (!websiteId) {
        throw new Error('Widget: Missing website ID');
      }

      if (!baseUrl) {
        throw new Error('Widget: Could not determine base URL');
      }

      console.log('Found website ID:', websiteId);
      console.log('Base URL:', baseUrl);
      await waitForDependencies();
      console.log('Dependencies loaded successfully');
      await createWidget(websiteId, baseUrl);
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