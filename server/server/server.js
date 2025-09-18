const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Store connected users and chat rooms
const users = new Map();
const rooms = new Map();
const messages = new Map(); // Store messages for each room

// Default room
const DEFAULT_ROOM = 'general';
messages.set(DEFAULT_ROOM, []);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.keys());
  res.json({ rooms: roomList.length > 0 ? roomList : [DEFAULT_ROOM] });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('join', ({ username, room = DEFAULT_ROOM }) => {
    // Store user info
    users.set(socket.id, {
      id: socket.id,
      username: username,
      room: room,
      joinedAt: new Date()
    });

    // Join room
    socket.join(room);

    // Initialize room if it doesn't exist
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
      messages.set(room, []);
    }

    // Add user to room
    rooms.get(room).add(socket.id);

    // Send previous messages to the user
    const roomMessages = messages.get(room) || [];
    socket.emit('previousMessages', roomMessages);

    // Notify room about new user
    const joinMessage = {
      id: uuidv4(),
      type: 'system',
      message: `${username} joined the chat`,
      timestamp: new Date(),
      room: room
    };

    // Store and broadcast system message
    messages.get(room).push(joinMessage);
    io.to(room).emit('message', joinMessage);

    // Send updated user list to room
    const roomUsers = Array.from(rooms.get(room))
      .map(userId => users.get(userId))
      .filter(user => user);
    
    io.to(room).emit('userList', roomUsers);

    console.log(`${username} joined room: ${room}`);
  });

  // Handle new messages
  socket.on('sendMessage', ({ message, room = DEFAULT_ROOM }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const messageData = {
      id: uuidv4(),
      type: 'user',
      message: message,
      username: user.username,
      userId: socket.id,
      timestamp: new Date(),
      room: room
    };

    // Store message
    if (!messages.has(room)) {
      messages.set(room, []);
    }
    messages.get(room).push(messageData);

    // Keep only last 100 messages per room
    if (messages.get(room).length > 100) {
      messages.get(room).shift();
    }

    // Broadcast message to room
    io.to(room).emit('message', messageData);
    
    console.log(`Message from ${user.username} in ${room}: ${message}`);
  });

  // Handle typing indicators
  socket.on('typing', ({ room = DEFAULT_ROOM, isTyping }) => {
    const user = users.get(socket.id);
    if (!user) return;

    socket.to(room).emit('userTyping', {
      username: user.username,
      isTyping: isTyping
    });
  });

  // Handle room switching
  socket.on('switchRoom', ({ newRoom }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const oldRoom = user.room;
    
    // Leave old room
    socket.leave(oldRoom);
    if (rooms.has(oldRoom)) {
      rooms.get(oldRoom).delete(socket.id);
      
      // Send updated user list to old room
      const oldRoomUsers = Array.from(rooms.get(oldRoom))
        .map(userId => users.get(userId))
        .filter(u => u);
      io.to(oldRoom).emit('userList', oldRoomUsers);

      // Notify old room about user leaving
      const leaveMessage = {
        id: uuidv4(),
        type: 'system',
        message: `${user.username} left the chat`,
        timestamp: new Date(),
        room: oldRoom
      };
      messages.get(oldRoom).push(leaveMessage);
      io.to(oldRoom).emit('message', leaveMessage);
    }

    // Join new room
    socket.join(newRoom);
    user.room = newRoom;

    // Initialize new room if it doesn't exist
    if (!rooms.has(newRoom)) {
      rooms.set(newRoom, new Set());
      messages.set(newRoom, []);
    }

    rooms.get(newRoom).add(socket.id);

    // Send previous messages to the user
    const roomMessages = messages.get(newRoom) || [];
    socket.emit('previousMessages', roomMessages);

    // Notify new room about user joining
    const joinMessage = {
      id: uuidv4(),
      type: 'system',
      message: `${user.username} joined the chat`,
      timestamp: new Date(),
      room: newRoom
    };
    messages.get(newRoom).push(joinMessage);
    io.to(newRoom).emit('message', joinMessage);

    // Send updated user list to new room
    const newRoomUsers = Array.from(rooms.get(newRoom))
      .map(userId => users.get(userId))
      .filter(u => u);
    io.to(newRoom).emit('userList', newRoomUsers);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const { username, room } = user;
      
      // Remove user from room
      if (rooms.has(room)) {
        rooms.get(room).delete(socket.id);
        
        // Send updated user list
        const roomUsers = Array.from(rooms.get(room))
          .map(userId => users.get(userId))
          .filter(u => u);
        io.to(room).emit('userList', roomUsers);

        // Notify room about user leaving
        const leaveMessage = {
          id: uuidv4(),
          type: 'system',
          message: `${username} left the chat`,
          timestamp: new Date(),
          room: room
        };
        
        if (messages.has(room)) {
          messages.get(room).push(leaveMessage);
        }
        io.to(room).emit('message', leaveMessage);
      }
      
      // Remove user from users map
      users.delete(socket.id);
      
      console.log(`User disconnected: ${username}`);
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
});
