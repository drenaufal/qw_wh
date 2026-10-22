import { NextRequest } from 'next/server';
import { sseManager } from '@/lib/sse';


export async function GET(req: NextRequest) {
  const clientId = crypto.randomUUID();
  let heartbeatInterval: NodeJS.Timeout;

  const stream = new ReadableStream({
    start(controller) {
      sseManager.addClient(clientId, controller);

      // Initial handshake event
      try {
        controller.enqueue(
          new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`)
        );
      } catch {
        // ignore
      }

      // Heartbeat ping every 30 seconds to prevent proxy / load balancer disconnect
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
          sseManager.removeClient(clientId);
        }
      }, 30000);
    },
    cancel() {
      clearInterval(heartbeatInterval);
      sseManager.removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
