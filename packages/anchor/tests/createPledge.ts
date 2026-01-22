import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  setupTestContext,
  initializeConfig,
  createTestUser,
  derivePledgePda,
  deriveVaultPda,
  getCurrentTimestamp,
  getTokenBalance,
  TestContext,
  UserContext,
  TEN_USDC,
  HUNDRED_USDC,
} from "./utils/helpers";

describe("create_pledge", () => {
  let ctx: TestContext;
  let user: UserContext;

  before(async () => {
    ctx = await setupTestContext();
    await initializeConfig(ctx);
    user = await createTestUser(ctx, HUNDRED_USDC);
  });

  it("creates a pledge and stakes USDC", async () => {
    // Create fresh user for this test to avoid state issues
    const testUser = await createTestUser(ctx, HUNDRED_USDC);
    const stakeAmount = TEN_USDC;
    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 3600); // 1 hour from now

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      testUser.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    console.log("User:", testUser.keypair.publicKey.toBase58());
    console.log("Config:", ctx.configPda.toBase58());
    console.log("Pledge PDA:", pledgePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());
    console.log("Mint:", ctx.usdcMint.toBase58());
    console.log("User Token Account:", testUser.tokenAccount.toBase58());
    console.log("Stake amount:", stakeAmount);
    console.log("Deadline:", deadline.toString());

    const userBalanceBefore = await getTokenBalance(
      ctx.provider.connection,
      testUser.tokenAccount
    );
    console.log("User balance before:", userBalanceBefore.toString());

    try {
      await ctx.program.methods
        .createPledge(new anchor.BN(stakeAmount), deadline, createdAt)
        .accounts({
          user: testUser.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
          vault: vaultPda,
          userTokenAccount: testUser.tokenAccount,
          mint: ctx.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser.keypair])
        .rpc();
    } catch (e: any) {
      console.log("Error:", e.message);
      console.log("Error code:", e.code);
      if (e.logs) {
        console.log("Logs:");
        e.logs.forEach((l: string) => console.log("  ", l));
      }
      throw e;
    }

    // Verify pledge account
    const pledge = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledge.user.toBase58()).to.equal(testUser.keypair.publicKey.toBase58());
    expect(pledge.mint.toBase58()).to.equal(ctx.usdcMint.toBase58());
    expect(pledge.stakeAmount.toNumber()).to.equal(stakeAmount);
    expect(pledge.deadline.toNumber()).to.equal(deadline.toNumber());
    expect(pledge.status).to.deep.equal({ active: {} });
    expect(pledge.completionPercentage).to.be.null;
    expect(pledge.reportedAt).to.be.null;

    // Verify tokens transferred
    const userBalanceAfter = await getTokenBalance(
      ctx.provider.connection,
      testUser.tokenAccount
    );
    expect(Number(userBalanceBefore - userBalanceAfter)).to.equal(stakeAmount);

    // Verify vault balance
    const vaultBalance = await getTokenBalance(ctx.provider.connection, vaultPda);
    expect(Number(vaultBalance)).to.equal(stakeAmount);
  });

  it("fails with zero stake amount", async () => {
    const user2 = await createTestUser(ctx, HUNDRED_USDC);
    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 3600);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user2.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    try {
      await ctx.program.methods
        .createPledge(new anchor.BN(0), deadline, createdAt)
        .accounts({
          user: user2.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
          vault: vaultPda,
          userTokenAccount: user2.tokenAccount,
          mint: ctx.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2.keypair])
        .rpc();

      expect.fail("Should have thrown InvalidStakeAmount error");
    } catch (err) {
      expect(err.message).to.include("InvalidStakeAmount");
    }
  });

  it("fails with deadline in the past", async () => {
    const user3 = await createTestUser(ctx, HUNDRED_USDC);
    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp - 100); // In the past

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user3.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    try {
      await ctx.program.methods
        .createPledge(new anchor.BN(TEN_USDC), deadline, createdAt)
        .accounts({
          user: user3.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
          vault: vaultPda,
          userTokenAccount: user3.tokenAccount,
          mint: ctx.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user3.keypair])
        .rpc();

      expect.fail("Should have thrown InvalidDeadline error");
    } catch (err) {
      expect(err.message).to.include("InvalidDeadline");
    }
  });

  it("fails when program is paused", async () => {
    // First, pause the program
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, null, true)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
      })
      .signers([ctx.admin])
      .rpc();

    const user4 = await createTestUser(ctx, HUNDRED_USDC);
    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 3600);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user4.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    try {
      await ctx.program.methods
        .createPledge(new anchor.BN(TEN_USDC), deadline, createdAt)
        .accounts({
          user: user4.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
          vault: vaultPda,
          userTokenAccount: user4.tokenAccount,
          mint: ctx.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user4.keypair])
        .rpc();

      expect.fail("Should have thrown ProgramPaused error");
    } catch (err) {
      expect(err.message).to.include("ProgramPaused");
    }

    // Unpause for other tests
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, null, false)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
      })
      .signers([ctx.admin])
      .rpc();
  });
});
