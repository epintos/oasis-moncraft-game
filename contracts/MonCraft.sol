//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {MonsterNFT} from "./MonsterNFT.sol";

contract MonCraft {
    /// ERRORS
    error Game__InvalidMonstersLength();
    error Game__AlreadyMaxMonsters();
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
        uint256[] monsters;
    }

    /// STATE VARIABLES
    uint256 private s_seed;
    MonsterNFT private s_gameNFT;
    MonsterNFT.Monster[] public s_monsters;
    mapping(string code => Session session) private s_codeSessions;
    uint256 constant MAX_ASSETS = 10;

    /// EVENTS
    event NewSession(address indexed player, string sessionCode);
    event MonsterCaptured(string indexed sessionCode, uint256 tokenId);
    event StepsSynced(string indexed sessionCode, uint256 currentStep);
    event MonsterUpdated(string indexed sessionCode, uint256 newHP);
    event MonsterReleased(string indexed sessionCode, uint256 tokenId);

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
            revert Game__InvalidMonstersLength();
        }

        for (uint256 i = 0; i < names.length; i++) {
            s_monsters.push(
                MonsterNFT.Monster({
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
        s_gameNFT = new MonsterNFT();
    }

    // EXTERNAL FUNCTIONS
    function startGame() external returns (string memory sessionCode) {
        sessionCode = _generateCode();
        Session storage session = s_codeSessions[sessionCode];
        session.code = sessionCode;
        session.player = msg.sender;
        session.currentStep = 0;
        session.status = Status.IN_PROGRESS;
        uint256 tokenId = s_gameNFT.mint(address(this), s_monsters[0]);
        session.monsters.push(tokenId);

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

    function captureMonster(string memory sessionCode, uint256 monsterIndex) external {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert Game__SessionDoesNotExist();
        }

        MonsterNFT.Monster memory monster = s_monsters[monsterIndex];

        if (session.monsters.length == MAX_ASSETS) {
            revert Game__AlreadyMaxMonsters();
        }

        uint256 percentage = uint256(keccak256(abi.encodePacked(s_seed, session.player, block.timestamp))) % 100;

        if (percentage >= monster.chancesOfCapture) {
            uint256 tokenId = s_gameNFT.mint(msg.sender, monster);
            session.monsters.push(tokenId);
            // session.currentStep++;
            emit MonsterCaptured(sessionCode, monsterIndex);
        }
    }

    function releaseMonster(string memory sessionCode, uint256 tokenId) external {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert Game__SessionDoesNotExist();
        }

        for (uint256 i = 0; i < session.monsters.length; i++) {
            if (session.monsters[i] == tokenId) {
                session.monsters[i] = session.monsters[session.monsters.length - 1];
                session.monsters.pop();
                break;
            }
        }
        s_gameNFT.burn(tokenId);
        emit MonsterReleased(sessionCode, tokenId);
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
        for (uint256 i = 0; i < s_monsters.length; i++) {
            if (percentage < s_monsters[i].chancesOfApperance) {
                return (i, true);
            }
        }

        return (0, false);
    }
}
