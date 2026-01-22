import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";
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
  getTreasuryTokenAccount,
  getCharityTokenAccount,
  TestContext,
  TEN_USDC,
  HUNDRED_USDC,
  sleep,
} from "./utils/helpers";

describe("edit_pledge", () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await setupTestContext();
    await initializeConfig(ctx);
  });

  it("edits pledge deadline and deducts 10% penalty", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);
    const stakeAmount = TEN_USDC;

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 3600); // 1 hour from now
    const newDeadline = new anchor.BN(currentTimestamp + 7200); // 2 hours from now

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    await ctx.program.methods
      .createPledge(new anchor.BN(stakeAmount), deadline, createdAt)
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

    const pledgeBefore = await ctx.program.account.pledge.fetch(pledgePda);
    const vaultBalanceBefore = await getTokenBalance(ctx.provider.connection, vaultPda);

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);
    const treasuryBefore = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityBefore = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    // Edit pledge with new deadline
    await ctx.program.methods
      .editPledge(newDeadline)
      .accounts({
        user: user.keypair.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
        vault: vaultPda,
        treasuryTokenAccount,
        charityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user.keypair])
      .rpc();

    // 10% penalty on 10 USDC = 1 USDC (1,000,000)
    // Treasury (70%) = 700,000
    // Charity (30%) = 300,000

    const pledgeAfter = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledgeAfter.deadline.toNumber()).to.equal(newDeadline.toNumber());
    expect(pledgeAfter.stakeAmount.toNumber()).to.equal(stakeAmount - 1_000_000); // 9 USDC

    const vaultBalanceAfter = await getTokenBalance(ctx.provider.connection, vaultPda);
    expect(Number(vaultBalanceBefore - vaultBalanceAfter)).to.equal(1_000_000);

    const treasuryAfter = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityAfter = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    expect(Number(treasuryAfter - treasuryBefore)).to.equal(700_000);
    expect(Number(charityAfter - charityBefore)).to.equal(300_000);
  });

  it("edits pledge without new deadline (penalty still applies)", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);
    const stakeAmount = TEN_USDC;

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 3600);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    await ctx.program.methods
      .createPledge(new anchor.BN(stakeAmount), deadline, createdAt)
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

    const pledgeBefore = await ctx.program.account.pledge.fetch(pledgePda);

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);

    // Edit pledge without new deadline (null)
    await ctx.program.methods
      .editPledge(null)
      .accounts({
        user: user.keypair.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
        vault: vaultPda,
        treasuryTokenAccount,
        charityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user.keypair])
      .rpc();

    const pledgeAfter = await ctx.program.account.pledge.fetch(pledgePda);

    // Deadline should remain the same
    expect(pledgeAfter.deadline.toNumber()).to.equal(pledgeBefore.deadline.toNumber());
    // But stake should be reduced by 10%
    expect(pledgeAfter.stakeAmount.toNumber()).to.equal(stakeAmount - 1_000_000);
  });

  it("fails if deadline has already passed", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);

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

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);

    const newDeadline = new anchor.BN(currentTimestamp + 7200);

    try {
      await ctx.program.methods
        .editPledge(newDeadline)
        .accounts({
          user: user.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
          vault: vaultPda,
          treasuryTokenAccount,
          charityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user.keypair])
        .rpc();

      expect.fail("Should have thrown DeadlineAlreadyPassed error");
    } catch (err) {
      expect(err.message).to.include("DeadlineAlreadyPassed");
    }
  });

  it("fails if non-owner tries to edit", async () => {
    const owner = await createTestUser(ctx, HUNDRED_USDC);
    const attacker = await createTestUser(ctx, HUNDRED_USDC);

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 3600);

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

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);

    const newDeadline = new anchor.BN(currentTimestamp + 7200);

    try {
      await ctx.program.methods
        .editPledge(newDeadline)
        .accounts({
          user: attacker.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
          vault: vaultPda,
          treasuryTokenAccount,
          charityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker.keypair])
        .rpc();

      expect.fail("Should have thrown NotPledgeOwner error");
    } catch (err) {
      expect(err.message).to.include("NotPledgeOwner");
    }
  });

  it("fails with new deadline in the past", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 3600);

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

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);

    const pastDeadline = new anchor.BN(currentTimestamp - 100);

    try {
      await ctx.program.methods
        .editPledge(pastDeadline)
        .accounts({
          user: user.keypair.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
          vault: vaultPda,
          treasuryTokenAccount,
          charityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user.keypair])
        .rpc();

      expect.fail("Should have thrown InvalidDeadline error");
    } catch (err) {
      expect(err.message).to.include("InvalidDeadline");
    }
  });
});
