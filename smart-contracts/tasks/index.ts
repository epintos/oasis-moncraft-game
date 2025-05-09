import { task } from "hardhat/config";

task("deploy").setAction(async (_args, hre) => {
  const names = [
    "TALODION",
    "SATYROSK",
    "PEGASTRA",
    "NYXVRA",
    "MINOTERA",
    "MEDULISS",
    "HYDRAPHID",
    "ECHIDREX",
    "CHIMEREIGN",
    "CERBERIX",
  ];

  const imageURIs = [
    "ipfs://bafybeicdmjdjovbip7ui5jah5lpxqlstxphzsk7d6o3vpxopxwsyvbkseu",
    "ipfs://bafybeib2j4koj4wukuiljduxvx3sx7loxwwop3mu2lvizmrnl3gzddhv4y",
    "ipfs://bafybeicoo7nngjympfob3xanxyhtvmztln7p2g56rc3lwirpowjpg6bv64",
    "ipfs://bafybeibfk4kattfkkxwdzes2t5mqcszoibhbn7yqjddbpmypqs7vxscysa",
    "ipfs://bafybeiarsjaaywlvr7b3al4t7xdxyawe7a522tm6vvimxwwgqpomfgnckq",
    "ipfs://bafybeifeltimfqptrj7aotfccd6at2d7xziswqtu625mmkaqvwyuqp7dfu",
    "ipfs://bafybeibwzllxaleapz5yjkdhpdwemrobdgcjwe6s4eyyddk6jfrtifacgi",
    "ipfs://bafybeidydtbdvbsjgfwca527csuvpx6zxxiquk3baqwbtq23vxscrhacje",
    "ipfs://bafybeidfnycrjobrijwjlgn5xzruzj5vowdbhpzn5aoqd2nsjm3umqgosa",
    "ipfs://bafybeih3cby5hlphdlxjq7gjslqowohcccwuhxn6eday5ar6x6qgw6fx3a",
  ];

  const initialHPs = [180, 120, 200, 160, 130, 100, 140, 110, 90, 220];
  const attackDamages = [90, 70, 100, 85, 95, 40, 75, 85, 60, 110];
  const defenses = [80, 60, 90, 70, 55, 30, 80, 65, 40, 100];
  const chancesOfAppearance = [30, 50, 61, 71, 79, 86, 92, 96, 99, 100];
  const chancesOfCapture = [80, 15, 70, 65, 30, 55, 40, 30, 20, 30];

  const MonCraft = await hre.ethers.getContractFactory("MonCraft");
  const monCraft = await MonCraft.deploy(
    names,
    imageURIs,
    initialHPs,
    attackDamages,
    defenses,
    chancesOfAppearance,
    chancesOfCapture,
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  );
  const monCraftAddr = await monCraft.waitForDeployment();

  console.log(`MonCraft address: ${monCraftAddr.target}`);
  return monCraftAddr.target;
});
