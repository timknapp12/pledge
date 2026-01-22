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
  TestContext,
  UserContext,
  TEN_USDC,
  HUNDRED_USDC,
  sleep,
} from "./utils/helpers";

describe("report_completion", () => {
  let ctx: TestContext;
  let user: UserContext;

  before(async () => {
    ctx = await setupTestContext();
    await initializeConfig(ctx);
    user = await createTestUser(ctx, HUNDRED_USDC);
  });

  it("reports 100% completion within grace period", async () => {
    // Create a pledge with a very short deadline (2 seconds)
    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 2); // 2 seconds from now

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    await ctx.program.methods
      .createPledge(new anchor.BN(TEN_USDC), deadline, createdAt)
      .accounts({
        user: user.keypair.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
        vault: vaultPda,
        userTokenAccount: user.tokenAccount,
        mint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user.keypair])
      .rpc();

    // Wait for deadline to pass
    await sleep(3000);

    // Report 100% completion
    await ctx.program.methods
      .reportCompletion(100)
      .accounts({
        user: user.keypair.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
      })
      .signers([user.keypair])
      .rpc();

    // Verify pledge status
    const pledge = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledge.status).to.deep.equal({ reported: {} });
    expect(pledge.completionPercentage).to.equal(100);
    expect(pledge.reportedAt).to.not.be.null;
  });

  it("reports partial completion (50%)", async () => {
    const user2 = await createTestUser(ctx, HUNDRED_USDC);
    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 2);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user2.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    await ctx.program.methods
      .createPledge(new anchor.BN(TEN_USDC), deadline, createdAt)
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

    await sleep(3000);

    await ctx.program.methods
      .reportCompletion(50)
      .accounts({
        user: user2.keypair.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
      })
      .signers([user2.keypair])
      .rpc();

    const pledge = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledge.status).to.deep.equal({ reported: {} });
    expect(pledge.completionPercentage).to.equal(50);
  });

  it("reports 0% completion", async () => {
    const user3 = await createTestUser(ctx, HUNDRED_USDC);
    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 2);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user3.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

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

    await sleep(3000);

    await ctx.program.methods
      .reportCompletion(0)
      .accounts({
        user: user3.keypair.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
      })
      .signers([user3.keypair])
      .rpc();

    const pledge = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledge.status).to.deep.equal({ reported: {} });
    expect(pledge.completionPercentage).to.equal(0);
  });

  it("fails to report before deadline", async () => {
    const user4 = await createTestUser(ctx, HUNDRED_USDC);
    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 3600); // 1 hour from now

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user4.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

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

    // Try to report immediately (before deadline)
    try {
      await ctx.program.methods
        .reportCompletion(100)
        .accounts({
          user: user4.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
        })
        .signers([user4.keypair])
        .rpc();

      expect.fail("Should have thrown DeadlineNotPassed error");
    } catch (err) {
      expect(err.message).to.include("DeadlineNotPassed");
    }
  });

  it("fails with invalid completion percentage (> 100)", async () => {
    const user5 = await createTestUser(ctx, HUNDRED_USDC);
    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 2);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user5.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    await ctx.program.methods
      .createPledge(new anchor.BN(TEN_USDC), deadline, createdAt)
      .accounts({
        user: user5.keypair.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
        vault: vaultPda,
        userTokenAccount: user5.tokenAccount,
        mint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user5.keypair])
      .rpc();

    await sleep(3000);

    try {
      await ctx.program.methods
        .reportCompletion(101)
        .accounts({
          user: user5.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
        })
        .signers([user5.keypair])
        .rpc();

      expect.fail("Should have thrown InvalidCompletionPercentage error");
    } catch (err) {
      expect(err.message).to.include("InvalidCompletionPercentage");
    }
  });

  it("fails when non-owner tries to report", async () => {
    const owner = await createTestUser(ctx, HUNDRED_USDC);
    const attacker = await createTestUser(ctx, HUNDRED_USDC);

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 2);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      owner.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    await ctx.program.methods
      .createPledge(new anchor.BN(TEN_USDC), deadline, createdAt)
      .accounts({
        user: owner.keypair.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
        vault: vaultPda,
        userTokenAccount: owner.tokenAccount,
        mint: ctx.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner.keypair])
      .rpc();

    await sleep(3000);

    try {
      await ctx.program.methods
        .reportCompletion(100)
        .accounts({
          user: attacker.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
        })
        .signers([attacker.keypair])
        .rpc();

      expect.fail("Should have thrown NotPledgeOwner error");
    } catch (err) {
      expect(err.message).to.include("NotPledgeOwner");
    }
  });
});
