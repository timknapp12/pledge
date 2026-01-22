#!/usr/bin/env npx ts-node

/**
 * View Program Config
 *
 * Usage:
 *   npx ts-node scripts/view-config.ts --network <network>
 *
 * Options:
 *   --network    Network to use: localhost, devnet, mainnet (default: localhost)
 *   --json       Output as JSON
 *
 * Example:
 *   npx ts-node scripts/view-config.ts --network devnet
 *   npx ts-node scripts/view-config.ts --network mainnet --json
 */

import { Connection } from "@solana/web3.js";
import {
  getClusterUrl,
  initializeProgram,
  deriveConfigPda,
  parseArgs,
  printHeader,
  printError,
  formatBps,
  formatSeconds,
  Network,
  loadKeypair,
  getDefaultAdminKeypairPath,
} from "./common";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const network = (args.network || "localhost") as Network;
  const outputJson = args.json === "true";

  if (!outputJson) {
    printHeader("Pledge Program Config");
    console.log("Network:", network);
  }

  // Connect
  const clusterUrl = getClusterUrl(network);
  const connection = new Connection(clusterUrl, "confirmed");

  if (!outputJson) {
    console.log("RPC:", clusterUrl);
  }

  // Load a dummy keypair just to initialize the program (we're only reading)
  const adminPath = getDefaultAdminKeypairPath();
  let admin;
  try {
    admin = loadKeypair(adminPath);
  } catch {
    // If no keypair, create a dummy one for read-only operations
    const { Keypair } = await import("@solana/web3.js");
    admin = Keypair.generate();
  }

  // Initialize program
  const program = initializeProgram(connection, admin);

  if (!outputJson) {
    console.log("Program ID:", program.programId.toBase58());
  }

  // Derive config PDA
  const [configPda] = deriveConfigPda();

  if (!outputJson) {
    console.log("Config PDA:", configPda.toBase58());
    console.log("");
  }

  // Fetch config
  try {
    const config = await program.account.programConfig.fetch(configPda);

    if (outputJson) {
      // JSON output
      console.log(JSON.stringify({
        configPda: configPda.toBase58(),
        admin: config.admin.toBase58(),
        treasury: config.treasury.toBase58(),
        charity: config.charity.toBase58(),
        treasurySplitBps: config.treasurySplitBps,
        partialFeeBps: config.partialFeeBps,
        editPenaltyBps: config.editPenaltyBps,
        gracePeriodSeconds: config.gracePeriodSeconds.toNumber(),
        paused: config.paused,
        bump: config.bump,
      }, null, 2));
    } else {
      // Human-readable output
      console.log("Current Configuration:");
      console.log("-".repeat(40));
      console.log("");
      console.log("Admin:", config.admin.toBase58());
      console.log("Treasury:", config.treasury.toBase58());
      console.log("Charity:", config.charity.toBase58());
      console.log("");
      console.log("Fee Settings:");
      console.log("  Treasury Split:", formatBps(config.treasurySplitBps), `(${config.treasurySplitBps} BPS)`);
      console.log("  Partial Fee:", formatBps(config.partialFeeBps), `(${config.partialFeeBps} BPS)`);
      console.log("  Edit Penalty:", formatBps(config.editPenaltyBps), `(${config.editPenaltyBps} BPS)`);
      console.log("");
      console.log("Timing:");
      console.log("  Grace Period:", formatSeconds(config.gracePeriodSeconds.toNumber()), `(${config.gracePeriodSeconds.toNumber()} seconds)`);
      console.log("");
      console.log("Status:");
      console.log("  Paused:", config.paused ? "YES - PROGRAM IS PAUSED" : "No");
      console.log("  Bump:", config.bump);
      console.log("");
    }
  } catch (error: any) {
    if (error.message.includes("Account does not exist")) {
      printError("Config not initialized yet. Run initialize.ts first.");
    } else {
      printError(`Failed to fetch config: ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
