const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

const path = require('path');
const monCraftAbiPath = path.join(__dirname, 'abis/MonCraft.json');
const monCraftAbi = JSON.parse(fs.readFileSync(monCraftAbiPath, 'utf8'));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const monCraft = new ethers.Contract(process.env.CONTRACT_ADDRESS, monCraftAbi, wallet);

async function getSession(sessionCode) {
  try {
    const session = await monCraft.s_codeSessions(sessionCode);
    const monsters = await monCraft.getMonstersTokenIds(sessionCode);

    console.log(session);
    const statusInProgress = "1";
    console.log('Session status:', session.status.toString());

    if (session.status.toString() !== statusInProgress) {
      throw new Error('Session is not in progress');
    }

    return {
      success: true,
      sessionCode,
      currentStep: Number(session.currentStep),
      monsters: monsters.map((m) => m.toString()),
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

async function sendNativeToken(toAddress, amountInEther) {
  try {
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amountInEther),
    });
    const receipt = await tx.wait();
    return {
      success: true,
      transactionHash: receipt.hash,
      message: `Sent ${amountInEther} ETH to ${toAddress}`,
    };
  } catch (error) {
    console.error('Transaction failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async function startGame() {
  try {
    const tx = await monCraft.startGame();
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction receipt:', receipt);

    let sessionCode = null;

    for (const log of receipt.logs) {
      try {
        const parsed = monCraft.interface.parseLog(log);
        if (parsed.name === 'NewSession') {
          // Extract sessionCode from topics[1] (bytes32)
          sessionCode = parsed.args.sessionCode;
          break;
        }
      } catch {
        // Not our log, skip
      }
    }

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
    const [monsterIndex, hasAppeared] = await monCraft.checkStep(sessionCode, playerStep);
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
    const tx = await monCraft.syncCurrentStep(sessionCode, currentStep);
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
    const tx = await monCraft.captureMonster(sessionCode, monsterIndex, currentStep);
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

async function getCapturedMonsters(sessionCode) {
  try {
    const monsters = await monCraft.getMonstersTokenIds(sessionCode);
    console.log("session.monstersTokenIds:", session.monstersTokenIds);
    console.log('Captured monsters:', monsters);

    return {
      success: true,
      monsters,
    };
  } catch (error) {
    console.error('getCapturedMonsters failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// async function sendGaslessTx(targetAddress, functionName, argsArray) {
//   try {
//     const gaslessAbiPath = path.join(__dirname, 'gaslessAbi.json');
//     const gaslessAbi = JSON.parse(fs.readFileSync(gaslessAbiPath, 'utf8'));

//     const gaslessContract = new ethers.Contract(process.env.GASLESS_CONTRACT_ADDRESS, gaslessAbi, wallet);

//     // Encode inner call (e.g. call to CommentBox or your game monCraft)
//     const innerCall = monCraft.interface.encodeFunctionData(functionName, argsArray);

//     // Send gasless call via proxy
//     const tx = await gaslessContract.makeProxyTx(contract.target, innerCall);
//     const receipt = await tx.wait();

//     return {
//       success: true,
//       txHash: receipt.hash,
//       message: `Gasless tx successful: ${functionName}`,
//     };
//   } catch (error) {
//     console.error('Gasless tx failed:', error);
//     return {
//       success: false,
//       message: error.message,
//     };
//   }
// }

module.exports = {
  sendNativeToken,
  startGame,
  checkStep,
  getSession,
  saveGame,
  captureMonster,
  getCapturedMonsters
};