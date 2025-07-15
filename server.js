// Simple WebSocket signaling server for local network
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

let clients = [];
let userCount = 0;

function broadcastUserList() {
  const userList = clients.map(c => c.username || 'User');
  const msg = JSON.stringify({ type: 'userlist', users: userList });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', function connection(ws) {
  ws.id = ++userCount;
  ws.username = `User ${ws.id}`;
  clients.push(ws);

  ws.on('message', function incoming(message) {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }
    if (data.type === 'join' && data.username) {
      ws.username = data.username;
      broadcastUserList();
      return;
    }
    // Relay message to the other client(s)
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
    broadcastUserList();
  });
  broadcastUserList();
});

console.log('Signaling server running on ws://0.0.0.0:3000'); 
