#!/usr/bin/env npx ts-node

/**
 * View Pledge Details
 *
 * Usage:
 *   npx ts-node scripts/view-pledge.ts --network <network> --pledge <address>
 *   npx ts-node scripts/view-pledge.ts --network <network> --user <address> --created-at <timestamp>
 *
 * Options:
 *   --network      Network to use: localhost, devnet, mainnet (default: localhost)
 *   --pledge       Pledge account address
 *   --user         User wallet address (used with --created-at to derive PDA)
 *   --created-at   Unix timestamp when pledge was created (used with --user)
 *   --json         Output as JSON
 *
 * Examples:
 *   npx ts-node scripts/view-pledge.ts --network devnet --pledge 7xKX...abc
 *   npx ts-node scripts/view-pledge.ts --network devnet --user 8yLY...def --created-at 1700000000
 */

import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getClusterUrl,
  loadKeypair,
  getDefaultAdminKeypairPath,
  initializeProgram,
  derivePledgePda,
  deriveVaultPda,
  parseArgs,
  printHeader,
  printError,
  formatUsdc,
  formatSeconds,
  Network,
} from "./common";

function formatStatus(status: any): string {
  if (status.active) return "Active";
  if (status.reported) return "Reported";
  if (status.completed) return "Completed";
  if (status.forfeited) return "Forfeited";
  if (status.cancelled) return "Cancelled";
  return "Unknown";
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const network = (args.network || "localhost") as Network;
  const pledgeAddress = args.pledge;
  const userAddress = args.user;
  const createdAt = args["created-at"];
  const outputJson = args.json === "true";

  // Validate arguments
  if (!pledgeAddress && (!userAddress || !createdAt)) {
    printError("Must provide either --pledge or both --user and --created-at");
    console.log("");
    console.log("Usage:");
    console.log("  npx ts-node scripts/view-pledge.ts --network <network> --pledge <address>");
    console.log("  npx ts-node scripts/view-pledge.ts --network <network> --user <address> --created-at <timestamp>");
    process.exit(1);
  }

  if (!outputJson) {
    printHeader("Pledge Details");
    console.log("Network:", network);
  }

  // Connect
  const clusterUrl = getClusterUrl(network);
  const connection = new Connection(clusterUrl, "confirmed");

  // Load a dummy keypair for read-only operations
  const adminPath = getDefaultAdminKeypairPath();
  let admin;
  try {
    admin = loadKeypair(adminPath);
  } catch {
    const { Keypair } = await import("@solana/web3.js");
    admin = Keypair.generate();
  }

  const program = initializeProgram(connection, admin);

  // Determine pledge address
  let pledgePda: PublicKey;

  if (pledgeAddress) {
    try {
      pledgePda = new PublicKey(pledgeAddress);
    } catch (error: any) {
      printError(`Invalid pledge address: ${error.message}`);
      process.exit(1);
    }
  } else {
    try {
      const user = new PublicKey(userAddress!);
      const createdAtBn = new anchor.BN(createdAt!);
      [pledgePda] = derivePledgePda(user, createdAtBn);
    } catch (error: any) {
      printError(`Failed to derive pledge PDA: ${error.message}`);
      process.exit(1);
    }
  }

  if (!outputJson) {
    console.log("Pledge address:", pledgePda.toBase58());
    console.log("");
  }

  // Fetch pledge
  try {
    const pledge = await program.account.pledge.fetch(pledgePda);
    const [vaultPda] = deriveVaultPda(pledgePda);

    // Get vault balance
    let vaultBalance = BigInt(0);
    try {
      const vaultInfo = await connection.getTokenAccountBalance(vaultPda);
      vaultBalance = BigInt(vaultInfo.value.amount);
    } catch {
      // Vault may be closed
    }

    if (outputJson) {
      console.log(JSON.stringify({
        pledgeAddress: pledgePda.toBase58(),
        vaultAddress: vaultPda.toBase58(),
        user: pledge.user.toBase58(),
        mint: pledge.mint.toBase58(),
        stakeAmount: pledge.stakeAmount.toString(),
        deadline: pledge.deadline.toNumber(),
        status: formatStatus(pledge.status),
        completionPercentage: pledge.completionPercentage,
        reportedAt: pledge.reportedAt?.toNumber() || null,
        createdAt: pledge.createdAt.toNumber(),
        vaultBalance: vaultBalance.toString(),
        bump: pledge.bump,
        vaultBump: pledge.vaultBump,
      }, null, 2));
    } else {
      console.log("Pledge Information:");
      console.log("-".repeat(40));
      console.log("");
      console.log("User:", pledge.user.toBase58());
      console.log("Mint:", pledge.mint.toBase58());
      console.log("Vault:", vaultPda.toBase58());
      console.log("");
      console.log("Stake Amount:", formatUsdc(pledge.stakeAmount.toNumber()));
      console.log("Vault Balance:", formatUsdc(vaultBalance));
      console.log("");
      console.log("Status:", formatStatus(pledge.status));
      if (pledge.completionPercentage !== null) {
        console.log("Completion:", `${pledge.completionPercentage}%`);
      }
      console.log("");
      console.log("Timing:");
      console.log("  Created:", formatTimestamp(pledge.createdAt.toNumber()));
      console.log("  Deadline:", formatTimestamp(pledge.deadline.toNumber()));
      if (pledge.reportedAt) {
        console.log("  Reported:", formatTimestamp(pledge.reportedAt.toNumber()));
      }

      // Check if deadline passed
      const now = Math.floor(Date.now() / 1000);
      const deadlineNum = pledge.deadline.toNumber();
      if (now > deadlineNum) {
        const passedBy = now - deadlineNum;
        console.log(`  (Deadline passed ${formatSeconds(passedBy)} ago)`);
      } else {
        const remaining = deadlineNum - now;
        console.log(`  (${formatSeconds(remaining)} remaining)`);
      }

      console.log("");
      console.log("Bumps:", `pledge=${pledge.bump}, vault=${pledge.vaultBump}`);
      console.log("");
    }
  } catch (error: any) {
    if (error.message.includes("Account does not exist")) {
      printError("Pledge not found at this address.");
    } else {
      printError(`Failed to fetch pledge: ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
