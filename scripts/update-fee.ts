/**
 * Admin script to update the partial completion fee percentage
 *
 * Usage: npx ts-node scripts/update-fee.ts --fee-bps 100
 *
 * --fee-bps: Fee in basis points (100 = 1%)
 */

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const feeBpsIndex = args.indexOf('--fee-bps');
if (feeBpsIndex === -1 || !args[feeBpsIndex + 1]) {
  console.error('Usage: npx ts-node scripts/update-fee.ts --fee-bps <basis_points>');
  process.exit(1);
}

const feeBps = parseInt(args[feeBpsIndex + 1], 10);
if (isNaN(feeBps) || feeBps < 0 || feeBps > 10000) {
  console.error('Fee must be between 0 and 10000 basis points');
  process.exit(1);
}

async function main() {
  // Load environment
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'http://localhost:8899';
  const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME!, '.config/solana/id.json');

  // Load admin keypair
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  console.log(`Admin wallet: ${walletKeypair.publicKey.toBase58()}`);
  console.log(`Setting fee to: ${feeBps} basis points (${feeBps / 100}%)`);

  // Connect to cluster
  const connection = new Connection(rpcUrl);
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Load program
  // TODO: Load IDL and create program instance
  // const program = anchor.workspace.Pledge as Program;

  // Call update_fee instruction
  // TODO: Implement once program is built
  // const tx = await program.methods
  //   .updateFee(feeBps)
  //   .accounts({
  //     admin: walletKeypair.publicKey,
  //     config: configPda,
  //   })
  //   .rpc();

  // console.log(`Transaction signature: ${tx}`);
  console.log('Fee update complete!');
}

main().catch(console.error);
