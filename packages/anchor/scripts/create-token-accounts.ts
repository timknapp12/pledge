#!/usr/bin/env npx ts-node

/**
 * Create USDC Token Accounts for Treasury & Charity
 *
 * Fetches the on-chain config to get treasury/charity addresses, then creates
 * their Associated Token Accounts (ATAs) for the USDC mint if they don't exist.
 *
 * Usage:
 *   npx ts-node scripts/create-token-accounts.ts --network <network> --mint <usdc-mint>
 *
 * Options:
 *   --network  Network to use: localhost, devnet, mainnet (default: localhost)
 *   --admin    Path to admin keypair (default: ./admin-wallet.json or ~/.config/solana/id.json)
 *   --mint     USDC mint address (required)
 *
 * Example:
 *   npx ts-node scripts/create-token-accounts.ts \
 *     --network devnet \
 *     --mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
 */

import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
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
  Network,
} from "./common";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const network = (args.network || "localhost") as Network;
  const adminPath = args.admin || getDefaultAdminKeypairPath();
  const mintAddress = args.mint;

  if (!mintAddress) {
    printError("Missing required argument: --mint");
    console.log("Usage: npx ts-node scripts/create-token-accounts.ts --network <network> --mint <usdc-mint>");
    process.exit(1);
  }

  let mint: PublicKey;
  try {
    mint = new PublicKey(mintAddress);
  } catch {
    printError(`Invalid mint address: ${mintAddress}`);
    process.exit(1);
  }

  printHeader("Create Treasury & Charity Token Accounts");

  console.log("Network:", network);
  console.log("Mint:", mint.toBase58());
  console.log("");

  // Load payer keypair
  let payer;
  try {
    payer = loadKeypair(adminPath);
    console.log("Payer:", payer.publicKey.toBase58());
  } catch (error: any) {
    printError(`Failed to load keypair: ${error.message}`);
    process.exit(1);
  }

  // Connect
  const clusterUrl = getClusterUrl(network);
  const connection = new Connection(clusterUrl, "confirmed");
  console.log("Connected to:", clusterUrl);

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log("Payer balance:", (balance / 1e9).toFixed(4), "SOL\n");

  // Fetch on-chain config
  const program = initializeProgram(connection, payer);
  const [configPda] = deriveConfigPda();

  let config;
  try {
    config = await program.account.programConfig.fetch(configPda);
  } catch {
    printError("Program config not found. Run initialize.ts first.");
    process.exit(1);
  }

  const treasury: PublicKey = config.treasury;
  const charity: PublicKey = config.charity;

  console.log("Treasury wallet:", treasury.toBase58());
  console.log("Charity wallet:", charity.toBase58());
  console.log("");

  // Derive ATAs
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);
  const charityAta = await getAssociatedTokenAddress(mint, charity);

  console.log("Treasury ATA:", treasuryAta.toBase58());
  console.log("Charity ATA:", charityAta.toBase58());
  console.log("");

  // Check which ATAs need to be created
  const transaction = new Transaction();
  let needsCreate = false;

  const treasuryAccount = await connection.getAccountInfo(treasuryAta);
  if (treasuryAccount) {
    console.log("Treasury ATA already exists - skipping");
  } else {
    console.log("Treasury ATA does not exist - will create");
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        treasuryAta,
        treasury,
        mint,
      )
    );
    needsCreate = true;
  }

  const charityAccount = await connection.getAccountInfo(charityAta);
  if (charityAccount) {
    console.log("Charity ATA already exists - skipping");
  } else {
    console.log("Charity ATA does not exist - will create");
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        charityAta,
        charity,
        mint,
      )
    );
    needsCreate = true;
  }

  if (!needsCreate) {
    printSuccess("All token accounts already exist. Nothing to do.");
    return;
  }

  // Send transaction
  console.log("\nCreating token accounts...");
  try {
    const tx = await sendAndConfirmTransaction(connection, transaction, [payer]);
    printSuccess("Token accounts created successfully!");
    console.log("Transaction:", tx);
    console.log(`Explorer: https://explorer.solana.com/tx/${tx}?cluster=${network}`);
  } catch (error: any) {
    printError(`Failed to create token accounts: ${error.message}`);
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
