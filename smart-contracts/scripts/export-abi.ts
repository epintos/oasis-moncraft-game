import fs from "fs";
import path from "path";

async function main() {
  const contractName = "MonCraft"; // change this to your contract name
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
  const abiOutputPath = path.join(__dirname, `../..//rofl/app/src/abis.json`);

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;

  fs.mkdirSync(path.dirname(abiOutputPath), { recursive: true });
  fs.writeFileSync(abiOutputPath, JSON.stringify(abi, null, 2));

  console.log(`✅ ABI written to: ${abiOutputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
