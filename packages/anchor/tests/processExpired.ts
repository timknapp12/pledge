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
  airdrop,
  TestContext,
  TEN_USDC,
  HUNDRED_USDC,
  sleep,
} from "./utils/helpers";

describe("process_expired", () => {
  let ctx: TestContext;
  let crank: Keypair;

  before(async () => {
    ctx = await setupTestContext();
    await initializeConfig(ctx);

    // Update config with short grace period for testing (2 seconds instead of 1 day)
    await ctx.program.methods
      .updateConfig(null, null, null, null, null, new anchor.BN(2), null)
      .accounts({
        admin: ctx.admin.publicKey,
        config: ctx.configPda,
      })
      .signers([ctx.admin])
      .rpc();

    crank = Keypair.generate();
    await airdrop(ctx.provider.connection, crank.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
  });

  it("processes expired pledge with completion data from crank (50%)", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);
    const stakeAmount = TEN_USDC;

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 1); // 1 second from now

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

    // Wait for deadline + grace period to pass
    await sleep(5000);

    const userBalanceBefore = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);
    const treasuryBefore = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityBefore = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    // Crank processes with 50% completion from DB data
    await ctx.program.methods
      .processExpired(50)
      .accounts({
        crank: crank.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
        vault: vaultPda,
        user: user.keypair.publicKey,
        userTokenAccount: user.tokenAccount,
        treasuryTokenAccount,
        charityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([crank])
      .rpc();

    // Same calculations as process_completion 50%:
    // Refund = 4,950,000 (4.95 USDC)
    // Treasury = 3,535,000
    // Charity = 1,515,000

    const userBalanceAfter = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );
    expect(Number(userBalanceAfter - userBalanceBefore)).to.equal(4_950_000);

    const treasuryAfter = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityAfter = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    expect(Number(treasuryAfter - treasuryBefore)).to.equal(3_535_000);
    expect(Number(charityAfter - charityBefore)).to.equal(1_515_000);

    const pledge = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledge.status).to.deep.equal({ completed: {} });
    expect(pledge.completionPercentage).to.equal(50);
  });

  it("processes expired pledge with 0% completion - full forfeiture", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);
    const stakeAmount = TEN_USDC;

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 1);

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

    await sleep(5000);

    const userBalanceBefore = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);
    const treasuryBefore = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityBefore = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    // Crank processes with 0% completion (user didn't do anything)
    await ctx.program.methods
      .processExpired(0)
      .accounts({
        crank: crank.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
        vault: vaultPda,
        user: user.keypair.publicKey,
        userTokenAccount: user.tokenAccount,
        treasuryTokenAccount,
        charityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([crank])
      .rpc();

    const userBalanceAfter = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );
    expect(Number(userBalanceAfter - userBalanceBefore)).to.equal(0);

    const treasuryAfter = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityAfter = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    expect(Number(treasuryAfter - treasuryBefore)).to.equal(7_000_000);
    expect(Number(charityAfter - charityBefore)).to.equal(3_000_000);

    const pledge = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledge.status).to.deep.equal({ forfeited: {} });
  });

  it("fails if grace period has not ended", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 3600); // Far in future

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

    try {
      await ctx.program.methods
        .processExpired(0)
        .accounts({
          crank: crank.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
          vault: vaultPda,
          user: user.keypair.publicKey,
          userTokenAccount: user.tokenAccount,
          treasuryTokenAccount,
          charityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([crank])
        .rpc();

      expect.fail("Should have thrown GracePeriodNotEnded error");
    } catch (err) {
      expect(err.message).to.include("GracePeriodNotEnded");
    }
  });

  it("fails to process already reported pledge", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 1);

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

    await sleep(2000);

    // User reports completion
    await ctx.program.methods
      .reportCompletion(100)
      .accounts({
        user: user.keypair.publicKey,
        config: ctx.configPda,
        pledge: pledgePda,
      })
      .signers([user.keypair])
      .rpc();

    await sleep(3000);

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);

    // Try to process as expired (but pledge is already reported)
    try {
      await ctx.program.methods
        .processExpired(0)
        .accounts({
          crank: crank.publicKey,
          config: ctx.configPda,
          pledge: pledgePda,
          vault: vaultPda,
          user: user.keypair.publicKey,
          userTokenAccount: user.tokenAccount,
          treasuryTokenAccount,
          charityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([crank])
        .rpc();

      expect.fail("Should have thrown PledgeNotActive error");
    } catch (err) {
      expect(err.message).to.include("PledgeNotActive");
    }
  });
});
