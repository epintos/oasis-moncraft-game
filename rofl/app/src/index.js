const express = require('express');
const WebSocket = require('ws');
require('dotenv').config();

const {
  startGame,
  checkStep,
  getSession,
  saveGame,
  captureMonster,
  releaseMonster,
} = require('./blockchain');

const app = express();
const server = app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.session = {
    sessionCode: null,
    sessionId: null,
    playerStep: 0,
  };

  ws.on('message', async (message) => {
    let response;
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
  
      if (data.type === 'startGame') {
        const result = await startGame();
        console.log('Start game result:', result);
        if (result.success) {
          ws.session.sessionCode = result.sessionCode;
          ws.session.sessionId = result.sessionId;
          ws.session.playerStep = 0;
        }
        response = { type: 'startGameResult', ...result };
  
      } else if (data.type === 'loadGame' && data.sessionCode) {
        const result = await getSession(data.sessionCode);
        console.log('Load game result:', result);
        if (result.success) {
          ws.session.sessionCode = result.sessionCode;
          ws.session.sessionId = result.sessionId;
          ws.session.playerStep = result.currentStep;
        }
        response = { type: 'loadGameResult', ...result };
  
      } else if (['saveGame', 'captureMonster', 'releaseMonster'].includes(data.type)) {
        const sessionCode = data.sessionCode ?? ws.session.sessionCode;
        if (!sessionCode) throw new Error("Missing sessionCode");
  
        const sessionData = await getSession(sessionCode);
        if (!sessionData.success) throw new Error("Failed to fetch session");
  
        const session = {
          sessionCode,
          sessionId: sessionData.sessionId,
        };
  
        if (data.type === 'saveGame') {
          response = await saveGame(sessionCode, ws.session.playerStep, session.sessionId);
          response.type = 'saveGameResult';
  
        } else if (data.type === 'captureMonster') {
          response = await captureMonster(session, data.monsterIndex, ws.session.playerStep);
          response.type = 'captureMonsterResult';
  
        } else if (data.type === 'releaseMonster') {
          response = await releaseMonster(session, data.tokenId);
          response.type = 'releaseMonsterResult';
        }
  
      } else if (data.type === 'checkStep') {
        const sessionCode = ws.session.sessionCode;
        const playerStep = ws.session.playerStep;
        const result = await checkStep(sessionCode, playerStep);
        if (result.success) ws.session.playerStep++;
        response = { type: 'checkStepResult', ...result };
  
      } else {
        response = { type: 'error', message: 'Unknown or invalid message type' };
      }
  
    } catch (err) {
      console.error('Message handling error:', err);
      response = {
        type: 'error',
        message: err.message || 'Invalid JSON or server error',
      };
    }
  
    ws.send(JSON.stringify(response, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  });  

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});
