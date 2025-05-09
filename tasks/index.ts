import { task } from "hardhat/config";

task("deploy").setAction(async (_args, hre) => {
  const Game = await hre.ethers.getContractFactory("Game");
  const game = await Game.deploy();
  const gameAddr = await game.waitForDeployment();

  console.log(`game address: ${gameAddr.target}`);
  return gameAddr.target;
});
