// Simple WebSocket signaling server for local network
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });
const os = require('os');
const http = require('http');

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

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'Unknown';
}

// HTTP server to serve IP address
const ipServer = http.createServer((req, res) => {
  if (req.url === '/ip') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ip: getLocalIP() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
ipServer.listen(3001, () => {
  console.log('IP server running on http://0.0.0.0:3001/ip');
});

try {
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
} catch (err) {
  console.error('Failed to start signaling server:', err.message);
} 
