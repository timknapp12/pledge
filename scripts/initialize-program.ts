/**
 * Initialize the Pledge program on devnet or mainnet
 *
 * Usage:
 *   CRANK_AUTHORITY_PUBKEY=6F1zq... npx ts-node scripts/initialize-program.ts --network devnet
 *   CRANK_AUTHORITY_PUBKEY=<mainnet-crank> npx ts-node scripts/initialize-program.ts --network mainnet
 *
 * Environment variables (or use defaults):
 *   ADMIN_KEYPAIR_PATH: Path to admin keypair JSON file
 *   TREASURY_PUBKEY: Treasury wallet address (defaults to admin)
 *   CHARITY_PUBKEY: Charity wallet address (defaults to admin)
 *   CRANK_AUTHORITY_PUBKEY: Crank wallet address (required — no default)
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Constants matching the program
const CONFIG_SEED = 'config';
const DEFAULT_TREASURY_SPLIT_BPS = 7000; // 70%
const DEFAULT_PARTIAL_FEE_BPS = 100; // 1%
const DEFAULT_EDIT_PENALTY_BPS = 1000; // 10%
const DEFAULT_GRACE_PERIOD = 86400; // 1 day in seconds

// USDC mint addresses per network
const USDC_MINTS: Record<string, string> = {
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  localnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // use devnet mint for local
};

// RPC endpoints
const RPC_ENDPOINTS: Record<string, string> = {
  devnet: `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || ''}`,
  mainnet: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || ''}`,
  localnet: 'http://localhost:8899',
};

// Program ID
const PROGRAM_ID = new PublicKey('PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp');

// Parse command line arguments
function parseArgs(): { network: string; update: boolean } {
  const args = process.argv.slice(2);
  const networkIndex = args.indexOf('--network');

  if (networkIndex === -1 || !args[networkIndex + 1]) {
    console.error('Usage: npx ts-node scripts/initialize-program.ts --network <devnet|mainnet|localnet> [--update]');
    process.exit(1);
  }

  const network = args[networkIndex + 1];
  if (!['devnet', 'mainnet', 'localnet'].includes(network)) {
    console.error('Network must be one of: devnet, mainnet, localnet');
    process.exit(1);
  }

  const update = args.includes('--update');

  return { network, update };
}

async function main() {
  const { network, update } = parseArgs();

  console.log(`\n🚀 Initializing Pledge program on ${network.toUpperCase()}\n`);

  // Load admin keypair
  const keypairPath =
    process.env.ADMIN_KEYPAIR_PATH ||
    path.join(process.env.HOME!, `.config/solana/pledge-admin-${network}.json`);

  if (!fs.existsSync(keypairPath)) {
    console.error(`❌ Admin keypair not found at: ${keypairPath}`);
    console.error(`\nGenerate one with: solana-keygen new -o ${keypairPath}`);
    process.exit(1);
  }

  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
  );

  console.log(`📋 Admin wallet: ${adminKeypair.publicKey.toBase58()}`);

  // Connect to cluster
  const rpcUrl = RPC_ENDPOINTS[network];
  if (!rpcUrl || (network !== 'localnet' && !process.env.HELIUS_API_KEY)) {
    console.error('❌ HELIUS_API_KEY environment variable required for devnet/mainnet');
    process.exit(1);
  }

  const connection = new Connection(rpcUrl, 'confirmed');

  // Check admin balance
  const balance = await connection.getBalance(adminKeypair.publicKey);
  console.log(`💰 Admin balance: ${balance / 1e9} SOL`);

  if (balance < 0.01 * 1e9) {
    console.error('❌ Admin wallet needs at least 0.01 SOL for transaction fees');
    process.exit(1);
  }

  // Load IDL
  const idlPath = path.join(__dirname, '../packages/anchor/target/idl/pledge.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

  // Set up provider and program
  const wallet = new Wallet(adminKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  const program = new Program(idl, provider);

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    PROGRAM_ID
  );

  console.log(`📍 Config PDA: ${configPda.toBase58()}`);

  // Check if already initialized
  try {
    const existingConfig = await (program.account as any).programConfig.fetch(configPda);
    console.log('\n✅ Program already initialized!');
    console.log(`   Admin: ${existingConfig.admin.toBase58()}`);
    console.log(`   Treasury: ${existingConfig.treasury.toBase58()}`);
    console.log(`   Charity: ${existingConfig.charity.toBase58()}`);
    console.log(`   Crank Authority: ${existingConfig.crankAuthority?.toBase58() ?? 'not set'}`);
    console.log(`   Allowed Mint: ${existingConfig.allowedMint?.toBase58() ?? 'not set'}`);
    console.log(`   Treasury Split: ${existingConfig.treasurySplitBps / 100}%`);
    console.log(`   Partial Fee: ${existingConfig.partialFeeBps / 100}%`);
    console.log(`   Edit Penalty: ${existingConfig.editPenaltyBps / 100}%`);
    console.log(`   Grace Period: ${existingConfig.gracePeriodSeconds.toNumber() / 3600} hours`);
    console.log(`   Paused: ${existingConfig.paused}`);

    if (!update) {
      console.log('\n   Use --update to modify config fields.');
      return;
    }

    // --update mode: call update_config with new values
    console.log('\n📝 Running update_config...');

    // Crank authority — required for update
    if (!process.env.CRANK_AUTHORITY_PUBKEY) {
      console.error('❌ CRANK_AUTHORITY_PUBKEY environment variable required');
      process.exit(1);
    }
    const crankAuthority = new PublicKey(process.env.CRANK_AUTHORITY_PUBKEY);
    const allowedMint = new PublicKey(USDC_MINTS[network]);

    console.log(`   Setting crank_authority: ${crankAuthority.toBase58()}`);
    console.log(`   Setting allowed_mint: ${allowedMint.toBase58()}`);

    const updateTx = await (program.methods as any)
      .updateConfig(
        null,              // treasury (unchanged)
        null,              // charity (unchanged)
        crankAuthority,    // crank_authority (new)
        allowedMint,       // allowed_mint (new)
        null,              // treasury_split_bps (unchanged)
        null,              // partial_fee_bps (unchanged)
        null,              // edit_penalty_bps (unchanged)
        null,              // grace_period_seconds (unchanged)
        null,              // paused (unchanged)
      )
      .accounts({
        admin: adminKeypair.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([adminKeypair])
      .rpc();

    console.log(`\n✅ Config updated successfully!`);
    console.log(`   Transaction: ${updateTx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${updateTx}?cluster=${network}`);

    // Verify
    const updatedConfig = await (program.account as any).programConfig.fetch(configPda);
    console.log(`\n📊 Updated config:`);
    console.log(`   Crank Authority: ${updatedConfig.crankAuthority.toBase58()}`);
    console.log(`   Allowed Mint: ${updatedConfig.allowedMint.toBase58()}`);
    return;
  } catch (err: any) {
    if (update) {
      console.error('\n❌ Update failed:', err.message);
      if (err.logs) {
        console.error('\nProgram logs:');
        err.logs.forEach((log: string) => console.error(`   ${log}`));
      }
      process.exit(1);
    }
    // Config doesn't exist - proceed with initialization
    console.log('📝 Config not found, proceeding with initialization...');
  }

  // Set treasury and charity (default to admin for devnet testing)
  const treasuryPubkey = process.env.TREASURY_PUBKEY
    ? new PublicKey(process.env.TREASURY_PUBKEY)
    : adminKeypair.publicKey;

  const charityPubkey = process.env.CHARITY_PUBKEY
    ? new PublicKey(process.env.CHARITY_PUBKEY)
    : adminKeypair.publicKey;

  // Crank authority — required, no default
  if (!process.env.CRANK_AUTHORITY_PUBKEY) {
    console.error('❌ CRANK_AUTHORITY_PUBKEY environment variable required');
    console.error('   This is the public key of the wallet that runs the crank service.');
    process.exit(1);
  }
  const crankAuthority = new PublicKey(process.env.CRANK_AUTHORITY_PUBKEY);

  // USDC mint for this network
  const allowedMint = new PublicKey(USDC_MINTS[network]);

  console.log(`\n📊 Configuration:`);
  console.log(`   Treasury: ${treasuryPubkey.toBase58()}`);
  console.log(`   Charity: ${charityPubkey.toBase58()}`);
  console.log(`   Crank Authority: ${crankAuthority.toBase58()}`);
  console.log(`   Allowed Mint (USDC): ${allowedMint.toBase58()}`);
  console.log(`   Treasury Split: ${DEFAULT_TREASURY_SPLIT_BPS / 100}%`);
  console.log(`   Partial Fee: ${DEFAULT_PARTIAL_FEE_BPS / 100}%`);
  console.log(`   Edit Penalty: ${DEFAULT_EDIT_PENALTY_BPS / 100}%`);
  console.log(`   Grace Period: ${DEFAULT_GRACE_PERIOD / 3600} hours`);

  // Initialize
  console.log('\n⏳ Sending initialize transaction...');

  try {
    const tx = await (program.methods as any)
      .initialize(
        treasuryPubkey,
        charityPubkey,
        crankAuthority,
        allowedMint,
        DEFAULT_TREASURY_SPLIT_BPS,
        DEFAULT_PARTIAL_FEE_BPS,
        DEFAULT_EDIT_PENALTY_BPS,
        new anchor.BN(DEFAULT_GRACE_PERIOD)
      )
      .accounts({
        admin: adminKeypair.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([adminKeypair])
      .rpc();

    console.log(`\n✅ Program initialized successfully!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${network}`);
  } catch (err: any) {
    console.error('\n❌ Initialization failed:', err.message);
    if (err.logs) {
      console.error('\nProgram logs:');
      err.logs.forEach((log: string) => console.error(`   ${log}`));
    }
    process.exit(1);
  }
}

main().catch(console.error);
