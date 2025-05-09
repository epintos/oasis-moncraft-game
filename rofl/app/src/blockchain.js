const { ethers } = require('ethers');
require('dotenv').config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

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

module.exports = { sendNativeToken };