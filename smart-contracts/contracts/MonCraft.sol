//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {MonsterNFT} from "./MonsterNFT.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title MonCraft
 * @author @epintos, @federava
 */
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
        mapping(uint256 monsterTokenId => bool exists) monsterTokenIdsExists;
    }

    /// STATE VARIABLES
    uint256 private s_seed;

    uint256 public s_maxMonsters = 10;
    uint256 public s_probabilityAppearence = 20;
    address public s_roflAddress;
    uint256 public s_sessionsQty;
    address private s_owner;
    MonsterNFT public s_monsterNFT;
    MonsterNFT.Monster[] public s_monsters;
    mapping(bytes32 code => Session session) public s_codeSessions;

    /// EVENTS
    event NewSession(bytes32 indexed sessionCode);
    event MonsterCaptured(bytes32 indexed sessionCode, uint256 tokenId, bool captured);
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
    /**
     *
     * @param names The names of the monsters.
     * @param imageURIs The IPFS URIs of the monster images.
     * @param initialHPs The initial HP values for the monsters.
     * @param attackDamages The attack damage values for the monsters.
     * @param defenses The defense values for the monsters.
     * @param chancesOfAppearance Cumulative % chances of monster appearance.
     * @param chancesOfCapture % chances of capturing the monster once found.
     * @param roflAddress The address of the ROFL contract authorized to control gameplay.
     * @param owner The address of the contract owner.
     */
    constructor(
        string[] memory names,
        string[] memory imageURIs,
        uint256[] memory initialHPs,
        uint256[] memory attackDamages,
        uint256[] memory defenses,
        uint256[] memory chancesOfAppearance,
        uint256[] memory chancesOfCapture,
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

    /**
     * @notice Allows the ROLF to start a new game
     * @notice The session mints the monster with index 0
     */
    function startGame() external onlyROFL returns (bytes32 sessionCode) {
        sessionCode = _generateCode();
        Session storage session = s_codeSessions[sessionCode];
        session.code = sessionCode;
        session.currentStep = 0;
        session.status = Status.IN_PROGRESS;
        uint256 tokenId = s_monsterNFT.mint(address(this), s_monsters[0]);
        session.monstersTokenIds.push(tokenId);
        session.monsterTokenIdsExists[tokenId] = true;
        s_sessionsQty++;
        emit NewSession(sessionCode);
    }

    /**
     * @notice Allows the ROFL to update the session current steps
     * @param sessionCode The session identifier.
     * @param currentStep The new current step to sync.
     */
    function syncCurrentStep(bytes32 sessionCode, uint256 currentStep) external onlyROFL {
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

    /**
     * @notice Attempts to capture a monster at a given step based on a random probability.
     * @param sessionCode The session identifier.
     * @param monsterIndex monster that appears and the player can capture
     * @param currentStep The current player's step
     */
    function captureMonster(bytes32 sessionCode, uint256 monsterIndex, uint256 currentStep) external onlyROFL {
        if (monsterIndex >= s_monsters.length) {
            revert MonCraft__MonsterDoesNotExist();
        }
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        MonsterNFT.Monster memory monster = s_monsters[monsterIndex];

        if (session.monstersTokenIds.length == s_maxMonsters) {
            revert MonCraft__AlreadyMaxMonsters();
        }

        session.currentStep = currentStep;

        uint256 percentage =
            uint256(keccak256(abi.encodePacked(s_seed, session.code, currentStep, monsterIndex, block.timestamp))) % 100;

        bool captured;
        if (percentage <= monster.chancesOfCapture) {
            uint256 tokenId = s_monsterNFT.mint(address(this), monster);
            session.monstersTokenIds.push(tokenId);
            session.monsterTokenIdsExists[tokenId] = true;
            captured = true;
        }
        emit MonsterCaptured(sessionCode, monsterIndex, captured);
    }

    /**
     *
     * @notice Releases a captured monster and burns the NFT.
     * @param sessionCode The session identifier.
     * @param tokenId The NFT token ID to release.
     * @notice This method is used when the user reaches the maxMonsters and wants to release a monster
     * to capture a new one
     */
    function releaseMonster(bytes32 sessionCode, uint256 tokenId) external onlyROFL {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        for (uint256 i = 0; i < session.monstersTokenIds.length; i++) {
            if (session.monstersTokenIds[i] == tokenId) {
                session.monstersTokenIds[i] = session.monstersTokenIds[session.monstersTokenIds.length - 1];
                session.monstersTokenIds.pop();
                s_monsterNFT.burn(tokenId);
                session.monsterTokenIdsExists[tokenId] = false;
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

    /**
     *
     * @notice Withdraws all captured monsters from a session and transfers them to a player.
     * @param sessionCode The session identifier.
     * @param player The address receiving the monsters.
     * @dev Removes the monsters from the session
     */
    function withdrawMonsters(bytes32 sessionCode, address player) external {
        Session storage session = s_codeSessions[sessionCode];

        // Check if session exists and is in progress
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        uint256[] memory monstersToWithdraw = session.monstersTokenIds;

        session.monstersTokenIds = new uint256[](0);

        for (uint256 i = 0; i < monstersToWithdraw.length; i++) {
            uint256 tokenId = monstersToWithdraw[i];
            session.monsterTokenIdsExists[tokenId] = false;
        }

        for (uint256 i = 0; i < monstersToWithdraw.length; i++) {
            uint256 tokenId = monstersToWithdraw[i];
            s_monsterNFT.safeTransferFrom(address(this), player, tokenId);
        }

        emit MonstersWithdrawn(sessionCode, player);
    }

    /**
     *
     * @notice Imports existing monster NFTs into an active session.
     * @param sessionCode The session identifier.
     * @param tokenIds The array of token IDs to import.
     * @dev Ignores any existing tokenIds
     * @dev Transfers the NFT from the owner to this contract
     */
    function importMonsters(bytes32 sessionCode, uint256[] memory tokenIds) external {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }
        if (session.monstersTokenIds.length + tokenIds.length > s_maxMonsters) {
            revert MonCraft__AlreadyMaxMonsters();
        }
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!session.monsterTokenIdsExists[tokenIds[i]]) {
                session.monstersTokenIds.push(tokenIds[i]);
                session.monsterTokenIdsExists[tokenIds[i]] = true;
            }
        }
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!session.monsterTokenIdsExists[tokenIds[i]]) {
                s_monsterNFT.safeTransferFrom(msg.sender, address(this), tokenIds[i]);
            }
        }
        emit MonstersImported(sessionCode, msg.sender);
    }

    /**
     * @notice Updates the probability of a monster appearing
     * @param newProbability new probability
     */
    function updateProbabilityAppearance(uint256 newProbability) external onlyOwner {
        s_probabilityAppearence = newProbability;
    }

    /**
     * @notice Updates the maxMonsters a sesssion can hold
     * @param newMaxMonsters new max monsters
     */
    function updateMaxMonsters(uint256 newMaxMonsters) external onlyOwner {
        s_maxMonsters = newMaxMonsters;
    }

    /**
     * @notice Updates the ROFL address
     * @param newROFLAddress The new ROFL address.
     */
    function updateROFLAddress(address newROFLAddress) external onlyOwner {
        s_roflAddress = newROFLAddress;
    }

    // PRIVATE & INTERNAL VIEW FUNCTIONS

    /**
     * @notice Generates a random session code for the game session
     * @return generated code
     */
    function _generateCode() private view returns (bytes32) {
        return keccak256(abi.encodePacked(s_seed, s_sessionsQty, block.timestamp));
    }

    // PUBLIC & EXTERNAL VIEW FUNCTIONS

    /**
     * @notice Computes if a random monster appears at a given step.
     * @param sessionCode The session identifier.
     * @param playerStep The player's current step.
     * @return monsterIndex The index of the monster tha appears.
     * @return appeared Whether a monster appears at this step.
     */
    function checkStep(bytes32 sessionCode, uint256 playerStep) external view returns (uint256, bool) {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        bytes32 hashAppearance = keccak256(abi.encodePacked(s_seed, sessionCode, playerStep, block.timestamp));
        bytes32 hashMonster = keccak256(abi.encode(hashAppearance));

        uint256 percentageAppearance = uint256(hashAppearance) % 100;
        uint256 percentageMonster = uint256(hashMonster) % 100;

        if (percentageAppearance <= s_probabilityAppearence) {
            for (uint256 i = 0; i < s_monsters.length; i++) {
                if (percentageMonster < s_monsters[i].chancesOfApperance) {
                    return (i, true);
                }
            }
        }

        return (0, false);
    }
}
