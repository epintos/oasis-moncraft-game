const express = require('express');
const cors = require('cors'); // Add CORS for client-server communication
require('dotenv').config();

const {
  startGame,
  checkStep,
  getSession,
  saveGame,
  captureMonster,
  releaseMonster,
  joinFight,
} = require('./blockchain');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow only this origin
  methods: ['GET', 'POST'], // Allow these methods
  allowedHeaders: ['Content-Type'], // Allow these headers
}));
app.use(express.json()); // Parse JSON bodies

// Helper function to handle BigInt serialization
const serializeResponse = (data) => JSON.stringify(data, (_, value) =>
  typeof value === 'bigint' ? value.toString() : value
);

// Routes
app.post('/startGame', async (req, res) => {
  try {
    const result = await startGame();
    res.status(200).send(serializeResponse({ type: 'startGameResult', ...result }));
  } catch (err) {
    console.error('startGame error:', err);
    res.status(500).send(serializeResponse({
      type: 'error',
      message: err.message || 'Server error',
    }));
  }
});

app.post('/loadGame', async (req, res) => {
  const { sessionCode } = req.body;
  if (!sessionCode) {
    return res.status(400).send(serializeResponse({
      type: 'error',
      message: 'Missing sessionCode',
    }));
  }
  try {
    const result = await getSession(sessionCode);
    res.status(200).send(serializeResponse({ type: 'loadGameResult', ...result }));
  } catch (err) {
    console.error('loadGame error:', err);
    res.status(500).send(serializeResponse({
      type: 'error',
      message: err.message || 'Server error',
    }));
  }
});

app.post('/saveGame', async (req, res) => {
  const { sessionCode, currentStep } = req.body;
  if (!sessionCode) {
    return res.status(400).send(serializeResponse({
      type: 'error',
      message: 'Missing sessionCode',
    }));
  }
  try {
    const sessionData = await getSession(sessionCode);
    if (!sessionData.success) throw new Error('Failed to fetch session');
    const result = await saveGame(sessionCode, currentStep, sessionData.sessionId);
    res.status(200).send(serializeResponse({ type: 'saveGameResult', ...result }));
  } catch (err) {
    console.error('saveGame error:', err);
    res.status(500).send(serializeResponse({
      type: 'error',
      message: err.message || 'Server error',
    }));
  }
});

app.post('/checkStep', async (req, res) => {
  const { sessionCode, playerStep } = req.body;
  if (!sessionCode) {
    return res.status(400).send(serializeResponse({
      type: 'error',
      message: 'Missing sessionCode',
    }));
  }
  try {
    const result = await checkStep(sessionCode, playerStep);
    res.status(200).send(serializeResponse({ type: 'checkStepResult', ...result }));
  } catch (err) {
    console.error('checkStep error:', err);
    res.status(500).send(serializeResponse({
      type: 'error',
      message: err.message || 'Server error',
    }));
  }
});

app.post('/captureMonster', async (req, res) => {
  const { sessionCode, monsterIndex, currentStep } = req.body;
  if (!sessionCode || monsterIndex === undefined) {
    return res.status(400).send(serializeResponse({
      type: 'error',
      message: 'Missing sessionCode or monsterIndex',
    }));
  }
  try {
    const sessionData = await getSession(sessionCode);
    if (!sessionData.success) throw new Error('Failed to fetch session');
    const session = { sessionCode, sessionId: sessionData.sessionId };
    const result = await captureMonster(session, monsterIndex, currentStep);
    res.status(200).send(serializeResponse({ type: 'captureMonsterResult', ...result }));
  } catch (err) {
    console.error('captureMonster error:', err);
    res.status(500).send(serializeResponse({
      type: 'error',
      message: err.message || 'Server error',
    }));
  }
});

app.post('/releaseMonster', async (req, res) => {
  const { sessionCode, tokenId } = req.body;
  if (!sessionCode || tokenId === undefined) {
    return res.status(400).send(serializeResponse({
      type: 'error',
      message: 'Missing sessionCode or tokenId',
    }));
  }
  try {
    const sessionData = await getSession(sessionCode);
    if (!sessionData.success) throw new Error('Failed to fetch session');
    const session = { sessionCode, sessionId: sessionData.sessionId };
    const result = await releaseMonster(session, tokenId);
    res.status(200).send(serializeResponse({ type: 'releaseMonsterResult', ...result }));
  } catch (err) {
    console.error('releaseMonster error:', err);
    res.status(500).send(serializeResponse({
      type: 'error',
      message: err.message || 'Server error',
    }));
  }
});

app.post('/joinFight', async (req, res) => {
  const { sessionCode, sessionId, tokenId, fightId } = req.body;
  if (!sessionCode || fightId === undefined) {
    return res.status(400).send(serializeResponse({
      type: 'error',
      message: 'Missing sessionCode or fightId',
    }));
  }
  try {
    const result = await joinFight(fightId, sessionCode, tokenId, sessionId);
    res.status(200).send(serializeResponse({ type: 'joinFightResult', ...result }));
  } catch (err) {
    console.error('joinFight error:', err);
    res.status(500).send(serializeResponse({
      type: 'error',
      message: err.message || 'Server error',
    }));
  }
});

// Start server
app.listen(process.env.PORT, '0.0.0.0', () =>
  console.log(`Server running on 0.0.0.0:${process.env.PORT}`)
);