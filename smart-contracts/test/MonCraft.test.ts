import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";

describe("MonCraft", function () {
  let monCraft: Contract;
  let monsterNFT: Contract;
  let owner: any;
  let roflAddress: any;
  let user: any;

  // Sample monster data for testing
  const monsterNames = ["Mon1", "Mon2", "Mon3"];
  const monsterImageURIs = [
    "https://example.com/Mon1.png",
    "https://example.com/Mon2.png",
    "https://example.com/Mon3.png"
  ];
  const initialHPs = [100, 120, 80];
  const attackDamages = [25, 20, 30];
  const defenses = [10, 15, 5];
  const chancesOfAppearance = [80, 60, 40]; // Higher chances first (DESC)
  const chancesOfCapture = [70, 50, 30]; // Higher chances first (DESC)

  async function deployContractsFixture() {
    // Get signers
    [owner, roflAddress, user] = await ethers.getSigners();

    // Deploy MonCraft contract (which will deploy MonsterNFT internally)
    const MonCraft = await ethers.getContractFactory("MonCraft");
    monCraft = await MonCraft.deploy(
      monsterNames,
      monsterImageURIs,
      initialHPs,
      attackDamages,
      defenses,
      chancesOfAppearance,
      chancesOfCapture,
      roflAddress.address
    );
    await monCraft.waitForDeployment();

    // Get MonsterNFT address from event logs
    const deploymentTx = await monCraft.deploymentTransaction();
    if (!deploymentTx) throw new Error("Deployment transaction not found");

    const receipt = await deploymentTx.wait();
    if (!receipt) throw new Error("Transaction receipt not found");

    // Find the contract creation in the logs
    let monsterNFTAddress;
    for (const log of receipt.logs) {
      if ('address' in log && log.address !== await monCraft.getAddress()) {
        monsterNFTAddress = log.address;
        break;
      }
    }

    if (!monsterNFTAddress) {
      throw new Error("MonsterNFT address not found in logs");
    }

    // Connect to the MonsterNFT contract
    const MonsterNFT = await ethers.getContractFactory("MonsterNFT");
    monsterNFT = MonsterNFT.attach(monsterNFTAddress);

    return { monCraft, monsterNFT, owner, roflAddress, user };
  }

  describe("Deployment", function () {
    it("Should deploy with correct monster data", async function () {
      const { monCraft } = await loadFixture(deployContractsFixture);

      // Check first monster's data from contract
      const monster = await monCraft.s_monsters(0);

      expect(monster.name).to.equal(monsterNames[0]);
      expect(monster.imageURI).to.equal(monsterImageURIs[0]);
      expect(monster.initialHP).to.equal(initialHPs[0]);
      expect(monster.currentHP).to.equal(initialHPs[0]);
      expect(monster.attackDamage).to.equal(attackDamages[0]);
      expect(monster.defense).to.equal(defenses[0]);
      expect(monster.chancesOfApperance).to.equal(chancesOfAppearance[0]);
      expect(monster.chancesOfCapture).to.equal(chancesOfCapture[0]);
    });

    it("Should revert if monster data arrays have different lengths", async function () {
      const MonCraft = await ethers.getContractFactory("MonCraft");

      // Create arrays with mismatched lengths
      const invalidNames = ["Mon1", "Mon2"];

      await expect(
        MonCraft.deploy(
          invalidNames, // Shorter array
          monsterImageURIs,
          initialHPs,
          attackDamages,
          defenses,
          chancesOfAppearance,
          chancesOfCapture,
          roflAddress.address
        )
      ).to.be.revertedWithCustomError(MonCraft, "MonCraft__InvalidMonstersLength");
    });
  });

  describe("Game Session", function () {
    it("Should start a new game session", async function () {
      const { monCraft } = await loadFixture(deployContractsFixture);

      // Start game session
      const tx = await monCraft.startGame();

      // Check for event emission
      await expect(tx).to.emit(monCraft, "NewSession");

      // Get the session code from events
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt not found");

      const newSessionEvent = receipt.logs.find(
        (log: any) => log.topics[0] === ethers.id("NewSession(string)")
      );

      expect(newSessionEvent).to.not.be.undefined;
    });

    it("Should allow ROFL to sync steps", async function () {
      const { monCraft, roflAddress } = await loadFixture(deployContractsFixture);

      // Start game session
      const tx = await monCraft.startGame();
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt not found");

      // Get session code from logs
      const newSessionEvent = receipt.logs.find(
        (log: any) => log.topics[0] === ethers.id("NewSession(string)")
      );
      if (!newSessionEvent || !('args' in newSessionEvent)) {
        throw new Error("New session event not found or malformed");
      }

      // Extract the session code from the event
      const sessionCode = newSessionEvent.args ? newSessionEvent.args[0] : "";

      // Sync steps as ROFL
      const newStep = 5;
      const syncTx = await monCraft.connect(roflAddress).syncSteps(sessionCode, newStep);

      // Check for event emission with correct data
      await expect(syncTx)
        .to.emit(monCraft, "StepsSynced")
        .withArgs(sessionCode, newStep);
    });

    it("Should revert when non-ROFL tries to sync steps", async function () {
      const { monCraft, user } = await loadFixture(deployContractsFixture);

      // Start game session
      const tx = await monCraft.startGame();
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt not found");

      // Get session code from logs
      const newSessionEvent = receipt.logs.find(
        (log: any) => log.topics[0] === ethers.id("NewSession(string)")
      );
      if (!newSessionEvent || !('args' in newSessionEvent)) {
        throw new Error("New session event not found or malformed");
      }

      // Extract the session code from the event
      const sessionCode = newSessionEvent.args ? newSessionEvent.args[0] : "";

      // Try to sync steps as user (should fail)
      await expect(
        monCraft.connect(user).syncSteps(sessionCode, 5)
      ).to.be.revertedWithCustomError(monCraft, "MonCraft__NotROLFAddress");
    });

    it("Should check step and potentially encounter a monster", async function () {
      const { monCraft, roflAddress } = await loadFixture(deployContractsFixture);

      // Start game session
      const tx = await monCraft.startGame();
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt not found");

      // Get session code from logs
      const newSessionEvent = receipt.logs.find(
        (log: any) => log.topics[0] === ethers.id("NewSession(string)")
      );
      if (!newSessionEvent || !('args' in newSessionEvent)) {
        throw new Error("New session event not found or malformed");
      }

      // Extract the session code from the event
      const sessionCode = newSessionEvent.args ? newSessionEvent.args[0] : "";

      // Check step as ROFL
      const step = 1;
      const [monsterIndex, encountered] = await monCraft.connect(roflAddress).checkStep(sessionCode, step);

      // We can't predict the random outcome, but we can verify the returned data types
      expect(typeof monsterIndex).to.equal('bigint');
      expect(typeof encountered).to.equal('boolean');
    });

    it("Should revert when releasing a non-existent monster", async function () {
      const { monCraft } = await loadFixture(deployContractsFixture);

      // Start game session
      const tx = await monCraft.startGame();
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt not found");

      // Get session code from logs
      const newSessionEvent = receipt.logs.find(
        (log: any) => log.topics[0] === ethers.id("NewSession(string)")
      );
      if (!newSessionEvent || !('args' in newSessionEvent)) {
        throw new Error("New session event not found or malformed");
      }

      // Extract the session code from the event
      const sessionCode = newSessionEvent.args ? newSessionEvent.args[0] : "";

      // Try to release monster with invalid tokenId (should revert on ERC721 level)
      const invalidTokenId = 999;
      await expect(
        monCraft.releaseMonster(sessionCode, invalidTokenId)
      ).to.be.reverted; // This will revert when burning non-existent token
    });
  });
});
