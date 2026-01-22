import * as anchor from "@coral-xyz/anchor";
import { SystemProgram, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Pledge } from "../target/types/pledge";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Pledge as anchor.Program<Pledge>;

  // Generate keypairs
  const admin = Keypair.generate();
  const treasury = Keypair.generate();
  const charity = Keypair.generate();
  const user = Keypair.generate();

  console.log("Admin:", admin.publicKey.toBase58());
  console.log("Program:", program.programId.toBase58());

  // Airdrop SOL
  console.log("Airdropping SOL...");
  const sig1 = await provider.connection.requestAirdrop(admin.publicKey, 10 * LAMPORTS_PER_SOL);
  await provider.connection.confirmTransaction(sig1);
  const sig2 = await provider.connection.requestAirdrop(treasury.publicKey, LAMPORTS_PER_SOL);
  await provider.connection.confirmTransaction(sig2);
  const sig3 = await provider.connection.requestAirdrop(charity.publicKey, LAMPORTS_PER_SOL);
  await provider.connection.confirmTransaction(sig3);
  const sig4 = await provider.connection.requestAirdrop(user.publicKey, 5 * LAMPORTS_PER_SOL);
  await provider.connection.confirmTransaction(sig4);

  // Create USDC mint
  console.log("Creating USDC mint...");
  const usdcMint = await createMint(provider.connection, admin, admin.publicKey, null, 6);
  console.log("USDC Mint:", usdcMint.toBase58());

  // Create user token account and mint
  const userTokenAccount = await createAssociatedTokenAccount(provider.connection, admin, usdcMint, user.publicKey);
  await mintTo(provider.connection, admin, usdcMint, userTokenAccount, admin, 100_000_000);
  console.log("User token account:", userTokenAccount.toBase58());

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  console.log("Config PDA:", configPda.toBase58());

  // Initialize config
  console.log("Initializing config...");
  try {
    await program.methods
      .initialize(treasury.publicKey, charity.publicKey, 7000, 100, 1000, new anchor.BN(86400))
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    console.log("Config initialized");
  } catch (e) {
    console.error("Initialize error:", e);
    return;
  }

  // Get current timestamp for pledge
  const slot = await provider.connection.getSlot();
  const timestamp = await provider.connection.getBlockTime(slot);
  const createdAt = new anchor.BN(timestamp || Math.floor(Date.now() / 1000));
  const deadline = createdAt.add(new anchor.BN(3600));

  // Derive pledge and vault PDAs
  const [pledgePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pledge"), user.publicKey.toBuffer(), createdAt.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), pledgePda.toBuffer()],
    program.programId
  );
  console.log("Pledge PDA:", pledgePda.toBase58());
  console.log("Vault PDA:", vaultPda.toBase58());

  // Create pledge
  console.log("Creating pledge...");
  try {
    const tx = await program.methods
      .createPledge(new anchor.BN(10_000_000), deadline)
      .accounts({
        user: user.publicKey,
        config: configPda,
        pledge: pledgePda,
        vault: vaultPda,
        userTokenAccount,
        mint: usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    console.log("Pledge created! Tx:", tx);
  } catch (e: any) {
    console.error("CreatePledge error:", e);
    if (e.logs) {
      console.log("Logs:");
      e.logs.forEach((l: string) => console.log(l));
    }
  }
}

main().catch(console.error);
