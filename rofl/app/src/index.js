const express = require('express');
const WebSocket = require('ws');
require('dotenv').config();
const { sendNativeToken, startGame, checkStep } = require('./blockchain');

const app = express();
const server = app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', async (message) => {
    let response;
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);

      if (data.type === 'sendNativeToken' && data.toAddress && data.amount) {
        const result = await sendNativeToken(data.toAddress, data.amount);
        response = { type: 'transactionResult', ...result };
      } else if (data.type === 'startGame') {
        console.log("sarasa");
        const result = await startGame();
        response = { type: 'startGameResult', ...result };
      } else if (data.type === 'checkStep' && data.sessionCode && data.playerStep !== undefined) {
        const result = await checkStep(data.sessionCode, data.playerStep);
        response = { type: 'checkStepResult', ...result };
      } else {
        response = {
          type: 'error',
          message: 'Invalid request. Use {type: "sendNativeToken", toAddress, amount}, {type: "startGame"}, or {type: "checkStep", sessionCode, playerStep}',
        };
      }
    } catch (error) {
      response = { type: 'error', message: 'Invalid JSON or server error' };
    }
    ws.send(JSON.stringify(response));
  });

  ws.on('close', () => console.log('Client disconnected'));
});