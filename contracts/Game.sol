//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {GameNFT} from "./GameNFT.sol";

contract Game {
    /// ERRORS
    error Game__InvalidAssetsLength();
    error Game__AlreadyMaxAssets();
    error Game__SessionDoesNotExist();

    enum Status {
        ABSENT,
        IN_PROGRESS
    }

    /// TYPES
    struct Session {
        Status status;
        string code;
        address player;
        uint256 currentStep;
        uint256[] assets;
    }

    /// STATE VARIABLES
    uint256 private s_seed;
    GameNFT private s_gameNFT;
    GameNFT.Asset[] public s_assets;
    mapping(string code => Session session) private s_codeSessions;
    uint256 constant MAX_ASSETS = 10;

    /// EVENTS
    event NewSession(address indexed player, string sessionCode);
    event AssetCaptured(string indexed sessionCode, uint256 tokenId);
    event StepsSynced(string indexed sessionCode, uint256 currentStep);
    event AssetUpdated(string indexed sessionCode, uint256 newHP);
    event AssetReleased(string indexed sessionCode, uint256 tokenId);

    /// FUNCTIONS

    // CONSTRUCTOR
    constructor(
        string[] memory names,
        string[] memory imageURIs,
        uint256[] memory initialHPs,
        uint256[] memory attackDamages,
        uint256[] memory defenses,
        uint256[] memory chancesOfAppearance, // ordered by appearence DESC
        uint256[] memory chancesOfCapture
    ) {
        if (
            names.length != imageURIs.length || names.length != initialHPs.length
                || names.length != attackDamages.length || names.length != defenses.length
                || names.length != chancesOfAppearance.length || names.length != chancesOfCapture.length
        ) {
            revert Game__InvalidAssetsLength();
        }

        for (uint256 i = 0; i < names.length; i++) {
            s_assets.push(
                GameNFT.Asset({
                    name: names[i],
                    imageURI: imageURIs[i],
                    initialHP: initialHPs[i],
                    currentHP: initialHPs[i], // start at full health
                    attackDamage: attackDamages[i],
                    defense: defenses[i],
                    chancesOfApperance: chancesOfAppearance[i],
                    chancesOfCapture: chancesOfCapture[i]
                })
            );
        }

        s_seed = uint256(bytes32(Sapphire.randomBytes(32, "")));
        s_gameNFT = new GameNFT();
    }

    // EXTERNAL FUNCTIONS
    function startGame() external returns (string memory sessionCode) {
        sessionCode = _generateCode();
        Session storage session = s_codeSessions[sessionCode];
        session.code = sessionCode;
        session.player = msg.sender;
        session.currentStep = 0;
        session.status = Status.IN_PROGRESS;
        uint256 tokenId = s_gameNFT.mint(address(this), s_assets[0]);
        session.assets.push(tokenId);

        emit NewSession(msg.sender, sessionCode);
    }

    // used by ROFL to sync steps when users saves or timeouts
    function syncSteps(string memory sessionCode, uint256 currentStep) external {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert Game__SessionDoesNotExist();
        }
        s_codeSessions[sessionCode].currentStep = currentStep;
        emit StepsSynced(sessionCode, currentStep);
    }

    function captureAsset(string memory sessionCode, uint256 assetIndex) external {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert Game__SessionDoesNotExist();
        }

        GameNFT.Asset memory asset = s_assets[assetIndex];

        if (session.assets.length == MAX_ASSETS) {
            revert Game__AlreadyMaxAssets();
        }

        uint256 percentage = uint256(keccak256(abi.encodePacked(s_seed, session.player, block.timestamp))) % 100;

        if (percentage >= asset.chancesOfCapture) {
            uint256 tokenId = s_gameNFT.mint(msg.sender, asset);
            session.assets.push(tokenId);
            // session.currentStep++;
            emit AssetCaptured(sessionCode, assetIndex);
        }
    }

    function releaseAsset(string memory sessionCode, uint256 tokenId) external {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert Game__SessionDoesNotExist();
        }

        for (uint256 i = 0; i < session.assets.length; i++) {
            if (session.assets[i] == tokenId) {
                session.assets[i] = session.assets[session.assets.length - 1];
                session.assets.pop();
                break;
            }
        }
        s_gameNFT.burn(tokenId);
        emit AssetReleased(sessionCode, tokenId);
    }

    // PRIVATE & INTERNAL VIEW FUNCTIONS
    function _generateCode() private view returns (string memory) {
        bytes32 hash = keccak256(abi.encodePacked(s_seed, msg.sender));
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        bytes memory code = new bytes(6);

        for (uint256 i = 0; i < code.length; i++) {
            code[i] = alphabet[uint8(hash[i]) % alphabet.length];
        }

        return string(code);
    }

    // PUBLIC & EXTERNAL VIEW FUNCTIONS
    // increases move in ROFL
    function checkStep(uint256 playerStep) external view returns (uint256, bool) {
        uint256 percentage = uint256(keccak256(abi.encodePacked(s_seed, msg.sender, playerStep, block.timestamp))) % 100;
        for (uint256 i = 0; i < s_assets.length; i++) {
            if (percentage < s_assets[i].chancesOfApperance) {
                return (i, true);
            }
        }

        return (0, false);
    }
}
