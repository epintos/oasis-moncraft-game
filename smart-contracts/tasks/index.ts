import dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("deploy").setAction(async (_args, hre) => {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = deployer.address;
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

  const initialHPs = [260, 240, 400, 320, 260, 200, 280, 220, 180, 440];
  const attackDamages = [90, 70, 100, 85, 95, 40, 75, 85, 60, 110];
  const defenses = [80, 60, 90, 70, 55, 30, 80, 65, 40, 100];
  const chancesOfAppearance = [30, 50, 61, 71, 79, 86, 92, 96, 99, 100];
  const chancesOfCapture = [80, 15, 70, 65, 30, 55, 40, 30, 20, 30];

  let roflSignerAddress;

  if (hre.network.name === "sapphire-localnet") {
    roflSignerAddress = process.env.LOCAL_ROFL_SIGNER_ADDRESS;
  } else if (hre.network.name === "sapphire-testnet") {
    roflSignerAddress = process.env.TESTNET_ROFL_SIGNER_ADDRESS;
  } else {
    roflSignerAddress = process.env.ROFL_SIGNER_ADDRESS;
  }

  // const Gasless = await hre.ethers.getContractFactory("Gasless");
  // const gasless = await Gasless.deploy({
  //   gasLimit: 5_000_000,
  //   value: parseEther("10")
  // });
  // await gasless.waitForDeployment();

  // console.log("✅ Gasless address", gasless.target);

  const MonCraft = await hre.ethers.getContractFactory("MonCraft");
  const monCraft = await MonCraft.deploy(
    names,
    imageURIs,
    initialHPs,
    attackDamages,
    defenses,
    chancesOfAppearance,
    chancesOfCapture,
    roflSignerAddress,
    deployerAddress
  );
  const monCraftAddr = await monCraft.waitForDeployment();

  const accessCodeBytes = Buffer.from(process.env.ROFL_ACCESS_CODE!, "hex");
  const tx = await monCraft.updateROFLAccessCode(accessCodeBytes);
  await tx.wait();

  const monsterNFTAddress = await monCraft.s_monsterNFT();

  console.log(`✅ MonCraft address: ${monCraftAddr.target}`);
  console.log(`✅ MonsterNFT address: ${monsterNFTAddress}`);
  return monCraftAddr.target;
});

task("createFight", "Creates a fight in the MonCraft contract")
  .addParam("sessioncodeone", "Player 1 sessionCode")
  .addParam("sessioncodetwo", "Player 2 sessionCode")
  .addParam("moncraftaddress", "Contract Address")
  .setAction(async ({ sessioncodeone, sessioncodetwo, moncraftaddress }, hre) => {
    const [deployer] = await hre.ethers.getSigners();

    // Attach to the MonCraft contract using the provided address
    const monCraft = await hre.ethers.getContractAt("MonCraft", moncraftaddress);

    // Convert session codes to bytes32
    const sessionCodeOneBytes = hre.ethers.encodeBytes32String(sessioncodeone);
    const sessionCodeTwoBytes = hre.ethers.encodeBytes32String(sessioncodetwo);

    // Call the createFight function
    try {
      const tx = await monCraft.createFight(sessionCodeOneBytes, sessionCodeTwoBytes);
      console.log(`Transaction hash: ${tx.hash}`);

      // Wait for the transaction to be mined and get the receipt
      const receipt = await tx.wait();
      console.log("Transaction mined in block:", receipt.blockNumber);

      // Log additional details from the receipt
      console.log("Transaction status:", receipt.status === 1 ? "Success" : "Failed");
      console.log("Gas used:", receipt.gasUsed.toString());

      // Find the FightCreated event in the logs
      const fightCreatedEvent = receipt.logs.find(
        (log: any) =>
          log.address.toLowerCase() === moncraftaddress.toLowerCase() &&
          log.topics[0] === hre.ethers.id("FightCreated(uint256)")
      );

      if (fightCreatedEvent) {
        // Decode the event data
        const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint256"],
          fightCreatedEvent.data
        );
        const fightId = decoded[0].toString();
        console.log(`Fight created with fightId: ${fightId}`);
      } else {
        console.log("FightCreated event not found in logs.");
        return;
      }

      console.log("Fight created successfully!");
    } catch (error) {
      console.error("Error creating the fight:", error);
    }
  });
