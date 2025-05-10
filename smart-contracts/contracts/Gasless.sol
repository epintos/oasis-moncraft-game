// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {encryptCallData} from "@oasisprotocol/sapphire-contracts/contracts/CalldataEncryption.sol";
import {EIP155Signer} from "@oasisprotocol/sapphire-contracts/contracts/EIP155Signer.sol";

/**
 * @title Gasless
 * @author @epintos, @federava
 * @notice Contract used to allow Gasless transaction in the Game
 */
contract Gasless {
    error Gasless__CallFailed();
    error Gasless__FundingFailed();

    struct EthereumKeypair {
        address addr;
        bytes32 secret;
        uint64 nonce;
    }

    EthereumKeypair private s_keyPair;

    constructor(EthereumKeypair memory keyPair) payable {
        s_keyPair = keyPair;
        if (msg.value > 0) {
            (bool success,) = payable(s_keyPair.addr).call{value: msg.value}("");
            if (!success) {
                revert Gasless__FundingFailed();
            }
        }
    }

    function makeProxyTx(address innercallAddr, bytes memory innercall) external view returns (bytes memory output) {
        bytes memory data = abi.encode(innercallAddr, innercall);
        return EIP155Signer.sign(
            s_keyPair.addr,
            s_keyPair.secret,
            EIP155Signer.EthTx({
                nonce: s_keyPair.nonce,
                gasPrice: 100_000_000_000,
                gasLimit: 250000,
                to: address(this),
                value: 0,
                data: encryptCallData(abi.encodeCall(this.proxy, data)),
                chainId: block.chainid
            })
        );
    }

    function proxy(bytes memory data) external payable {
        s_keyPair.nonce += 1;

        (address addr, bytes memory subcallData) = abi.decode(data, (address, bytes));
        (bool success,) = addr.call{value: msg.value}(subcallData);

        if (!success) {
            revert Gasless__CallFailed();
        }
    }
}
