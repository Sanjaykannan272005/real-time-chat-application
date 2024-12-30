// Server-side (Node.js + Express + WebSocket)
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected users and room data
let users = {};
let chatHistory = {}; // Stores chat history by room
let userPresence = {}; // Tracks user presence

// Broadcast function
function broadcast(room, message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.room === room) {
      client.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('New connection established');

  ws.on('message', (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'login':
        // Handle user login
        users[message.userId] = ws;
        ws.userId = message.userId;
        userPresence[message.userId] = 'online';
        break;

      case 'create_room':
        // Handle room creation
        ws.room = message.roomId;
        chatHistory[message.roomId] = chatHistory[message.roomId] || [];
        ws.send(JSON.stringify({
          type: 'room_created',
          roomId: message.roomId,
        }));
        break;

      case 'join_room':
        // Join a chat room
        ws.room = message.roomId;
        chatHistory[message.roomId] = chatHistory[message.roomId] || [];
        ws.send(JSON.stringify({
          type: 'chat_history',
          history: chatHistory[message.roomId],
        }));
        broadcast(message.roomId, {
          type: 'notification',
          content: `${message.userId} joined the room.`,
        });
        break;

      case 'send_message':
        // Broadcast message to room and save to chat history
        const msg = {
          type: 'message',
          userId: message.userId,
          content: message.content,
        };
        chatHistory[ws.room].push(msg);
        broadcast(ws.room, msg);
        break;

      case 'send_file':
        // Broadcast file to room
        const fileMsg = {
          type: 'file',
          userId: message.userId,
          fileName: message.fileName,
          fileContent: message.fileContent,
        };
        broadcast(ws.room, fileMsg);
        break;

      case 'private_message':
        // Send private message
        const recipient = users[message.recipientId];
        if (recipient && recipient.readyState === WebSocket.OPEN) {
          recipient.send(
            JSON.stringify({
              type: 'private_message',
              userId: message.userId,
              content: message.content,
            })
          );
        }
        break;

      case 'leave_room':
        // Leave the room
        if (ws.room) {
          broadcast(ws.room, {
            type: 'notification',
            content: `${message.userId} left the room.`,
          });
          delete ws.room;
        }
        break;

      default:
        console.error('Unknown message type:', message.type);
    }
  });

  ws.on('close', () => {
    console.log('Connection closed');
    userPresence[ws.userId] = 'offline';
    delete users[ws.userId];
  });
});

// Serve static files (frontend)
app.use(express.static('public'));

// Start server
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});