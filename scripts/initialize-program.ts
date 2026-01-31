/**
 * Initialize the Pledge program on devnet or mainnet
 *
 * Usage:
 *   npx ts-node scripts/initialize-program.ts --network devnet
 *   npx ts-node scripts/initialize-program.ts --network mainnet
 *
 * Environment variables (or use defaults):
 *   ADMIN_KEYPAIR_PATH: Path to admin keypair JSON file
 *   TREASURY_PUBKEY: Treasury wallet address (defaults to admin)
 *   CHARITY_PUBKEY: Charity wallet address (defaults to admin)
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

// RPC endpoints
const RPC_ENDPOINTS: Record<string, string> = {
  devnet: `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || ''}`,
  mainnet: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || ''}`,
  localnet: 'http://localhost:8899',
};

// Program ID
const PROGRAM_ID = new PublicKey('PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp');

// Parse command line arguments
function parseArgs(): { network: string } {
  const args = process.argv.slice(2);
  const networkIndex = args.indexOf('--network');

  if (networkIndex === -1 || !args[networkIndex + 1]) {
    console.error('Usage: npx ts-node scripts/initialize-program.ts --network <devnet|mainnet|localnet>');
    process.exit(1);
  }

  const network = args[networkIndex + 1];
  if (!['devnet', 'mainnet', 'localnet'].includes(network)) {
    console.error('Network must be one of: devnet, mainnet, localnet');
    process.exit(1);
  }

  return { network };
}

async function main() {
  const { network } = parseArgs();

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
    console.log(`   Treasury Split: ${existingConfig.treasurySplitBps / 100}%`);
    console.log(`   Partial Fee: ${existingConfig.partialFeeBps / 100}%`);
    console.log(`   Edit Penalty: ${existingConfig.editPenaltyBps / 100}%`);
    console.log(`   Grace Period: ${existingConfig.gracePeriodSeconds.toNumber() / 3600} hours`);
    console.log(`   Paused: ${existingConfig.paused}`);
    return;
  } catch {
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

  console.log(`\n📊 Configuration:`);
  console.log(`   Treasury: ${treasuryPubkey.toBase58()}`);
  console.log(`   Charity: ${charityPubkey.toBase58()}`);
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
