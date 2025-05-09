import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";

describe("MonsterNFT", function () {
  let monsterNFT: Contract;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
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
    // Get signers
    [owner, user] = await ethers.getSigners();

    // Deploy MonsterNFT contract
    const MonsterNFT = await ethers.getContractFactory("MonsterNFT");
    monsterNFT = await MonsterNFT.deploy();
    await monsterNFT.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await monsterNFT.owner()).to.equal(owner.address);
    });

    it("Should have the correct name and symbol", async function () {
      expect(await monsterNFT.name()).to.equal("GameNFT");
      expect(await monsterNFT.symbol()).to.equal("GNFT");
    });
  });

  describe("Minting", function () {
    it("Should mint a new monster NFT", async function () {
      const mintTx = await monsterNFT.mint(user.address, monsterSample);
      await mintTx.wait();

      // Check ownership
      expect(await monsterNFT.ownerOf(0)).to.equal(user.address);

      // Check token URI contains expected monster data
      const tokenURI = await monsterNFT.tokenURI(0);
      expect(tokenURI).to.include("data:application/json;base64,");

      // Decode and verify the base64 content
      const base64Content = tokenURI.split("data:application/json;base64,")[1];
      const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
      const jsonContent = JSON.parse(decodedContent);

      expect(jsonContent.name).to.equal(monsterSample.name);
      expect(jsonContent.image).to.equal(monsterSample.imageURI);
      expect(jsonContent.attributes[0].value.toString()).to.equal(monsterSample.initialHP.toString());
      expect(jsonContent.attributes[1].value.toString()).to.equal(monsterSample.currentHP.toString());
      expect(jsonContent.attributes[2].value.toString()).to.equal(monsterSample.attackDamage.toString());
      expect(jsonContent.attributes[3].value.toString()).to.equal(monsterSample.defense.toString());
    });

    it("Should only allow owner to mint", async function () {
      await expect(
        monsterNFT.connect(user).mint(user.address, monsterSample)
      ).to.be.revertedWithCustomError(monsterNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Mint a token first
      await monsterNFT.mint(user.address, monsterSample);
    });

    it("Should burn a monster NFT", async function () {
      // Approve the owner to burn the NFT
      await monsterNFT.connect(user).approve(owner.address, 0);

      // Burn the NFT
      await monsterNFT.burn(0);

      // Check that the token doesn't exist anymore
      await expect(monsterNFT.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should only allow owner to burn", async function () {
      await expect(
        monsterNFT.connect(user).burn(0)
      ).to.be.revertedWithCustomError(monsterNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("Updating HP", function () {
    beforeEach(async function () {
      // Mint a token first
      await monsterNFT.mint(user.address, monsterSample);
    });

    it("Should update a monster's HP", async function () {
      const newHP = 75;

      // Update the HP
      const updateTx = await monsterNFT.updateHP(0, newHP);

      // Check for event emission
      await expect(updateTx)
        .to.emit(monsterNFT, "HPUpdated")
        .withArgs(0, newHP);

      // Verify the HP was updated in tokenURI
      const tokenURI = await monsterNFT.tokenURI(0);
      const base64Content = tokenURI.split("data:application/json;base64,")[1];
      const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
      const jsonContent = JSON.parse(decodedContent);

      expect(jsonContent.attributes[1].value.toString()).to.equal(newHP.toString());
    });

    it("Should only allow owner to update HP", async function () {
      await expect(
        monsterNFT.connect(user).updateHP(0, 50)
      ).to.be.revertedWithCustomError(monsterNFT, "OwnableUnauthorizedAccount");
    });
  });
});
