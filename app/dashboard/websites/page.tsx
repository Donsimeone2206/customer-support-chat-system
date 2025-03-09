'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Website {
  id: string
  name: string
  domain: string
  createdAt: string
}

export default function WebsitesPage() {
  const router = useRouter()
  const [websites, setWebsites] = useState<Website[]>([])
  const [showNewWebsiteForm, setShowNewWebsiteForm] = useState(false)
  const [newWebsite, setNewWebsite] = useState({ name: '', domain: '' })
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null)

  const handleCreateWebsite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/websites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newWebsite),
      })

      if (!response.ok) {
        throw new Error('Failed to create website')
      }

      const website = await response.json()
      setWebsites((prev) => [...prev, website])
      setNewWebsite({ name: '', domain: '' })
      setShowNewWebsiteForm(false)
    } catch (error) {
      console.error('Error creating website:', error)
    }
  }

  const getWidgetCode = (websiteId: string) => {
    const widgetUrl = `${window.location.protocol}//${window.location.host}/widget.bundle.js`
    return `
<!-- Chat Widget Dependencies -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://js.pusher.com/8.2.0/pusher.min.js"></script>
<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
<!-- Chat Widget -->
<script>
  (function() {
    function loadScript(url, websiteId) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.setAttribute('data-website-id', websiteId);
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    function waitForDependencies() {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;
        
        function check() {
          console.log('Checking dependencies:', {
            react: !!window.React,
            reactDom: !!window.ReactDOM,
            pusher: !!window.Pusher
          });
          
          if (window.React && window.ReactDOM && window.Pusher) {
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error('Dependencies failed to load'));
          } else {
            attempts++;
            setTimeout(check, 100);
          }
        }
        
        check();
      });
    }

    async function initializeWidget() {
      try {
        console.log('Waiting for dependencies...');
        await waitForDependencies();
        console.log('Dependencies loaded, loading widget script...');
        
        await loadScript("${widgetUrl}", "${websiteId}");
        console.log('Widget script loaded');

        // Wait for the widget script to execute and define ChatWidget
        const waitForWidget = () => new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 50;
          
          const check = () => {
            console.log('Checking for ChatWidget:', window.ChatWidget);
            if (window.ChatWidget && typeof window.ChatWidget.init === 'function') {
              resolve(window.ChatWidget);
            } else if (attempts >= maxAttempts) {
              reject(new Error('ChatWidget not found or invalid'));
            } else {
              attempts++;
              setTimeout(check, 100);
            }
          };
          
          check();
        });

        console.log('Waiting for ChatWidget to be available...');
        const widget = await waitForWidget();
        console.log('ChatWidget found, initializing...');
        await widget.init();
        console.log('Widget initialized successfully');
      } catch (error) {
        console.error('Widget initialization failed:', error);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeWidget);
    } else {
      initializeWidget();
    }
  })();
</script>
`
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Your Websites</h1>
        <button
          onClick={() => setShowNewWebsiteForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          Add Website
        </button>
      </div>

      {showNewWebsiteForm && (
        <div className="mb-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Add New Website</h2>
          <form onSubmit={handleCreateWebsite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Website Name
              </label>
              <input
                type="text"
                value={newWebsite.name}
                onChange={(e) =>
                  setNewWebsite((prev) => ({ ...prev, name: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Domain
              </label>
              <input
                type="text"
                value={newWebsite.domain}
                onChange={(e) =>
                  setNewWebsite((prev) => ({ ...prev, domain: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowNewWebsiteForm(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                Create Website
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {websites.map((website) => (
          <div
            key={website.id}
            className="bg-white rounded-lg shadow p-6 space-y-4"
          >
            <div>
              <h3 className="text-lg font-semibold">{website.name}</h3>
              <p className="text-gray-500">{website.domain}</p>
            </div>
            <button
              onClick={() => setSelectedWebsite(website)}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
            >
              Get Widget Code
            </button>
          </div>
        ))}
      </div>

      {selectedWebsite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-semibold mb-4">
              Widget Code for {selectedWebsite.name}
            </h2>
            <p className="mb-4 text-gray-600">
              Copy and paste this code into your website's HTML, just before the
              closing &lt;/body&gt; tag:
            </p>
            <div className="bg-gray-100 p-4 rounded-lg">
              <code className="text-sm">{getWidgetCode(selectedWebsite.id)}</code>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedWebsite(null)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 