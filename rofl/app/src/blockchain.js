const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();
const path = require('path');

const monCraftAbiPath = path.join(__dirname, 'abis/MonCraft.json');
const monCraftAbi = JSON.parse(fs.readFileSync(monCraftAbiPath, 'utf8'));

const monsterNFTAbiPath = path.join(__dirname, 'abis/MonsterNFT.json');
const monsterNFTAbi = JSON.parse(fs.readFileSync(monsterNFTAbiPath, 'utf8'));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const monCraft = new ethers.Contract(process.env.CONTRACT_ADDRESS, monCraftAbi, wallet);
const monsterNFT = new ethers.Contract(process.env.NFT_CONTRACT_ADDRESS, monsterNFTAbi, wallet);

const accessCode = process.env.ROFL_ACCESS_CODE;

const eventBuffers = {
  MonsterCaptured: [],
  StepsSynced: [],
  MonsterReleased: [],
  PlayerJoinedFight: [],
};

monCraft.on('MonsterCaptured', (sessionId, tokenId, captured, event) => {
  eventBuffers.MonsterCaptured.push({
    sessionId: sessionId.toString(),
    captured,
    event,
  });
});

monCraft.on('StepsSynced', (sessionId, currentStep, event) => {
  eventBuffers.StepsSynced.push({
    sessionId: sessionId.toString(),
    currentStep,
    event,
  });
});

monCraft.on('MonsterReleased', (sessionId, tokenId, event) => {
  eventBuffers.MonsterReleased.push({
    sessionId: sessionId.toString(),
    tokenId,
    event,
  });
});

monCraft.on('PlayerJoinedFight', (fightId, sessionId, playerNumber) => {
  eventBuffers.PlayerJoinedFight.push({
    fightId: fightId.toString(),
    sessionId: sessionId.toString(),
    playerNumber: playerNumber.toString(),
  });
});

function waitForEvent(eventType, sessionId, timeout = 30000) {
  if (!sessionId) {
    return Promise.reject(new Error(`Invalid or missing sessionId for event ${eventType}`));
  }

  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const idx = eventBuffers[eventType].findIndex(
        e => e.sessionId === sessionId.toString()
      );

      if (idx !== -1) {
        const evt = eventBuffers[eventType].splice(idx, 1)[0];
        return resolve(evt);
      }

      if (Date.now() - start > timeout) {
        return reject(new Error(`Timed out waiting for ${eventType} for session ${sessionId}`));
      }

      setTimeout(check, 500);
    };

    check();
  });
}

async function startGame() {
  try {
    console.log("monCraft.startGame(accessCode): ", { accessCode });
    const tx = await monCraft.startGame(accessCode);
    console.log("Transaction sent: ", tx.hash);
        
    const receipt = await tx.wait();
    console.log("Transaction mined: ", receipt.transactionHash);

    let sessionId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = monCraft.interface.parseLog(log);
        if (parsed.name === 'NewSession') {
          sessionId = parsed.args.sessionId.toString();
          break;
        }
      } catch { /* skip */ }
    }

    if (!sessionId) throw new Error("NewSession event not found");

    console.log("monCraft.getSessionCode(sessionId, accessCode)", { sessionId, accessCode });
    const sessionCode = await monCraft.getSessionCode(sessionId, accessCode);
    console.log("Session code: ", sessionCode);
    console.log("\n\n\n");

    return {
      success: true,
      sessionCode,
      sessionId,
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
    console.log("monCraft.getSessionInformation(sessionCode, accessCode)", { sessionCode, accessCode });
    const result = await monCraft.getSessionInformation(sessionCode, accessCode);
    const status = result[0];
    const currentStep = result[1];
    const monstersTokenIds = result[2].map(m => m.toString());
    const sessionId = result[3].toString();
    console.log("Session information: ", { status, currentStep, monstersTokenIds, sessionId });
    
    const monstersMap = await Promise.all(
      monstersTokenIds.map(async (m) => {
        console.log("monsterNFT.s_monsters(m.toString())", { m });
        const monster = await monsterNFT.s_monsters(m.toString());
        // console.log("Monster: ", monster);
        return {
          uri: monster[1],
          name: monster[0],
          tokenId: m.toString(),
        };
      })
    );
    console.log("\n\n\n");
    
    if (status.toString() !== "1") throw new Error('Session is not in progress');

    return {
      success: true,
      sessionCode,
      currentStep: Number(currentStep),
      sessionId: sessionId.toString(),
      monsters: monstersMap,
      message: `Loaded session ${sessionCode}`,
    };
  } catch (error) {
    console.error('getSession failed:', error);
    return { success: false, message: error.message };
  }
}

async function checkStep(sessionCode, playerStep) {
  try {
    console.log("monCraft.checkStep(sessionCode, playerStep, accessCode)", { sessionCode, playerStep, accessCode });
    const [monsterIndex, hasAppeared] = await monCraft.checkStep(sessionCode, playerStep, accessCode);
    console.log("Check step result: ", { monsterIndex, hasAppeared });
    console.log("\n\n\n");

    return {
      success: true,
      sessionCode,
      playerStep,
      monsterIndex: monsterIndex.toString(),
      hasAppeared,
      message: hasAppeared
        ? `Monster ${monsterIndex} appeared at step ${playerStep}`
        : `No monster appeared at step ${playerStep}`,
    };
  } catch (error) {
    console.error('Check step failed:', error);
    return { success: false, message: error.message };
  }
}

