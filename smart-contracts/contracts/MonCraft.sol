//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {MonsterNFT} from "./MonsterNFT.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract MonCraft is IERC721Receiver {
    /// ERRORS
    error MonCraft__InvalidMonstersLength();
    error MonCraft__AlreadyMaxMonsters();
    error MonCraft__SessionDoesNotExist();
    error MonCraft__NotROLFAddress();
    error MonCraft__ReceiverIsNotCurrentContract();

    enum Status {
        ABSENT,
        IN_PROGRESS
    }

    /// TYPES
    struct Session {
        Status status;
        string code;
        uint256 currentStep;
        uint256[] monstersTokenIds;
    }

    /// STATE VARIABLES
    uint256 private s_seed;
    MonsterNFT public s_monsterNFT;
    MonsterNFT.Monster[] public s_monsters;
    mapping(string code => Session session) public s_codeSessions;
    uint256 public constant MAX_ASSETS = 10;
    address public s_roflAddress;

    /// EVENTS
    event NewSession(string sessionCode);
    event MonsterCaptured(string indexed sessionCode, uint256 tokenId);
    event StepsSynced(string indexed sessionCode, uint256 currentStep);
    event MonsterUpdated(string indexed sessionCode, uint256 newHP);
    event MonsterReleased(string indexed sessionCode, uint256 tokenId);

    /// MODIFIERS
    modifier onlyROFL() {
        if (msg.sender != s_roflAddress) {
            revert MonCraft__NotROLFAddress();
        }
        _;
    }

    /// FUNCTIONS

    // CONSTRUCTOR
    constructor(
        string[] memory names,
        string[] memory imageURIs,
        uint256[] memory initialHPs,
        uint256[] memory attackDamages,
        uint256[] memory defenses,
        uint256[] memory chancesOfAppearance, // ordered by appearence DESC
        uint256[] memory chancesOfCapture, // ordered by appearence DESC
        address roflAddress
    ) {
        if (
            names.length != imageURIs.length || names.length != initialHPs.length
                || names.length != attackDamages.length || names.length != defenses.length
                || names.length != chancesOfAppearance.length || names.length != chancesOfCapture.length
        ) {
            revert MonCraft__InvalidMonstersLength();
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
        s_monsterNFT = new MonsterNFT();
        s_roflAddress = roflAddress;
    }

    // EXTERNAL FUNCTIONS
    function startGame() external onlyROFL returns (string memory sessionCode) {
        sessionCode = _generateCode();
        Session storage session = s_codeSessions[sessionCode];
        session.code = sessionCode;
        session.currentStep = 0;
        session.status = Status.IN_PROGRESS;
        uint256 tokenId = s_monsterNFT.mint(address(this), s_monsters[0]);
        session.monstersTokenIds.push(tokenId);

        emit NewSession(sessionCode);
    }

    // used by ROFL to sync steps when users saves or timeouts
    function syncSteps(string memory sessionCode, uint256 currentStep) external onlyROFL {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }
        s_codeSessions[sessionCode].currentStep = currentStep;
        emit StepsSynced(sessionCode, currentStep);
    }

    function captureMonster(string memory sessionCode, uint256 monsterIndex) external onlyROFL {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        MonsterNFT.Monster memory monster = s_monsters[monsterIndex];

        if (session.monstersTokenIds.length == MAX_ASSETS) {
            revert MonCraft__AlreadyMaxMonsters();
        }

        uint256 percentage = uint256(keccak256(abi.encodePacked(s_seed, session.code, block.timestamp))) % 100;

        if (percentage >= monster.chancesOfCapture) {
            uint256 tokenId = s_monsterNFT.mint(address(this), monster);
            session.monstersTokenIds.push(tokenId);
            // session.currentStep++;
            emit MonsterCaptured(sessionCode, monsterIndex);
        }
    }

    function releaseMonster(string memory sessionCode, uint256 tokenId) external {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        for (uint256 i = 0; i < session.monstersTokenIds.length; i++) {
            if (session.monstersTokenIds[i] == tokenId) {
                session.monstersTokenIds[i] = session.monstersTokenIds[session.monstersTokenIds.length - 1];
                session.monstersTokenIds.pop();
                break;
            }
        }
        s_monsterNFT.burn(tokenId);
        emit MonsterReleased(sessionCode, tokenId);
    }

    /**
     *
     * @inheritdoc IERC721Receiver
     */
    function onERC721Received(address operator, address, /* from */ uint256, /* tokenId */ bytes calldata /* data */ )
        external
        view
        returns (bytes4)
    {
        if (operator != address(this)) {
            revert MonCraft__ReceiverIsNotCurrentContract();
        }
        return this.onERC721Received.selector;
    }
    // PRIVATE & INTERNAL VIEW FUNCTIONS

    function _generateCode() private view returns (string memory) {
        bytes32 hash = keccak256(abi.encodePacked(s_seed, block.timestamp));
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        bytes memory code = new bytes(6);

        for (uint256 i = 0; i < code.length; i++) {
            code[i] = alphabet[uint8(hash[i]) % alphabet.length];
        }

        return string(code);
    }

    // PUBLIC & EXTERNAL VIEW FUNCTIONS
    // increases move in ROFL
    function checkStep(string memory sessionCode, uint256 playerStep) external view onlyROFL returns (uint256, bool) {
        Session memory session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }
        uint256 percentage =
            uint256(keccak256(abi.encodePacked(s_seed, sessionCode, playerStep, block.timestamp))) % 100;
        for (uint256 i = 0; i < s_monsters.length; i++) {
            if (percentage < s_monsters[i].chancesOfApperance) {
                return (i, true);
            }
        }

        return (0, false);
    }
}
