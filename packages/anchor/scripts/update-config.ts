#!/usr/bin/env npx ts-node

/**
 * Update Program Config
 *
 * Usage:
 *   npx ts-node scripts/update-config.ts --network <network> [options]
 *
 * Options:
 *   --network         Network to use: localhost, devnet, mainnet (default: localhost)
 *   --admin           Path to admin keypair (default: ./admin-wallet.json or ~/.config/solana/id.json)
 *   --treasury        New treasury wallet public key
 *   --charity         New charity wallet public key
 *   --treasury-split  New treasury split in BPS (max 10000)
 *   --partial-fee     New partial completion fee in BPS (max 1000)
 *   --edit-penalty    New edit penalty in BPS (max 1000)
 *   --grace-period    New grace period in seconds
 *
 * Examples:
 *   # Update treasury split to 80%
 *   npx ts-node scripts/update-config.ts --network devnet --treasury-split 8000
 *
 *   # Update multiple values
 *   npx ts-node scripts/update-config.ts --network devnet --partial-fee 200 --edit-penalty 500
 *
 *   # Update treasury wallet
 *   npx ts-node scripts/update-config.ts --network devnet --treasury 7xKX...abc
 */

import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
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
  formatBps,
  formatSeconds,
  confirm,
  Network,
} from "./common";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const network = (args.network || "localhost") as Network;
  const adminPath = args.admin || getDefaultAdminKeypairPath();

  // Parse optional update values
  const treasuryPubkey = args.treasury;
  const charityPubkey = args.charity;
  const treasurySplitBps = args["treasury-split"] ? parseInt(args["treasury-split"]) : null;
  const partialFeeBps = args["partial-fee"] ? parseInt(args["partial-fee"]) : null;
  const editPenaltyBps = args["edit-penalty"] ? parseInt(args["edit-penalty"]) : null;
  const gracePeriod = args["grace-period"] ? parseInt(args["grace-period"]) : null;

  // Check if any update values provided
  if (!treasuryPubkey && !charityPubkey && treasurySplitBps === null &&
      partialFeeBps === null && editPenaltyBps === null && gracePeriod === null) {
    printError("No update values provided.");
    console.log("Usage: npx ts-node scripts/update-config.ts --network <network> [options]");
    console.log("");
    console.log("Options:");
    console.log("  --treasury        New treasury wallet public key");
    console.log("  --charity         New charity wallet public key");
    console.log("  --treasury-split  New treasury split in BPS (max 10000)");
    console.log("  --partial-fee     New partial completion fee in BPS (max 1000)");
    console.log("  --edit-penalty    New edit penalty in BPS (max 1000)");
    console.log("  --grace-period    New grace period in seconds");
    process.exit(1);
  }

  // Validate BPS values
  if (treasurySplitBps !== null && treasurySplitBps > 10000) {
    printError("Treasury split must be <= 10000 BPS (100%)");
    process.exit(1);
  }

  if (partialFeeBps !== null && partialFeeBps > 1000) {
    printError("Partial fee must be <= 1000 BPS (10%)");
    process.exit(1);
  }

  if (editPenaltyBps !== null && editPenaltyBps > 1000) {
    printError("Edit penalty must be <= 1000 BPS (10%)");
    process.exit(1);
  }

  printHeader("Update Pledge Program Config");

  console.log("Network:", network);
  console.log("Admin keypair:", adminPath);
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

  // Parse pubkeys
  let treasury: PublicKey | null = null;
  let charity: PublicKey | null = null;

  if (treasuryPubkey) {
    try {
      treasury = new PublicKey(treasuryPubkey);
    } catch (error: any) {
      printError(`Invalid treasury public key: ${error.message}`);
      process.exit(1);
    }
  }

  if (charityPubkey) {
    try {
      charity = new PublicKey(charityPubkey);
    } catch (error: any) {
      printError(`Invalid charity public key: ${error.message}`);
      process.exit(1);
    }
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

  // Show changes
  console.log("\nChanges to apply:");
  console.log("-".repeat(40));

  if (treasury) {
    console.log("Treasury:");
    console.log("  Current:", currentConfig.treasury.toBase58());
    console.log("  New:    ", treasury.toBase58());
  }

  if (charity) {
    console.log("Charity:");
    console.log("  Current:", currentConfig.charity.toBase58());
    console.log("  New:    ", charity.toBase58());
  }

  if (treasurySplitBps !== null) {
    console.log("Treasury Split:");
    console.log("  Current:", formatBps(currentConfig.treasurySplitBps), `(${currentConfig.treasurySplitBps} BPS)`);
    console.log("  New:    ", formatBps(treasurySplitBps), `(${treasurySplitBps} BPS)`);
  }

  if (partialFeeBps !== null) {
    console.log("Partial Fee:");
    console.log("  Current:", formatBps(currentConfig.partialFeeBps), `(${currentConfig.partialFeeBps} BPS)`);
    console.log("  New:    ", formatBps(partialFeeBps), `(${partialFeeBps} BPS)`);
  }

  if (editPenaltyBps !== null) {
    console.log("Edit Penalty:");
    console.log("  Current:", formatBps(currentConfig.editPenaltyBps), `(${currentConfig.editPenaltyBps} BPS)`);
    console.log("  New:    ", formatBps(editPenaltyBps), `(${editPenaltyBps} BPS)`);
  }

  if (gracePeriod !== null) {
    console.log("Grace Period:");
    console.log("  Current:", formatSeconds(currentConfig.gracePeriodSeconds.toNumber()), `(${currentConfig.gracePeriodSeconds.toNumber()} seconds)`);
    console.log("  New:    ", formatSeconds(gracePeriod), `(${gracePeriod} seconds)`);
  }

  console.log("");

  // Confirm for mainnet
  if (network === "mainnet") {
    const confirmed = await confirm("You are updating config on MAINNET. Are you sure?");
    if (!confirmed) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // Update config
  console.log("Updating config...");

  try {
    const tx = await program.methods
      .updateConfig(
        treasury,
        charity,
        treasurySplitBps,
        partialFeeBps,
        editPenaltyBps,
        gracePeriod !== null ? new anchor.BN(gracePeriod) : null,
        null // paused - use pause.ts instead
      )
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    printSuccess("Config updated successfully!");
    console.log("Transaction:", tx);
    console.log(`Explorer: https://explorer.solana.com/tx/${tx}?cluster=${network}`);

    // Verify
    const newConfig = await program.account.programConfig.fetch(configPda);
    console.log("\nUpdated config:");
    console.log("  Treasury:", newConfig.treasury.toBase58());
    console.log("  Charity:", newConfig.charity.toBase58());
    console.log("  Treasury Split:", formatBps(newConfig.treasurySplitBps));
    console.log("  Partial Fee:", formatBps(newConfig.partialFeeBps));
    console.log("  Edit Penalty:", formatBps(newConfig.editPenaltyBps));
    console.log("  Grace Period:", formatSeconds(newConfig.gracePeriodSeconds.toNumber()));
    console.log("  Paused:", newConfig.paused);
  } catch (error: any) {
    printError(`Failed to update config: ${error.message}`);
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
