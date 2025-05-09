import { task } from "hardhat/config";

task("deploy").setAction(async (_args, hre) => {
  const names = [
    "Flaro",
    "Aquadle",
    "Leaflet",
    "Zappit",
    "Rockoon",
    "Ghostic",
    "Dracoon",
    "Cryonix",
    "Vampyrex",
    "Phantomox",
  ];

  const imageURIs = [
    "ipfs://QmFlaroImg",
    "ipfs://QmAquadleImg",
    "ipfs://QmLeafletImg",
    "ipfs://QmZappitImg",
    "ipfs://QmRockoonImg",
    "ipfs://QmGhosticImg",
    "ipfs://QmDracoonImg",
    "ipfs://QmCryonixImg",
    "ipfs://QmVampyrexImg",
    "ipfs://QmPhantomoxImg",
  ];

  const initialHPs = [60, 55, 50, 65, 70, 45, 80, 90, 85, 95];
  const attackDamages = [12, 11, 10, 13, 14, 15, 17, 18, 20, 22];
  const defenses = [6, 5, 4, 6, 7, 5, 8, 9, 10, 11];
  const chancesOfAppearance = [90, 80, 70, 60, 50, 40, 30, 20, 10, 5];
  const chancesOfCapture = [80, 75, 70, 65, 60, 55, 40, 30, 20, 10];

  const MonCraft = await hre.ethers.getContractFactory("MonCraft");
  const monCraft = await MonCraft.deploy(
    names,
    imageURIs,
    initialHPs,
    attackDamages,
    defenses,
    chancesOfAppearance,
    chancesOfCapture
  );
  const monCraftAddr = await monCraft.waitForDeployment();

  console.log(`MonCraft address: ${monCraftAddr.target}`);
  return monCraftAddr.target;
});
