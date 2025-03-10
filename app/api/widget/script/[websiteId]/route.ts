import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(
  request: Request,
  { params }: { params: { websiteId: string } }
) {
  const headersList = headers()
  const host = headersList.get('host')
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'

  const script = `
    (function() {
      // Create widget container
      const container = document.createElement('div');
      container.id = 'chat-support-widget';
      document.body.appendChild(container);

      // Add widget styles
      const styles = document.createElement('link');
      styles.rel = 'stylesheet';
      styles.href = '${protocol}://${host}/widget.css';
      document.head.appendChild(styles);

      // Load widget script
      const script = document.createElement('script');
      script.src = '${protocol}://${host}/widget.js';
      script.defer = true;
      script.onload = function() {
        window.ChatWidget.init('${params.websiteId}');
      };
      document.head.appendChild(script);
    })();
  `

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
} 