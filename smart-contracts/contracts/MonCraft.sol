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
    error MonCraft__InvalidSessionCode();
    error MonCraft__CurrentStepIsLower();
    error MonCraft__SessionDoesNotHaveTokenId();
    error MonCraft__MonsterDoesNotExist();
    error MonCraft__TransferFailed();
    error MonCraft__NotOwner();

    enum Status {
        ABSENT,
        IN_PROGRESS
    }

    /// TYPES
    struct Session {
        Status status;
        bytes32 code;
        uint256 currentStep;
        uint256[] monstersTokenIds;
    }

    /// STATE VARIABLES
    uint256 public MAX_ASSETS = 10;
    uint256 public PROBABILITY_APPEARANCE = 20;

    uint256 private s_seed;
    MonsterNFT public s_monsterNFT;
    MonsterNFT.Monster[] public s_monsters;
    mapping(bytes32 code => Session session) public s_codeSessions;
    address public s_roflAddress;
    uint256 public s_sessionsQty;
    address private s_owner;

    /// EVENTS
    event NewSession(bytes32 indexed sessionCode);
    event MonsterCaptured(bytes32 indexed sessionCode, uint256 tokenId);
    event StepsSynced(bytes32 indexed sessionCode, uint256 currentStep);
    event MonsterUpdated(bytes32 indexed sessionCode, uint256 newHP);
    event MonsterReleased(bytes32 indexed sessionCode, uint256 tokenId);
    event MonstersWithdrawn(bytes32 indexed sessionCode, address indexed player);
    event MonstersImported(bytes32 indexed sessionCode, address indexed player);

    /// MODIFIERS
    modifier onlyROFL() {
        if (msg.sender != s_roflAddress) {
            revert MonCraft__NotROLFAddress();
        }
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != s_owner) {
            revert MonCraft__NotOwner();
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
        address roflAddress,
        address owner
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
        s_owner = owner;
    }

    // EXTERNAL FUNCTIONS
    function startGame() external onlyROFL returns (bytes32 sessionCode) {
        sessionCode = _generateCode();
        Session storage session = s_codeSessions[sessionCode];
        session.code = sessionCode;
        session.currentStep = 0;
        session.status = Status.IN_PROGRESS;
        uint256 tokenId = s_monsterNFT.mint(address(this), s_monsters[0]);
        session.monstersTokenIds.push(tokenId);
        s_sessionsQty++;
        emit NewSession(sessionCode);
    }

    // used by ROFL to sync steps when users saves or timeouts
    function syncSteps(bytes32 sessionCode, uint256 currentStep) external onlyROFL {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }
        if (currentStep <= session.currentStep) {
            revert MonCraft__CurrentStepIsLower();
        }
        s_codeSessions[sessionCode].currentStep = currentStep;
        emit StepsSynced(sessionCode, currentStep);
    }

    function captureMonster(bytes32 sessionCode, uint256 monsterIndex) external onlyROFL {
        if (monsterIndex >= s_monsters.length) {
            revert MonCraft__MonsterDoesNotExist();
        }
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

    function releaseMonster(bytes32 sessionCode, uint256 tokenId) external {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        for (uint256 i = 0; i < session.monstersTokenIds.length; i++) {
            if (session.monstersTokenIds[i] == tokenId) {
                session.monstersTokenIds[i] = session.monstersTokenIds[session.monstersTokenIds.length - 1];
                session.monstersTokenIds.pop();
                s_monsterNFT.burn(tokenId);
                emit MonsterReleased(sessionCode, tokenId);
                return;
            }
        }
        revert MonCraft__SessionDoesNotHaveTokenId();
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

    function withdrawMonsters(bytes32 sessionCode, address player) external onlyROFL {
        Session storage session = s_codeSessions[sessionCode];

        // Check if session exists and is in progress
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        uint256[] memory monstersToWithdraw = session.monstersTokenIds;

        session.monstersTokenIds = new uint256[](0);

        for (uint256 i = 0; i < monstersToWithdraw.length; i++) {
            uint256 tokenId = monstersToWithdraw[i];
            s_monsterNFT.safeTransferFrom(address(this), player, tokenId);
        }

        emit MonstersWithdrawn(sessionCode, player);
    }
    // TODO: validate that they are not duplicated

    function importMonsters(bytes32 sessionCode, uint256[] memory tokenIds) external onlyROFL {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }
        if (session.monstersTokenIds.length + tokenIds.length > MAX_ASSETS) {
            revert MonCraft__AlreadyMaxMonsters();
        }
        for (uint256 i = 0; i < tokenIds.length; i++) {
            session.monstersTokenIds.push(tokenIds[i]);
        }
        for (uint256 i = 0; i < tokenIds.length; i++) {
            s_monsterNFT.safeTransferFrom(msg.sender, address(this), tokenIds[i]);
        }
        emit MonstersImported(sessionCode, msg.sender);
    }

    function updateProbabilityAppearance(uint256 newProbability) external onlyOwner {
        PROBABILITY_APPEARANCE = newProbability;
    }

    function updateMaxAssets(uint256 newMaxAssets) external onlyOwner {
        MAX_ASSETS = newMaxAssets;
    }

    function updateROFLAddress(address newROFLAddress) external onlyOwner {
        s_roflAddress = newROFLAddress;
    }

    // PRIVATE & INTERNAL VIEW FUNCTIONS
    function _generateCode() private view returns (bytes32) {
        return keccak256(abi.encodePacked(s_seed, s_sessionsQty, block.timestamp));
    }

    // PUBLIC & EXTERNAL VIEW FUNCTIONS
    // increases move in ROFL
    function checkStep(bytes32 sessionCode, uint256 playerStep) external view returns (uint256, bool) {
        Session memory session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        bytes32 hashAppearance = keccak256(abi.encodePacked(s_seed, sessionCode, playerStep, block.timestamp));
        bytes32 hashMonster = keccak256(abi.encode(hashAppearance));

        uint256 percentageAppearance = uint256(hashAppearance) % 100;
        uint256 percentageMonster = uint256(hashMonster) % 100;

        if (percentageAppearance >= PROBABILITY_APPEARANCE) {
            for (uint256 i = 0; i < s_monsters.length; i++) {
                if (percentageMonster < s_monsters[i].chancesOfApperance) {
                    return (i, true);
                }
            }
        }

        return (0, false);
    }
}
