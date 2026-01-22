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

describe("process_completion", () => {
  let ctx: TestContext;
  let crank: Keypair;

  before(async () => {
    ctx = await setupTestContext();
    await initializeConfig(ctx);

    // Create a crank signer (permissionless)
    crank = Keypair.generate();
    await airdrop(ctx.provider.connection, crank.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
  });

  it("processes 100% completion - full refund, no fee", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);
    const stakeAmount = TEN_USDC;

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 2);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    // Create pledge
    await ctx.program.methods
      .createPledge(new anchor.BN(stakeAmount), deadline)
      .accounts({
        user: user.keypair.publicKey,
        pledge: pledgePda,
        vault: vaultPda,
        userTokenAccount: user.tokenAccount,
        mint: ctx.usdcMint,
      })
      .signers([user.keypair])
      .rpc();

    await sleep(3000);

    // Report 100% completion
    await ctx.program.methods
      .reportCompletion(100)
      .accounts({
        user: user.keypair.publicKey,
        pledge: pledgePda,
      })
      .signers([user.keypair])
      .rpc();

    const userBalanceBefore = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);
    const treasuryBefore = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityBefore = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    // Process completion
    try {
      await ctx.program.methods
        .processCompletion()
        .accounts({
          crank: crank.publicKey,
          pledge: pledgePda,
          vault: vaultPda,
          user: user.keypair.publicKey,
          userTokenAccount: user.tokenAccount,
          treasuryTokenAccount,
          charityTokenAccount,
        })
        .signers([crank])
        .rpc();
    } catch (e: any) {
      console.log("ProcessCompletion error:", e.message);
      console.log("Error code:", e.code);
      console.log("Error name:", e.name);
      if (e.error) console.log("Inner error:", JSON.stringify(e.error));
      if (e.logs) {
        console.log("Logs:");
        e.logs.forEach((l: string) => console.log("  ", l));
      }
      throw e;
    }

    // Verify user got full refund
    const userBalanceAfter = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );
    expect(Number(userBalanceAfter - userBalanceBefore)).to.equal(stakeAmount);

    // Verify no fees collected
    const treasuryAfter = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityAfter = await getTokenBalance(ctx.provider.connection, charityTokenAccount);
    expect(Number(treasuryAfter - treasuryBefore)).to.equal(0);
    expect(Number(charityAfter - charityBefore)).to.equal(0);

    // Verify pledge status
    const pledge = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledge.status).to.deep.equal({ completed: {} });
  });

  it("processes 50% completion - proportional refund minus fee", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);
    const stakeAmount = TEN_USDC; // 10 USDC

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 2);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    await ctx.program.methods
      .createPledge(new anchor.BN(stakeAmount), deadline)
      .accounts({
        user: user.keypair.publicKey,
        pledge: pledgePda,
        vault: vaultPda,
        userTokenAccount: user.tokenAccount,
        mint: ctx.usdcMint,
      })
      .signers([user.keypair])
      .rpc();

    await sleep(3000);

    await ctx.program.methods
      .reportCompletion(50)
      .accounts({
        user: user.keypair.publicKey,
        pledge: pledgePda,
      })
      .signers([user.keypair])
      .rpc();

    const userBalanceBefore = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);
    const treasuryBefore = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityBefore = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    try {
      await ctx.program.methods
        .processCompletion()
        .accounts({
          crank: crank.publicKey,
          pledge: pledgePda,
          vault: vaultPda,
          user: user.keypair.publicKey,
          userTokenAccount: user.tokenAccount,
          treasuryTokenAccount,
          charityTokenAccount,
        })
        .signers([crank])
        .rpc();
    } catch (e: any) {
      console.log("ProcessCompletion error:", e.message);
      console.log("Error code:", e.code);
      console.log("Error name:", e.name);
      if (e.error) console.log("Inner error:", JSON.stringify(e.error));
      if (e.logs) {
        console.log("Logs:");
        e.logs.forEach((l: string) => console.log("  ", l));
      }
      throw e;
    }

    // Calculate expected amounts:
    // 50% of 10 USDC = 5 USDC proportional
    // 1% fee on 5 USDC = 0.05 USDC (50,000 micro USDC)
    // Refund = 5 - 0.05 = 4.95 USDC (4,950,000 micro USDC)
    // Forfeited = 10 - 5 = 5 USDC
    // Total to split = fee (50,000) + forfeited (5,000,000) = 5,050,000
    // Treasury (70%) = 3,535,000
    // Charity (30%) = 1,515,000

    const userBalanceAfter = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );
    const userRefund = Number(userBalanceAfter - userBalanceBefore);
    expect(userRefund).to.equal(4_950_000); // 4.95 USDC

    const treasuryAfter = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityAfter = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    expect(Number(treasuryAfter - treasuryBefore)).to.equal(3_535_000); // 70% of 5,050,000
    expect(Number(charityAfter - charityBefore)).to.equal(1_515_000); // 30% of 5,050,000

    const pledge = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledge.status).to.deep.equal({ completed: {} });
  });

  it("processes 0% completion - full forfeiture", async () => {
    const user = await createTestUser(ctx, HUNDRED_USDC);
    const stakeAmount = TEN_USDC;

    const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
    const createdAt = new anchor.BN(currentTimestamp);
    const deadline = new anchor.BN(currentTimestamp + 2);

    const [pledgePda] = derivePledgePda(
      ctx.program.programId,
      user.keypair.publicKey,
      createdAt
    );
    const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

    await ctx.program.methods
      .createPledge(new anchor.BN(stakeAmount), deadline)
      .accounts({
        user: user.keypair.publicKey,
        pledge: pledgePda,
        vault: vaultPda,
        userTokenAccount: user.tokenAccount,
        mint: ctx.usdcMint,
      })
      .signers([user.keypair])
      .rpc();

    await sleep(3000);

    await ctx.program.methods
      .reportCompletion(0)
      .accounts({
        user: user.keypair.publicKey,
        pledge: pledgePda,
      })
      .signers([user.keypair])
      .rpc();

    const userBalanceBefore = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);
    const treasuryBefore = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityBefore = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    try {
      await ctx.program.methods
        .processCompletion()
        .accounts({
          crank: crank.publicKey,
          pledge: pledgePda,
          vault: vaultPda,
          user: user.keypair.publicKey,
          userTokenAccount: user.tokenAccount,
          treasuryTokenAccount,
          charityTokenAccount,
        })
        .signers([crank])
        .rpc();
    } catch (e: any) {
      console.log("ProcessCompletion error:", e.message);
      console.log("Error code:", e.code);
      console.log("Error name:", e.name);
      if (e.error) console.log("Inner error:", JSON.stringify(e.error));
      if (e.logs) {
        console.log("Logs:");
        e.logs.forEach((l: string) => console.log("  ", l));
      }
      throw e;
    }

    // 0% completion = full forfeiture
    // Treasury (70%) = 7,000,000
    // Charity (30%) = 3,000,000

    const userBalanceAfter = await getTokenBalance(
      ctx.provider.connection,
      user.tokenAccount
    );
    expect(Number(userBalanceAfter - userBalanceBefore)).to.equal(0); // No refund

    const treasuryAfter = await getTokenBalance(ctx.provider.connection, treasuryTokenAccount);
    const charityAfter = await getTokenBalance(ctx.provider.connection, charityTokenAccount);

    expect(Number(treasuryAfter - treasuryBefore)).to.equal(7_000_000); // 70%
    expect(Number(charityAfter - charityBefore)).to.equal(3_000_000); // 30%

    const pledge = await ctx.program.account.pledge.fetch(pledgePda);
    expect(pledge.status).to.deep.equal({ forfeited: {} });
  });

  it("fails to process non-reported pledge", async () => {
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
      .createPledge(new anchor.BN(TEN_USDC), deadline)
      .accounts({
        user: user.keypair.publicKey,
        pledge: pledgePda,
        vault: vaultPda,
        userTokenAccount: user.tokenAccount,
        mint: ctx.usdcMint,
      })
      .signers([user.keypair])
      .rpc();

    const treasuryTokenAccount = await getTreasuryTokenAccount(ctx);
    const charityTokenAccount = await getCharityTokenAccount(ctx);

    try {
      await ctx.program.methods
        .processCompletion()
        .accounts({
          crank: crank.publicKey,
          pledge: pledgePda,
          vault: vaultPda,
          user: user.keypair.publicKey,
          userTokenAccount: user.tokenAccount,
          treasuryTokenAccount,
          charityTokenAccount,
        })
        .signers([crank])
        .rpc();

      expect.fail("Should have thrown PledgeNotReported error");
    } catch (err) {
      expect(err.message).to.include("PledgeNotReported");
    }
  });
});
