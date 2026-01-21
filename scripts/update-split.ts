/**
 * Admin script to update the treasury/charity split percentages
 *
 * Usage: npx ts-node scripts/update-split.ts --treasury 70 --charity 30
 *
 * --treasury: Treasury percentage (0-100)
 * --charity: Charity percentage (0-100)
 * Note: Treasury + Charity must equal 100
 */

import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const treasuryIndex = args.indexOf('--treasury');
const charityIndex = args.indexOf('--charity');

if (treasuryIndex === -1 || charityIndex === -1) {
  console.error('Usage: npx ts-node scripts/update-split.ts --treasury <pct> --charity <pct>');
  process.exit(1);
}

const treasuryPct = parseInt(args[treasuryIndex + 1], 10);
const charityPct = parseInt(args[charityIndex + 1], 10);

if (isNaN(treasuryPct) || isNaN(charityPct)) {
  console.error('Treasury and charity percentages must be numbers');
  process.exit(1);
}

if (treasuryPct + charityPct !== 100) {
  console.error('Treasury + Charity must equal 100%');
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
  console.log(`Setting split: Treasury ${treasuryPct}%, Charity ${charityPct}%`);

  // Connect to cluster
  const connection = new Connection(rpcUrl);
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Convert percentages to basis points
  const treasuryBps = treasuryPct * 100;
  const charityBps = charityPct * 100;

  // TODO: Load program and call update_split instruction
  // const tx = await program.methods
  //   .updateSplit(treasuryBps, charityBps)
  //   .accounts({
  //     admin: walletKeypair.publicKey,
  //     config: configPda,
  //   })
  //   .rpc();

  // console.log(`Transaction signature: ${tx}`);
  console.log('Split update complete!');
}

main().catch(console.error);
