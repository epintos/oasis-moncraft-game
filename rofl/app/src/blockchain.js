const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

const path = require('path');
const monCraftAbiPath = path.join(__dirname, 'abis/MonCraft.json');
const monCraftAbi = JSON.parse(fs.readFileSync(monCraftAbiPath, 'utf8'));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const monCraft = new ethers.Contract(process.env.CONTRACT_ADDRESS, monCraftAbi, wallet);

const accessCode = process.env.ROFL_ACCESS_CODE;

async function startGame() {
  try {
    const tx = await monCraft.startGame(accessCode);
    const receipt = await tx.wait();
    
    let sessionId = null;
    
    for (const log of receipt.logs) {
      try {
        const parsed = monCraft.interface.parseLog(log);
        if (parsed.name === 'NewSession') {
          sessionId = parsed.args.sessionId.toString();
          break;
        }
      } catch {
        // Not our log, skip
      }
    }

    const sessionCode = await monCraft.getSessionCode(sessionId, accessCode);

    if (!sessionCode) {
      throw new Error("NewSession event not found");
    }

    return {
      success: true,
      sessionCode,
      message: `Started game with session code: ${sessionCode}`,
    };
  } catch (error) {
    console.error('Start game failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async function getSession(sessionCode) {
  try {
    const [status, currentStep, monstersTokenIds] = await monCraft.getSessionInformation(sessionCode, accessCode);

    const statusInProgress = "1";
    console.log('Session status:', status.toString());

    if (status.toString() !== statusInProgress) {
      throw new Error('Session is not in progress');
    }

    return {
      success: true,
      sessionCode,
      currentStep: Number(currentStep),
      monsters: monstersTokenIds.map((m) => m.toString()),
      message: `Loaded session ${sessionCode}`,
    };
  } catch (error) {
    console.error('getSession failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async function startGame() {
  try {
    const tx = await monCraft.startGame(accessCode);
    const receipt = await tx.wait();
    
    let sessionId = null;

    for (const log of receipt.logs) {
      try {
        const parsed = monCraft.interface.parseLog(log);
        if (parsed.name === 'NewSession') {
          sessionId = parsed.args.sessionId.toString();
          break;
        }
      } catch {
        // Not our log, skip
      }
    }

    const sessionCode = await monCraft.getSessionCode(sessionId, accessCode);

    if (!sessionCode) {
      throw new Error("NewSession event not found");
    }

    return {
      success: true,
      sessionCode,
      message: `Started game with session code: ${sessionCode}`,
    };
  } catch (error) {
    console.error('Start game failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async function checkStep(sessionCode, playerStep) {
  try {
    const [monsterIndex, hasAppeared] = await monCraft.checkStep(sessionCode, playerStep, accessCode);
    return {
      success: true,
      monsterIndex: monsterIndex.toString(),
      hasAppeared,
      message: hasAppeared
        ? `Monster ${monsterIndex} appeared at step ${playerStep}`
        : `No monster appeared at step ${playerStep}`,
    };
  } catch (error) {
    console.error('Check step failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async function saveGame(sessionCode, currentStep) {
  try {
    const tx = await monCraft.syncCurrentStep(sessionCode, currentStep, accessCode);
    const receipt = await tx.wait();

    return {
      success: true,
      transactionHash: receipt.hash,
      message: `Game saved at step ${currentStep}`,
    };
  } catch (error) {
    console.error('Save game failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async function captureMonster(sessionCode, monsterIndex, currentStep) {
  try {
    const tx = await monCraft.captureMonster(sessionCode, monsterIndex, currentStep, accessCode);
    const receipt = await tx.wait();

    let captured = null;

    for (const log of receipt.logs) {
      try {
        const parsed = monCraft.interface.parseLog(log);
        if (parsed.name === 'MonsterCaptured') {
          captured = parsed.args.captured;
          break;
        }
      } catch {
        // skip unrelated logs
      }
    }

    return {
      success: true,
      transactionHash: receipt.hash,
      captured,
      message: captured === true
        ? `🎉 Monster ${monsterIndex} captured!`
        : `❌ Monster ${monsterIndex} escaped.`,
    };
  } catch (error) {
    console.error('Capture monster failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

module.exports = {
  startGame,
  checkStep,
  getSession,
  saveGame,
  captureMonster
};