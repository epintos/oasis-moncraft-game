const express = require('express');
const WebSocket = require('ws');
require('dotenv').config();
const { startGame, checkStep, getSession, saveGame, captureMonster, getCapturedMonsters } = require('./blockchain');

const app = express();
const server = app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');
  
    // store session state for this socket
    ws.session = {
      sessionCode: null,
      playerStep: 0,
    };
  
    ws.on('message', async (message) => {
      let response;
      try {
        const data = JSON.parse(message.toString());
        console.log('Received:', data);
  
        if (data.type === 'startGame') {
          const result = await startGame();
          if (result.success) {
            ws.session.sessionCode = result.sessionCode;
            ws.session.playerStep = 0;
          }
          response = { type: 'startGameResult', ...result };
  
        }  else if (data.type === 'loadGame' && data.sessionCode) {
            const result = await getSession(data.sessionCode);
            if (result.success) {
              ws.session.sessionCode = result.sessionCode;
              ws.session.playerStep = result.currentStep;
            }
            response = { type: 'loadGameResult', ...result };

        } else if (data.type === 'checkStep') {
          const { sessionCode, playerStep } = ws.session;
          const result = await checkStep(sessionCode, playerStep);
          if (result.success) {
            ws.session.playerStep += 1; // increment if successful move
          }
          response = { type: 'checkStepResult', ...result };
  
        } else if (data.type === 'saveGame') {
          const result = await saveGame(ws.session.sessionCode, ws.session.playerStep);
          response = { type: 'saveGameResult', ...result };
  
        } else if (data.type === 'captureMonster') {
          const result = await captureMonster(ws.session.sessionCode, data.monsterIndex, ws.session.playerStep);
          response = { type: 'captureMonsterResult', ...result };
  
        } else {
          response = {
            type: 'error',
            message: 'Unknown or invalid message type',
          };
        }
      } catch (err) {
        response = {
          type: 'error',
          message: 'Invalid JSON or server error',
        };
      }
  
      ws.send(JSON.stringify(response));
    });
  
    ws.on('close', () => console.log('Client disconnected'));
  });
  