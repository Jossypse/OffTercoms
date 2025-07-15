// Simple WebSocket signaling server for local network
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

let clients = [];

wss.on('connection', function connection(ws) {
  clients.push(ws);
  ws.on('message', function incoming(message) {
    // Relay message to the other client
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

console.log('Signaling server running on ws://0.0.0.0:3000'); 