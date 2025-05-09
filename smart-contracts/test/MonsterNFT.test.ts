// test/MonsterNFT.ts

import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";

describe("MonsterNFT", function () {
  let monsterNFT: Contract;
  let owner: any;
  let user: any;
  let ownerAddress: string;
  let userAddress: string;

  const monsterSample = {
    name: "Pikachu",
    imageURI: "https://example.com/pikachu.png",
    initialHP: 100,
    currentHP: 100,
    attackDamage: 25,
    defense: 10,
    chancesOfApperance: 80,
    chancesOfCapture: 50
  };

  beforeEach(async function () {
    // Get signers and their addresses
    [owner, user] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    userAddress = await user.getAddress();

    // Deploy MonsterNFT contract
    const MonsterNFT = await ethers.getContractFactory("MonsterNFT", owner);
    monsterNFT = await MonsterNFT.deploy();
    await monsterNFT.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await monsterNFT.name()).to.equal("Monster");
      expect(await monsterNFT.symbol()).to.equal("MON");
    });
  });

  describe("Minting", function () {
    it("Should mint a new monster NFT", async function () {
      const tx = await monsterNFT.mint(ownerAddress, monsterSample);
      await tx.wait();

      expect(await monsterNFT.ownerOf(0)).to.equal(ownerAddress);

      const tokenURI = await monsterNFT.tokenURI(0);
      expect(tokenURI).to.include("data:application/json;base64,");

      const base64Content = tokenURI.split("data:application/json;base64,")[1];
      const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
      const json = JSON.parse(decodedContent);

      expect(json.name).to.equal(monsterSample.name);
      expect(json.image).to.equal(monsterSample.imageURI);
      expect(json.attributes[0].value.toString()).to.equal(monsterSample.initialHP.toString());
      expect(json.attributes[1].value.toString()).to.equal(monsterSample.currentHP.toString());
      expect(json.attributes[2].value.toString()).to.equal(monsterSample.attackDamage.toString());
      expect(json.attributes[3].value.toString()).to.equal(monsterSample.defense.toString());
    });

    it("Should revert minting from non-owner", async function () {
      await expect(
        monsterNFT.connect(user).mint(userAddress, monsterSample)
      ).to.be.revertedWithCustomError(monsterNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await monsterNFT.mint(ownerAddress, monsterSample);
    });

    it("Should burn a token", async function () {
      await monsterNFT.burn(0);
      await expect(monsterNFT.ownerOf(0)).to.be.revertedWithCustomError(monsterNFT, "ERC721NonexistentToken");
    });

    it("Should revert burn from non-owner", async function () {
      await expect(
        monsterNFT.connect(user).burn(0)
      ).to.be.revertedWithCustomError(monsterNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("Updating HP", function () {
    beforeEach(async function () {
      await monsterNFT.mint(ownerAddress, monsterSample);
    });

    it("Should update HP and emit event", async function () {
      const newHP = 75;
      const tx = await monsterNFT.updateHP(0, newHP);
      await expect(tx).to.emit(monsterNFT, "HPUpdated").withArgs(0, newHP);

      const tokenURI = await monsterNFT.tokenURI(0);
      const base64Content = tokenURI.split("data:application/json;base64,")[1];
      const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
      const json = JSON.parse(decodedContent);

      expect(json.attributes[1].value.toString()).to.equal(newHP.toString());
    });

    it("Should revert HP update from non-owner", async function () {
      await expect(
        monsterNFT.connect(user).updateHP(0, 50)
      ).to.be.revertedWithCustomError(monsterNFT, "OwnableUnauthorizedAccount");
    });
  });
});