async function saveGame(sessionCode, currentStep, sessionId) {
  try {
    console.log("monCraft.syncCurrentStep(sessionCode, currentStep, accessCode)", { sessionCode, currentStep, accessCode });
    const tx = await monCraft.syncCurrentStep(sessionCode, currentStep, accessCode);
    console.log("Transaction sent: ", tx.hash);
    const eventPromise = await waitForEvent("StepsSynced", sessionId);
    const receipt = await tx.wait();
    console.log("Transaction mined: ", receipt.transactionHash);
    const event = await eventPromise;


    return {
      success: true,
      transactionHash: receipt.hash,
      message: `Game saved at step ${event.currentStep}`,
    };
  } catch (error) {
    console.error('Save game failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async function captureMonster(session, monsterIndex, currentStep) {
  const { sessionCode, sessionId } = session;

  try {
    console.log("monCraft.captureMonster(sessionCode, monsterIndex, currentStep, accessCode)", { sessionCode, monsterIndex, currentStep, accessCode });
    const tx = await monCraft.captureMonster(sessionCode, monsterIndex, currentStep, accessCode);
    console.log("Transaction sent: ", tx.hash);
    const eventPromise = await waitForEvent('MonsterCaptured', sessionId);
    await tx.wait();
    console.log("Transaction mined: ", tx.hash);
    console.log("\n\n\n");

    const { captured } = await eventPromise;

    return {
      success: true,
      transactionHash: tx.hash,
      captured,
      message: captured
        ? `🎉 Monster ${monsterIndex} captured!`
        : `❌ Monster ${monsterIndex} escaped.`,
    };
  } catch (error) {
    console.error('Capture monster failed:', error);

    return {
      success: true,
      transactionHash: null,
      captured: false,
      message: `❌ Monster ${monsterIndex} escaped.`,
    };
  }
}

async function releaseMonster(session, tokenId) {
  const { sessionCode, sessionId } = session;

  try {
    console.log("monCraft.releaseMonster(sessionCode, tokenId, accessCode)", { sessionCode, tokenId, accessCode });
    const tx = await monCraft.releaseMonster(sessionCode, tokenId, accessCode);
    console.log("Transaction sent: ", tx.hash);
    const eventPromise = await waitForEvent("MonsterReleased", sessionId);
    await tx.wait();
    console.log("Transaction mined: ", tx.hash);
    const event = await eventPromise;
    console.log("\n\n\n");

    return {
      success: true,
      transactionHash: event.event.transactionHash,
      message: `Monster with tokenId ${tokenId} was released.`,
    };
  } catch (error) {
    console.error('Release monster failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async function joinFight(fightId, sessionCode, tokenId, sessionId) {
  try {
    console.log("monCraft.joinFight(fightId, sessionCode, tokenId, accessCode)", { fightId, sessionCode, tokenId, accessCode });
    const tx = await monCraft.joinFight(fightId, sessionCode, tokenId, accessCode);
    console.log("Transaction sent: ", tx.hash);
    const eventPromise = await waitForEvent("PlayerJoinedFight", sessionId);
    const receipt = await tx.wait();
    console.log("Transaction mined: ", receipt.transactionHash);
    const event = await eventPromise;

    console.log("monCraft.getFightInformation(fightId, accessCode)", { fightId, accessCode });
    const [
      monsterOneTokenId,
      monsterTwoTokenId,
      status,
      sessionCodeOne,
      sessionCodeTwo,
    ] = await monCraft.getFightInformation(fightId, accessCode);
    console.log("Fight information: ", { monsterOneTokenId, monsterTwoTokenId, status, sessionCodeOne, sessionCodeTwo });

    let winner, winnerHPLeft;
    
    if (status.toString() === "2") { // FightStatus.READY
      const monster1 = await monsterNFT.s_monsters(monsterOneTokenId);
      const monster2 = await monsterNFT.s_monsters(monsterTwoTokenId);

      let currentHp1 = monster1.currentHP;
      let currentHp2 = monster2.currentHP;

      while (currentHp1 > 0 && currentHp2 > 0) {
        const [damage1, damage2] = await monCraft.getFightDamage(fightId, accessCode);

        currentHp1 -= damage2;
        currentHp2 -= damage1;

        if (currentHp1 < 0) currentHp1 = 0;
        if (currentHp2 < 0) currentHp2 = 0;
      }

      if (currentHp1 > 0) {
        winner = sessionCodeOne;
        winnerHPLeft = currentHp1;
      } else {
        winner = sessionCodeTwo;
        winnerHPLeft = currentHp2;
      }

      console.log("monCraft.syncFight(fightId, winner, winnerHPLeft, accessCode)", { fightId, winner, winnerHPLeft, accessCode });
      const syncTx = await monCraft.syncFight(fightId, winner, winnerHPLeft.toString(), accessCode);
      console.log("Transaction sent: ", syncTx.hash);
      await syncTx.wait();
      console.log("Transaction mined: ", syncTx.hash);
      console.log("\n\n\n");

    }

    return {
      success: true,
      transactionHash: receipt.hash,
      sessionId: event.sessionId,
      fightId: fightId,
      player: event.playerNumber,
      won: winner == sessionCode,
      status: status.toString(),
      message: `Joined fight with monster ${tokenId}`,
    };
  } catch (error) {
    console.error('Join fight failed:', error);
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
  captureMonster,
  releaseMonster,
  joinFight
};
