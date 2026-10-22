type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, controller: ReadableStreamDefaultController) {
    this.clients.set(id, { id, controller });
  }

  removeClient(id: string) {
    this.clients.delete(id);
  }

  broadcast(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(payload);

    const staleIds: string[] = [];
    this.clients.forEach((client) => {
      try {
        client.controller.enqueue(encoded);
      } catch (err) {
        staleIds.push(client.id);
      }
    });

    staleIds.forEach((id) => this.removeClient(id));
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// Preserve instance across Next.js dev server hot reloading
const globalForSSE = globalThis as unknown as { sseManager?: SSEManager };
export const sseManager = globalForSSE.sseManager || new SSEManager();
if (process.env.NODE_ENV !== 'production') {
  globalForSSE.sseManager = sseManager;
}

