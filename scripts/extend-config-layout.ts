/**
 * One-time devnet migration: extend ProgramConfig account 184 → 217 bytes.
 *
 *   HELIUS_API_KEY=... npx ts-node scripts/extend-config-layout.ts --network devnet
 *
 * Requires ADMIN_KEYPAIR_PATH (default: ~/.config/solana/pledge-admin-<network>.json)
 * to be the on-chain config admin.
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_SEED = 'config';
const PROGRAM_ID = new PublicKey('PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp');

const RPC_ENDPOINTS: Record<string, string> = {
  devnet: `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || ''}`,
  mainnet: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || ''}`,
};

function parseNetwork(): string {
  const i = process.argv.indexOf('--network');
  if (i === -1 || !process.argv[i + 1]) {
    console.error('Usage: npx ts-node scripts/extend-config-layout.ts --network devnet');
    process.exit(1);
  }
  return process.argv[i + 1];
}

async function main() {
  const network = parseNetwork();
  if (!['devnet', 'mainnet'].includes(network)) {
    console.error('Only devnet or mainnet');
    process.exit(1);
  }
  if (!process.env.HELIUS_API_KEY) {
    console.error('HELIUS_API_KEY required');
    process.exit(1);
  }

  const keypairPath =
    process.env.ADMIN_KEYPAIR_PATH ||
    path.join(process.env.HOME!, `.config/solana/pledge-admin-${network}.json`);

  if (!fs.existsSync(keypairPath)) {
    console.error(`Admin keypair not found: ${keypairPath}`);
    process.exit(1);
  }

  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8'))),
  );

  const connection = new Connection(RPC_ENDPOINTS[network], 'confirmed');
  const idlPath = path.join(__dirname, '../packages/anchor/target/idl/pledge.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const wallet = new Wallet(adminKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);

  const program = new Program(idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    PROGRAM_ID,
  );

  const info = await connection.getAccountInfo(configPda);
  console.log(`Config PDA: ${configPda.toBase58()}`);
  console.log(`Current data length: ${info?.data.length ?? 0}`);

  const tx = await (program.methods as any)
    .extendConfigLayout()
    .accounts({
      admin: adminKeypair.publicKey,
      config: configPda,
      systemProgram: SystemProgram.programId,
    })
    .signers([adminKeypair])
    .rpc();

  console.log(`\n✅ extend_config_layout OK`);
  console.log(`Tx: ${tx}`);
  console.log(
    `Explorer: https://explorer.solana.com/tx/${tx}?cluster=${network === 'mainnet' ? 'mainnet-beta' : 'devnet'}`,
  );

  const after = await connection.getAccountInfo(configPda);
  console.log(`New data length: ${after?.data.length ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
