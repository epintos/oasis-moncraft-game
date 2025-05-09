const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

const path = require('path');
const abiPath = path.join(__dirname, 'abis.json');
const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);

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
    const tx = await contract.startGame();
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction receipt:', receipt);

    let sessionCode = null;

    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
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
    const [monsterIndex, hasAppeared] = await contract.checkStep(sessionCode, playerStep);
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

module.exports = { sendNativeToken, startGame, checkStep };