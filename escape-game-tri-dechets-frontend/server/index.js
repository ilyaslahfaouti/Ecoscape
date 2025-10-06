import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors({ origin: true, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

// In-memory game state
const indicesFound = new Set(); // positions (indices) found globally
const sortedItems = new Set();  // itemIds that have been sorted (removed)
const binsRevealed = new Set(); // binIds that have revealed their code digit

io.on('connection', (socket) => {
  // send current state to the new client
  socket.emit('letters:init', Array.from(indicesFound));
  socket.emit('items:init', Array.from(sortedItems));
  socket.emit('bins:init', Array.from(binsRevealed));

  socket.on('letters:hello', () => {
    socket.emit('letters:update', Array.from(indicesFound));
    socket.emit('items:update', Array.from(sortedItems));
    socket.emit('bins:update', Array.from(binsRevealed));
  });

  socket.on('letter:found', (index) => {
    const num = Number(index);
    if (!Number.isInteger(num)) return;
    const before = indicesFound.size;
    indicesFound.add(num);
    if (indicesFound.size !== before) {
      io.emit('letter:found', num);
      io.emit('letters:update', Array.from(indicesFound));
    }
  });

  socket.on('item:sorted', (itemId) => {
    const id = String(itemId || '').trim();
    if (!id) return;
    const before = sortedItems.size;
    sortedItems.add(id);
    if (sortedItems.size !== before) {
      io.emit('item:sorted', id);
      io.emit('items:update', Array.from(sortedItems));
    }
  });

  socket.on('treasure:unlock', () => {
    io.emit('treasure:unlock');
  });

  socket.on('bin:revealed', (binId) => {
    const id = String(binId || '').trim();
    if (!id) return;
    const before = binsRevealed.size;
    binsRevealed.add(id);
    if (binsRevealed.size !== before) {
      io.emit('bin:revealed', id);
      io.emit('bins:update', Array.from(binsRevealed));
    }
  });
});

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'escape-game-tri-dechets-socket', indices: Array.from(indicesFound) });
});

server.listen(PORT, () => {
  console.log(`[server] Socket.io listening on :${PORT}`);
});


