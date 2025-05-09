const express = require('express');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();
const { sendNativeToken } = require('./blockchain');

const app = express();
const server = app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'frontend')));

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', async (message) => {
    let response;
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);

      // Handle sendNativeToken request
      if (data.type === 'sendNativeToken' && data.toAddress && data.amount) {
        const result = await sendNativeToken(data.toAddress, data.amount);
        response = { type: 'transactionResult', ...result };
      } else {
        response = {
          type: 'error',
          message: 'Invalid request. Use {type: "sendNativeToken", toAddress, amount}',
        };
      }
    } catch (error) {
      response = { type: 'error', message: 'Invalid JSON or server error' };
    }
    ws.send(JSON.stringify(response));
  });

  ws.on('close', () => console.log('Client disconnected'));
});