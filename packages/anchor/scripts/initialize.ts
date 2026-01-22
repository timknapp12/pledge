#!/usr/bin/env npx ts-node

/**
 * Initialize Program Config
 *
 * Usage:
 *   npx ts-node scripts/initialize.ts --network <network> --treasury <pubkey> --charity <pubkey>
 *
 * Options:
 *   --network         Network to use: localhost, devnet, mainnet (default: localhost)
 *   --admin           Path to admin keypair (default: ./admin-wallet.json or ~/.config/solana/id.json)
 *   --treasury        Treasury wallet public key (required)
 *   --charity         Charity wallet public key (required)
 *   --treasury-split  Treasury split in BPS (default: 7000 = 70%)
 *   --partial-fee     Partial completion fee in BPS (default: 100 = 1%)
 *   --edit-penalty    Edit penalty in BPS (default: 1000 = 10%)
 *   --grace-period    Grace period in seconds (default: 86400 = 1 day)
 *
 * Example:
 *   npx ts-node scripts/initialize.ts \
 *     --network devnet \
 *     --treasury 7xKX...abc \
 *     --charity 8yLY...def
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
  DEFAULT_TREASURY_SPLIT_BPS,
  DEFAULT_PARTIAL_FEE_BPS,
  DEFAULT_EDIT_PENALTY_BPS,
  DEFAULT_GRACE_PERIOD,
  Network,
} from "./common";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Parse arguments
  const network = (args.network || "localhost") as Network;
  const adminPath = args.admin || getDefaultAdminKeypairPath();
  const treasuryPubkey = args.treasury;
  const charityPubkey = args.charity;
  const treasurySplitBps = parseInt(args["treasury-split"] || String(DEFAULT_TREASURY_SPLIT_BPS));
  const partialFeeBps = parseInt(args["partial-fee"] || String(DEFAULT_PARTIAL_FEE_BPS));
  const editPenaltyBps = parseInt(args["edit-penalty"] || String(DEFAULT_EDIT_PENALTY_BPS));
  const gracePeriod = parseInt(args["grace-period"] || String(DEFAULT_GRACE_PERIOD));

  // Validate required arguments
  if (!treasuryPubkey) {
    printError("Missing required argument: --treasury");
    console.log("Usage: npx ts-node scripts/initialize.ts --treasury <pubkey> --charity <pubkey>");
    process.exit(1);
  }

  if (!charityPubkey) {
    printError("Missing required argument: --charity");
    console.log("Usage: npx ts-node scripts/initialize.ts --treasury <pubkey> --charity <pubkey>");
    process.exit(1);
  }

  // Validate BPS values
  if (treasurySplitBps > 10000) {
    printError("Treasury split must be <= 10000 BPS (100%)");
    process.exit(1);
  }

  if (partialFeeBps > 1000) {
    printError("Partial fee must be <= 1000 BPS (10%)");
    process.exit(1);
  }

  if (editPenaltyBps > 1000) {
    printError("Edit penalty must be <= 1000 BPS (10%)");
    process.exit(1);
  }

  printHeader("Initialize Pledge Program Config");

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
  let treasury: PublicKey;
  let charity: PublicKey;
  try {
    treasury = new PublicKey(treasuryPubkey);
    charity = new PublicKey(charityPubkey);
  } catch (error: any) {
    printError(`Invalid public key: ${error.message}`);
    process.exit(1);
  }

  console.log("Treasury:", treasury.toBase58());
  console.log("Charity:", charity.toBase58());
  console.log("");
  console.log("Config values:");
  console.log("  Treasury split:", formatBps(treasurySplitBps), `(${treasurySplitBps} BPS)`);
  console.log("  Partial fee:", formatBps(partialFeeBps), `(${partialFeeBps} BPS)`);
  console.log("  Edit penalty:", formatBps(editPenaltyBps), `(${editPenaltyBps} BPS)`);
  console.log("  Grace period:", formatSeconds(gracePeriod), `(${gracePeriod} seconds)`);
  console.log("");

  // Confirm
  if (network === "mainnet") {
    const confirmed = await confirm("You are initializing on MAINNET. Are you sure?");
    if (!confirmed) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // Connect
  const clusterUrl = getClusterUrl(network);
  const connection = new Connection(clusterUrl, "confirmed");
  console.log("Connected to:", clusterUrl);

  // Check admin balance
  const balance = await connection.getBalance(admin.publicKey);
  console.log("Admin balance:", (balance / 1e9).toFixed(4), "SOL");

  if (balance < 0.01 * 1e9) {
    printError("Insufficient balance. Need at least 0.01 SOL for transaction fees.");
    process.exit(1);
  }

  // Initialize program
  const program = initializeProgram(connection, admin);
  console.log("Program ID:", program.programId.toBase58());

  // Derive config PDA
  const [configPda, configBump] = deriveConfigPda();
  console.log("Config PDA:", configPda.toBase58());

  // Check if config already exists
  try {
    const existingConfig = await program.account.programConfig.fetch(configPda);
    if (existingConfig) {
      printError("Config already initialized!");
      console.log("Current admin:", existingConfig.admin.toBase58());
      console.log("Use update-config.ts to modify existing config.");
      process.exit(1);
    }
  } catch {
    // Config doesn't exist - proceed
  }

  // Initialize
  console.log("\nInitializing config...");

  try {
    const tx = await program.methods
      .initialize(
        treasury,
        charity,
        treasurySplitBps,
        partialFeeBps,
        editPenaltyBps,
        new anchor.BN(gracePeriod)
      )
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    printSuccess("Config initialized successfully!");
    console.log("Transaction:", tx);
    console.log(`Explorer: https://explorer.solana.com/tx/${tx}?cluster=${network}`);

    // Verify
    const config = await program.account.programConfig.fetch(configPda);
    console.log("\nVerified config:");
    console.log("  Admin:", config.admin.toBase58());
    console.log("  Treasury:", config.treasury.toBase58());
    console.log("  Charity:", config.charity.toBase58());
    console.log("  Paused:", config.paused);
  } catch (error: any) {
    printError(`Failed to initialize: ${error.message}`);
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
