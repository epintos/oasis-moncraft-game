//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {MonsterNFT} from "./MonsterNFT.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MonCraft
 * @author @epintos, @federava
 */
contract MonCraft is IERC721Receiver, Ownable {
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
    error MonCraft__PlayerCannotJoinFight();
    error MonCraft__FightNotReady();
    error MonCraft__NotValidAccessCode();
    error MonCraft__AlreadyTwoPlayersJoined();

    enum Status {
        ABSENT,
        IN_PROGRESS
    }

    enum FightStatus {
        ABSENT,
        CREATED,
        READY,
        COMPLETE
    }

    /// TYPES
    struct Session {
        uint256 id;
        Status status;
        bytes32 code; // this should be kept private
        uint256 currentStep;
        uint256[] monstersTokenIds;
        mapping(uint256 monsterTokenId => bool exists) monsterTokenIdsExists;
    }

    struct Fight {
        bytes32 sessionCodeOne;
        bytes32 sessionCodeTwo;
        FightStatus status;
        bytes32 winner;
        uint256 monsterOneTokenId;
        uint256 monsterTwoTokenId;
        uint256 playersJoinedQty;
    }

    /// STATE VARIABLES
    uint256 private s_seed;

    uint256 public s_maxMonsters = 10;
    uint256 public s_probabilityAppearence = 20;
    uint256 public s_probabilityAttack = 40;
    uint256 public s_sessionsQty;
    MonsterNFT public s_monsterNFT;
    MonsterNFT.Monster[] public s_monsters;
    mapping(bytes32 code => Session session) private s_codeSessions;
    mapping(uint256 sessionId => bytes32 code) private s_sessionsIds;
    mapping(uint256 fightId => Fight fight) private s_fights;
    uint256 public s_fightsQty;
    address public s_roflAddress;
    bytes32 private s_roflAccessCode;

    /// EVENTS
    event NewSession(uint256 indexed sessionId);
    event MonsterCaptured(uint256 indexed sessionId, uint256 tokenId, bool captured);
    event StepsSynced(uint256 indexed sessionId, uint256 currentStep);
    event MonsterUpdated(uint256 indexed sessionId, uint256 newHP);
    event MonsterReleased(uint256 indexed sessionId, uint256 tokenId);
    event MonstersWithdrawn(uint256 indexed sessionId, address indexed player);
    event MonstersImported(uint256 indexed sessionId, address indexed player);
    event FightCreated(uint256 indexed fightId);
    event PlayerJoinedFight(uint256 indexed fightId, uint256 indexed sessionId, uint256 playerNumber);
    event FightDamage(uint256 indexed fightId, uint256 damage);
    event FightSynced(uint256 indexed fightId, uint256 tokenId);

    /// MODIFIERS
    modifier onlyROFL(bytes32 accesCode) {
        if (accesCode != s_roflAccessCode) {
            revert MonCraft__NotValidAccessCode();
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
    ) Ownable(owner) {
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

    /**
     * @notice Allows the ROLF to start a new game
     * @notice The session mints the monster with index 0
     */
    function startGame(bytes32 accessCode) external onlyROFL(accessCode) returns (uint256 sessionId) {
        bytes32 sessionCode = _generateCode();
        sessionId = s_sessionsQty;

        Session storage session = s_codeSessions[sessionCode];
        session.code = sessionCode;
        session.currentStep = 0;
        session.status = Status.IN_PROGRESS;
        uint256 tokenId = s_monsterNFT.mint(address(this), s_monsters[0]);
        session.monstersTokenIds.push(tokenId);
        session.monsterTokenIdsExists[tokenId] = true;
        session.id = sessionId;
        s_sessionsIds[sessionId] = sessionCode;
        s_sessionsQty++;
        emit NewSession(sessionId);
    }

    /**
     * @notice Allows the ROFL to update the session current steps
     * @param sessionCode The session identifier.
     * @param currentStep The new current step to sync.
     */
    function syncCurrentStep(bytes32 sessionCode, uint256 currentStep, bytes32 accessCode)
        external
        onlyROFL(accessCode)
    {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }
        if (currentStep <= session.currentStep) {
            revert MonCraft__CurrentStepIsLower();
        }
        s_codeSessions[sessionCode].currentStep = currentStep;
        emit StepsSynced(session.id, currentStep);
    }

    /**
     * @notice Attempts to capture a monster at a given step based on a random probability.
     * @param sessionCode The session identifier.
     * @param monsterIndex monster that appears and the player can capture
     * @param currentStep The current player's step
     */
    function captureMonster(bytes32 sessionCode, uint256 monsterIndex, uint256 currentStep, bytes32 accessCode)
        external
        onlyROFL(accessCode)
    {
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
            uint256(keccak256(abi.encode(s_seed, session.code, currentStep, monsterIndex, block.timestamp))) % 100;

        bool captured;
        if (percentage <= monster.chancesOfCapture) {
            uint256 tokenId = s_monsterNFT.mint(address(this), monster);
            session.monstersTokenIds.push(tokenId);
            session.monsterTokenIdsExists[tokenId] = true;
            captured = true;
        }
        emit MonsterCaptured(session.id, monsterIndex, captured);
    }

    /**
     *
     * @notice Releases a captured monster and burns the NFT.
     * @param sessionCode The session identifier.
     * @param tokenId The NFT token ID to release.
     * @notice This method is used when the user reaches the maxMonsters and wants to release a monster
     * to capture a new one
     */
    function releaseMonster(bytes32 sessionCode, uint256 tokenId, bytes32 accessCode) external onlyROFL(accessCode) {
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
                emit MonsterReleased(session.id, tokenId);
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

        emit MonstersWithdrawn(session.id, player);
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
        emit MonstersImported(session.id, msg.sender);
    }

    /**
     * @notice Owner of the contract can create a fight between two players
     * @param sessionCodeOne code session of player 1
     * @param sessionCodeTwo code session of player 2
     */
    function createFight(bytes32 sessionCodeOne, bytes32 sessionCodeTwo) external onlyOwner returns (uint256 fightId) {
        Session storage sessionOne = s_codeSessions[sessionCodeOne];
        Session storage sessionTwo = s_codeSessions[sessionCodeTwo];
        if (sessionOne.status != Status.IN_PROGRESS || sessionTwo.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }
        fightId = s_fightsQty;
        s_fightsQty++;
        Fight storage fight = s_fights[fightId];
        fight.sessionCodeOne = sessionCodeOne;
        fight.sessionCodeTwo = sessionCodeTwo;
        fight.status = FightStatus.CREATED;
        emit FightCreated(fightId);
    }

    /**
     * @notice Players can join a fight with a given monster id
     * @param fightId Fight id
     * @param sessionCode Player joining session code
     * @param tokenId Monster token id that the user will use to fight
     * @dev This can only be called by ROFL
     */
    function joinFight(uint256 fightId, bytes32 sessionCode, uint256 tokenId, bytes32 accessCode)
        external
        onlyROFL(accessCode)
    {
        Fight storage fight = s_fights[fightId];
        if (fight.status != FightStatus.CREATED) {
            revert MonCraft__PlayerCannotJoinFight();
        }

        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        if (!session.monsterTokenIdsExists[tokenId]) {
            revert MonCraft__SessionDoesNotHaveTokenId();
        }

        if (fight.playersJoinedQty == 2) {
            revert MonCraft__AlreadyTwoPlayersJoined();
        }

        uint256 player;
        if (fight.sessionCodeOne == sessionCode) {
            fight.monsterOneTokenId = tokenId;
            player = 1;
        } else if (fight.sessionCodeTwo == sessionCode) {
            fight.monsterTwoTokenId = tokenId;
            player = 2;
        } else {
            revert MonCraft__InvalidSessionCode();
        }

        fight.playersJoinedQty++;

        if (fight.playersJoinedQty == 2) {
            fight.status = FightStatus.READY;
        }

        emit PlayerJoinedFight(fightId, session.id, player);
    }

    function syncFight(uint256 fightId, bytes32 winner, uint256 winnerHPLeft, bytes32 accessCode)
        external
        onlyROFL(accessCode)
    {
        Fight storage fight = s_fights[fightId];
        if (fight.status != FightStatus.READY) {
            revert MonCraft__FightNotReady();
        }

        fight.winner = winner;
        Session storage session = s_codeSessions[winner];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        fight.status = FightStatus.COMPLETE;

        uint256 tokenId;
        if (winner == fight.sessionCodeOne) {
            Session storage looser = s_codeSessions[fight.sessionCodeTwo];
            tokenId = fight.monsterTwoTokenId;
            looser.monsterTokenIdsExists[tokenId] = false;
            s_monsterNFT.burn(tokenId);
            s_monsterNFT.updateHP(fight.monsterOneTokenId, winnerHPLeft);
        } else if (winner == fight.sessionCodeTwo) {
            Session storage looser = s_codeSessions[fight.sessionCodeOne];
            tokenId = fight.monsterOneTokenId;
            looser.monsterTokenIdsExists[tokenId] = false;
            s_monsterNFT.burn(tokenId);
            s_monsterNFT.updateHP(fight.monsterTwoTokenId, winnerHPLeft);
        } else {
            revert MonCraft__InvalidSessionCode();
        }

        emit FightSynced(fightId, tokenId);
    }

    /**
     * @notice Updates the probability of a monster appearing
     * @param newProbability new probability
     */
    function updateProbabilityAppearance(uint256 newProbability) external onlyOwner {
        s_probabilityAppearence = newProbability;
    }

    /**
     * @notice Updates the probability of a monster missing an attack during a fight
     * @param probabilityAttack new probability
     */
    function updateProbabilityAttack(uint256 probabilityAttack) external onlyOwner {
        s_probabilityAttack = probabilityAttack;
    }

    /**
     * @notice Updates the maxMonsters a sesssion can hold
     * @param newMaxMonsters new max monsters
     */
    function updateMaxMonsters(uint256 newMaxMonsters) external onlyOwner {
        s_maxMonsters = newMaxMonsters;
    }

    /**
     * @notice Updates the access code used by ROFL for gassless tx
     * @param accessCode new access code
     */
    function updateROFLAccessCode(bytes32 accessCode) external onlyOwner {
        s_roflAccessCode = accessCode;
    }

    // PRIVATE & INTERNAL VIEW FUNCTIONS

    /**
     * @notice Generates a random session code for the game session
     * @return generated code
     */
    function _generateCode() private view returns (bytes32) {
        return keccak256(abi.encode(s_seed, s_sessionsQty, block.timestamp));
    }

    /**
     * @notice Updates the ROFL address
     * @param newROFLAddress The new ROFL address.
     */
    function updateROFLAddress(address newROFLAddress) external onlyOwner {
        s_roflAddress = newROFLAddress;
    }

    // PUBLIC & EXTERNAL VIEW FUNCTIONS

    /**
     * @notice Computes if a random monster appears at a given step.
     * @param sessionCode The session identifier.
     * @param playerStep The player's current step.
     * @return monsterIndex The index of the monster tha appears.
     * @return appeared Whether a monster appears at this step.
     */
    function checkStep(bytes32 sessionCode, uint256 playerStep, bytes32 accessCode)
        external
        view
        onlyROFL(accessCode)
        returns (uint256, bool)
    {
        Session storage session = s_codeSessions[sessionCode];
        if (session.status != Status.IN_PROGRESS) {
            revert MonCraft__SessionDoesNotExist();
        }

        bytes32 hashAppearance = keccak256(abi.encode(s_seed, sessionCode, playerStep, block.timestamp));
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

    /**
     * @notice Returns a session's public information
     * @param sessionCode session identifier
     * @return status session status
     * @return currentStep current player's step
     * @return monstersTokenIds ids for TokenIds owned by the player's session
     * @return sessionId session Id.
     * @dev Returns the public information from the session only
     */
    function getSessionInformation(bytes32 sessionCode, bytes32 accessCode)
        external
        view
        onlyROFL(accessCode)
        returns (uint256 status, uint256 currentStep, uint256[] memory monstersTokenIds, uint256 sessionId)
    {
        Session storage session = s_codeSessions[sessionCode];

        uint256[] memory tokens = session.monstersTokenIds;
        uint256 activeTokenLength;

        for (uint256 i = 0; i < tokens.length; i++) {
            if (session.monsterTokenIdsExists[tokens[i]]) {
                activeTokenLength++;
            }
        }

        uint256[] memory activeTokens = new uint256[](activeTokenLength);

        uint256 index = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (session.monsterTokenIdsExists[tokens[i]]) {
                activeTokens[index] = tokens[i];
                index++;
            }
        }

        return (uint256(session.status), session.currentStep, activeTokens, session.id);
    }

    /**
     * @notice Returns the fight information
     * @param fightId fight id
     * @return monsterOneTokenId player's one monster
     * @return monsterTwoTokenId player's two monster
     * @return status fight status
     *
     */
    function getFightInformation(uint256 fightId, bytes32 accessCode)
        external
        view
        onlyROFL(accessCode)
        returns (
            uint256 monsterOneTokenId,
            uint256 monsterTwoTokenId,
            FightStatus status,
            bytes32 sessionCodeOne,
            bytes32 sessionCodeTwo
        )
    {
        Fight storage fight = s_fights[fightId];
        return
            (fight.monsterOneTokenId, fight.monsterTwoTokenId, fight.status, fight.sessionCodeOne, fight.sessionCodeTwo);
    }

    /**
     * @notice Returns a random attack damage
     * @param fightId Fight id
     * @return damagePlayerOne Damage of the Monster 1
     * @return damagePlayerTwo Damage of the Monster 2
     */
    function getFightDamage(uint256 fightId, bytes32 accessCode)
        external
        view
        onlyROFL(accessCode)
        returns (uint256 damagePlayerOne, uint256 damagePlayerTwo)
    {
        Fight storage fight = s_fights[fightId];
        if (fight.status != FightStatus.READY) {
            revert MonCraft__FightNotReady();
        }

        uint256 attackDamageOne = s_monsterNFT.getMonsterAttackDamage(fight.monsterOneTokenId);
        uint256 attackDamageTwo = s_monsterNFT.getMonsterAttackDamage(fight.monsterTwoTokenId);

        damagePlayerOne = uint256(
            keccak256(abi.encode(s_seed, fight.sessionCodeOne, fightId, fight.monsterOneTokenId, block.timestamp))
        ) % (attackDamageOne + 1);
        damagePlayerTwo = uint256(
            keccak256(abi.encode(s_seed, fight.sessionCodeTwo, fightId, fight.monsterTwoTokenId, block.timestamp))
        ) % (attackDamageTwo + 1);
    }

    /**
     * @notice Returns the session code
     * @param sessionId player's session id
     * @param accessCode access code
     */
    function getSessionCode(uint256 sessionId, bytes32 accessCode)
        external
        view
        onlyROFL(accessCode)
        returns (bytes32 sessionCode)
    {
        sessionCode = s_sessionsIds[sessionId];
    }
}
