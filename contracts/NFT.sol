//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {console} from "hardhat/console.sol";
import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

contract NFT is ERC721 {
    uint256 private seed;

    constructor() ERC721("NFT", "NFT") {
        seed = uint256(bytes32(Sapphire.randomBytes(32, "")));
    }
}
