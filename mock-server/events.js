const clients = new Set();

export function addClient(res) {
  clients.add(res);
  res.on("close", () => clients.delete(res));
  res.on("error", () => clients.delete(res));
}

export function broadcast(type, payload) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(payload || {})}\n\n`;
  for (const client of clients) {
    try {
      client.write(msg);
    } catch {
      clients.delete(client);
    }
  }
}

export function clientCount() {
  return clients.size;
}
