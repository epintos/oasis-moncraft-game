import "@nomicfoundation/hardhat-toolbox";
import "@oasisprotocol/sapphire-hardhat";
import dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "./tasks";

// Load environment variables from .env file
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    sapphire: {
      url: "https://sapphire.oasis.io",
      chainId: 0x5afe,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    "sapphire-testnet": {
      url: "https://testnet.sapphire.oasis.io",
      accounts: process.env.TESTNET_PRIVATE_KEY ? [process.env.TESTNET_PRIVATE_KEY] : [],
      chainId: 0x5aff,
    },
    "sapphire-localnet": {
      url: "http://localhost:9001",
      chainId: 0x5afd,
      accounts: process.env.LOCAL_PRIVATE_KEY ? [process.env.LOCAL_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    //  Enabled by default (not supported on Sapphire)
    enabled: false
  },
  sourcify: {
    // Disabled by default
    // Doesn't need an API key
    enabled: true
  }
};


export default config;
