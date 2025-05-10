import fs from "fs";
import path from "path";

async function exportAbi(contractName: string) {
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
  const abiOutputPath = path.join(__dirname, `../../rofl/app/src/abis/${contractName}.json`);

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;

  fs.mkdirSync(path.dirname(abiOutputPath), { recursive: true });
  fs.writeFileSync(abiOutputPath, JSON.stringify(abi, null, 2));

  console.log(`✅ ABI written to: ${abiOutputPath}`);
}

async function main() {
  await exportAbi("Gasless");
  await exportAbi("MonCraft");
  await exportAbi("MonsterNFT");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
