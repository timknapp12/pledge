#!/usr/bin/env npx ts-node

/**
 * Pause or Unpause Program
 *
 * Usage:
 *   npx ts-node scripts/pause.ts --network <network> --action <pause|unpause>
 *
 * Options:
 *   --network    Network to use: localhost, devnet, mainnet (default: localhost)
 *   --admin      Path to admin keypair (default: ./admin-wallet.json or ~/.config/solana/id.json)
 *   --action     Action to perform: pause or unpause (required)
 *
 * Examples:
 *   npx ts-node scripts/pause.ts --network devnet --action pause
 *   npx ts-node scripts/pause.ts --network devnet --action unpause
 */

import { Connection } from "@solana/web3.js";
import {
  getClusterUrl,
  loadKeypair,
  getDefaultAdminKeypairPath,
  initializeProgram,
  deriveConfigPda,
  parseArgs,
  printHeader,
  printSuccess,
  printError,
  confirm,
  Network,
} from "./common";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const network = (args.network || "localhost") as Network;
  const adminPath = args.admin || getDefaultAdminKeypairPath();
  const action = args.action;

  // Validate action
  if (!action || (action !== "pause" && action !== "unpause")) {
    printError("Invalid or missing action. Use --action pause or --action unpause");
    console.log("");
    console.log("Usage:");
    console.log("  npx ts-node scripts/pause.ts --network <network> --action pause");
    console.log("  npx ts-node scripts/pause.ts --network <network> --action unpause");
    process.exit(1);
  }

  const shouldPause = action === "pause";

  printHeader(shouldPause ? "Pause Pledge Program" : "Unpause Pledge Program");

  console.log("Network:", network);
  console.log("Admin keypair:", adminPath);
  console.log("Action:", action);
  console.log("");

  // Load admin keypair
  let admin;
  try {
    admin = loadKeypair(adminPath);
    console.log("Admin public key:", admin.publicKey.toBase58());
  } catch (error: any) {
    printError(`Failed to load admin keypair: ${error.message}`);
    process.exit(1);
  }

  // Connect
  const clusterUrl = getClusterUrl(network);
  const connection = new Connection(clusterUrl, "confirmed");
  console.log("Connected to:", clusterUrl);

  // Initialize program
  const program = initializeProgram(connection, admin);
  console.log("Program ID:", program.programId.toBase58());

  // Derive config PDA
  const [configPda] = deriveConfigPda();
  console.log("Config PDA:", configPda.toBase58());

  // Fetch current config
  let currentConfig;
  try {
    currentConfig = await program.account.programConfig.fetch(configPda);
  } catch (error: any) {
    printError("Config not initialized. Run initialize.ts first.");
    process.exit(1);
  }

  // Verify admin
  if (currentConfig.admin.toBase58() !== admin.publicKey.toBase58()) {
    printError("You are not the admin of this config.");
    console.log("Config admin:", currentConfig.admin.toBase58());
    console.log("Your key:", admin.publicKey.toBase58());
    process.exit(1);
  }

  // Check current state
  console.log("\nCurrent pause state:", currentConfig.paused ? "PAUSED" : "RUNNING");

  if (currentConfig.paused === shouldPause) {
    console.log(`\nProgram is already ${shouldPause ? "paused" : "running"}. No action needed.`);
    process.exit(0);
  }

  // Confirm for mainnet or pausing
  if (network === "mainnet" || shouldPause) {
    const warningMsg = shouldPause
      ? "This will PAUSE the program. Users will not be able to create new pledges."
      : "This will UNPAUSE the program on MAINNET.";

    console.log(`\nWARNING: ${warningMsg}`);
    const confirmed = await confirm("Are you sure you want to proceed?");
    if (!confirmed) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // Update config
  console.log(`\n${shouldPause ? "Pausing" : "Unpausing"} program...`);

  try {
    const tx = await program.methods
      .updateConfig(
        null, // treasury
        null, // charity
        null, // treasurySplitBps
        null, // partialFeeBps
        null, // editPenaltyBps
        null, // gracePeriodSeconds
        shouldPause // paused
      )
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    printSuccess(`Program ${shouldPause ? "paused" : "unpaused"} successfully!`);
    console.log("Transaction:", tx);
    console.log(`Explorer: https://explorer.solana.com/tx/${tx}?cluster=${network}`);

    // Verify
    const newConfig = await program.account.programConfig.fetch(configPda);
    console.log("\nNew pause state:", newConfig.paused ? "PAUSED" : "RUNNING");
  } catch (error: any) {
    printError(`Failed to ${action} program: ${error.message}`);
    if (error.logs) {
      console.log("\nTransaction logs:");
      error.logs.forEach((log: string) => console.log("  ", log));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
