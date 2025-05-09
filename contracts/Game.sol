//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {GameNFT} from "./GameNFT.sol";

contract Game {
    /// ERRORS
    error Game__InvalidAssetsLength();

    /// TYPES
    struct Session {
        string code;
        address player;
        uint256 currentStep;
    }

    /// STATE VARIABLES
    uint256 private s_seed;
    GameNFT private s_gameNFT;
    GameNFT.Asset[] public s_assets;
    mapping(address player => Session session) private s_playerSessions; // Do we need it?
    mapping(string code => Session session) private s_codeSessions;

    /// EVENTS
    event NewSession(address indexed player, string sessionCode);
    event AssetCaptured(string indexed sessionCode, uint256 tokenId);
    event StepsSynced(string indexed sessionCode, uint256 currentStep);
    event AssetUpdated(string indexed sessionCode, uint256 newHP);

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
        Session memory session = Session({code: sessionCode, player: msg.sender, currentStep: 0});
        s_playerSessions[msg.sender] = session;
        s_codeSessions[sessionCode] = s_playerSessions[msg.sender];
        s_gameNFT.mint(msg.sender, s_assets[0]);

        emit NewSession(msg.sender, sessionCode);
    }

    // used by ROFL to sync steps when users saves or timeouts
    function syncSteps(string memory sessionCode, uint256 currentStep) external {
        s_codeSessions[sessionCode].currentStep = currentStep;
        emit StepsSynced(sessionCode, currentStep);
    }

    function captureAsset(string memory sessionCode, uint256 assetIndex) external {
        Session storage session = s_codeSessions[sessionCode];
        GameNFT.Asset memory asset = s_assets[assetIndex];

        uint256 percentage = uint256(keccak256(abi.encodePacked(s_seed, session.player, block.timestamp))) % 100;

        if (percentage >= asset.chancesOfCapture) {
            s_gameNFT.mint(msg.sender, asset);
            // session.currentStep++;
            emit AssetCaptured(sessionCode, assetIndex);
        }
    }

    // PRIVATE & INTERNAL VIEW FUNCTIONS
    function _generateCode() private view returns (string memory) {
        bytes32 hash = keccak256(abi.encodePacked(s_seed, msg.sender));
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        bytes memory code = new bytes(6); // change length as needed

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
