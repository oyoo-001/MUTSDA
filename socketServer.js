const http = require('http');
const { Server } = require("socket.io");

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"]
  }
});

let broadcasters = {};
const activeStreams = new Set();
const streamViewers = {}; // Track viewers per stream: { streamId: Set(socketId) }

io.on("connection", (socket) => {
  // Immediately inform the new client about current live streams
  socket.emit('live_streams_update', Array.from(activeStreams));
  
  socket.on("broadcaster", (streamId) => {
    broadcasters[streamId] = socket.id;
    activeStreams.add(streamId);
    io.emit('live_streams_update', Array.from(activeStreams)); // Inform everyone of the new live stream
    socket.broadcast.emit("broadcaster", streamId); // For watchers to initiate connection
  });

  socket.on("watcher", (streamId) => {
    const broadcasterId = broadcasters[streamId];
    if (broadcasterId) {
      // Track viewer
      if (!streamViewers[streamId]) streamViewers[streamId] = new Set();
      streamViewers[streamId].add(socket.id);
      
      io.to(broadcasterId).emit("viewer_count", streamViewers[streamId].size);
      socket.to(broadcasterId).emit("watcher", socket.id);
    }
  });

  socket.on("offer", (id, message) => {
    socket.to(id).emit("offer", socket.id, message);
  });

  socket.on("answer", (id, message) => {
    socket.to(id).emit("answer", socket.id, message);
  });

  socket.on("candidate", (id, message) => {
    socket.to(id).emit("candidate", socket.id, message);
  });

  socket.on("disconnect", () => {
    // Check if the disconnecting socket was a broadcaster
    for (const streamId in broadcasters) {
      if (broadcasters[streamId] === socket.id) {
        delete broadcasters[streamId];
        activeStreams.delete(streamId);
        io.emit('live_streams_update', Array.from(activeStreams)); // Inform everyone that a stream has ended
        if (streamViewers[streamId]) delete streamViewers[streamId];
        break;
      }
    }

    // Check if the disconnecting socket was a viewer
    for (const streamId in streamViewers) {
      if (streamViewers[streamId].has(socket.id)) {
        streamViewers[streamId].delete(socket.id);
        const broadcasterId = broadcasters[streamId];
        if (broadcasterId) {
          io.to(broadcasterId).emit("viewer_count", streamViewers[streamId].size);
        }
      }
    }
    socket.broadcast.emit("disconnectPeer", socket.id);
  });
});

const PORT = 4000;
server.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));