/**
 * Common utilities for admin scripts
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Pledge } from "../target/types/pledge";
import * as fs from "fs";
import * as path from "path";

// Program ID from Anchor.toml
export const PROGRAM_ID = new PublicKey("GXmRKiwZ6ozV8iGJLq1usFafhpPPYFjfFoQcCPGUQpJe");

// PDA Seeds
export const CONFIG_SEED = "config";
export const PLEDGE_SEED = "pledge";
export const VAULT_SEED = "vault";

// Default config values
export const DEFAULT_TREASURY_SPLIT_BPS = 7000; // 70%
export const DEFAULT_PARTIAL_FEE_BPS = 100; // 1%
export const DEFAULT_EDIT_PENALTY_BPS = 1000; // 10%
export const DEFAULT_GRACE_PERIOD = 86400; // 1 day in seconds

/**
 * Network configuration
 */
export type Network = "localhost" | "devnet" | "mainnet";

export function getClusterUrl(network: Network): string {
  switch (network) {
    case "localhost":
      return "http://localhost:8899";
    case "devnet":
      return clusterApiUrl("devnet");
    case "mainnet":
      return clusterApiUrl("mainnet-beta");
    default:
      throw new Error(`Unknown network: ${network}`);
  }
}

/**
 * Load keypair from file
 */
export function loadKeypair(keypairPath: string): Keypair {
  const resolvedPath = keypairPath.startsWith("~")
    ? keypairPath.replace("~", process.env.HOME || "")
    : keypairPath;

  const absolutePath = path.isAbsolute(resolvedPath)
    ? resolvedPath
    : path.resolve(process.cwd(), resolvedPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Keypair file not found: ${absolutePath}`);
  }

  const keypairData = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

/**
 * Get default admin keypair path
 */
export function getDefaultAdminKeypairPath(): string {
  // Check for local admin wallet first
  const localAdmin = path.resolve(process.cwd(), "admin-wallet.json");
  if (fs.existsSync(localAdmin)) {
    return localAdmin;
  }

  // Fall back to default Solana keypair
  const defaultKeypair = path.resolve(
    process.env.HOME || "",
    ".config/solana/id.json"
  );
  return defaultKeypair;
}

/**
 * Initialize Anchor provider and program
 */
export function initializeProgram(
  connection: Connection,
  wallet: Keypair
): anchor.Program<Pledge> {
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Load IDL
  const idlPath = path.resolve(__dirname, "../target/idl/pledge.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  return new anchor.Program(idl, provider) as anchor.Program<Pledge>;
}

/**
 * Derive config PDA
 */
export function deriveConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    PROGRAM_ID
  );
}

/**
 * Derive pledge PDA
 */
export function derivePledgePda(
  user: PublicKey,
  createdAt: anchor.BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PLEDGE_SEED),
      user.toBuffer(),
      createdAt.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
}

/**
 * Derive vault PDA
 */
export function deriveVaultPda(pledge: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), pledge.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Format BPS as percentage
 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Format seconds as human readable
 */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  return `${Math.floor(seconds / 86400)} days`;
}

/**
 * Format USDC amount (6 decimals)
 */
export function formatUsdc(amount: number | bigint): string {
  const value = Number(amount) / 1_000_000;
  return `${value.toFixed(2)} USDC`;
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        result[key] = value;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }

  return result;
}

/**
 * Print header for script output
 */
export function printHeader(title: string): void {
  console.log("\n" + "=".repeat(50));
  console.log(title);
  console.log("=".repeat(50) + "\n");
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(`\n✓ ${message}\n`);
}

/**
 * Print error message
 */
export function printError(message: string): void {
  console.error(`\n✗ ${message}\n`);
}

/**
 * Confirm action with user
 */
export async function confirm(message: string): Promise<boolean> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
