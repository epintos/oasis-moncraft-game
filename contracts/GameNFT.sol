//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract GameNFT is ERC721, Ownable {
    using Strings for uint256;

    struct Asset {
        string name;
        string imageURI;
        uint256 initialHP;
        uint256 currentHP;
        uint256 attackDamage;
        uint256 defense;
        uint256 chancesOfApperance;
        uint256 chancesOfCapture;
    }

    uint256 private s_totalSupply;
    mapping(uint256 => Asset) private s_assets;

    event HPUpdated(uint256 indexed tokenId, uint256 newHP);

    constructor() ERC721("GameNFT", "GNFT") Ownable(msg.sender) {}

    function mint(address to, Asset memory asset) external onlyOwner returns (uint256) {
        uint256 tokenId = s_totalSupply;
        s_assets[tokenId] = asset;
        _safeMint(to, tokenId);
        s_totalSupply++;
        return tokenId;
    }

    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
    }

    function updateHP(uint256 tokenId, uint256 newHP) external onlyOwner {
        s_assets[tokenId].currentHP = newHP;
        emit HPUpdated(tokenId, newHP);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        Asset memory asset = s_assets[tokenId];

        string memory json = string(
            abi.encodePacked(
                '{"name":"',
                asset.name,
                '"image":"',
                asset.imageURI,
                '","attributes":[',
                '{"trait_type":"Initial HP","value":',
                asset.initialHP.toString(),
                "},",
                '{"trait_type":"Current HP","value":',
                asset.currentHP.toString(),
                "},",
                '{"trait_type":"Attack Damage","value":',
                asset.attackDamage.toString(),
                "},",
                '{"trait_type":"Defense","value":',
                asset.defense.toString(),
                "}",
                "]}"
            )
        );

        // Encode JSON metadata in base64
        string memory base64Json = Base64.encode(bytes(json));

        // Return as a data URI
        return string(abi.encodePacked("data:application/json;base64,", base64Json));
    }
}
